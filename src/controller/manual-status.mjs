import { createHash } from "node:crypto";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { deriveWorkflowState } from "../../scripts/derive-workflow-state.mjs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function artifactSetHash(entries) {
  const observations = entries
    .map(({ label, text }) => ({ label, text_hash: createHash("sha256").update(String(text)).digest("hex") }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.text_hash.localeCompare(right.text_hash));
  return createHash("sha256").update(JSON.stringify(observations)).digest("hex");
}

function baseInput(rootPlanId, entries, observedAt) {
  return {
    run_id: null,
    root_plan_id: rootPlanId,
    requested_profile: "manual",
    effective_profile: "manual",
    snapshot_source: "artifact-chain",
    artifact_set_hash: artifactSetHash(entries),
    observed_at: observedAt,
    revision: null,
  };
}

function summary(rootPlanId, entries, evidenceTip = null, reviewTip = null) {
  return {
    root_plan_id: rootPlanId,
    artifact_count: entries.length,
    evidence_tip: evidenceTip,
    review_tip: reviewTip,
  };
}

function incomplete(rootPlanId, entries, observedAt, blockers) {
  const input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, manual_context_incomplete: true, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: [],
  };
}

function invalid(rootPlanId, entries, observedAt, blockers, diagnostics = []) {
  const input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, artifact_chain_valid: false, root_schema_valid: false, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: unique(diagnostics),
  };
}

function referencedIds(fields) {
  if (fields.artifact === "delivery-evidence") return [fields.predecessor_evidence_id, fields.source_review_id];
  if (fields.artifact === "work-review") return [fields.latest_evidence_id, fields.predecessor_review_id];
  return [];
}

export function deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot, observedAt = new Date().toISOString() }) {
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId ?? ""))) throw new Error("manual status requires a valid wp-* root_plan_id");
  if (!Array.isArray(artifacts) || artifacts.length === 0) return incomplete(rootPlanId, [], observedAt, ["manual-artifact-context-missing"]);
  const entries = artifacts.map((entry, index) => {
    if (!entry || typeof entry.label !== "string" || entry.label.trim() === "" || typeof entry.text !== "string" || entry.text.trim() === "") {
      throw new Error(`manual status artifact ${index + 1} requires non-empty label and text`);
    }
    return { label: entry.label, text: entry.text };
  });
  if (new Set(entries.map((entry) => entry.label)).size !== entries.length) throw new Error("manual status artifact labels must be unique");

  const inspected = entries.map((entry) => ({ entry, inspection: inspectArtifactText(entry.text, pluginRoot) }));
  const unparseable = inspected.filter(({ inspection }) => !inspection.artifact?.fields?.artifact);
  if (unparseable.length > 0) return invalid(rootPlanId, entries, observedAt, unparseable.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`)));

  const related = inspected.filter(({ inspection }) => {
    const fields = inspection.artifact.fields;
    return fields.id === rootPlanId || fields.root_plan_id === rootPlanId;
  });
  const rootRecords = related.filter(({ inspection }) => inspection.artifact.fields.artifact === "work-plan" && inspection.artifact.fields.id === rootPlanId);
  if (rootRecords.length === 0) return incomplete(rootPlanId, entries, observedAt, ["manual-root-artifact-missing"]);
  if (rootRecords.length > 1) return invalid(rootPlanId, entries, observedAt, ["manual-root-artifact-ambiguous"]);

  const relatedEntries = related.map(({ entry }) => entry);
  const individualErrors = related.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`));
  if (individualErrors.length > 0) return invalid(rootPlanId, relatedEntries, observedAt, individualErrors, related.flatMap(({ inspection }) => inspection.diagnostics));

  const ids = new Set(related.map(({ inspection }) => inspection.artifact.fields.id));
  const missingReferences = [];
  for (const { entry, inspection } of related) {
    for (const reference of referencedIds(inspection.artifact.fields)) if (reference && !ids.has(reference)) missingReferences.push(`${entry.label}: manual-artifact-context-missing:${reference}`);
  }
  if (missingReferences.length > 0) return incomplete(rootPlanId, relatedEntries, observedAt, missingReferences);

  const chain = inspectArtifactSet(relatedEntries.map(({ label, text }) => [label, text]), pluginRoot);
  if (chain.errors.length > 0) return invalid(rootPlanId, relatedEntries, observedAt, chain.errors, chain.diagnostics);
  const tips = effectiveCliSummary(chain);
  const evidenceTipId = tips.evidence_tips[rootPlanId] ?? null;
  const reviewTipId = tips.review_tips[rootPlanId] ?? null;
  const root = chain.effective.get(rootPlanId);
  const evidence = evidenceTipId ? chain.effective.get(evidenceTipId) : null;
  const review = reviewTipId ? chain.effective.get(reviewTipId) : null;
  const correctionEvidencePendingReview = Boolean(review
    && evidence?.fields.source_review_id === review.fields.id
    && evidence?.fields.subject_id === review.fields.correction_id);
  const input = {
    ...baseInput(rootPlanId, relatedEntries, observedAt),
    design_depth: root.fields.design_depth,
    root_schema_valid: true,
    artifact_chain_valid: true,
    plan_status: root.fields.status,
    plan_approved: Boolean(evidence),
    intent_ready: root.fields.intent_ready === true,
    material_open_decisions: root.fields.status !== "ready" || root.fields.intent_ready !== true,
    product_aligned: true,
    architecture_aligned: true,
    program_design_aligned: true,
    slices_ready: true,
    execution_started: Boolean(evidence),
    evidence_tip: evidenceTipId,
    review_tip: reviewTipId,
    review: review?.fields ?? null,
    correction_evidence_pending_review: correctionEvidencePendingReview,
    root_review_complete: review?.fields.assessment === "achieved" && review?.fields.next_action === "none",
    more_slices: false,
  };
  return {
    snapshot: deriveWorkflowState(input),
    artifact_summary: summary(rootPlanId, relatedEntries, evidenceTipId, reviewTipId),
    diagnostics: unique([...chain.normalizations, ...chain.diagnostics]),
  };
}
