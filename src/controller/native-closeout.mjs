import { createHash } from "node:crypto";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { parseCloseoutInput, validateCloseoutInput } from "../core/manual-attestation.mjs";
import {
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
  repositorySnapshotFingerprint,
} from "../core/manual-check-receipts.mjs";
import { rootContentHash } from "../core/state-paths.mjs";
import { assertChangedPathAuthority } from "../core/manual-path-authority.mjs";
import {
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
} from "./artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "./delivery-closeout.mjs";

function uniqueSorted(values) {
  return [...new Set((values ?? []).map(String))].sort();
}

function mergeArtifacts(entries, pluginRoot) {
  const byId = new Map();
  for (const entry of entries ?? []) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) continue;
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
      throw new Error(`native closeout artifact ${entry.label ?? "unknown"} is invalid: ${inspected.errors.join("; ")}`);
    }
    const id = inspected.artifact.fields.id;
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`native closeout artifact ${id} has conflicting text`);
    byId.set(id, { label: id, text: entry.text });
  }
  return [...byId.values()];
}

function provisionalWithoutBaseline(report) {
  const limitation = "No pre-mutation repository baseline was available; changed paths are the unambiguous current dirty set and otherwise verified observations are capped at supported.";
  return {
    ...report,
    summary: `PROVISIONAL: ${limitation} ${report.summary}`,
    check_evidence: report.check_evidence.map((entry) => ({
      ...entry,
      grade: entry.grade === "verified" ? "supported" : entry.grade,
      limitations: [...new Set([...(entry.limitations ?? []), limitation])],
    })),
  };
}

function assertCorrectionSourceReview(rootPlanText, rootFields, chain, pluginRoot) {
  const entries = [{ label: rootFields.id, text: rootPlanText }, ...chain];
  const inspected = inspectArtifactSet(entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (inspected.errors.length > 0) {
    throw new Error(`native correction closeout chain is invalid: ${inspected.errors.join("; ")}`);
  }
  const tips = effectiveCliSummary(inspected);
  const evidenceTip = tips.evidence_tips[rootFields.id] ?? null;
  if (!evidenceTip) throw new Error("native correction closeout is missing exact predecessor Evidence");
  const reviewTip = tips.review_tips[rootFields.id] ?? null;
  const review = reviewTip ? inspected.effective.get(reviewTip) : null;
  if (!review || review.fields.latest_evidence_id !== evidenceTip || review.fields.next_action !== "correct" || !review.fields.correction_id) {
    throw new Error(`native correction closeout is missing exact Source Review for predecessor Evidence ${evidenceTip}`);
  }
}

export function nativeCloseoutStructuredContent(closeout, rootPlanText, repositoryDelta = null) {
  if (!closeout?.artifact || !closeout?.fields?.id) throw new Error("native closeout result is incomplete");
  return {
    root_plan_id: closeout.fields.root_plan_id,
    delivery_evidence_id: closeout.fields.id,
    artifact: closeout.artifact,
    artifact_hash: closeout.artifact_hash ?? createHash("sha256").update(closeout.artifact).digest("hex"),
    evidence_mode: closeout.fields.evidence_mode,
    overall_grade: closeout.fields.overall_grade,
    status: closeout.fields.status,
    subject_id: closeout.fields.subject_id,
    source_review_id: closeout.fields.source_review_id ?? null,
    predecessor_evidence_id: closeout.fields.predecessor_evidence_id ?? null,
    changed_paths: closeout.fields.changed_paths ?? [],
    check_evidence: closeout.fields.check_evidence ?? [],
    duplicate: Boolean(closeout.duplicate),
    handoff_persisted: closeout.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: closeout.handoff_persisted ? "root-content-cache" : "stateless",
    root_content_hash: rootContentHash(rootPlanText),
    ...(repositoryDelta?.repository_snapshot
      ? { repository_snapshot_hash: repositorySnapshotFingerprint(repositoryDelta.repository_snapshot) }
      : {}),
    ...(repositoryDelta ? {
      observed_dirty_paths: repositoryDelta.observed_dirty_paths ?? repositoryDelta.changed_paths ?? [],
      pre_existing_paths: repositoryDelta.pre_existing_paths ?? [],
      repository_attribution: {
        status: repositoryDelta.attribution_status ?? (repositoryDelta.baseline_available ? "attributed" : "provisional"),
        boundary: repositoryDelta.attribution_boundary ?? "create-plan",
        baseline_hash: repositoryDelta.baseline_hash ?? null,
        reason_codes: repositoryDelta.attribution_reason_codes ?? (repositoryDelta.baseline_available ? [] : ["baseline-unavailable"]),
      },
    } : {}),
    ...(closeout.constraint_summary ? { constraint_summary: closeout.constraint_summary } : {}),
    ...(closeout.human_attention ? { human_attention: closeout.human_attention } : {}),
    ...(closeout.problem_details ? { problem_details: closeout.problem_details } : {}),
    ...(closeout.artifact_set_hash ? { artifact_set_hash: closeout.artifact_set_hash } : {}),
    ...(closeout.warning ? { warning: closeout.warning } : {}),
    ...(closeout.handoff_error_code ? { handoff_error_code: closeout.handoff_error_code } : {}),
  };
}

export function performNativeCloseout({
  attestation,
  message = null,
  expectedPhase = null,
  rootPlanText,
  artifacts = [],
  repositoryDelta,
  pluginRoot,
  handoffOptions = {},
  receiptOptions = {},
  invalidatedEvidence = null,
}) {
  const parsed = attestation
    ? validateCloseoutInput(attestation)
    : parseCloseoutInput(message, { expectedPhase });
  if (!parsed.ok) throw new Error(`native closeout attestation is invalid: ${parsed.issues.join("; ")}`);
  const report = parsed.report;
  if (expectedPhase && report.phase !== expectedPhase) throw new Error(`native closeout phase must be ${expectedPhase}`);
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) throw new Error("native closeout requires independently captured exact Root text");
  const inspectedRoot = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspectedRoot.errors.length > 0 || inspectedRoot.artifact?.fields?.artifact !== "work-plan") {
    throw new Error(`native closeout active Root is invalid: ${inspectedRoot.errors.join("; ")}`);
  }
  const rootFields = inspectedRoot.artifact.fields;
  if (rootFields.id !== report.root_plan_id) {
    throw new Error(`native closeout Root mismatch: active ${rootFields.id}, report ${report.root_plan_id}`);
  }
  if (!repositoryDelta || !Array.isArray(repositoryDelta.changed_paths) || !repositoryDelta.repository_snapshot) {
    throw new Error("native closeout requires a host-derived repository delta");
  }
  // Caller paths are compatibility-only hints. Repository evidence and Authority always use
  // the host-derived inventory so an agent can neither omit nor add authoritative paths.
  assertChangedPathAuthority(rootFields, repositoryDelta.changed_paths, repositoryDelta.repository_snapshot.repository_root ?? repositoryDelta.repository_root);
  if (!repositoryDelta.baseline_available && report.phase !== "review-recovery") {
    throw new Error("native implementation and correction closeout require a pre-mutation repository baseline");
  }
  const handoffStore = createContentAddressedHandoffStore(rootPlanText, pluginRoot, handoffOptions);
  if (invalidatedEvidence?.id && invalidatedEvidence?.hash) {
    try {
      const cachedInvalidated = handoffStore.records([invalidatedEvidence.id])[0] ?? null;
      if (cachedInvalidated) {
        handoffStore.quarantineArtifact(invalidatedEvidence.id, {
          expectedTextHash: invalidatedEvidence.hash,
          apply: true,
        });
      }
    } catch { /* optional cross-task transport must not block exact task-local closeout */ }
  }
  let cached = [];
  let cachedEvidenceTip = null;
  try {
    const context = handoffStore.context(rootFields.id, rootPlanText);
    cached = context.artifacts;
    cachedEvidenceTip = context.evidence_tip;
  } catch { /* task artifacts are authoritative; handoff is optional enrichment */ }
  const effectiveReport = repositoryDelta.baseline_available || cachedEvidenceTip
    ? report
    : provisionalWithoutBaseline(report);
  const chain = mergeArtifacts([
    ...cached,
    ...artifacts,
  ], pluginRoot).filter((entry) => entry.label !== rootFields.id);
  if (effectiveReport.phase === "correction") {
    assertCorrectionSourceReview(rootPlanText, rootFields, chain, pluginRoot);
  }
  const repositoryRoot = repositoryDelta.repository_snapshot.repository_root ?? repositoryDelta.repository_root;
  const manualCheckReceipts = loadManualCheckReceipts({
    rootPlanText,
    pluginRoot,
    workspaceRoot: repositoryRoot,
    options: receiptOptions,
  });
  const closeout = buildDeliveryEvidence({
    rootPlanText,
    artifacts: chain,
    checkEvidence: effectiveReport.check_evidence,
    changedPaths: repositoryDelta.changed_paths,
    strategyRevision: effectiveReport.strategy_revision,
    effectiveProfile: "manual",
    repositorySnapshot: repositoryDelta.repository_snapshot,
    repositoryAttribution: {
      status: repositoryDelta.attribution_status ?? (repositoryDelta.baseline_available ? "attributed" : "provisional"),
      boundary: repositoryDelta.attribution_boundary ?? "create-plan",
      baseline_hash: repositoryDelta.baseline_hash ?? null,
      reason_codes: repositoryDelta.attribution_reason_codes ?? (repositoryDelta.baseline_available ? [] : ["baseline-unavailable"]),
    },
    summary: effectiveReport.summary,
    manualCheckReceipts,
    enforceManualCheckReceipts: true,
    pluginRoot,
  });
  if (effectiveReport.phase === "implementation" && closeout.fields.subject_id !== rootFields.id) {
    throw new Error("native implementation closeout conflicts with an existing correction lineage");
  }
  if (effectiveReport.phase === "correction" && !String(closeout.fields.subject_id).startsWith("cp-")) {
    throw new Error("native correction closeout requires the current correction lineage tip");
  }
  const persisted = persistCloseout({
    handoffStore,
    rootPlanText,
    artifacts: chain,
    closeout,
  });
  invalidateManualCheckReceipts({ rootPlanText, workspaceRoot: repositoryRoot, options: receiptOptions });
  if (persisted.handoff_persisted) {
    try { rememberContentAddressedRoot(rootPlanText, pluginRoot, handoffOptions); }
    catch { /* exact Root/Evidence remain retained by the current host task */ }
  }
  return {
    ...persisted,
    report: effectiveReport,
    structuredContent: nativeCloseoutStructuredContent(persisted, rootPlanText, repositoryDelta),
  };
}
