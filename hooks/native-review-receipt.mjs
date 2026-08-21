import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
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

function atomicJson(path, value) {
  ensureDirectory(dirname(path));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_RECEIPT_BYTES) throw new Error("native Review receipt exceeds size limit");
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

export function nativeReviewRequestHash(input = {}) {
  const semantic = {
    artifact_kind: input.artifact_kind ?? "delivery-evidence",
    effective_profile: input.effective_profile ?? "manual",
    strategy_revision: input.strategy_revision ?? 0,
    check_evidence: input.check_evidence ?? [],
    review_input: input.review_input ?? null,
    summary: input.summary ?? null,
  };
  return sha256(JSON.stringify(canonicalValue(semantic)));
}

export function nativeReviewReceiptDirectory(stateRoot, requestHash, bucket = "pending") {
  return join(stateRoot, "manual-native-task-review", "receipts", bucket, requestHash);
}

function receiptFiles(stateRoot, requestHash, bucket) {
  const directory = nativeReviewReceiptDirectory(stateRoot, requestHash, bucket);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name) => join(directory, name));
}

function moveReceipt(path, stateRoot, requestHash, bucket, value) {
  const target = join(nativeReviewReceiptDirectory(stateRoot, requestHash, bucket), basename(path));
  ensureDirectory(dirname(target));
  renameSync(path, target);
  atomicJson(target, value);
  return target;
}

function validReceipt(receipt, stateRoot, requestHash) {
  return receipt?.schema === 1
    && receipt?.kind === "cursor-native-review-receipt"
    && receipt.request_hash === requestHash
    && receipt.workspace_hash === sha256(stateRoot).slice(0, 32)
    && /^[a-f0-9]{32}$/.test(String(receipt.conversation_hash ?? ""))
    && /^[a-f0-9]{32}$/.test(String(receipt.generation_hash ?? ""))
    && /^[a-f0-9]{32}$/.test(String(receipt.tool_hash ?? ""))
    && /^[a-f0-9]{64}$/.test(String(receipt.root_hash ?? ""))
    && typeof receipt.root_text === "string"
    && receipt.root_hash === sha256(receipt.root_text)
    && Array.isArray(receipt.artifacts)
    && ["task-chain", "full-rebuild"].includes(receipt.predecessor_mode)
    && (receipt.artifacts.length > 0) === (receipt.predecessor_mode === "task-chain")
    && Number.isFinite(Date.parse(receipt.expires_at));
}

export function consumeNativeReviewReceipt({ stateRoot, input, options = {} }) {
  const requestHash = nativeReviewRequestHash(input);
  const currentMs = nowMs(options);
  const pending = receiptFiles(stateRoot, requestHash, "pending");
  const valid = [];
  let expired = false;
  for (const path of pending) {
    const receipt = readJson(path);
    if (!receipt && !existsSync(path)) {
      const consumed = readJson(join(nativeReviewReceiptDirectory(stateRoot, requestHash, "consumed"), basename(path)));
      if (validReceipt(consumed, stateRoot, requestHash) && Date.parse(consumed.expires_at) > currentMs) return { status: "replayed" };
    }
    if (!validReceipt(receipt, stateRoot, requestHash)) {
      return { status: "mismatch" };
    }
    if (Date.parse(receipt.expires_at) <= currentMs) {
      expired = true;
      try { moveReceipt(path, stateRoot, requestHash, "expired", { ...receipt, expired_at: timestamp(options) }); }
      catch (error) { if (error?.code !== "ENOENT") throw error; }
      continue;
    }
    valid.push({ path, receipt });
  }
  if (valid.length > 1) return { status: "mismatch" };
  if (valid.length === 1) {
    const [{ path, receipt }] = valid;
    try { moveReceipt(path, stateRoot, requestHash, "consumed", { ...receipt, consumed_at: timestamp(options) }); }
    catch (error) {
      if (error?.code === "ENOENT") return { status: "replayed" };
      throw error;
    }
    return { status: "resolved", receipt };
  }
  const consumed = receiptFiles(stateRoot, requestHash, "consumed").map(readJson).filter(Boolean);
  if (consumed.some((receipt) => Date.parse(receipt.expires_at) > currentMs)) return { status: "replayed" };
  const expiredReceipts = receiptFiles(stateRoot, requestHash, "expired").map(readJson).filter(Boolean);
  return { status: expired || expiredReceipts.length > 0 ? "expired" : "unavailable" };
}
