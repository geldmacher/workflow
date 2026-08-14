import { createHash } from "node:crypto";
import { stringify } from "yaml";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import {
  calibrateManualCheckEvidence,
  manualConstraintProjection,
} from "../core/manual-check-receipts.mjs";
import { aggregateEvidence } from "./strategy.mjs";

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

function cell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
  return text || "none";
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell(row[header])).join(" | ")} |`),
  ].join("\n");
}

function normalizeArtifacts(rootPlanText, artifacts, pluginRoot) {
  const rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan") {
    throw new Error(`closeout Root is invalid: ${(rootInspection.errors.length > 0 ? rootInspection.errors : ["input is not a work-plan"]).join("; ")}`);
  }
  const rootId = rootInspection.artifact.fields.id;
  const byId = new Map([[rootId, { label: rootId, text: rootPlanText }]]);
  for (const [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.label !== "string" || !entry.label.trim() || typeof entry.text !== "string" || !entry.text.trim()) {
      throw new Error(`closeout artifact ${index + 1} requires non-empty label and text`);
    }
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`closeout artifact ${entry.label} is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`closeout artifact ${id} has conflicting text`);
    byId.set(id, { label: id, text: entry.text });
  }
  return { rootId, entries: [...byId.values()] };
}

function expectedCheckMap(contract, correction, unresolvedRootChecks = new Map()) {
  const checks = correction?.checks?.filter((check) => check.Required === "yes") ?? contract.checks.filter((check) => check.Required === "yes");
  return new Map([
    ...checks.map((check) => [check["Check ID"], check]),
    ...unresolvedRootChecks,
  ]);
}

function rootCheckMap(contract) {
  return new Map(contract.checks.filter((check) => check.Required === "yes").map((check) => [check["Check ID"], check]));
}

function correctionRootChecks(correction) {
  return new Set((correction?.fixes ?? []).flatMap((fix) => String(fix["Root Checks"] ?? "").match(/CHECK-[1-9][0-9]*/g) ?? []));
}

function repositoryPaths(value) {
  return unique(String(value ?? "")
    .split(/(?:,|<br>)/i)
    .map((entry) => entry.trim().replace(/^\.\//, "").replace(/\/$/, ""))
    .filter((entry) => entry
      && !/^(?:none|n\/a|repository root)$/i.test(entry)
      && !/^(?:CHECK|OBJ|FIX|STEP)-[1-9][0-9]*$/i.test(entry)
      && /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(entry)));
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function fingerprintMap(value) {
  const result = new Map();
  for (const entry of String(value ?? "").split(/;\s*/)) {
    const equals = entry.indexOf("=");
    if (equals <= 0) continue;
    const path = entry.slice(0, equals).trim().replace(/^`|`$/g, "").replace(/^\.\//, "");
    if (!path || ["index", "status"].includes(path)) continue;
    result.set(path, entry.slice(equals + 1));
  }
  return result;
}

function correctionTargets(correction) {
  return unique((correction?.steps ?? []).flatMap((step) => repositoryPaths(step.Targets)));
}

function rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths = []) {
  const effectiveChecks = predecessorEvidence?.effective?.checks;
  const explicitlyAffected = correctionRootChecks(correction);
  const affectedObjectives = new Set(correctionObjectives(correction));
  const affectedPaths = unique([
    ...changedPaths.flatMap(repositoryPaths),
    ...correctionTargets(correction),
  ]);
  const previousFingerprints = predecessorEvidence?.effective?.snapshot?.["Relevant fingerprints"] ?? null;
  const currentFingerprints = repositorySnapshot?.relevant_fingerprints ?? null;
  const previousByPath = fingerprintMap(previousFingerprints);
  const currentByPath = fingerprintMap(currentFingerprints);
  const stalePaths = unique([...previousByPath.keys(), ...currentByPath.keys()])
    .filter((path) => previousByPath.get(path) !== currentByPath.get(path));
  const opaqueFingerprintChange = Boolean(
    previousFingerprints
    && currentFingerprints
    && previousFingerprints !== currentFingerprints
    && previousByPath.size === 0
    && currentByPath.size === 0,
  );
  return new Map([...rootCheckMap(contract)].filter(([checkId, check]) => {
    const prior = effectiveChecks?.get(checkId);
    const prerequisites = repositoryPaths(check.Prerequisites);
    const objectiveAffected = checkObjectives(check).some((objective) => affectedObjectives.has(objective));
    const pathAffected = prerequisites.some((prerequisite) => affectedPaths.some((path) => pathsOverlap(prerequisite, path)));
    const fingerprintStale = prerequisites.some((prerequisite) => stalePaths.some((path) => pathsOverlap(prerequisite, path)));
    const ambiguousImpact = affectedPaths.length > 0 && prerequisites.length === 0;
    return !prior
      || ["failed", "blocked"].includes(prior.status)
      || explicitlyAffected.has(checkId)
      || objectiveAffected
      || pathAffected
      || fingerprintStale
      || opaqueFingerprintChange
      || ambiguousImpact;
  }));
}

function inheritedCheckEvidence(inspection, predecessorEvidence, checkIds) {
  return checkIds.map((checkId) => {
    const effective = predecessorEvidence?.effective?.checks?.get(checkId);
    const source = effective?.source ? inspection.effective.get(effective.source) : null;
    const exact = source?.fields?.check_evidence?.find((entry) => entry.check_id === checkId);
    if (exact) return exact;
    return {
      check_id: checkId,
      grade: effective?.status === "passed" ? "verified" : effective?.status === "failed" ? "failed" : "supported",
      limitations: effective?.status === "passed" ? [] : ["Reused predecessor proof retains its prior non-verified grade."],
    };
  });
}

function normalizeCheckEvidence(input, plannedChecks, rootChecks, evidenceMode, {
  enforceManualCheckReceipts = false,
  manualCheckReceipts = [],
  existingCheckEvidence = [],
} = {}) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("closeout requires structured Check evidence");
  const ids = input.map((entry) => entry?.check_id);
  if (new Set(ids).size !== ids.length) throw new Error("closeout Check evidence IDs must be unique");
  for (const id of plannedChecks.keys()) if (!ids.includes(id)) throw new Error(`closeout is missing required Check ${id}`);
  const known = new Map([...rootChecks, ...plannedChecks]);
  const normalized = input.map((entry) => {
    const planned = known.get(entry?.check_id);
    if (!planned) throw new Error(`closeout received unknown Check ${entry?.check_id}`);
    if (!new Set(["verified", "supported", "partial", "unavailable", "failed"]).has(entry.grade)) throw new Error(`closeout Check ${entry.check_id} has invalid grade`);
    const limitations = unique(Array.isArray(entry.limitations) ? entry.limitations.map(String).filter(Boolean) : []);
    const repetitions = Number.isInteger(entry.repetitions) && entry.repetitions >= 0 ? entry.repetitions : 0;
    if (entry.grade === "verified" && repetitions < 1) throw new Error(`verified Check ${entry.check_id} requires at least one repetition`);
    if (entry.grade === "unavailable" && limitations.length === 0) throw new Error(`unavailable Check ${entry.check_id} requires a concrete limitation`);
    const normalized = {
      check_id: entry.check_id,
      feature_id: entry.feature_id ?? null,
      grade: entry.grade,
      surface: entry.surface ?? "repository",
      method: entry.method ?? planned["Command or Inspection"] ?? "inspection",
      baseline_or_patched: "patched",
      expected: entry.expected ?? planned["Expected Result"] ?? "required Check succeeds",
      observed: String(entry.observed ?? "not fully observed"),
      repetitions,
      artifact_hashes: unique((entry.artifact_hashes ?? []).filter((value) => /^[a-f0-9]{64}$/.test(String(value)))),
      limitations,
    };
    return normalized;
  });
  const calibrated = enforceManualCheckReceipts
    ? calibrateManualCheckEvidence({
      entries: normalized,
      plannedChecks: known,
      receipts: manualCheckReceipts,
      existingCheckEvidence,
    })
    : normalized;
  return calibrated.map((entry) => {
    const value = { ...entry };
    if (evidenceMode === "lean") {
      if (!value.surface && value.grade === "verified") throw new Error(`verified Check ${entry.check_id} requires a surface`);
      delete value.baseline_or_patched;
      if ((value.artifact_hashes ?? []).length === 0) delete value.artifact_hashes;
      if (!value.feature_id) delete value.feature_id;
    }
    return value;
  });
}

function overallGrade(entries) {
  return aggregateEvidence(entries).grade;
}

function artifactStatus(grade) {
  if (grade === "failed") return "blocked";
  return grade === "verified" ? "complete" : "provisional";
}

function correctionObjectives(correction) {
  return unique((correction?.fixes ?? []).flatMap((fix) => String(fix["Root Objectives"] ?? "").match(/OBJ-[1-9][0-9]*/g) ?? []));
}

function checkObjectives(check) {
  return String(check?.Objectives ?? "").match(/OBJ-[1-9][0-9]*/g) ?? [];
}

function objectiveState(objective, entries, rootChecks, aggregate) {
  const related = entries.filter((entry) => checkObjectives(rootChecks.get(entry.check_id)).includes(objective));
  const grades = (related.length > 0 ? related : entries).map((entry) => entry.grade);
  if (grades.includes("failed")) return "blocked";
  if (grades.length > 0 && grades.every((grade) => grade === "verified")) return "achieved";
  return aggregate === "failed" ? "blocked" : "partially-achieved";
}

function evidenceMode(fields, effectiveProfile) {
  return effectiveProfile === "manual" && fields.profile_max === "manual" && fields.risk !== "high" && (fields.hard_triggers ?? []).length === 0 ? "lean" : "full";
}

function evidenceSeed({ contract, subjectId, sourceReviewId, predecessorEvidenceId, strategyRevision, mode, paths, entries, repositorySnapshot, summary }) {
  return sha256(JSON.stringify(stable({
    root: contract.authoritative_projection_hash,
    subjectId,
    sourceReviewId,
    predecessorEvidenceId,
    strategyRevision,
    mode,
    paths,
    entries,
    repositorySnapshot: repositorySnapshot ?? null,
    summary: summary ?? null,
  })));
}

function summaryText(summary, status, grade) {
  const supplied = String(summary ?? "").trim();
  if (supplied) return supplied;
  if (status === "blocked") return `BLOCKER: required delivery verification failed; aggregate evidence grade is ${grade}.`;
  if (status === "provisional") return `Delivery is provisional with aggregate evidence grade ${grade}; limitations remain explicit.`;
  return "The authorized repository delivery is complete and every required Check is verified.";
}

function fullBody({ fields, contract, entries, changedPaths, correction, repositorySnapshot, summary }) {
  const aggregate = fields.overall_grade;
  const outcomes = fields.affected_objectives.map((objective) => ({
    "Objective ID": objective,
    Status: objectiveState(objective, entries, rootCheckMap(contract), aggregate),
    Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", "),
  }));
  const sections = [`## Summary\n\n${summary}`];
  if (correction) {
    const state = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
    sections.push(`## Subject results\n\n${table(["Objective ID", "Result", "Evidence"], correction.fixes.map((fix) => ({
      "Objective ID": fix["FIX ID"], Result: state, Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", "),
    })))}`);
  }
  sections.push(`## Objective outcomes\n\n${table(["Objective ID", "Status", "Evidence"], outcomes)}`);
  const coverageIds = correction
    ? unique((correction.fixes ?? []).map((fix) => fix["FIX ID"]).filter(Boolean))
    : fields.affected_objectives;
  sections.push(changedPaths.length > 0
    ? `## Changes\n\n${table(["Path or Symbol", "Change", "Objective Coverage"], changedPaths.map((path) => ({
      "Path or Symbol": path, Change: "Declared by deterministic closeout", "Objective Coverage": coverageIds.join(", "),
    })))}`
    : "## Changes\n\nNone.");
  const snapshot = repositorySnapshot ?? {};
  sections.push(`## Repository snapshot\n\n${table(["Snapshot ID", "HEAD", "Working tree", "Changed paths", "Relevant fingerprints", "Known failures"], [{
    "Snapshot ID": `SNAP-${fields.id.slice(3)}`,
    HEAD: snapshot.head ?? "unknown",
    "Working tree": snapshot.working_tree ?? (changedPaths.length > 0 ? "modified" : "unchanged"),
    "Changed paths": changedPaths.join(", ") || "none",
    "Relevant fingerprints": snapshot.relevant_fingerprints ?? "none",
    "Known failures": snapshot.known_failures ?? (fields.status === "blocked" ? "required Check failed" : "none"),
  }])}`);
  sections.push(`## Checks\n\n${table(["Check ID", "Observed Result", "Status", "Prerequisite fingerprints"], entries.map((entry) => ({
    "Check ID": entry.check_id,
    "Observed Result": entry.observed,
    Status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "skipped",
    "Prerequisite fingerprints": snapshot.relevant_fingerprints ?? "none",
  })))}`);
  sections.push("## Deviations\n\nNone.");
  sections.push("## Operational evidence\n\nNot applicable.");
  const limitations = unique(entries.flatMap((entry) => entry.limitations ?? []));
  sections.push(`## Limitations\n\n${limitations.length > 0 ? limitations.map((item) => `- ${item}`).join("\n") : "None."}`);
  return sections.join("\n\n");
}

export function buildDeliveryEvidence({
  rootPlanText,
  artifacts = [],
  checkEvidence,
  changedPaths = [],
  strategyRevision = 0,
  effectiveProfile = null,
  repositorySnapshot = null,
  summary = null,
  manualCheckReceipts = [],
  enforceManualCheckReceipts = null,
  pluginRoot,
}) {
  const normalized = normalizeArtifacts(rootPlanText, artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 5) throw new Error(`closeout requires a valid Schema-5 Root: ${contract.errors.join("; ")}`);
  const priorInspection = inspectArtifactSet(normalized.entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (priorInspection.errors.length > 0) throw new Error(`closeout input chain is invalid: ${priorInspection.errors.join("; ")}`);
  const tips = effectiveCliSummary(priorInspection);
  const evidenceTipId = tips.evidence_tips[normalized.rootId] ?? null;
  const reviewTipId = tips.review_tips[normalized.rootId] ?? null;
  const review = reviewTipId ? priorInspection.effective.get(reviewTipId) : null;
  let correction = null;
  let subjectId = normalized.rootId;
  let sourceReviewId = null;
  let predecessorEvidenceId = null;
  let representation = "full";
  const mode = evidenceMode(contract.fields, effectiveProfile ?? contract.fields.profile_max);
  const requireManualReceipts = enforceManualCheckReceipts ?? (effectiveProfile ?? contract.fields.profile_max) === "manual";
  const effectiveStrategyRevision = mode === "full" ? strategyRevision : 0;
  const effectiveRepositorySnapshot = mode === "full" ? repositorySnapshot : null;
  if (evidenceTipId) {
    if (!review || review.fields.latest_evidence_id !== evidenceTipId || review.fields.next_action !== "correct" || !review.fields.correction_id || !review.correction) {
      const existing = normalized.entries.find((entry) => inspectArtifactText(entry.text, pluginRoot).artifact?.fields?.id === evidenceTipId);
      const existingFields = priorInspection.effective.get(evidenceTipId)?.fields ?? null;
      if ((checkEvidence ?? []).length > 0 || changedPaths.length > 0) {
        const entries = normalizeCheckEvidence(checkEvidence, expectedCheckMap(contract, null), rootCheckMap(contract), mode, {
          enforceManualCheckReceipts: requireManualReceipts,
          manualCheckReceipts,
          existingCheckEvidence: existingFields?.check_evidence ?? [],
        });
        const suppliedPaths = unique(changedPaths.map(String).map((path) => path.trim()).filter(Boolean)).sort();
        const expectedSeed = evidenceSeed({
          contract,
          subjectId: normalized.rootId,
          sourceReviewId: null,
          predecessorEvidenceId: null,
          strategyRevision: effectiveStrategyRevision,
          mode,
          paths: suppliedPaths,
          entries,
          repositorySnapshot: effectiveRepositorySnapshot,
          summary,
        });
        const expectedId = `de-${normalized.rootId.replace(/^wp-/, "")}-${expectedSeed.slice(0, 12)}`;
        const sameInputs = JSON.stringify(stable(entries)) === JSON.stringify(stable(existingFields?.check_evidence ?? []))
          && JSON.stringify(suppliedPaths) === JSON.stringify(existingFields?.changed_paths ?? [])
          && (mode === "lean" || (existingFields?.strategy_revision ?? 0) === effectiveStrategyRevision)
          && expectedId === evidenceTipId;
        if (!sameInputs) throw new Error(`stale or competing closeout conflicts with current Evidence tip ${evidenceTipId}`);
      }
      const projection = manualConstraintProjection({ checks: contract.checks, evidence: existingFields?.check_evidence ?? [] });
      const unattested = projection.constraint_summary.legacy_unattested_verified_checks ?? [];
      if (unattested.length > 0) {
        throw new Error(`existing Evidence tip ${evidenceTipId} has receiptless verified machine Checks (${unattested.join(", ")}); run a fresh review and refresh them through its bounded correction route`);
      }
      return {
        duplicate: true,
        artifact: existing?.text ?? null,
        artifact_hash: existing ? sha256(existing.text) : null,
        fields: existingFields,
        ...projection,
      };
    }
    correction = review.correction;
    subjectId = review.fields.correction_id;
    sourceReviewId = review.fields.id;
    predecessorEvidenceId = evidenceTipId;
    representation = "delta";
  }
  if (mode === "full" && (!repositorySnapshot?.head || !repositorySnapshot?.relevant_fingerprints)) {
    throw new Error("full closeout requires repository snapshot HEAD and relevant fingerprints");
  }
  const roots = rootCheckMap(contract);
  const predecessorEvidence = correction ? priorInspection.effective.get(evidenceTipId) : null;
  const unresolvedRootChecks = correction
    ? rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths)
    : new Map();
  const suppliedCheckIds = new Set((checkEvidence ?? []).map((entry) => entry?.check_id));
  const missingRootRefresh = [...unresolvedRootChecks.keys()].filter((checkId) => !suppliedCheckIds.has(checkId));
  if (missingRootRefresh.length > 0) {
    throw new Error(`correction closeout requires fresh evidence for affected, failed, missing, stale, or ambiguous Root Checks: ${missingRootRefresh.join(", ")}`);
  }
  const plannedChecks = expectedCheckMap(contract, correction, unresolvedRootChecks);
  const entries = normalizeCheckEvidence(checkEvidence, plannedChecks, roots, mode, {
    enforceManualCheckReceipts: requireManualReceipts,
    manualCheckReceipts,
  });
  const rootObjectives = contract.objectives;
  const affectedObjectives = correction
    ? unique([...correctionObjectives(correction), ...entries.flatMap((entry) => checkObjectives(roots.get(entry.check_id)))])
    : [...rootObjectives];
  const affected = affectedObjectives.length > 0 ? affectedObjectives : [...rootObjectives];
  const reusedObjectives = representation === "delta" ? rootObjectives.filter((id) => !affected.includes(id)) : [];
  const executedChecks = entries.map((entry) => entry.check_id);
  const reusedChecks = representation === "delta" ? [...roots.keys()].filter((id) => !executedChecks.includes(id)) : [];
  const reusedEvidence = representation === "delta"
    ? inheritedCheckEvidence(priorInspection, predecessorEvidence, reusedChecks)
    : [];
  const effectiveEntries = [...entries, ...reusedEvidence];
  const grade = overallGrade(effectiveEntries);
  const status = artifactStatus(grade);
  const paths = unique(changedPaths.map(String).map((path) => path.trim()).filter(Boolean)).sort();
  const seed = evidenceSeed({
    contract,
    subjectId,
    sourceReviewId,
    predecessorEvidenceId,
    strategyRevision: effectiveStrategyRevision,
    mode,
    paths,
    entries,
    repositorySnapshot: effectiveRepositorySnapshot,
    summary,
  });
  const id = `de-${subjectId.replace(/^(?:wp|cp)-/, "")}-${seed.slice(0, 12)}`;
  const fields = {
    artifact: "delivery-evidence",
    schema: 5,
    id,
    status,
    root_plan_id: normalized.rootId,
    subject_id: subjectId,
    source_review_id: sourceReviewId,
    predecessor_evidence_id: predecessorEvidenceId,
    representation,
    intent_hash: contract.authoritative_projection_hash,
    ...(mode === "full" ? { strategy_revision: effectiveStrategyRevision } : {}),
    evidence_mode: mode,
    overall_grade: grade,
    changed_paths: paths,
    affected_objectives: affected,
    reused_objectives: reusedObjectives,
    executed_checks: executedChecks,
    reused_checks: reusedChecks,
    check_evidence: entries,
  };
  const renderedSummary = summaryText(summary, status, grade);
  const body = mode === "lean"
    ? `## Summary\n\n${renderedSummary}`
    : fullBody({ fields, contract, entries, changedPaths: paths, correction, repositorySnapshot, summary: renderedSummary });
  const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${body}\n`;
  const finalEntries = [...normalized.entries, { label: id, text: artifact }];
  const inspection = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (inspection.errors.length > 0) throw new Error(`generated delivery evidence is invalid: ${inspection.errors.join("; ")}`);
  const projection = manualConstraintProjection({ checks: contract.checks, evidence: effectiveEntries });
  return {
    duplicate: false,
    artifact,
    artifact_hash: sha256(artifact),
    fields,
    evidence_mode: mode,
    overall_grade: grade,
    status,
    ...projection,
  };
}

export function persistCloseout({ handoffStore, rootPlanText, artifacts = [], closeout }) {
  if (!closeout?.artifact || !closeout?.fields?.id) throw new Error("persistCloseout requires a generated delivery artifact");
  const entries = [{ label: "root", text: rootPlanText }, ...artifacts, { label: closeout.fields.id, text: closeout.artifact }];
  const byId = new Map();
  for (const entry of entries) {
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
