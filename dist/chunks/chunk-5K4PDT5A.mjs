#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  auditVerificationProfile,
  configurationHashes,
  expectedPlannerReceiptBlockers,
  plannerReceiptBlockers,
  planningBudgetBlockers,
  planningHarnessHash,
  planningUsage,
  resolveCapabilities,
  validateRootPlanLineage
} from "./chunk-MGG4F5J6.mjs";
import {
  assertContainedPath,
  changedPaths,
  changedPathsBetween,
  checkpoint,
  createComparisonBaselineWorktree,
  createRunWorktree,
  detectDependencyChanges,
  parseHostCommand,
  repositoryBaseline,
  rollbackToCheckpoint,
  runHostCheck,
  workspaceDeliveryMatch
} from "./chunk-JXD44M5H.mjs";
import {
  CursorWorkerAdapter,
  evaluateAuthorization,
  evaluateEligibility,
  qualificationKey,
  selectWriterRoute
} from "./chunk-2YTKS64M.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot
} from "./chunk-OYSBJH5W.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText
} from "./chunk-WNGW7KKK.mjs";
import {
  repositoryKey,
  require_dist,
  rootContentHash,
  sharedArtifactStateRoot
} from "./chunk-QOWQ6ETR.mjs";
import {
  ARTIFACT_SCHEMA,
  RUN_EVENT_SUBJECT_SCHEMA,
  assertCompatiblePreparation,
  classifyPreparationCompatibility,
  classifyRunCompatibility,
  runEventSubject
} from "./chunk-LFEO5XYI.mjs";
import {
  __toESM
} from "./chunk-IQRLCJ3K.mjs";

// src/controller/learning-context.mjs
import { createHash as createHash2 } from "node:crypto";

// src/controller/strategy.mjs
import { createHash } from "node:crypto";
var TASK_RECIPES = Object.freeze({
  bugfix: Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: true, comparison: "same-surface" }),
  refactor: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "characterization-or-equivalence" }),
  performance: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "baseline-and-post-trace" }),
  feature: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: true, comparison: "acceptance-and-regression" }),
  investigation: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 0, writer_allowed: false, comparison: "read-only-findings" }),
  "verify-existing": Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: false, comparison: "same-input-candidate-comparison" })
});
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function strategyHash(strategy) {
  return createHash("sha256").update(JSON.stringify(stable(strategy))).digest("hex");
}
function inferTaskClass(goal) {
  const source = String(goal ?? "").toLowerCase();
  if (/verify|validate|existing (?:fix|commit|change)|bestehenden? (?:fix|commit|änderung)/.test(source)) return "verify-existing";
  if (/performance|latency|throughput|profil|trace|slow|langsam/.test(source)) return "performance";
  if (/refactor|restructure|cleanup|vereinfach|umbau/.test(source)) return "refactor";
  if (/investigat|diagnos|analyse|explain|ursache finden/.test(source)) return "investigation";
  if (/bug|fix|defect|fehler|regression|crash/.test(source)) return "bugfix";
  return "feature";
}
function createInitialStrategy(contract) {
  const seed = structuredClone(contract.strategy ?? {});
  const taskClass = TASK_RECIPES[seed.task_class] ? seed.task_class : inferTaskClass(contract.fields.goal);
  const value = {
    strategy_schema: 1,
    strategy_id: seed.strategy_id ?? `strategy-${contract.fields.id.slice(3)}`,
    revision: 0,
    parent_hash: null,
    root_projection_hash: contract.authoritative_projection_hash,
    task_class: taskClass,
    recipe_version: TASK_RECIPES[taskClass].version,
    primary_targets: seed.primary_targets ?? [...contract.allowedTargets],
    steps: seed.steps ?? contract.slices,
    checks: seed.checks ?? contract.checks,
    evidence_requirements: seed.evidence_requirements ?? (contract.fields.profile_max === "autonomous" ? "verified" : "provisional-allowed"),
    deviations: [],
    rationale: seed.rationale ?? "initial strategy derived from the approved intent root",
    created_by: seed.created_by ?? "planner"
  };
  return { ...value, strategy_hash: strategyHash(value) };
}
function inside(path, roots) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}
function reviseStrategy(current, patch, { reason, createdBy, authority }) {
  const nextTargets = patch.primary_targets ?? current.primary_targets;
  for (const target of nextTargets) if (!inside(target, authority.allowed_roots ?? [])) throw new Error(`strategy target escapes authority: ${target}`);
  if (patch.task_class && !TASK_RECIPES[patch.task_class]) throw new Error(`unknown task recipe: ${patch.task_class}`);
  const baseHash = current.strategy_hash ?? strategyHash(Object.fromEntries(Object.entries(current).filter(([key]) => key !== "strategy_hash")));
  const taskClass = patch.task_class ?? current.task_class;
  const next = {
    ...structuredClone(current),
    ...structuredClone(patch),
    revision: current.revision + 1,
    parent_hash: baseHash,
    task_class: taskClass,
    recipe_version: TASK_RECIPES[taskClass].version,
    rationale: reason,
    created_by: createdBy,
    deviations: [...current.deviations ?? [], ...patch.deviations ?? []]
  };
  delete next.strategy_hash;
  return { ...next, strategy_hash: strategyHash(next) };
}
function evidenceGrade(receipt) {
  if (receipt?.passed === true) return "verified";
  if (receipt?.passed === false) return "failed";
  if (receipt?.supported === true) return "supported";
  if (receipt?.unavailable === true) return "unavailable";
  return "partial";
}
function aggregateEvidence(entries) {
  const grades = entries.map((entry) => entry.grade);
  if (grades.includes("failed")) return { grade: "failed", delivery: "blocked" };
  if (entries.length > 0 && grades.every((grade) => grade === "verified")) return { grade: "verified", delivery: "verified" };
  if (grades.includes("unavailable")) return { grade: "unavailable", delivery: "provisional" };
  if (grades.includes("partial")) return { grade: "partial", delivery: "provisional" };
  return { grade: "supported", delivery: "provisional" };
}
function checkEvidence(check, receipt, baselineOrPatched = "patched") {
  return {
    check_id: check["Check ID"],
    feature_id: null,
    grade: evidenceGrade(receipt),
    surface: receipt?.surface ?? "repository",
    method: Array.isArray(receipt?.command) ? receipt.command.join(" ") : receipt?.method ?? check["Command or Inspection"] ?? "verification-profile",
    baseline_or_patched: baselineOrPatched,
    expected: check["Expected Result"] ?? "",
    observed: receipt?.passed === true ? "passed" : receipt?.passed === false ? receipt.error ?? receipt.stderr ?? "failed" : receipt?.reason ?? "not fully observed",
    repetitions: receipt?.repetitions ?? (receipt?.passed === true || receipt?.passed === false ? 1 : 0),
    artifact_hashes: receipt?.artifact_hashes ?? [],
    limitations: receipt?.limitations ?? (receipt?.unavailable ? [receipt.reason ?? "verification unavailable"] : [])
  };
}
function calibrateRecipeEvidence(taskClass, entries, stage, baselineEntries = []) {
  const recipe = TASK_RECIPES[taskClass];
  if (!recipe) throw new Error(`unknown task recipe: ${taskClass}`);
  const minimum = stage === "baseline" ? recipe.baseline_repetitions : recipe.patched_repetitions;
  const baselineByCheck = new Map(baselineEntries.map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    const limitations = [...entry.limitations ?? []];
    let grade = entry.grade;
    if (grade === "verified" && entry.repetitions < minimum) {
      grade = "partial";
      limitations.push(`${taskClass} recipe requires ${minimum} ${stage} repetitions`);
    }
    if (stage === "patched" && ["bugfix", "performance", "verify-existing"].includes(taskClass)) {
      const baseline = baselineByCheck.get(entry.check_id);
      if (baseline && baseline.surface !== entry.surface) {
        if (grade === "verified") grade = "partial";
        limitations.push(`${taskClass} recipe requires comparable baseline and patched surfaces`);
      }
    }
    if (grade === "verified" && taskClass === "refactor" && !/(?:characterization|snapshot|equivalence)/i.test(`${entry.method} ${entry.observed}`)) {
      grade = "partial";
      limitations.push("refactor recipe requires characterization, snapshot, or equivalence evidence");
    }
    if (grade === "verified" && taskClass === "performance" && !/(?:benchmark|trace|latency|throughput|metric)/i.test(`${entry.method} ${entry.expected} ${entry.observed}`)) {
      grade = "partial";
      limitations.push("performance recipe requires an explicit comparable metric or trace");
    }
    return { ...entry, grade, limitations: [...new Set(limitations)] };
  });
}

// src/controller/learning-context.mjs
var learningIdPattern = /^LRN-[A-Za-z0-9][A-Za-z0-9-]*$/;
var findingKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var candidateKeys = /* @__PURE__ */ new Set(["finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"]);
var candidateLimit = 16;
function hash(value) {
  return createHash2("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => [key, canonicalValue(value[key])]));
}
function stableHash(value) {
  return hash(JSON.stringify(canonicalValue(value)));
}
function runIntegrityBlockers(run, pluginRoot) {
  const blockers = [];
  let root;
  try {
    root = executionContractFromArtifactText(run?.root_plan_text, pluginRoot);
  } catch (error) {
    return [`intent-root-unreadable:${error.message}`];
  }
  if (root.errors.length > 0) blockers.push("intent-root-invalid");
  if (root.raw_hash !== run.root_plan_hash) blockers.push("intent-root-content-hash-mismatch");
  if (root.authoritative_projection_hash !== run.root_authoritative_projection_hash || root.authoritative_projection_hash !== run.intent_hash) blockers.push("intent-root-projection-hash-mismatch");
  if (hash(root.fields) !== hash(run.plan?.fields)) blockers.push("intent-root-state-mismatch");
  if (run.strategy?.root_projection_hash !== run.intent_hash) blockers.push("strategy-root-projection-mismatch");
  if (run.strategy) {
    const { strategy_hash: declaredHash, ...projection } = run.strategy;
    if (strategyHash(projection) !== declaredHash) blockers.push("strategy-hash-mismatch");
  } else blockers.push("strategy-missing");
  return unique(blockers);
}
function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}
function boundedText(value, label, maximum = 4e3) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be non-empty text`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${label} exceeds ${maximum} characters`);
  return normalized;
}
function normalizedStringArray(value, label, { maximum = 32, pattern = null, itemMaximum = 1e3 } = {}) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  if (value.length > maximum) throw new Error(`${label} exceeds ${maximum} items`);
  const normalized = unique(value.map((entry) => boundedText(entry, label, itemMaximum)));
  if (normalized.length !== value.length) throw new Error(`${label} must contain unique items`);
  if (pattern && normalized.some((entry) => !pattern.test(entry))) throw new Error(`${label} contains an invalid item`);
  return normalized.toSorted();
}
function normalizedInteger(value, label, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer of at least ${minimum}`);
  return value;
}
function candidatePayload(candidate, label = "controller learning candidate") {
  return {
    finding_keys: normalizedStringArray(candidate?.finding_keys, `${label} finding_keys`, { pattern: findingKeyPattern }),
    reusable_guidance: boundedText(candidate?.reusable_guidance, `${label} reusable_guidance`, 2e3),
    candidate_targets: normalizedStringArray(candidate?.candidate_targets, `${label} candidate_targets`, { maximum: 16, itemMaximum: 500 }),
    confirmation_evidence: boundedText(candidate?.confirmation_evidence, `${label} confirmation_evidence`, 2e3)
  };
}
function candidateIdentity(runId, rootPlanId, candidate) {
  return stableHash({ run_id: runId, root_plan_id: rootPlanId, candidate: candidatePayload(candidate) });
}
function controllerLearningCandidateSemanticHash(candidate) {
  return stableHash(candidatePayload(candidate));
}
function controllerLearningDecisionHash(decision2, candidate) {
  return stableHash({
    assessment: decision2?.assessment ?? null,
    delivery_status: decision2?.delivery_status ?? null,
    next_action: decision2?.next_action ?? null,
    finding_keys: unique(decision2?.finding_keys).toSorted(),
    findings: decision2?.findings ?? [],
    learning_candidate: candidatePayload(candidate)
  });
}
function normalizeSourceBindings(candidate, decision2, receiptIds) {
  const supplied = Array.isArray(candidate?.source_bindings) ? candidate.source_bindings : null;
  const bindings = supplied ?? unique(receiptIds).map((receiptId) => ({
    source_receipt_id: receiptId,
    source_decision_hash: controllerLearningDecisionHash(decision2, candidate)
  }));
  if (bindings.length === 0 || bindings.length > 16) throw new Error("controller learning candidate requires bounded reviewer provenance");
  const normalized = bindings.map((binding) => ({
    source_receipt_id: boundedText(binding?.source_receipt_id, "controller learning source receipt", 500),
    source_decision_hash: boundedText(binding?.source_decision_hash, "controller learning source decision hash", 64)
  }));
  if (normalized.some((binding) => !/^[a-f0-9]{64}$/.test(binding.source_decision_hash))) throw new Error("controller learning source decision hash is invalid");
  return [...new Map(normalized.map((binding) => [stableHash(binding), binding])).values()].toSorted((left, right) => left.source_receipt_id.localeCompare(right.source_receipt_id) || left.source_decision_hash.localeCompare(right.source_decision_hash));
}
function normalizedLineageEntry(value) {
  return {
    correction_id: boundedText(value?.correction_id, "controller learning correction ID", 500),
    correction_cycle: normalizedInteger(value?.correction_cycle, "controller learning correction cycle", { minimum: 1 }),
    strategy_revision: normalizedInteger(value?.strategy_revision, "controller learning strategy revision"),
    source_bindings: normalizeSourceBindings({ source_bindings: value?.source_bindings }, null, [])
  };
}
function projectedControllerLearningCandidate(candidate) {
  const payload = candidatePayload(candidate);
  const sourceDecisionHash = boundedText(candidate?.source_decision_hash, "controller learning source decision hash", 64);
  if (!/^[a-f0-9]{64}$/.test(sourceDecisionHash)) throw new Error("controller learning source decision hash is invalid");
  const projected = {
    learning_id: boundedText(candidate?.learning_id, "controller learning ID", 500),
    source_kind: boundedText(candidate?.source_kind, "controller learning source kind", 100),
    run_id: boundedText(candidate?.run_id, "controller learning Run ID", 500),
    root_plan_id: boundedText(candidate?.root_plan_id, "controller learning Root ID", 500),
    candidate_hash: boundedText(candidate?.candidate_hash, "controller learning candidate hash", 64),
    correction_id: boundedText(candidate?.correction_id, "controller learning correction ID", 500),
    correction_cycle: normalizedInteger(candidate?.correction_cycle, "controller learning correction cycle", { minimum: 1 }),
    strategy_revision: normalizedInteger(candidate?.strategy_revision, "controller learning strategy revision"),
    ...payload,
    source_receipt_ids: normalizedStringArray(candidate?.source_receipt_ids, "controller learning source receipt IDs", { maximum: 16, itemMaximum: 500 }),
    source_decision_hash: sourceDecisionHash,
    lineage: (candidate?.lineage ?? []).map((entry) => normalizedLineageEntry(entry))
  };
  if (!learningIdPattern.test(projected.learning_id)) throw new Error("controller learning candidate has an invalid learning_id");
  if (projected.source_kind !== "controller-review") throw new Error("controller learning candidate has an invalid source kind");
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(projected.root_plan_id)) throw new Error("controller learning candidate has an invalid Root ID");
  if (!/^[a-f0-9]{64}$/.test(projected.candidate_hash)) throw new Error("controller learning candidate has an invalid candidate hash");
  if (!/^cp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(projected.correction_id)) throw new Error("controller learning candidate has an invalid correction ID");
  if (projected.lineage.length === 0) throw new Error(`controller learning candidate ${projected.learning_id} has no correction lineage`);
  return projected;
}
function normalizeDecisionLearningCandidates(value, findingKeys = [], nextAction = "none") {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("learning_candidates must be an array");
  if (value.length > candidateLimit) throw new Error(`learning_candidates exceeds ${candidateLimit} items`);
  if (nextAction !== "correct" && value.length > 0) throw new Error("learning_candidates are allowed only when next_action is correct");
  const allowedFindings = new Set(findingKeys);
  const normalized = value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error(`learning candidate ${index + 1} must be an object`);
    const unknown = Object.keys(candidate).filter((key) => !candidateKeys.has(key));
    if (unknown.length > 0) throw new Error(`learning candidate ${index + 1} has unknown fields: ${unknown.join(", ")}`);
    const candidateFindings = normalizedStringArray(candidate.finding_keys, `learning candidate ${index + 1} finding_keys`, { pattern: findingKeyPattern });
    if (candidateFindings.some((key) => !allowedFindings.has(key))) throw new Error(`learning candidate ${index + 1} references an unknown finding key`);
    const candidateTargets = normalizedStringArray(candidate.candidate_targets, `learning candidate ${index + 1} candidate_targets`, { maximum: 16, itemMaximum: 500 });
    if (candidateTargets.some((target) => target.startsWith("/") || target.split(/[\\/]/).includes(".."))) {
      throw new Error(`learning candidate ${index + 1} contains a non-project target`);
    }
    return {
      finding_keys: candidateFindings,
      reusable_guidance: boundedText(candidate.reusable_guidance, `learning candidate ${index + 1} reusable_guidance`, 2e3),
      candidate_targets: candidateTargets,
      confirmation_evidence: boundedText(candidate.confirmation_evidence, `learning candidate ${index + 1} confirmation_evidence`, 2e3)
    };
  });
  const seen = /* @__PURE__ */ new Set();
  return normalized.filter((candidate) => {
    const digest = hash(candidate);
    if (seen.has(digest)) return false;
    seen.add(digest);
    return true;
  });
}
function materializeControllerLearningCandidates({ run, decision: decision2, correctionCycle, receiptIds = [] }) {
  const proposed = decision2?.learning_candidates ?? [];
  if (decision2?.next_action !== "correct") return { correction_id: null, candidates: [] };
  const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("controller learning candidates require a valid Root ID");
  const rootSuffix = rootPlanId.replace(/^wp-/, "");
  const cycle = Number.isInteger(correctionCycle) && correctionCycle > 0 ? correctionCycle : 1;
  const correctionId = `cp-${rootSuffix}-controller-${cycle}`;
  const candidates = proposed.map((candidate) => {
    const payload = candidatePayload(candidate);
    const candidateHash = candidateIdentity(run.run_id, rootPlanId, payload);
    const sourceBindings = normalizeSourceBindings(candidate, decision2, receiptIds);
    const lineage = [{
      correction_id: correctionId,
      correction_cycle: cycle,
      strategy_revision: run.strategy?.revision ?? 0,
      source_bindings: sourceBindings
    }];
    return {
      learning_id: `LRN-${rootSuffix}-${candidateHash.slice(0, 12)}`,
      source_kind: "controller-review",
      run_id: run.run_id,
      root_plan_id: rootPlanId,
      candidate_hash: candidateHash,
      correction_id: correctionId,
      correction_cycle: cycle,
      strategy_revision: run.strategy?.revision ?? 0,
      ...payload,
      source_receipt_ids: sourceBindings.map((binding) => binding.source_receipt_id),
      source_decision_hash: sourceBindings[0].source_decision_hash,
      lineage
    };
  });
  return { correction_id: correctionId, candidates };
}
function mergeControllerLearningCandidates(existing = [], additions = []) {
  const merged = /* @__PURE__ */ new Map();
  for (const candidate of [...existing, ...additions]) {
    const normalizedCandidate = projectedControllerLearningCandidate(candidate);
    const payload = candidatePayload(normalizedCandidate);
    const candidateHash = candidateIdentity(normalizedCandidate.run_id, normalizedCandidate.root_plan_id, payload);
    const expectedId = `LRN-${String(normalizedCandidate.root_plan_id).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
    if (normalizedCandidate.candidate_hash !== candidateHash || normalizedCandidate.learning_id !== expectedId) throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent content identity`);
    const lineage = normalizedCandidate.lineage;
    const first = lineage[0];
    const receiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
    if (normalizedCandidate.correction_id !== first.correction_id || normalizedCandidate.correction_cycle !== first.correction_cycle || normalizedCandidate.strategy_revision !== first.strategy_revision || normalizedCandidate.source_decision_hash !== first.source_bindings[0]?.source_decision_hash || JSON.stringify(normalizedCandidate.source_receipt_ids) !== JSON.stringify(receiptIds)) {
      throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent correction provenance`);
    }
    const prior = merged.get(candidateHash);
    if (prior && stableHash(candidatePayload(prior)) !== stableHash(payload)) throw new Error(`controller learning candidate ${candidate.learning_id} conflicts with its prior record`);
    if (!prior) {
      merged.set(candidateHash, normalizedCandidate);
      continue;
    }
    const combinedLineage = [...new Map([...prior.lineage, ...lineage].map((entry) => [stableHash(entry), entry])).values()].toSorted((left, right) => left.correction_cycle - right.correction_cycle || left.correction_id.localeCompare(right.correction_id));
    const sourceReceiptIds = unique(combinedLineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
    const primary = combinedLineage[0];
    merged.set(candidateHash, {
      ...prior,
      correction_id: primary.correction_id,
      correction_cycle: primary.correction_cycle,
      strategy_revision: primary.strategy_revision,
      lineage: combinedLineage,
      source_receipt_ids: sourceReceiptIds,
      source_decision_hash: primary.source_bindings[0].source_decision_hash
    });
  }
  return [...merged.values()];
}
function controllerLearningEventRefs(candidates = []) {
  return candidates.flatMap((candidate) => (candidate.lineage ?? []).map((lineage) => ({
    learning_id: candidate.learning_id,
    candidate_hash: candidate.candidate_hash,
    run_id: candidate.run_id,
    root_plan_id: candidate.root_plan_id,
    correction_id: lineage.correction_id,
    correction_cycle: lineage.correction_cycle,
    strategy_revision: lineage.strategy_revision,
    source_bindings: lineage.source_bindings
  }))).toSorted((left, right) => left.learning_id.localeCompare(right.learning_id) || left.correction_cycle - right.correction_cycle);
}
function deliveryPathsHash(deliveryCommit, deliveredPaths) {
  return stableHash({ delivery_commit: deliveryCommit, delivered_paths: unique(deliveredPaths).toSorted() });
}
function verifyEventChain(events = []) {
  let previousHash = null;
  for (const event of events) {
    if (!event || event.previous_hash !== previousHash || typeof event.event_hash !== "string") return { valid: false, blocker: "controller-event-chain-invalid" };
    const { event_hash: eventHash, ...unsigned } = event;
    if (hash(unsigned) !== eventHash) return { valid: false, blocker: "controller-event-chain-invalid" };
    previousHash = eventHash;
  }
  return { valid: true, blocker: null, last_hash: previousHash };
}
function terminalDeliveryEvent(run, events, deliveredPaths, { allowUnboundLegacy = false } = {}) {
  const requiredResult = run.effective_profile === "supervised" ? "accepted-verified" : "achieved";
  const expectedPathsHash = deliveryPathsHash(run.delivery_commit, deliveredPaths);
  const expectedSubject = runEventSubject(run);
  const subjectRequired = run.event_subject_schema === RUN_EVENT_SUBJECT_SCHEMA;
  const legacySubjectAbsent = !Object.hasOwn(run, "event_subject_schema");
  if (!subjectRequired && !legacySubjectAbsent) return false;
  const expectedSubjectValid = expectedSubject.run_id === run.run_id && /^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(expectedSubject.root_plan_id)) && /^[a-f0-9]{64}$/.test(String(expectedSubject.intent_hash)) && ["supervised", "autonomous"].includes(expectedSubject.effective_profile);
  const projectionFields = ["delivery_evidence_hash", "delivery_commit", "delivered_paths_hash"];
  return events.some((event) => {
    if (event.type !== "decision" || event.payload?.result !== requiredResult || !event.payload?.evidence_refs?.includes(run.delivery_evidence_hash)) return false;
    const hasProjectionBinding = projectionFields.some((field) => Object.hasOwn(event.payload ?? {}, field));
    const projectionMatches = event.payload?.delivery_evidence_hash === run.delivery_evidence_hash && event.payload?.delivery_commit === run.delivery_commit && event.payload?.delivered_paths_hash === expectedPathsHash;
    const hasSubject = Object.hasOwn(event, "subject");
    const subjectMatches = expectedSubjectValid && hasSubject && stableHash(event.subject) === stableHash(expectedSubject);
    if (subjectRequired || hasSubject) return projectionMatches && subjectMatches;
    return allowUnboundLegacy && legacySubjectAbsent && (projectionMatches || !hasProjectionBinding);
  });
}
function reviewerReceiptConfirmed(run, receiptId) {
  const matches = (run.receipts ?? []).filter((receipt2) => receipt2?.request_id === receiptId);
  if (matches.length !== 1) return false;
  const [receipt] = matches;
  return ["reviewer", "investigator"].includes(receipt.phase) && receipt.model_attested === true && receipt.status === "finished" && receipt.reader_repository_unchanged !== false && typeof receipt.agent_id === "string" && receipt.agent_id !== "" && Number.isFinite(receipt.duration_ms) && receipt.duration_ms >= 0 && Number.isFinite(receipt.usage?.totalTokens) && receipt.usage.totalTokens >= 0 && Number.isFinite(receipt.cost_usd) && receipt.cost_usd >= 0 && receipt.artifact_projection_hash === run.intent_hash;
}
function controllerCandidateConfirmed(candidate, { eligible, run, events, chainValid, deliveredPaths }) {
  if (!eligible || !chainValid) return false;
  let projected;
  try {
    projected = projectedControllerLearningCandidate(candidate);
  } catch {
    return false;
  }
  const payload = candidatePayload(projected);
  const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
  const candidateHash = candidateIdentity(run.run_id, rootPlanId, payload);
  const expectedId = `LRN-${String(rootPlanId).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
  if (projected.run_id !== run.run_id || projected.root_plan_id !== rootPlanId || projected.candidate_hash !== candidateHash || projected.learning_id !== expectedId) return false;
  const lineage = projected.lineage;
  const first = lineage[0];
  const expectedReceiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
  if (projected.correction_id !== first.correction_id || projected.correction_cycle !== first.correction_cycle || projected.strategy_revision !== first.strategy_revision || projected.source_decision_hash !== first.source_bindings[0]?.source_decision_hash || JSON.stringify(projected.source_receipt_ids) !== JSON.stringify(expectedReceiptIds)) return false;
  const correctionLinked = lineage.every((entry) => {
    const expectedRef = controllerLearningEventRefs([{ ...projected, lineage: [entry] }])[0];
    const sourceReceiptIds = entry.source_bindings.map((binding) => binding.source_receipt_id).toSorted();
    return events.some((event) => event.type === "decision" && event.payload?.correction_id === entry.correction_id && event.payload?.learning_candidate_ids?.includes(projected.learning_id) && sourceReceiptIds.every((receiptId) => (event.payload?.actor_receipts ?? []).includes(receiptId)) && (event.payload?.learning_candidate_refs ?? []).some((reference) => stableHash(reference) === stableHash(expectedRef)));
  });
  const provenanceAttested = expectedReceiptIds.every((receiptId) => reviewerReceiptConfirmed(run, receiptId));
  const evidenceLinked = typeof run.delivery_evidence_hash === "string" && typeof run.delivery_commit === "string" && terminalDeliveryEvent(run, events, deliveredPaths);
  const finalFindings = new Set(run.review?.finding_keys ?? []);
  return correctionLinked && provenanceAttested && evidenceLinked && projected.finding_keys.every((key) => !finalFindings.has(key));
}
function deriveControllerLearningContext({ run, events = [], workspaceRoot, pluginRoot, sourceBinding = null }) {
  const blockers = [];
  const compatibility = classifyRunCompatibility(run);
  if (!compatibility.compatible) blockers.push(compatibility.blocker ?? "controller-run-protocol-incompatible");
  if (run?.event_subject_schema === RUN_EVENT_SUBJECT_SCHEMA) blockers.push(...runIntegrityBlockers(run, pluginRoot));
  if (sourceBinding?.confirmed !== true) blockers.push(sourceBinding?.blocker ?? "controller-learning-source-not-current-task-bound");
  if (run.lifecycle !== "achieved") blockers.push("learning-source-not-achieved");
  if (run.delivery_status !== "verified" || run.evidence_grade !== "verified") blockers.push("learning-source-not-verified");
  if (!run.root_review_complete || run.review?.assessment !== "achieved" || run.review?.delivery_status !== "verified") blockers.push("learning-review-not-achieved");
  if ((run.blockers ?? []).length > 0) blockers.push("learning-source-has-blockers");
  if (run.effective_profile === "supervised" && !(run.delivery_accepted === true && run.accepted_as === "verified")) blockers.push("supervised-learning-requires-verified-acceptance");
  if (!["supervised", "autonomous"].includes(run.effective_profile)) blockers.push("controller-learning-profile-invalid");
  const chain = verifyEventChain(events);
  if (events.length === 0) blockers.push("controller-event-chain-missing");
  if (!chain.valid) blockers.push(chain.blocker);
  const deliveryCommit = run.delivery_commit ?? run.checkpoints?.at(-1)?.commit ?? null;
  const humanBaseline = run.worktree?.human_baseline ?? null;
  let storedPaths = null;
  if (Array.isArray(run.delivered_paths)) {
    try {
      storedPaths = normalizedStringArray(run.delivered_paths, "controller delivered_paths", { maximum: 1e4, itemMaximum: 4e3 });
    } catch {
      blockers.push("controller-delivery-paths-invalid");
    }
  }
  let deliveredPaths = null;
  if (!deliveryCommit || !humanBaseline) blockers.push("controller-delivery-fingerprint-unavailable");
  if (deliveryCommit && humanBaseline) {
    try {
      deliveredPaths = changedPathsBetween(workspaceRoot, humanBaseline, deliveryCommit);
      if (deliveredPaths.length === 0) blockers.push("controller-delivery-paths-empty");
      if (storedPaths && JSON.stringify(storedPaths) !== JSON.stringify(deliveredPaths)) blockers.push("controller-delivery-paths-mismatch");
    } catch {
      blockers.push("controller-delivery-paths-unavailable");
    }
  }
  let workspaceMatch = { status: "unverifiable", matched: false, paths: deliveredPaths ?? [] };
  if (deliveryCommit && deliveredPaths) {
    workspaceMatch = workspaceDeliveryMatch(workspaceRoot, deliveryCommit, deliveredPaths);
    if (!workspaceMatch.matched) blockers.push(`controller-delivery-${workspaceMatch.status}`);
  }
  if (chain.valid && deliveredPaths && !terminalDeliveryEvent(run, events, deliveredPaths, { allowUnboundLegacy: true })) blockers.push("controller-delivery-event-unconfirmed");
  const projectedCandidates = [];
  for (const candidate of run.learning_candidates ?? []) {
    try {
      projectedCandidates.push(projectedControllerLearningCandidate(candidate));
    } catch {
      blockers.push("controller-learning-candidate-invalid");
    }
  }
  const eligible = blockers.length === 0;
  const candidates = projectedCandidates.map((candidate) => ({
    ...candidate,
    evidence_confirmed: controllerCandidateConfirmed(candidate, { eligible, run, events, chainValid: chain.valid, deliveredPaths: deliveredPaths ?? [] })
  }));
  return {
    schema: 1,
    eligible,
    source_kind: "controller-run",
    source_id: run.run_id,
    root_plan_id: run.plan?.fields?.id ?? run.root_plan_id ?? null,
    effective_profile: run.effective_profile ?? null,
    blockers: unique(blockers),
    workspace_match: workspaceMatch,
    delivery_commit: deliveryCommit,
    delivered_paths: deliveredPaths ?? [],
    event_chain_valid: chain.valid,
    compatibility: compatibility.compatibility,
    source_binding: sourceBinding?.confirmed === true ? { status: "confirmed", kind: sourceBinding.kind ?? "ephemeral-receipt" } : { status: "unconfirmed", kind: sourceBinding?.kind ?? null },
    candidates
  };
}
function derivePreparationLearningContext(preparation) {
  const compatibility = classifyPreparationCompatibility(preparation);
  return {
    schema: 1,
    eligible: false,
    source_kind: "controller-preparation",
    source_id: preparation?.preparation_id ?? null,
    root_plan_id: preparation?.root_plan_id ?? preparation?.plan?.fields?.id ?? null,
    effective_profile: preparation?.requested_profile ?? null,
    blockers: [compatibility.blocker ?? "learning-source-not-delivery-run"],
    workspace_match: { status: "not-applicable", matched: false, paths: [] },
    delivery_commit: null,
    delivered_paths: [],
    event_chain_valid: false,
    compatibility: compatibility.compatibility,
    source_binding: { status: "not-applicable", kind: null },
    candidates: []
  };
}

// src/controller/engine.mjs
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync3, statSync } from "node:fs";
import { join as join2, resolve as resolve3 } from "node:path";
import { spawnSync as spawnSync2 } from "node:child_process";

// scripts/derive-workflow-state.mjs
var states = /* @__PURE__ */ new Set([
  "intake",
  "intent-clarification",
  "root-plan-review",
  "intent-ready",
  "product-aligned",
  "architecture-aligned",
  "program-design-aligned",
  "slice-ready",
  "strategy-ready",
  "baseline-verification",
  "implementing",
  "host-verifying",
  "slice-review",
  "root-review",
  "delivery-ready",
  "delivery-ready-verified",
  "delivery-ready-provisional",
  "waiting-human",
  "replan",
  "achieved",
  "accepted-provisional",
  "blocked",
  "paused",
  "interrupted",
  "stopped",
  "failed"
]);
var terminalLifecycle = /* @__PURE__ */ new Set(["achieved", "accepted-provisional", "blocked", "stopped", "failed"]);
function snapshot(input, state, overrides = {}) {
  if (!states.has(state)) throw new Error(`unsupported workflow state ${state}`);
  const snapshotSource = input.snapshot_source ?? (input.run_id ? "controller-run" : "artifact-chain");
  return {
    run_id: input.run_id ?? null,
    root_plan_id: input.root_plan_id ?? null,
    requested_profile: input.requested_profile ?? "manual",
    effective_profile: input.effective_profile ?? input.requested_profile ?? "manual",
    contract_level: input.plan?.fields?.contract_level ?? input.contract_level ?? null,
    compatibility: input.compatibility ?? "compatible",
    state,
    snapshot_source: snapshotSource,
    allowed_actions: [],
    required_actor: "none",
    next_action: "none",
    evidence_tip: input.evidence_tip ?? null,
    review_tip: input.review_tip ?? null,
    blockers: [...new Set(input.blockers ?? [])],
    downgrade_reason: input.downgrade_reason ?? null,
    intent_hash: input.intent_hash ?? input.root_authoritative_projection_hash ?? null,
    strategy_revision: input.strategy_revision ?? input.strategy?.revision ?? null,
    strategy_hash: input.strategy?.strategy_hash ?? null,
    deviations: input.deviations ?? input.strategy?.deviations ?? [],
    evidence_grade: input.evidence_grade ?? null,
    delivery_status: input.delivery_status ?? null,
    dirty_baseline_hash: input.dirty_baseline_hash ?? null,
    qualification_key: input.qualification_key ?? null,
    revision: input.revision ?? (snapshotSource === "artifact-chain" ? null : 0),
    artifact_set_hash: input.artifact_set_hash ?? null,
    observed_at: input.observed_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    ...overrides
  };
}
function waiting(input, blocker, nextAction = "answer") {
  return snapshot(input, "waiting-human", {
    allowed_actions: ["answer", "pause", "stop"],
    required_actor: "human",
    next_action: nextAction,
    blockers: [...new Set([...input.blockers ?? [], blocker].filter(Boolean))]
  });
}
function deriveWorkflowState(input = {}) {
  const manualArtifacts = input.snapshot_source === "artifact-chain";
  if (terminalLifecycle.has(input.lifecycle)) return snapshot(input, input.lifecycle, { required_actor: "none" });
  if (input.lifecycle === "paused") return snapshot(input, "paused", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "resume" });
  if (input.lifecycle === "interrupted") return snapshot(input, "interrupted", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "reconcile-and-resume" });
  if (manualArtifacts && input.manual_context_incomplete) return snapshot(input, "waiting-human", {
    allowed_actions: ["provide-artifacts"],
    required_actor: "human",
    next_action: "provide-artifacts"
  });
  if (input.artifact_chain_valid === false) return snapshot(input, "replan", {
    allowed_actions: manualArtifacts ? ["replan"] : ["replan", "stop"],
    required_actor: "human",
    next_action: manualArtifacts ? "replan" : "create-schema-5-root"
  });
  if ((input.blockers ?? []).length > 0 || input.lifecycle === "waiting-human") return waiting(input, null, input.next_action ?? "answer");
  if (!input.goal && !input.root_plan_id) return snapshot(input, "intake", { allowed_actions: ["provide-goal", "provide-root-plan"], required_actor: "human", next_action: "provide-intent" });
  if (input.material_open_decisions) return snapshot(input, "intent-clarification", { allowed_actions: manualArtifacts ? ["answer", "replan"] : ["answer", "stop"], required_actor: "human", next_action: "resolve-intent" });
  if (!input.root_plan_id || input.plan_status === "draft") return snapshot(input, "root-plan-review", { allowed_actions: ["inspect", "approve", "stop"], required_actor: input.plan_status === "draft" ? "human" : "planner", next_action: input.plan_status === "draft" ? "approve-plan" : "create-root-plan" });
  if (!input.plan_approved) return snapshot(input, "root-plan-review", manualArtifacts ? { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" } : { allowed_actions: ["inspect", "approve", "stop"], required_actor: "human", next_action: "approve-plan" });
  if (!input.intent_ready) return snapshot(input, "replan", { allowed_actions: ["replan", "stop"], required_actor: "human", next_action: "replan", blockers: ["root-plan-not-intent-ready"] });
  if (input.root_schema_valid === false) return snapshot(input, "replan", {
    allowed_actions: ["replan", "stop"],
    required_actor: "human",
    next_action: "create-schema-5-root",
    blockers: ["invalid-schema-5-root"]
  });
  if (!input.execution_started) return snapshot(input, manualArtifacts ? "root-plan-review" : "strategy-ready", manualArtifacts ? { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" } : { allowed_actions: ["execute", "pause", "stop"], required_actor: "controller", next_action: "execute-strategy" });
  if (input.phase === "baseline-verification") return snapshot(input, "baseline-verification", { allowed_actions: ["pause", "stop"], required_actor: "verifier", next_action: "capture-baseline" });
  if (input.phase === "strategy-ready") return snapshot(input, "strategy-ready", { allowed_actions: ["execute", "pause", "stop"], required_actor: "controller", next_action: "execute-strategy" });
  if (input.phase === "implementing") return snapshot(input, "implementing", { allowed_actions: ["pause", "stop"], required_actor: "writer", next_action: "finish-slice" });
  if (input.phase === "host-verifying") return snapshot(input, "host-verifying", { allowed_actions: ["pause", "stop"], required_actor: "controller", next_action: "verify-slice" });
  if (input.phase === "slice-review") return snapshot(input, "slice-review", { allowed_actions: ["pause", "stop"], required_actor: "reviewer", next_action: "review-slice" });
  const nextAction = input.review?.next_action;
  if (manualArtifacts && input.correction_evidence_pending_review) return snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "review-root" });
  if (nextAction === "clarify") return manualArtifacts ? snapshot(input, "waiting-human", { allowed_actions: ["answer", "replan"], required_actor: "human", next_action: "answer", blockers: [.../* @__PURE__ */ new Set([...input.blockers ?? [], "review-requires-clarification"])] }) : waiting(input, "review-requires-clarification", "answer");
  if (nextAction === "replan") return snapshot(input, "replan", { allowed_actions: manualArtifacts ? ["replan"] : ["replan", "stop"], required_actor: "human", next_action: "replan" });
  if (nextAction === "correct") return manualArtifacts ? snapshot(input, "waiting-human", { allowed_actions: ["inspect", "correct", "replan"], required_actor: "human", next_action: "approve-correction" }) : snapshot(input, "slice-review", { allowed_actions: ["correct", "pause", "stop"], required_actor: "writer", next_action: "correct" });
  if (nextAction === "retry-review") return manualArtifacts ? snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "retry-review" }) : snapshot(input, "slice-review", { allowed_actions: ["retry-review", "pause", "stop"], required_actor: "reviewer", next_action: "retry-review" });
  if (input.more_slices) return snapshot(input, "slice-ready", { allowed_actions: ["implement", "pause", "stop"], required_actor: "writer", next_action: "implement-next-slice" });
  if (manualArtifacts && input.delivery_status === "provisional") {
    if (input.manual_acceptance === "provisional") return snapshot(input, "accepted-provisional", {
      allowed_actions: ["inspect"],
      required_actor: "none",
      next_action: "none",
      acceptance_persisted: false,
      acceptance_basis_hash: input.acceptance_basis_hash ?? input.artifact_set_hash ?? null
    });
    return snapshot(input, "delivery-ready-provisional", { allowed_actions: ["accept-provisional", "inspect"], required_actor: "human", next_action: "accept-provisional" });
  }
  if (!input.root_review_complete) return snapshot(input, "root-review", { allowed_actions: manualArtifacts ? ["review"] : ["review", "pause", "stop"], required_actor: "reviewer", next_action: "review-root" });
  if (input.phase === "delivery-ready-provisional" || input.delivery_status === "provisional") return snapshot(input, "delivery-ready-provisional", { allowed_actions: ["accept-provisional", "inspect", "stop"], required_actor: "human", next_action: "accept-provisional" });
  if (!manualArtifacts && (input.phase === "delivery-ready-verified" || input.delivery_status === "verified" && !input.delivery_accepted)) return snapshot(input, "delivery-ready-verified", { allowed_actions: ["accept-verified", "inspect", "stop"], required_actor: "human", next_action: "accept-verified" });
  if (input.review?.assessment !== "achieved") return snapshot(input, "replan", { allowed_actions: ["replan", "stop"], required_actor: "human", next_action: "replan", blockers: ["root-review-not-achieved"] });
  return snapshot(input, "achieved", { allowed_actions: ["explain", "learn"], required_actor: "none", next_action: "none" });
}
var workflowStates = Object.freeze([...states]);

// src/controller/delivery-closeout.mjs
var import_yaml = __toESM(require_dist(), 1);
import { createHash as createHash5 } from "node:crypto";

// src/core/manual-check-receipts.mjs
import { createHash as createHash4, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync as lstatSync2,
  mkdirSync,
  readdirSync,
  readFileSync as readFileSync2,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve as resolve2, sep } from "node:path";

// src/core/manual-repository-snapshot.mjs
import { createHash as createHash3 } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readlinkSync
} from "node:fs";
import { resolve } from "node:path";
function git(workspaceRoot, args, options = {}) {
  const runner = options.spawnSync ?? spawnSync;
  const result = runner("git", ["-C", workspaceRoot, ...args], {
    encoding: args.includes("-z") ? "buffer" : "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : String(result.stderr ?? "");
    throw new Error(`repository snapshot failed: git ${args.join(" ")} (${stderr.trim() || `exit ${result.status}`})`);
  }
  return result.stdout;
}
function nulPaths(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""));
  return buffer.toString("utf8").split("\0").filter(Boolean);
}
function sha256(value) {
  return createHash3("sha256").update(value).digest("hex");
}
function repositoryPathFingerprint(workspaceRoot, repositoryPath) {
  const absolute = resolve(workspaceRoot, repositoryPath);
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) return `symlink:${sha256(Buffer.from(readlinkSync(absolute), "utf8"))}`;
    if (stat.isFile()) return `file:${stat.mode.toString(8)}:${sha256(readFileSync(absolute))}`;
    if (stat.isDirectory()) return `directory:${stat.mode.toString(8)}`;
    return `other:${stat.mode.toString(8)}:${stat.size}`;
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}
function captureRepositorySnapshot(workspaceRoot, options = {}) {
  const root = String(git(workspaceRoot, ["rev-parse", "--show-toplevel"], options)).trim();
  const head = String(git(root, ["rev-parse", "HEAD"], options)).trim();
  const index = git(root, ["ls-files", "--stage", "-z", "--"], options);
  const status = git(root, ["status", "--porcelain=v2", "--untracked-files=all", "-z", "--"], options);
  const tracked = nulPaths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"], options));
  const untracked = nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], options));
  const dirtyPaths = [.../* @__PURE__ */ new Set([...tracked, ...untracked])].sort();
  const fingerprints = Object.fromEntries(dirtyPaths.map((path) => [path, repositoryPathFingerprint(root, path)]));
  return {
    schema: 1,
    repository_root: root,
    head,
    dirty_paths: dirtyPaths,
    fingerprints,
    index_fingerprint: sha256(Buffer.isBuffer(index) ? index : Buffer.from(String(index))),
    status_fingerprint: sha256(Buffer.isBuffer(status) ? status : Buffer.from(String(status))),
    working_tree: dirtyPaths.length > 0 ? "modified" : "unchanged",
    captured_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function validSnapshot(value) {
  return Boolean(
    value && value.schema === 1 && typeof value.repository_root === "string" && typeof value.head === "string" && Array.isArray(value.dirty_paths) && value.fingerprints && typeof value.fingerprints === "object" && !Array.isArray(value.fingerprints)
  );
}
function deriveRepositoryDelta(baseline, current) {
  if (!validSnapshot(current)) throw new Error("current repository snapshot is invalid");
  if (!baseline) {
    return {
      baseline_available: false,
      changed_paths: [...current.dirty_paths],
      repository_snapshot: evidenceRepositorySnapshot(current, current.dirty_paths, {
        baselineAvailable: false
      })
    };
  }
  if (!validSnapshot(baseline)) throw new Error("repository baseline is invalid");
  if (resolve(baseline.repository_root) !== resolve(current.repository_root)) {
    throw new Error("repository root changed after the native closeout baseline");
  }
  if (baseline.head !== current.head) {
    throw new Error("repository HEAD changed after the native closeout baseline");
  }
  const candidates = [.../* @__PURE__ */ new Set([...baseline.dirty_paths, ...current.dirty_paths])].sort();
  const changedPaths2 = candidates.filter((path) => {
    const before = Object.prototype.hasOwnProperty.call(baseline.fingerprints, path) ? baseline.fingerprints[path] : "clean";
    const after = Object.prototype.hasOwnProperty.call(current.fingerprints, path) ? current.fingerprints[path] : "clean";
    return before !== after;
  });
  return {
    baseline_available: true,
    changed_paths: changedPaths2,
    repository_snapshot: evidenceRepositorySnapshot(current, changedPaths2, {
      baselineAvailable: true
    })
  };
}
function evidenceRepositorySnapshot(snapshot2, relevantPaths, { baselineAvailable = true } = {}) {
  if (!validSnapshot(snapshot2)) throw new Error("repository snapshot is invalid");
  const entries = [...new Set(relevantPaths ?? [])].sort().map((path) => `${path}=${snapshot2.fingerprints[path] ?? repositoryPathFingerprint(snapshot2.repository_root, path)}`);
  entries.push(`index=${snapshot2.index_fingerprint ?? "unavailable"}`);
  entries.push(`status=${snapshot2.status_fingerprint ?? "unavailable"}`);
  return {
    repository_root: snapshot2.repository_root,
    head: snapshot2.head,
    working_tree: snapshot2.working_tree,
    relevant_fingerprints: entries.length > 0 ? entries.join("; ") : "none",
    known_failures: "none observed by the repository snapshot adapter",
    baseline_available: baselineAvailable
  };
}

// src/core/manual-check-receipts.mjs
var MANUAL_CHECK_RECEIPT_TTL_MS = 24 * 60 * 60 * 1e3;
var MANUAL_CHECK_RECEIPT_SURFACE = "host-tool-receipt";
function manualReceiptHash(value) {
  return createHash4("sha256").update(String(value)).digest("hex");
}
function stable2(value) {
  if (Array.isArray(value)) return value.map(stable2);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable2(value[key])]));
}
function stableManualReceiptJson(value) {
  return JSON.stringify(stable2(value));
}
var sha2562 = manualReceiptHash;
var stableJson = stableManualReceiptJson;
function unique2(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}
function normalizeManualCheckCommand(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.startsWith("rtk ") ? trimmed.slice(4) : trimmed;
}
function plannedWorkingDirectory(value) {
  const source = String(value ?? "").trim();
  if (!source || /^repository root$/i.test(source) || source === ".") return ".";
  const normalized = source.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/")) return null;
  return normalized;
}
function manualMachineChecks(rootPlanText, pluginRoot) {
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields?.schema !== 5) {
    throw new Error(`manual Check receipts require a valid Schema-5 Root: ${contract.errors.join("; ")}`);
  }
  return {
    root_plan_id: contract.fields.id,
    root_hash: rootContentHash(rootPlanText),
    checks: contract.checks.filter((check) => check.Required === "yes" && check["Evidence Class"] === "machine-verifiable").map((check) => ({
      check_id: check["Check ID"],
      command: normalizeManualCheckCommand(check["Command or Inspection"]),
      command_hash: sha2562(normalizeManualCheckCommand(check["Command or Inspection"])),
      working_directory: plannedWorkingDirectory(check["Working Directory"]),
      expected: check["Expected Result"],
      required_repetitions: 1
    })),
    all_checks: contract.checks.filter((check) => check.Required === "yes")
  };
}
function repositorySnapshotFingerprint(snapshot2) {
  if (!snapshot2 || typeof snapshot2 !== "object") throw new Error("manual Check receipt requires a repository snapshot");
  return sha2562(stableJson({
    repository_root: resolve2(snapshot2.repository_root),
    head: snapshot2.head,
    dirty_paths: snapshot2.dirty_paths,
    fingerprints: snapshot2.fingerprints,
    index_fingerprint: snapshot2.index_fingerprint ?? null,
    status_fingerprint: snapshot2.status_fingerprint ?? null
  }));
}
function proofBase(workspaceRoot, rootHash, options = {}) {
  return join(sharedArtifactStateRoot(canonicalWorkspaceRoot(workspaceRoot), options), "manual-check-receipts", rootHash);
}
function canonicalManualWorkspaceRoot(workspaceRoot) {
  try {
    return realpathSync(workspaceRoot);
  } catch {
    return resolve2(workspaceRoot);
  }
}
var canonicalWorkspaceRoot = canonicalManualWorkspaceRoot;
function assertManualReceiptPath(path, base) {
  const resolvedBase = resolve2(base);
  const resolvedPath = resolve2(path);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${sep}`)) {
    throw new Error("manual Check receipt path escapes its protected state root");
  }
  let current = resolvedPath;
  while (current !== resolvedBase && !existsSync(current)) current = dirname(current);
  if (existsSync(current) && lstatSync2(current).isSymbolicLink()) {
    throw new Error("manual Check receipt state may not be symlink redirected");
  }
}
var assertSafeDirectory = assertManualReceiptPath;
function readManualReceiptRecord(path, base) {
  assertSafeDirectory(path, base);
  const stat = lstatSync2(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return null;
  const value = JSON.parse(readFileSync2(path, "utf8"));
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
var readReceiptRecord = readManualReceiptRecord;
function existingRecords(directory, base) {
  if (!existsSync(directory)) return [];
  assertSafeDirectory(directory, base);
  if (lstatSync2(directory).isSymbolicLink()) return [];
  return readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).flatMap((name) => {
    try {
      const record = readReceiptRecord(join(directory, name), base);
      return record ? [record] : [];
    } catch {
      return [];
    }
  });
}
function invalidateManualCheckReceipts({ rootPlanText, workspaceRoot, options = {} }) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) return false;
  const rootHash = rootContentHash(rootPlanText);
  const canonicalRoot = canonicalWorkspaceRoot(workspaceRoot);
  const base = proofBase(canonicalRoot, rootHash, options);
  if (!existsSync(base)) return false;
  const stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  assertSafeDirectory(base, stateRoot);
  if (lstatSync2(base).isSymbolicLink()) throw new Error("manual Check receipt state may not be symlink redirected");
  rmSync(base, { recursive: true, force: true });
  return true;
}
function validStoredReceipt(record, { plan, repositoryRoot, currentFingerprint, now }) {
  if (!record || record.schema !== 1 || record.kind !== "manual-check-receipt-record") return false;
  const receipt = record.receipt;
  if (!receipt || receipt.schema !== 1 || receipt.kind !== "manual-check-receipt") return false;
  if (!/^[a-f0-9]{64}$/.test(String(record.receipt_hash ?? ""))) return false;
  if (sha2562(stableJson(receipt)) !== record.receipt_hash) return false;
  if (receipt.root_hash !== plan.root_hash || receipt.repository_key !== repositoryKey(repositoryRoot)) return false;
  if (receipt.snapshot_fingerprint !== currentFingerprint) return false;
  const expires = Date.parse(record.expires_at);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return false;
  const check = plan.checks.find((entry) => entry.check_id === receipt.check_id);
  if (!check || check.command_hash !== receipt.command_hash || check.working_directory !== receipt.working_directory) return false;
  return ["passed", "failed"].includes(receipt.result_status) && Number.isInteger(receipt.repetition_ordinal) && receipt.repetition_ordinal >= 1;
}
function loadManualCheckReceipts({
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  captureSnapshot = captureRepositorySnapshot,
  now = () => /* @__PURE__ */ new Date(),
  options = {}
}) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim() || !workspaceRoot) return [];
  const plan = manualMachineChecks(rootPlanText, pluginRoot);
  const current = captureSnapshot(workspaceRoot);
  const currentFingerprint = repositorySnapshotFingerprint(current);
  const canonicalRoot = current.repository_root;
  const base = proofBase(canonicalRoot, plan.root_hash, options);
  const stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  if (!existsSync(base)) return [];
  try {
    assertSafeDirectory(base, stateRoot);
    if (lstatSync2(base).isSymbolicLink()) return [];
    return readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^CHECK-[1-9][0-9]*$/.test(entry.name)).flatMap((entry) => existingRecords(join(base, entry.name), stateRoot)).filter((record) => validStoredReceipt(record, {
      plan,
      repositoryRoot: current.repository_root,
      currentFingerprint,
      now: now()
    })).map((record) => ({ ...record.receipt, receipt_hash: record.receipt_hash })).sort((left, right) => left.check_id.localeCompare(right.check_id) || left.repetition_ordinal - right.repetition_ordinal);
  } catch {
    return [];
  }
}
function limitationFor(check) {
  const command = normalizeManualCheckCommand(check["Command or Inspection"]);
  const workingDirectory = String(check["Working Directory"] ?? "repository root");
  return `HOST-RECEIPT-MISSING: ${check["Check ID"]} was not host-attested for the current repository snapshot. Re-run exactly \`${command}\` from ${workingDirectory}, then retry closeout.`;
}
function sameCallerObservation(entry, existing) {
  return Boolean(existing && entry?.grade === existing.grade && String(entry?.observed ?? "not fully observed") === String(existing.observed ?? "not fully observed") && String(entry?.expected ?? existing.expected ?? "") === String(existing.expected ?? ""));
}
function calibrateManualCheckEvidence({ entries, plannedChecks, receipts = [], existingCheckEvidence = [] }) {
  const existingByCheck = new Map((existingCheckEvidence ?? []).map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    const check = plannedChecks.get(entry.check_id);
    if (!check || check["Evidence Class"] !== "machine-verifiable") return entry;
    const commandHash = sha2562(normalizeManualCheckCommand(check["Command or Inspection"]));
    const workingDirectory = plannedWorkingDirectory(check["Working Directory"]);
    const checkReceipts = receipts.filter((receipt) => receipt.command_hash === commandHash && receipt.working_directory === workingDirectory);
    const failures = checkReceipts.filter((receipt) => receipt.result_status === "failed");
    const successes = checkReceipts.filter((receipt) => receipt.result_status === "passed");
    if (failures.length > 0) {
      return {
        ...entry,
        grade: "failed",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: failures.length + successes.length,
        artifact_hashes: unique2([...failures, ...successes].map((receipt) => receipt.receipt_hash)),
        limitations: unique2([...entry.limitations ?? [], `HOST-RECEIPT-FAILED: ${entry.check_id} returned a host-observed failure for the current repository snapshot.`])
      };
    }
    if (entry.grade !== "verified") return entry;
    if (successes.length >= 1) {
      return {
        ...entry,
        grade: "verified",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: successes.length,
        artifact_hashes: unique2(successes.map((receipt) => receipt.receipt_hash))
      };
    }
    const existing = existingByCheck.get(entry.check_id);
    if (existing?.grade === "verified" && existing.surface === MANUAL_CHECK_RECEIPT_SURFACE && Array.isArray(existing.artifact_hashes) && existing.artifact_hashes.length > 0 && sameCallerObservation(entry, existing)) {
      return { ...existing };
    }
    const meaningful = String(entry.observed ?? "").trim() && !/^not (?:fully )?observed$/i.test(String(entry.observed).trim());
    return {
      ...entry,
      grade: meaningful ? "supported" : "unavailable",
      surface: "repository",
      method: normalizeManualCheckCommand(check["Command or Inspection"]),
      repetitions: 0,
      artifact_hashes: [],
      limitations: unique2([...entry.limitations ?? [], limitationFor(check)])
    };
  });
}
function manualConstraintProjection({ checks = [], evidence = [], pending = false }) {
  const required = checks.filter((check) => check.Required === "yes");
  const byId = new Map((evidence ?? []).map((entry) => [entry.check_id, entry]));
  const ids = (predicate) => required.filter(predicate).map((check) => check["Check ID"]);
  const hostAttested = ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return entry?.grade === "verified" && entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0;
  });
  const machine = ids((check) => check["Evidence Class"] === "machine-verifiable");
  const failed = ids((check) => byId.get(check["Check ID"])?.grade === "failed");
  const unattestedVerified = pending ? [] : ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return check["Evidence Class"] === "machine-verifiable" && entry?.grade === "verified" && !(entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0);
  });
  const ordinaryGaps = pending ? [] : ids((check) => {
    const entry = byId.get(check["Check ID"]);
    return !entry || ["supported", "partial", "unavailable"].includes(entry.grade);
  });
  const gaps = unique2([...unattestedVerified, ...ordinaryGaps]);
  const humanReview = ids((check) => check["Evidence Class"] === "human-review-required");
  const humanApproval = ids((check) => check["Evidence Class"] === "human-approval-required");
  const reasons = pending ? [] : [
    ...failed.map((checkId) => ({ code: "check-failed", check_id: checkId, message: `${checkId} failed and blocks delivery.`, recovery: `Repair the cause, rerun ${checkId}, then retry closeout.` })),
    ...unattestedVerified.map((checkId) => ({ code: "legacy-receipt-gap", check_id: checkId, message: `${checkId} is marked verified without a valid host receipt.`, recovery: `Run a fresh review for ${checkId}; use its bounded correction route to refresh Evidence with current host receipts.` })),
    ...ordinaryGaps.map((checkId) => ({ code: "evidence-gap", check_id: checkId, message: `${checkId} is not fully verified.`, recovery: `Follow the Check limitation, rerun ${checkId}, then retry closeout.` })),
    ...humanReview.map((checkId) => ({ code: "human-review-required", check_id: checkId, message: `${checkId} requires human review.`, recovery: `Complete the stated review for ${checkId} and record the bounded observation.` })),
    ...humanApproval.map((checkId) => ({ code: "human-approval-required", check_id: checkId, message: `${checkId} requires explicit human approval.`, recovery: `Request the named approval before continuing.` }))
  ];
  return {
    constraint_summary: {
      schema: 1,
      scope: "current-delivery",
      required_checks: required.map((check) => check["Check ID"]),
      host_attested_checks: hostAttested,
      human_review_checks: humanReview,
      human_approval_checks: humanApproval,
      failed_checks: failed,
      evidence_gap_checks: gaps,
      legacy_unattested_verified_checks: unattestedVerified,
      receipt_coverage: {
        attested: hostAttested.length,
        eligible: machine.length
      }
    },
    human_attention: {
      required: reasons.length > 0,
      reasons
    },
    problem_details: reasons.map((reason) => ({
      problem: reason.message,
      why: reason.code === "check-failed" ? "A required failed Check blocks delivery acceptance." : ["evidence-gap", "legacy-receipt-gap"].includes(reason.code) ? "The current evidence cannot support a verified delivery claim." : "This Check is intentionally reserved for human judgment or authority.",
      resolution: reason.recovery,
      blocking: ["check-failed", "human-approval-required"].includes(reason.code),
      check_id: reason.check_id
    }))
  };
}

// src/controller/delivery-closeout.mjs
function sha2563(value) {
  return createHash5("sha256").update(String(value)).digest("hex");
}
function stable3(value) {
  if (Array.isArray(value)) return value.map(stable3);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable3(value[key])]));
}
function unique3(values) {
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
    ...rows.map((row) => `| ${headers.map((header) => cell(row[header])).join(" | ")} |`)
  ].join("\n");
}
function normalizeArtifacts(rootPlanText, artifacts, pluginRoot) {
  const rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan") {
    throw new Error(`closeout Root is invalid: ${(rootInspection.errors.length > 0 ? rootInspection.errors : ["input is not a work-plan"]).join("; ")}`);
  }
  const rootId = rootInspection.artifact.fields.id;
  const byId = /* @__PURE__ */ new Map([[rootId, { label: rootId, text: rootPlanText }]]);
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
function expectedCheckMap(contract, correction, unresolvedRootChecks = /* @__PURE__ */ new Map()) {
  const checks = correction?.checks?.filter((check) => check.Required === "yes") ?? contract.checks.filter((check) => check.Required === "yes");
  return new Map([
    ...checks.map((check) => [check["Check ID"], check]),
    ...unresolvedRootChecks
  ]);
}
function rootCheckMap(contract) {
  return new Map(contract.checks.filter((check) => check.Required === "yes").map((check) => [check["Check ID"], check]));
}
function correctionRootChecks(correction) {
  return new Set((correction?.fixes ?? []).flatMap((fix) => String(fix["Root Checks"] ?? "").match(/CHECK-[1-9][0-9]*/g) ?? []));
}
function repositoryPaths(value) {
  return unique3(String(value ?? "").split(/(?:,|<br>)/i).map((entry) => entry.trim().replace(/^\.\//, "").replace(/\/$/, "")).filter((entry) => entry && !/^(?:none|n\/a|repository root)$/i.test(entry) && !/^(?:CHECK|OBJ|FIX|STEP)-[1-9][0-9]*$/i.test(entry) && /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(entry)));
}
function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
function fingerprintMap(value) {
  const result = /* @__PURE__ */ new Map();
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
  return unique3((correction?.steps ?? []).flatMap((step) => repositoryPaths(step.Targets)));
}
function rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths2 = []) {
  const effectiveChecks = predecessorEvidence?.effective?.checks;
  const explicitlyAffected = correctionRootChecks(correction);
  const affectedObjectives = new Set(correctionObjectives(correction));
  const affectedPaths = unique3([
    ...changedPaths2.flatMap(repositoryPaths),
    ...correctionTargets(correction)
  ]);
  const previousFingerprints = predecessorEvidence?.effective?.snapshot?.["Relevant fingerprints"] ?? null;
  const currentFingerprints = repositorySnapshot?.relevant_fingerprints ?? null;
  const previousByPath = fingerprintMap(previousFingerprints);
  const currentByPath = fingerprintMap(currentFingerprints);
  const stalePaths = unique3([...previousByPath.keys(), ...currentByPath.keys()]).filter((path) => previousByPath.get(path) !== currentByPath.get(path));
  const opaqueFingerprintChange = Boolean(
    previousFingerprints && currentFingerprints && previousFingerprints !== currentFingerprints && previousByPath.size === 0 && currentByPath.size === 0
  );
  return new Map([...rootCheckMap(contract)].filter(([checkId, check]) => {
    const prior = effectiveChecks?.get(checkId);
    const prerequisites = repositoryPaths(check.Prerequisites);
    const objectiveAffected = checkObjectives(check).some((objective) => affectedObjectives.has(objective));
    const pathAffected = prerequisites.some((prerequisite) => affectedPaths.some((path) => pathsOverlap(prerequisite, path)));
    const fingerprintStale = prerequisites.some((prerequisite) => stalePaths.some((path) => pathsOverlap(prerequisite, path)));
    const ambiguousImpact = affectedPaths.length > 0 && prerequisites.length === 0;
    return !prior || ["failed", "blocked"].includes(prior.status) || explicitlyAffected.has(checkId) || objectiveAffected || pathAffected || fingerprintStale || opaqueFingerprintChange || ambiguousImpact;
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
      limitations: effective?.status === "passed" ? [] : ["Reused predecessor proof retains its prior non-verified grade."]
    };
  });
}
function normalizeCheckEvidence(input, plannedChecks, rootChecks, evidenceMode2, {
  enforceManualCheckReceipts = false,
  manualCheckReceipts = [],
  existingCheckEvidence = []
} = {}) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("closeout requires structured Check evidence");
  const ids = input.map((entry) => entry?.check_id);
  if (new Set(ids).size !== ids.length) throw new Error("closeout Check evidence IDs must be unique");
  for (const id of plannedChecks.keys()) if (!ids.includes(id)) throw new Error(`closeout is missing required Check ${id}`);
  const known = new Map([...rootChecks, ...plannedChecks]);
  const normalized = input.map((entry) => {
    const planned = known.get(entry?.check_id);
    if (!planned) throw new Error(`closeout received unknown Check ${entry?.check_id}`);
    if (!(/* @__PURE__ */ new Set(["verified", "supported", "partial", "unavailable", "failed"])).has(entry.grade)) throw new Error(`closeout Check ${entry.check_id} has invalid grade`);
    const limitations = unique3(Array.isArray(entry.limitations) ? entry.limitations.map(String).filter(Boolean) : []);
    const repetitions = Number.isInteger(entry.repetitions) && entry.repetitions >= 0 ? entry.repetitions : 0;
    if (entry.grade === "verified" && repetitions < 1) throw new Error(`verified Check ${entry.check_id} requires at least one repetition`);
    if (entry.grade === "unavailable" && limitations.length === 0) throw new Error(`unavailable Check ${entry.check_id} requires a concrete limitation`);
    const normalized2 = {
      check_id: entry.check_id,
      feature_id: entry.feature_id ?? null,
      grade: entry.grade,
      surface: entry.surface ?? "repository",
      method: entry.method ?? planned["Command or Inspection"] ?? "inspection",
      baseline_or_patched: "patched",
      expected: entry.expected ?? planned["Expected Result"] ?? "required Check succeeds",
      observed: String(entry.observed ?? "not fully observed"),
      repetitions,
      artifact_hashes: unique3((entry.artifact_hashes ?? []).filter((value) => /^[a-f0-9]{64}$/.test(String(value)))),
      limitations
    };
    return normalized2;
  });
  const calibrated = enforceManualCheckReceipts ? calibrateManualCheckEvidence({
    entries: normalized,
    plannedChecks: known,
    receipts: manualCheckReceipts,
    existingCheckEvidence
  }) : normalized;
  return calibrated.map((entry) => {
    const value = { ...entry };
    if (evidenceMode2 === "lean") {
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
  return unique3((correction?.fixes ?? []).flatMap((fix) => String(fix["Root Objectives"] ?? "").match(/OBJ-[1-9][0-9]*/g) ?? []));
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
  return sha2563(JSON.stringify(stable3({
    root: contract.authoritative_projection_hash,
    subjectId,
    sourceReviewId,
    predecessorEvidenceId,
    strategyRevision,
    mode,
    paths,
    entries,
    repositorySnapshot: repositorySnapshot ?? null,
    summary: summary ?? null
  })));
}
function summaryText(summary, status, grade) {
  const supplied = String(summary ?? "").trim();
  if (supplied) return supplied;
  if (status === "blocked") return `BLOCKER: required delivery verification failed; aggregate evidence grade is ${grade}.`;
  if (status === "provisional") return `Delivery is provisional with aggregate evidence grade ${grade}; limitations remain explicit.`;
  return "The authorized repository delivery is complete and every required Check is verified.";
}
function fullBody({ fields, contract, entries, changedPaths: changedPaths2, correction, repositorySnapshot, summary }) {
  const aggregate = fields.overall_grade;
  const outcomes = fields.affected_objectives.map((objective) => ({
    "Objective ID": objective,
    Status: objectiveState(objective, entries, rootCheckMap(contract), aggregate),
    Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", ")
  }));
  const sections = [`## Summary

${summary}`];
  if (correction) {
    const state = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
    sections.push(`## Subject results

${table(["Objective ID", "Result", "Evidence"], correction.fixes.map((fix) => ({
      "Objective ID": fix["FIX ID"],
      Result: state,
      Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", ")
    })))}`);
  }
  sections.push(`## Objective outcomes

${table(["Objective ID", "Status", "Evidence"], outcomes)}`);
  const coverageIds = correction ? unique3((correction.fixes ?? []).map((fix) => fix["FIX ID"]).filter(Boolean)) : fields.affected_objectives;
  sections.push(changedPaths2.length > 0 ? `## Changes

${table(["Path or Symbol", "Change", "Objective Coverage"], changedPaths2.map((path) => ({
    "Path or Symbol": path,
    Change: "Declared by deterministic closeout",
    "Objective Coverage": coverageIds.join(", ")
  })))}` : "## Changes\n\nNone.");
  const snapshot2 = repositorySnapshot ?? {};
  sections.push(`## Repository snapshot

${table(["Snapshot ID", "HEAD", "Working tree", "Changed paths", "Relevant fingerprints", "Known failures"], [{
    "Snapshot ID": `SNAP-${fields.id.slice(3)}`,
    HEAD: snapshot2.head ?? "unknown",
    "Working tree": snapshot2.working_tree ?? (changedPaths2.length > 0 ? "modified" : "unchanged"),
    "Changed paths": changedPaths2.join(", ") || "none",
    "Relevant fingerprints": snapshot2.relevant_fingerprints ?? "none",
    "Known failures": snapshot2.known_failures ?? (fields.status === "blocked" ? "required Check failed" : "none")
  }])}`);
  sections.push(`## Checks

${table(["Check ID", "Observed Result", "Status", "Prerequisite fingerprints"], entries.map((entry) => ({
    "Check ID": entry.check_id,
    "Observed Result": entry.observed,
    Status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "skipped",
    "Prerequisite fingerprints": snapshot2.relevant_fingerprints ?? "none"
  })))}`);
  sections.push("## Deviations\n\nNone.");
  sections.push("## Operational evidence\n\nNot applicable.");
  const limitations = unique3(entries.flatMap((entry) => entry.limitations ?? []));
  sections.push(`## Limitations

${limitations.length > 0 ? limitations.map((item) => `- ${item}`).join("\n") : "None."}`);
  return sections.join("\n\n");
}
function buildDeliveryEvidence({
  rootPlanText,
  artifacts = [],
  checkEvidence: checkEvidence2,
  changedPaths: changedPaths2 = [],
  strategyRevision = 0,
  effectiveProfile = null,
  repositorySnapshot = null,
  summary = null,
  manualCheckReceipts = [],
  enforceManualCheckReceipts = null,
  pluginRoot
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
      if ((checkEvidence2 ?? []).length > 0 || changedPaths2.length > 0) {
        const entries2 = normalizeCheckEvidence(checkEvidence2, expectedCheckMap(contract, null), rootCheckMap(contract), mode, {
          enforceManualCheckReceipts: requireManualReceipts,
          manualCheckReceipts,
          existingCheckEvidence: existingFields?.check_evidence ?? []
        });
        const suppliedPaths = unique3(changedPaths2.map(String).map((path) => path.trim()).filter(Boolean)).sort();
        const expectedSeed = evidenceSeed({
          contract,
          subjectId: normalized.rootId,
          sourceReviewId: null,
          predecessorEvidenceId: null,
          strategyRevision: effectiveStrategyRevision,
          mode,
          paths: suppliedPaths,
          entries: entries2,
          repositorySnapshot: effectiveRepositorySnapshot,
          summary
        });
        const expectedId = `de-${normalized.rootId.replace(/^wp-/, "")}-${expectedSeed.slice(0, 12)}`;
        const sameInputs = JSON.stringify(stable3(entries2)) === JSON.stringify(stable3(existingFields?.check_evidence ?? [])) && JSON.stringify(suppliedPaths) === JSON.stringify(existingFields?.changed_paths ?? []) && (mode === "lean" || (existingFields?.strategy_revision ?? 0) === effectiveStrategyRevision) && expectedId === evidenceTipId;
        if (!sameInputs) throw new Error(`stale or competing closeout conflicts with current Evidence tip ${evidenceTipId}`);
      }
      const projection2 = manualConstraintProjection({ checks: contract.checks, evidence: existingFields?.check_evidence ?? [] });
      const unattested = projection2.constraint_summary.legacy_unattested_verified_checks ?? [];
      if (unattested.length > 0) {
        throw new Error(`existing Evidence tip ${evidenceTipId} has receiptless verified machine Checks (${unattested.join(", ")}); run a fresh review and refresh them through its bounded correction route`);
      }
      return {
        duplicate: true,
        artifact: existing?.text ?? null,
        artifact_hash: existing ? sha2563(existing.text) : null,
        fields: existingFields,
        ...projection2
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
  const unresolvedRootChecks = correction ? rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths2) : /* @__PURE__ */ new Map();
  const suppliedCheckIds = new Set((checkEvidence2 ?? []).map((entry) => entry?.check_id));
  const missingRootRefresh = [...unresolvedRootChecks.keys()].filter((checkId) => !suppliedCheckIds.has(checkId));
  if (missingRootRefresh.length > 0) {
    throw new Error(`correction closeout requires fresh evidence for affected, failed, missing, stale, or ambiguous Root Checks: ${missingRootRefresh.join(", ")}`);
  }
  const plannedChecks = expectedCheckMap(contract, correction, unresolvedRootChecks);
  const entries = normalizeCheckEvidence(checkEvidence2, plannedChecks, roots, mode, {
    enforceManualCheckReceipts: requireManualReceipts,
    manualCheckReceipts
  });
  const rootObjectives = contract.objectives;
  const affectedObjectives = correction ? unique3([...correctionObjectives(correction), ...entries.flatMap((entry) => checkObjectives(roots.get(entry.check_id)))]) : [...rootObjectives];
  const affected = affectedObjectives.length > 0 ? affectedObjectives : [...rootObjectives];
  const reusedObjectives = representation === "delta" ? rootObjectives.filter((id2) => !affected.includes(id2)) : [];
  const executedChecks = entries.map((entry) => entry.check_id);
  const reusedChecks = representation === "delta" ? [...roots.keys()].filter((id2) => !executedChecks.includes(id2)) : [];
  const reusedEvidence = representation === "delta" ? inheritedCheckEvidence(priorInspection, predecessorEvidence, reusedChecks) : [];
  const effectiveEntries = [...entries, ...reusedEvidence];
  const grade = overallGrade(effectiveEntries);
  const status = artifactStatus(grade);
  const paths = unique3(changedPaths2.map(String).map((path) => path.trim()).filter(Boolean)).sort();
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
    summary
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
    ...mode === "full" ? { strategy_revision: effectiveStrategyRevision } : {},
    evidence_mode: mode,
    overall_grade: grade,
    changed_paths: paths,
    affected_objectives: affected,
    reused_objectives: reusedObjectives,
    executed_checks: executedChecks,
    reused_checks: reusedChecks,
    check_evidence: entries
  };
  const renderedSummary = summaryText(summary, status, grade);
  const body = mode === "lean" ? `## Summary

${renderedSummary}` : fullBody({ fields, contract, entries, changedPaths: paths, correction, repositorySnapshot, summary: renderedSummary });
  const artifact = `---
${(0, import_yaml.stringify)(fields, { lineWidth: 0 }).trimEnd()}
---

${body}
`;
  const finalEntries = [...normalized.entries, { label: id, text: artifact }];
  const inspection = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (inspection.errors.length > 0) throw new Error(`generated delivery evidence is invalid: ${inspection.errors.join("; ")}`);
  const projection = manualConstraintProjection({ checks: contract.checks, evidence: effectiveEntries });
  return {
    duplicate: false,
    artifact,
    artifact_hash: sha2563(artifact),
    fields,
    evidence_mode: mode,
    overall_grade: grade,
    status,
    ...projection
  };
}
function persistCloseout({ handoffStore, rootPlanText, artifacts = [], closeout }) {
  if (!closeout?.artifact || !closeout?.fields?.id) throw new Error("persistCloseout requires a generated delivery artifact");
  const entries = [{ label: "root", text: rootPlanText }, ...artifacts, { label: closeout.fields.id, text: closeout.artifact }];
  const byId = /* @__PURE__ */ new Map();
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
      warning: `optional cross-task handoff unavailable: ${error.message}; task-local continuation remains valid`
    };
  }
}

// src/controller/work-review-builder.mjs
var import_yaml2 = __toESM(require_dist(), 1);
import { createHash as createHash6 } from "node:crypto";
var ASSESSMENTS = /* @__PURE__ */ new Set([
  "achieved",
  "provisional",
  "mostly-achieved",
  "partially-achieved",
  "not-achieved",
  "insufficient-evidence"
]);
var ASSESSMENT_RANK = Object.freeze({
  "insufficient-evidence": 0,
  "not-achieved": 1,
  "partially-achieved": 2,
  "mostly-achieved": 3,
  provisional: 4,
  achieved: 5
});
var ACTIONS = /* @__PURE__ */ new Set(["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"]);
var SEVERITIES = /* @__PURE__ */ new Set(["low", "medium", "high", "critical"]);
var RESOLUTIONS = /* @__PURE__ */ new Set(["correct", "clarify", "replan"]);
var SNAPSHOT_ASSESSMENTS = /* @__PURE__ */ new Set(["consistent", "contradicted", "incomplete"]);
var AUDITOR_ROLES = /* @__PURE__ */ new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);
var COSTS = /* @__PURE__ */ new Set(["cheap", "standard", "expensive"]);
var KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function sha2564(value) {
  return createHash6("sha256").update(String(value)).digest("hex");
}
function compareCanonical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function stable4(value) {
  if (Array.isArray(value)) return value.map(stable4);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort(compareCanonical).map((key) => [key, stable4(value[key])]));
}
function stableJson2(value) {
  return JSON.stringify(stable4(value));
}
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}
function closed(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported field ${unknown[0]}`);
}
function requiredField(value, key, label = "review_input") {
  if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${label}.${key} is required`);
  return value[key];
}
function line(value, label, { required = true, max = 2e3 } = {}) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return normalized;
}
function enumValue(value, values, label) {
  const normalized = String(value ?? "").trim();
  if (!values.has(normalized)) throw new Error(`${label} has invalid value ${normalized || "<missing>"}`);
  return normalized;
}
function list(value, label, { max = 64, required = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (required && value.length === 0) throw new Error(`${label} must not be empty`);
  if (value.length > max) throw new Error(`${label} exceeds ${max} items`);
  return value;
}
function uniqueSorted(values) {
  return [...new Set(values)].sort(compareCanonical);
}
function normalizeIds(value, pattern, allowed, label) {
  const normalized = uniqueSorted(list(value, label, { required: true }).map((entry) => line(entry, label, { max: 80 })));
  for (const id of normalized) {
    if (!pattern.test(id) || !allowed.has(id)) throw new Error(`${label} contains unknown ${id}`);
  }
  return normalized;
}
function localKey(value, label) {
  const normalized = line(value, label, { max: 80 });
  if (!KEY.test(normalized)) throw new Error(`${label} must be a lowercase semantic key`);
  return normalized;
}
function normalizeFindings(value, contract) {
  const objectiveIds = new Set(contract.objectives);
  const checkIds = new Set(contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]));
  const findings = list(value, "review_input.findings", { max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.findings[${index}]`);
    closed(item, ["key", "severity", "objective_ids", "check_ids", "evidence", "reasoning", "resolution"], `review_input.findings[${index}]`);
    return {
      key: localKey(item.key, `review_input.findings[${index}].key`),
      severity: enumValue(item.severity, SEVERITIES, `review_input.findings[${index}].severity`),
      objective_ids: normalizeIds(item.objective_ids, /^OBJ-[1-9][0-9]*$/, objectiveIds, `review_input.findings[${index}].objective_ids`),
      check_ids: normalizeIds(item.check_ids, /^CHECK-[1-9][0-9]*$/, checkIds, `review_input.findings[${index}].check_ids`),
      evidence: line(item.evidence, `review_input.findings[${index}].evidence`, { max: 4e3 }),
      reasoning: line(item.reasoning, `review_input.findings[${index}].reasoning`, { max: 4e3 }),
      resolution: enumValue(item.resolution, RESOLUTIONS, `review_input.findings[${index}].resolution`)
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(findings.map((finding) => finding.key)).size !== findings.length) throw new Error("review_input.findings keys must be unique");
  return findings;
}
function normalizeAuditors(value) {
  const reports = list(value, "review_input.auditor_reports", { max: 3 }).map((entry, index) => {
    const item = object(entry, `review_input.auditor_reports[${index}]`);
    closed(item, ["role", "assessment", "summary"], `review_input.auditor_reports[${index}]`);
    return {
      role: enumValue(item.role, AUDITOR_ROLES, `review_input.auditor_reports[${index}].role`),
      assessment: enumValue(item.assessment, ASSESSMENTS, `review_input.auditor_reports[${index}].assessment`),
      summary: line(item.summary, `review_input.auditor_reports[${index}].summary`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.role, right.role));
  if (new Set(reports.map((report) => report.role)).size !== reports.length) throw new Error("review_input.auditor_reports roles must be unique");
  return reports;
}
function normalizeCorrection(value, findingKeys) {
  if (value == null) return null;
  const correction = object(value, "review_input.correction");
  closed(correction, ["fixes", "steps", "checks", "learning_candidates"], "review_input.correction");
  const fixes = list(correction.fixes, "review_input.correction.fixes", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.fixes[${index}]`);
    closed(item, ["key", "finding_keys", "required_outcome", "evidence"], `review_input.correction.fixes[${index}]`);
    const keys = uniqueSorted(list(item.finding_keys, `review_input.correction.fixes[${index}].finding_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.fixes[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.fixes[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.fixes[${index}].key`),
      finding_keys: keys,
      required_outcome: line(item.required_outcome, `review_input.correction.fixes[${index}].required_outcome`, { max: 2e3 }),
      evidence: line(item.evidence, `review_input.correction.fixes[${index}].evidence`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  const fixKeys = new Set(fixes.map((fix) => fix.key));
  if (fixKeys.size !== fixes.length) throw new Error("review_input.correction.fixes keys must be unique");
  const checks = list(correction.checks, "review_input.correction.checks", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.checks[${index}]`);
    closed(item, ["key", "fix_keys", "working_directory", "command_or_inspection", "expected_result", "required", "cost_class", "prerequisites"], `review_input.correction.checks[${index}]`);
    const referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.checks[${index}].fix_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.checks[${index}].fix_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.checks[${index}] references an unknown fix`);
    const prerequisites = uniqueSorted(list(item.prerequisites, `review_input.correction.checks[${index}].prerequisites`, { required: true }).map((entryValue) => line(entryValue, `review_input.correction.checks[${index}].prerequisites`, { max: 1e3 })));
    if (typeof item.required !== "boolean") throw new Error(`review_input.correction.checks[${index}].required must be a boolean`);
    return {
      key: localKey(item.key, `review_input.correction.checks[${index}].key`),
      fix_keys: referencedFixes,
      working_directory: line(item.working_directory, `review_input.correction.checks[${index}].working_directory`, { max: 1e3 }),
      command_or_inspection: line(item.command_or_inspection, `review_input.correction.checks[${index}].command_or_inspection`, { max: 2e3 }),
      expected_result: line(item.expected_result, `review_input.correction.checks[${index}].expected_result`, { max: 2e3 }),
      required: item.required,
      cost_class: enumValue(item.cost_class, COSTS, `review_input.correction.checks[${index}].cost_class`),
      prerequisites
    };
  }).sort((left, right) => ({ cheap: 0, standard: 1, expensive: 2 })[left.cost_class] - { cheap: 0, standard: 1, expensive: 2 }[right.cost_class] || compareCanonical(left.key, right.key));
  const checkKeys = new Set(checks.map((check) => check.key));
  if (checkKeys.size !== checks.length) throw new Error("review_input.correction.checks keys must be unique");
  const steps = list(correction.steps, "review_input.correction.steps", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.steps[${index}]`);
    closed(item, ["key", "fix_keys", "targets", "required_outcome", "implementation_latitude", "completion_probe", "check_keys", "deviation_action"], `review_input.correction.steps[${index}]`);
    const referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.steps[${index}].fix_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.steps[${index}].fix_keys`)));
    const referencedChecks = uniqueSorted(list(item.check_keys, `review_input.correction.steps[${index}].check_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.steps[${index}].check_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown fix`);
    if (referencedChecks.some((key) => !checkKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown check`);
    return {
      key: localKey(item.key, `review_input.correction.steps[${index}].key`),
      fix_keys: referencedFixes,
      targets: uniqueSorted(list(item.targets, `review_input.correction.steps[${index}].targets`, { required: true }).map((target) => line(target, `review_input.correction.steps[${index}].targets`, { max: 1e3 }))),
      required_outcome: line(item.required_outcome, `review_input.correction.steps[${index}].required_outcome`, { max: 2e3 }),
      implementation_latitude: line(item.implementation_latitude, `review_input.correction.steps[${index}].implementation_latitude`, { max: 2e3 }),
      completion_probe: line(item.completion_probe, `review_input.correction.steps[${index}].completion_probe`, { max: 2e3 }),
      check_keys: referencedChecks,
      deviation_action: line(item.deviation_action, `review_input.correction.steps[${index}].deviation_action`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  const stepKeys = new Set(steps.map((step) => step.key));
  if (stepKeys.size !== steps.length) throw new Error("review_input.correction.steps keys must be unique");
  for (const fix of fixKeys) if (!steps.some((step) => step.fix_keys.includes(fix))) throw new Error(`review_input.correction.steps do not cover ${fix}`);
  const learningCandidates = list(correction.learning_candidates, "review_input.correction.learning_candidates", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.learning_candidates[${index}]`);
    closed(item, ["key", "finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"], `review_input.correction.learning_candidates[${index}]`);
    const keys = uniqueSorted(list(item.finding_keys, `review_input.correction.learning_candidates[${index}].finding_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.learning_candidates[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.learning_candidates[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.learning_candidates[${index}].key`),
      finding_keys: keys,
      reusable_guidance: line(item.reusable_guidance, `review_input.correction.learning_candidates[${index}].reusable_guidance`, { max: 2e3 }),
      candidate_targets: uniqueSorted(list(item.candidate_targets, `review_input.correction.learning_candidates[${index}].candidate_targets`, { required: true }).map((target) => line(target, `review_input.correction.learning_candidates[${index}].candidate_targets`, { max: 1e3 }))),
      confirmation_evidence: line(item.confirmation_evidence, `review_input.correction.learning_candidates[${index}].confirmation_evidence`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(learningCandidates.map((candidate) => candidate.key)).size !== learningCandidates.length) throw new Error("review_input.correction.learning_candidates keys must be unique");
  return { fixes, checks, steps, learning_candidates: learningCandidates };
}
function normalizeReviewInput(input, contract) {
  const value = object(input, "review_input");
  closed(value, ["schema", "kind", "assessment", "recommended_action", "assessment_summary", "snapshot_assessment", "snapshot_summary", "findings", "missing_evidence", "auditor_reports", "correction"], "review_input");
  if (value.schema !== 1) throw new Error("review_input.schema must be 1");
  if (value.kind !== "review-input") throw new Error("review_input.kind must be review-input");
  const findings = normalizeFindings(requiredField(value, "findings"), contract);
  const findingKeys = new Set(findings.map((finding) => finding.key));
  const normalized = {
    schema: 1,
    kind: "review-input",
    assessment: enumValue(requiredField(value, "assessment"), ASSESSMENTS, "review_input.assessment"),
    recommended_action: enumValue(requiredField(value, "recommended_action"), ACTIONS, "review_input.recommended_action"),
    assessment_summary: line(requiredField(value, "assessment_summary"), "review_input.assessment_summary", { max: 2e3 }),
    snapshot_assessment: enumValue(requiredField(value, "snapshot_assessment"), SNAPSHOT_ASSESSMENTS, "review_input.snapshot_assessment"),
    snapshot_summary: line(requiredField(value, "snapshot_summary"), "review_input.snapshot_summary", { max: 2e3 }),
    findings,
    missing_evidence: uniqueSorted(list(requiredField(value, "missing_evidence"), "review_input.missing_evidence", { max: 32 }).map((entry) => line(entry, "review_input.missing_evidence", { max: 2e3 }))),
    auditor_reports: normalizeAuditors(requiredField(value, "auditor_reports")),
    correction: normalizeCorrection(value.correction, findingKeys)
  };
  if (normalized.recommended_action === "correct") {
    if (normalized.findings.length === 0) throw new Error("review_input correct requires at least one finding");
    if (!normalized.correction) throw new Error("review_input correct requires a correction proposal");
  } else if (normalized.correction) {
    throw new Error("review_input.correction is allowed only for recommended_action correct");
  }
  return normalized;
}
function mergeChain(rootPlanText, artifacts, pluginRoot) {
  const rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan" || rootInspection.artifact.fields.schema !== 5) {
    throw new Error(`review builder requires an exact valid Schema-5 Root: ${rootInspection.errors.join("; ") || "not a work-plan"}`);
  }
  const byId = /* @__PURE__ */ new Map([[rootInspection.artifact.fields.id, { label: rootInspection.artifact.fields.id, text: rootPlanText }]]);
  for (const [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) throw new Error(`review builder artifact ${index + 1} requires exact text`);
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`review builder artifact ${entry.label ?? index + 1} is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const builderProvenance = entry.builder_provenance ?? entry.provenance ?? null;
    const protectedLegacyReview = entry.legacy_review_recorded === true;
    if (inspected.artifact.fields.artifact === "work-review") {
      const validBuilderProvenance = builderProvenance?.schema === 1 && builderProvenance?.kind === "host-work-review-builder" && /^[a-f0-9]{64}$/.test(String(builderProvenance?.review_input_hash ?? "")) && builderProvenance?.artifact_hash === sha2564(entry.text) && Object.keys(builderProvenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
      if (builderProvenance && !validBuilderProvenance) {
        throw codedError("review-artifact-rejected", `review builder artifact ${id} has invalid host builder provenance`);
      }
      if (!validBuilderProvenance && !protectedLegacyReview) {
        throw codedError("review-artifact-rejected", `review builder rejects newly imported work-review ${id} without protected builder provenance; Root, Evidence, and repository work remain unchanged, so repeat Review from the exact Root/Evidence chain in this task`);
      }
    }
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`review builder artifact ${id} has conflicting immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...builderProvenance ? { builder_provenance: builderProvenance } : {},
      ...protectedLegacyReview ? { legacy_review_recorded: true } : {}
    });
  }
  return { rootFields: rootInspection.artifact.fields, entries: [...byId.values()] };
}
function knownFailure(evidence) {
  return evidence?.fields?.status === "blocked" || (evidence?.fields?.check_evidence ?? []).some((entry) => entry.grade === "failed");
}
function decision(input, evidence) {
  for (const report of input.auditor_reports) {
    if (ASSESSMENT_RANK[report.assessment] < ASSESSMENT_RANK[input.assessment]) {
      throw new Error(`review_input.assessment ${input.assessment} is more positive than review_input.auditor_reports ${report.role} assessment ${report.assessment}`);
    }
  }
  const failed = knownFailure(evidence);
  const reviewReady = evidence?.effective?.reviewReady === true && evidence?.fields?.status === "complete";
  const hasFindings = input.findings.length > 0;
  const missing = input.missing_evidence.length > 0 || input.snapshot_assessment !== "consistent";
  let assessment = input.assessment;
  let nextAction = input.recommended_action;
  let deliveryStatus = "blocked";
  if (failed) {
    if (nextAction === "replan" || nextAction === "clarify") {
      assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment;
    } else if (hasFindings && input.correction) {
      nextAction = "correct";
      assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment;
    } else {
      nextAction = "retry-review";
      assessment = "insufficient-evidence";
    }
    return { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: true };
  }
  if (nextAction === "replan" || nextAction === "clarify") {
    assessment = ["achieved", "provisional"].includes(assessment) ? "partially-achieved" : assessment;
    return { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: false };
  }
  if (nextAction === "correct" || hasFindings) {
    if (!input.correction || !hasFindings) throw new Error("review findings requiring correction need one complete correction proposal");
    assessment = ["achieved", "provisional"].includes(assessment) ? "mostly-achieved" : assessment;
    return { assessment, delivery_status: "blocked", next_action: "correct", review_ready: reviewReady, known_failure: false };
  }
  if (missing || nextAction === "retry-review" || assessment === "insufficient-evidence") {
    return { assessment: "insufficient-evidence", delivery_status: "blocked", next_action: "retry-review", review_ready: reviewReady, known_failure: false };
  }
  if (reviewReady && assessment === "achieved" && nextAction === "none") {
    return { assessment: "achieved", delivery_status: "verified", next_action: "none", review_ready: true, known_failure: false };
  }
  if (!["none", "accept-provisional"].includes(nextAction)) throw new Error(`review_input recommended_action ${nextAction} is inconsistent with an evidence-only provisional result`);
  if (!["achieved", "provisional"].includes(assessment)) {
    throw new Error(`review_input.assessment ${assessment} is inconsistent with review_input.recommended_action ${nextAction}; provide the missing Evidence or choose correct, clarify, replan, or retry-review`);
  }
  return { assessment: "provisional", delivery_status: "provisional", next_action: "accept-provisional", review_ready: reviewReady, known_failure: false };
}
function routeFor(rootFields, input, outcome) {
  const roles = new Set(input.auditor_reports.map((report) => report.role));
  const deterministicBlocked = outcome.delivery_status === "blocked" && (outcome.next_action === "replan" || outcome.next_action === "correct" && outcome.known_failure);
  const fullRequired = rootFields.contract_level === "certified" || rootFields.risk === "high" || (rootFields.hard_triggers ?? []).length > 0;
  if (roles.has("risk-auditor")) {
    if (!roles.has("delivery-auditor")) throw new Error("risk-auditor review input also requires delivery-auditor input");
    return { review_route: "full", auditors_run: ["inline", "delivery-auditor", "risk-auditor", ...roles.has("work-design-auditor") ? ["work-design-auditor"] : []] };
  }
  if (fullRequired && !deterministicBlocked) throw new Error("certified, high-risk, or hard-trigger review requires delivery-auditor and risk-auditor reports");
  if (roles.has("delivery-auditor")) return { review_route: "targeted", auditors_run: ["inline", "delivery-auditor"] };
  if (roles.has("work-design-auditor")) return { review_route: "targeted", auditors_run: ["inline", "work-design-auditor"] };
  return { review_route: "inline", auditors_run: ["inline"] };
}
function cell2(value) {
  const text = String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
  return text || "none";
}
function table2(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell2(row[header])).join(" | ")} |`)
  ].join("\n");
}
function nextCheckNumber(entries, pluginRoot) {
  let maximum = 0;
  for (const entry of entries) {
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    const matches = entry.text.match(/\bCHECK-([1-9][0-9]*)\b/g) ?? [];
    for (const match of matches) maximum = Math.max(maximum, Number(match.slice(6)));
    if (inspected.errors.length > 0) continue;
  }
  return maximum + 1;
}
function correctionProjection({ normalized, findings, seed, rootFields, evidenceId, reviewId, predecessorReview, entries, pluginRoot }) {
  if (!normalized.correction) return null;
  const correctionId = `cp-${rootFields.id.replace(/^wp-/, "")}-${seed.slice(0, 12)}`;
  const fixIds = new Map(normalized.correction.fixes.map((fix, index) => [fix.key, `FIX-${index + 1}`]));
  const stepIds = new Map(normalized.correction.steps.map((step, index) => [step.key, `STEP-${index + 1}`]));
  const checkStart = nextCheckNumber(entries, pluginRoot);
  const checkIds = new Map(normalized.correction.checks.map((check, index) => [check.key, `CHECK-${checkStart + index}`]));
  const learningIds = new Map(normalized.correction.learning_candidates.map((candidate, index) => [candidate.key, `LRN-${seed.slice(0, 8)}-${index + 1}`]));
  const findingsByKey = new Map(findings.map((finding) => [finding.key, finding]));
  const fixes = normalized.correction.fixes.map((fix) => {
    const mapped = fix.finding_keys.map((key) => findingsByKey.get(key));
    return {
      "FIX ID": fixIds.get(fix.key),
      "Finding keys": fix.finding_keys.join(", "),
      "Root Objectives": uniqueSorted(mapped.flatMap((finding) => finding.objective_ids)).join(", "),
      "Root Checks": uniqueSorted(mapped.flatMap((finding) => finding.check_ids)).join(", "),
      "Required outcome": fix.required_outcome,
      Evidence: fix.evidence
    };
  });
  const steps = normalized.correction.steps.map((step, index) => ({
    "Step ID": stepIds.get(step.key),
    "FIX IDs": step.fix_keys.map((key) => fixIds.get(key)).join(", "),
    Targets: step.targets.join(", "),
    "Required outcome": step.required_outcome,
    "Implementation latitude": step.implementation_latitude,
    "Completion probe": `PROBE-${index + 1}: ${step.completion_probe}`,
    "Check IDs": step.check_keys.map((key) => checkIds.get(key)).join(", "),
    "Deviation action": step.deviation_action
  }));
  const checks = normalized.correction.checks.map((check) => ({
    "Check ID": checkIds.get(check.key),
    "FIX IDs": check.fix_keys.map((key) => fixIds.get(key)).join(", "),
    "Working Directory": check.working_directory,
    "Command or Inspection": check.command_or_inspection,
    "Expected Result": check.expected_result,
    Required: check.required ? "yes" : "no",
    "Cost Class": check.cost_class,
    Prerequisites: check.prerequisites.join(", ")
  }));
  const learnings = normalized.correction.learning_candidates.map((candidate) => ({
    "Learning ID": learningIds.get(candidate.key),
    "Finding keys": candidate.finding_keys.join(", "),
    "Reusable guidance": candidate.reusable_guidance,
    "Candidate targets": candidate.candidate_targets.join(", "),
    "Confirmation evidence": candidate.confirmation_evidence
  }));
  const predecessorCorrection = predecessorReview?.fields?.correction_id ?? "None.";
  const body = [
    `## Correction plan

### ${correctionId}`,
    table2(["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"], [{
      "Correction ID": correctionId,
      "Root Plan": rootFields.id,
      "Source Review": reviewId,
      "Base Evidence": evidenceId,
      "Predecessor Correction": predecessorCorrection,
      Risk: rootFields.risk
    }]),
    table2(["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"], fixes),
    table2(["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"], steps),
    table2(["Check ID", "FIX IDs", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"], checks),
    table2(["Learning ID", "Finding keys", "Reusable guidance", "Candidate targets", "Confirmation evidence"], learnings)
  ].join("\n\n");
  return { correction_id: correctionId, learning_ids: [...learningIds.values()], body };
}
function reviewBody({ normalized, outcome, route, coverage, evidenceId, correction }) {
  const sections = [
    `## Assessment

${outcome.assessment}: ${normalized.assessment_summary}`,
    `## Evidence coverage

${table2(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: coverage.inspectedObjectives.join(", ") || "none", Reused: coverage.reusedObjectives.join(", ") || "none", Result: outcome.assessment, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Checks", Inspected: coverage.inspectedChecks.join(", ") || "none", Reused: coverage.reusedChecks.join(", ") || "none", Result: outcome.delivery_status === "verified" ? "passed" : outcome.delivery_status, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Auditors", Inspected: route.auditors_run.join(", "), Reused: "none", Result: "complete", Evidence: "validated review input" },
      { Kind: "Snapshot", Inspected: evidenceId, Reused: "none", Result: normalized.snapshot_assessment, Evidence: normalized.snapshot_summary }
    ])}`,
    normalized.findings.length === 0 ? "## Findings\n\nNone." : `## Findings

${table2(["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning"], normalized.findings.map((finding) => ({
      "Finding key": finding.key,
      Severity: finding.severity,
      Objectives: finding.objective_ids.join(", "),
      Checks: finding.check_ids.join(", "),
      Evidence: finding.evidence,
      Reasoning: finding.reasoning
    })))}`,
    `## Next action

${outcome.next_action}: ${outcome.next_action === "none" ? "No further Workflow action is required." : `Continue through the bounded ${outcome.next_action} route in this task.`}`
  ];
  if (correction) sections.push(correction.body);
  return sections.join("\n\n");
}
function boundaryBody(receipt) {
  return [
    "## Assessment\n\ninsufficient-evidence: deterministic Evidence recovery is unavailable for the exact current boundary.",
    `## Evidence coverage

${table2(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Checks", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Auditors", Inspected: "inline", Reused: "none", Result: "complete", Evidence: "host boundary validation" },
      { Kind: "Snapshot", Inspected: receipt.repository_snapshot_hash, Reused: "none", Result: "incomplete", Evidence: receipt.recovery_error_code }
    ])}`,
    "## Findings\n\nNone.",
    "## Next action\n\nreplan: create a fresh Root through separate human approval."
  ].join("\n\n");
}
function buildWorkReview({
  rootPlanText,
  artifacts = [],
  reviewInput = null,
  boundaryReceipt = null,
  boundaryReceiptVerifier = null,
  pluginRoot
}) {
  const merged = mergeChain(rootPlanText, artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 5) throw new Error(`review builder Root is invalid: ${contract.errors.join("; ")}`);
  const inspectionOptions = boundaryReceipt && typeof boundaryReceiptVerifier === "function" ? { boundaryReceiptVerifier } : {};
  const prior = inspectArtifactSet(merged.entries.map((entry) => [entry.label, entry.text]), pluginRoot, inspectionOptions);
  if (prior.errors.length > 0) throw new Error(`review builder input chain is invalid: ${prior.errors.join("; ")}`);
  const tips = effectiveCliSummary(prior);
  const predecessorReviewId = tips.review_tips[merged.rootFields.id] ?? null;
  const predecessorReview = predecessorReviewId ? prior.effective.get(predecessorReviewId) : null;
  const predecessorReviewText = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId)?.text ?? "" : "";
  if (boundaryReceipt) {
    if (typeof boundaryReceiptVerifier !== "function") throw new Error("root-boundary review requires a protected host verifier");
    const trusted = boundaryReceiptVerifier({ receipt: boundaryReceipt, rootPlanText, reviewFields: null });
    if (trusted?.ok !== true) throw new Error(`root-boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
    const seedInput2 = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      predecessor_review_id: predecessorReviewId,
      predecessor_review_hash: predecessorReviewText ? sha2564(predecessorReviewText) : null,
      boundary_receipt: boundaryReceipt
    };
    const reviewInputHash2 = sha2564(stableJson2(seedInput2));
    const id2 = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash2.slice(0, 12)}`;
    const fields2 = {
      artifact: "work-review",
      schema: 5,
      id: id2,
      status: "complete",
      root_plan_id: merged.rootFields.id,
      latest_evidence_id: null,
      review_basis: "root-boundary",
      boundary_receipt: boundaryReceipt,
      assessment: "insufficient-evidence",
      delivery_status: "blocked",
      review_route: "inline",
      next_action: "replan",
      correction_id: null,
      predecessor_review_id: predecessorReviewId,
      inspected_objectives: [],
      reused_objectives: [],
      inspected_checks: [],
      reused_checks: [],
      auditors_run: ["inline"]
    };
    const artifact2 = `---
${(0, import_yaml2.stringify)(fields2, { lineWidth: 0 }).trimEnd()}
---

${boundaryBody(boundaryReceipt)}
`;
    const duplicate2 = merged.entries.find((entry) => entry.label === id2);
    if (duplicate2 && duplicate2.text !== artifact2) throw new Error(`review builder generated conflicting immutable bytes for ${id2}`);
    const finalEntries2 = duplicate2 ? merged.entries : [...merged.entries, { label: id2, text: artifact2 }];
    const validated2 = inspectArtifactSet(finalEntries2.map((entry) => [entry.label, entry.text]), pluginRoot, { boundaryReceiptVerifier });
    if (validated2.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated2.errors.join("; ")}`);
    const artifactHash2 = sha2564(artifact2);
    return { duplicate: Boolean(duplicate2), artifact: artifact2, artifact_hash: artifactHash2, review_input_hash: reviewInputHash2, fields: fields2, provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: reviewInputHash2, artifact_hash: artifactHash2 } };
  }
  const evidenceId = tips.evidence_tips[merged.rootFields.id] ?? null;
  if (!evidenceId) throw new Error("review builder requires the exact current Evidence tip");
  const evidence = prior.effective.get(evidenceId);
  const evidenceText = merged.entries.find((entry) => entry.label === evidenceId)?.text;
  if (!evidence || !evidenceText) throw new Error(`review builder cannot resolve exact Evidence ${evidenceId}`);
  let normalized;
  let outcome;
  let route;
  try {
    normalized = normalizeReviewInput(reviewInput, contract);
    outcome = decision(normalized, evidence);
    route = routeFor(merged.rootFields, normalized, outcome);
  } catch (error) {
    if (error?.code) throw error;
    throw codedError("review-input-invalid", error?.message ?? "review_input is invalid");
  }
  const currentReviewEntry = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId) : null;
  const currentProvenance = currentReviewEntry?.builder_provenance;
  if (currentProvenance?.schema === 1 && currentProvenance?.kind === "host-work-review-builder" && currentProvenance?.artifact_hash === sha2564(currentReviewEntry.text) && predecessorReview?.fields?.latest_evidence_id === evidenceId) {
    const priorPredecessorId = predecessorReview.fields.predecessor_review_id ?? null;
    const priorPredecessorText = priorPredecessorId ? merged.entries.find((entry) => entry.label === priorPredecessorId)?.text ?? "" : "";
    const retrySeed = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      evidence_id: evidenceId,
      evidence_hash: sha2564(evidenceText),
      predecessor_review_id: priorPredecessorId,
      predecessor_review_hash: priorPredecessorText ? sha2564(priorPredecessorText) : null,
      auditors_run: route.auditors_run,
      review_input: normalized
    };
    const retryInputHash = sha2564(stableJson2(retrySeed));
    if (retryInputHash === currentProvenance.review_input_hash && predecessorReviewId === `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${retryInputHash.slice(0, 12)}`) {
      return {
        duplicate: true,
        artifact: currentReviewEntry.text,
        artifact_hash: currentProvenance.artifact_hash,
        review_input_hash: retryInputHash,
        fields: predecessorReview.fields,
        normalized_review_input: normalized,
        outcome,
        provenance: currentProvenance
      };
    }
  }
  const rootChecks = contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]);
  const reusedObjectives = predecessorReviewId ? (evidence.fields.reused_objectives ?? []).filter((id2) => contract.objectives.includes(id2)).sort(compareCanonical) : [];
  const reusedChecks = predecessorReviewId ? (evidence.fields.reused_checks ?? []).filter((id2) => rootChecks.includes(id2)).sort(compareCanonical) : [];
  const coverage = {
    reusedObjectives,
    inspectedObjectives: contract.objectives.filter((id2) => !reusedObjectives.includes(id2)),
    reusedChecks,
    inspectedChecks: rootChecks.filter((id2) => !reusedChecks.includes(id2))
  };
  const seedInput = {
    schema: 1,
    root_content_hash: rootContentHash(rootPlanText),
    root_projection_hash: contract.authoritative_projection_hash,
    evidence_id: evidenceId,
    evidence_hash: sha2564(evidenceText),
    predecessor_review_id: predecessorReviewId,
    predecessor_review_hash: predecessorReviewText ? sha2564(predecessorReviewText) : null,
    auditors_run: route.auditors_run,
    review_input: normalized
  };
  const reviewInputHash = sha2564(stableJson2(seedInput));
  const id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash.slice(0, 12)}`;
  const correction = correctionProjection({ normalized, findings: normalized.findings, seed: reviewInputHash, rootFields: merged.rootFields, evidenceId, reviewId: id, predecessorReview, entries: merged.entries, pluginRoot });
  const fields = {
    artifact: "work-review",
    schema: 5,
    id,
    status: "complete",
    root_plan_id: merged.rootFields.id,
    latest_evidence_id: evidenceId,
    assessment: outcome.assessment,
    delivery_status: outcome.delivery_status,
    review_route: route.review_route,
    next_action: outcome.next_action,
    correction_id: correction?.correction_id ?? null,
    predecessor_review_id: predecessorReviewId,
    auditors_run: route.auditors_run,
    inspected_objectives: coverage.inspectedObjectives,
    reused_objectives: coverage.reusedObjectives,
    inspected_checks: coverage.inspectedChecks,
    reused_checks: coverage.reusedChecks,
    ...correction ? { learning_candidates: correction.learning_ids } : {}
  };
  const artifact = `---
${(0, import_yaml2.stringify)(fields, { lineWidth: 0 }).trimEnd()}
---

${reviewBody({ normalized, outcome, route, coverage, evidenceId, correction })}
`;
  const duplicate = merged.entries.find((entry) => entry.label === id);
  if (duplicate && duplicate.text !== artifact) throw new Error(`review builder generated conflicting immutable bytes for ${id}`);
  const finalEntries = duplicate ? merged.entries : [...merged.entries, { label: id, text: artifact }];
  const validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join("; ")}`);
  const artifactHash = sha2564(artifact);
  return {
    duplicate: Boolean(duplicate),
    artifact,
    artifact_hash: artifactHash,
    review_input_hash: reviewInputHash,
    fields,
    normalized_review_input: normalized,
    outcome,
    provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: reviewInputHash, artifact_hash: artifactHash }
  };
}
function persistWorkReview({ handoffStore, rootPlanText, artifacts = [], review }) {
  if (!review?.artifact || !review?.fields?.id || !review?.provenance) throw new Error("persistWorkReview requires one generated work-review");
  try {
    const byId = /* @__PURE__ */ new Map();
    for (const entry of [{ label: review.fields.root_plan_id, text: rootPlanText }, ...artifacts, { label: review.fields.id, text: review.artifact, provenance: review.provenance }]) {
      const inspected = inspectArtifactText(entry.text, handoffStore.pluginRoot);
      const id = inspected.artifact?.fields?.id ?? entry.label;
      const prior = byId.get(id);
      if (prior && prior.text !== entry.text) throw new Error(`work-review persistence found conflicting immutable bytes for ${id}`);
      byId.set(id, {
        label: id,
        text: entry.text,
        ...entry.provenance || entry.builder_provenance ? { provenance: entry.provenance ?? entry.builder_provenance } : prior?.provenance ? { provenance: prior.provenance } : {}
      });
    }
    const persisted = handoffStore.record([...byId.values()]);
    return { ...review, handoff_persisted: true, handoff_authoritative: false, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return {
      ...review,
      handoff_persisted: false,
      handoff_authoritative: false,
      handoff_error_code: "handoff-persist-failed",
      warning: `optional cross-task review handoff unavailable: ${error.message}; task-local Review remains valid`
    };
  }
}

// src/controller/engine.mjs
var profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 });
var secretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];
function learningSourceHashes(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? []).flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_decision_hash))))];
}
function learningSourceReceiptIds(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? []).flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_receipt_id))))].sort();
}
function jsonObject(text) {
  const source = String(text ?? "");
  const fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
function jsonDecision(text) {
  const value = jsonObject(text);
  if (!["achieved", "provisional", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"].includes(value.assessment)) throw new Error("review decision has invalid assessment");
  if (!["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"].includes(value.next_action)) throw new Error("review decision has invalid next_action");
  if (!Array.isArray(value.finding_keys)) throw new Error("review decision requires finding_keys");
  value.delivery_status ??= value.assessment === "achieved" ? "verified" : value.next_action === "accept-provisional" ? "provisional" : "blocked";
  value.learning_candidates = normalizeDecisionLearningCandidates(value.learning_candidates, value.finding_keys, value.next_action);
  if (value.learning_candidates.length > 0) {
    if (!Array.isArray(value.findings)) throw new Error("learning candidates require review findings");
    const describedFindings = new Set(value.findings.map((finding) => finding?.key ?? finding?.finding_key).filter(Boolean));
    if (value.learning_candidates.some((candidate) => candidate.finding_keys.some((key) => !describedFindings.has(key)))) {
      throw new Error("learning candidate references a finding without a valid review finding");
    }
  }
  return value;
}
function reviewerSummary(decision2) {
  if (typeof decision2?.assessment_summary !== "string") throw new Error("review decision requires assessment_summary as a string");
  const value = decision2.assessment_summary.trim();
  if (!value) throw new Error("review decision requires assessment_summary");
  return value;
}
function reviewerSnapshot(decision2) {
  if (!["consistent", "contradicted", "incomplete"].includes(decision2?.snapshot_assessment)) throw new Error("review decision requires a valid snapshot_assessment");
  if (typeof decision2?.snapshot_summary !== "string") throw new Error("review decision requires snapshot_summary as a string");
  const summary = decision2.snapshot_summary.trim();
  if (!summary) throw new Error("review decision requires snapshot_summary");
  return { assessment: decision2.snapshot_assessment, summary };
}
function controllerReviewInput(run, decision2, auditorReports = []) {
  if (!Array.isArray(decision2?.findings)) throw new Error("review decision requires findings as an array");
  if (!Array.isArray(decision2?.missing_evidence)) throw new Error("review decision requires missing_evidence as an array");
  const findingByKey = /* @__PURE__ */ new Map();
  for (const item of decision2.findings) {
    const rawKey = item?.key ?? item?.finding_key;
    if (typeof rawKey !== "string") throw new Error("review finding requires key as a string");
    const key = rawKey.trim();
    if (!key || findingByKey.has(key)) continue;
    if (typeof item?.summary !== "string" || typeof item?.evidence !== "string" || typeof item?.reasoning !== "string") {
      throw new Error(`review finding ${key || "<missing>"} requires string summary, evidence, and reasoning`);
    }
    const summary = item.summary.trim();
    const evidence = item.evidence.trim();
    const reasoning = item.reasoning.trim();
    if (!summary || !evidence || !reasoning) throw new Error(`review finding ${key || "<missing>"} requires summary, evidence, and reasoning`);
    if (!["low", "medium", "high", "critical"].includes(item.severity)) throw new Error(`review finding ${key} requires a typed severity`);
    if (!Array.isArray(item.objective_ids) || item.objective_ids.length === 0) throw new Error(`review finding ${key} requires objective_ids`);
    if (!Array.isArray(item.check_ids) || item.check_ids.length === 0) throw new Error(`review finding ${key} requires check_ids`);
    if (!["correct", "clarify", "replan"].includes(item.resolution)) throw new Error(`review finding ${key} requires a typed resolution`);
    findingByKey.set(key, {
      key,
      severity: item.severity,
      objective_ids: item.objective_ids,
      check_ids: item.check_ids,
      evidence,
      reasoning,
      resolution: item.resolution,
      summary
    });
  }
  const keys = [...new Set(decision2?.finding_keys ?? [])].sort();
  if (keys.some((key) => !findingByKey.has(key))) throw new Error("review decision finding_keys must each have one complete typed finding");
  const findings = keys.map((key) => findingByKey.get(key));
  const snapshot2 = reviewerSnapshot(decision2);
  const input = {
    schema: 1,
    kind: "review-input",
    assessment: decision2.assessment,
    recommended_action: decision2.next_action,
    assessment_summary: reviewerSummary(decision2),
    snapshot_assessment: snapshot2.assessment,
    snapshot_summary: snapshot2.summary,
    findings: findings.map(({ summary: _summary, ...finding }) => finding),
    missing_evidence: decision2.missing_evidence,
    auditor_reports: auditorReports
  };
  if (decision2.next_action !== "correct") return input;
  const learning = decision2.learning_candidates ?? [];
  if (learning.length === 0) throw new Error("correct review decision requires one typed learning candidate for Schema-5 correction lineage");
  const fixKeys = findings.map((finding) => `fix-${finding.key}`);
  const requiredChecks = (run.strategy?.checks ?? []).filter((check) => check.Required === "yes");
  if (requiredChecks.length === 0) throw new Error("correct review decision requires at least one Root Check");
  const checkKeys = requiredChecks.map((check) => `check-${String(check["Check ID"]).toLowerCase()}`);
  input.correction = {
    fixes: findings.map((finding) => ({
      key: `fix-${finding.key}`,
      finding_keys: [finding.key],
      required_outcome: finding.summary,
      evidence: finding.evidence
    })),
    checks: requiredChecks.map((check) => ({
      key: `check-${String(check["Check ID"]).toLowerCase()}`,
      fix_keys: fixKeys,
      working_directory: check["Working Directory"] ?? "repository root",
      command_or_inspection: check["Command or Inspection"],
      expected_result: check["Expected Result"],
      required: true,
      cost_class: check["Cost Class"] ?? "standard",
      prerequisites: String(check.Prerequisites ?? "Root-authorized correction").split(",").map((item) => item.trim()).filter(Boolean)
    })),
    steps: findings.map((finding) => ({
      key: `step-${finding.key}`,
      fix_keys: [`fix-${finding.key}`],
      targets: run.strategy?.primary_targets ?? run.plan.fields.authority.allowed_roots,
      required_outcome: finding.summary,
      implementation_latitude: "Use the smallest strategy-compatible correction inside the approved Root authority.",
      completion_probe: `The mapped finding ${finding.key} is absent and all correction Checks pass.`,
      check_keys: checkKeys,
      deviation_action: "Stop and replan if the immutable Root boundary or risk must change."
    })),
    learning_candidates: learning.map((candidate) => ({
      key: `learning-${controllerLearningCandidateSemanticHash(candidate).slice(0, 12)}`,
      finding_keys: candidate.finding_keys,
      reusable_guidance: candidate.reusable_guidance,
      candidate_targets: candidate.candidate_targets,
      confirmation_evidence: candidate.confirmation_evidence
    }))
  };
  return input;
}
function routeSelection(validation, role) {
  const result = validation.routes?.[role];
  if (!result?.valid || !result.selected_candidate || !result.model) throw new Error(`route ${role} has no validated candidate`);
  return {
    route: result.selected_candidate,
    acceptedModel: result.model,
    routePoolHash: result.pool_hash,
    selectionReason: result.selection_reason
  };
}
function selectedModelsCertified(routeValidation, certifiedModels) {
  if (!Array.isArray(certifiedModels) || certifiedModels.length === 0) return false;
  return Object.entries(routeValidation.routes ?? {}).every(([role, route]) => certifiedModels.some((model) => model.role === role && model.id === route.model?.id && JSON.stringify(model.params ?? []) === JSON.stringify(route.model?.params ?? [])));
}
function phaseReceiptBlockers(receipt, role, expectedProjectionHash = null) {
  const blockers = [];
  if (!receipt?.model_attested) blockers.push(`${role}-model-mismatch`);
  if (typeof receipt?.request_id !== "string" || receipt.request_id === "") blockers.push(`${role}-request-id-missing`);
  if (typeof receipt?.agent_id !== "string" || receipt.agent_id === "") blockers.push(`${role}-agent-id-missing`);
  if (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) blockers.push(`${role}-duration-missing`);
  if (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) blockers.push(`${role}-token-usage-missing`);
  if (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) blockers.push(`${role}-cost-missing`);
  if (expectedProjectionHash && receipt?.artifact_projection_hash !== expectedProjectionHash) blockers.push(`${role}-artifact-projection-mismatch`);
  return blockers;
}
function withinProfile(requested, maximum) {
  return (profileRank[requested] ?? 99) <= (profileRank[maximum] ?? -1);
}
function pathInside(path, roots) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}
function containsSensitiveChange(worktree, paths) {
  for (const path of paths) {
    const candidate = assertContainedPath(worktree, path);
    if (!existsSync2(candidate) || !statSync(candidate).isFile() || statSync(candidate).size > 2 * 1024 * 1024) continue;
    let source;
    try {
      source = readFileSync3(candidate, "utf8");
    } catch {
      continue;
    }
    if (secretPatterns.some((pattern) => pattern.test(source))) return true;
  }
  return false;
}
function currentBaselineDiffers(left, right) {
  return left?.head !== right?.head || left?.branch !== right?.branch || left?.status !== right?.status;
}
function guardReadOnlyRepository(cwd, operation) {
  const before = repositoryBaseline(cwd);
  const value = operation();
  const after = repositoryBaseline(cwd);
  return { value, unchanged: !currentBaselineDiffers(before, after), before, after };
}
function usageForRun(run) {
  const usage = { totalTokens: 0, costUsd: 0, correctionCycles: run.correction_cycles ?? 0, activeMinutes: 0 };
  for (const receipt of run.receipts ?? []) {
    usage.totalTokens += receipt.usage?.totalTokens ?? 0;
    usage.costUsd += receipt.cost_usd ?? 0;
    usage.activeMinutes += (receipt.duration_ms ?? 0) / 6e4;
  }
  for (const receipt of run.check_receipts ?? []) usage.activeMinutes += (receipt.duration_ms ?? 0) / 6e4;
  return usage;
}
function budgetBoundaryBlockers(run) {
  return evaluateAuthorization({ plan: run.plan.fields, usage: usageForRun(run) }).blockers.filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
}
var WorkflowEngine = class {
  constructor({ workspaceRoot, store, preparationStore, pluginRoot, stateRoot, worktreeRoot, adapterFactory, capabilitiesFactory, handoffStore } = {}) {
    this.workspaceRoot = resolve3(workspaceRoot);
    this.store = store;
    this.preparationStore = preparationStore;
    this.pluginRoot = resolve3(pluginRoot);
    this.stateRoot = resolve3(stateRoot);
    this.worktreeRoot = worktreeRoot ? resolve3(worktreeRoot) : null;
    this.handoffStore = handoffStore ?? new ArtifactHandoffStore(this.stateRoot, this.pluginRoot);
    this.adapterFactory = adapterFactory ?? ((run) => new CursorWorkerAdapter({ runDirectory: this.store.runDirectory(run.run_id), pluginRoot: this.pluginRoot }));
    this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }
  snapshot(run) {
    const compatibility = classifyRunCompatibility(run);
    if (!compatibility.compatible) return deriveWorkflowState({
      ...run,
      lifecycle: "stopped",
      compatibility: compatibility.compatibility,
      blockers: [.../* @__PURE__ */ new Set([...run.blockers ?? [], compatibility.blocker])]
    });
    return deriveWorkflowState({
      ...run,
      compatibility: compatibility.compatibility,
      root_plan_id: run.plan?.fields?.id ?? null,
      root_schema_valid: run.plan ? run.plan.fields?.schema === ARTIFACT_SCHEMA : void 0,
      intent_ready: run.plan?.fields?.intent_ready === true,
      product_aligned: Boolean(run.plan),
      architecture_aligned: Boolean(run.plan),
      program_design_aligned: Boolean(run.plan),
      slices_ready: Boolean(run.strategy?.steps?.length),
      strategy_revision: run.strategy?.revision ?? null
    });
  }
  start({ preparationId, approvedRootHash, expectedPreparationRevision, idempotencyKey }) {
    if (!this.preparationStore) throw new Error("workflow_start requires a preparation store");
    const preparation = this.preparationStore.get(preparationId);
    assertCompatiblePreparation(preparation);
    const prior = this.store.list().find((run) => run.preparation_id === preparationId && run.start_idempotency_key === idempotencyKey);
    if (prior && preparation.status === "consumed") {
      if (prior.root_plan_hash !== approvedRootHash) throw new Error("approved-root-hash-mismatch");
      return { run: prior, preparation, duplicate: true };
    }
    if (preparation.status !== "root-ready") throw new Error(`preparation is not root-ready: ${preparation.status}`);
    if (preparation.revision !== expectedPreparationRevision) throw new Error(`preparation revision conflict: expected ${expectedPreparationRevision}, current ${preparation.revision}`);
    if (preparation.root_plan_hash !== approvedRootHash) throw new Error("approved-root-hash-mismatch");
    if (Date.parse(preparation.expires_at) <= Date.now()) throw new Error("preparation-expired");
    const hashes = configurationHashes(this.workspaceRoot, preparation.route_profile);
    if (hashes.route_hash !== preparation.route_hash) throw new Error("route-configuration-drift");
    if (hashes.config_hash !== preparation.config_hash) throw new Error("planning-configuration-drift");
    if (hashes.policy_hash !== preparation.policy_hash) throw new Error("project-policy-drift");
    if (planningHarnessHash(this.pluginRoot) !== preparation.harness_hash) throw new Error("planning-harness-drift");
    const contract = executionContractFromArtifactText(preparation.root_plan_text, this.pluginRoot);
    if (contract.errors.length > 0) throw new Error(`invalid prepared root plan: ${contract.errors.join("; ")}`);
    const lineage = validateRootPlanLineage(preparation.root_plan_text, preparation.input_root_lineage_artifacts, this.pluginRoot);
    if (lineage.errors.length > 0) throw new Error(`invalid prepared root lineage: ${lineage.errors.join("; ")}`);
    const expectedLineageHash = preparation.input_root_lineage_hash ?? (lineage.artifacts.length === 0 ? lineage.artifact_set_hash : null);
    if (lineage.artifact_set_hash !== expectedLineageHash) throw new Error("prepared-root-lineage-hash-mismatch");
    if (contract.authoritative_projection_hash !== preparation.root_authoritative_projection_hash) throw new Error("prepared-root-authoritative-projection-mismatch");
    if (contract.fields.status !== "ready" || contract.fields.intent_ready !== true) throw new Error("prepared root plan must be ready with intent_ready true");
    if (!withinProfile(preparation.requested_profile, contract.fields.profile_max)) throw new Error(`prepared root plan permits at most ${contract.fields.profile_max}`);
    const usage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at);
    const receiptBlockers = (preparation.planner_receipts ?? []).flatMap(plannerReceiptBlockers);
    if ((preparation.planner_receipts ?? []).length === 0) receiptBlockers.push("planner-receipt-missing");
    const preparedAcceptedModel = preparation.route_validation.routes?.planner?.model;
    for (const [index, receipt] of (preparation.planner_receipts ?? []).entries()) {
      receiptBlockers.push(...expectedPlannerReceiptBlockers(receipt, preparation, preparedAcceptedModel));
      if (receipt.agent_id !== preparation.planner_agent_id) receiptBlockers.push("planner-agent-affinity-mismatch");
      if (index === preparation.planner_receipts.length - 1 && receipt.produced_artifact_projection_hash !== preparation.root_authoritative_projection_hash) receiptBlockers.push("planner-produced-artifact-projection-mismatch");
    }
    const preflightBlockers = [.../* @__PURE__ */ new Set([...receiptBlockers, ...planningBudgetBlockers(usage, preparation.planning_budget)])];
    if (preflightBlockers.length > 0) throw new Error(`planner preflight invalid: ${preflightBlockers.join("; ")}`);
    let routeValidation;
    try {
      routeValidation = this.adapterFactory({ run_id: "start-preflight" }).validateProfile(preparation.route_config);
    } catch (error) {
      routeValidation = { verified: false, errors: [error.message] };
    }
    if (!routeValidation.verified) throw new Error(`route validation failed: ${(routeValidation.errors ?? []).join("; ")}`);
    if (JSON.stringify(routeValidation.routes?.planner?.model) !== JSON.stringify(preparedAcceptedModel)) throw new Error("planner-catalog-attestation-drift");
    const strategy = createInitialStrategy(contract);
    const cert = contract.fields.certification ?? {};
    const key = qualificationKey({
      taskClass: strategy.task_class,
      verificationProfileHash: cert.verification_profile_hash,
      routePoolHash: cert.route_pool_hash ?? preparation.route_hash,
      certifiedRegion: cert.certified_region
    });
    const sourceNow = repositoryBaseline(this.workspaceRoot);
    const capabilities = this.capabilitiesFactory({ model_catalog_verified: true, expected_route_hash: preparation.route_hash, expected_planning_harness_hash: preparation.harness_hash });
    const creation = this.store.createFromPreparation(this.preparationStore, { preparationId, approvedRootHash, expectedPreparationRevision, idempotencyKey }, {
      workspace_root: this.workspaceRoot,
      goal: contract.fields.goal,
      requested_profile: preparation.requested_profile,
      effective_profile: preparation.requested_profile,
      route_profile: preparation.route_profile,
      route_config: preparation.route_config,
      route_validation: routeValidation,
      base_config_errors: [],
      config_errors: routeValidation.errors ?? [],
      project_policy: preparation.project_policy,
      capabilities,
      root_plan_text: preparation.root_plan_text,
      root_plan_hash: preparation.root_plan_hash,
      root_authoritative_projection_hash: preparation.root_authoritative_projection_hash,
      intent_hash: preparation.root_authoritative_projection_hash,
      plan: contract,
      strategy,
      qualification_key: key,
      plan_status: "ready",
      plan_approved: true,
      root_approval: { preparation_id: preparation.preparation_id, preparation_revision: preparation.revision, approved_root_hash: preparation.root_plan_hash, approved_at: (/* @__PURE__ */ new Date()).toISOString() },
      planning_receipts: structuredClone(preparation.planner_receipts),
      planning_usage: usage,
      lifecycle: "waiting-human",
      phase: "intent-ready",
      next_action: "eligibility-preflight",
      baseline: preparation.baseline,
      source_drift_at_start: currentBaselineDiffers(preparation.baseline, sourceNow),
      source_baseline_at_start: sourceNow,
      policy_hash: preparation.policy_hash,
      harness_hash: preparation.harness_hash,
      route_hash: preparation.route_hash,
      config_hash: preparation.config_hash,
      execution_started: false,
      evidence_entries: [],
      evidence_grade: null,
      delivery_status: null,
      receipts: [],
      blockers: []
    });
    if (creation.duplicate) return { ...creation, run: creation.run };
    return { ...creation, run: this.approve(creation.run.run_id) };
  }
  update(runId, mutator, eventType) {
    const current = this.store.get(runId);
    return this.store.update(runId, current.revision, null, mutator, eventType);
  }
  approve(runId) {
    let run = this.store.get(runId);
    if (!run.plan || !withinProfile(run.requested_profile, run.plan.fields.profile_max)) throw new Error("run has no compatible approved intent root");
    let routeValidation;
    try {
      routeValidation = this.adapterFactory(run).validateProfile(run.route_config);
    } catch (error) {
      routeValidation = { verified: false, errors: [error.message] };
    }
    const manifestPath = run.project_policy.verification_profile?.manifest_path;
    const verificationAudit = manifestPath ? auditVerificationProfile(this.workspaceRoot, manifestPath, this.pluginRoot, this.stateRoot) : { status: "blocked", valid: false, errors: ["verification profile not configured"] };
    const capabilities = this.capabilitiesFactory({
      model_catalog_verified: routeValidation.verified === true,
      verification_profile_certified: verificationAudit.status === "clean",
      expected_route_hash: run.route_hash,
      expected_planning_harness_hash: run.harness_hash
    });
    capabilities.route_pool_certified = capabilities.route_pool_certified === true && routeValidation.verified === true;
    capabilities.route_pool_models_certified = capabilities.route_pool_models_certified === true || selectedModelsCertified(routeValidation, capabilities.certified_models);
    const qualifyingRuns = this.store.qualifyingHistory(run.qualification_key);
    run = this.update(runId, (draft) => ({ ...draft, route_validation: routeValidation, capabilities, verification_audit: verificationAudit, config_errors: [...draft.base_config_errors ?? [], ...routeValidation.errors ?? []] }), "approval-preflight-refreshed");
    const eligibility = evaluateEligibility({ requestedProfile: run.requested_profile, plan: run.plan.fields, project: run.project_policy, capabilities, configErrors: run.config_errors, qualifyingRuns, taskClass: run.strategy.task_class });
    if (eligibility.blockers.length > 0) return this.update(runId, (draft) => ({ ...draft, ...eligibility, lifecycle: "waiting-human", next_action: "resolve-capability-blockers" }), "eligibility-blocked");
    run = this.update(runId, (draft) => ({ ...draft, ...eligibility, lifecycle: "queued", phase: "strategy-ready", blockers: [], next_action: "execute-strategy" }), eligibility.downgraded ? "profile-auto-downgraded" : "run-approved");
    if (eligibility.downgraded) this.store.appendDecision(runId, { phase: "eligibility", decision: "continue-supervised", reason: eligibility.downgrade_reason, input_hashes: [run.intent_hash], strategy_revision: run.strategy.revision, result: "queued" });
    return run;
  }
  execute(runId) {
    let run = this.store.get(runId);
    if (!run.plan_approved || run.lifecycle !== "queued") throw new Error("run is not approved and queued");
    const integrityBlockers = runIntegrityBlockers(run, this.pluginRoot);
    if (integrityBlockers.length > 0) return this.block(run, integrityBlockers);
    for (const capability of ["worker_network_isolated", "sandbox_boundary_verified", "sdk_secret_isolated", "sdk_budget_cancel_verified"]) if (!run.capabilities[capability]) throw new Error(`automated writing denied without ${capability}`);
    if (!run.worktree) {
      let worktree;
      try {
        worktree = createRunWorktree(this.workspaceRoot, runId, {
          ...this.worktreeRoot ? { root: this.worktreeRoot } : {},
          snapshotPath: join2(this.store.runDirectory(runId), "dirty-snapshot.json")
        });
      } catch (error) {
        return this.block(run, [`dirty-snapshot-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, worktree, dirty_baseline_hash: worktree.dirty_snapshot_hash, lifecycle: "running", execution_started: true, phase: "baseline-verification", current_slice: draft.current_slice ?? 0, checkpoints: [{ slice_id: "HUMAN-BASELINE", commit: worktree.human_baseline, empty: !worktree.dirty }] }), "human-baseline-created");
    } else run = this.update(runId, (draft) => ({ ...draft, lifecycle: "running", execution_started: true }), "run-resumed");
    if (run.strategy.task_class === "verify-existing" && !run.comparison_baseline_worktree) {
      let comparisonBaselineWorktree;
      try {
        comparisonBaselineWorktree = createComparisonBaselineWorktree(this.workspaceRoot, runId, run.worktree.baseline.head, { ...this.worktreeRoot ? { root: this.worktreeRoot } : {} });
      } catch (error) {
        return this.block(run, [`comparison-baseline-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, comparison_baseline_worktree: comparisonBaselineWorktree }), "comparison-baseline-created");
    }
    const adapter = this.adapterFactory(run);
    if (!(run.evidence_entries ?? []).some((entry) => entry.baseline_or_patched === "baseline")) {
      const baseline = this.verify(run, run.strategy.steps[0], "baseline", adapter);
      if (baseline.hard_error) return this.block(run, baseline.blockers);
      run = this.update(runId, (draft) => ({ ...draft, phase: "implementing", evidence_entries: [...draft.evidence_entries ?? [], ...baseline.entries], receipts: [...draft.receipts, ...baseline.receipt ? [baseline.receipt] : []] }), "baseline-evidence-recorded");
      const budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return this.block(run, budgetBlockers);
    }
    const recipe = TASK_RECIPES[run.strategy.task_class];
    if (!recipe.writer_allowed) {
      if (run.strategy.task_class === "verify-existing") {
        const patched = this.verify(run, run.strategy.steps[0], "patched", adapter);
        if (patched.hard_error) return this.block(run, patched.blockers);
        run = this.update(runId, (draft) => ({ ...draft, evidence_entries: [...draft.evidence_entries, ...patched.entries], receipts: [...draft.receipts, ...patched.receipt ? [patched.receipt] : []] }), "candidate-evidence-recorded");
        const budgetBlockers = budgetBoundaryBlockers(run);
        if (budgetBlockers.length > 0) return this.block(run, budgetBlockers);
      }
      return this.finalReview(runId);
    }
    const slices = run.strategy.steps.length > 0 ? run.strategy.steps : [{ "Slice ID": "SLICE-1", "Check IDs": run.strategy.checks.map((item) => item["Check ID"]).join(", ") }];
    for (let index = run.current_slice ?? 0; index < slices.length; index += 1) {
      const result = this.executeSlice(run, slices[index], index);
      if (!result.completed) return result.run;
      run = result.run;
      const sliceCheckpoint = checkpoint(run.worktree.path, `${slices[index]["Slice ID"]}`);
      run = this.update(runId, (draft) => ({ ...draft, current_slice: index + 1, more_slices: index + 1 < slices.length, phase: "strategy-ready", checkpoints: [...draft.checkpoints ?? [], { slice_id: slices[index]["Slice ID"], ...sliceCheckpoint }] }), "slice-complete");
    }
    return this.finalReview(runId);
  }
  executeSlice(run, slice) {
    const adapter = this.adapterFactory(run);
    let correctionCycle = run.correction_cycles ?? 0;
    let previousFindingKeys = run.review?.finding_keys ?? [];
    let writerAgentId = run.writer_agent_id ?? null;
    let escalated = run.writer_escalated === true;
    while (true) {
      const pre = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
      if (!pre.authorized) {
        const budgetBlockers2 = budgetBoundaryBlockers(run);
        return { completed: false, run: budgetBlockers2.length > 0 ? this.block(run, budgetBlockers2) : this.wait(run, pre.blockers) };
      }
      const routeChoice = selectWriterRoute({ plan: run.plan.fields, correctionCycle, findingRepeated: run.finding_repeated === true, alreadyEscalated: escalated });
      if (routeChoice.escalated && !escalated) {
        escalated = true;
        writerAgentId = null;
      }
      const role = routeChoice.role;
      const selected = routeSelection(run.route_validation, role);
      const prompt = [
        correctionCycle === 0 ? "Implement the current adaptive strategy slice." : "Correct the current worktree using the fresh review decision.",
        "Stay inside the immutable intent authority. You may adapt method and adjacent files inside allowed_roots. Do not push, create a PR, merge, deploy, or cause external effects.",
        `IMMUTABLE INTENT
${run.plan.authoritative_projection_text}`,
        `CURRENT STRATEGY
${JSON.stringify(run.strategy, null, 2)}`,
        `SLICE
${JSON.stringify(slice, null, 2)}`,
        correctionCycle > 0 ? `REVIEW
${JSON.stringify(run.review, null, 2)}` : "",
        correctionCycle > 0 && run.work_review_artifact ? `AUTHORITATIVE WORK REVIEW
${run.work_review_artifact}` : ""
      ].filter(Boolean).join("\n\n");
      const roots = run.plan.fields.authority.allowed_roots;
      const writablePaths = roots.filter((target) => pathInside(target, run.project_policy.allowed_write_roots)).map((target) => assertContainedPath(run.worktree.path, target));
      if (writablePaths.length !== roots.length) return { completed: false, run: this.wait(run, ["intent-authority-exceeds-project-policy"]) };
      const denied = [.../* @__PURE__ */ new Set([...run.project_policy.protected_paths, ...run.project_policy.approval_required_paths, ...run.plan.fields.authority.protected_paths, ...run.plan.fields.authority.approval_required_paths])].map((target) => assertContainedPath(run.worktree.path, target));
      const phase = adapter.runPhase({ role, ...selected, prompt, cwd: run.worktree.path, agentId: writerAgentId, writerWritablePaths: writablePaths, writerDeniedPaths: denied, configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash });
      writerAgentId = phase.receipt.agent_id;
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "host-verifying", writer_agent_id: writerAgentId, writer_escalated: escalated, receipts: [...draft.receipts, phase.receipt] }), "writer-finished");
      if (phase.response.status === "interrupted") return { completed: false, run: this.update(run.run_id, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: ["worker-hard-cancelled"], next_action: "resume" }), "worker-interrupted") };
      const writerBlockers = phaseReceiptBlockers(phase.receipt, role, run.intent_hash);
      if (!phase.response.ok || writerBlockers.length > 0) return { completed: false, run: this.rollbackAndWait(run, [phase.response.error?.message, ...writerBlockers].filter(Boolean)) };
      const paths = changedPaths(run.worktree.path);
      const changedDependencies = detectDependencyChanges(run.worktree.path, run.worktree.human_baseline, paths);
      const authorization = evaluateAuthorization({ plan: run.plan.fields, changedPaths: paths, changedDependencies, usage: this.usage(run) });
      if (run.project_policy.dependencies === "deny" && changedDependencies.length > 0) authorization.blockers.push("project-dependency-change-denied");
      if (run.project_policy.dependencies === "allow-listed") {
        for (const dependency of changedDependencies) if (!run.project_policy.allowed_dependencies.includes(dependency)) authorization.blockers.push(`project-dependency-not-allow-listed:${dependency}`);
      }
      if (containsSensitiveChange(run.worktree.path, paths)) authorization.blockers.push("secret-material-detected");
      if (!authorization.authorized || authorization.blockers.length > 0) {
        const restored = this.rollbackAndWait(run, authorization.blockers);
        const budgetBlockers2 = authorization.blockers.filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
        return { completed: false, run: budgetBlockers2.length > 0 ? this.block(restored, budgetBlockers2) : restored };
      }
      const certifiedRegion = run.plan.fields.certification?.certified_region;
      const regionEscapes = certifiedRegion ? paths.filter((path) => !pathInside(path, [certifiedRegion])) : [];
      if (run.effective_profile === "autonomous" && regionEscapes.length > 0) {
        run = this.update(run.run_id, (draft) => ({
          ...draft,
          effective_profile: "supervised",
          downgraded: true,
          downgrade_reason: `certified-region-exceeded:${regionEscapes.join(",")}`
        }), "profile-auto-downgraded");
        this.store.appendDecision(run.run_id, {
          phase: "scope",
          actor_receipt: phase.receipt.request_id,
          decision: "continue-supervised",
          reason: run.downgrade_reason,
          input_hashes: [run.intent_hash, run.strategy.strategy_hash],
          strategy_revision: run.strategy.revision,
          result: "supervised"
        });
      }
      const adjacentPaths = paths.filter((path) => !pathInside(path, run.strategy.primary_targets ?? []));
      const alreadyRecorded = new Set((run.strategy.deviations ?? []).filter((item) => item.kind === "adjacent-scope").flatMap((item) => item.paths ?? []));
      const newAdjacentPaths = adjacentPaths.filter((path) => !alreadyRecorded.has(path));
      if (newAdjacentPaths.length > 0) {
        const deviation2 = { id: `DEV-${run.strategy.revision + 1}`, kind: "adjacent-scope", paths: newAdjacentPaths, at: (/* @__PURE__ */ new Date()).toISOString() };
        const strategy2 = reviseStrategy(run.strategy, { deviations: [deviation2] }, { reason: `adjacent in-envelope scope: ${newAdjacentPaths.join(", ")}`, createdBy: role, authority: run.plan.fields.authority });
        run = this.update(run.run_id, (draft) => ({ ...draft, strategy: strategy2 }), "strategy-revised");
        this.store.appendDecision(run.run_id, {
          phase: "adapt",
          actor_receipt: phase.receipt.request_id,
          decision: "record-adjacent-scope",
          reason: strategy2.rationale,
          input_hashes: [run.intent_hash, strategy2.parent_hash],
          strategy_revision: strategy2.revision,
          result: strategy2.strategy_hash
        });
      }
      const checkIds = String(slice["Check IDs"] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const checks = run.strategy.checks.filter((check) => correctionCycle > 0 || checkIds.length === 0 || checkIds.includes(check["Check ID"]));
      const hostReceipts = checks.map((check) => {
        if (check["Evidence Class"] !== "machine-verifiable" || check["Command or Inspection"] === "verification-profile") return { check_id: check["Check ID"], unavailable: true, reason: "verification-profile-required" };
        try {
          return { check_id: check["Check ID"], ...runHostCheck(run.worktree.path, parseHostCommand(check["Command or Inspection"])) };
        } catch (error) {
          return { check_id: check["Check ID"], unavailable: true, reason: error.message };
        }
      });
      const verificationSlice = correctionCycle > 0 ? { ...slice, "Check IDs": checks.map((check) => check["Check ID"]).join(", ") } : slice;
      const verifier = this.verify(run, verificationSlice, "patched", adapter, hostReceipts);
      if (verifier.hard_error) return { completed: false, run: this.block(run, verifier.blockers) };
      const byCheck = new Map(verifier.entries.map((entry) => [entry.check_id, entry]));
      const entries = checks.map((check) => byCheck.get(check["Check ID"]) ?? checkEvidence(check, hostReceipts.find((receipt) => receipt.check_id === check["Check ID"]), "patched"));
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "slice-review", check_receipts: [...draft.check_receipts ?? [], ...hostReceipts], evidence_entries: [...(draft.evidence_entries ?? []).filter((entry) => !(entry.baseline_or_patched === "patched" && entries.some((candidate) => candidate.check_id === entry.check_id))), ...entries], receipts: [...draft.receipts, ...verifier.receipt ? [verifier.receipt] : []] }), "verification-finished");
      let budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return { completed: false, run: this.block(run, budgetBlockers) };
      let review = this.review(run, slice, entries, adapter);
      if (review.hard_error) return { completed: false, run: this.block(run, review.blockers) };
      run = this.update(run.run_id, (draft) => ({ ...draft, review: review.decision, receipts: [...draft.receipts, review.receipt] }), "slice-reviewed");
      budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return { completed: false, run: this.block(run, budgetBlockers) };
      if (!review.decision) return { completed: false, run: this.wait(run, review.blockers) };
      const aggregate = aggregateEvidence(run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched"));
      if (review.decision.next_action !== "none") {
        const patchedEvidence = run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched");
        let candidate;
        try {
          candidate = this.deliveryEvidenceCandidate(run, patchedEvidence);
        } catch (error) {
          return { completed: false, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) };
        }
        let built;
        try {
          built = this.controllerWorkReview(run, candidate, review);
        } catch (firstError) {
          const repaired = this.review(run, slice, entries, adapter, candidate.artifact, firstError.message);
          run = this.update(run.run_id, (draft) => ({ ...draft, receipts: [...draft.receipts, ...repaired.receipt ? [repaired.receipt] : []] }), "review-input-repair-attempted");
          try {
            if (!repaired.decision || repaired.hard_error) throw new Error("repair reviewer did not return a valid decision");
            built = this.controllerWorkReview(run, candidate, repaired);
            review = repaired;
          } catch (secondError) {
            return { completed: false, run: this.wait(run, [`review-input-invalid-after-one-repair:${secondError.message}; repeat Review in this Run`]) };
          }
        }
        review = { ...review, decision: built.controller_decision };
        run = this.update(run.run_id, (draft) => ({ ...draft, review: built.controller_decision }), "slice-review-authority-built");
        run = this.materializeControllerReview(run, candidate, built);
      }
      if (aggregate.delivery === "blocked") {
        const patchedEvidence = run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched");
        let candidate;
        try {
          candidate = this.deliveryEvidenceCandidate(run, patchedEvidence);
        } catch (error) {
          return { completed: false, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) };
        }
        const materialized = this.materializeDeliveryEvidence(run, candidate);
        return { completed: false, run: this.update(run.run_id, (draft) => ({
          ...draft,
          lifecycle: "blocked",
          delivery_status: "blocked",
          evidence_grade: "failed",
          blockers: ["known-check-failure", ...materialized.blocker ? [materialized.blocker] : []],
          next_action: "correct-or-replan"
        }), "delivery-blocked") };
      }
      if (review.decision.assessment === "achieved" && review.decision.next_action === "none" && aggregate.delivery !== "blocked") return { completed: true, run };
      if (["clarify", "replan"].includes(review.decision.next_action)) return { completed: false, run: this.wait(run, [`review-${review.decision.next_action}`]) };
      if (review.decision.next_action !== "correct") return { completed: false, run: this.wait(run, ["review-not-actionable"]) };
      correctionCycle += 1;
      const findingRepeated = review.decision.finding_keys.some((key) => previousFindingKeys.includes(key));
      previousFindingKeys = review.decision.finding_keys;
      const maximum = run.project_policy.maximum_budgets?.max_correction_cycles ?? 3;
      if (correctionCycle > maximum) return { completed: false, run: this.wait(run, ["correction-budget-exhausted"]) };
      const learning = materializeControllerLearningCandidates({
        run,
        decision: review.decision,
        correctionCycle,
        receiptIds: [review.receipt?.request_id].filter(Boolean)
      });
      const learningCandidateIds = learning.candidates.map((candidate) => candidate.learning_id);
      const correctionDecision = {
        ...review.decision,
        controller_learning_correction_id: learning.correction_id,
        controller_learning_candidate_ids: learningCandidateIds
      };
      const deviation = {
        id: `DEV-${run.strategy.revision + 1}`,
        kind: "review-correction",
        correction_id: learning.correction_id,
        finding_keys: correctionDecision.finding_keys,
        learning_candidate_ids: learningCandidateIds,
        at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const parsedCorrection = inspectArtifactText(run.work_review_artifact, this.pluginRoot).artifact?.correction;
      if (!parsedCorrection?.id || parsedCorrection.id !== review.decision.correction_id) return { completed: false, run: this.wait(run, ["host-built-correction-plan-unavailable"]) };
      const correctionChecks = parsedCorrection.checks.map((check) => ({
        ...check,
        Objectives: parsedCorrection.fixes.filter((fix) => String(check["FIX IDs"]).split(",").map((item) => item.trim()).includes(fix["FIX ID"])).flatMap((fix) => String(fix["Root Objectives"]).split(",").map((item) => item.trim())).filter(Boolean).join(", "),
        "Evidence Class": "machine-verifiable"
      }));
      const checksById = new Map([...run.strategy.checks, ...correctionChecks].map((check) => [check["Check ID"], check]));
      const strategy = reviseStrategy(run.strategy, { deviations: [deviation], checks: [...checksById.values()] }, { reason: `review correction ${correctionCycle}`, createdBy: role, authority: run.plan.fields.authority });
      run = this.update(run.run_id, (draft) => ({
        ...draft,
        strategy,
        correction_cycles: correctionCycle,
        finding_repeated: findingRepeated,
        review: correctionDecision,
        learning_candidates: mergeControllerLearningCandidates(draft.learning_candidates, learning.candidates),
        phase: "implementing"
      }), "strategy-revised");
      this.store.appendDecision(run.run_id, {
        phase: "adapt",
        actor_receipt: review.receipt?.request_id ?? null,
        actor_receipts: learningSourceReceiptIds(learning.candidates),
        decision: "revise-strategy",
        reason: strategy.rationale,
        input_hashes: [run.intent_hash, strategy.parent_hash, ...learningSourceHashes(learning.candidates)],
        strategy_revision: strategy.revision,
        result: strategy.strategy_hash,
        correction_id: learning.correction_id,
        learning_candidate_ids: learningCandidateIds,
        learning_candidate_refs: controllerLearningEventRefs(learning.candidates)
      });
    }
  }
  verify(run, slice, stage, adapter, hostReceipts = []) {
    const checks = run.strategy.checks.filter((check) => {
      const ids = String(slice?.["Check IDs"] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      return ids.length === 0 || ids.includes(check["Check ID"]);
    });
    const hostEntries = hostReceipts.filter((receipt) => receipt.passed === true || receipt.passed === false).map((receipt) => checkEvidence(checks.find((check) => check["Check ID"] === receipt.check_id), receipt, stage));
    const unresolved = checks.filter((check) => !hostEntries.some((entry) => entry.check_id === check["Check ID"]));
    if (unresolved.length === 0) return {
      entries: calibrateRecipeEvidence(run.strategy.task_class, hostEntries, stage, run.evidence_entries ?? []),
      receipt: null
    };
    let selected;
    try {
      selected = routeSelection(run.route_validation, "verifier");
    } catch (error) {
      return {
        entries: calibrateRecipeEvidence(run.strategy.task_class, [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: true, reason: error.message }, stage))], stage, run.evidence_entries ?? []),
        receipt: null
      };
    }
    const artifactDirectory = join2(this.store.runDirectory(run.run_id), "artifacts", `strategy-${run.strategy.revision}`, stage);
    mkdirSync2(artifactDirectory, { recursive: true, mode: 448 });
    const recipe = TASK_RECIPES[run.strategy.task_class];
    const prompt = [
      `Act as a read-only verifier for the ${stage} state. Do not modify repository files.`,
      `Use task recipe ${run.strategy.task_class}: ${JSON.stringify(recipe)}.`,
      "Return one JSON object with entries. Each entry requires check_id, grade, surface, method, expected, observed, repetitions, artifact_hashes, limitations.",
      "Grades are verified|supported|partial|unavailable|failed. A reviewer opinion is not verification.",
      `INTENT
${run.plan.authoritative_projection_text}`,
      `STRATEGY
${JSON.stringify(run.strategy, null, 2)}`,
      `CHECKS
${JSON.stringify(unresolved, null, 2)}`,
      `ARTIFACT DIRECTORY
${artifactDirectory}`
    ].join("\n\n");
    const verifierCwd = stage === "baseline" && run.strategy.task_class === "verify-existing" && run.comparison_baseline_worktree?.path ? run.comparison_baseline_worktree.path : run.worktree?.path ?? this.workspaceRoot;
    const guarded = guardReadOnlyRepository(verifierCwd, () => adapter.runPhase({ role: "verifier", ...selected, prompt, cwd: verifierCwd, verifierArtifactPaths: [artifactDirectory], configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash }));
    const phase = guarded.value;
    if (!guarded.unchanged) return {
      entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { passed: false, reason: "reader modified repository" }, stage))],
      receipt: { ...phase.receipt, reader_repository_unchanged: false },
      hard_error: true,
      blockers: ["reader-repository-mutation:verifier"]
    };
    const blockers = phaseReceiptBlockers(phase.receipt, "verifier", run.intent_hash);
    if (!phase.response.ok || blockers.length > 0) return { entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: true, reason: blockers.join(",") || phase.response.error?.message }, stage))], receipt: phase.receipt };
    try {
      const value = jsonObject(phase.response.result);
      const returned = Array.isArray(value.entries) ? value.entries : [];
      const entries = unresolved.map((check) => {
        const item = returned.find((entry) => entry.check_id === check["Check ID"]);
        if (!item || !["verified", "supported", "partial", "unavailable", "failed"].includes(item.grade)) return checkEvidence(check, { unavailable: true, reason: "verifier omitted valid evidence" }, stage);
        return {
          check_id: check["Check ID"],
          feature_id: item.feature_id ?? null,
          grade: item.grade,
          surface: item.surface ?? "repository",
          method: item.method ?? "verification-profile",
          baseline_or_patched: stage,
          expected: item.expected ?? check["Expected Result"] ?? "",
          observed: item.observed ?? "",
          repetitions: Number.isInteger(item.repetitions) ? item.repetitions : 0,
          artifact_hashes: Array.isArray(item.artifact_hashes) ? item.artifact_hashes.filter((value2) => /^[a-f0-9]{64}$/.test(value2)) : [],
          limitations: Array.isArray(item.limitations) ? item.limitations : []
        };
      });
      return { entries: calibrateRecipeEvidence(run.strategy.task_class, [...hostEntries, ...entries], stage, run.evidence_entries ?? []), receipt: phase.receipt };
    } catch (error) {
      return { entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: true, reason: `invalid verifier output: ${error.message}` }, stage))], receipt: phase.receipt };
    }
  }
  review(run, slice, evidenceEntries, adapter, candidateEvidence = null, repairIssue = null) {
    const selected = routeSelection(run.route_validation, "reviewer");
    const diff = this.gitDiff(run.worktree.path, run.strategy.task_class === "verify-existing" ? run.worktree.baseline.head : run.worktree.human_baseline);
    const prompt = [
      "Independently review the current strategy state. You are read-only and have no writer conversation.",
      "Judge the immutable intent, current strategy, repository diff and evidence entries. Reviewer opinion must not upgrade evidence.",
      "Return semantic JSON only: assessment, next_action, assessment_summary, snapshot_assessment, snapshot_summary, finding_keys, findings, missing_evidence, and learning_candidates. Each finding requires key, summary, severity, objective_ids, check_ids, evidence, reasoning, and resolution. For correct, learning_candidates is required and each item contains finding_keys, reusable_guidance, candidate_targets, and confirmation_evidence. Do not assign artifact, Correction, Check, Step, Finding, or Learning IDs. Known failed evidence can never be provisional or verified.",
      `INTENT
${run.plan.authoritative_projection_text}`,
      `STRATEGY
${JSON.stringify(run.strategy, null, 2)}`,
      `SLICE
${JSON.stringify(slice, null, 2)}`,
      `DIFF
${diff}`,
      `CANDIDATE DELIVERY EVIDENCE
${candidateEvidence ?? JSON.stringify(evidenceEntries, null, 2)}`,
      repairIssue ? `ONE REVIEW-INPUT REPAIR
The prior semantic response could not be normalized: ${repairIssue}. Root, Evidence, and repository work are preserved. Correct only the named semantic field and return the complete JSON again in this Run.` : ""
    ].filter(Boolean).join("\n\n");
    const guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runPhase({ role: "reviewer", ...selected, prompt, cwd: run.worktree.path, configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash }));
    const phase = guarded.value;
    if (!guarded.unchanged) return { decision: null, receipt: { ...phase.receipt, reader_repository_unchanged: false }, blockers: ["reader-repository-mutation:reviewer"], hard_error: true };
    const blockers = phaseReceiptBlockers(phase.receipt, "reviewer", run.intent_hash);
    if (!phase.response.ok) blockers.push(phase.response.error?.message ?? "reviewer-failed");
    if (blockers.length > 0) return { decision: null, receipt: phase.receipt, blockers: [...new Set(blockers)] };
    try {
      const decision2 = jsonDecision(phase.response.result);
      return {
        decision: decision2,
        receipt: phase.receipt,
        auditor_reports: [{ role: "delivery-auditor", assessment: decision2.assessment, summary: decision2.assessment_summary }],
        blockers: []
      };
    } catch (error) {
      return { decision: null, receipt: phase.receipt, blockers: [`reviewer-invalid-decision:${error.message}`] };
    }
  }
  reviewFanout(run, evidenceEntries, adapter, candidateEvidence = null, repairIssue = null) {
    if (typeof adapter.runReadOnlyFanout !== "function") return this.review(run, { "Slice ID": "ROOT" }, evidenceEntries, adapter, candidateEvidence);
    const diff = this.gitDiff(run.worktree.path, run.strategy.task_class === "verify-existing" ? run.worktree.baseline.head : run.worktree.human_baseline);
    const prompt = [
      "Independently judge the immutable intent, current strategy, diff and evidence. You are read-only.",
      "Return semantic JSON only: assessment, next_action, assessment_summary, snapshot_assessment, snapshot_summary, finding_keys, findings, missing_evidence, and learning_candidates. Each finding requires key, summary, severity, objective_ids, check_ids, evidence, reasoning, and resolution. For correct, learning_candidates is required and each item contains finding_keys, reusable_guidance, candidate_targets, and confirmation_evidence. Do not assign artifact, Correction, Check, Step, Finding, or Learning IDs. Do not upgrade evidence and never treat a known failure as provisional.",
      `INTENT
${run.plan.authoritative_projection_text}`,
      `STRATEGY
${JSON.stringify(run.strategy, null, 2)}`,
      `DIFF
${diff}`,
      `CANDIDATE DELIVERY EVIDENCE
${candidateEvidence ?? JSON.stringify(evidenceEntries, null, 2)}`,
      repairIssue ? `ONE REVIEW-INPUT REPAIR
The prior semantic response could not be normalized: ${repairIssue}. Root, Evidence, and repository work are preserved. Correct only the named semantic field and return the complete JSON again in this Run.` : ""
    ].filter(Boolean).join("\n\n");
    const phases = ["reviewer", "investigator"].map((role) => ({
      role,
      ...routeSelection(run.route_validation, role),
      prompt,
      cwd: run.worktree.path,
      configurationHash: run.route_hash,
      artifactProjectionHash: run.intent_hash
    }));
    let results;
    try {
      const guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runReadOnlyFanout(phases));
      results = guarded.value;
      if (!guarded.unchanged) return { decision: null, receipts: results.map((result) => ({ ...result.receipt, reader_repository_unchanged: false })), blockers: ["reader-repository-mutation:fanout"], hard_error: true };
    } catch (error) {
      return { decision: null, receipt: null, receipts: [], blockers: [`read-fanout-failed:${error.message}`] };
    }
    const decisionRecords = [];
    const blockers = [];
    for (const [index, result] of results.entries()) {
      const role = phases[index].role;
      const receiptErrors = phaseReceiptBlockers(result.receipt, role, run.intent_hash);
      if (!result.response.ok) receiptErrors.push(result.response.error?.message ?? `${role}-failed`);
      if (receiptErrors.length > 0) {
        blockers.push(...receiptErrors);
        continue;
      }
      try {
        decisionRecords.push({ role, decision: jsonDecision(result.response.result), receipt: result.receipt });
      } catch (error) {
        blockers.push(`${role}-invalid-decision:${error.message}`);
      }
    }
    if (decisionRecords.length === 0) return { decision: null, receipts: results.map((result) => result.receipt), blockers: [...new Set(blockers)] };
    const actionRank = { replan: 6, clarify: 5, correct: 4, "retry-review": 3, "accept-provisional": 2, none: 1 };
    const selected = decisionRecords.toSorted((left, right) => actionRank[right.decision.next_action] - actionRank[left.decision.next_action])[0].decision;
    const bothAchieved = decisionRecords.length === 2 && decisionRecords.every(({ decision: decision3 }) => decision3.assessment === "achieved" && decision3.next_action === "none");
    const learningBySemanticIdentity = /* @__PURE__ */ new Map();
    if (selected.next_action === "correct") {
      for (const { decision: sourceDecision, receipt } of decisionRecords.filter(({ decision: decision3 }) => decision3.next_action === "correct")) {
        for (const candidate of sourceDecision.learning_candidates ?? []) {
          const key = controllerLearningCandidateSemanticHash(candidate);
          const sourceBinding = {
            source_receipt_id: receipt.request_id,
            source_decision_hash: controllerLearningDecisionHash(sourceDecision, candidate)
          };
          const prior = learningBySemanticIdentity.get(key);
          if (!prior) {
            learningBySemanticIdentity.set(key, { ...candidate, source_bindings: [sourceBinding] });
            continue;
          }
          prior.source_bindings = [...new Map([...prior.source_bindings, sourceBinding].map((binding) => [`${binding.source_receipt_id}:${binding.source_decision_hash}`, binding])).values()].toSorted((left, right) => left.source_receipt_id.localeCompare(right.source_receipt_id));
        }
      }
    }
    const learningCandidates = [...learningBySemanticIdentity.values()];
    const decision2 = {
      ...selected,
      assessment: bothAchieved ? "achieved" : selected.assessment === "achieved" ? "provisional" : selected.assessment,
      delivery_status: bothAchieved ? "verified" : selected.delivery_status === "blocked" ? "blocked" : "provisional",
      next_action: bothAchieved ? "none" : selected.next_action === "none" ? "accept-provisional" : selected.next_action,
      finding_keys: [...new Set(decisionRecords.flatMap(({ decision: item }) => item.finding_keys ?? []))].toSorted(),
      findings: decisionRecords.flatMap(({ decision: item }) => item.findings ?? []),
      learning_candidates: learningCandidates,
      agreement: bothAchieved ? "consensus" : decisionRecords.length === 2 ? "contested" : "single-valid-review"
    };
    return {
      decision: decision2,
      receipts: results.map((result) => result.receipt),
      auditor_reports: decisionRecords.map(({ role, decision: sourceDecision }) => ({
        role: role === "investigator" ? "risk-auditor" : "delivery-auditor",
        assessment: sourceDecision.assessment,
        summary: sourceDecision.assessment_summary
      })),
      blockers
    };
  }
  finalReview(runId) {
    let run = this.store.get(runId);
    const authorization = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
    if (!authorization.authorized) {
      const budgetBlockers2 = budgetBoundaryBlockers(run);
      return budgetBlockers2.length > 0 ? this.block(run, budgetBlockers2) : this.wait(run, authorization.blockers);
    }
    const adapter = this.adapterFactory(run);
    const patched = (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "patched");
    const evidence = patched.length > 0 ? patched : (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "baseline");
    const aggregate = aggregateEvidence(evidence);
    let candidate;
    try {
      candidate = this.deliveryEvidenceCandidate(run, evidence);
    } catch (error) {
      return this.block(run, [`delivery-closeout-invalid:${error.message}`]);
    }
    let review = this.reviewFanout(run, evidence, adapter, candidate.artifact);
    let reviewReceipts = review.receipts ?? (review.receipt ? [review.receipt] : []);
    let rootLearning = materializeControllerLearningCandidates({
      run,
      decision: review.decision,
      correctionCycle: (run.correction_cycles ?? 0) + 1,
      receiptIds: reviewReceipts.map((receipt) => receipt?.request_id).filter(Boolean)
    });
    let builtReview = null;
    if (review.decision && !review.hard_error) {
      try {
        builtReview = this.controllerWorkReview(run, candidate, review);
      } catch (firstError) {
        const repaired = this.reviewFanout(run, evidence, adapter, candidate.artifact, firstError.message);
        reviewReceipts = [...reviewReceipts, ...repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : [])];
        review = { ...repaired, blockers: [.../* @__PURE__ */ new Set([...review.blockers ?? [], ...repaired.blockers ?? []])] };
        try {
          rootLearning = materializeControllerLearningCandidates({
            run,
            decision: review.decision,
            correctionCycle: (run.correction_cycles ?? 0) + 1,
            receiptIds: (repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : [])).map((receipt) => receipt?.request_id).filter(Boolean)
          });
          if (review.decision && !review.hard_error) builtReview = this.controllerWorkReview(run, candidate, review);
          else throw new Error("repair reviewer did not return a valid decision");
        } catch (secondError) {
          review = {
            ...review,
            decision: null,
            blockers: [.../* @__PURE__ */ new Set([...review.blockers ?? [], `review-input-invalid-after-one-repair:${secondError.message}; repeat Review in this Run`])]
          };
          rootLearning = { correction_id: null, candidates: [] };
        }
      }
    }
    const rootDecision = builtReview?.controller_decision ?? null;
    const sourceBaselineAtDelivery = repositoryBaseline(this.workspaceRoot);
    const sourceDriftAtDelivery = currentBaselineDiffers(run.source_baseline_at_start ?? run.baseline, sourceBaselineAtDelivery);
    run = this.update(runId, (draft) => ({
      ...draft,
      root_review_complete: Boolean(review.decision),
      review: rootDecision,
      learning_candidates: mergeControllerLearningCandidates(draft.learning_candidates, rootLearning.candidates),
      receipts: [...draft.receipts, ...reviewReceipts],
      phase: "root-review",
      evidence_grade: aggregate.grade,
      source_baseline_at_delivery: sourceBaselineAtDelivery,
      source_drift_at_delivery: sourceDriftAtDelivery,
      integration_warnings: sourceDriftAtDelivery ? ["source-worktree-drift-may-conflict-with-human-integration"] : []
    }), "root-reviewed");
    if (builtReview) run = this.materializeControllerReview(run, candidate, builtReview);
    if (rootDecision?.next_action === "correct") {
      const actorReceipts = learningSourceReceiptIds(rootLearning.candidates);
      this.store.appendDecision(runId, {
        phase: "review",
        actor_receipt: reviewReceipts[0]?.request_id ?? null,
        actor_receipts: actorReceipts,
        decision: "request-correction",
        reason: "root review requires a bounded correction",
        input_hashes: [run.intent_hash, run.strategy.strategy_hash, ...learningSourceHashes(rootLearning.candidates)],
        strategy_revision: run.strategy.revision,
        result: "waiting-human",
        correction_id: rootLearning.correction_id,
        learning_candidate_ids: rootLearning.candidates.map((item) => item.learning_id),
        learning_candidate_refs: controllerLearningEventRefs(rootLearning.candidates)
      });
    }
    if (review.hard_error) {
      const materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized2.run, [...review.blockers, ...materialized2.blocker ? [materialized2.blocker] : []]);
    }
    const budgetBlockers = budgetBoundaryBlockers(run);
    if (budgetBlockers.length > 0) {
      const materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized2.run, [...budgetBlockers, ...materialized2.blocker ? [materialized2.blocker] : []]);
    }
    if (!review.decision) return this.wait(run, review.blockers);
    if (aggregate.delivery === "blocked") {
      const materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.update(runId, (draft) => ({ ...draft, lifecycle: "blocked", delivery_status: "blocked", blockers: ["known-check-failure", ...materialized2.blocker ? [materialized2.blocker] : []], next_action: "correct-or-replan" }), "delivery-blocked");
    }
    if (["correct", "clarify", "replan", "retry-review"].includes(rootDecision.next_action)) return this.wait(run, [`root-review-${rootDecision.next_action}`]);
    const verified = aggregate.delivery === "verified" && rootDecision.assessment === "achieved" && rootDecision.delivery_status === "verified";
    const deliveryStatus = verified ? "verified" : "provisional";
    if (deliveryStatus === "provisional" && run.effective_profile === "autonomous") {
      run = this.update(runId, (draft) => ({ ...draft, effective_profile: "supervised", downgraded: true, downgrade_reason: "evidence-shortfall" }), "profile-auto-downgraded");
    }
    const materialized = this.materializeDeliveryEvidence(run, candidate);
    run = materialized.run;
    if (materialized.blocker) return this.block(run, [materialized.blocker]);
    if (deliveryStatus === "verified" && run.effective_profile === "autonomous") {
      const achieved = this.update(runId, (draft) => ({ ...draft, lifecycle: "achieved", delivery_status: "verified", delivery_accepted: false, phase: "achieved", next_action: "none", blockers: [] }), "run-achieved");
      this.store.appendDecision(runId, {
        phase: "delivery",
        decision: "achieved",
        reason: "certified evidence and independent review",
        input_hashes: [run.intent_hash, run.strategy.strategy_hash],
        strategy_revision: run.strategy.revision,
        evidence_refs: [.../* @__PURE__ */ new Set([...evidence.flatMap((entry) => entry.artifact_hashes), run.delivery_evidence_hash])].filter(Boolean),
        result: "achieved",
        delivery_evidence_hash: run.delivery_evidence_hash,
        delivery_commit: run.delivery_commit,
        delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths)
      });
      return achieved;
    }
    const delivery = this.update(runId, (draft) => ({ ...draft, lifecycle: "waiting-human", delivery_status: deliveryStatus, phase: deliveryStatus === "verified" ? "delivery-ready-verified" : "delivery-ready-provisional", next_action: deliveryStatus === "verified" ? "accept-verified" : "accept-provisional", blockers: [] }), "delivery-ready");
    this.store.appendDecision(runId, {
      phase: "delivery",
      decision: `deliver-${deliveryStatus}`,
      reason: verified ? "all evidence verified" : "no known failure but strongest evidence is incomplete",
      input_hashes: [run.intent_hash, run.strategy.strategy_hash],
      strategy_revision: run.strategy.revision,
      evidence_refs: [.../* @__PURE__ */ new Set([...evidence.flatMap((entry) => entry.artifact_hashes), run.delivery_evidence_hash])].filter(Boolean),
      result: delivery.lifecycle,
      delivery_evidence_hash: run.delivery_evidence_hash,
      delivery_commit: run.delivery_commit,
      delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths)
    });
    return delivery;
  }
  deliveryEvidenceCandidate(run, evidence) {
    const snapshot2 = repositoryBaseline(run.worktree?.path ?? this.workspaceRoot);
    const paths = run.worktree?.path ? changedPathsBetween(run.worktree.path, run.worktree.human_baseline, snapshot2.head) : changedPaths(this.workspaceRoot);
    const supplied = new Map(evidence.map((entry) => [entry.check_id, entry]));
    const completeEvidence = run.strategy.checks.filter((check) => check.Required === "yes").map((check) => supplied.get(check["Check ID"]) ?? {
      check_id: check["Check ID"],
      grade: "unavailable",
      surface: "controller",
      method: check["Command or Inspection"],
      expected: check["Expected Result"],
      observed: "Check not reached before the current delivery boundary",
      repetitions: 0,
      artifact_hashes: [],
      limitations: ["delivery stopped before this required Check could run"]
    });
    const candidate = buildDeliveryEvidence({
      rootPlanText: run.root_plan_text,
      artifacts: run.workflow_artifacts ?? [],
      checkEvidence: completeEvidence,
      changedPaths: paths,
      strategyRevision: run.strategy?.revision ?? 0,
      effectiveProfile: run.effective_profile,
      repositorySnapshot: {
        head: snapshot2.head,
        working_tree: snapshot2.status ? "modified" : "unchanged",
        relevant_fingerprints: `intent:${run.intent_hash};strategy:${run.strategy?.strategy_hash ?? "none"}`,
        known_failures: aggregateEvidence(completeEvidence).delivery === "blocked" ? "required Check failed" : "none"
      },
      pluginRoot: this.pluginRoot
    });
    return { ...candidate, delivery_commit: snapshot2.head, delivered_paths: paths };
  }
  controllerWorkReview(run, candidate, review) {
    if (!review?.decision) throw new Error("controller work-review requires one valid semantic reviewer decision");
    const reviewInput = controllerReviewInput(run, review.decision, review.auditor_reports ?? []);
    const built = buildWorkReview({
      rootPlanText: run.root_plan_text,
      artifacts: [...run.workflow_artifacts ?? [], { label: candidate.fields.id, text: candidate.artifact }],
      reviewInput,
      pluginRoot: this.pluginRoot
    });
    return {
      ...built,
      controller_decision: {
        ...review.decision,
        assessment: built.fields.assessment,
        delivery_status: built.fields.delivery_status,
        next_action: built.fields.next_action,
        review_route: built.fields.review_route,
        correction_id: built.fields.correction_id ?? null,
        learning_candidate_ids: built.fields.learning_candidates ?? []
      }
    };
  }
  materializeControllerReview(run, candidate, review) {
    const artifactMap = /* @__PURE__ */ new Map();
    for (const entry of [
      ...run.workflow_artifacts ?? [],
      { label: candidate.fields.id, text: candidate.artifact },
      { label: review.fields.id, text: review.artifact, builder_provenance: review.provenance }
    ]) {
      const artifact = entry.text.match(/^id:\s*([^\s]+)$/m)?.[1] ?? entry.label;
      const prior = artifactMap.get(artifact);
      if (prior && prior.text !== entry.text) throw new Error(`controller task-local artifact ${artifact} conflicts with immutable bytes`);
      artifactMap.set(artifact, { label: artifact, text: entry.text, ...entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {} });
    }
    const workflowArtifacts = [...artifactMap.values()];
    const handoffEntries = [
      { label: run.plan.fields.id, text: run.root_plan_text },
      ...workflowArtifacts.map((entry) => ({ label: entry.label, text: entry.text, ...entry.builder_provenance ? { provenance: entry.builder_provenance } : {} }))
    ];
    let handoffPersisted = true;
    let handoffWarning = null;
    try {
      this.handoffStore.record(handoffEntries);
    } catch (error) {
      handoffPersisted = false;
      handoffWarning = `optional controller review handoff unavailable: ${error.message}; task-local Review remains valid`;
    }
    try {
      createContentAddressedHandoffStore(run.root_plan_text, this.pluginRoot).record(handoffEntries);
      rememberContentAddressedRoot(run.root_plan_text, this.pluginRoot);
      handoffPersisted = true;
      handoffWarning = null;
    } catch {
    }
    return this.update(run.run_id, (draft) => ({
      ...draft,
      workflow_artifacts: workflowArtifacts,
      delivery_evidence_id: candidate.fields.id,
      delivery_evidence_hash: candidate.artifact_hash,
      delivery_evidence_artifact: candidate.artifact,
      delivery_commit: candidate.delivery_commit,
      delivered_paths: candidate.delivered_paths,
      work_review_id: review.fields.id,
      work_review_hash: review.artifact_hash,
      work_review_artifact: review.artifact,
      review_input_hash: review.review_input_hash,
      work_review_builder_provenance: review.provenance,
      handoff_persisted: handoffPersisted,
      integration_warnings: [.../* @__PURE__ */ new Set([...draft.integration_warnings ?? [], ...handoffWarning ? [handoffWarning] : []])]
    }), "work-review-materialized");
  }
  materializeDeliveryEvidence(run, candidate) {
    if (run.delivery_evidence_id === candidate.fields.id && run.delivery_evidence_hash === candidate.artifact_hash && run.delivery_evidence_artifact === candidate.artifact) {
      return { run, blocker: null };
    }
    let handoffPersisted = true;
    let handoffWarning = null;
    let blocker = null;
    const entries = [
      { label: run.plan.fields.id, text: run.root_plan_text },
      { label: candidate.fields.id, text: candidate.artifact }
    ];
    try {
      this.handoffStore.record(entries);
    } catch (error) {
      handoffPersisted = false;
      const semanticConflict = /conflict|invalid|corrupt|incompatible|multiple|ambiguous|stale/i.test(error.message);
      if (semanticConflict) blocker = `delivery-evidence-handoff-conflict:${error.message}`;
      else handoffWarning = `delivery evidence handoff unavailable: ${error.message}`;
    }
    if (run.root_plan_text) {
      try {
        createContentAddressedHandoffStore(run.root_plan_text, this.pluginRoot).record(entries);
        rememberContentAddressedRoot(run.root_plan_text, this.pluginRoot);
        if (!blocker) {
          handoffPersisted = true;
          handoffWarning = null;
        }
      } catch {
      }
    }
    const updated = this.update(run.run_id, (draft) => ({
      ...draft,
      delivery_evidence_id: candidate.fields.id,
      delivery_evidence_hash: candidate.artifact_hash,
      delivery_evidence_artifact: candidate.artifact,
      delivery_commit: candidate.delivery_commit,
      delivered_paths: candidate.delivered_paths,
      handoff_persisted: handoffPersisted,
      integration_warnings: [.../* @__PURE__ */ new Set([...draft.integration_warnings ?? [], ...handoffWarning ? [handoffWarning] : []])]
    }), "delivery-evidence-materialized");
    return { run: updated, blocker };
  }
  acceptDelivery(runId, acceptance) {
    const run = this.store.get(runId);
    if (!["verified", "provisional"].includes(acceptance)) throw new Error("acceptance must be verified or provisional");
    if (run.lifecycle !== "waiting-human" || run.next_action !== (acceptance === "verified" ? "accept-verified" : "accept-provisional")) throw new Error("delivery is not awaiting this acceptance");
    if (run.delivery_status !== acceptance) throw new Error(`delivery acceptance mismatch: expected ${run.delivery_status}`);
    const lifecycle = acceptance === "verified" ? "achieved" : "accepted-provisional";
    const accepted = this.update(runId, (draft) => ({ ...draft, lifecycle, delivery_accepted: true, accepted_as: acceptance, phase: lifecycle, next_action: "none", blockers: [] }), acceptance === "verified" ? "delivery-accepted" : "provisional-delivery-accepted");
    this.store.appendDecision(runId, {
      phase: "delivery",
      decision: `accept-${acceptance}`,
      reason: `human accepted the ${acceptance} delivery`,
      input_hashes: [run.intent_hash, run.strategy?.strategy_hash].filter(Boolean),
      strategy_revision: run.strategy?.revision ?? null,
      evidence_refs: [run.delivery_evidence_hash].filter(Boolean),
      result: acceptance === "verified" ? "accepted-verified" : "accepted-provisional",
      delivery_evidence_hash: run.delivery_evidence_hash,
      delivery_commit: run.delivery_commit,
      delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths)
    });
    return accepted;
  }
  wait(run, blockers) {
    return this.update(run.run_id, (draft) => ({ ...draft, lifecycle: "waiting-human", blockers: [...new Set(blockers)], next_action: "answer" }), "waiting-human");
  }
  block(run, blockers) {
    return this.update(run.run_id, (draft) => ({
      ...draft,
      lifecycle: "blocked",
      delivery_status: "blocked",
      blockers: [...new Set(blockers)],
      next_action: "inspect-and-replan"
    }), "hard-boundary-blocked");
  }
  rollbackAndWait(run, blockers) {
    const target = run.checkpoints?.at(-1)?.commit ?? run.worktree?.human_baseline ?? run.baseline.head;
    const rollback = rollbackToCheckpoint(run.worktree.path, target);
    const restored = this.update(run.run_id, (draft) => ({ ...draft, rollbacks: [...draft.rollbacks ?? [], { at: (/* @__PURE__ */ new Date()).toISOString(), target, ...rollback, blockers: [...new Set(blockers)] }] }), "worktree-rolled-back");
    return this.wait(restored, blockers);
  }
  usage(run) {
    return usageForRun(run);
  }
  gitDiff(worktreePath, baseline) {
    const result = spawnSync2("git", ["-C", worktreePath, "diff", baseline, "--"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr.trim());
    return result.stdout.slice(-25e4);
  }
};

export {
  deriveWorkflowState,
  captureRepositorySnapshot,
  deriveRepositoryDelta,
  evidenceRepositorySnapshot,
  manualReceiptHash,
  stableManualReceiptJson,
  repositorySnapshotFingerprint,
  canonicalManualWorkspaceRoot,
  readManualReceiptRecord,
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
  manualConstraintProjection,
  buildDeliveryEvidence,
  persistCloseout,
  buildWorkReview,
  persistWorkReview,
  deriveControllerLearningContext,
  derivePreparationLearningContext,
  WorkflowEngine
};
