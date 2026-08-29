import { createHash } from "node:crypto";
import { stringify } from "yaml";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import {
  calibrateHarnessCheckEvidence,
  harnessConstraintProjection,
  harnessContractHash,
} from "../core/harness-attestations.mjs";
import { classifyChangedPathAuthority } from "../core/manual-path-authority.mjs";

const GRADES = new Set(["verified", "supported", "partial", "unavailable", "failed"]);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeArtifacts(rootPlanText, artifacts, pluginRoot) {
  const root = inspectArtifactText(rootPlanText, pluginRoot);
  if (root.errors.length > 0 || root.artifact?.fields?.artifact !== "work-plan" || root.artifact.fields.schema !== 6) {
    throw new Error(`closeout requires an exact valid Schema-6 Root: ${root.errors.join("; ") || "not a work-plan"}`);
  }
  const rootId = root.artifact.fields.id;
  const byId = new Map([[rootId, { label: rootId, text: rootPlanText }]]);
  for (const [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) throw new Error(`closeout artifact ${index + 1} requires exact text`);
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`closeout artifact ${entry.label ?? index + 1} is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`closeout artifact ${id} has conflicting immutable bytes`);
    byId.set(id, { ...entry, label: id });
  }
  return { rootId, entries: [...byId.values()] };
}

function ids(value, pattern) {
  return unique(String(value ?? "").match(pattern) ?? []);
}

function correctionObjectives(correction) {
  return unique((correction?.fixes ?? []).flatMap((fix) => ids(fix["Root Objectives"], /OBJ-[1-9][0-9]*/g)));
}

function correctionRootChecks(correction) {
  return unique((correction?.fixes ?? []).flatMap((fix) => ids(fix["Root Checks"], /CHECK-[1-9][0-9]*/g)));
}

function correctionCheckIntent(correction, check) {
  const fixIds = new Set(ids(check["FIX IDs"], /FIX-[1-9][0-9]*/g));
  const objectives = unique((correction?.fixes ?? [])
    .filter((fix) => fixIds.has(fix["FIX ID"]))
    .flatMap((fix) => ids(fix["Root Objectives"], /OBJ-[1-9][0-9]*/g)));
  return {
    "Check ID": check["Check ID"],
    Objectives: objectives.join(", "),
    "Verification Intent": check["Verification Intent"],
    "Expected Evidence": check["Expected Evidence"],
    Required: check.Required,
    "Evidence Class": check["Evidence Class"],
    "Cost Class": check["Cost Class"],
    Prerequisites: check.Prerequisites,
  };
}

function requiredChecks(contract, correction) {
  const root = contract.checks.filter((check) => check.Required === "yes");
  if (!correction) return new Map(root.map((check) => [check["Check ID"], check]));
  const correctionChecks = (correction.checks ?? [])
    .filter((check) => check.Required === "yes")
    .map((check) => correctionCheckIntent(correction, check));
  const referencedRootIds = new Set(correctionRootChecks(correction));
  const referencedRoot = root.filter((check) => referencedRootIds.has(check["Check ID"]));
  return new Map([...correctionChecks, ...referencedRoot, ...root].map((check) => [check["Check ID"], check]));
}

export function correctionHarnessVerificationIntents(correction, contract) {
  return [...requiredChecks(contract, correction).values()];
}

function normalizeEvidence(input, plannedChecks) {
  if (!Array.isArray(input)) throw new Error("closeout Check evidence must be an array");
  const ids = input.map((entry) => entry?.check_id);
  if (new Set(ids).size !== ids.length) throw new Error("closeout Check evidence IDs must be unique");
  const supplied = new Map(input.map((entry) => [entry?.check_id, entry]));
  for (const checkId of supplied.keys()) if (!plannedChecks.has(checkId)) throw new Error(`closeout received unknown Check ${checkId}`);
  return [...plannedChecks.keys()].map((checkId) => supplied.get(checkId) ?? {
    check_id: checkId,
    grade: "unavailable",
    observed: "No project-harness observation was available for this verification intent.",
    evidence_hashes: [],
    limitations: ["The active project harness did not return evidence for this Check."],
  }).map((entry) => {
    if (!plannedChecks.has(entry?.check_id)) throw new Error(`closeout received unknown Check ${entry?.check_id}`);
    if (!GRADES.has(entry.grade)) throw new Error(`closeout Check ${entry.check_id} has invalid grade`);
    const limitations = unique((entry.limitations ?? []).map(String).map((value) => value.trim()).filter(Boolean));
    if (entry.grade === "unavailable" && limitations.length === 0) throw new Error(`unavailable Check ${entry.check_id} requires a concrete limitation`);
    return {
      check_id: entry.check_id,
      grade: entry.grade,
      observed: String(entry.observed ?? "not fully observed").trim() || "not fully observed",
      evidence_hashes: unique((entry.evidence_hashes ?? []).map(String).filter((value) => /^[a-f0-9]{64}$/.test(value))),
      ...(typeof entry.attestation_hash === "string" ? { attestation_hash: entry.attestation_hash } : {}),
      limitations,
    };
  });
}

function aggregate(entries) {
  const grades = entries.map((entry) => entry.grade);
  if (grades.includes("failed")) return "failed";
  if (entries.length > 0 && grades.every((grade) => grade === "verified")) return "verified";
  if (grades.includes("unavailable")) return "unavailable";
  if (grades.includes("partial")) return "partial";
  return "supported";
}

function artifactStatus(grade) {
  if (grade === "failed") return "blocked";
  return grade === "verified" ? "complete" : "provisional";
}

function summaryText(summary, status, grade, entries) {
  const supplied = String(summary ?? "").trim();
  if (supplied) return supplied;
  if (status === "blocked") return "BLOCKER: at least one required verification intent failed.";
  if (status === "complete") return "Every required verification intent is bound to a passing project-harness attestation.";
  const limitations = unique(entries.flatMap((entry) => entry.limitations ?? []));
  return `Delivery remains provisional with evidence grade ${grade}.${limitations.length > 0 ? ` Limitations: ${limitations.join(" ")}` : ""}`;
}

export function buildDeliveryEvidence({
  rootPlanText,
  artifacts = [],
  checkEvidence,
  changedPaths = [],
  effectiveProfile = null,
  summary = null,
  harnessAttestations = [],
  harnessId = null,
  protectedAttestationHash = null,
  enforceHarnessAttestations = true,
  workspaceBinding = null,
  workspaceSnapshotHash = null,
  forcedStatus = null,
  allowManualScopeDrift = false,
  seal = false,
  pluginRoot,
}) {
  const normalized = normalizeArtifacts(rootPlanText, artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 6) throw new Error(`closeout Root is invalid: ${contract.errors.join("; ")}`);
  const prior = inspectArtifactSet(normalized.entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (prior.errors.length > 0) throw new Error(`closeout input chain is invalid: ${prior.errors.join("; ")}`);
  const tips = effectiveCliSummary(prior);
  const evidenceTipId = tips.evidence_tips[normalized.rootId] ?? null;
  const reviewTipId = tips.review_tips[normalized.rootId] ?? null;
  const review = reviewTipId ? prior.effective.get(reviewTipId) : null;
  const correction = evidenceTipId
    && review?.fields?.latest_evidence_id === evidenceTipId
    && review?.fields?.next_action === "correct"
    && review?.correction
    ? review.correction
    : null;

  if (seal) {
    if (!evidenceTipId || !review || review.fields.latest_evidence_id !== evidenceTipId) {
      throw new Error("protected sealing requires one exact current provisional Evidence/Review tip");
    }
    if (review.fields.delivery_status !== "provisional"
      || review.fields.next_action !== "accept-provisional"
      || review.fields.correction_id
      || (review.findings ?? []).length > 0) {
      throw new Error(`protected sealing rejects non-provisional Review tip ${review.fields.id}`);
    }
  } else if (evidenceTipId && !correction) {
    const existing = normalized.entries.find((entry) => entry.label === evidenceTipId);
    if ((checkEvidence ?? []).length > 0 || (changedPaths ?? []).length > 0) {
      throw new Error(`stale or competing closeout conflicts with current Evidence tip ${evidenceTipId}`);
    }
    const fields = prior.effective.get(evidenceTipId)?.fields ?? null;
    return {
      duplicate: true,
      artifact: existing?.text ?? null,
      artifact_hash: existing ? sha256(existing.text) : null,
      fields,
      ...harnessConstraintProjection({ checks: contract.checks, evidence: fields?.check_evidence ?? [] }),
    };
  }

  const planned = requiredChecks(contract, correction);
  let entries = normalizeEvidence(checkEvidence, planned);
  const rootHash = sha256(rootPlanText);
  const effectiveWorkspaceBinding = workspaceBinding ?? harnessContractHash({ workspace: "not-established" });
  const effectiveSnapshotHash = workspaceSnapshotHash ?? harnessContractHash({ snapshot: "not-attested" });
  if (enforceHarnessAttestations) {
    entries = calibrateHarnessCheckEvidence({
      entries,
      plannedChecks: planned,
      attestations: harnessAttestations,
      rootHash,
      workspaceBinding: effectiveWorkspaceBinding,
      workspaceSnapshotHash: effectiveSnapshotHash,
      expectedHarnessId: harnessId,
      protectedAttestationHash,
    });
  }

  const grade = aggregate(entries);
  if (forcedStatus != null && forcedStatus !== "blocked") throw new Error("closeout forcedStatus may only add a blocked boundary");
  const status = forcedStatus ?? artifactStatus(grade);
  if (seal && (grade !== "verified" || status !== "complete" || entries.some((entry) => entry.grade !== "verified"))) {
    const error = new Error("protected sealing requires fresh verified evidence for every required Check");
    error.code = "protected-seal-not-verified";
    throw error;
  }
  const subjectId = correction ? review.fields.correction_id : normalized.rootId;
  const sourceReviewId = correction || seal ? review.fields.id : null;
  const predecessorEvidenceId = correction || seal ? evidenceTipId : null;
  const paths = unique((changedPaths ?? []).map(String).map((path) => path.trim()).filter(Boolean)).sort();
  if (!allowManualScopeDrift) {
    const authority = classifyChangedPathAuthority(contract.fields, paths);
    if (authority.status !== "within-authority") {
      const rejected = [
        ...authority.outside_allowed_paths,
        ...authority.approval_required_paths,
        ...authority.protected_paths,
      ];
      throw new Error(`changed paths are outside Root authority: ${rejected.join(", ")}`);
    }
  }
  const affectedObjectives = [...contract.objectives];
  const seed = sha256(JSON.stringify(stable({
    root_projection_hash: contract.authoritative_projection_hash,
    subject_id: subjectId,
    source_review_id: sourceReviewId,
    predecessor_evidence_id: predecessorEvidenceId,
    workspace_snapshot_hash: effectiveSnapshotHash,
    changed_paths: paths,
    check_evidence: entries,
    forced_status: forcedStatus,
    summary: summary ?? null,
  })));
  const id = `de-${subjectId.replace(/^(?:wp|cp)-/, "")}-${seed.slice(0, 12)}`;
  const mode = effectiveProfile === "manual" && contract.fields.risk !== "high" && (contract.fields.hard_triggers ?? []).length === 0 ? "lean" : "full";
  const fields = {
    artifact: "delivery-evidence",
    schema: 6,
    id,
    status,
    root_plan_id: normalized.rootId,
    subject_id: subjectId,
    source_review_id: sourceReviewId,
    predecessor_evidence_id: predecessorEvidenceId,
    representation: correction ? "delta" : seal ? "seal" : "full",
    intent_hash: contract.authoritative_projection_hash,
    evidence_mode: mode,
    overall_grade: grade,
    workspace_snapshot_hash: effectiveSnapshotHash,
    changed_paths: paths,
    affected_objectives: affectedObjectives,
    reused_objectives: [],
    executed_checks: entries.map((entry) => entry.check_id),
    reused_checks: [],
    check_evidence: entries,
  };
  const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n## Summary\n\n${summaryText(summary, status, grade, entries)}\n`;
  const final = inspectArtifactSet([...normalized.entries, { label: id, text: artifact }].map((entry) => [entry.label, entry.text]), pluginRoot);
  if (final.errors.length > 0) throw new Error(`generated delivery evidence is invalid: ${final.errors.join("; ")}`);
  return {
    duplicate: false,
    artifact,
    artifact_hash: sha256(artifact),
    fields,
    evidence_mode: mode,
    overall_grade: grade,
    status,
    ...harnessConstraintProjection({ checks: contract.checks, evidence: entries }),
  };
}

export function persistCloseout({ handoffStore, rootPlanText, artifacts = [], closeout }) {
  if (!closeout?.artifact || !closeout?.fields?.id) throw new Error("persistCloseout requires a generated delivery artifact");
  const byId = new Map();
  for (const entry of [{ label: "root", text: rootPlanText }, ...artifacts, { label: closeout.fields.id, text: closeout.artifact }]) {
    const inspected = inspectArtifactText(entry.text, handoffStore.pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`closeout persistence input is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const prior = byId.get(id);
    if (prior && prior !== entry.text) throw new Error(`closeout persistence artifact ${id} has conflicting text`);
    byId.set(id, entry.text);
  }
  try {
    const persisted = handoffStore.record([...byId].map(([label, text]) => ({ label, text })));
    return { ...closeout, handoff_persisted: true, handoff_authoritative: false, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return {
      ...closeout,
      handoff_persisted: false,
      handoff_authoritative: false,
      handoff_error_code: "handoff-persist-failed",
      warning: `optional cross-task handoff unavailable: ${error.message}; task-local continuation remains valid`,
    };
  }
}
