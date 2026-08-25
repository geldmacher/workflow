import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  protectedRecordHash,
  readProtectedRecord,
  stableProtectedRecordJson,
  writeProtectedRecord,
} from "../core/protected-record-store.mjs";

export const HOST_HARNESS_TRUST_SCHEMA = 1;
export const HOST_HARNESS_RECEIPT_TTL_MS = 30 * 60 * 1000;

const receiptPattern = /^[A-Za-z0-9_-]{43}$/;

function nowIso(now) {
  const value = now();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function exactObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function recordRoot(stateRoot) {
  return join(stateRoot, "harness-trust");
}

function recordPath(stateRoot, receiptHash) {
  return join(recordRoot(stateRoot), "receipts", `${receiptHash}.json`);
}

function lockPath(stateRoot, receiptHash) {
  return join(recordRoot(stateRoot), "locks", `${receiptHash}.lock`);
}

function reusablePath(stateRoot, key) {
  return join(recordRoot(stateRoot), "reusable", `${key}.json`);
}

function stagedPath(stateRoot, transitionId) {
  if (!/^tr-[a-f0-9]{32}$/.test(String(transitionId ?? ""))) throw new Error("host Harness stage requires transition_id");
  return join(recordRoot(stateRoot), "staged", `${transitionId}.json`);
}

function withReceiptLock(stateRoot, receiptHash, callback) {
  const root = recordRoot(stateRoot);
  const lock = lockPath(stateRoot, receiptHash);
  mkdirSync(join(root, "locks"), { recursive: true, mode: 0o700 });
  try {
    mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      const busy = new Error("host Harness receipt is busy");
      busy.code = "host-harness-receipt-busy";
      throw busy;
    }
    throw error;
  }
  try { return callback(); }
  finally { rmSync(lock, { recursive: true, force: true }); }
}

function same(left, right) {
  return stableProtectedRecordJson(left) === stableProtectedRecordJson(right);
}

/**
 * Host-owned opaque receipt registry. The Workflow Core receives only opaque
 * tokens and verified claims; it never parses keys, signatures, or receipt
 * contents. Project Harness code cannot write this registry through the
 * Harness contract.
 */
export function createHostHarnessTrustAdapter({
  stateRoot,
  harnessId,
  now = () => new Date(),
  ttlMs = HOST_HARNESS_RECEIPT_TTL_MS,
  randomToken = () => randomBytes(32).toString("base64url"),
} = {}) {
  if (typeof stateRoot !== "string" || !stateRoot.trim()) throw new Error("host Harness trust requires stateRoot");
  if (typeof harnessId !== "string" || !harnessId.trim()) throw new Error("host Harness trust requires harnessId");
  if (!Number.isInteger(ttlMs) || ttlMs < 1) throw new Error("host Harness trust ttlMs must be positive");

  const issue = ({ kind, payload, bindings, reusable = false }) => {
    if (typeof kind !== "string" || !kind.trim()) throw new Error("host Harness receipt requires kind");
    exactObject(payload, "host Harness receipt payload");
    exactObject(bindings, "host Harness receipt bindings");
    if (bindings.harness_id !== harnessId) throw new Error("host Harness receipt harness identity mismatch");
    const payloadHash = protectedRecordHash(stableProtectedRecordJson(payload));
    const reusableKey = protectedRecordHash(stableProtectedRecordJson({ kind, payload_hash: payloadHash, bindings }));
    if (reusable === true) {
      const root = recordRoot(stateRoot);
      const indexed = existsSync(reusablePath(stateRoot, reusableKey))
        ? readProtectedRecord(reusablePath(stateRoot, reusableKey), root)
        : null;
      if (indexed?.schema === HOST_HARNESS_TRUST_SCHEMA && receiptPattern.test(String(indexed.receipt ?? ""))) {
        try {
          verify({ receipt: indexed.receipt, kind, payload, bindings });
          return Object.freeze({ receipt: indexed.receipt, receipt_hash: protectedRecordHash(indexed.receipt) });
        } catch { /* expired or invalid reusable record is replaced below */ }
      }
    }
    const receipt = randomToken();
    if (!receiptPattern.test(receipt)) throw new Error("host Harness receipt generator returned an invalid token");
    const receiptHash = protectedRecordHash(receipt);
    const issuedAt = nowIso(now);
    const record = {
      schema: HOST_HARNESS_TRUST_SCHEMA,
      kind: "host-harness-protection-record",
      receipt_kind: kind,
      receipt_hash: receiptHash,
      harness_id: harnessId,
      payload_hash: payloadHash,
      bindings: structuredClone(bindings),
      reusable: reusable === true,
      issued_at: issuedAt,
      expires_at: new Date(Date.parse(issuedAt) + ttlMs).toISOString(),
      consumed_by: null,
      consumed_at: null,
      revoked_at: null,
    };
    const root = recordRoot(stateRoot);
    const path = recordPath(stateRoot, receiptHash);
    if (existsSync(path)) throw new Error("host Harness receipt collision");
    writeProtectedRecord(path, record, root);
    if (reusable === true) writeProtectedRecord(reusablePath(stateRoot, reusableKey), {
      schema: HOST_HARNESS_TRUST_SCHEMA,
      kind: "host-harness-reusable-receipt",
      receipt,
      receipt_hash: receiptHash,
    }, root);
    return Object.freeze({ receipt, receipt_hash: receiptHash });
  };

  const verify = ({ receipt, kind, payload, bindings, consumeKey = null }) => {
    if (!receiptPattern.test(String(receipt ?? ""))) throw new Error("host Harness receipt is invalid");
    if (consumeKey !== null && (typeof consumeKey !== "string" || !consumeKey.trim())) throw new Error("host Harness consume key is invalid");
    exactObject(payload, "host Harness receipt payload");
    exactObject(bindings, "host Harness receipt bindings");
    const receiptHash = protectedRecordHash(receipt);
    const inspect = () => {
      const root = recordRoot(stateRoot);
      const path = recordPath(stateRoot, receiptHash);
      const record = readProtectedRecord(path, root);
      if (!record || record.schema !== HOST_HARNESS_TRUST_SCHEMA || record.kind !== "host-harness-protection-record") {
        throw new Error("host Harness receipt has no protected host record");
      }
      if (record.receipt_hash !== receiptHash || record.receipt_kind !== kind) throw new Error("host Harness receipt kind mismatch");
      if (record.harness_id !== harnessId || bindings.harness_id !== harnessId) throw new Error("host Harness receipt harness identity mismatch");
      if (record.payload_hash !== protectedRecordHash(stableProtectedRecordJson(payload))) throw new Error("host Harness receipt payload mismatch");
      if (!same(record.bindings, bindings)) throw new Error("host Harness receipt binding mismatch");
      if (record.revoked_at) throw new Error("host Harness receipt was revoked");
      const current = Date.parse(nowIso(now));
      if (!Number.isFinite(Date.parse(record.issued_at)) || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= current) {
        throw new Error("host Harness receipt expired");
      }
      if (record.consumed_by && consumeKey && record.consumed_by !== consumeKey) throw new Error("host Harness receipt replayed for a different transition");
      if (consumeKey && !record.reusable && !record.consumed_by) {
        const updated = { ...record, consumed_by: consumeKey, consumed_at: nowIso(now) };
        writeProtectedRecord(path, updated, root);
        return updated;
      }
      return record;
    };
    const record = consumeKey ? withReceiptLock(stateRoot, receiptHash, inspect) : inspect();
    return Object.freeze({
      ok: true,
      receipt_hash: receiptHash,
      harness_id: record.harness_id,
      reusable: record.reusable,
      consumed_by: record.consumed_by,
      issued_at: record.issued_at,
      expires_at: record.expires_at,
    });
  };

  const revoke = ({ receipt, kind, payload, bindings }) => {
    const receiptHash = protectedRecordHash(receipt);
    return withReceiptLock(stateRoot, receiptHash, () => {
      verify({ receipt, kind, payload, bindings });
      const root = recordRoot(stateRoot);
      const path = recordPath(stateRoot, receiptHash);
      const record = readProtectedRecord(path, root);
      if (record.consumed_by) throw new Error("host Harness consumed receipt cannot be revoked");
      if (!record.revoked_at) writeProtectedRecord(path, { ...record, revoked_at: nowIso(now) }, root);
      return Object.freeze({ ok: true, receipt_hash: receiptHash });
    });
  };

  const stage = ({ transitionId, kind, payload, bindings }) => {
    const root = recordRoot(stateRoot);
    const path = stagedPath(stateRoot, transitionId);
    const candidateHash = protectedRecordHash(stableProtectedRecordJson({ kind, payload, bindings }));
    if (existsSync(path)) {
      const current = readProtectedRecord(path, root, { maxBytes: 1024 * 1024 });
      if (current?.candidate_hash !== candidateHash) throw new Error("host Harness transition stage conflict");
      return Object.freeze({
        transition_id: transitionId,
        receipt_hash: current.receipt_hash,
        status: current.status,
        payload: structuredClone(current.payload),
      });
    }
    const protectedValue = issue({ kind, payload, bindings, reusable: false });
    const record = {
      schema: HOST_HARNESS_TRUST_SCHEMA,
      kind: "host-harness-staged-transition",
      transition_id: transitionId,
      candidate_hash: candidateHash,
      receipt: protectedValue.receipt,
      receipt_hash: protectedValue.receipt_hash,
      receipt_kind: kind,
      payload: structuredClone(payload),
      bindings: structuredClone(bindings),
      status: "staged",
      consume_key: null,
      staged_at: nowIso(now),
      committed_at: null,
    };
    writeProtectedRecord(path, record, root);
    return Object.freeze({ transition_id: transitionId, receipt_hash: record.receipt_hash, status: record.status, payload: structuredClone(record.payload) });
  };

  const recover = ({ transitionId }) => {
    const root = recordRoot(stateRoot);
    const path = stagedPath(stateRoot, transitionId);
    if (!existsSync(path)) return null;
    const record = readProtectedRecord(path, root, { maxBytes: 1024 * 1024 });
    if (!record || record.kind !== "host-harness-staged-transition" || record.transition_id !== transitionId) throw new Error("host Harness transition stage is invalid");
    return Object.freeze({
      transition_id: transitionId,
      receipt_hash: record.receipt_hash,
      status: record.status,
      payload: structuredClone(record.payload),
    });
  };

  const commit = ({ transitionId, consumeKey }) => {
    const root = recordRoot(stateRoot);
    const path = stagedPath(stateRoot, transitionId);
    const record = readProtectedRecord(path, root, { maxBytes: 1024 * 1024 });
    if (!record || record.kind !== "host-harness-staged-transition") throw new Error("host Harness transition has no staged result");
    if (record.status === "committed") {
      if (record.consume_key !== consumeKey) throw new Error("host Harness transition was committed for a different transition");
      return Object.freeze({ ok: true, receipt_hash: record.receipt_hash, consumed_by: consumeKey });
    }
    const protection = verify({
      receipt: record.receipt,
      kind: record.receipt_kind,
      payload: record.payload,
      bindings: record.bindings,
      consumeKey,
    });
    writeProtectedRecord(path, { ...record, status: "committed", consume_key: consumeKey, committed_at: nowIso(now) }, root);
    return protection;
  };

  return Object.freeze({ schema: HOST_HARNESS_TRUST_SCHEMA, harnessId, issue, verify, revoke, stage, recover, commit });
}
