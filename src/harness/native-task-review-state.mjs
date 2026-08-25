import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 2_000;

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

/** One repository identity for state, baselines, receipts, and review tools. */
export function canonicalRepositoryRoot(workspaceRoot, options = {}) {
  if (typeof workspaceRoot !== "string" || !workspaceRoot.startsWith("/")) return null;
  const candidate = realpathSync(resolve(workspaceRoot));
  return realpathSync(String(git(candidate, ["rev-parse", "--show-toplevel"], options)).trim());
}

function nulPaths(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""));
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function indexEntries(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""));
  const entries = new Map();
  for (const record of buffer.toString("utf8").split("\0").filter(Boolean)) {
    const separator = record.indexOf("\t");
    if (separator < 0) continue;
    const path = record.slice(separator + 1);
    const metadata = record.slice(0, separator);
    entries.set(path, metadata);
  }
  return entries;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
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
  const root = canonicalRepositoryRoot(workspaceRoot, options);
  if (!root) throw new Error("repository snapshot requires one canonical Git repository");
  const head = String(git(root, ["rev-parse", "HEAD"], options)).trim();
  const index = git(root, ["ls-files", "--stage", "-z", "--"], options);
  const status = git(root, ["status", "--porcelain=v2", "--untracked-files=all", "-z", "--"], options);
  const tracked = nulPaths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"], options));
  const untracked = nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], options));
  const dirtyPaths = [...new Set([...tracked, ...untracked])].sort();
  const staged = indexEntries(index);
  const fingerprints = Object.fromEntries(dirtyPaths.map((path) => [
    path,
    `${repositoryPathFingerprint(root, path)}|index:${sha256(Buffer.from(staged.get(path) ?? "untracked", "utf8"))}`,
  ]));
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

export function validRepositorySnapshot(value) {
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

export function repositorySnapshotHash(snapshot) {
  if (!validRepositorySnapshot(snapshot)) return null;
  return sha256(Buffer.from(JSON.stringify(canonicalValue({
    schema: snapshot.schema,
    repository_root: resolve(snapshot.repository_root),
    head: snapshot.head,
    dirty_paths: [...snapshot.dirty_paths].sort(),
    fingerprints: snapshot.fingerprints,
    index_fingerprint: snapshot.index_fingerprint ?? null,
    status_fingerprint: snapshot.status_fingerprint ?? null,
  })), "utf8"));
}

function timestamp(options = {}) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nativeContextRoot(stateRoot) {
  return join(stateRoot, "manual-native-task-review");
}

function nativeConversationPath(stateRoot, conversationHash) {
  return join(nativeContextRoot(stateRoot), "conversations", `${conversationHash}.json`);
}

function nativeLockPath(stateRoot, conversationHash) {
  return join(nativeContextRoot(stateRoot), "locks", `${conversationHash}.lock`);
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function validConversation(value) {
  return value?.schema === 6
    && value?.kind === "cursor-native-task-review-context"
    && typeof value.conversation_hash === "string"
    && Number.isInteger(value.revision)
    && value.revision > 0;
}

export function readNativeTaskReviewConversation(stateRoot, conversationHash) {
  const value = readJson(nativeConversationPath(stateRoot, conversationHash));
  return validConversation(value) ? value : null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processIsAlive(pid, options = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (typeof options.pidIsAlive === "function") return options.pidIsAlive(pid);
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    return null;
  }
}

function lockOwner(path) {
  const owner = readJson(join(path, "owner.json"));
  return owner
    && typeof owner.owner_token === "string"
    && owner.owner_token.length >= 16
    && Number.isInteger(owner.pid)
    && typeof owner.acquired_at === "string"
    && Number.isFinite(Date.parse(owner.acquired_at))
    ? owner
    : null;
}

function lockAge(owner, options = {}) {
  const now = options.now ? Date.parse(timestamp(options)) : Date.now();
  return owner ? now - Date.parse(owner.acquired_at) : 0;
}

function quarantineLock(path, expectedToken) {
  const quarantine = `${path}.quarantine.${process.pid}.${randomUUID()}`;
  try {
    renameSync(path, quarantine);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (expectedToken && lockOwner(quarantine)?.owner_token !== expectedToken) {
    try { renameSync(quarantine, path); } catch { /* preserve the unexpected owner in quarantine */ }
    return false;
  }
  rmSync(quarantine, { recursive: true, force: true });
  return true;
}

/**
 * Shared owner-bound lock. A stale lock is stealable only when its recorded
 * process is provably dead; release is conditional on the original token.
 */
export function withNativeStateLock(path, callback, options = {}) {
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 0o700 });
  const ownerToken = options.ownerToken ?? randomUUID();
  const ownerPid = options.ownerPid ?? process.pid;
  const deadline = Date.now() + (options.lockWaitMs ?? LOCK_WAIT_MS);
  while (true) {
    try {
      mkdirSync(path, { mode: 0o700 });
      try {
        writeFileSync(join(path, "owner.json"), `${JSON.stringify({
          owner_token: ownerToken,
          pid: ownerPid,
          acquired_at: timestamp(options),
        })}\n`, { mode: 0o600 });
      } catch (error) {
        quarantineLock(path);
        throw error;
      }
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const owner = lockOwner(path);
      const stale = owner && lockAge(owner, options) > (options.lockStaleMs ?? LOCK_STALE_MS);
      if (stale && processIsAlive(owner.pid, options) === false) {
        if (quarantineLock(path, owner.owner_token)) continue;
      }
      if (Date.now() >= deadline) {
        const busy = new Error("native Workflow state is busy");
        busy.code = "native-state-busy";
        throw busy;
      }
      sleep(options.lockPollMs ?? 10);
    }
  }
  try {
    return callback({ owner_token: ownerToken, pid: ownerPid });
  } finally {
    const current = lockOwner(path);
    if (current?.owner_token === ownerToken) quarantineLock(path, ownerToken);
  }
}

export function withNativeTaskReviewLock(stateRoot, conversationHash, callback, options = {}) {
  const path = nativeLockPath(stateRoot, conversationHash);
  return withNativeStateLock(path, callback, options);
}

export function validateConsumedNativeReviewReceipt({ stateRoot, receipt, options = {} }) {
  if (!receipt || receipt.schema !== 6 || typeof receipt.conversation_hash !== "string") return { status: "invalid" };
  return withNativeTaskReviewLock(stateRoot, receipt.conversation_hash, () => {
    const current = readNativeTaskReviewConversation(stateRoot, receipt.conversation_hash);
    if (!current) return { status: "drift", reason: "context-unavailable" };
    if (current.revision !== receipt.context_revision) return { status: "drift", reason: "context-revision-drift" };
    if (current.active?.root_hash !== receipt.root_hash) return { status: "drift", reason: "root-drift" };
    if (current.mutation_epoch?.id !== receipt.mutation_epoch?.id) return { status: "drift", reason: "mutation-epoch-drift" };
    if (current.inflight?.token_hash !== receipt.token_hash
      || current.inflight?.tool_hash !== receipt.tool_hash
      || current.inflight?.generation_hash !== receipt.generation_hash) {
      return { status: "drift", reason: "review-inflight-drift" };
    }
    return { status: "valid" };
  }, options);
}
