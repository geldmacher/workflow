import { createHash } from "node:crypto";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { manualConstraintProjection } from "../core/manual-check-receipts.mjs";
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

function summary(rootPlanId, entries, evidenceTip = null, reviewTip = null, learningCandidates = [], traceability = {}) {
  return {
    root_plan_id: rootPlanId,
    artifact_count: entries.length,
    evidence_tip: evidenceTip,
    review_tip: reviewTip,
    learning_candidates: learningCandidates,
    ...traceability,
  };
}

export function deriveManualLearningProjection({ snapshot, artifact_summary: artifactSummary }) {
  const blockers = [];
  if (snapshot?.state !== "achieved") blockers.push("learning-source-not-achieved");
  if (snapshot?.delivery_status !== "verified") blockers.push("learning-source-not-verified");
  return {
    schema: 1,
    eligible: blockers.length === 0,
    source_kind: "artifact-chain",
    source_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    root_plan_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    effective_profile: "manual",
    blockers,
    workspace_match: { status: "not-required", matched: true, paths: [] },
    delivery_commit: null,
    delivered_paths: [],
    event_chain_valid: null,
    compatibility: snapshot?.compatibility ?? "compatible",
    source_binding: { status: "confirmed", kind: "current-task-artifacts" },
    candidates: (artifactSummary?.learning_candidates ?? []).map((candidate) => ({ ...candidate })),
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
  if (fields.artifact === "work-plan") return [fields.predecessor_plan_id, fields.replan_source_review_id];
  if (fields.artifact === "delivery-evidence") return [fields.predecessor_evidence_id, fields.source_review_id];
  if (fields.artifact === "work-review") return [fields.latest_evidence_id, fields.predecessor_review_id];
  return [];
}

function normalizeEntries(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return [];
  const entries = artifacts.map((entry, index) => {
    if (!entry || typeof entry.label !== "string" || entry.label.trim() === "" || typeof entry.text !== "string" || entry.text.trim() === "") {
      throw new Error(`manual status artifact ${index + 1} requires non-empty label and text`);
    }
    return { label: entry.label, text: entry.text };
  });
  if (new Set(entries.map((entry) => entry.label)).size !== entries.length) throw new Error("manual status artifact labels must be unique");
  return entries;
}

function activeRootFromEntries(entries, pluginRoot) {
  const roots = entries
    .map((entry) => inspectArtifactText(entry.text, pluginRoot).artifact)
    .filter((artifact) => artifact?.fields?.artifact === "work-plan");
  if (roots.length === 0) throw new Error("manual active root resolution requires a current work-plan artifact");
  const ids = new Set(roots.map((root) => root.fields.id));
  if (ids.size !== roots.length) throw new Error("manual active root resolution found duplicate work-plan IDs");
  const referenced = new Set(roots.map((root) => root.fields.predecessor_plan_id).filter((id) => ids.has(id)));
  const tips = roots.filter((root) => !referenced.has(root.fields.id)).map((root) => root.fields.id).sort();
  if (tips.length === 0) throw new Error("manual active root resolution found cyclic work-plan lineage");
  if (tips.length > 1) throw new Error(`manual active root resolution is ambiguous: ${tips.join(", ")}`);
  return tips[0];
}

export function resolveManualRootPlanId({ artifacts, pluginRoot }) {
  return activeRootFromEntries(normalizeEntries(artifacts), pluginRoot);
}

export function deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot, observedAt = new Date().toISOString(), manualAcceptance = null, boundaryReceiptVerifier = null }) {
  if (manualAcceptance !== null && manualAcceptance !== "provisional") throw new Error("manual acceptance must be provisional");
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires a complete current Schema 5 artifact chain");
    if (!rootPlanId) throw new Error("manual active root resolution requires current-task artifacts");
    return incomplete(rootPlanId, [], observedAt, ["manual-artifact-context-missing"]);
  }
  const entries = normalizeEntries(artifacts);
  rootPlanId ??= activeRootFromEntries(entries, pluginRoot);
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("manual status requires a valid wp-* root_plan_id");

  const inspected = entries.map((entry) => ({ entry, inspection: inspectArtifactText(entry.text, pluginRoot) }));
  const unparseable = inspected.filter(({ inspection }) => !inspection.artifact?.fields?.artifact);
  if (unparseable.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires a parseable current Schema 5 artifact chain");
    return invalid(rootPlanId, entries, observedAt, unparseable.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`)));
  }

  const rootById = new Map(inspected
    .filter(({ inspection }) => inspection.artifact?.fields?.artifact === "work-plan")
    .map(({ inspection }) => [inspection.artifact.fields.id, inspection.artifact]));
  const lineageRootIds = new Set();
  let lineageCursor = rootPlanId;
  while (lineageCursor && !lineageRootIds.has(lineageCursor)) {
    lineageRootIds.add(lineageCursor);
    lineageCursor = rootById.get(lineageCursor)?.fields.predecessor_plan_id ?? null;
  }
  const related = inspected.filter(({ inspection }) => {
    const fields = inspection.artifact.fields;
    return lineageRootIds.has(fields.id) || lineageRootIds.has(fields.root_plan_id);
  });
  const rootRecords = related.filter(({ inspection }) => inspection.artifact.fields.artifact === "work-plan" && inspection.artifact.fields.id === rootPlanId);
  if (rootRecords.length === 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires the current root artifact");
    return incomplete(rootPlanId, entries, observedAt, ["manual-root-artifact-missing"]);
  }
  if (rootRecords.length > 1) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires one unambiguous root artifact");
    return invalid(rootPlanId, entries, observedAt, ["manual-root-artifact-ambiguous"]);
  }

  const relatedEntries = related.map(({ entry }) => entry);
  const schemas = new Set(related.map(({ inspection }) => inspection.artifact.fields.schema));
  if (schemas.size === 1 && schemas.has(3)) {
    if (manualAcceptance) throw new Error("Workflow 3 artifact chains are read-only and cannot be accepted");
    const input = baseInput(rootPlanId, relatedEntries, observedAt);
    return {
      snapshot: deriveWorkflowState({ ...input, lifecycle: "stopped", compatibility: "read-only-workflow-3", blockers: ["legacy-workflow-3-read-only"] }),
      artifact_summary: summary(rootPlanId, relatedEntries),
      diagnostics: ["Workflow 3 artifacts are preserved as read-only history and are not converted"],
    };
  }
  if (schemas.size === 1 && schemas.has(4)) {
    if (manualAcceptance) throw new Error("Workflow 4 artifact chains are read-only and cannot be accepted");
    const input = baseInput(rootPlanId, relatedEntries, observedAt);
    return {
      snapshot: deriveWorkflowState({ ...input, lifecycle: "stopped", compatibility: "read-only-workflow-4", blockers: ["legacy-workflow-4-read-only"] }),
      artifact_summary: summary(rootPlanId, relatedEntries),
      diagnostics: ["Workflow 4 artifacts are preserved as read-only history and are not converted"],
    };
  }
  if (schemas.size > 1 || !schemas.has(5)) {
    if (manualAcceptance) throw new Error("manual provisional acceptance rejects mixed or non-current Workflow schemas");
    return invalid(rootPlanId, relatedEntries, observedAt, ["mixed or unsupported Workflow artifact schemas are not supported"]);
  }
  const individualErrors = related.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`));
  if (individualErrors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${individualErrors.join("; ")}`);
    return invalid(rootPlanId, relatedEntries, observedAt, individualErrors, related.flatMap(({ inspection }) => inspection.diagnostics));
  }

  const ids = new Set(related.map(({ inspection }) => inspection.artifact.fields.id));
  const missingReferences = [];
  for (const { entry, inspection } of related) {
    for (const reference of referencedIds(inspection.artifact.fields)) if (reference && !ids.has(reference)) missingReferences.push(`${entry.label}: manual-artifact-context-missing:${reference}`);
  }
  if (missingReferences.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires every referenced artifact");
    return incomplete(rootPlanId, relatedEntries, observedAt, missingReferences);
  }

  const chain = inspectArtifactSet(
    relatedEntries.map(({ label, text }) => [label, text]),
    pluginRoot,
    { boundaryReceiptVerifier },
  );
  if (chain.errors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${chain.errors.join("; ")}`);
    const boundaryTrustErrors = chain.errors.filter((error) => /root-boundary review requires a fresh protected host receipt|boundary receipt is not trusted|boundary receipt host verification failed/.test(error));
    if (boundaryTrustErrors.length > 0) {
      const blocked = incomplete(rootPlanId, relatedEntries, observedAt, boundaryTrustErrors);
      return { ...blocked, diagnostics: unique([...blocked.diagnostics, ...chain.diagnostics]) };
    }
    return invalid(rootPlanId, relatedEntries, observedAt, chain.errors, chain.diagnostics);
  }
  const tips = effectiveCliSummary(chain);
  const evidenceTipId = tips.evidence_tips[rootPlanId] ?? null;
  const reviewTipId = tips.review_tips[rootPlanId] ?? null;
  const root = chain.effective.get(rootPlanId);
  const evidence = evidenceTipId ? chain.effective.get(evidenceTipId) : null;
  const review = reviewTipId ? chain.effective.get(reviewTipId) : null;
  const boundaryReview = review?.fields.review_basis === "root-boundary";
  const correctionEvidencePendingReview = Boolean(review
    && evidence?.fields.source_review_id === review.fields.id
    && evidence?.fields.subject_id === review.fields.correction_id);
  const contract = executionContractFromArtifactText(rootRecords[0].entry.text, pluginRoot);
  const constraintProjection = contract.errors.length === 0
    ? manualConstraintProjection({
      checks: contract.checks,
      evidence: evidence?.fields.check_evidence ?? [],
      pending: !evidence,
    })
    : {};
  const legacyReceiptGap = (constraintProjection.constraint_summary?.legacy_unattested_verified_checks?.length ?? 0) > 0;
  const acceptanceEligible = root?.fields.profile_max === "manual"
    && evidence
    && review
    && evidence.fields.status !== "blocked"
    && evidence.fields.overall_grade !== "failed"
    && !(evidence.fields.check_evidence ?? []).some((check) => check.grade === "failed")
    && review.fields.delivery_status === "provisional"
    && review.fields.next_action === "accept-provisional"
    && !correctionEvidencePendingReview;
  if (manualAcceptance && !acceptanceEligible) {
    throw new Error("manual provisional acceptance requires the unique current provisional review tip, no failed check, no blocked artifact, and no correction awaiting review");
  }
  const input = {
    ...baseInput(rootPlanId, relatedEntries, observedAt),
    contract_level: root.fields.contract_level,
    root_schema_valid: true,
    artifact_chain_valid: true,
    plan_status: root.fields.status,
    plan_approved: Boolean(evidence || boundaryReview),
    intent_ready: root.fields.intent_ready === true,
    material_open_decisions: root.fields.status !== "ready" || root.fields.intent_ready !== true,
    product_aligned: true,
    architecture_aligned: true,
    program_design_aligned: true,
    slices_ready: true,
    execution_started: Boolean(evidence || boundaryReview),
    evidence_tip: evidenceTipId,
    review_tip: reviewTipId,
    review: review?.fields ?? null,
    evidence_grade: legacyReceiptGap ? "supported" : (evidence?.fields.overall_grade ?? null),
    delivery_status: legacyReceiptGap ? null : (review?.fields.delivery_status ?? null),
    intent_hash: evidence?.fields.intent_hash ?? null,
    strategy_revision: evidence?.fields.strategy_revision ?? (evidence?.fields.evidence_mode === "lean" ? 0 : null),
    manual_acceptance: manualAcceptance,
    acceptance_basis_hash: manualAcceptance ? artifactSetHash(relatedEntries) : null,
    correction_evidence_pending_review: correctionEvidencePendingReview,
    boundary_review: boundaryReview,
    root_review_complete: !legacyReceiptGap && review?.fields.assessment === "achieved" && review?.fields.next_action === "none",
    more_slices: false,
  };
  return {
    snapshot: deriveWorkflowState(input),
    artifact_summary: summary(rootPlanId, relatedEntries, evidenceTipId, reviewTipId, tips.learning_candidates, {
      artifact_set_hash: artifactSetHash(relatedEntries),
      root_content_hash: createHash("sha256").update(root.text).digest("hex"),
      evidence_hash: evidence ? createHash("sha256").update(evidence.text).digest("hex") : null,
      review_hash: review ? createHash("sha256").update(review.text).digest("hex") : null,
      finding_ids: (review?.findings ?? []).map((finding) => finding["Finding key"]).filter(Boolean),
      receipt_ids: [...new Set((evidence?.fields.check_evidence ?? []).flatMap((check) => check.artifact_hashes ?? []))],
    }),
    diagnostics: unique([...chain.normalizations, ...chain.diagnostics]),
    ...constraintProjection,
  };
}
