import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readlinkSync,
} from "node:fs";
import { resolve } from "node:path";

function git(workspaceRoot, args, options = {}) {
  const runner = options.spawnSync ?? spawnSync;
  const result = runner("git", ["-C", workspaceRoot, ...args], {
    encoding: args.includes("-z") ? "buffer" : "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : String(result.stderr ?? "");
    throw new Error(`repository snapshot failed: git ${args.join(" ")} (${stderr.trim() || `exit ${result.status}`})`);
  }
  return result.stdout;
}

function nulPaths(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""));
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function repositoryPathFingerprint(workspaceRoot, repositoryPath) {
  const absolute = resolve(workspaceRoot, repositoryPath);
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) return `symlink:${sha256(Buffer.from(readlinkSync(absolute), "utf8"))}`;
    if (stat.isFile()) return `file:${stat.mode.toString(8)}:${sha256(readFileSync(absolute))}`;
    if (stat.isDirectory()) return `directory:${stat.mode.toString(8)}`;
    return `other:${stat.mode.toString(8)}:${stat.size}`;
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

export function captureRepositorySnapshot(workspaceRoot, options = {}) {
  const root = String(git(workspaceRoot, ["rev-parse", "--show-toplevel"], options)).trim();
  const head = String(git(root, ["rev-parse", "HEAD"], options)).trim();
  const index = git(root, ["ls-files", "--stage", "-z", "--"], options);
  const status = git(root, ["status", "--porcelain=v2", "--untracked-files=all", "-z", "--"], options);
  const tracked = nulPaths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"], options));
  const untracked = nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], options));
  const dirtyPaths = [...new Set([...tracked, ...untracked])].sort();
  const fingerprints = Object.fromEntries(dirtyPaths.map((path) => [path, repositoryPathFingerprint(root, path)]));
  return {
    schema: 1,
    repository_root: root,
    head,
    dirty_paths: dirtyPaths,
    fingerprints,
    index_fingerprint: sha256(Buffer.isBuffer(index) ? index : Buffer.from(String(index))),
    status_fingerprint: sha256(Buffer.isBuffer(status) ? status : Buffer.from(String(status))),
    working_tree: dirtyPaths.length > 0 ? "modified" : "unchanged",
    captured_at: new Date().toISOString(),
  };
}

function validSnapshot(value) {
  return Boolean(
    value
    && value.schema === 1
    && typeof value.repository_root === "string"
    && typeof value.head === "string"
    && Array.isArray(value.dirty_paths)
    && value.fingerprints
    && typeof value.fingerprints === "object"
    && !Array.isArray(value.fingerprints),
  );
}

export function deriveRepositoryDelta(baseline, current) {
  if (!validSnapshot(current)) throw new Error("current repository snapshot is invalid");
  if (!baseline) {
    return {
      baseline_available: false,
      changed_paths: [...current.dirty_paths],
      repository_snapshot: evidenceRepositorySnapshot(current, current.dirty_paths, {
        baselineAvailable: false,
      }),
    };
  }
  if (!validSnapshot(baseline)) throw new Error("repository baseline is invalid");
  if (resolve(baseline.repository_root) !== resolve(current.repository_root)) {
    throw new Error("repository root changed after the native closeout baseline");
  }
  if (baseline.head !== current.head) {
    throw new Error("repository HEAD changed after the native closeout baseline");
  }
  const candidates = [...new Set([...baseline.dirty_paths, ...current.dirty_paths])].sort();
  const changedPaths = candidates.filter((path) => {
    const before = Object.prototype.hasOwnProperty.call(baseline.fingerprints, path)
      ? baseline.fingerprints[path]
      : "clean";
    const after = Object.prototype.hasOwnProperty.call(current.fingerprints, path)
      ? current.fingerprints[path]
      : "clean";
    return before !== after;
  });
  return {
    baseline_available: true,
    changed_paths: changedPaths,
    repository_snapshot: evidenceRepositorySnapshot(current, changedPaths, {
      baselineAvailable: true,
    }),
  };
}

export function evidenceRepositorySnapshot(snapshot, relevantPaths, { baselineAvailable = true } = {}) {
  if (!validSnapshot(snapshot)) throw new Error("repository snapshot is invalid");
  const entries = [...new Set(relevantPaths ?? [])].sort().map((path) => (
    `${path}=${snapshot.fingerprints[path] ?? repositoryPathFingerprint(snapshot.repository_root, path)}`
  ));
  entries.push(`index=${snapshot.index_fingerprint ?? "unavailable"}`);
  entries.push(`status=${snapshot.status_fingerprint ?? "unavailable"}`);
  return {
    repository_root: snapshot.repository_root,
    head: snapshot.head,
    working_tree: snapshot.working_tree,
    relevant_fingerprints: entries.length > 0 ? entries.join("; ") : "none",
    known_failures: "none observed by the repository snapshot adapter",
    baseline_available: baselineAvailable,
  };
}
