#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPluginTargets } from "./build-plugin-targets.mjs";

export const PLUGIN_NAME = "geldmacher-workflow";
export const RELEASE_HOSTS = Object.freeze(["cursor", "codex"]);
const scriptPath = fileURLToPath(import.meta.url);
export const defaultRoot = dirname(dirname(scriptPath));
const fixedArchiveTime = "2000-01-01T00:00:00Z";
const developmentRoots = new Set([".agents", ".build", ".cursor", ".git", "node_modules", "test", "tests"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];

function slash(path) {
  return path.split(sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

function writeJson(path, value) {
  writeFileSync(path, canonicalJson(value));
}

function walk(directory, base = directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    const relativePath = slash(relative(base, path));
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`release target contains a symlink: ${relativePath}`);
    if (stat.isDirectory()) result.push(...walk(path, base));
    else if (stat.isFile()) result.push({ path, relativePath, mode: stat.mode & 0o777 });
    else throw new Error(`release target contains a non-regular entry: ${relativePath}`);
  }
  return result;
}

export function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function runChecked(runner, command, args, options = {}, label = `${command} ${args.join(" ")}`) {
  const result = runner(command, args, options);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`${label} failed: ${detail}`);
  }
  return result.stdout.trim();
}

function git(root, args, runner) {
  return runChecked(runner, "git", args, { cwd: root }, `git ${args.join(" ")}`);
}

function readJson(path, label = path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function normalizeRepository(value) {
  if (typeof value !== "string") throw new Error("repository URL is missing");
  const normalized = value.trim()
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/i);
  if (!match) throw new Error(`repository must identify one GitHub repository: ${value}`);
  return match[1];
}

function changelogSections(source) {
  const headings = [...source.matchAll(/^##[ \t]+(?:\[([^\]]+)\]|([^\s]+))(?:[ \t].*)?$/gm)];
  return headings.map((match, index) => ({
    name: match[1] ?? match[2],
    start: match.index,
    headingEnd: match.index + match[0].length,
    end: headings[index + 1]?.index ?? source.length,
    body: source.slice(match.index + match[0].length, headings[index + 1]?.index ?? source.length).trim(),
  }));
}

function releaseChangelogSections(source, version) {
  const sections = changelogSections(source);
  const unreleasedSections = sections.filter((section) => section.name.toLowerCase() === "unreleased");
  if (unreleasedSections.length !== 1) {
    throw new Error(`CHANGELOG.md must contain exactly one Unreleased section; found ${unreleasedSections.length}`);
  }
  const versionSections = sections.filter((section) => section.name === version);
  if (versionSections.length > 1) {
    throw new Error(`CHANGELOG.md must contain at most one ${version} release section; found ${versionSections.length}`);
  }
  const unreleased = unreleasedSections[0];
  if (sections[0] !== unreleased) throw new Error("CHANGELOG.md Unreleased must be the first release section");
  return { sections, unreleased, released: versionSections[0] ?? null };
}

export function createReleaseCut(source, version) {
  const { sections, unreleased, released } = releaseChangelogSections(source, version);
  if (unreleased.body === "") {
    if (!released || released.body === "") throw new Error(`CHANGELOG.md has no notes to release as ${version}`);
    return source;
  }
  if (released && sections.indexOf(released) !== sections.indexOf(unreleased) + 1) {
    throw new Error(`CHANGELOG.md ${version} must immediately follow Unreleased before it can be consolidated`);
  }

  const notes = unreleased.body;
  if (!released) {
    const suffix = unreleased.end < source.length ? "\n\n" : "\n";
    return `${source.slice(0, unreleased.headingEnd)}\n\n## ${version}\n\n${notes}${suffix}${source.slice(unreleased.end)}`;
  }

  const releasedBody = released.body === "" ? notes : `${notes}\n\n${released.body}`;
  const releasedSuffix = released.end < source.length ? "\n\n" : "\n";
  let result = `${source.slice(0, released.headingEnd)}\n\n${releasedBody}${releasedSuffix}${source.slice(released.end)}`;
  result = `${result.slice(0, unreleased.headingEnd)}\n\n${result.slice(unreleased.end)}`;
  return result;
}

export function releaseNotesFromChangelog(source, version) {
  const { unreleased, released } = releaseChangelogSections(source, version);
  if (unreleased.body !== "") throw new Error("CHANGELOG.md Unreleased must be empty before preparing a release");
  if (!released || released.body === "") throw new Error(`CHANGELOG.md has no non-empty ${version} release section`);
  return `# Workflow ${version}\n\n${released.body}\n`;
}

function sourceState(root, runner, { requireClean = false, requireReleaseCut = false } = {}) {
  const packageJson = readJson(join(root, "package.json"), "package.json");
  const version = packageJson.version;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) throw new Error(`package.json has an unsupported version: ${version ?? "missing"}`);
  const manifests = {
    cursor: readJson(join(root, ".cursor-plugin", "plugin.json"), "Cursor manifest"),
    codex: readJson(join(root, "targets", "codex", ".codex-plugin", "plugin.json"), "Codex manifest"),
    agent_plugins: readJson(join(root, "targets", "agent-plugins", "plugin.json"), "Agent Plugins manifest"),
  };
  for (const [target, manifest] of Object.entries(manifests)) {
    if (manifest.name !== PLUGIN_NAME) throw new Error(`${target} manifest name must be ${PLUGIN_NAME}`);
    if (manifest.version !== version) throw new Error(`${target} manifest version ${manifest.version ?? "missing"} differs from ${version}`);
  }
  const repository = normalizeRepository(manifests.cursor.repository);
  for (const [target, manifest] of Object.entries(manifests)) {
    if (normalizeRepository(manifest.repository) !== repository) throw new Error(`${target} manifest repository differs from ${repository}`);
  }
  const commit = git(root, ["rev-parse", "HEAD"], runner);
  const tree = git(root, ["rev-parse", "HEAD^{tree}"], runner);
  const dirtyOutput = git(root, ["status", "--porcelain", "--untracked-files=normal"], runner);
  const clean = dirtyOutput === "";
  const origin = normalizeRepository(git(root, ["remote", "get-url", "origin"], runner));
  if (origin !== repository) throw new Error(`origin ${origin} differs from manifest repository ${repository}`);
  let notes;
  let changelogReady = false;
  try {
    notes = releaseNotesFromChangelog(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
    changelogReady = true;
  } catch (error) {
    if (requireReleaseCut) throw error;
    notes = null;
  }
  if (requireClean && !clean) throw new Error(`repository must be clean; changed paths:\n${dirtyOutput}`);
  return { version, tag: `v${version}`, repository, commit, tree, clean, changelog_ready: changelogReady, notes };
}

function sourceBindingMismatches(source, provenance) {
  const mismatches = [];
  for (const [field, current] of [
    ["version", source.version],
    ["tag", source.tag],
    ["repository", source.repository],
  ]) {
    if (provenance[field] !== current) mismatches.push(`${field} differs`);
  }
  if (provenance.source.commit_sha !== source.commit) mismatches.push("commit differs");
  if (provenance.source.tree_sha !== source.tree) mismatches.push("Git tree differs");
  return mismatches;
}

function assertSourceBinding(source, provenance, context) {
  const mismatches = sourceBindingMismatches(source, provenance);
  if (mismatches.length > 0) throw new Error(`${context}: ${mismatches.join(", ")}`);
}

function assertSameSource(first, second, context) {
  for (const field of ["version", "tag", "repository", "commit", "tree"]) {
    if (first[field] !== second[field]) throw new Error(`${context}: source ${field} changed`);
  }
}

function materializeGitTree(root, commit, destination, runner) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const indexPath = join(dirname(destination), "source.index");
  const env = {
    ...process.env,
    GIT_INDEX_FILE: indexPath,
    GIT_WORK_TREE: destination,
  };
  try {
    const deterministicConfig = ["-c", "core.autocrlf=false", "-c", "core.eol=lf"];
    runChecked(runner, "git", [...deterministicConfig, "read-tree", commit], { cwd: root, env }, "Git source snapshot index");
    runChecked(runner, "git", [...deterministicConfig, "checkout-index", "--all", "--force"], { cwd: root, env }, "Git source snapshot materialization");
  } finally {
    rmSync(indexPath, { force: true });
  }
}

function targetManifest(host) {
  return host === "cursor" ? ".cursor-plugin/plugin.json" : ".codex-plugin/plugin.json";
}

export function inspectReleaseTarget(directory, host, version) {
  if (!RELEASE_HOSTS.includes(host)) throw new Error(`unsupported release host: ${host}`);
  const entries = walk(directory);
  for (const entry of entries) {
    const first = entry.relativePath.split("/", 1)[0];
    if (developmentRoots.has(first)) throw new Error(`${host} release target contains development path: ${entry.relativePath}`);
    const text = readFileSync(entry.path).toString("utf8");
    if (secretPatterns.some((pattern) => pattern.test(text))) {
      throw new Error(`${host} release target contains recognizable secret material: ${entry.relativePath}`);
    }
  }
  const manifestPath = join(directory, targetManifest(host));
  if (!existsSync(manifestPath)) throw new Error(`${host} release target is missing ${targetManifest(host)}`);
  const manifest = readJson(manifestPath, `${host} release manifest`);
  if (manifest.name !== PLUGIN_NAME || manifest.version !== version) {
    throw new Error(`${host} release manifest must identify ${PLUGIN_NAME} ${version}`);
  }
  const digest = createHash("sha256");
  for (const entry of entries) {
    digest.update(`${entry.relativePath}\0${entry.mode.toString(8).padStart(3, "0")}\0${fileSha256(entry.path)}\n`);
  }
  return { content_sha256: digest.digest("hex"), file_count: entries.length };
}

function createDeterministicArchive(source, archive, runner) {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-release-archive-"));
  const gitDirectory = join(temporary, "objects.git");
  try {
    runChecked(runner, "git", ["init", "--bare", "--quiet", gitDirectory], {}, "git archive staging init");
    runChecked(runner, "git", [
      `--git-dir=${gitDirectory}`,
      `--work-tree=${source}`,
      "-c", "core.autocrlf=false",
      "add", "--all", "--force",
    ], {}, "git archive staging add");
    const tree = runChecked(runner, "git", [`--git-dir=${gitDirectory}`, "write-tree"], {}, "git archive staging tree");
    runChecked(runner, "git", [
      `--git-dir=${gitDirectory}`,
      "archive",
      "--format=zip",
      `--prefix=${PLUGIN_NAME}/`,
      `--mtime=${fixedArchiveTime}`,
      `--output=${archive}`,
      tree,
    ], {}, "git archive");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function assetName(host, version) {
  return `${PLUGIN_NAME}-${host}-v${version}.zip`;
}

function receiptPayload(provenance) {
  const value = structuredClone(provenance);
  delete value.receipt_sha256;
  return value;
}

export function receiptForProvenance(provenance) {
  return sha256(canonicalJson(receiptPayload(provenance)));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join("\n") !== wanted.join("\n")) throw new Error(`${label} fields differ: ${actual.join(", ")}`);
}

function shaField(value, label, lengths = [64]) {
  if (!lengths.some((length) => new RegExp(`^[0-9a-f]{${length}}$`).test(value ?? ""))) throw new Error(`${label} must be a lowercase hexadecimal digest`);
}

function validateProvenance(provenance) {
  exactKeys(provenance, [
    "kind", "plugin", "published_assets", "receipt_sha256", "release_gate", "release_notes_sha256",
    "repository", "schema", "source", "tag", "targets", "version",
  ], "provenance.json");
  if (provenance.schema !== 1 || provenance.kind !== "github-release-provenance" || provenance.plugin !== PLUGIN_NAME) {
    throw new Error("provenance.json identity is invalid");
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(provenance.version ?? "") || provenance.tag !== `v${provenance.version}`) {
    throw new Error("provenance.json version and tag are inconsistent");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(provenance.repository ?? "")) throw new Error("provenance.json repository is invalid");
  exactKeys(provenance.source, ["clean", "commit_sha", "tree_sha"], "provenance source");
  if (provenance.source.clean !== true) throw new Error("provenance source must be clean");
  shaField(provenance.source.commit_sha, "provenance commit", [40, 64]);
  shaField(provenance.source.tree_sha, "provenance tree", [40, 64]);
  exactKeys(provenance.release_gate, ["command", "result"], "provenance release gate");
  if (provenance.release_gate.command !== "npm run release-check" || provenance.release_gate.result !== "passed") {
    throw new Error("provenance release gate must record a passed npm run release-check");
  }
  shaField(provenance.release_notes_sha256, "release notes hash");
  shaField(provenance.receipt_sha256, "release receipt");
  exactKeys(provenance.targets, RELEASE_HOSTS, "provenance targets");
  for (const host of RELEASE_HOSTS) {
    const target = provenance.targets[host];
    exactKeys(target, ["archive", "archive_sha256", "content_sha256", "file_count", "root_directory"], `${host} provenance target`);
    if (target.archive !== assetName(host, provenance.version) || target.root_directory !== PLUGIN_NAME) {
      throw new Error(`${host} provenance archive identity is invalid`);
    }
    shaField(target.archive_sha256, `${host} archive hash`);
    shaField(target.content_sha256, `${host} content hash`);
    if (!Number.isSafeInteger(target.file_count) || target.file_count < 1) throw new Error(`${host} file count is invalid`);
  }
  const expectedAssets = [
    assetName("cursor", provenance.version),
    assetName("codex", provenance.version),
    "RELEASE_NOTES.md",
    "provenance.json",
    "SHA256SUMS",
  ];
  if (!Array.isArray(provenance.published_assets) || provenance.published_assets.join("\n") !== expectedAssets.join("\n")) {
    throw new Error("provenance published asset set is invalid");
  }
}

function releaseDirectory(base, version) {
  return join(resolve(base), `v${version}`);
}

function expectedReleasePaths(directory, provenance) {
  return [
    provenance.targets.cursor.archive,
    provenance.targets.codex.archive,
    "RELEASE_NOTES.md",
    "provenance.json",
    "SHA256SUMS",
  ].map((name) => join(directory, name));
}

function checksumDocument(directory, names) {
  return `${names.map((name) => `${fileSha256(join(directory, name))}  ${name}`).join("\n")}\n`;
}

function samePreparedSet(first, second) {
  if (!existsSync(first)) return false;
  const firstNames = readdirSync(first).sort();
  const secondNames = readdirSync(second).sort();
  if (firstNames.join("\n") !== secondNames.join("\n")) return false;
  return firstNames.every((name) => lstatSync(join(first, name)).isFile() && fileSha256(join(first, name)) === fileSha256(join(second, name)));
}

function defaultReleaseGate(root, runner) {
  runChecked(runner, "npm", ["run", "release-check"], { cwd: root }, "npm run release-check");
  return { command: "npm run release-check", result: "passed" };
}

export function verifyPreparedRelease(directory, expectedReceipt) {
  const provenancePath = join(directory, "provenance.json");
  if (!existsSync(provenancePath)) throw new Error("prepared release is missing provenance.json");
  const provenance = readJson(provenancePath, "provenance.json");
  validateProvenance(provenance);
  if (readFileSync(provenancePath, "utf8") !== canonicalJson(provenance)) throw new Error("provenance.json is not canonically encoded");
  const computedReceipt = receiptForProvenance(provenance);
  if (!/^[0-9a-f]{64}$/.test(provenance.receipt_sha256 ?? "") || provenance.receipt_sha256 !== computedReceipt) {
    throw new Error("prepared release receipt does not match provenance.json");
  }
  if (expectedReceipt && expectedReceipt !== computedReceipt) throw new Error("supplied receipt does not authorize this prepared release");
  const expectedNames = expectedReleasePaths(directory, provenance).map((path) => basename(path)).sort();
  const actualNames = readdirSync(directory).sort();
  if (actualNames.join("\n") !== expectedNames.join("\n")) throw new Error(`prepared release files differ: ${actualNames.join(", ")}`);
  for (const host of RELEASE_HOSTS) {
    const target = provenance.targets?.[host];
    const archivePath = join(directory, target?.archive ?? "");
    if (!target || !existsSync(archivePath) || fileSha256(archivePath) !== target.archive_sha256) {
      throw new Error(`${host} archive differs from provenance.json`);
    }
  }
  if (fileSha256(join(directory, "RELEASE_NOTES.md")) !== provenance.release_notes_sha256) {
    throw new Error("RELEASE_NOTES.md differs from provenance.json");
  }
  const checksumNames = [provenance.targets.cursor.archive, provenance.targets.codex.archive, "RELEASE_NOTES.md", "provenance.json"];
  if (readFileSync(join(directory, "SHA256SUMS"), "utf8") !== checksumDocument(directory, checksumNames)) {
    throw new Error("SHA256SUMS differs from the prepared release files");
  }
  return { provenance, receipt: computedReceipt, paths: expectedReleasePaths(directory, provenance) };
}

function atomicWriteText(path, source) {
  const temporary = mkdtempSync(join(dirname(path), ".release-cut-"));
  const staged = join(temporary, basename(path));
  try {
    writeFileSync(staged, source);
    chmodSync(staged, lstatSync(path).mode & 0o777);
    renameSync(staged, path);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function changedRepositoryPaths(root, runner) {
  const values = [
    git(root, ["diff", "--name-only"], runner),
    git(root, ["diff", "--cached", "--name-only"], runner),
    git(root, ["ls-files", "--others", "--exclude-standard"], runner),
  ];
  return [...new Set(values.flatMap((value) => value.split(/\r?\n/).filter(Boolean)))].sort();
}

export function prepareRelease({
  root = defaultRoot,
  releaseRoot = join(root, ".build", "releases"),
  runner = defaultRunner,
  targetBuilder = buildPluginTargets,
  releaseGate = defaultReleaseGate,
} = {}) {
  const source = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
  const gate = releaseGate(resolve(root), runner);
  if (!gate || gate.result !== "passed") throw new Error("release gate did not return a passed result");
  const afterGate = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
  assertSameSource(source, afterGate, "release gate drifted from the prepared source");

  mkdirSync(resolve(releaseRoot), { recursive: true });
  const temporary = mkdtempSync(join(resolve(releaseRoot), ".prepare-"));
  const buildTemporary = mkdtempSync(join(tmpdir(), "workflow-release-build-"));
  const staged = join(temporary, `v${source.version}`);
  const sourceSnapshot = join(buildTemporary, "source");
  const targetRoot = join(buildTemporary, "targets");
  mkdirSync(staged, { recursive: true });
  try {
    materializeGitTree(resolve(root), source.commit, sourceSnapshot, runner);
    const snapshotNotes = releaseNotesFromChangelog(readFileSync(join(sourceSnapshot, "CHANGELOG.md"), "utf8"), source.version);
    if (snapshotNotes !== source.notes) throw new Error("materialized Git source release notes differ from the prepared source");
    const built = targetBuilder(targetRoot, sourceSnapshot);
    if (built.version !== source.version) throw new Error(`target builder returned ${built.version}, expected ${source.version}`);
    const targets = {};
    for (const host of RELEASE_HOSTS) {
      const target = inspectReleaseTarget(built[host].path, host, source.version);
      const archive = assetName(host, source.version);
      createDeterministicArchive(built[host].path, join(staged, archive), runner);
      targets[host] = {
        archive,
        archive_sha256: fileSha256(join(staged, archive)),
        content_sha256: target.content_sha256,
        file_count: target.file_count,
        root_directory: PLUGIN_NAME,
      };
    }
    writeFileSync(join(staged, "RELEASE_NOTES.md"), snapshotNotes);
    const provenance = {
      schema: 1,
      kind: "github-release-provenance",
      plugin: PLUGIN_NAME,
      version: source.version,
      tag: source.tag,
      repository: source.repository,
      source: {
        commit_sha: source.commit,
        tree_sha: source.tree,
        clean: true,
      },
      release_gate: {
        command: gate.command ?? "npm run release-check",
        result: "passed",
      },
      release_notes_sha256: fileSha256(join(staged, "RELEASE_NOTES.md")),
      targets,
      published_assets: [targets.cursor.archive, targets.codex.archive, "RELEASE_NOTES.md", "provenance.json", "SHA256SUMS"],
    };
    provenance.receipt_sha256 = receiptForProvenance(provenance);
    writeJson(join(staged, "provenance.json"), provenance);
    writeFileSync(join(staged, "SHA256SUMS"), checksumDocument(staged, [targets.cursor.archive, targets.codex.archive, "RELEASE_NOTES.md", "provenance.json"]));
    verifyPreparedRelease(staged, provenance.receipt_sha256);
    const finalSource = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
    assertSameSource(source, finalSource, "repository drifted while building release assets");

    const destination = releaseDirectory(releaseRoot, source.version);
    if (existsSync(destination)) {
      if (!samePreparedSet(destination, staged)) throw new Error(`prepared release already exists with different bytes: ${destination}`);
      return { status: "current", directory: destination, provenance, receipt: provenance.receipt_sha256 };
    }
    renameSync(staged, destination);
    return { status: "prepared", directory: destination, provenance, receipt: provenance.receipt_sha256 };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(buildTemporary, { recursive: true, force: true });
  }
}

function ghResult(runner, args, root) {
  return runner("gh", args, { cwd: root });
}

function parseReleaseView(result, tag) {
  if (result.status !== 0) {
    const message = `${result.stderr}\n${result.stdout}`;
    if (/release not found|release does not exist|HTTP 404[^\n]*release/i.test(message)) return null;
    throw new Error(`GitHub release lookup failed: ${(result.stderr || result.stdout).trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`GitHub release ${tag} returned invalid metadata: ${error.message}`);
  }
}

function remoteTagCommit(root, runner, tag) {
  const output = runChecked(runner, "git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }, "remote tag lookup");
  const lines = output.split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/, 2));
  const peeled = lines.find(([, ref]) => ref === `refs/tags/${tag}^{}`);
  const direct = lines.find(([, ref]) => ref === `refs/tags/${tag}`);
  const commit = peeled?.[0] ?? direct?.[0];
  if (!commit) throw new Error(`remote tag ${tag} does not exist on origin`);
  return commit;
}

function normalizedBody(value) {
  return `${String(value ?? "").replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function expectedAssetHashes(directory, provenance) {
  return Object.fromEntries(provenance.published_assets.map((name) => [name, fileSha256(join(directory, name))]));
}

function verifyReleaseMetadata(view, directory, provenance) {
  if (view.tagName !== provenance.tag) throw new Error(`GitHub release tag ${view.tagName ?? "missing"} differs from ${provenance.tag}`);
  if (view.isDraft) throw new Error("GitHub release is a draft; publication will not modify or replace it");
  const prerelease = provenance.version.includes("-");
  if (Boolean(view.isPrerelease) !== prerelease) throw new Error("GitHub release prerelease flag differs from the prepared version");
  if (view.name !== `Workflow ${provenance.version}`) throw new Error("GitHub release title differs from the prepared release");
  if (normalizedBody(view.body) !== normalizedBody(readFileSync(join(directory, "RELEASE_NOTES.md"), "utf8"))) {
    throw new Error("GitHub release notes differ from RELEASE_NOTES.md");
  }
  const expectedNames = [...provenance.published_assets].sort();
  const actualNames = (view.assets ?? []).map((asset) => asset.name).sort();
  if (actualNames.join("\n") !== expectedNames.join("\n")) {
    throw new Error(`GitHub release assets differ; expected [${expectedNames.join(", ")}], received [${actualNames.join(", ")}]`);
  }
}

function verifyRemoteRelease(root, runner, directory, provenance, expectedHashes) {
  const viewResult = ghResult(runner, [
    "release", "view", provenance.tag,
    "--repo", provenance.repository,
    "--json", "tagName,isDraft,isPrerelease,name,body,assets,url",
  ], root);
  const view = parseReleaseView(viewResult, provenance.tag);
  if (!view) throw new Error(`GitHub release ${provenance.tag} is missing during read-back verification`);
  verifyReleaseMetadata(view, directory, provenance);
  const downloadRoot = mkdtempSync(join(tmpdir(), "workflow-release-readback-"));
  try {
    runChecked(runner, "gh", ["release", "download", provenance.tag, "--repo", provenance.repository, "--dir", downloadRoot], { cwd: root }, "GitHub release asset download");
    const actualNames = readdirSync(downloadRoot).sort();
    if (actualNames.join("\n") !== Object.keys(expectedHashes).sort().join("\n")) throw new Error("downloaded GitHub assets differ from the prepared asset set");
    for (const [name, digest] of Object.entries(expectedHashes)) {
      if (fileSha256(join(downloadRoot, name)) !== digest) throw new Error(`downloaded GitHub asset differs: ${name}`);
    }
  } finally {
    rmSync(downloadRoot, { recursive: true, force: true });
  }
  const finalSource = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
  assertSourceBinding(finalSource, provenance, "repository source differs during final GitHub read-back");
  const finalTagCommit = remoteTagCommit(root, runner, provenance.tag);
  if (finalTagCommit !== provenance.source.commit_sha) {
    throw new Error(`remote tag ${provenance.tag} changed during final GitHub read-back`);
  }
  return view;
}

export function publishRelease(receipt, {
  root = defaultRoot,
  releaseRoot = join(root, ".build", "releases"),
  runner = defaultRunner,
} = {}) {
  if (!/^[0-9a-f]{64}$/.test(receipt ?? "")) throw new Error("publish requires one lowercase SHA-256 receipt");
  const source = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
  const directory = releaseDirectory(releaseRoot, source.version);
  const prepared = verifyPreparedRelease(directory, receipt);
  const provenance = prepared.provenance;
  assertSourceBinding(source, provenance, "prepared release differs from the current repository");
  const publicationDirectory = mkdtempSync(join(tmpdir(), "workflow-release-publish-"));
  try {
    for (const name of provenance.published_assets) copyFileSync(join(directory, name), join(publicationDirectory, name));
    const publication = verifyPreparedRelease(publicationDirectory, receipt);
    const expectedHashes = expectedAssetHashes(publicationDirectory, provenance);
    runChecked(runner, "gh", ["auth", "status", "--hostname", "github.com"], { cwd: root }, "GitHub authentication");
    const tagCommit = remoteTagCommit(root, runner, provenance.tag);
    if (tagCommit !== provenance.source.commit_sha) throw new Error(`remote tag ${provenance.tag} points to ${tagCommit}, expected ${provenance.source.commit_sha}`);

    const initialView = parseReleaseView(ghResult(runner, [
      "release", "view", provenance.tag,
      "--repo", provenance.repository,
      "--json", "tagName,isDraft,isPrerelease,name,body,assets,url",
    ], root), provenance.tag);
    if (initialView) {
      verifyReleaseMetadata(initialView, publicationDirectory, provenance);
      const view = verifyRemoteRelease(root, runner, publicationDirectory, provenance, expectedHashes);
      return { status: "current", receipt, tag: provenance.tag, url: view.url ?? null };
    }

    const preCreateSource = sourceState(resolve(root), runner, { requireClean: true, requireReleaseCut: true });
    assertSourceBinding(preCreateSource, provenance, "repository source changed before GitHub release creation");
    verifyPreparedRelease(directory, receipt);
    const preCreateTagCommit = remoteTagCommit(root, runner, provenance.tag);
    if (preCreateTagCommit !== provenance.source.commit_sha) {
      throw new Error(`remote tag ${provenance.tag} changed before publication`);
    }

    const argumentsList = [
      "release", "create", provenance.tag,
      ...publication.paths,
      "--repo", provenance.repository,
      "--verify-tag",
      "--title", `Workflow ${provenance.version}`,
      "--notes-file", join(publicationDirectory, "RELEASE_NOTES.md"),
    ];
    if (provenance.version.includes("-")) argumentsList.push("--prerelease");
    const created = ghResult(runner, argumentsList, root);
    if (created.status !== 0) throw new Error(`GitHub release creation failed without cleanup or overwrite: ${(created.stderr || created.stdout).trim()}`);
    let view;
    try {
      view = verifyRemoteRelease(root, runner, publicationDirectory, provenance, expectedHashes);
    } catch (error) {
      throw new Error(`GitHub release was created but read-back verification failed; remote state was left untouched: ${error.message}`);
    }
    return { status: "published", receipt, tag: provenance.tag, url: view.url ?? (created.stdout.trim() || null) };
  } finally {
    rmSync(publicationDirectory, { recursive: true, force: true });
  }
}

function optionalGit(root, args, runner) {
  const result = runner("git", args, { cwd: root });
  if (result.status === 0) return result.stdout.trim();
  return null;
}

function remoteBranchCommit(root, runner, branch = "main") {
  const output = runChecked(runner, "git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`], {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }, `remote branch lookup for ${branch}`);
  const commit = output.split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/, 2))
    .find(([, ref]) => ref === `refs/heads/${branch}`)?.[0];
  if (!commit) throw new Error(`remote branch origin/${branch} does not exist`);
  shaField(commit, `remote branch origin/${branch}`, [40, 64]);
  return commit;
}

function optionalRemoteTagCommit(root, runner, tag) {
  const output = runChecked(runner, "git", [
    "ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`,
  ], {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }, `remote tag lookup for ${tag}`);
  const lines = output.split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/, 2));
  const commit = lines.find(([, ref]) => ref === `refs/tags/${tag}^{}`)?.[0]
    ?? lines.find(([, ref]) => ref === `refs/tags/${tag}`)?.[0]
    ?? null;
  if (commit) shaField(commit, `remote tag ${tag}`, [40, 64]);
  return commit;
}

function localTagCommit(root, runner, tag) {
  const commit = optionalGit(root, ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], runner);
  if (commit) shaField(commit, `local tag ${tag}`, [40, 64]);
  return commit;
}

function assertGitHubReady(root, runner) {
  const auth = ghResult(runner, ["auth", "status", "--hostname", "github.com"], root);
  const api = ghResult(runner, ["api", "user", "--hostname", "github.com", "--silent"], root);
  const apiMessage = `${api.stderr}\n${api.stdout}`.trim();
  if (api.status !== 0 && /connect|network|resolve|timed? out|unreachable/i.test(apiMessage)) {
    throw new Error(`GitHub is unreachable from this release environment: ${apiMessage}`);
  }
  if (auth.status !== 0) throw new Error(`GitHub authentication failed: ${(auth.stderr || auth.stdout).trim()}`);
  if (api.status !== 0) throw new Error(`GitHub API access failed: ${apiMessage}`);
}

function assertCommitIdentity(root, runner) {
  const name = optionalGit(root, ["config", "--get", "user.name"], runner);
  const email = optionalGit(root, ["config", "--get", "user.email"], runner);
  if (!name || !email) throw new Error("Git commit identity requires configured user.name and user.email");
}

function assertSafeCandidatePaths(root, paths) {
  const resolvedRoot = resolve(root);
  for (const relativePath of paths) {
    if (!relativePath || relativePath.startsWith("/") || relativePath.split("/").includes("..")) {
      throw new Error(`release candidate contains an unsafe path: ${relativePath || "empty"}`);
    }
    if (relativePath === ".gitmodules") throw new Error("release candidate may not add or change submodules");
    const absolute = resolve(resolvedRoot, relativePath);
    if (absolute !== resolvedRoot && !absolute.startsWith(`${resolvedRoot}${sep}`)) {
      throw new Error(`release candidate escapes the repository: ${relativePath}`);
    }
    if (!existsSync(absolute)) continue;
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`release candidate contains a symlink: ${relativePath}`);
    if (stat.isDirectory() && existsSync(join(absolute, ".git"))) {
      throw new Error(`release candidate contains a nested repository: ${relativePath}`);
    }
    if (!stat.isFile()) throw new Error(`release candidate contains a non-regular entry: ${relativePath}`);
    let parent = dirname(absolute);
    while (parent !== resolvedRoot) {
      if (existsSync(join(parent, ".git"))) throw new Error(`release candidate contains a nested repository: ${relativePath}`);
      const next = dirname(parent);
      if (next === parent) break;
      parent = next;
    }
    const text = readFileSync(absolute).toString("utf8");
    if (secretPatterns.some((pattern) => pattern.test(text))) {
      throw new Error(`release candidate contains recognizable secret material: ${relativePath}`);
    }
  }
}

function candidateFingerprint(root, paths) {
  const material = paths.map((relativePath) => {
    const absolute = join(root, relativePath);
    if (!existsSync(absolute)) return `${relativePath}\0deleted`;
    const stat = lstatSync(absolute);
    return `${relativePath}\0${stat.mode & 0o777}\0${fileSha256(absolute)}`;
  });
  return sha256(`${material.join("\n")}\n`);
}

function releaseStatePath(releaseRoot, version) {
  return join(resolve(releaseRoot), `.release-v${version}.json`);
}

function readReleaseState(releaseRoot, source) {
  const path = releaseStatePath(releaseRoot, source.version);
  if (!existsSync(path)) return null;
  const state = readJson(path, "release retry state");
  exactKeys(state, [
    "base_commit", "kind", "release_commit", "repository", "schema", "tag", "tree_sha", "version",
  ], "release retry state");
  if (state.schema !== 1 || state.kind !== "github-release-retry-state") throw new Error("release retry state identity is invalid");
  if (state.version !== source.version || state.tag !== source.tag || state.repository !== source.repository) {
    throw new Error("release retry state differs from the current release identity");
  }
  shaField(state.base_commit, "release retry base commit", [40, 64]);
  shaField(state.release_commit, "release retry commit", [40, 64]);
  shaField(state.tree_sha, "release retry tree", [40, 64]);
  return state;
}

function writeReleaseState(releaseRoot, source, baseCommit) {
  mkdirSync(resolve(releaseRoot), { recursive: true });
  const state = {
    schema: 1,
    kind: "github-release-retry-state",
    version: source.version,
    tag: source.tag,
    repository: source.repository,
    base_commit: baseCommit,
    release_commit: source.commit,
    tree_sha: source.tree,
  };
  writeJson(releaseStatePath(releaseRoot, source.version), state);
  return state;
}

function assertExactRetryState(source, remoteMain, state, root, runner) {
  if (!state) throw new Error("local main differs from origin/main without an exact release retry state");
  if (!source.clean || !source.changelog_ready) throw new Error("release retry state requires a clean release-ready repository");
  if (state.base_commit !== remoteMain || state.release_commit !== source.commit || state.tree_sha !== source.tree) {
    throw new Error("release retry state does not bind the current main, origin/main, and Git tree");
  }
  const parent = git(root, ["rev-parse", "HEAD^"], runner);
  const subject = git(root, ["show", "-s", "--format=%s", "HEAD"], runner);
  if (parent !== remoteMain || subject !== `Release ${source.tag}`) {
    throw new Error("local release retry commit is not the exact harness-created release commit");
  }
}

function preserveIndex(root, runner) {
  const raw = git(root, ["rev-parse", "--git-path", "index"], runner);
  const index = resolve(root, raw);
  const temporary = mkdtempSync(join(tmpdir(), "workflow-release-index-"));
  const backup = join(temporary, "index");
  const existed = existsSync(index);
  if (existed) copyFileSync(index, backup);
  return {
    restore() {
      if (existed) copyFileSync(backup, index);
      else rmSync(index, { force: true });
    },
    close() { rmSync(temporary, { recursive: true, force: true }); },
  };
}

function initialReleaseView(root, runner, source) {
  return parseReleaseView(ghResult(runner, [
    "release", "view", source.tag,
    "--repo", source.repository,
    "--json", "tagName,isDraft,isPrerelease,name,body,assets,url",
  ], root), source.tag);
}

export function completeRelease({
  root = defaultRoot,
  releaseRoot = join(root, ".build", "releases"),
  runner = defaultRunner,
  targetBuilder = buildPluginTargets,
  releaseGate = defaultReleaseGate,
} = {}) {
  const resolvedRoot = resolve(root);
  let source = sourceState(resolvedRoot, runner);
  if (git(resolvedRoot, ["branch", "--show-current"], runner) !== "main") {
    throw new Error("complete release requires the main branch");
  }
  if (git(resolvedRoot, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], runner) !== "origin/main") {
    throw new Error("origin default branch must be main");
  }
  assertCommitIdentity(resolvedRoot, runner);
  assertGitHubReady(resolvedRoot, runner);
  runChecked(runner, "git", ["fetch", "--quiet", "origin", "main", "--tags"], {
    cwd: resolvedRoot,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }, "fresh origin/main and tag fetch");

  source = sourceState(resolvedRoot, runner);
  const baseline = remoteBranchCommit(resolvedRoot, runner);
  const retryState = readReleaseState(releaseRoot, source);
  const retryingLocalCommit = source.commit !== baseline;
  if (retryingLocalCommit) assertExactRetryState(source, baseline, retryState, resolvedRoot, runner);

  const existingLocalTag = localTagCommit(resolvedRoot, runner, source.tag);
  const existingRemoteTag = optionalRemoteTagCommit(resolvedRoot, runner, source.tag);
  const existingRelease = initialReleaseView(resolvedRoot, runner, source);
  if ((!source.clean || !source.changelog_ready) && (existingLocalTag || existingRemoteTag || existingRelease)) {
    throw new Error(`${source.tag} already has tag or release state; dirty or uncut source cannot change it`);
  }
  for (const [label, commit] of [["local", existingLocalTag], ["remote", existingRemoteTag]]) {
    if (commit && commit !== source.commit) throw new Error(`${label} tag ${source.tag} points to ${commit}, expected ${source.commit}`);
  }
  if (existingRelease?.isDraft) throw new Error("GitHub release is a draft; complete release will not modify or replace it");

  let originalChangelog = null;
  let releasedChangelog = null;
  let commitCreated = false;
  let gate;
  const baseCommit = baseline;
  try {
    if (!retryingLocalCommit && !source.changelog_ready) {
      const changelogPath = join(resolvedRoot, "CHANGELOG.md");
      originalChangelog = readFileSync(changelogPath, "utf8");
      releasedChangelog = createReleaseCut(originalChangelog, source.version);
      if (releasedChangelog === originalChangelog) throw new Error(`CHANGELOG.md ${source.version} release cut is not usable`);
      atomicWriteText(changelogPath, releasedChangelog);
      source = sourceState(resolvedRoot, runner);
      if (!source.changelog_ready) throw new Error("release cut did not produce release-ready changelog notes");
    }

    const candidateSource = sourceState(resolvedRoot, runner);
    if (!candidateSource.changelog_ready) throw new Error("final release candidate is missing release-ready changelog notes");
    const changedPaths = changedRepositoryPaths(resolvedRoot, runner);
    assertSafeCandidatePaths(resolvedRoot, changedPaths);
    const fingerprint = candidateFingerprint(resolvedRoot, changedPaths);
    gate = releaseGate(resolvedRoot, runner);
    if (!gate || gate.result !== "passed") throw new Error("release gate did not return a passed result");
    const afterGateSource = sourceState(resolvedRoot, runner);
    assertSameSource(candidateSource, afterGateSource, "release gate drifted from the final release candidate");
    if (git(resolvedRoot, ["branch", "--show-current"], runner) !== "main") {
      throw new Error("release gate changed the active main branch");
    }
    const afterGatePaths = changedRepositoryPaths(resolvedRoot, runner);
    if (afterGatePaths.join("\n") !== changedPaths.join("\n") || candidateFingerprint(resolvedRoot, afterGatePaths) !== fingerprint) {
      throw new Error("release gate changed the final release candidate");
    }
    assertSafeCandidatePaths(resolvedRoot, afterGatePaths);

    if (afterGatePaths.length > 0) {
      if (retryingLocalCommit) throw new Error("release retry state must not contain uncommitted changes");
      const index = preserveIndex(resolvedRoot, runner);
      try {
        git(resolvedRoot, ["add", "--all"], runner);
        const stagedCandidatePaths = changedRepositoryPaths(resolvedRoot, runner);
        if (stagedCandidatePaths.join("\n") !== afterGatePaths.join("\n")
          || candidateFingerprint(resolvedRoot, stagedCandidatePaths) !== fingerprint) {
          throw new Error("release candidate drifted while staging the release commit");
        }
        const staged = git(resolvedRoot, ["diff", "--cached", "--name-only"], runner).split(/\r?\n/).filter(Boolean).sort();
        if (staged.join("\n") !== afterGatePaths.join("\n")) throw new Error("staged release candidate differs from the validated changed paths");
        git(resolvedRoot, ["commit", "--quiet", "-m", `Release ${source.tag}`], runner);
        commitCreated = true;
      } catch (error) {
        index.restore();
        throw error;
      } finally {
        index.close();
      }
      source = sourceState(resolvedRoot, runner, { requireClean: true, requireReleaseCut: true });
      writeReleaseState(releaseRoot, source, baseCommit);
    } else {
      source = sourceState(resolvedRoot, runner, { requireClean: true, requireReleaseCut: true });
    }
  } catch (error) {
    if (!commitCreated && originalChangelog !== null && releasedChangelog !== null) {
      const changelogPath = join(resolvedRoot, "CHANGELOG.md");
      if (existsSync(changelogPath) && readFileSync(changelogPath, "utf8") === releasedChangelog) {
        atomicWriteText(changelogPath, originalChangelog);
      }
    }
    throw error;
  }

  const prepared = prepareRelease({
    root: resolvedRoot,
    releaseRoot,
    runner,
    targetBuilder,
    releaseGate: () => ({ command: gate.command ?? "npm run release-check", result: "passed" }),
  });
  source = sourceState(resolvedRoot, runner, { requireClean: true, requireReleaseCut: true });
  assertSourceBinding(source, prepared.provenance, "prepared release differs from the release commit");

  const currentLocalTag = localTagCommit(resolvedRoot, runner, source.tag);
  if (currentLocalTag && currentLocalTag !== source.commit) throw new Error(`local tag ${source.tag} points to ${currentLocalTag}, expected ${source.commit}`);
  if (!currentLocalTag) git(resolvedRoot, ["tag", source.tag, source.commit], runner);

  const remoteMain = remoteBranchCommit(resolvedRoot, runner);
  const remoteTag = optionalRemoteTagCommit(resolvedRoot, runner, source.tag);
  if (remoteMain !== source.commit || remoteTag !== source.commit) {
    if (remoteMain !== baseCommit && remoteMain !== source.commit) {
      throw new Error(`origin/main changed to ${remoteMain}; expected ${baseCommit} or ${source.commit}`);
    }
    if (remoteTag && remoteTag !== source.commit) {
      throw new Error(`remote tag ${source.tag} points to ${remoteTag}, expected ${source.commit}`);
    }
    runChecked(runner, "git", [
      "push", "--atomic", "origin",
      "refs/heads/main:refs/heads/main",
      `refs/tags/${source.tag}:refs/tags/${source.tag}`,
    ], {
      cwd: resolvedRoot,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    }, "atomic main and release tag push");
  }

  const verifiedMain = remoteBranchCommit(resolvedRoot, runner);
  const verifiedTag = optionalRemoteTagCommit(resolvedRoot, runner, source.tag);
  if (verifiedMain !== source.commit || verifiedTag !== source.commit) {
    throw new Error("atomic push did not bind origin/main and the release tag to the release commit");
  }
  const published = publishRelease(prepared.receipt, { root: resolvedRoot, releaseRoot, runner });
  return {
    action: "release",
    status: published.status,
    version: source.version,
    tag: source.tag,
    commit_sha: source.commit,
    commit_created: commitCreated,
    pushed_atomically: remoteMain !== source.commit || remoteTag !== source.commit,
    directory: prepared.directory,
    receipt: prepared.receipt,
    provenance: prepared.provenance,
    github: { url: published.url, read_back_verified: true },
  };
}

export function releaseFailureReport(error, {
  root = defaultRoot,
  releaseRoot = join(root, ".build", "releases"),
  runner = defaultRunner,
} = {}) {
  const report = {
    action: "release",
    status: "blocked",
    blockers: [error instanceof Error ? error.message : String(error)],
    source: null,
    retained_retry_state: null,
    next_action: "resolve-the-reported-blocker-and-explicitly-invoke-release-plugin-again",
  };
  try {
    const source = sourceState(resolve(root), runner);
    report.source = {
      version: source.version,
      tag: source.tag,
      commit_sha: source.commit,
      tree_sha: source.tree,
      clean: source.clean,
      changelog_ready: source.changelog_ready,
      local_tag_commit: localTagCommit(resolve(root), runner, source.tag),
    };
    try {
      report.retained_retry_state = readReleaseState(releaseRoot, source);
    } catch (stateError) {
      report.blockers.push(stateError.message);
    }
  } catch (sourceError) {
    report.blockers.push(`release source could not be inspected after failure: ${sourceError.message}`);
  }
  return report;
}

function usage() {
  return "Usage: node scripts/plugin-github-release.mjs";
}

function runCli() {
  if (process.argv.slice(2).length !== 0) throw new Error(usage());
  process.stderr.write("Running the complete validated plugin release lifecycle.\n");
  process.stdout.write(`${JSON.stringify(completeRelease(), null, 2)}\n`);
}

const direct = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (direct) {
  try { runCli(); }
  catch (error) {
    process.stderr.write(`Release workflow failed:\n${JSON.stringify(releaseFailureReport(error), null, 2)}\n`);
    process.exitCode = 1;
  }
}
