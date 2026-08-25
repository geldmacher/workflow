import { join, relative, resolve } from "node:path";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import {
  canonicalProtectedWorkspaceRoot,
  protectedRecordHash,
  readProtectedRecord,
  stableProtectedRecordJson,
  writeProtectedRecord,
} from "../core/protected-record-store.mjs";
import { captureRepositorySnapshot, repositorySnapshotHash } from "./repository-snapshot.mjs";
import { rootContentHash, sharedArtifactStateRoot } from "../core/state-paths.mjs";

export const MANUAL_BOUNDARY_RECEIPT_TTL_MS = 15 * 60 * 1000;

export const MANUAL_BOUNDARY_RECOVERY_REASONS = Object.freeze({
  "baseline-unavailable-after-mutation": "baseline-unavailable-after-mutation",
  "authority-violation": "out-of-authority-changes",
  "repository-observation-conflict": "workspace-ambiguous-after-mutation",
  "artifact-text-conflict": "root-binding-lost-after-mutation",
});

const sha256 = protectedRecordHash;
const stableJson = stableProtectedRecordJson;
const canonicalWorkspaceRoot = canonicalProtectedWorkspaceRoot;

function normalizedObservedPaths(paths, repositoryRoot) {
  const root = resolve(repositoryRoot);
  return [...new Set((paths ?? []).map((value) => {
    const source = String(value ?? "").trim();
    if (!source || source.includes("\\") || source.includes("\0")) throw new Error("boundary receipt observed paths must be normalized repository-relative paths");
    const candidate = resolve(root, source);
    const rel = relative(root, candidate).replaceAll("\\", "/");
    if (!rel || rel === ".." || rel.startsWith("../") || rel.startsWith("/")) {
      throw new Error(`boundary receipt path escapes the repository: ${source}`);
    }
    return rel;
  }))].sort();
}

function receiptBase(workspaceRoot, rootHash, options = {}) {
  return join(sharedArtifactStateRoot(workspaceRoot, options), "manual-boundary-receipts", rootHash);
}

function exactRoot(rootPlanText, pluginRoot) {
  const inspected = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact?.fields?.schema !== 6) {
    throw new Error(`boundary receipt requires an exact valid Schema-6 Root: ${inspected.errors.join("; ") || "not a work-plan"}`);
  }
  return inspected.artifact.fields;
}

function receiptIdentity(receipt) {
  return `br-${sha256(stableJson({ ...receipt, receipt_id: undefined }))}`;
}

export function createManualBoundaryReceipt({
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  recoveryErrorCode,
  observedPaths = null,
  captureSnapshot = captureRepositorySnapshot,
  now = () => new Date(),
  options = {},
}) {
  const reason = MANUAL_BOUNDARY_RECOVERY_REASONS[recoveryErrorCode];
  if (!reason) throw new Error(`boundary receipt rejects recoverable or unknown error ${recoveryErrorCode}`);
  exactRoot(rootPlanText, pluginRoot);
  const snapshot = captureSnapshot(workspaceRoot);
  const repositoryRoot = canonicalWorkspaceRoot(snapshot.repository_root);
  if (repositoryRoot !== canonicalWorkspaceRoot(workspaceRoot)) throw new Error("boundary receipt workspace does not match the observed repository root");
  const paths = normalizedObservedPaths(observedPaths ?? snapshot.dirty_paths, repositoryRoot);
  const currentPaths = normalizedObservedPaths(snapshot.dirty_paths, repositoryRoot);
  if (stableJson(paths) !== stableJson(currentPaths)) {
    throw new Error("boundary receipt observed paths must equal the complete current dirty-path set");
  }
  if (reason === "out-of-authority-changes" && paths.length === 0) {
    throw new Error("out-of-authority boundary receipt requires at least one observed path");
  }
  const observedAt = now();
  const receipt = {
    receipt_id: null,
    observed_at: observedAt.toISOString(),
    recovery_error_code: recoveryErrorCode,
    reason_codes: [reason],
    root_content_hash: rootContentHash(rootPlanText),
    repository_snapshot_hash: repositorySnapshotHash(snapshot),
    observed_paths: paths,
  };
  receipt.receipt_id = receiptIdentity(receipt);
  const record = {
    schema: 1,
    kind: "manual-boundary-receipt-record",
    recorded_at: observedAt.toISOString(),
    expires_at: new Date(observedAt.getTime() + MANUAL_BOUNDARY_RECEIPT_TTL_MS).toISOString(),
    repository_root: repositoryRoot,
    receipt_hash: sha256(stableJson(receipt)),
    receipt,
  };
  const stateRoot = sharedArtifactStateRoot(repositoryRoot, options);
  const path = join(receiptBase(repositoryRoot, receipt.root_content_hash, options), `${receipt.receipt_id}.json`);
  writeProtectedRecord(path, record, stateRoot);
  return Object.freeze({ ...receipt, reason_codes: Object.freeze([...receipt.reason_codes]), observed_paths: Object.freeze([...receipt.observed_paths]) });
}

export function verifyManualBoundaryReceipt({
  receipt,
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  captureSnapshot = captureRepositorySnapshot,
  now = () => new Date(),
  options = {},
}) {
  try {
    exactRoot(rootPlanText, pluginRoot);
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("boundary receipt is missing");
    if (!/^br-[a-f0-9]{64}$/.test(String(receipt.receipt_id ?? "")) || receiptIdentity(receipt) !== receipt.receipt_id) {
      throw new Error("boundary receipt identity is invalid");
    }
    const expectedReason = MANUAL_BOUNDARY_RECOVERY_REASONS[receipt.recovery_error_code];
    if (!expectedReason || receipt.reason_codes?.length !== 1 || receipt.reason_codes[0] !== expectedReason) {
      throw new Error("boundary receipt recovery proof is invalid");
    }
    if (receipt.root_content_hash !== rootContentHash(rootPlanText)) throw new Error("boundary receipt Root binding is stale");
    const snapshot = captureSnapshot(workspaceRoot);
    const repositoryRoot = canonicalWorkspaceRoot(snapshot.repository_root);
    if (repositoryRoot !== canonicalWorkspaceRoot(workspaceRoot)) throw new Error("boundary receipt repository binding is invalid");
    if (receipt.repository_snapshot_hash !== repositorySnapshotHash(snapshot)) throw new Error("boundary receipt repository snapshot is stale");
    const paths = normalizedObservedPaths(receipt.observed_paths, repositoryRoot);
    if (stableJson(paths) !== stableJson(receipt.observed_paths)) throw new Error("boundary receipt observed paths are not canonical");
    if (stableJson(paths) !== stableJson(normalizedObservedPaths(snapshot.dirty_paths, repositoryRoot))) {
      throw new Error("boundary receipt observed paths no longer equal the complete current dirty-path set");
    }
    if (expectedReason === "out-of-authority-changes" && paths.length === 0) throw new Error("boundary receipt omits the out-of-authority path");
    const stateRoot = sharedArtifactStateRoot(repositoryRoot, options);
    const path = join(receiptBase(repositoryRoot, receipt.root_content_hash, options), `${receipt.receipt_id}.json`);
    const record = readProtectedRecord(path, stateRoot);
    if (!record) throw new Error("boundary receipt has no safe protected host record");
    if (record?.schema !== 1 || record?.kind !== "manual-boundary-receipt-record") throw new Error("boundary receipt host record is incompatible");
    if (record.repository_root !== repositoryRoot || record.receipt_hash !== sha256(stableJson(receipt)) || stableJson(record.receipt) !== stableJson(receipt)) {
      throw new Error("boundary receipt host record does not match the artifact");
    }
    const observed = Date.parse(receipt.observed_at);
    const expires = Date.parse(record.expires_at);
    const currentTime = now().getTime();
    if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed > currentTime || expires <= currentTime) {
      throw new Error("boundary receipt is expired or not fresh");
    }
    return { ok: true, receipt_id: receipt.receipt_id, repository_snapshot_hash: receipt.repository_snapshot_hash };
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) };
  }
}

export function boundaryReceiptVerifier({ pluginRoot, workspaceRoot, captureSnapshot, now, options = {} }) {
  return ({ receipt, rootPlanText }) => verifyManualBoundaryReceipt({
    receipt,
    rootPlanText,
    pluginRoot,
    workspaceRoot,
    captureSnapshot,
    now,
    options,
  });
}
