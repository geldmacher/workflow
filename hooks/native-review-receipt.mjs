import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { resolve } from "node:path";
import { repositorySnapshotHash } from "../src/harness/native-task-review-state.mjs";

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const MAX_INVOCATION_RESULT_BYTES = 4 * 1024 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const sha256 = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");

function timestamp(options = {}) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nowMs(options = {}) {
  return Date.parse(timestamp(options));
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort */ }
}

export function atomicNativeReviewReceipt(path, value) {
  ensureDirectory(dirname(path));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_RECEIPT_BYTES) throw new Error("native Review receipt exceeds size limit");
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, source, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function atomicInvocationResult(path, value) {
  ensureDirectory(dirname(path));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_INVOCATION_RESULT_BYTES) throw new Error("native Review invocation result exceeds size limit");
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, source, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

export function nativeReviewReceiptBindingHash(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null;
  const {
    binding_hash: ignoredBindingHash,
    consumed_at: ignoredConsumedAt,
    expired_at: ignoredExpiredAt,
    revoked_at: ignoredRevokedAt,
    ...binding
  } = receipt;
  return sha256(JSON.stringify(canonicalValue(binding)));
}

export function nativeReviewRequestHash(input = {}) {
  const semantic = {
    artifact_kind: input.artifact_kind ?? "delivery-evidence",
    effective_profile: input.effective_profile ?? "manual",
    check_evidence: input.check_evidence ?? [],
    review_input: input.review_input ?? null,
    seal_artifacts: input.seal_artifacts ?? null,
    summary: input.summary ?? null,
  };
  return sha256(JSON.stringify(canonicalValue(semantic)));
}

export function nativeReviewResultHash(value) {
  return sha256(JSON.stringify(canonicalValue(value)));
}

export function nativeReviewReceiptDirectory(stateRoot, bucket = "pending") {
  return join(stateRoot, "manual-native-task-review", "receipts", bucket);
}

export function nativeReviewReceiptPath(stateRoot, token, bucket = "pending") {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  return join(nativeReviewReceiptDirectory(stateRoot, bucket), `${sha256(token)}.json`);
}

export function nativeReviewInvocationResultPath(stateRoot, token) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  return join(stateRoot, "manual-native-task-review", "invocations", "completed", `${sha256(token)}.json`);
}

function validReceipt(receipt, stateRoot, tokenHash, requestHash) {
  return receipt?.schema === 6
    && receipt?.kind === "cursor-native-review-receipt"
    && /^[a-f0-9]{64}$/.test(String(receipt.binding_hash ?? ""))
    && receipt.binding_hash === nativeReviewReceiptBindingHash(receipt)
    && receipt.token_hash === tokenHash
    && receipt.request_hash === requestHash
    && receipt.workspace_hash === sha256(stateRoot).slice(0, 32)
    && /^[a-f0-9]{32}$/.test(String(receipt.conversation_hash ?? ""))
    && /^[a-f0-9]{32}$/.test(String(receipt.generation_hash ?? ""))
    && /^[a-f0-9]{32}$/.test(String(receipt.tool_hash ?? ""))
    && Number.isInteger(receipt.context_revision)
    && receipt.context_revision > 0
    && /^[a-f0-9]{64}$/.test(String(receipt.root_hash ?? ""))
    && typeof receipt.root_text === "string"
    && receipt.root_hash === sha256(receipt.root_text)
    && validRootBinding(receipt.root_binding, receipt.root_source)
    && Array.isArray(receipt.artifacts)
    && ["task-chain", "full-rebuild", "provisional-seal"].includes(receipt.predecessor_mode)
    && (receipt.artifacts.length > 0) === (receipt.predecessor_mode !== "full-rebuild")
    && validBaselineBinding(receipt)
    && validReviewEnforcement(receipt.review_enforcement)
    && Number.isFinite(Date.parse(receipt.expires_at));
}

function validRootBinding(value, rootSource) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !Array.isArray(value.reason_codes)
    || value.reason_codes.some((reason) => typeof reason !== "string")) return false;
  if (value.status === "enforced") {
    return ["post-tool-use", "task-transcript-stop"].includes(value.source)
      && value.priority === (value.source === "post-tool-use" ? 3 : 2)
      && value.reason_codes.length === 0
      && rootSource === "cursor-create-plan";
  }
  return value.status === "provisional"
    && value.source === "recent-plan-file-stop"
    && value.priority === 1
    && value.reason_codes.includes("native-plan-transcript-unavailable")
    && rootSource === "cursor-plan-file";
}

function validInvocationResult(record, receipt, input) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const payloadHash = nativeReviewResultHash(record.payload);
  return record.schema === 2
    && record.kind === "cursor-native-review-invocation-result"
    && record.invocation_id === receipt.receipt_id
    && record.token_hash === receipt.token_hash
    && record.request_hash === nativeReviewRequestHash(input)
    && record.request_hash === receipt.request_hash
    && record.root_hash === receipt.root_hash
    && record.workspace_root === receipt.workspace_root
    && record.repository_hash === record.payload?.repository_state_hash
    && /^[a-f0-9]{64}$/.test(String(record.payload_hash ?? ""))
    && record.payload_hash === payloadHash
    && record.payload?.artifact_kind === "work-review"
    && record.payload?.root_plan_id === receipt.root_plan_id
    && Number.isFinite(Date.parse(record.completed_at));
}

export function commitNativeReviewInvocationResult({ stateRoot, token, input = {}, receipt, payload, options = {} }) {
  const path = nativeReviewInvocationResultPath(stateRoot, token);
  const consumedPath = nativeReviewReceiptPath(stateRoot, token, "consumed");
  if (!path || !consumedPath || !existsSync(consumedPath)) return { status: "unavailable" };
  const consumed = readJson(consumedPath);
  const tokenHash = sha256(token);
  const requestHash = nativeReviewRequestHash(input);
  if (!validReceipt(consumed, stateRoot, tokenHash, requestHash)
    || consumed.binding_hash !== receipt?.binding_hash) return { status: "mismatch" };
  const record = {
    schema: 2,
    kind: "cursor-native-review-invocation-result",
    invocation_id: consumed.receipt_id,
    token_hash: consumed.token_hash,
    request_hash: consumed.request_hash,
    root_hash: consumed.root_hash,
    workspace_root: consumed.workspace_root,
    repository_hash: payload?.repository_state_hash ?? null,
    payload_hash: nativeReviewResultHash(payload),
    payload,
    completed_at: timestamp(options),
  };
  if (!validInvocationResult(record, consumed, input)) return { status: "invalid" };
  const prior = readJson(path);
  if (existsSync(path) && !prior) return { status: "conflict" };
  if (prior) {
    return validInvocationResult(prior, consumed, input) && prior.payload_hash === record.payload_hash
      ? { status: "committed", duplicate: true, payload: prior.payload, payload_hash: prior.payload_hash }
      : { status: "conflict" };
  }
  atomicInvocationResult(path, record);
  return { status: "committed", payload: record.payload, payload_hash: record.payload_hash };
}

export function replayNativeReviewInvocationResult({ stateRoot, token, input = {}, receipt }) {
  const path = nativeReviewInvocationResultPath(stateRoot, token);
  if (!path) return { status: "unavailable" };
  const record = readJson(path);
  return validInvocationResult(record, receipt, input)
    ? { status: "resolved", payload: record.payload, payload_hash: record.payload_hash }
    : { status: record ? "mismatch" : "unavailable" };
}

function validReviewEnforcement(value) {
  return value
    && ["enforced", "unavailable"].includes(value.status)
    && Array.isArray(value.reason_codes)
    && value.reason_codes.every((reason) => typeof reason === "string")
    && (value.status === "enforced"
      ? value.reason_codes.length === 0
      : value.reason_codes.includes("review-observer-unavailable"));
}

function validBaselineBinding(receipt) {
  const attribution = receipt?.repository_attribution;
  const epoch = receipt?.mutation_epoch;
  if (!attribution || typeof attribution !== "object" || !epoch || typeof epoch !== "object") return false;
  if (!/^[a-f0-9]{64}$/.test(String(epoch.id ?? "")) || !["open", "closed"].includes(epoch.status)) return false;
  const computed = repositorySnapshotHash(receipt.baseline);
  if (!computed) {
    return receipt.baseline === null
      && receipt.baseline_hash === null
      && epoch.baseline_hash === null
      && attribution.baseline_available === false
      && attribution.baseline_hash === null;
  }
  if (typeof receipt.workspace_root !== "string" || typeof receipt.baseline?.repository_root !== "string") return false;
  return receipt.baseline_hash === computed
    && epoch.baseline_hash === computed
    && attribution.baseline_available === true
    && attribution.baseline_hash === computed
    && resolve(receipt.workspace_root) === resolve(receipt.baseline.repository_root);
}

function moveClaimedReceipt(source, target, receipt, field, options) {
  ensureDirectory(dirname(target));
  try {
    renameSync(source, target);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  atomicNativeReviewReceipt(target, { ...receipt, [field]: timestamp(options) });
  return true;
}

/** Consume exactly the opaque token injected by Cursor preToolUse. */
export function consumeNativeReviewReceipt({ stateRoot, token, input = {}, options = {} }) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return { status: "unavailable" };
  const tokenHash = sha256(token);
  const requestHash = nativeReviewRequestHash(input);
  const pendingPath = nativeReviewReceiptPath(stateRoot, token, "pending");
  const consumedPath = nativeReviewReceiptPath(stateRoot, token, "consumed");
  const expiredPath = nativeReviewReceiptPath(stateRoot, token, "expired");
  const currentMs = nowMs(options);

  if (!existsSync(pendingPath)) {
    const consumed = readJson(consumedPath);
    if (consumed) {
      if (!validReceipt(consumed, stateRoot, tokenHash, consumed.request_hash)) return { status: "mismatch" };
      return consumed.request_hash === requestHash ? { status: "replayed", receipt: consumed } : { status: "mismatch" };
    }
    const expired = readJson(expiredPath);
    if (expired) {
      if (!validReceipt(expired, stateRoot, tokenHash, expired.request_hash)) return { status: "mismatch" };
      return expired.request_hash === requestHash ? { status: "expired" } : { status: "mismatch" };
    }
    return { status: "unavailable" };
  }

  const receipt = readJson(pendingPath);
  if (!validReceipt(receipt, stateRoot, tokenHash, requestHash)) return { status: "mismatch" };
  if (Date.parse(receipt.expires_at) <= currentMs) {
    moveClaimedReceipt(pendingPath, expiredPath, receipt, "expired_at", options);
    return { status: "expired" };
  }
  if (!moveClaimedReceipt(pendingPath, consumedPath, receipt, "consumed_at", options)) {
    return existsSync(consumedPath) ? { status: "replayed" } : { status: "unavailable" };
  }
  return { status: "resolved", receipt };
}
