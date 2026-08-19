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
} from "../core/manual-repository-snapshot.mjs";
import { buildDeliveryEvidence } from "./delivery-closeout.mjs";
import { buildWorkReview } from "./work-review-builder.mjs";

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

function repositoryLimitation(reviewInput, message) {
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment)
      ? "partially-achieved"
      : reviewInput.assessment,
    recommended_action: "clarify",
    snapshot_assessment: "incomplete",
    snapshot_summary: `${reviewInput.snapshot_summary} ${message}`.trim(),
    missing_evidence: [...new Set([...(reviewInput.missing_evidence ?? []), message])],
    correction: undefined,
  };
}

function supportedOnBoundary(checkEvidence, message) {
  return (checkEvidence ?? []).map((entry) => ({
    ...entry,
    grade: entry.grade === "verified" ? "supported" : entry.grade,
    limitations: [...new Set([...(entry.limitations ?? []), message])],
  }));
}

function sortedPaths(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
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
  const repositoryDelta = deriveRepositoryDelta(null, current);
  let evidenceChangedPaths = repositoryDelta.changed_paths;
  let evidenceSnapshot = repositoryDelta.repository_snapshot;
  let effectiveReviewInput = reviewInput;
  let effectiveCheckEvidence = checkEvidence;
  try {
    assertChangedPathAuthority(exact.rootFields, repositoryDelta.changed_paths, current.repository_root);
  } catch (error) {
    const message = `Current repository changes do not fit the native Plan authority: ${String(error?.message ?? error)}`;
    effectiveReviewInput = repositoryLimitation(reviewInput, message);
    effectiveCheckEvidence = supportedOnBoundary(checkEvidence, message);
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
  // equal the complete current dirty inventory. Otherwise Review must expose that
  // inventory as a clarification rather than inherit a verified repository claim.
  const evidenceTip = evidenceTipId ? initial.inspected.effective.get(evidenceTipId) : null;
  if (
    evidenceTipId
    && !correctionPending
    && evidenceTip?.fields?.artifact === "delivery-evidence"
    && !samePathSet(evidenceTip.fields.changed_paths, repositoryDelta.changed_paths)
  ) {
    const observed = sortedPaths(repositoryDelta.changed_paths).join(", ") || "none";
    const claimed = sortedPaths(evidenceTip.fields.changed_paths).join(", ") || "none";
    const message = `Current repository dirty inventory (${observed}) does not match Evidence ${evidenceTipId} changed_paths (${claimed})`;
    effectiveReviewInput = repositoryLimitation(effectiveReviewInput, message);
    effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
  }

  let evidence = null;
  let reviewArtifacts = exact.entries;
  if (!evidenceTipId || correctionPending) {
    evidence = buildDeliveryEvidence({
      rootPlanText,
      artifacts: exact.entries,
      checkEvidence: effectiveCheckEvidence,
      changedPaths: evidenceChangedPaths,
      strategyRevision,
      effectiveProfile: "manual",
      repositorySnapshot: evidenceSnapshot,
      summary,
      manualCheckReceipts: [],
      // Manual verification is the fresh reviewer observation. Certified
      // controller profiles keep their independent receipt requirements.
      enforceManualCheckReceipts: false,
      pluginRoot,
    });
    reviewArtifacts = [...exact.entries, { label: evidence.fields.id, text: evidence.artifact }];
  }

  const review = buildWorkReview({
    rootPlanText,
    artifacts: reviewArtifacts,
    reviewInput: effectiveReviewInput,
    pluginRoot,
  });
  const effectiveEvidenceId = evidence?.fields?.id ?? review.fields.latest_evidence_id;
  const effectiveEvidence = evidence ?? reviewArtifacts
    .map((entry) => ({ entry, fields: inspectArtifactText(entry.text, pluginRoot).artifact?.fields }))
    .find(({ fields }) => fields?.artifact === "delivery-evidence" && fields.id === effectiveEvidenceId)?.entry;

  return {
    artifact_kind: "work-review",
    root_plan_id: exact.rootFields.id,
    repository_snapshot: evidenceSnapshot,
    changed_paths: evidenceChangedPaths,
    observed_dirty_paths: repositoryDelta.changed_paths,
    delivery_evidence: evidence ?? {
      duplicate: true,
      artifact: effectiveEvidence?.text ?? null,
      artifact_hash: effectiveEvidence?.text
        ? createHash("sha256").update(effectiveEvidence.text, "utf8").digest("hex")
        : null,
      fields: initial.inspected.effective.get(effectiveEvidenceId)?.fields ?? null,
    },
    review,
  };
}
