import { createHash } from "node:crypto";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { assertChangedPathAuthority } from "../core/manual-path-authority.mjs";
import {
  captureRepositorySnapshot,
  deriveRepositoryDelta,
  evidenceRepositorySnapshot,
  repositorySnapshotHash,
} from "../core/manual-repository-snapshot.mjs";
import { buildDeliveryEvidence } from "./delivery-closeout.mjs";
import { buildWorkReview } from "./work-review-builder.mjs";

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validReviewProvenance(provenance, text) {
  return provenance?.schema === 1
    && provenance?.kind === "host-work-review-builder"
    && /^[a-f0-9]{64}$/.test(String(provenance.review_input_hash ?? ""))
    && provenance.artifact_hash === createHash("sha256").update(text, "utf8").digest("hex")
    && Object.keys(provenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
}

function exactEntries(rootPlanText, artifacts, pluginRoot) {
  const root = inspectArtifactText(rootPlanText, pluginRoot);
  if (root.errors.length > 0 || root.artifact?.fields?.artifact !== "work-plan" || root.artifact.fields.schema !== 5) {
    throw new Error(`manual Review requires the exact native Schema-5 Root: ${root.errors.join("; ") || "not a work-plan"}`);
  }
  const byId = new Map([[root.artifact.fields.id, { label: root.artifact.fields.id, text: rootPlanText }]]);
  for (const entry of artifacts ?? []) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) continue;
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
      throw new Error(`manual Review artifact ${entry.label ?? "unknown"} is invalid: ${inspected.errors.join("; ")}`);
    }
    const id = inspected.artifact.fields.id;
    if (inspected.artifact.fields.artifact === "work-review") {
      const provenance = entry.builder_provenance ?? null;
      if (provenance && !validReviewProvenance(provenance, entry.text)) {
        throw codedError("review-artifact-rejected", `manual Review artifact ${id} has invalid host builder provenance`);
      }
      if (!provenance && entry.legacy_review_recorded !== true) {
        throw codedError("review-artifact-rejected", `manual Review rejects newly imported work-review ${id} without protected builder provenance`);
      }
    }
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`manual Review artifact ${id} has conflicting immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...(entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : {}),
      ...(entry.legacy_review_recorded === true ? { legacy_review_recorded: true } : {}),
    });
  }
  return { rootFields: root.artifact.fields, entries: [...byId.values()] };
}

function currentTips(entries, pluginRoot) {
  const inspected = inspectArtifactSet(entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (inspected.errors.length > 0) throw new Error(`manual Review chain is invalid: ${inspected.errors.join("; ")}`);
  const tips = effectiveCliSummary(inspected);
  return { inspected, tips };
}

function boundedLine(value, maximum = 1_900) {
  const source = String(value ?? "").trim();
  if (source.length <= maximum) return source;
  const suffix = " … [bounded]";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}

function appendBoundedSummary(summary, message) {
  return boundedLine(`${summary ?? ""} ${boundedLine(message)}`.trim());
}

function authorityLimitation(reviewInput, message) {
  const boundedMessage = boundedLine(message);
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment)
      ? "partially-achieved"
      : reviewInput.assessment,
    recommended_action: "clarify",
    snapshot_assessment: "incomplete",
    snapshot_summary: appendBoundedSummary(reviewInput.snapshot_summary, boundedMessage),
    missing_evidence: [...new Set([...(reviewInput.missing_evidence ?? []), boundedMessage])],
    correction: undefined,
  };
}

function attributionLimitation(reviewInput, message) {
  const boundedMessage = boundedLine(message);
  const decisionCanRemainEvidenceOnly = ["none", "accept-provisional"].includes(reviewInput.recommended_action)
    && (reviewInput.findings ?? []).length === 0
    && (reviewInput.missing_evidence ?? []).length === 0
    && reviewInput.snapshot_assessment !== "contradicted";
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment)
      ? "provisional"
      : reviewInput.assessment,
    recommended_action: decisionCanRemainEvidenceOnly
      ? "accept-provisional"
      : reviewInput.recommended_action,
    snapshot_assessment: decisionCanRemainEvidenceOnly
      ? "consistent"
      : reviewInput.snapshot_assessment,
    snapshot_summary: appendBoundedSummary(reviewInput.snapshot_summary, boundedMessage),
  };
}

function supportedOnBoundary(checkEvidence, message) {
  const boundedMessage = boundedLine(message);
  return (checkEvidence ?? []).map((entry) => ({
    ...entry,
    grade: entry.grade === "verified" ? "supported" : entry.grade,
    limitations: [...new Set([...(entry.limitations ?? []), boundedMessage])],
  }));
}

function sortedPaths(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}

function summarizedPaths(values, maximum = 750) {
  const paths = sortedPaths(values);
  if (paths.length === 0) return "none";
  const visible = [];
  for (const path of paths) {
    const suffix = paths.length > visible.length + 1 ? `, … (+${paths.length - visible.length - 1} more)` : "";
    if (visible.length > 0 && `${visible.join(", ")}, ${path}${suffix}`.length > maximum) break;
    visible.push(path);
    if (`${visible.join(", ")}${suffix}`.length > maximum) {
      visible[visible.length - 1] = boundedLine(path, Math.max(80, maximum - suffix.length));
      break;
    }
  }
  const remaining = paths.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? `, … (+${remaining} more)` : ""}`;
}

function samePathSet(left, right) {
  return JSON.stringify(sortedPaths(left)) === JSON.stringify(sortedPaths(right));
}

/**
 * Build the task-local Manual delivery boundary in one read-only Review call.
 * The native task supplies exact Root/chain bytes; the server owns repository
 * observation and creates Evidence before Review when the chain requires it.
 */
export function buildManualReviewLifecycle({
  rootPlanText,
  artifacts = [],
  reviewInput,
  checkEvidence = [],
  strategyRevision = 0,
  summary = null,
  workspaceRoot,
  pluginRoot,
  repositoryBaseline = null,
  repositoryAttribution = null,
  captureSnapshot = captureRepositorySnapshot,
}) {
  if (!reviewInput) throw new Error("manual Review requires review_input schema 1");
  if (!workspaceRoot) throw new Error("manual Review could not resolve the current repository root");

  const exact = exactEntries(rootPlanText, artifacts, pluginRoot);
  const initial = currentTips(exact.entries, pluginRoot);
  const evidenceTipId = initial.tips.evidence_tips[exact.rootFields.id] ?? null;
  const reviewTipId = initial.tips.review_tips[exact.rootFields.id] ?? null;
  const reviewTip = reviewTipId ? initial.inspected.effective.get(reviewTipId) : null;
  const correctionPending = Boolean(
    evidenceTipId
    && reviewTip?.fields?.latest_evidence_id === evidenceTipId
    && reviewTip?.fields?.next_action === "correct"
    && reviewTip?.fields?.correction_id,
  );

  const current = captureSnapshot(workspaceRoot);
  const suppliedReasonCodes = [
    ...(repositoryAttribution?.reason_codes ?? []),
    ...(repositoryAttribution?.status === "provisional" && (repositoryAttribution?.reason_codes ?? []).length === 0
      ? ["attribution-unavailable"]
      : []),
  ];
  const repositoryDelta = deriveRepositoryDelta(repositoryBaseline, current, {
    boundary: repositoryAttribution?.boundary ?? "create-plan",
    reasonCodes: suppliedReasonCodes,
  });
  let evidenceChangedPaths = repositoryDelta.changed_paths;
  let evidenceSnapshot = repositoryDelta.repository_snapshot;
  let effectiveReviewInput = reviewInput;
  let effectiveCheckEvidence = checkEvidence;
  if (repositoryDelta.attribution_status !== "attributed") {
    const reason = repositoryDelta.attribution_reason_codes.join(", ") || "attribution-unavailable";
    const message = `Repository attribution is provisional (${reason}); current checks remain usable, but Workflow cannot claim an exclusive task delta.`;
    effectiveReviewInput = attributionLimitation(effectiveReviewInput, message);
    effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
  }
  try {
    assertChangedPathAuthority(exact.rootFields, repositoryDelta.changed_paths, current.repository_root);
  } catch (error) {
    const message = `Current repository changes do not fit the native Plan authority: ${String(error?.message ?? error)}`;
    effectiveReviewInput = authorityLimitation(effectiveReviewInput, message);
    effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
    // Schema-5 Evidence may contain only Root-authorized changed paths. Keep
    // the complete dirty inventory in the Review limitation while recording
    // the safely attributable subset in Evidence.
    evidenceChangedPaths = repositoryDelta.changed_paths.filter((path) => {
      try {
        assertChangedPathAuthority(exact.rootFields, [path], current.repository_root);
        return true;
      } catch {
        return false;
      }
    });
    evidenceSnapshot = evidenceRepositorySnapshot(current, evidenceChangedPaths, { baselineAvailable: false });
  }

  // Reusing an Evidence tip is only honest when its declared changed_paths still
  // equal the current baseline-derived delivery delta. Pre-existing unchanged
  // dirty paths stay visible separately and never become attributed task work.
  const evidenceTip = evidenceTipId ? initial.inspected.effective.get(evidenceTipId) : null;
  if (
    evidenceTipId
    && !correctionPending
    && evidenceTip?.fields?.artifact === "delivery-evidence"
    && !samePathSet(evidenceTip.fields.changed_paths, repositoryDelta.changed_paths)
  ) {
    const observed = summarizedPaths(repositoryDelta.changed_paths);
    const claimed = summarizedPaths(evidenceTip.fields.changed_paths);
    const message = `Current repository delivery delta (${observed}) does not match Evidence ${evidenceTipId} changed_paths (${claimed})`;
    effectiveReviewInput = authorityLimitation(effectiveReviewInput, message);
    effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
  }

  let evidence = null;
  let reviewArtifacts = exact.entries;
  let chainUpdate = "reuse";
  if (!evidenceTipId || correctionPending) {
    evidence = buildDeliveryEvidence({
      rootPlanText,
      artifacts: exact.entries,
      checkEvidence: effectiveCheckEvidence,
      changedPaths: evidenceChangedPaths,
      strategyRevision,
      effectiveProfile: "manual",
      repositorySnapshot: evidenceSnapshot,
      repositoryAttribution: {
        status: repositoryDelta.attribution_status,
        boundary: repositoryDelta.attribution_boundary,
        baseline_hash: repositoryDelta.baseline_hash,
        reason_codes: repositoryDelta.attribution_reason_codes,
      },
      summary,
      manualCheckReceipts: [],
      // Manual verification is the fresh reviewer observation. Certified
      // controller profiles keep their independent receipt requirements.
      enforceManualCheckReceipts: false,
      pluginRoot,
    });
    reviewArtifacts = [...exact.entries, { label: evidence.fields.id, text: evidence.artifact }];
    chainUpdate = "append";
  } else {
    const refreshBaseEntries = exact.entries.filter((entry) => ![evidenceTipId, reviewTipId].includes(entry.label));
    const candidate = buildDeliveryEvidence({
      rootPlanText,
      artifacts: refreshBaseEntries,
      checkEvidence: effectiveCheckEvidence,
      changedPaths: evidenceChangedPaths,
      strategyRevision,
      effectiveProfile: "manual",
      repositorySnapshot: evidenceSnapshot,
      repositoryAttribution: {
        status: repositoryDelta.attribution_status,
        boundary: repositoryDelta.attribution_boundary,
        baseline_hash: repositoryDelta.baseline_hash,
        reason_codes: repositoryDelta.attribution_reason_codes,
      },
      summary,
      manualCheckReceipts: [],
      enforceManualCheckReceipts: false,
      pluginRoot,
    });
    const currentEvidenceText = exact.entries.find((entry) => entry.label === evidenceTipId)?.text ?? null;
    if (currentEvidenceText === candidate.artifact) {
      evidence = { ...candidate, duplicate: true };
      reviewArtifacts = exact.entries;
      chainUpdate = "reuse";
    } else {
      evidence = candidate;
      reviewArtifacts = [...refreshBaseEntries, { label: candidate.fields.id, text: candidate.artifact }];
      chainUpdate = candidate.fields.representation === "delta" ? "replace-delta-suffix" : "replace-full-tip";
    }
  }

  const review = buildWorkReview({
    rootPlanText,
    artifacts: reviewArtifacts,
    reviewInput: effectiveReviewInput,
    pluginRoot,
  });

  return {
    artifact_kind: "work-review",
    root_plan_id: exact.rootFields.id,
    repository_snapshot: evidenceSnapshot,
    repository_state_hash: repositorySnapshotHash(current),
    chain_update: chainUpdate,
    changed_paths: evidenceChangedPaths,
    observed_dirty_paths: repositoryDelta.observed_dirty_paths,
    pre_existing_paths: repositoryDelta.pre_existing_paths,
    repository_attribution: {
      status: repositoryDelta.attribution_status,
      boundary: repositoryDelta.attribution_boundary,
      baseline_hash: repositoryDelta.baseline_hash,
      reason_codes: repositoryDelta.attribution_reason_codes,
    },
    delivery_evidence: evidence,
    review,
  };
}
