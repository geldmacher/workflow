import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { repositoryKey } from "./store.mjs";
import { buildSandboxProfile } from "./sandbox.mjs";

function git(workspace, args, options = {}) {
  const result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8", timeout: options.timeout ?? 120_000, input: options.input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  return options.raw ? result.stdout : result.stdout.trimEnd();
}

const snapshotSecretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];
const snapshotFileLimit = 2 * 1024 * 1024;
const snapshotTotalLimit = 10 * 1024 * 1024;

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export function captureDirtySnapshot(workspaceRoot) {
  const baseline = repositoryBaseline(workspaceRoot);
  const staged_patch = git(workspaceRoot, ["diff", "--binary", "--cached", baseline.head], { raw: true });
  const unstaged_patch = git(workspaceRoot, ["diff", "--binary"], { raw: true });
  if (snapshotSecretPatterns.some((pattern) => pattern.test(staged_patch) || pattern.test(unstaged_patch))) {
    throw new Error("secret material detected in tracked dirty snapshot");
  }
  const untrackedNames = git(workspaceRoot, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0").filter(Boolean).sort();
  const untracked = [];
  let total = Buffer.byteLength(staged_patch) + Buffer.byteLength(unstaged_patch);
  for (const path of untrackedNames) {
    const absolute = assertContainedPath(workspaceRoot, path);
    const stats = statSync(absolute);
    if (!stats.isFile()) throw new Error(`dirty snapshot supports files only: ${path}`);
    if (stats.size > snapshotFileLimit) throw new Error(`dirty snapshot file exceeds 2 MiB: ${path}`);
    total += stats.size;
    if (total > snapshotTotalLimit) throw new Error("dirty snapshot exceeds 10 MiB");
    const bytes = readFileSync(absolute);
    const text = bytes.toString("utf8");
    if (snapshotSecretPatterns.some((pattern) => pattern.test(text))) throw new Error(`secret material detected in dirty snapshot: ${path}`);
    untracked.push({ path, mode: stats.mode & 0o777, size: stats.size, hash: hash(bytes), content_base64: bytes.toString("base64") });
  }
  const payload = { schema: 1, head: baseline.head, branch: baseline.branch, status: baseline.status, staged_patch, unstaged_patch, untracked };
  return { ...payload, snapshot_hash: hash(payload), dirty: baseline.status !== "" || untracked.length > 0 };
}

function applyDirtySnapshot(worktreePath, snapshot) {
  if (snapshot.staged_patch) git(worktreePath, ["apply", "--index", "--binary", "-"], { input: snapshot.staged_patch });
  if (snapshot.unstaged_patch) git(worktreePath, ["apply", "--binary", "-"], { input: snapshot.unstaged_patch });
  for (const entry of snapshot.untracked ?? []) {
    const target = assertContainedPath(worktreePath, entry.path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, Buffer.from(entry.content_base64, "base64"), { mode: entry.mode });
  }
}

export function defaultWorktreeRoot(workspaceRoot) {
  return join(homedir(), ".cursor", "geldmacher-workflow", "worktrees", repositoryKey(workspaceRoot));
}

export function repositoryBaseline(workspaceRoot) {
  return {
    head: git(workspaceRoot, ["rev-parse", "HEAD"]),
    branch: git(workspaceRoot, ["branch", "--show-current"]),
    status: git(workspaceRoot, ["status", "--porcelain=v1"]),
  };
}

export function createRunWorktree(workspaceRoot, runId, options = {}) {
  const root = resolve(options.root ?? defaultWorktreeRoot(workspaceRoot));
  const path = join(root, runId);
  if (existsSync(path)) throw new Error(`worktree path already exists: ${path}`);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const branch = `workflow/${runId}`;
  const dirtySnapshot = options.dirtySnapshot ?? captureDirtySnapshot(workspaceRoot);
  const baseline = { head: dirtySnapshot.head, branch: dirtySnapshot.branch, status: dirtySnapshot.status };
  git(workspaceRoot, ["worktree", "add", "-b", branch, path, baseline.head]);
  applyDirtySnapshot(path, dirtySnapshot);
  const humanBaseline = checkpoint(path, "human-baseline");
  const persisted = { ...dirtySnapshot, staged_patch: undefined, unstaged_patch: undefined, untracked: dirtySnapshot.untracked.map(({ content_base64, ...entry }) => entry) };
  if (options.snapshotPath) writeFileSync(options.snapshotPath, `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
  return { path, branch, baseline, dirty_snapshot_hash: dirtySnapshot.snapshot_hash, human_baseline: humanBaseline.commit, dirty: dirtySnapshot.dirty };
}

export function createComparisonBaselineWorktree(workspaceRoot, runId, head, options = {}) {
  const root = resolve(options.root ?? defaultWorktreeRoot(workspaceRoot));
  const path = join(root, `${runId}-baseline`);
  if (existsSync(path)) throw new Error(`comparison baseline worktree path already exists: ${path}`);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  git(workspaceRoot, ["worktree", "add", "--detach", path, head]);
  return { path, head, mode: "read-only-comparison" };
}

export function changedPaths(worktreePath) {
  const lines = git(worktreePath, ["status", "--porcelain=v1", "-uall"]);
  if (!lines) return [];
  return lines.split("\n").map((line) => line.slice(3).split(" -> ").at(-1)).filter(Boolean);
}

const dependencyManifestNames = new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Gemfile", "Gemfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum"]);

function packageDependencies(value) {
  return Object.assign({}, value.dependencies, value.devDependencies, value.peerDependencies, value.optionalDependencies);
}

export function detectDependencyChanges(worktreePath, baseline, paths) {
  const manifests = paths.filter((path) => dependencyManifestNames.has(path) || dependencyManifestNames.has(path.split("/").at(-1)));
  if (manifests.length === 0) return [];
  const changed = new Set();
  const packagePaths = manifests.filter((path) => path.split("/").at(-1) === "package.json");
  for (const path of packagePaths) {
    let before = {};
    try { before = JSON.parse(git(worktreePath, ["show", `${baseline}:${path}`])); } catch { before = {}; }
    let after = {};
    try { after = JSON.parse(readFileSync(assertContainedPath(worktreePath, path), "utf8")); } catch { after = {}; }
    const prior = packageDependencies(before);
    const current = packageDependencies(after);
    for (const name of new Set([...Object.keys(prior), ...Object.keys(current)])) if (prior[name] !== current[name]) changed.add(name);
  }
  const hasPackageChange = packagePaths.length > 0 && changed.size > 0;
  for (const path of manifests) {
    const name = path.split("/").at(-1);
    if (name === "package.json") continue;
    if (["package-lock.json", "npm-shrinkwrap.json"].includes(name) && hasPackageChange) continue;
    changed.add(`unknown:${path}`);
  }
  return [...changed].sort();
}

export function assertContainedPath(root, candidate) {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(root, candidate);
  const rel = relative(normalizedRoot, normalizedCandidate);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return normalizedCandidate;
  throw new Error(`path escapes root: ${candidate}`);
}

export function checkpoint(worktreePath, label) {
  git(worktreePath, ["add", "-A"]);
  const staged = git(worktreePath, ["diff", "--cached", "--name-only"]);
  if (!staged) return { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: true };
  git(worktreePath, ["-c", "user.name=Workflow", "-c", "user.email=workflow@local.invalid", "commit", "-m", `workflow checkpoint: ${label}`]);
  return { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: false };
}

export function rollbackToCheckpoint(worktreePath, commit) {
  git(worktreePath, ["reset", "--hard", commit]);
  git(worktreePath, ["clean", "-fdx"]);
  return { commit: git(worktreePath, ["rev-parse", "HEAD"]), status: git(worktreePath, ["status", "--porcelain=v1"]) };
}

export function parseHostCommand(command) {
  const source = String(command).trim();
  if (!source) throw new Error("empty host check command");
  const argv = [];
  let token = "";
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (escaped) { token += character; escaped = false; continue; }
    if (character === "\\" && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (/\s/.test(character)) {
      if (token) { argv.push(token); token = ""; }
      continue;
    }
    if (/[|&;<>()`$]/.test(character)) throw new Error(`shell syntax is not permitted in host checks: ${character}`);
    token += character;
  }
  if (escaped || quote) throw new Error("unterminated quote or escape in host check command");
  if (token) argv.push(token);
  if (argv.length === 0 || argv[0].includes("=")) throw new Error("host checks must begin with an executable, not an environment assignment");
  return argv;
}

export function runHostCheck(worktreePath, command, timeoutMs = 300_000) {
  if (!Array.isArray(command) || command.length === 0 || command.some((value) => typeof value !== "string" || value === "")) throw new Error("host checks must be non-empty argv arrays");
  const temporary = mkdtempSync(join(tmpdir(), "workflow-host-check-"));
  const started = Date.now();
  try {
    const profile = join(temporary, "host-check.sb");
    writeFileSync(profile, buildSandboxProfile({ writablePaths: [temporary], network: false }), { mode: 0o600 });
    const executable = process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec") ? "/usr/bin/sandbox-exec" : null;
    if (!executable) throw new Error("hard host-check sandbox unavailable");
    const childEnvironment = [
      `PATH=${process.env.PATH}`,
      `LANG=${process.env.LANG ?? "C.UTF-8"}`,
      `LC_ALL=${process.env.LC_ALL ?? "C.UTF-8"}`,
      "CI=1",
      `TMPDIR=${temporary}`,
      `HOME=${temporary}`,
    ];
    const result = spawnSync(executable, ["-f", profile, "/usr/bin/env", "-i", ...childEnvironment, command[0], ...command.slice(1)], {
      cwd: worktreePath,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: process.env,
    });
    return {
      command,
      status: result.status,
      signal: result.signal,
      passed: result.status === 0,
      duration_ms: Date.now() - started,
      stdout: result.stdout?.slice(-50_000) ?? "",
      stderr: result.stderr?.slice(-50_000) ?? "",
    };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
