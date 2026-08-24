import { resolve } from "node:path";
import {
  repositoryPathFingerprint,
  repositorySnapshotHash,
  validRepositorySnapshot,
} from "./native-task-review-state.mjs";

export {
  captureRepositorySnapshot,
  repositoryPathFingerprint,
  repositorySnapshotHash,
  validRepositorySnapshot,
} from "./native-task-review-state.mjs";

function uniqueReasonCodes(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}

function provisionalDelta(current, {
  baseline = null,
  boundary = "create-plan",
  reasonCodes = [],
} = {}) {
  const reasons = uniqueReasonCodes(reasonCodes);
  return {
    baseline_available: false,
    baseline_hash: repositorySnapshotHash(baseline),
    attribution_status: "provisional",
    attribution_boundary: boundary,
    attribution_reason_codes: reasons,
    changed_paths: [...current.dirty_paths].sort(),
    observed_dirty_paths: [...current.dirty_paths].sort(),
    pre_existing_paths: [],
    repository_snapshot: evidenceRepositorySnapshot(current, current.dirty_paths, {
      baselineAvailable: false,
      attributionStatus: "provisional",
      attributionReasonCodes: reasons,
      baselineHash: repositorySnapshotHash(baseline),
    }),
  };
}

export function deriveRepositoryDelta(baseline, current, options = {}) {
  if (!validRepositorySnapshot(current)) throw new Error("current repository snapshot is invalid");
  const boundary = options.boundary ?? "create-plan";
  const suppliedReasons = uniqueReasonCodes(options.reasonCodes);
  if (!baseline) {
    return provisionalDelta(current, {
      boundary,
      reasonCodes: ["baseline-unavailable", ...suppliedReasons],
    });
  }
  if (!validRepositorySnapshot(baseline)) {
    return provisionalDelta(current, {
      boundary,
      reasonCodes: ["baseline-invalid", ...suppliedReasons],
    });
  }
  if (resolve(baseline.repository_root) !== resolve(current.repository_root)) {
    return provisionalDelta(current, {
      baseline,
      boundary,
      reasonCodes: ["baseline-root-mismatch", ...suppliedReasons],
    });
  }
  if (baseline.head !== current.head) {
    return provisionalDelta(current, {
      baseline,
      boundary,
      reasonCodes: ["head-drift", ...suppliedReasons],
    });
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
  const preExistingPaths = current.dirty_paths.filter((path) => (
    Object.prototype.hasOwnProperty.call(baseline.fingerprints, path)
    && baseline.fingerprints[path] === current.fingerprints[path]
  )).sort();
  const reasonCodes = uniqueReasonCodes(suppliedReasons);
  const attributionStatus = reasonCodes.length > 0 ? "provisional" : "attributed";
  const baselineHash = repositorySnapshotHash(baseline);
  return {
    baseline_available: true,
    baseline_hash: baselineHash,
    attribution_status: attributionStatus,
    attribution_boundary: boundary,
    attribution_reason_codes: reasonCodes,
    changed_paths: changedPaths,
    observed_dirty_paths: [...current.dirty_paths].sort(),
    pre_existing_paths: preExistingPaths,
    repository_snapshot: evidenceRepositorySnapshot(current, changedPaths, {
      baselineAvailable: true,
      attributionStatus,
      attributionReasonCodes: reasonCodes,
      baselineHash,
    }),
  };
}

export function evidenceRepositorySnapshot(snapshot, relevantPaths, {
  baselineAvailable = true,
  attributionStatus = baselineAvailable ? "attributed" : "provisional",
  attributionReasonCodes = [],
  baselineHash = null,
} = {}) {
  if (!validRepositorySnapshot(snapshot)) throw new Error("repository snapshot is invalid");
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
    attribution_status: attributionStatus,
    attribution_reason_codes: uniqueReasonCodes(attributionReasonCodes),
    baseline_hash: baselineHash,
  };
}
