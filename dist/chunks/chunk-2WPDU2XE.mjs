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
} from "./chunk-M7ERKP7Q.mjs";
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
} from "./chunk-QB5KAHPL.mjs";
import {
  CursorWorkerAdapter,
  evaluateAuthorization,
  evaluateEligibility,
  qualificationKey,
  selectWriterRoute
} from "./chunk-7SYGAAH5.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot
} from "./chunk-TQFRRM3Y.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText
} from "./chunk-3CKZRPWU.mjs";
import {
  repositoryKey,
  require_dist,
  rootContentHash,
  sharedArtifactStateRoot
} from "./chunk-7JUFD6FK.mjs";
import {
  assertCompatiblePreparation,
  classifyPreparationCompatibility,
  classifyRunCompatibility,
  runEventSubject
} from "./chunk-7NHOTGTA.mjs";
import {
  __toESM
} from "./chunk-WU6JOB3C.mjs";

// src/controller/learning-context.mjs
import { createHash as createHash2 } from "node:crypto";

// src/controller/strategy.mjs
import { createHash } from "node:crypto";
var TASK_RECIPES = Object.freeze({
  bugfix: Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: !0, comparison: "same-surface" }),
  refactor: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: !0, comparison: "characterization-or-equivalence" }),
  performance: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: !0, comparison: "baseline-and-post-trace" }),
  feature: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 1, writer_allowed: !0, comparison: "acceptance-and-regression" }),
  investigation: Object.freeze({ version: "recipe-1", baseline_repetitions: 1, patched_repetitions: 0, writer_allowed: !1, comparison: "read-only-findings" }),
  "verify-existing": Object.freeze({ version: "recipe-1", baseline_repetitions: 2, patched_repetitions: 2, writer_allowed: !1, comparison: "same-input-candidate-comparison" })
});
function stable(value) {
  return Array.isArray(value) ? value.map(stable) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function strategyHash(strategy) {
  return createHash("sha256").update(JSON.stringify(stable(strategy))).digest("hex");
}
function inferTaskClass(goal) {
  let source = String(goal ?? "").toLowerCase();
  return /verify|validate|existing (?:fix|commit|change)|bestehenden? (?:fix|commit|änderung)/.test(source) ? "verify-existing" : /performance|latency|throughput|profil|trace|slow|langsam/.test(source) ? "performance" : /refactor|restructure|cleanup|vereinfach|umbau/.test(source) ? "refactor" : /investigat|diagnos|analyse|explain|ursache finden/.test(source) ? "investigation" : /bug|fix|defect|fehler|regression|crash/.test(source) ? "bugfix" : "feature";
}
function createInitialStrategy(contract) {
  let seed = structuredClone(contract.strategy ?? {}), taskClass = TASK_RECIPES[seed.task_class] ? seed.task_class : inferTaskClass(contract.fields.goal), value = {
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
  let nextTargets = patch.primary_targets ?? current.primary_targets;
  for (let target of nextTargets) if (!inside(target, authority.allowed_roots ?? [])) throw new Error(`strategy target escapes authority: ${target}`);
  if (patch.task_class && !TASK_RECIPES[patch.task_class]) throw new Error(`unknown task recipe: ${patch.task_class}`);
  let baseHash = current.strategy_hash ?? strategyHash(Object.fromEntries(Object.entries(current).filter(([key]) => key !== "strategy_hash"))), taskClass = patch.task_class ?? current.task_class, next = {
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
  return delete next.strategy_hash, { ...next, strategy_hash: strategyHash(next) };
}
function evidenceGrade(receipt) {
  return receipt?.passed === !0 ? "verified" : receipt?.passed === !1 ? "failed" : receipt?.supported === !0 ? "supported" : receipt?.unavailable === !0 ? "unavailable" : "partial";
}
function aggregateEvidence(entries) {
  let grades = entries.map((entry) => entry.grade);
  return grades.includes("failed") ? { grade: "failed", delivery: "blocked" } : entries.length > 0 && grades.every((grade) => grade === "verified") ? { grade: "verified", delivery: "verified" } : grades.includes("unavailable") ? { grade: "unavailable", delivery: "provisional" } : grades.includes("partial") ? { grade: "partial", delivery: "provisional" } : { grade: "supported", delivery: "provisional" };
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
    observed: receipt?.passed === !0 ? "passed" : receipt?.passed === !1 ? receipt.error ?? receipt.stderr ?? "failed" : receipt?.reason ?? "not fully observed",
    repetitions: receipt?.repetitions ?? (receipt?.passed === !0 || receipt?.passed === !1 ? 1 : 0),
    artifact_hashes: receipt?.artifact_hashes ?? [],
    limitations: receipt?.limitations ?? (receipt?.unavailable ? [receipt.reason ?? "verification unavailable"] : [])
  };
}
function calibrateRecipeEvidence(taskClass, entries, stage, baselineEntries = []) {
  let recipe = TASK_RECIPES[taskClass];
  if (!recipe) throw new Error(`unknown task recipe: ${taskClass}`);
  let minimum = stage === "baseline" ? recipe.baseline_repetitions : recipe.patched_repetitions, baselineByCheck = new Map(baselineEntries.map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    let limitations = [...entry.limitations ?? []], grade = entry.grade;
    if (grade === "verified" && entry.repetitions < minimum && (grade = "partial", limitations.push(`${taskClass} recipe requires ${minimum} ${stage} repetitions`)), stage === "patched" && ["bugfix", "performance", "verify-existing"].includes(taskClass)) {
      let baseline = baselineByCheck.get(entry.check_id);
      baseline && baseline.surface !== entry.surface && (grade === "verified" && (grade = "partial"), limitations.push(`${taskClass} recipe requires comparable baseline and patched surfaces`));
    }
    return grade === "verified" && taskClass === "refactor" && !/(?:characterization|snapshot|equivalence)/i.test(`${entry.method} ${entry.observed}`) && (grade = "partial", limitations.push("refactor recipe requires characterization, snapshot, or equivalence evidence")), grade === "verified" && taskClass === "performance" && !/(?:benchmark|trace|latency|throughput|metric)/i.test(`${entry.method} ${entry.expected} ${entry.observed}`) && (grade = "partial", limitations.push("performance recipe requires an explicit comparable metric or trace")), { ...entry, grade, limitations: [...new Set(limitations)] };
  });
}

// src/controller/learning-context.mjs
var learningIdPattern = /^LRN-[A-Za-z0-9][A-Za-z0-9-]*$/, findingKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/, candidateKeys = /* @__PURE__ */ new Set(["finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"]), candidateLimit = 16;
function hash(value) {
  return createHash2("sha256").update(typeof value == "string" ? value : JSON.stringify(value)).digest("hex");
}
function canonicalValue(value) {
  return Array.isArray(value) ? value.map((entry) => canonicalValue(entry)) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== void 0).map((key) => [key, canonicalValue(value[key])]));
}
function stableHash(value) {
  return hash(JSON.stringify(canonicalValue(value)));
}
function runIntegrityBlockers(run, pluginRoot) {
  let blockers = [], root;
  try {
    root = executionContractFromArtifactText(run?.root_plan_text, pluginRoot);
  } catch (error) {
    return [`intent-root-unreadable:${error.message}`];
  }
  if (root.errors.length > 0 && blockers.push("intent-root-invalid"), root.raw_hash !== run.root_plan_hash && blockers.push("intent-root-content-hash-mismatch"), (root.authoritative_projection_hash !== run.root_authoritative_projection_hash || root.authoritative_projection_hash !== run.intent_hash) && blockers.push("intent-root-projection-hash-mismatch"), hash(root.fields) !== hash(run.plan?.fields) && blockers.push("intent-root-state-mismatch"), run.strategy?.root_projection_hash !== run.intent_hash && blockers.push("strategy-root-projection-mismatch"), run.strategy) {
    let { strategy_hash: declaredHash, ...projection } = run.strategy;
    strategyHash(projection) !== declaredHash && blockers.push("strategy-hash-mismatch");
  } else blockers.push("strategy-missing");
  return unique(blockers);
}
function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}
function boundedText(value, label, maximum = 4e3) {
  if (typeof value != "string" || value.trim() === "") throw new Error(`${label} must be non-empty text`);
  let normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${label} exceeds ${maximum} characters`);
  return normalized;
}
function normalizedStringArray(value, label, { maximum = 32, pattern = null, itemMaximum = 1e3 } = {}) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  if (value.length > maximum) throw new Error(`${label} exceeds ${maximum} items`);
  let normalized = unique(value.map((entry) => boundedText(entry, label, itemMaximum)));
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
  let bindings = (Array.isArray(candidate?.source_bindings) ? candidate.source_bindings : null) ?? unique(receiptIds).map((receiptId) => ({
    source_receipt_id: receiptId,
    source_decision_hash: controllerLearningDecisionHash(decision2, candidate)
  }));
  if (bindings.length === 0 || bindings.length > 16) throw new Error("controller learning candidate requires bounded reviewer provenance");
  let normalized = bindings.map((binding) => ({
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
  let payload = candidatePayload(candidate), sourceDecisionHash = boundedText(candidate?.source_decision_hash, "controller learning source decision hash", 64);
  if (!/^[a-f0-9]{64}$/.test(sourceDecisionHash)) throw new Error("controller learning source decision hash is invalid");
  let projected = {
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
  let allowedFindings = new Set(findingKeys), normalized = value.map((candidate, index) => {
    if (!candidate || typeof candidate != "object" || Array.isArray(candidate)) throw new Error(`learning candidate ${index + 1} must be an object`);
    let unknown = Object.keys(candidate).filter((key) => !candidateKeys.has(key));
    if (unknown.length > 0) throw new Error(`learning candidate ${index + 1} has unknown fields: ${unknown.join(", ")}`);
    let candidateFindings = normalizedStringArray(candidate.finding_keys, `learning candidate ${index + 1} finding_keys`, { pattern: findingKeyPattern });
    if (candidateFindings.some((key) => !allowedFindings.has(key))) throw new Error(`learning candidate ${index + 1} references an unknown finding key`);
    let candidateTargets = normalizedStringArray(candidate.candidate_targets, `learning candidate ${index + 1} candidate_targets`, { maximum: 16, itemMaximum: 500 });
    if (candidateTargets.some((target) => target.startsWith("/") || target.split(/[\\/]/).includes("..")))
      throw new Error(`learning candidate ${index + 1} contains a non-project target`);
    return {
      finding_keys: candidateFindings,
      reusable_guidance: boundedText(candidate.reusable_guidance, `learning candidate ${index + 1} reusable_guidance`, 2e3),
      candidate_targets: candidateTargets,
      confirmation_evidence: boundedText(candidate.confirmation_evidence, `learning candidate ${index + 1} confirmation_evidence`, 2e3)
    };
  }), seen = /* @__PURE__ */ new Set();
  return normalized.filter((candidate) => {
    let digest = hash(candidate);
    return seen.has(digest) ? !1 : (seen.add(digest), !0);
  });
}
function materializeControllerLearningCandidates({ run, decision: decision2, correctionCycle, receiptIds = [] }) {
  let proposed = decision2?.learning_candidates ?? [];
  if (decision2?.next_action !== "correct") return { correction_id: null, candidates: [] };
  let rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("controller learning candidates require a valid Root ID");
  let rootSuffix = rootPlanId.replace(/^wp-/, ""), cycle = Number.isInteger(correctionCycle) && correctionCycle > 0 ? correctionCycle : 1, correctionId = `cp-${rootSuffix}-controller-${cycle}`, candidates = proposed.map((candidate) => {
    let payload = candidatePayload(candidate), candidateHash = candidateIdentity(run.run_id, rootPlanId, payload), sourceBindings = normalizeSourceBindings(candidate, decision2, receiptIds), lineage = [{
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
  let merged = /* @__PURE__ */ new Map();
  for (let candidate of [...existing, ...additions]) {
    let normalizedCandidate = projectedControllerLearningCandidate(candidate), payload = candidatePayload(normalizedCandidate), candidateHash = candidateIdentity(normalizedCandidate.run_id, normalizedCandidate.root_plan_id, payload), expectedId = `LRN-${String(normalizedCandidate.root_plan_id).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
    if (normalizedCandidate.candidate_hash !== candidateHash || normalizedCandidate.learning_id !== expectedId) throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent content identity`);
    let lineage = normalizedCandidate.lineage, first = lineage[0], receiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
    if (normalizedCandidate.correction_id !== first.correction_id || normalizedCandidate.correction_cycle !== first.correction_cycle || normalizedCandidate.strategy_revision !== first.strategy_revision || normalizedCandidate.source_decision_hash !== first.source_bindings[0]?.source_decision_hash || JSON.stringify(normalizedCandidate.source_receipt_ids) !== JSON.stringify(receiptIds))
      throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent correction provenance`);
    let prior = merged.get(candidateHash);
    if (prior && stableHash(candidatePayload(prior)) !== stableHash(payload)) throw new Error(`controller learning candidate ${candidate.learning_id} conflicts with its prior record`);
    if (!prior) {
      merged.set(candidateHash, normalizedCandidate);
      continue;
    }
    let combinedLineage = [...new Map([...prior.lineage, ...lineage].map((entry) => [stableHash(entry), entry])).values()].toSorted((left, right) => left.correction_cycle - right.correction_cycle || left.correction_id.localeCompare(right.correction_id)), sourceReceiptIds = unique(combinedLineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted(), primary = combinedLineage[0];
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
  for (let event of events) {
    if (!event || event.previous_hash !== previousHash || typeof event.event_hash != "string") return { valid: !1, blocker: "controller-event-chain-invalid" };
    let { event_hash: eventHash, ...unsigned } = event;
    if (hash(unsigned) !== eventHash) return { valid: !1, blocker: "controller-event-chain-invalid" };
    previousHash = eventHash;
  }
  return { valid: !0, blocker: null, last_hash: previousHash };
}
function terminalDeliveryEvent(run, events, deliveredPaths, { allowUnboundLegacy = !1 } = {}) {
  let requiredResult = run.effective_profile === "supervised" ? "accepted-verified" : "achieved", expectedPathsHash = deliveryPathsHash(run.delivery_commit, deliveredPaths), expectedSubject = runEventSubject(run), subjectRequired = run.event_subject_schema === 1, legacySubjectAbsent = !Object.hasOwn(run, "event_subject_schema");
  if (!subjectRequired && !legacySubjectAbsent) return !1;
  let expectedSubjectValid = expectedSubject.run_id === run.run_id && /^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(expectedSubject.root_plan_id)) && /^[a-f0-9]{64}$/.test(String(expectedSubject.intent_hash)) && ["supervised", "autonomous"].includes(expectedSubject.effective_profile), projectionFields = ["delivery_evidence_hash", "delivery_commit", "delivered_paths_hash"];
  return events.some((event) => {
    if (event.type !== "decision" || event.payload?.result !== requiredResult || !event.payload?.evidence_refs?.includes(run.delivery_evidence_hash)) return !1;
    let hasProjectionBinding = projectionFields.some((field) => Object.hasOwn(event.payload ?? {}, field)), projectionMatches = event.payload?.delivery_evidence_hash === run.delivery_evidence_hash && event.payload?.delivery_commit === run.delivery_commit && event.payload?.delivered_paths_hash === expectedPathsHash, hasSubject = Object.hasOwn(event, "subject"), subjectMatches = expectedSubjectValid && hasSubject && stableHash(event.subject) === stableHash(expectedSubject);
    return subjectRequired || hasSubject ? projectionMatches && subjectMatches : allowUnboundLegacy && legacySubjectAbsent && (projectionMatches || !hasProjectionBinding);
  });
}
function reviewerReceiptConfirmed(run, receiptId) {
  let matches = (run.receipts ?? []).filter((receipt2) => receipt2?.request_id === receiptId);
  if (matches.length !== 1) return !1;
  let [receipt] = matches;
  return ["reviewer", "investigator"].includes(receipt.phase) && receipt.model_attested === !0 && receipt.status === "finished" && receipt.reader_repository_unchanged !== !1 && typeof receipt.agent_id == "string" && receipt.agent_id !== "" && Number.isFinite(receipt.duration_ms) && receipt.duration_ms >= 0 && Number.isFinite(receipt.usage?.totalTokens) && receipt.usage.totalTokens >= 0 && Number.isFinite(receipt.cost_usd) && receipt.cost_usd >= 0 && receipt.artifact_projection_hash === run.intent_hash;
}
function controllerCandidateConfirmed(candidate, { eligible, run, events, chainValid, deliveredPaths }) {
  if (!eligible || !chainValid) return !1;
  let projected;
  try {
    projected = projectedControllerLearningCandidate(candidate);
  } catch {
    return !1;
  }
  let payload = candidatePayload(projected), rootPlanId = run.plan?.fields?.id ?? run.root_plan_id, candidateHash = candidateIdentity(run.run_id, rootPlanId, payload), expectedId = `LRN-${String(rootPlanId).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
  if (projected.run_id !== run.run_id || projected.root_plan_id !== rootPlanId || projected.candidate_hash !== candidateHash || projected.learning_id !== expectedId) return !1;
  let lineage = projected.lineage, first = lineage[0], expectedReceiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
  if (projected.correction_id !== first.correction_id || projected.correction_cycle !== first.correction_cycle || projected.strategy_revision !== first.strategy_revision || projected.source_decision_hash !== first.source_bindings[0]?.source_decision_hash || JSON.stringify(projected.source_receipt_ids) !== JSON.stringify(expectedReceiptIds)) return !1;
  let correctionLinked = lineage.every((entry) => {
    let expectedRef = controllerLearningEventRefs([{ ...projected, lineage: [entry] }])[0], sourceReceiptIds = entry.source_bindings.map((binding) => binding.source_receipt_id).toSorted();
    return events.some((event) => event.type === "decision" && event.payload?.correction_id === entry.correction_id && event.payload?.learning_candidate_ids?.includes(projected.learning_id) && sourceReceiptIds.every((receiptId) => (event.payload?.actor_receipts ?? []).includes(receiptId)) && (event.payload?.learning_candidate_refs ?? []).some((reference) => stableHash(reference) === stableHash(expectedRef)));
  }), provenanceAttested = expectedReceiptIds.every((receiptId) => reviewerReceiptConfirmed(run, receiptId)), evidenceLinked = typeof run.delivery_evidence_hash == "string" && typeof run.delivery_commit == "string" && terminalDeliveryEvent(run, events, deliveredPaths), finalFindings = new Set(run.review?.finding_keys ?? []);
  return correctionLinked && provenanceAttested && evidenceLinked && projected.finding_keys.every((key) => !finalFindings.has(key));
}
function deriveControllerLearningContext({ run, events = [], workspaceRoot, pluginRoot, sourceBinding = null }) {
  let blockers = [], compatibility = classifyRunCompatibility(run);
  compatibility.compatible || blockers.push(compatibility.blocker ?? "controller-run-protocol-incompatible"), run?.event_subject_schema === 1 && blockers.push(...runIntegrityBlockers(run, pluginRoot)), sourceBinding?.confirmed !== !0 && blockers.push(sourceBinding?.blocker ?? "controller-learning-source-not-current-task-bound"), run.lifecycle !== "achieved" && blockers.push("learning-source-not-achieved"), (run.delivery_status !== "verified" || run.evidence_grade !== "verified") && blockers.push("learning-source-not-verified"), (!run.root_review_complete || run.review?.assessment !== "achieved" || run.review?.delivery_status !== "verified") && blockers.push("learning-review-not-achieved"), (run.blockers ?? []).length > 0 && blockers.push("learning-source-has-blockers"), run.effective_profile === "supervised" && !(run.delivery_accepted === !0 && run.accepted_as === "verified") && blockers.push("supervised-learning-requires-verified-acceptance"), ["supervised", "autonomous"].includes(run.effective_profile) || blockers.push("controller-learning-profile-invalid");
  let chain = verifyEventChain(events);
  events.length === 0 && blockers.push("controller-event-chain-missing"), chain.valid || blockers.push(chain.blocker);
  let deliveryCommit = run.delivery_commit ?? run.checkpoints?.at(-1)?.commit ?? null, humanBaseline = run.worktree?.human_baseline ?? null, storedPaths = null;
  if (Array.isArray(run.delivered_paths))
    try {
      storedPaths = normalizedStringArray(run.delivered_paths, "controller delivered_paths", { maximum: 1e4, itemMaximum: 4e3 });
    } catch {
      blockers.push("controller-delivery-paths-invalid");
    }
  let deliveredPaths = null;
  if ((!deliveryCommit || !humanBaseline) && blockers.push("controller-delivery-fingerprint-unavailable"), deliveryCommit && humanBaseline)
    try {
      deliveredPaths = changedPathsBetween(workspaceRoot, humanBaseline, deliveryCommit), deliveredPaths.length === 0 && blockers.push("controller-delivery-paths-empty"), storedPaths && JSON.stringify(storedPaths) !== JSON.stringify(deliveredPaths) && blockers.push("controller-delivery-paths-mismatch");
    } catch {
      blockers.push("controller-delivery-paths-unavailable");
    }
  let workspaceMatch = { status: "unverifiable", matched: !1, paths: deliveredPaths ?? [] };
  deliveryCommit && deliveredPaths && (workspaceMatch = workspaceDeliveryMatch(workspaceRoot, deliveryCommit, deliveredPaths), workspaceMatch.matched || blockers.push(`controller-delivery-${workspaceMatch.status}`)), chain.valid && deliveredPaths && !terminalDeliveryEvent(run, events, deliveredPaths, { allowUnboundLegacy: !0 }) && blockers.push("controller-delivery-event-unconfirmed");
  let projectedCandidates = [];
  for (let candidate of run.learning_candidates ?? [])
    try {
      projectedCandidates.push(projectedControllerLearningCandidate(candidate));
    } catch {
      blockers.push("controller-learning-candidate-invalid");
    }
  let eligible = blockers.length === 0, candidates = projectedCandidates.map((candidate) => ({
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
    source_binding: sourceBinding?.confirmed === !0 ? { status: "confirmed", kind: sourceBinding.kind ?? "ephemeral-receipt" } : { status: "unconfirmed", kind: sourceBinding?.kind ?? null },
    candidates
  };
}
function derivePreparationLearningContext(preparation) {
  let compatibility = classifyPreparationCompatibility(preparation);
  return {
    schema: 1,
    eligible: !1,
    source_kind: "controller-preparation",
    source_id: preparation?.preparation_id ?? null,
    root_plan_id: preparation?.root_plan_id ?? preparation?.plan?.fields?.id ?? null,
    effective_profile: preparation?.requested_profile ?? null,
    blockers: [compatibility.blocker ?? "learning-source-not-delivery-run"],
    workspace_match: { status: "not-applicable", matched: !1, paths: [] },
    delivery_commit: null,
    delivered_paths: [],
    event_chain_valid: !1,
    compatibility: compatibility.compatibility,
    source_binding: { status: "not-applicable", kind: null },
    candidates: []
  };
}

// src/controller/engine.mjs
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync3, statSync } from "node:fs";
import { join as join3, resolve as resolve4 } from "node:path";
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
]), terminalLifecycle = /* @__PURE__ */ new Set(["achieved", "accepted-provisional", "blocked", "stopped", "failed"]);
function snapshot(input, state, overrides = {}) {
  if (!states.has(state)) throw new Error(`unsupported workflow state ${state}`);
  let snapshotSource = input.snapshot_source ?? (input.run_id ? "controller-run" : "artifact-chain");
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
  let manualArtifacts = input.snapshot_source === "artifact-chain";
  if (terminalLifecycle.has(input.lifecycle)) return snapshot(input, input.lifecycle, { required_actor: "none" });
  if (input.lifecycle === "paused") return snapshot(input, "paused", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "resume" });
  if (input.lifecycle === "interrupted") return snapshot(input, "interrupted", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "reconcile-and-resume" });
  if (manualArtifacts && input.manual_context_incomplete) return snapshot(input, "waiting-human", {
    allowed_actions: ["provide-artifacts"],
    required_actor: "human",
    next_action: "provide-artifacts"
  });
  if (input.artifact_chain_valid === !1) return snapshot(input, "replan", {
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
  if (input.root_schema_valid === !1) return snapshot(input, "replan", {
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
  let nextAction = input.review?.next_action;
  return manualArtifacts && input.correction_evidence_pending_review ? snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "review-root" }) : nextAction === "clarify" ? manualArtifacts ? snapshot(input, "waiting-human", { allowed_actions: ["answer", "replan"], required_actor: "human", next_action: "answer", blockers: [.../* @__PURE__ */ new Set([...input.blockers ?? [], "review-requires-clarification"])] }) : waiting(input, "review-requires-clarification", "answer") : nextAction === "replan" ? snapshot(input, "replan", { allowed_actions: manualArtifacts ? ["replan"] : ["replan", "stop"], required_actor: "human", next_action: "replan" }) : nextAction === "correct" ? manualArtifacts ? snapshot(input, "waiting-human", { allowed_actions: ["inspect", "correct", "replan"], required_actor: "human", next_action: "approve-correction" }) : snapshot(input, "slice-review", { allowed_actions: ["correct", "pause", "stop"], required_actor: "writer", next_action: "correct" }) : nextAction === "retry-review" ? manualArtifacts ? snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "retry-review" }) : snapshot(input, "slice-review", { allowed_actions: ["retry-review", "pause", "stop"], required_actor: "reviewer", next_action: "retry-review" }) : input.more_slices ? snapshot(input, "slice-ready", { allowed_actions: ["implement", "pause", "stop"], required_actor: "writer", next_action: "implement-next-slice" }) : manualArtifacts && input.delivery_status === "provisional" ? input.manual_acceptance === "provisional" ? snapshot(input, "accepted-provisional", {
    allowed_actions: ["inspect"],
    required_actor: "none",
    next_action: "none",
    acceptance_persisted: !1,
    acceptance_basis_hash: input.acceptance_basis_hash ?? input.artifact_set_hash ?? null
  }) : snapshot(input, "delivery-ready-provisional", { allowed_actions: ["accept-provisional", "inspect"], required_actor: "human", next_action: "accept-provisional" }) : input.root_review_complete ? input.phase === "delivery-ready-provisional" || input.delivery_status === "provisional" ? snapshot(input, "delivery-ready-provisional", { allowed_actions: ["accept-provisional", "inspect", "stop"], required_actor: "human", next_action: "accept-provisional" }) : !manualArtifacts && (input.phase === "delivery-ready-verified" || input.delivery_status === "verified" && !input.delivery_accepted) ? snapshot(input, "delivery-ready-verified", { allowed_actions: ["accept-verified", "inspect", "stop"], required_actor: "human", next_action: "accept-verified" }) : input.review?.assessment !== "achieved" ? snapshot(input, "replan", { allowed_actions: ["replan", "stop"], required_actor: "human", next_action: "replan", blockers: ["root-review-not-achieved"] }) : snapshot(input, "achieved", { allowed_actions: ["explain", "learn"], required_actor: "none", next_action: "none" }) : snapshot(input, "root-review", { allowed_actions: manualArtifacts ? ["review"] : ["review", "pause", "stop"], required_actor: "reviewer", next_action: "review-root" });
}
var workflowStates = Object.freeze([...states]);

// src/controller/delivery-closeout.mjs
var import_yaml = __toESM(require_dist(), 1);
import { createHash as createHash5 } from "node:crypto";

// src/core/manual-check-receipts.mjs
import { createHash as createHash4, randomUUID as randomUUID2 } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync as lstatSync2,
  mkdirSync as mkdirSync2,
  readdirSync,
  readFileSync as readFileSync2,
  realpathSync as realpathSync2,
  renameSync as renameSync2,
  rmSync as rmSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { dirname, join as join2, relative, resolve as resolve3, sep } from "node:path";

// src/core/manual-repository-snapshot.mjs
import { resolve as resolve2 } from "node:path";

// src/core/native-task-review-state.mjs
import { createHash as createHash3, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
var LOCK_STALE_MS = 3e4, LOCK_WAIT_MS = 2e3;
function git(workspaceRoot, args, options = {}) {
  let result = (options.spawnSync ?? spawnSync)("git", ["-C", workspaceRoot, ...args], {
    encoding: args.includes("-z") ? "buffer" : "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: !0
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    let stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : String(result.stderr ?? "");
    throw new Error(`repository snapshot failed: git ${args.join(" ")} (${stderr.trim() || `exit ${result.status}`})`);
  }
  return result.stdout;
}
function canonicalRepositoryRoot(workspaceRoot, options = {}) {
  if (typeof workspaceRoot != "string" || !workspaceRoot.startsWith("/")) return null;
  let candidate = realpathSync(resolve(workspaceRoot));
  return realpathSync(String(git(candidate, ["rev-parse", "--show-toplevel"], options)).trim());
}
function nulPaths(value) {
  return (Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""))).toString("utf8").split("\0").filter(Boolean);
}
function indexEntries(value) {
  let buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? "")), entries = /* @__PURE__ */ new Map();
  for (let record of buffer.toString("utf8").split("\0").filter(Boolean)) {
    let separator = record.indexOf("	");
    if (separator < 0) continue;
    let path = record.slice(separator + 1), metadata = record.slice(0, separator);
    entries.set(path, metadata);
  }
  return entries;
}
function sha256(value) {
  return createHash3("sha256").update(value).digest("hex");
}
function canonicalValue2(value) {
  return Array.isArray(value) ? value.map(canonicalValue2) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue2(value[key])]));
}
function repositoryPathFingerprint(workspaceRoot, repositoryPath) {
  let absolute = resolve(workspaceRoot, repositoryPath);
  try {
    let stat = lstatSync(absolute);
    return stat.isSymbolicLink() ? `symlink:${sha256(Buffer.from(readlinkSync(absolute), "utf8"))}` : stat.isFile() ? `file:${stat.mode.toString(8)}:${sha256(readFileSync(absolute))}` : stat.isDirectory() ? `directory:${stat.mode.toString(8)}` : `other:${stat.mode.toString(8)}:${stat.size}`;
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}
function captureRepositorySnapshot(workspaceRoot, options = {}) {
  let root = canonicalRepositoryRoot(workspaceRoot, options);
  if (!root) throw new Error("repository snapshot requires one canonical Git repository");
  let head = String(git(root, ["rev-parse", "HEAD"], options)).trim(), index = git(root, ["ls-files", "--stage", "-z", "--"], options), status = git(root, ["status", "--porcelain=v2", "--untracked-files=all", "-z", "--"], options), tracked = nulPaths(git(root, ["diff", "--name-only", "-z", "HEAD", "--"], options)), untracked = nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--"], options)), dirtyPaths = [.../* @__PURE__ */ new Set([...tracked, ...untracked])].sort(), staged = indexEntries(index), fingerprints = Object.fromEntries(dirtyPaths.map((path) => [
    path,
    `${repositoryPathFingerprint(root, path)}|index:${sha256(Buffer.from(staged.get(path) ?? "untracked", "utf8"))}`
  ]));
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
function validRepositorySnapshot(value) {
  return !!(value && value.schema === 1 && typeof value.repository_root == "string" && typeof value.head == "string" && Array.isArray(value.dirty_paths) && value.fingerprints && typeof value.fingerprints == "object" && !Array.isArray(value.fingerprints));
}
function repositorySnapshotHash(snapshot2) {
  return validRepositorySnapshot(snapshot2) ? sha256(Buffer.from(JSON.stringify(canonicalValue2({
    schema: snapshot2.schema,
    repository_root: resolve(snapshot2.repository_root),
    head: snapshot2.head,
    dirty_paths: [...snapshot2.dirty_paths].sort(),
    fingerprints: snapshot2.fingerprints,
    index_fingerprint: snapshot2.index_fingerprint ?? null,
    status_fingerprint: snapshot2.status_fingerprint ?? null
  })), "utf8")) : null;
}
function timestamp(options = {}) {
  let value = options.now ? options.now() : /* @__PURE__ */ new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function nativeContextRoot(stateRoot) {
  return join(stateRoot, "manual-native-task-review");
}
function nativeConversationPath(stateRoot, conversationHash) {
  return join(nativeContextRoot(stateRoot), "conversations", `${conversationHash}.json`);
}
function nativeLockPath(stateRoot, conversationHash) {
  return join(nativeContextRoot(stateRoot), "locks", `${conversationHash}.lock`);
}
function readJson(path) {
  try {
    let value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value == "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function validConversation(value) {
  return value?.schema === 3 && value?.kind === "cursor-native-task-review-context" && typeof value.conversation_hash == "string" && Number.isInteger(value.revision) && value.revision > 0;
}
function readNativeTaskReviewConversation(stateRoot, conversationHash) {
  let value = readJson(nativeConversationPath(stateRoot, conversationHash));
  return validConversation(value) ? value : null;
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function processIsAlive(pid, options = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (typeof options.pidIsAlive == "function") return options.pidIsAlive(pid);
  try {
    return process.kill(pid, 0), !0;
  } catch (error) {
    return error?.code === "ESRCH" ? !1 : error?.code === "EPERM" ? !0 : null;
  }
}
function lockOwner(path) {
  let owner = readJson(join(path, "owner.json"));
  return owner && typeof owner.owner_token == "string" && owner.owner_token.length >= 16 && Number.isInteger(owner.pid) && typeof owner.acquired_at == "string" && Number.isFinite(Date.parse(owner.acquired_at)) ? owner : null;
}
function lockAge(owner, options = {}) {
  let now = options.now ? Date.parse(timestamp(options)) : Date.now();
  return owner ? now - Date.parse(owner.acquired_at) : 0;
}
function quarantineLock(path, expectedToken) {
  let quarantine = `${path}.quarantine.${process.pid}.${randomUUID()}`;
  try {
    renameSync(path, quarantine);
  } catch (error) {
    if (error?.code === "ENOENT") return !1;
    throw error;
  }
  if (expectedToken && lockOwner(quarantine)?.owner_token !== expectedToken) {
    try {
      renameSync(quarantine, path);
    } catch {
    }
    return !1;
  }
  return rmSync(quarantine, { recursive: !0, force: !0 }), !0;
}
function withNativeStateLock(path, callback, options = {}) {
  mkdirSync(resolve(path, ".."), { recursive: !0, mode: 448 });
  let ownerToken = options.ownerToken ?? randomUUID(), ownerPid = options.ownerPid ?? process.pid, deadline = Date.now() + (options.lockWaitMs ?? LOCK_WAIT_MS);
  for (; ; )
    try {
      mkdirSync(path, { mode: 448 });
      try {
        writeFileSync(join(path, "owner.json"), `${JSON.stringify({
          owner_token: ownerToken,
          pid: ownerPid,
          acquired_at: timestamp(options)
        })}
`, { mode: 384 });
      } catch (error) {
        throw quarantineLock(path), error;
      }
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = lockOwner(path);
      if (owner && lockAge(owner, options) > (options.lockStaleMs ?? LOCK_STALE_MS) && processIsAlive(owner.pid, options) === !1 && quarantineLock(path, owner.owner_token))
        continue;
      if (Date.now() >= deadline) {
        let busy = new Error("native Workflow state is busy");
        throw busy.code = "native-state-busy", busy;
      }
      sleep(options.lockPollMs ?? 10);
    }
  try {
    return callback({ owner_token: ownerToken, pid: ownerPid });
  } finally {
    lockOwner(path)?.owner_token === ownerToken && quarantineLock(path, ownerToken);
  }
}
function withNativeTaskReviewLock(stateRoot, conversationHash, callback, options = {}) {
  let path = nativeLockPath(stateRoot, conversationHash);
  return withNativeStateLock(path, callback, options);
}
function validateConsumedNativeReviewReceipt({ stateRoot, receipt, options = {} }) {
  return !receipt || receipt.schema !== 4 || typeof receipt.conversation_hash != "string" ? { status: "invalid" } : withNativeTaskReviewLock(stateRoot, receipt.conversation_hash, () => {
    let current = readNativeTaskReviewConversation(stateRoot, receipt.conversation_hash);
    return current ? current.revision !== receipt.context_revision ? { status: "drift", reason: "context-revision-drift" } : current.active?.root_hash !== receipt.root_hash ? { status: "drift", reason: "root-drift" } : current.mutation_epoch?.id !== receipt.mutation_epoch?.id ? { status: "drift", reason: "mutation-epoch-drift" } : current.inflight?.token_hash !== receipt.token_hash || current.inflight?.tool_hash !== receipt.tool_hash || current.inflight?.generation_hash !== receipt.generation_hash ? { status: "drift", reason: "review-inflight-drift" } : { status: "valid" } : { status: "drift", reason: "context-unavailable" };
  }, options);
}

// src/core/manual-repository-snapshot.mjs
function uniqueReasonCodes(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}
function provisionalDelta(current, {
  baseline = null,
  boundary = "create-plan",
  reasonCodes = []
} = {}) {
  let reasons = uniqueReasonCodes(reasonCodes);
  return {
    baseline_available: !1,
    baseline_hash: repositorySnapshotHash(baseline),
    attribution_status: "provisional",
    attribution_boundary: boundary,
    attribution_reason_codes: reasons,
    changed_paths: [...current.dirty_paths].sort(),
    observed_dirty_paths: [...current.dirty_paths].sort(),
    pre_existing_paths: [],
    repository_snapshot: evidenceRepositorySnapshot(current, current.dirty_paths, {
      baselineAvailable: !1,
      attributionStatus: "provisional",
      attributionReasonCodes: reasons,
      baselineHash: repositorySnapshotHash(baseline)
    })
  };
}
function deriveRepositoryDelta(baseline, current, options = {}) {
  if (!validRepositorySnapshot(current)) throw new Error("current repository snapshot is invalid");
  let boundary = options.boundary ?? "create-plan", suppliedReasons = uniqueReasonCodes(options.reasonCodes);
  if (!baseline)
    return provisionalDelta(current, {
      boundary,
      reasonCodes: ["baseline-unavailable", ...suppliedReasons]
    });
  if (!validRepositorySnapshot(baseline))
    return provisionalDelta(current, {
      boundary,
      reasonCodes: ["baseline-invalid", ...suppliedReasons]
    });
  if (resolve2(baseline.repository_root) !== resolve2(current.repository_root))
    return provisionalDelta(current, {
      baseline,
      boundary,
      reasonCodes: ["baseline-root-mismatch", ...suppliedReasons]
    });
  if (baseline.head !== current.head)
    return provisionalDelta(current, {
      baseline,
      boundary,
      reasonCodes: ["head-drift", ...suppliedReasons]
    });
  let changedPaths2 = [.../* @__PURE__ */ new Set([...baseline.dirty_paths, ...current.dirty_paths])].sort().filter((path) => {
    let before = Object.prototype.hasOwnProperty.call(baseline.fingerprints, path) ? baseline.fingerprints[path] : "clean", after = Object.prototype.hasOwnProperty.call(current.fingerprints, path) ? current.fingerprints[path] : "clean";
    return before !== after;
  }), preExistingPaths = current.dirty_paths.filter((path) => Object.prototype.hasOwnProperty.call(baseline.fingerprints, path) && baseline.fingerprints[path] === current.fingerprints[path]).sort(), reasonCodes = uniqueReasonCodes(suppliedReasons), attributionStatus = reasonCodes.length > 0 ? "provisional" : "attributed", baselineHash = repositorySnapshotHash(baseline);
  return {
    baseline_available: !0,
    baseline_hash: baselineHash,
    attribution_status: attributionStatus,
    attribution_boundary: boundary,
    attribution_reason_codes: reasonCodes,
    changed_paths: changedPaths2,
    observed_dirty_paths: [...current.dirty_paths].sort(),
    pre_existing_paths: preExistingPaths,
    repository_snapshot: evidenceRepositorySnapshot(current, changedPaths2, {
      baselineAvailable: !0,
      attributionStatus,
      attributionReasonCodes: reasonCodes,
      baselineHash
    })
  };
}
function evidenceRepositorySnapshot(snapshot2, relevantPaths, {
  baselineAvailable = !0,
  attributionStatus = baselineAvailable ? "attributed" : "provisional",
  attributionReasonCodes = [],
  baselineHash = null
} = {}) {
  if (!validRepositorySnapshot(snapshot2)) throw new Error("repository snapshot is invalid");
  let entries = [...new Set(relevantPaths ?? [])].sort().map((path) => `${path}=${snapshot2.fingerprints[path] ?? repositoryPathFingerprint(snapshot2.repository_root, path)}`);
  return entries.push(`index=${snapshot2.index_fingerprint ?? "unavailable"}`), entries.push(`status=${snapshot2.status_fingerprint ?? "unavailable"}`), {
    repository_root: snapshot2.repository_root,
    head: snapshot2.head,
    working_tree: snapshot2.working_tree,
    relevant_fingerprints: entries.length > 0 ? entries.join("; ") : "none",
    known_failures: "none observed by the repository snapshot adapter",
    baseline_available: baselineAvailable,
    attribution_status: attributionStatus,
    attribution_reason_codes: uniqueReasonCodes(attributionReasonCodes),
    baseline_hash: baselineHash
  };
}

// src/core/manual-check-receipts.mjs
var MANUAL_CHECK_RECEIPT_TTL_MS = 1440 * 60 * 1e3, MANUAL_CHECK_RECEIPT_SURFACE = "host-tool-receipt";
function manualReceiptHash(value) {
  return createHash4("sha256").update(String(value)).digest("hex");
}
function stable2(value) {
  return Array.isArray(value) ? value.map(stable2) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable2(value[key])]));
}
function stableManualReceiptJson(value) {
  return JSON.stringify(stable2(value));
}
var sha2562 = manualReceiptHash, stableJson = stableManualReceiptJson;
function unique2(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}
function normalizeManualCheckCommand(value) {
  let trimmed = String(value ?? "").trim();
  return trimmed.startsWith("rtk ") ? trimmed.slice(4) : trimmed;
}
function plannedWorkingDirectory(value) {
  let source = String(value ?? "").trim();
  if (!source || /^repository root$/i.test(source) || source === ".") return ".";
  let normalized = source.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  return !normalized || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/") ? null : normalized;
}
function manualMachineChecks(rootPlanText, pluginRoot) {
  let contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields?.schema !== 5)
    throw new Error(`manual Check receipts require a valid Schema-5 Root: ${contract.errors.join("; ")}`);
  return {
    root_plan_id: contract.fields.id,
    root_hash: rootContentHash(rootPlanText),
    checks: contract.checks.filter((check) => check["Evidence Class"] === "machine-verifiable").map((check) => ({
      check_id: check["Check ID"],
      command: normalizeManualCheckCommand(check["Command or Inspection"]),
      command_hash: sha2562(normalizeManualCheckCommand(check["Command or Inspection"])),
      working_directory: plannedWorkingDirectory(check["Working Directory"]),
      expected: check["Expected Result"],
      required: check.Required === "yes",
      required_repetitions: 1
    })),
    all_checks: contract.checks.filter((check) => check.Required === "yes")
  };
}
function repositorySnapshotFingerprint(snapshot2) {
  if (!snapshot2 || typeof snapshot2 != "object") throw new Error("manual Check receipt requires a repository snapshot");
  return sha2562(stableJson({
    repository_root: resolve3(snapshot2.repository_root),
    head: snapshot2.head,
    dirty_paths: snapshot2.dirty_paths,
    fingerprints: snapshot2.fingerprints,
    index_fingerprint: snapshot2.index_fingerprint ?? null,
    status_fingerprint: snapshot2.status_fingerprint ?? null
  }));
}
function proofBase(workspaceRoot, rootHash, options = {}) {
  return join2(sharedArtifactStateRoot(canonicalWorkspaceRoot(workspaceRoot), options), "manual-check-receipts", rootHash);
}
function canonicalManualWorkspaceRoot(workspaceRoot) {
  try {
    return realpathSync2(workspaceRoot);
  } catch {
    return resolve3(workspaceRoot);
  }
}
var canonicalWorkspaceRoot = canonicalManualWorkspaceRoot;
function assertManualReceiptPath(path, base) {
  let resolvedBase = resolve3(base), resolvedPath = resolve3(path);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${sep}`))
    throw new Error("manual Check receipt path escapes its protected state root");
  let current = resolvedPath;
  for (; current !== resolvedBase && !existsSync(current); ) current = dirname(current);
  if (existsSync(current) && lstatSync2(current).isSymbolicLink())
    throw new Error("manual Check receipt state may not be symlink redirected");
}
var assertSafeDirectory = assertManualReceiptPath;
function readManualReceiptRecord(path, base) {
  assertSafeDirectory(path, base);
  let stat = lstatSync2(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return null;
  let value = JSON.parse(readFileSync2(path, "utf8"));
  return value && typeof value == "object" && !Array.isArray(value) ? value : null;
}
var readReceiptRecord = readManualReceiptRecord;
function existingRecords(directory, base) {
  return existsSync(directory) ? (assertSafeDirectory(directory, base), lstatSync2(directory).isSymbolicLink() ? [] : readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).flatMap((name) => {
    try {
      let record = readReceiptRecord(join2(directory, name), base);
      return record ? [record] : [];
    } catch {
      return [];
    }
  })) : [];
}
function invalidateManualCheckReceipts({ rootPlanText, workspaceRoot, options = {} }) {
  if (typeof rootPlanText != "string" || !rootPlanText.trim()) return !1;
  let rootHash = rootContentHash(rootPlanText), canonicalRoot = canonicalWorkspaceRoot(workspaceRoot), base = proofBase(canonicalRoot, rootHash, options);
  if (!existsSync(base)) return !1;
  let stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  if (assertSafeDirectory(base, stateRoot), lstatSync2(base).isSymbolicLink()) throw new Error("manual Check receipt state may not be symlink redirected");
  return rmSync2(base, { recursive: !0, force: !0 }), !0;
}
function validStoredReceipt(record, { plan, repositoryRoot, currentFingerprint, now }) {
  if (!record || record.schema !== 1 || record.kind !== "manual-check-receipt-record") return !1;
  let receipt = record.receipt;
  if (!receipt || receipt.schema !== 1 || receipt.kind !== "manual-check-receipt" || !/^[a-f0-9]{64}$/.test(String(record.receipt_hash ?? "")) || sha2562(stableJson(receipt)) !== record.receipt_hash || receipt.root_hash !== plan.root_hash || receipt.repository_key !== repositoryKey(repositoryRoot) || receipt.snapshot_fingerprint !== currentFingerprint) return !1;
  let expires = Date.parse(record.expires_at);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return !1;
  let check = plan.checks.find((entry) => entry.check_id === receipt.check_id);
  return !check || check.command_hash !== receipt.command_hash || check.working_directory !== receipt.working_directory ? !1 : ["passed", "failed"].includes(receipt.result_status) && Number.isInteger(receipt.repetition_ordinal) && receipt.repetition_ordinal >= 1;
}
function loadManualCheckReceipts({
  rootPlanText,
  pluginRoot,
  workspaceRoot,
  captureSnapshot = captureRepositorySnapshot,
  now = () => /* @__PURE__ */ new Date(),
  options = {}
}) {
  if (typeof rootPlanText != "string" || !rootPlanText.trim() || !workspaceRoot) return [];
  let plan = manualMachineChecks(rootPlanText, pluginRoot), current = captureSnapshot(workspaceRoot), currentFingerprint = repositorySnapshotFingerprint(current), canonicalRoot = current.repository_root, base = proofBase(canonicalRoot, plan.root_hash, options), stateRoot = sharedArtifactStateRoot(canonicalRoot, options);
  if (!existsSync(base)) return [];
  try {
    return assertSafeDirectory(base, stateRoot), lstatSync2(base).isSymbolicLink() ? [] : readdirSync(base, { withFileTypes: !0 }).filter((entry) => entry.isDirectory() && /^CHECK-[1-9][0-9]*$/.test(entry.name)).flatMap((entry) => existingRecords(join2(base, entry.name), stateRoot)).filter((record) => validStoredReceipt(record, {
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
  let command = normalizeManualCheckCommand(check["Command or Inspection"]), workingDirectory = String(check["Working Directory"] ?? "repository root");
  return `HOST-RECEIPT-MISSING: ${check["Check ID"]} was not host-attested for the current repository snapshot. Re-run exactly \`${command}\` from ${workingDirectory}, then retry closeout.`;
}
function sameCallerObservation(entry, existing) {
  return !!(existing && entry?.grade === existing.grade && String(entry?.observed ?? "not fully observed") === String(existing.observed ?? "not fully observed") && String(entry?.expected ?? existing.expected ?? "") === String(existing.expected ?? ""));
}
function calibrateManualCheckEvidence({ entries, plannedChecks, receipts = [], existingCheckEvidence = [] }) {
  let existingByCheck = new Map((existingCheckEvidence ?? []).map((entry) => [entry.check_id, entry]));
  return entries.map((entry) => {
    let check = plannedChecks.get(entry.check_id);
    if (!check || check["Evidence Class"] !== "machine-verifiable") return entry;
    let commandHash = sha2562(normalizeManualCheckCommand(check["Command or Inspection"])), workingDirectory = plannedWorkingDirectory(check["Working Directory"]), checkReceipts = receipts.filter((receipt) => receipt.command_hash === commandHash && receipt.working_directory === workingDirectory), failures = checkReceipts.filter((receipt) => receipt.result_status === "failed"), successes = checkReceipts.filter((receipt) => receipt.result_status === "passed");
    if (failures.length > 0)
      return {
        ...entry,
        grade: "failed",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: failures.length + successes.length,
        artifact_hashes: unique2([...failures, ...successes].map((receipt) => receipt.receipt_hash)),
        limitations: unique2([...entry.limitations ?? [], `HOST-RECEIPT-FAILED: ${entry.check_id} returned a host-observed failure for the current repository snapshot.`])
      };
    if (entry.grade !== "verified") return entry;
    if (successes.length >= 1)
      return {
        ...entry,
        grade: "verified",
        surface: MANUAL_CHECK_RECEIPT_SURFACE,
        method: normalizeManualCheckCommand(check["Command or Inspection"]),
        repetitions: successes.length,
        artifact_hashes: unique2(successes.map((receipt) => receipt.receipt_hash))
      };
    let existing = existingByCheck.get(entry.check_id);
    if (existing?.grade === "verified" && existing.surface === MANUAL_CHECK_RECEIPT_SURFACE && Array.isArray(existing.artifact_hashes) && existing.artifact_hashes.length > 0 && sameCallerObservation(entry, existing))
      return { ...existing };
    let meaningful = String(entry.observed ?? "").trim() && !/^not (?:fully )?observed$/i.test(String(entry.observed).trim());
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
function manualConstraintProjection({ checks = [], evidence = [], pending = !1 }) {
  let required = checks.filter((check) => check.Required === "yes"), byId = new Map((evidence ?? []).map((entry) => [entry.check_id, entry])), ids = (predicate) => required.filter(predicate).map((check) => check["Check ID"]), hostAttested = ids((check) => {
    let entry = byId.get(check["Check ID"]);
    return entry?.grade === "verified" && entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0;
  }), machine = ids((check) => check["Evidence Class"] === "machine-verifiable"), failed = ids((check) => byId.get(check["Check ID"])?.grade === "failed"), unattestedVerified = pending ? [] : ids((check) => {
    let entry = byId.get(check["Check ID"]);
    return check["Evidence Class"] === "machine-verifiable" && entry?.grade === "verified" && !(entry.surface === MANUAL_CHECK_RECEIPT_SURFACE && (entry.artifact_hashes?.length ?? 0) > 0);
  }), ordinaryGaps = pending ? [] : ids((check) => {
    let entry = byId.get(check["Check ID"]);
    return !entry || ["supported", "partial", "unavailable"].includes(entry.grade);
  }), gaps = unique2([...unattestedVerified, ...ordinaryGaps]), humanReview = ids((check) => check["Evidence Class"] === "human-review-required"), humanApproval = ids((check) => check["Evidence Class"] === "human-approval-required"), reasons = pending ? [] : [
    ...failed.map((checkId) => ({ code: "check-failed", check_id: checkId, message: `${checkId} failed and blocks delivery.`, recovery: `Repair the cause, rerun ${checkId}, then retry closeout.` })),
    ...unattestedVerified.map((checkId) => ({ code: "legacy-receipt-gap", check_id: checkId, message: `${checkId} is marked verified without a valid host receipt.`, recovery: `Run a fresh review for ${checkId}; use its bounded correction route to refresh Evidence with current host receipts.` })),
    ...ordinaryGaps.map((checkId) => ({ code: "evidence-gap", check_id: checkId, message: `${checkId} is not fully verified.`, recovery: `Follow the Check limitation, rerun ${checkId}, then retry closeout.` })),
    ...humanReview.map((checkId) => ({ code: "human-review-required", check_id: checkId, message: `${checkId} requires human review.`, recovery: `Complete the stated review for ${checkId} and record the bounded observation.` })),
    ...humanApproval.map((checkId) => ({ code: "human-approval-required", check_id: checkId, message: `${checkId} requires explicit human approval.`, recovery: "Request the named approval before continuing." }))
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
  return Array.isArray(value) ? value.map(stable3) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable3(value[key])]));
}
function unique3(values) {
  return [...new Set(values)];
}
function cell(value) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim() || "none";
}
function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell(row[header])).join(" | ")} |`)
  ].join(`
`);
}
function normalizeArtifacts(rootPlanText, artifacts, pluginRoot) {
  let rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan")
    throw new Error(`closeout Root is invalid: ${(rootInspection.errors.length > 0 ? rootInspection.errors : ["input is not a work-plan"]).join("; ")}`);
  let rootId = rootInspection.artifact.fields.id, byId = /* @__PURE__ */ new Map([[rootId, { label: rootId, text: rootPlanText }]]);
  for (let [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.label != "string" || !entry.label.trim() || typeof entry.text != "string" || !entry.text.trim())
      throw new Error(`closeout artifact ${index + 1} requires non-empty label and text`);
    let inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`closeout artifact ${entry.label} is invalid: ${inspected.errors.join("; ")}`);
    let id = inspected.artifact.fields.id, prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`closeout artifact ${id} has conflicting text`);
    byId.set(id, { label: id, text: entry.text });
  }
  return { rootId, entries: [...byId.values()] };
}
function expectedCheckMap(contract, correction, unresolvedRootChecks = /* @__PURE__ */ new Map()) {
  let checks = correction?.checks?.filter((check) => check.Required === "yes") ?? contract.checks.filter((check) => check.Required === "yes");
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
  let result = /* @__PURE__ */ new Map();
  for (let entry of String(value ?? "").split(/;\s*/)) {
    let equals = entry.indexOf("=");
    if (equals <= 0) continue;
    let path = entry.slice(0, equals).trim().replace(/^`|`$/g, "").replace(/^\.\//, "");
    !path || ["index", "status"].includes(path) || result.set(path, entry.slice(equals + 1));
  }
  return result;
}
function correctionTargets(correction) {
  return unique3((correction?.steps ?? []).flatMap((step) => repositoryPaths(step.Targets)));
}
function rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths2 = []) {
  let effectiveChecks = predecessorEvidence?.effective?.checks, explicitlyAffected = correctionRootChecks(correction), affectedObjectives = new Set(correctionObjectives(correction)), affectedPaths = unique3([
    ...changedPaths2.flatMap(repositoryPaths),
    ...correctionTargets(correction)
  ]), previousFingerprints = predecessorEvidence?.effective?.snapshot?.["Relevant fingerprints"] ?? null, currentFingerprints = repositorySnapshot?.relevant_fingerprints ?? null, previousByPath = fingerprintMap(previousFingerprints), currentByPath = fingerprintMap(currentFingerprints), stalePaths = unique3([...previousByPath.keys(), ...currentByPath.keys()]).filter((path) => previousByPath.get(path) !== currentByPath.get(path)), opaqueFingerprintChange = !!(previousFingerprints && currentFingerprints && previousFingerprints !== currentFingerprints && previousByPath.size === 0 && currentByPath.size === 0);
  return new Map([...rootCheckMap(contract)].filter(([checkId, check]) => {
    let prior = effectiveChecks?.get(checkId), prerequisites = repositoryPaths(check.Prerequisites), objectiveAffected = checkObjectives(check).some((objective) => affectedObjectives.has(objective)), pathAffected = prerequisites.some((prerequisite) => affectedPaths.some((path) => pathsOverlap(prerequisite, path))), fingerprintStale = prerequisites.some((prerequisite) => stalePaths.some((path) => pathsOverlap(prerequisite, path))), ambiguousImpact = affectedPaths.length > 0 && prerequisites.length === 0;
    return !prior || ["failed", "blocked"].includes(prior.status) || explicitlyAffected.has(checkId) || objectiveAffected || pathAffected || fingerprintStale || opaqueFingerprintChange || ambiguousImpact;
  }));
}
function inheritedCheckEvidence(inspection, predecessorEvidence, checkIds) {
  return checkIds.map((checkId) => {
    let effective = predecessorEvidence?.effective?.checks?.get(checkId), exact = (effective?.source ? inspection.effective.get(effective.source) : null)?.fields?.check_evidence?.find((entry) => entry.check_id === checkId);
    return exact || {
      check_id: checkId,
      grade: effective?.status === "passed" ? "verified" : effective?.status === "failed" ? "failed" : "supported",
      limitations: effective?.status === "passed" ? [] : ["Reused predecessor proof retains its prior non-verified grade."]
    };
  });
}
function normalizeCheckEvidence(input, plannedChecks, rootChecks, evidenceMode2, {
  enforceManualCheckReceipts = !1,
  manualCheckReceipts = [],
  existingCheckEvidence = []
} = {}) {
  if (!Array.isArray(input) || input.length === 0) throw new Error("closeout requires structured Check evidence");
  let ids = input.map((entry) => entry?.check_id);
  if (new Set(ids).size !== ids.length) throw new Error("closeout Check evidence IDs must be unique");
  for (let id of plannedChecks.keys()) if (!ids.includes(id)) throw new Error(`closeout is missing required Check ${id}`);
  let known = new Map([...rootChecks, ...plannedChecks]), normalized = input.map((entry) => {
    let planned = known.get(entry?.check_id);
    if (!planned) throw new Error(`closeout received unknown Check ${entry?.check_id}`);
    if (!(/* @__PURE__ */ new Set(["verified", "supported", "partial", "unavailable", "failed"])).has(entry.grade)) throw new Error(`closeout Check ${entry.check_id} has invalid grade`);
    let limitations = unique3(Array.isArray(entry.limitations) ? entry.limitations.map(String).filter(Boolean) : []), repetitions = Number.isInteger(entry.repetitions) && entry.repetitions >= 0 ? entry.repetitions : 0;
    if (entry.grade === "verified" && repetitions < 1) throw new Error(`verified Check ${entry.check_id} requires at least one repetition`);
    if (entry.grade === "unavailable" && limitations.length === 0) throw new Error(`unavailable Check ${entry.check_id} requires a concrete limitation`);
    return {
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
  });
  return (enforceManualCheckReceipts ? calibrateManualCheckEvidence({
    entries: normalized,
    plannedChecks: known,
    receipts: manualCheckReceipts,
    existingCheckEvidence
  }) : normalized).map((entry) => {
    let value = { ...entry };
    if (evidenceMode2 === "lean") {
      if (!value.surface && value.grade === "verified") throw new Error(`verified Check ${entry.check_id} requires a surface`);
      delete value.baseline_or_patched, (value.artifact_hashes ?? []).length === 0 && delete value.artifact_hashes, value.feature_id || delete value.feature_id;
    }
    return value;
  });
}
function overallGrade(entries) {
  return aggregateEvidence(entries).grade;
}
function artifactStatus(grade) {
  return grade === "failed" ? "blocked" : grade === "verified" ? "complete" : "provisional";
}
function correctionObjectives(correction) {
  return unique3((correction?.fixes ?? []).flatMap((fix) => String(fix["Root Objectives"] ?? "").match(/OBJ-[1-9][0-9]*/g) ?? []));
}
function checkObjectives(check) {
  return String(check?.Objectives ?? "").match(/OBJ-[1-9][0-9]*/g) ?? [];
}
function objectiveState(objective, entries, rootChecks, aggregate) {
  let related = entries.filter((entry) => checkObjectives(rootChecks.get(entry.check_id)).includes(objective)), grades = (related.length > 0 ? related : entries).map((entry) => entry.grade);
  return grades.includes("failed") ? "blocked" : grades.length > 0 && grades.every((grade) => grade === "verified") ? "achieved" : aggregate === "failed" ? "blocked" : "partially-achieved";
}
function evidenceMode(fields, effectiveProfile) {
  return effectiveProfile === "manual" && fields.profile_max === "manual" && fields.risk !== "high" && (fields.hard_triggers ?? []).length === 0 ? "lean" : "full";
}
function repositoryAttribution(value) {
  if (!value || typeof value != "object" || Array.isArray(value)) return null;
  let reasonCodes = unique3((value.reason_codes ?? []).map(String).map((entry) => entry.trim()).filter(Boolean)).sort(), status = value.status === "attributed" ? "attributed" : "provisional", boundary = String(value.boundary ?? "create-plan").trim() || "create-plan", baselineHash = /^[a-f0-9]{64}$/.test(String(value.baseline_hash ?? "")) ? value.baseline_hash : null;
  return {
    status,
    boundary,
    baseline_hash: baselineHash,
    reason_codes: reasonCodes
  };
}
function evidenceSeed({ contract, subjectId, sourceReviewId, predecessorEvidenceId, strategyRevision, mode, paths, entries, repositorySnapshot, repositoryAttribution: attribution, summary }) {
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
    repositoryAttribution: attribution ?? null,
    summary: summary ?? null
  })));
}
function summaryText(summary, status, grade) {
  let supplied = String(summary ?? "").trim();
  return supplied || (status === "blocked" ? `BLOCKER: required delivery verification failed; aggregate evidence grade is ${grade}.` : status === "provisional" ? `Delivery is provisional with aggregate evidence grade ${grade}; limitations remain explicit.` : "The authorized repository delivery is complete and every required Check is verified.");
}
function fullBody({ fields, contract, entries, changedPaths: changedPaths2, correction, repositorySnapshot, summary }) {
  let aggregate = fields.overall_grade, outcomes = fields.affected_objectives.map((objective) => ({
    "Objective ID": objective,
    Status: objectiveState(objective, entries, rootCheckMap(contract), aggregate),
    Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", ")
  })), sections = [`## Summary

${summary}`];
  if (correction) {
    let state = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
    sections.push(`## Subject results

${table(["Objective ID", "Result", "Evidence"], correction.fixes.map((fix) => ({
      "Objective ID": fix["FIX ID"],
      Result: state,
      Evidence: entries.map((entry) => `${entry.check_id}:${entry.grade}`).join(", ")
    })))}`);
  }
  sections.push(`## Objective outcomes

${table(["Objective ID", "Status", "Evidence"], outcomes)}`);
  let coverageIds = correction ? unique3((correction.fixes ?? []).map((fix) => fix["FIX ID"]).filter(Boolean)) : fields.affected_objectives;
  sections.push(changedPaths2.length > 0 ? `## Changes

${table(["Path or Symbol", "Change", "Objective Coverage"], changedPaths2.map((path) => ({
    "Path or Symbol": path,
    Change: "Declared by deterministic closeout",
    "Objective Coverage": coverageIds.join(", ")
  })))}` : `## Changes

None.`);
  let snapshot2 = repositorySnapshot ?? {};
  sections.push(`## Repository snapshot

${table(["Snapshot ID", "HEAD", "Working tree", "Changed paths", "Relevant fingerprints", "Known failures"], [{
    "Snapshot ID": `SNAP-${fields.id.slice(3)}`,
    HEAD: snapshot2.head ?? "unknown",
    "Working tree": snapshot2.working_tree ?? (changedPaths2.length > 0 ? "modified" : "unchanged"),
    "Changed paths": changedPaths2.join(", ") || "none",
    "Relevant fingerprints": snapshot2.relevant_fingerprints ?? "none",
    "Known failures": snapshot2.known_failures ?? (fields.status === "blocked" ? "required Check failed" : "none")
  }])}`), sections.push(`## Checks

${table(["Check ID", "Observed Result", "Status", "Prerequisite fingerprints"], entries.map((entry) => ({
    "Check ID": entry.check_id,
    "Observed Result": entry.observed,
    Status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "skipped",
    "Prerequisite fingerprints": snapshot2.relevant_fingerprints ?? "none"
  })))}`), sections.push(`## Deviations

None.`), sections.push(`## Operational evidence

Not applicable.`);
  let limitations = unique3(entries.flatMap((entry) => entry.limitations ?? []));
  return sections.push(`## Limitations

${limitations.length > 0 ? limitations.map((item) => `- ${item}`).join(`
`) : "None."}`), sections.join(`

`);
}
function buildDeliveryEvidence({
  rootPlanText,
  artifacts = [],
  checkEvidence: checkEvidence2,
  changedPaths: changedPaths2 = [],
  strategyRevision = 0,
  effectiveProfile = null,
  repositorySnapshot = null,
  repositoryAttribution: suppliedRepositoryAttribution = null,
  summary = null,
  manualCheckReceipts = [],
  enforceManualCheckReceipts = null,
  pluginRoot
}) {
  let normalized = normalizeArtifacts(rootPlanText, artifacts, pluginRoot), contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 5) throw new Error(`closeout requires a valid Schema-5 Root: ${contract.errors.join("; ")}`);
  let priorInspection = inspectArtifactSet(normalized.entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (priorInspection.errors.length > 0) throw new Error(`closeout input chain is invalid: ${priorInspection.errors.join("; ")}`);
  let tips = effectiveCliSummary(priorInspection), evidenceTipId = tips.evidence_tips[normalized.rootId] ?? null, reviewTipId = tips.review_tips[normalized.rootId] ?? null, review = reviewTipId ? priorInspection.effective.get(reviewTipId) : null, correction = null, subjectId = normalized.rootId, sourceReviewId = null, predecessorEvidenceId = null, representation = "full", mode = evidenceMode(contract.fields, effectiveProfile ?? contract.fields.profile_max), requireManualReceipts = enforceManualCheckReceipts ?? (effectiveProfile ?? contract.fields.profile_max) === "manual", effectiveStrategyRevision = mode === "full" ? strategyRevision : 0, effectiveRepositorySnapshot = mode === "full" ? repositorySnapshot : null, effectiveRepositoryAttribution = repositoryAttribution(suppliedRepositoryAttribution);
  if (evidenceTipId) {
    if (!review || review.fields.latest_evidence_id !== evidenceTipId || review.fields.next_action !== "correct" || !review.fields.correction_id || !review.correction) {
      let existing = normalized.entries.find((entry) => inspectArtifactText(entry.text, pluginRoot).artifact?.fields?.id === evidenceTipId), existingFields = priorInspection.effective.get(evidenceTipId)?.fields ?? null;
      if ((checkEvidence2 ?? []).length > 0 || changedPaths2.length > 0) {
        let entries2 = normalizeCheckEvidence(checkEvidence2, expectedCheckMap(contract, null), rootCheckMap(contract), mode, {
          enforceManualCheckReceipts: requireManualReceipts,
          manualCheckReceipts,
          existingCheckEvidence: existingFields?.check_evidence ?? []
        }), suppliedPaths = unique3(changedPaths2.map(String).map((path) => path.trim()).filter(Boolean)).sort(), expectedSeed = evidenceSeed({
          contract,
          subjectId: normalized.rootId,
          sourceReviewId: null,
          predecessorEvidenceId: null,
          strategyRevision: effectiveStrategyRevision,
          mode,
          paths: suppliedPaths,
          entries: entries2,
          repositorySnapshot: effectiveRepositorySnapshot,
          repositoryAttribution: effectiveRepositoryAttribution,
          summary
        }), expectedId = `de-${normalized.rootId.replace(/^wp-/, "")}-${expectedSeed.slice(0, 12)}`;
        if (!(JSON.stringify(stable3(entries2)) === JSON.stringify(stable3(existingFields?.check_evidence ?? [])) && JSON.stringify(suppliedPaths) === JSON.stringify(existingFields?.changed_paths ?? []) && (mode === "lean" || (existingFields?.strategy_revision ?? 0) === effectiveStrategyRevision) && expectedId === evidenceTipId)) throw new Error(`stale or competing closeout conflicts with current Evidence tip ${evidenceTipId}`);
      }
      let projection2 = manualConstraintProjection({ checks: contract.checks, evidence: existingFields?.check_evidence ?? [] }), unattested = projection2.constraint_summary.legacy_unattested_verified_checks ?? [];
      if (unattested.length > 0)
        throw new Error(`existing Evidence tip ${evidenceTipId} has receiptless verified machine Checks (${unattested.join(", ")}); run a fresh review and refresh them through its bounded correction route`);
      return {
        duplicate: !0,
        artifact: existing?.text ?? null,
        artifact_hash: existing ? sha2563(existing.text) : null,
        fields: existingFields,
        ...projection2
      };
    }
    correction = review.correction, subjectId = review.fields.correction_id, sourceReviewId = review.fields.id, predecessorEvidenceId = evidenceTipId, representation = "delta";
  }
  if (mode === "full" && (!repositorySnapshot?.head || !repositorySnapshot?.relevant_fingerprints))
    throw new Error("full closeout requires repository snapshot HEAD and relevant fingerprints");
  let roots = rootCheckMap(contract), predecessorEvidence = correction ? priorInspection.effective.get(evidenceTipId) : null, unresolvedRootChecks = correction ? rootChecksToRefresh(contract, correction, predecessorEvidence, repositorySnapshot, changedPaths2) : /* @__PURE__ */ new Map(), suppliedCheckIds = new Set((checkEvidence2 ?? []).map((entry) => entry?.check_id)), missingRootRefresh = [...unresolvedRootChecks.keys()].filter((checkId) => !suppliedCheckIds.has(checkId));
  if (missingRootRefresh.length > 0)
    throw new Error(`correction closeout requires fresh evidence for affected, failed, missing, stale, or ambiguous Root Checks: ${missingRootRefresh.join(", ")}`);
  let plannedChecks = expectedCheckMap(contract, correction, unresolvedRootChecks), entries = normalizeCheckEvidence(checkEvidence2, plannedChecks, roots, mode, {
    enforceManualCheckReceipts: requireManualReceipts,
    manualCheckReceipts
  }), rootObjectives = contract.objectives, affectedObjectives = correction ? unique3([...correctionObjectives(correction), ...entries.flatMap((entry) => checkObjectives(roots.get(entry.check_id)))]) : [...rootObjectives], affected = affectedObjectives.length > 0 ? affectedObjectives : [...rootObjectives], reusedObjectives = representation === "delta" ? rootObjectives.filter((id2) => !affected.includes(id2)) : [], executedChecks = entries.map((entry) => entry.check_id), reusedChecks = representation === "delta" ? [...roots.keys()].filter((id2) => !executedChecks.includes(id2)) : [], reusedEvidence = representation === "delta" ? inheritedCheckEvidence(priorInspection, predecessorEvidence, reusedChecks) : [], effectiveEntries = [...entries, ...reusedEvidence], grade = overallGrade(effectiveEntries), status = artifactStatus(grade), paths = unique3(changedPaths2.map(String).map((path) => path.trim()).filter(Boolean)).sort(), seed = evidenceSeed({
    contract,
    subjectId,
    sourceReviewId,
    predecessorEvidenceId,
    strategyRevision: effectiveStrategyRevision,
    mode,
    paths,
    entries,
    repositorySnapshot: effectiveRepositorySnapshot,
    repositoryAttribution: effectiveRepositoryAttribution,
    summary
  }), id = `de-${subjectId.replace(/^(?:wp|cp)-/, "")}-${seed.slice(0, 12)}`, fields = {
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
    check_evidence: entries,
    ...effectiveRepositoryAttribution ? {
      extensions: {
        workflow: {
          repository_attribution: effectiveRepositoryAttribution
        }
      }
    } : {}
  }, renderedSummary = summaryText(summary, status, grade), body = mode === "lean" ? `## Summary

${renderedSummary}` : fullBody({ fields, contract, entries, changedPaths: paths, correction, repositorySnapshot, summary: renderedSummary }), artifact = `---
${(0, import_yaml.stringify)(fields, { lineWidth: 0 }).trimEnd()}
---

${body}
`, finalEntries = [...normalized.entries, { label: id, text: artifact }], inspection = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (inspection.errors.length > 0) throw new Error(`generated delivery evidence is invalid: ${inspection.errors.join("; ")}`);
  let projection = manualConstraintProjection({ checks: contract.checks, evidence: effectiveEntries });
  return {
    duplicate: !1,
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
  let entries = [{ label: "root", text: rootPlanText }, ...artifacts, { label: closeout.fields.id, text: closeout.artifact }], byId = /* @__PURE__ */ new Map();
  for (let entry of entries) {
    let inspected = inspectArtifactText(entry.text, handoffStore.pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`closeout persistence input is invalid: ${inspected.errors.join("; ")}`);
    let id = inspected.artifact.fields.id, prior = byId.get(id);
    if (prior && prior !== entry.text) throw new Error(`closeout persistence artifact ${id} has conflicting text`);
    byId.set(id, entry.text);
  }
  try {
    let persisted = handoffStore.record([...byId].map(([label, text]) => ({ label, text })));
    return { ...closeout, handoff_persisted: !0, handoff_authoritative: !1, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return {
      ...closeout,
      handoff_persisted: !1,
      handoff_authoritative: !1,
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
]), ASSESSMENT_RANK = Object.freeze({
  "insufficient-evidence": 0,
  "not-achieved": 1,
  "partially-achieved": 2,
  "mostly-achieved": 3,
  provisional: 4,
  achieved: 5
}), ACTIONS = /* @__PURE__ */ new Set(["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"]), SEVERITIES = /* @__PURE__ */ new Set(["low", "medium", "high", "critical"]), RESOLUTIONS = /* @__PURE__ */ new Set(["correct", "clarify", "replan"]), SNAPSHOT_ASSESSMENTS = /* @__PURE__ */ new Set(["consistent", "contradicted", "incomplete"]), AUDITOR_ROLES = /* @__PURE__ */ new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]), COSTS = /* @__PURE__ */ new Set(["cheap", "standard", "expensive"]), KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function sha2564(value) {
  return createHash6("sha256").update(String(value)).digest("hex");
}
function compareCanonical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function codedError(code, message) {
  let error = new Error(message);
  return error.code = code, error;
}
function stable4(value) {
  return Array.isArray(value) ? value.map(stable4) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort(compareCanonical).map((key) => [key, stable4(value[key])]));
}
function stableJson2(value) {
  return JSON.stringify(stable4(value));
}
function object(value, label) {
  if (!value || typeof value != "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}
function closed(value, allowed, label) {
  let unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported field ${unknown[0]}`);
}
function requiredField(value, key, label = "review_input") {
  if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${label}.${key} is required`);
  return value[key];
}
function line(value, label, { required = !0, max = 2e3 } = {}) {
  if (typeof value != "string") throw new Error(`${label} must be a string`);
  let normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return normalized;
}
function enumValue(value, values, label) {
  let normalized = String(value ?? "").trim();
  if (!values.has(normalized)) throw new Error(`${label} has invalid value ${normalized || "<missing>"}`);
  return normalized;
}
function list(value, label, { max = 64, required = !1 } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (required && value.length === 0) throw new Error(`${label} must not be empty`);
  if (value.length > max) throw new Error(`${label} exceeds ${max} items`);
  return value;
}
function uniqueSorted(values) {
  return [...new Set(values)].sort(compareCanonical);
}
function normalizeIds(value, pattern, allowed, label) {
  let normalized = uniqueSorted(list(value, label, { required: !0 }).map((entry) => line(entry, label, { max: 80 })));
  for (let id of normalized)
    if (!pattern.test(id) || !allowed.has(id)) throw new Error(`${label} contains unknown ${id}`);
  return normalized;
}
function localKey(value, label) {
  let normalized = line(value, label, { max: 80 });
  if (!KEY.test(normalized)) throw new Error(`${label} must be a lowercase semantic key`);
  return normalized;
}
function normalizeFindings(value, contract) {
  let objectiveIds = new Set(contract.objectives), checkIds = new Set(contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"])), findings = list(value, "review_input.findings", { max: 32 }).map((entry, index) => {
    let item = object(entry, `review_input.findings[${index}]`);
    return closed(item, ["key", "severity", "objective_ids", "check_ids", "evidence", "reasoning", "resolution"], `review_input.findings[${index}]`), {
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
  let reports = list(value, "review_input.auditor_reports", { max: 3 }).map((entry, index) => {
    let item = object(entry, `review_input.auditor_reports[${index}]`);
    return closed(item, ["role", "assessment", "summary"], `review_input.auditor_reports[${index}]`), {
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
  let correction = object(value, "review_input.correction");
  closed(correction, ["fixes", "steps", "checks", "learning_candidates"], "review_input.correction");
  let fixes = list(correction.fixes, "review_input.correction.fixes", { max: 32, required: !0 }).map((entry, index) => {
    let item = object(entry, `review_input.correction.fixes[${index}]`);
    closed(item, ["key", "finding_keys", "required_outcome", "evidence"], `review_input.correction.fixes[${index}]`);
    let keys = uniqueSorted(list(item.finding_keys, `review_input.correction.fixes[${index}].finding_keys`, { required: !0 }).map((key) => localKey(key, `review_input.correction.fixes[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.fixes[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.fixes[${index}].key`),
      finding_keys: keys,
      required_outcome: line(item.required_outcome, `review_input.correction.fixes[${index}].required_outcome`, { max: 2e3 }),
      evidence: line(item.evidence, `review_input.correction.fixes[${index}].evidence`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key)), fixKeys = new Set(fixes.map((fix) => fix.key));
  if (fixKeys.size !== fixes.length) throw new Error("review_input.correction.fixes keys must be unique");
  let checks = list(correction.checks, "review_input.correction.checks", { max: 32, required: !0 }).map((entry, index) => {
    let item = object(entry, `review_input.correction.checks[${index}]`);
    closed(item, ["key", "fix_keys", "working_directory", "command_or_inspection", "expected_result", "required", "cost_class", "prerequisites"], `review_input.correction.checks[${index}]`);
    let referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.checks[${index}].fix_keys`, { required: !0 }).map((key) => localKey(key, `review_input.correction.checks[${index}].fix_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.checks[${index}] references an unknown fix`);
    let prerequisites = uniqueSorted(list(item.prerequisites, `review_input.correction.checks[${index}].prerequisites`, { required: !0 }).map((entryValue) => line(entryValue, `review_input.correction.checks[${index}].prerequisites`, { max: 1e3 })));
    if (typeof item.required != "boolean") throw new Error(`review_input.correction.checks[${index}].required must be a boolean`);
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
  }).sort((left, right) => ({ cheap: 0, standard: 1, expensive: 2 })[left.cost_class] - { cheap: 0, standard: 1, expensive: 2 }[right.cost_class] || compareCanonical(left.key, right.key)), checkKeys = new Set(checks.map((check) => check.key));
  if (checkKeys.size !== checks.length) throw new Error("review_input.correction.checks keys must be unique");
  let steps = list(correction.steps, "review_input.correction.steps", { max: 32, required: !0 }).map((entry, index) => {
    let item = object(entry, `review_input.correction.steps[${index}]`);
    closed(item, ["key", "fix_keys", "targets", "required_outcome", "implementation_latitude", "completion_probe", "check_keys", "deviation_action"], `review_input.correction.steps[${index}]`);
    let referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.steps[${index}].fix_keys`, { required: !0 }).map((key) => localKey(key, `review_input.correction.steps[${index}].fix_keys`))), referencedChecks = uniqueSorted(list(item.check_keys, `review_input.correction.steps[${index}].check_keys`, { required: !0 }).map((key) => localKey(key, `review_input.correction.steps[${index}].check_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown fix`);
    if (referencedChecks.some((key) => !checkKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown check`);
    return {
      key: localKey(item.key, `review_input.correction.steps[${index}].key`),
      fix_keys: referencedFixes,
      targets: uniqueSorted(list(item.targets, `review_input.correction.steps[${index}].targets`, { required: !0 }).map((target) => line(target, `review_input.correction.steps[${index}].targets`, { max: 1e3 }))),
      required_outcome: line(item.required_outcome, `review_input.correction.steps[${index}].required_outcome`, { max: 2e3 }),
      implementation_latitude: line(item.implementation_latitude, `review_input.correction.steps[${index}].implementation_latitude`, { max: 2e3 }),
      completion_probe: line(item.completion_probe, `review_input.correction.steps[${index}].completion_probe`, { max: 2e3 }),
      check_keys: referencedChecks,
      deviation_action: line(item.deviation_action, `review_input.correction.steps[${index}].deviation_action`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(steps.map((step) => step.key)).size !== steps.length) throw new Error("review_input.correction.steps keys must be unique");
  for (let fix of fixKeys) if (!steps.some((step) => step.fix_keys.includes(fix))) throw new Error(`review_input.correction.steps do not cover ${fix}`);
  let learningCandidates = list(correction.learning_candidates, "review_input.correction.learning_candidates", { max: 32, required: !0 }).map((entry, index) => {
    let item = object(entry, `review_input.correction.learning_candidates[${index}]`);
    closed(item, ["key", "finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"], `review_input.correction.learning_candidates[${index}]`);
    let keys = uniqueSorted(list(item.finding_keys, `review_input.correction.learning_candidates[${index}].finding_keys`, { required: !0 }).map((key) => localKey(key, `review_input.correction.learning_candidates[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.learning_candidates[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.learning_candidates[${index}].key`),
      finding_keys: keys,
      reusable_guidance: line(item.reusable_guidance, `review_input.correction.learning_candidates[${index}].reusable_guidance`, { max: 2e3 }),
      candidate_targets: uniqueSorted(list(item.candidate_targets, `review_input.correction.learning_candidates[${index}].candidate_targets`, { required: !0 }).map((target) => line(target, `review_input.correction.learning_candidates[${index}].candidate_targets`, { max: 1e3 }))),
      confirmation_evidence: line(item.confirmation_evidence, `review_input.correction.learning_candidates[${index}].confirmation_evidence`, { max: 2e3 })
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(learningCandidates.map((candidate) => candidate.key)).size !== learningCandidates.length) throw new Error("review_input.correction.learning_candidates keys must be unique");
  return { fixes, checks, steps, learning_candidates: learningCandidates };
}
function normalizeReviewInput(input, contract) {
  let value = object(input, "review_input");
  if (closed(value, ["schema", "kind", "assessment", "recommended_action", "assessment_summary", "snapshot_assessment", "snapshot_summary", "findings", "missing_evidence", "auditor_reports", "correction"], "review_input"), value.schema !== 1) throw new Error("review_input.schema must be 1");
  if (value.kind !== "review-input") throw new Error("review_input.kind must be review-input");
  let findings = normalizeFindings(requiredField(value, "findings"), contract), findingKeys = new Set(findings.map((finding) => finding.key)), normalized = {
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
  } else if (normalized.correction)
    throw new Error("review_input.correction is allowed only for recommended_action correct");
  return normalized;
}
function mergeChain(rootPlanText, artifacts, pluginRoot) {
  let rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan" || rootInspection.artifact.fields.schema !== 5)
    throw new Error(`review builder requires an exact valid Schema-5 Root: ${rootInspection.errors.join("; ") || "not a work-plan"}`);
  let byId = /* @__PURE__ */ new Map([[rootInspection.artifact.fields.id, { label: rootInspection.artifact.fields.id, text: rootPlanText }]]);
  for (let [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.text != "string" || !entry.text.trim()) throw new Error(`review builder artifact ${index + 1} requires exact text`);
    let inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`review builder artifact ${entry.label ?? index + 1} is invalid: ${inspected.errors.join("; ")}`);
    let id = inspected.artifact.fields.id, builderProvenance = entry.builder_provenance ?? entry.provenance ?? null, protectedLegacyReview = entry.legacy_review_recorded === !0;
    if (inspected.artifact.fields.artifact === "work-review") {
      let validBuilderProvenance = builderProvenance?.schema === 1 && builderProvenance?.kind === "host-work-review-builder" && /^[a-f0-9]{64}$/.test(String(builderProvenance?.review_input_hash ?? "")) && builderProvenance?.artifact_hash === sha2564(entry.text) && Object.keys(builderProvenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
      if (builderProvenance && !validBuilderProvenance)
        throw codedError("review-artifact-rejected", `review builder artifact ${id} has invalid host builder provenance`);
      if (!validBuilderProvenance && !protectedLegacyReview)
        throw codedError("review-artifact-rejected", `review builder rejects newly imported work-review ${id} without protected builder provenance; Root, Evidence, and repository work remain unchanged, so repeat Review from the exact Root/Evidence chain in this task`);
    }
    let prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`review builder artifact ${id} has conflicting immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...builderProvenance ? { builder_provenance: builderProvenance } : {},
      ...protectedLegacyReview ? { legacy_review_recorded: !0 } : {}
    });
  }
  return { rootFields: rootInspection.artifact.fields, entries: [...byId.values()] };
}
function knownFailure(evidence) {
  return evidence?.fields?.status === "blocked" || (evidence?.fields?.check_evidence ?? []).some((entry) => entry.grade === "failed");
}
function decision(input, evidence) {
  for (let report of input.auditor_reports)
    if (ASSESSMENT_RANK[report.assessment] < ASSESSMENT_RANK[input.assessment])
      throw new Error(`review_input.assessment ${input.assessment} is more positive than review_input.auditor_reports ${report.role} assessment ${report.assessment}`);
  let failed = knownFailure(evidence), reviewReady = evidence?.effective?.reviewReady === !0 && evidence?.fields?.status === "complete", hasFindings = input.findings.length > 0, missing = input.missing_evidence.length > 0 || input.snapshot_assessment !== "consistent", assessment = input.assessment, nextAction = input.recommended_action, deliveryStatus = "blocked";
  if (failed)
    return nextAction === "replan" || nextAction === "clarify" ? assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment : hasFindings && input.correction ? (nextAction = "correct", assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment) : (nextAction = "retry-review", assessment = "insufficient-evidence"), { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: !0 };
  if (nextAction === "replan" || nextAction === "clarify")
    return assessment = ["achieved", "provisional"].includes(assessment) ? "partially-achieved" : assessment, { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: !1 };
  if (nextAction === "correct" || hasFindings) {
    if (!input.correction || !hasFindings) throw new Error("review findings requiring correction need one complete correction proposal");
    return assessment = ["achieved", "provisional"].includes(assessment) ? "mostly-achieved" : assessment, { assessment, delivery_status: "blocked", next_action: "correct", review_ready: reviewReady, known_failure: !1 };
  }
  if (missing || nextAction === "retry-review" || assessment === "insufficient-evidence")
    return { assessment: "insufficient-evidence", delivery_status: "blocked", next_action: "retry-review", review_ready: reviewReady, known_failure: !1 };
  if (reviewReady && assessment === "achieved" && nextAction === "none")
    return { assessment: "achieved", delivery_status: "verified", next_action: "none", review_ready: !0, known_failure: !1 };
  if (!["none", "accept-provisional"].includes(nextAction)) throw new Error(`review_input recommended_action ${nextAction} is inconsistent with an evidence-only provisional result`);
  if (!["achieved", "provisional"].includes(assessment))
    throw new Error(`review_input.assessment ${assessment} is inconsistent with review_input.recommended_action ${nextAction}; provide the missing Evidence or choose correct, clarify, replan, or retry-review`);
  return { assessment: "provisional", delivery_status: "provisional", next_action: "accept-provisional", review_ready: reviewReady, known_failure: !1 };
}
function routeFor(rootFields, input, outcome) {
  let roles = new Set(input.auditor_reports.map((report) => report.role)), deterministicBlocked = outcome.delivery_status === "blocked" && (outcome.next_action === "replan" || outcome.next_action === "correct" && outcome.known_failure), fullRequired = rootFields.contract_level === "certified" || rootFields.risk === "high" || (rootFields.hard_triggers ?? []).length > 0;
  if (roles.has("risk-auditor")) {
    if (!roles.has("delivery-auditor")) throw new Error("risk-auditor review input also requires delivery-auditor input");
    return { review_route: "full", auditors_run: ["inline", "delivery-auditor", "risk-auditor", ...roles.has("work-design-auditor") ? ["work-design-auditor"] : []] };
  }
  if (fullRequired && !deterministicBlocked) throw new Error("certified, high-risk, or hard-trigger review requires delivery-auditor and risk-auditor reports");
  return roles.has("delivery-auditor") ? { review_route: "targeted", auditors_run: ["inline", "delivery-auditor"] } : roles.has("work-design-auditor") ? { review_route: "targeted", auditors_run: ["inline", "work-design-auditor"] } : { review_route: "inline", auditors_run: ["inline"] };
}
function cell2(value) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim() || "none";
}
function table2(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell2(row[header])).join(" | ")} |`)
  ].join(`
`);
}
function nextCheckNumber(entries, pluginRoot) {
  let maximum = 0;
  for (let entry of entries) {
    let inspected = inspectArtifactText(entry.text, pluginRoot), matches = entry.text.match(/\bCHECK-([1-9][0-9]*)\b/g) ?? [];
    for (let match of matches) maximum = Math.max(maximum, Number(match.slice(6)));
    inspected.errors.length > 0;
  }
  return maximum + 1;
}
function correctionProjection({ normalized, findings, seed, rootFields, evidenceId, reviewId, predecessorReview, entries, pluginRoot }) {
  if (!normalized.correction) return null;
  let correctionId = `cp-${rootFields.id.replace(/^wp-/, "")}-${seed.slice(0, 12)}`, fixIds = new Map(normalized.correction.fixes.map((fix, index) => [fix.key, `FIX-${index + 1}`])), stepIds = new Map(normalized.correction.steps.map((step, index) => [step.key, `STEP-${index + 1}`])), checkStart = nextCheckNumber(entries, pluginRoot), checkIds = new Map(normalized.correction.checks.map((check, index) => [check.key, `CHECK-${checkStart + index}`])), learningIds = new Map(normalized.correction.learning_candidates.map((candidate, index) => [candidate.key, `LRN-${seed.slice(0, 8)}-${index + 1}`])), findingsByKey = new Map(findings.map((finding) => [finding.key, finding])), fixes = normalized.correction.fixes.map((fix) => {
    let mapped = fix.finding_keys.map((key) => findingsByKey.get(key));
    return {
      "FIX ID": fixIds.get(fix.key),
      "Finding keys": fix.finding_keys.join(", "),
      "Root Objectives": uniqueSorted(mapped.flatMap((finding) => finding.objective_ids)).join(", "),
      "Root Checks": uniqueSorted(mapped.flatMap((finding) => finding.check_ids)).join(", "),
      "Required outcome": fix.required_outcome,
      Evidence: fix.evidence
    };
  }), steps = normalized.correction.steps.map((step, index) => ({
    "Step ID": stepIds.get(step.key),
    "FIX IDs": step.fix_keys.map((key) => fixIds.get(key)).join(", "),
    Targets: step.targets.join(", "),
    "Required outcome": step.required_outcome,
    "Implementation latitude": step.implementation_latitude,
    "Completion probe": `PROBE-${index + 1}: ${step.completion_probe}`,
    "Check IDs": step.check_keys.map((key) => checkIds.get(key)).join(", "),
    "Deviation action": step.deviation_action
  })), checks = normalized.correction.checks.map((check) => ({
    "Check ID": checkIds.get(check.key),
    "FIX IDs": check.fix_keys.map((key) => fixIds.get(key)).join(", "),
    "Working Directory": check.working_directory,
    "Command or Inspection": check.command_or_inspection,
    "Expected Result": check.expected_result,
    Required: check.required ? "yes" : "no",
    "Cost Class": check.cost_class,
    Prerequisites: check.prerequisites.join(", ")
  })), learnings = normalized.correction.learning_candidates.map((candidate) => ({
    "Learning ID": learningIds.get(candidate.key),
    "Finding keys": candidate.finding_keys.join(", "),
    "Reusable guidance": candidate.reusable_guidance,
    "Candidate targets": candidate.candidate_targets.join(", "),
    "Confirmation evidence": candidate.confirmation_evidence
  })), predecessorCorrection = predecessorReview?.fields?.correction_id ?? "None.", body = [
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
  ].join(`

`);
  return { correction_id: correctionId, learning_ids: [...learningIds.values()], body };
}
function reviewBody({ normalized, outcome, route, coverage, evidenceId, correction }) {
  let sections = [
    `## Assessment

${outcome.assessment}: ${normalized.assessment_summary}`,
    `## Evidence coverage

${table2(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: coverage.inspectedObjectives.join(", ") || "none", Reused: coverage.reusedObjectives.join(", ") || "none", Result: outcome.assessment, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Checks", Inspected: coverage.inspectedChecks.join(", ") || "none", Reused: coverage.reusedChecks.join(", ") || "none", Result: outcome.delivery_status === "verified" ? "passed" : outcome.delivery_status, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Auditors", Inspected: route.auditors_run.join(", "), Reused: "none", Result: "complete", Evidence: "validated review input" },
      { Kind: "Snapshot", Inspected: evidenceId, Reused: "none", Result: normalized.snapshot_assessment, Evidence: normalized.snapshot_summary }
    ])}`,
    normalized.findings.length === 0 ? `## Findings

None.` : `## Findings

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
  return correction && sections.push(correction.body), sections.join(`

`);
}
function boundaryBody(receipt) {
  return [
    `## Assessment

insufficient-evidence: deterministic Evidence recovery is unavailable for the exact current boundary.`,
    `## Evidence coverage

${table2(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Checks", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Auditors", Inspected: "inline", Reused: "none", Result: "complete", Evidence: "host boundary validation" },
      { Kind: "Snapshot", Inspected: receipt.repository_snapshot_hash, Reused: "none", Result: "incomplete", Evidence: receipt.recovery_error_code }
    ])}`,
    `## Findings

None.`,
    `## Next action

replan: create a fresh Root through separate human approval.`
  ].join(`

`);
}
function buildWorkReview({
  rootPlanText,
  artifacts = [],
  reviewInput = null,
  boundaryReceipt = null,
  boundaryReceiptVerifier = null,
  pluginRoot
}) {
  let merged = mergeChain(rootPlanText, artifacts, pluginRoot), contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 5) throw new Error(`review builder Root is invalid: ${contract.errors.join("; ")}`);
  let inspectionOptions = boundaryReceipt && typeof boundaryReceiptVerifier == "function" ? { boundaryReceiptVerifier } : {}, prior = inspectArtifactSet(merged.entries.map((entry) => [entry.label, entry.text]), pluginRoot, inspectionOptions);
  if (prior.errors.length > 0) throw new Error(`review builder input chain is invalid: ${prior.errors.join("; ")}`);
  let tips = effectiveCliSummary(prior), predecessorReviewId = tips.review_tips[merged.rootFields.id] ?? null, predecessorReview = predecessorReviewId ? prior.effective.get(predecessorReviewId) : null, predecessorReviewText = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId)?.text ?? "" : "";
  if (boundaryReceipt) {
    if (typeof boundaryReceiptVerifier != "function") throw new Error("root-boundary review requires a protected host verifier");
    let trusted = boundaryReceiptVerifier({ receipt: boundaryReceipt, rootPlanText, reviewFields: null });
    if (trusted?.ok !== !0) throw new Error(`root-boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
    let seedInput2 = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      predecessor_review_id: predecessorReviewId,
      predecessor_review_hash: predecessorReviewText ? sha2564(predecessorReviewText) : null,
      boundary_receipt: boundaryReceipt
    }, reviewInputHash2 = sha2564(stableJson2(seedInput2)), id2 = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash2.slice(0, 12)}`, fields2 = {
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
    }, artifact2 = `---
${(0, import_yaml2.stringify)(fields2, { lineWidth: 0 }).trimEnd()}
---

${boundaryBody(boundaryReceipt)}
`, duplicate2 = merged.entries.find((entry) => entry.label === id2);
    if (duplicate2 && duplicate2.text !== artifact2) throw new Error(`review builder generated conflicting immutable bytes for ${id2}`);
    let finalEntries2 = duplicate2 ? merged.entries : [...merged.entries, { label: id2, text: artifact2 }], validated2 = inspectArtifactSet(finalEntries2.map((entry) => [entry.label, entry.text]), pluginRoot, { boundaryReceiptVerifier });
    if (validated2.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated2.errors.join("; ")}`);
    let artifactHash2 = sha2564(artifact2);
    return { duplicate: !!duplicate2, artifact: artifact2, artifact_hash: artifactHash2, review_input_hash: reviewInputHash2, fields: fields2, provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: reviewInputHash2, artifact_hash: artifactHash2 } };
  }
  let evidenceId = tips.evidence_tips[merged.rootFields.id] ?? null;
  if (!evidenceId) throw new Error("review builder requires the exact current Evidence tip");
  let evidence = prior.effective.get(evidenceId), evidenceText = merged.entries.find((entry) => entry.label === evidenceId)?.text;
  if (!evidence || !evidenceText) throw new Error(`review builder cannot resolve exact Evidence ${evidenceId}`);
  let normalized, outcome, route;
  try {
    normalized = normalizeReviewInput(reviewInput, contract), outcome = decision(normalized, evidence), route = routeFor(merged.rootFields, normalized, outcome);
  } catch (error) {
    throw error?.code ? error : codedError("review-input-invalid", error?.message ?? "review_input is invalid");
  }
  let currentReviewEntry = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId) : null, currentProvenance = currentReviewEntry?.builder_provenance;
  if (currentProvenance?.schema === 1 && currentProvenance?.kind === "host-work-review-builder" && currentProvenance?.artifact_hash === sha2564(currentReviewEntry.text) && predecessorReview?.fields?.latest_evidence_id === evidenceId) {
    let priorPredecessorId = predecessorReview.fields.predecessor_review_id ?? null, priorPredecessorText = priorPredecessorId ? merged.entries.find((entry) => entry.label === priorPredecessorId)?.text ?? "" : "", retrySeed = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      evidence_id: evidenceId,
      evidence_hash: sha2564(evidenceText),
      predecessor_review_id: priorPredecessorId,
      predecessor_review_hash: priorPredecessorText ? sha2564(priorPredecessorText) : null,
      auditors_run: route.auditors_run,
      review_input: normalized
    }, retryInputHash = sha2564(stableJson2(retrySeed));
    if (retryInputHash === currentProvenance.review_input_hash && predecessorReviewId === `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${retryInputHash.slice(0, 12)}`)
      return {
        duplicate: !0,
        artifact: currentReviewEntry.text,
        artifact_hash: currentProvenance.artifact_hash,
        review_input_hash: retryInputHash,
        fields: predecessorReview.fields,
        normalized_review_input: normalized,
        outcome,
        provenance: currentProvenance
      };
  }
  let rootChecks = contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]), reusedObjectives = predecessorReviewId ? (evidence.fields.reused_objectives ?? []).filter((id2) => contract.objectives.includes(id2)).sort(compareCanonical) : [], reusedChecks = predecessorReviewId ? (evidence.fields.reused_checks ?? []).filter((id2) => rootChecks.includes(id2)).sort(compareCanonical) : [], coverage = {
    reusedObjectives,
    inspectedObjectives: contract.objectives.filter((id2) => !reusedObjectives.includes(id2)),
    reusedChecks,
    inspectedChecks: rootChecks.filter((id2) => !reusedChecks.includes(id2))
  }, seedInput = {
    schema: 1,
    root_content_hash: rootContentHash(rootPlanText),
    root_projection_hash: contract.authoritative_projection_hash,
    evidence_id: evidenceId,
    evidence_hash: sha2564(evidenceText),
    predecessor_review_id: predecessorReviewId,
    predecessor_review_hash: predecessorReviewText ? sha2564(predecessorReviewText) : null,
    auditors_run: route.auditors_run,
    review_input: normalized
  }, reviewInputHash = sha2564(stableJson2(seedInput)), id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash.slice(0, 12)}`, correction = correctionProjection({ normalized, findings: normalized.findings, seed: reviewInputHash, rootFields: merged.rootFields, evidenceId, reviewId: id, predecessorReview, entries: merged.entries, pluginRoot }), fields = {
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
  }, artifact = `---
${(0, import_yaml2.stringify)(fields, { lineWidth: 0 }).trimEnd()}
---

${reviewBody({ normalized, outcome, route, coverage, evidenceId, correction })}
`, duplicate = merged.entries.find((entry) => entry.label === id);
  if (duplicate && duplicate.text !== artifact) throw new Error(`review builder generated conflicting immutable bytes for ${id}`);
  let finalEntries = duplicate ? merged.entries : [...merged.entries, { label: id, text: artifact }], validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join("; ")}`);
  let artifactHash = sha2564(artifact);
  return {
    duplicate: !!duplicate,
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
    let byId = /* @__PURE__ */ new Map();
    for (let entry of [{ label: review.fields.root_plan_id, text: rootPlanText }, ...artifacts, { label: review.fields.id, text: review.artifact, provenance: review.provenance }]) {
      let id = inspectArtifactText(entry.text, handoffStore.pluginRoot).artifact?.fields?.id ?? entry.label, prior = byId.get(id);
      if (prior && prior.text !== entry.text) throw new Error(`work-review persistence found conflicting immutable bytes for ${id}`);
      byId.set(id, {
        label: id,
        text: entry.text,
        ...entry.provenance || entry.builder_provenance ? { provenance: entry.provenance ?? entry.builder_provenance } : prior?.provenance ? { provenance: prior.provenance } : {}
      });
    }
    let persisted = handoffStore.record([...byId.values()]);
    return { ...review, handoff_persisted: !0, handoff_authoritative: !1, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return {
      ...review,
      handoff_persisted: !1,
      handoff_authoritative: !1,
      handoff_error_code: "handoff-persist-failed",
      warning: `optional cross-task review handoff unavailable: ${error.message}; task-local Review remains valid`
    };
  }
}

// src/controller/engine.mjs
var profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 }), secretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];
function learningSourceHashes(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? []).flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_decision_hash))))];
}
function learningSourceReceiptIds(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? []).flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_receipt_id))))].sort();
}
function jsonObject(text) {
  let source = String(text ?? ""), candidate = source.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
function jsonDecision(text) {
  let value = jsonObject(text);
  if (!["achieved", "provisional", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"].includes(value.assessment)) throw new Error("review decision has invalid assessment");
  if (!["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"].includes(value.next_action)) throw new Error("review decision has invalid next_action");
  if (!Array.isArray(value.finding_keys)) throw new Error("review decision requires finding_keys");
  if (value.delivery_status ??= value.assessment === "achieved" ? "verified" : value.next_action === "accept-provisional" ? "provisional" : "blocked", value.learning_candidates = normalizeDecisionLearningCandidates(value.learning_candidates, value.finding_keys, value.next_action), value.learning_candidates.length > 0) {
    if (!Array.isArray(value.findings)) throw new Error("learning candidates require review findings");
    let describedFindings = new Set(value.findings.map((finding) => finding?.key ?? finding?.finding_key).filter(Boolean));
    if (value.learning_candidates.some((candidate) => candidate.finding_keys.some((key) => !describedFindings.has(key))))
      throw new Error("learning candidate references a finding without a valid review finding");
  }
  return value;
}
function reviewerSummary(decision2) {
  if (typeof decision2?.assessment_summary != "string") throw new Error("review decision requires assessment_summary as a string");
  let value = decision2.assessment_summary.trim();
  if (!value) throw new Error("review decision requires assessment_summary");
  return value;
}
function reviewerSnapshot(decision2) {
  if (!["consistent", "contradicted", "incomplete"].includes(decision2?.snapshot_assessment)) throw new Error("review decision requires a valid snapshot_assessment");
  if (typeof decision2?.snapshot_summary != "string") throw new Error("review decision requires snapshot_summary as a string");
  let summary = decision2.snapshot_summary.trim();
  if (!summary) throw new Error("review decision requires snapshot_summary");
  return { assessment: decision2.snapshot_assessment, summary };
}
function controllerReviewInput(run, decision2, auditorReports = []) {
  if (!Array.isArray(decision2?.findings)) throw new Error("review decision requires findings as an array");
  if (!Array.isArray(decision2?.missing_evidence)) throw new Error("review decision requires missing_evidence as an array");
  let findingByKey = /* @__PURE__ */ new Map();
  for (let item of decision2.findings) {
    let rawKey = item?.key ?? item?.finding_key;
    if (typeof rawKey != "string") throw new Error("review finding requires key as a string");
    let key = rawKey.trim();
    if (!key || findingByKey.has(key)) continue;
    if (typeof item?.summary != "string" || typeof item?.evidence != "string" || typeof item?.reasoning != "string")
      throw new Error(`review finding ${key || "<missing>"} requires string summary, evidence, and reasoning`);
    let summary = item.summary.trim(), evidence = item.evidence.trim(), reasoning = item.reasoning.trim();
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
  let keys = [...new Set(decision2?.finding_keys ?? [])].sort();
  if (keys.some((key) => !findingByKey.has(key))) throw new Error("review decision finding_keys must each have one complete typed finding");
  let findings = keys.map((key) => findingByKey.get(key)), snapshot2 = reviewerSnapshot(decision2), input = {
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
  let learning = decision2.learning_candidates ?? [];
  if (learning.length === 0) throw new Error("correct review decision requires one typed learning candidate for Schema-5 correction lineage");
  let fixKeys = findings.map((finding) => `fix-${finding.key}`), requiredChecks = (run.strategy?.checks ?? []).filter((check) => check.Required === "yes");
  if (requiredChecks.length === 0) throw new Error("correct review decision requires at least one Root Check");
  let checkKeys = requiredChecks.map((check) => `check-${String(check["Check ID"]).toLowerCase()}`);
  return input.correction = {
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
      required: !0,
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
  }, input;
}
function routeSelection(validation, role) {
  let result = validation.routes?.[role];
  if (!result?.valid || !result.selected_candidate || !result.model) throw new Error(`route ${role} has no validated candidate`);
  return {
    route: result.selected_candidate,
    acceptedModel: result.model,
    routePoolHash: result.pool_hash,
    selectionReason: result.selection_reason
  };
}
function selectedModelsCertified(routeValidation, certifiedModels) {
  return !Array.isArray(certifiedModels) || certifiedModels.length === 0 ? !1 : Object.entries(routeValidation.routes ?? {}).every(([role, route]) => certifiedModels.some((model) => model.role === role && model.id === route.model?.id && JSON.stringify(model.params ?? []) === JSON.stringify(route.model?.params ?? [])));
}
function phaseReceiptBlockers(receipt, role, expectedProjectionHash = null) {
  let blockers = [];
  return receipt?.model_attested || blockers.push(`${role}-model-mismatch`), (typeof receipt?.request_id != "string" || receipt.request_id === "") && blockers.push(`${role}-request-id-missing`), (typeof receipt?.agent_id != "string" || receipt.agent_id === "") && blockers.push(`${role}-agent-id-missing`), (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) && blockers.push(`${role}-duration-missing`), (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) && blockers.push(`${role}-token-usage-missing`), (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) && blockers.push(`${role}-cost-missing`), expectedProjectionHash && receipt?.artifact_projection_hash !== expectedProjectionHash && blockers.push(`${role}-artifact-projection-mismatch`), blockers;
}
function withinProfile(requested, maximum) {
  return (profileRank[requested] ?? 99) <= (profileRank[maximum] ?? -1);
}
function pathInside(path, roots) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}
function containsSensitiveChange(worktree, paths) {
  for (let path of paths) {
    let candidate = assertContainedPath(worktree, path);
    if (!existsSync2(candidate) || !statSync(candidate).isFile() || statSync(candidate).size > 2 * 1024 * 1024) continue;
    let source;
    try {
      source = readFileSync3(candidate, "utf8");
    } catch {
      continue;
    }
    if (secretPatterns.some((pattern) => pattern.test(source))) return !0;
  }
  return !1;
}
function currentBaselineDiffers(left, right) {
  return left?.head !== right?.head || left?.branch !== right?.branch || left?.status !== right?.status;
}
function guardReadOnlyRepository(cwd, operation) {
  let before = repositoryBaseline(cwd), value = operation(), after = repositoryBaseline(cwd);
  return { value, unchanged: !currentBaselineDiffers(before, after), before, after };
}
function usageForRun(run) {
  let usage = { totalTokens: 0, costUsd: 0, correctionCycles: run.correction_cycles ?? 0, activeMinutes: 0 };
  for (let receipt of run.receipts ?? [])
    usage.totalTokens += receipt.usage?.totalTokens ?? 0, usage.costUsd += receipt.cost_usd ?? 0, usage.activeMinutes += (receipt.duration_ms ?? 0) / 6e4;
  for (let receipt of run.check_receipts ?? []) usage.activeMinutes += (receipt.duration_ms ?? 0) / 6e4;
  return usage;
}
function budgetBoundaryBlockers(run) {
  return evaluateAuthorization({ plan: run.plan.fields, usage: usageForRun(run) }).blockers.filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
}
var WorkflowEngine = class {
  constructor({ workspaceRoot, store, preparationStore, pluginRoot, stateRoot, worktreeRoot, adapterFactory, capabilitiesFactory, handoffStore } = {}) {
    this.workspaceRoot = resolve4(workspaceRoot), this.store = store, this.preparationStore = preparationStore, this.pluginRoot = resolve4(pluginRoot), this.stateRoot = resolve4(stateRoot), this.worktreeRoot = worktreeRoot ? resolve4(worktreeRoot) : null, this.handoffStore = handoffStore ?? new ArtifactHandoffStore(this.stateRoot, this.pluginRoot), this.adapterFactory = adapterFactory ?? ((run) => new CursorWorkerAdapter({ runDirectory: this.store.runDirectory(run.run_id), pluginRoot: this.pluginRoot })), this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }
  snapshot(run) {
    let compatibility = classifyRunCompatibility(run);
    return compatibility.compatible ? deriveWorkflowState({
      ...run,
      compatibility: compatibility.compatibility,
      root_plan_id: run.plan?.fields?.id ?? null,
      root_schema_valid: run.plan ? run.plan.fields?.schema === 5 : void 0,
      intent_ready: run.plan?.fields?.intent_ready === !0,
      product_aligned: !!run.plan,
      architecture_aligned: !!run.plan,
      program_design_aligned: !!run.plan,
      slices_ready: !!run.strategy?.steps?.length,
      strategy_revision: run.strategy?.revision ?? null
    }) : deriveWorkflowState({
      ...run,
      lifecycle: "stopped",
      compatibility: compatibility.compatibility,
      blockers: [.../* @__PURE__ */ new Set([...run.blockers ?? [], compatibility.blocker])]
    });
  }
  start({ preparationId, approvedRootHash, expectedPreparationRevision, idempotencyKey }) {
    if (!this.preparationStore) throw new Error("workflow_start requires a preparation store");
    let preparation = this.preparationStore.get(preparationId);
    assertCompatiblePreparation(preparation);
    let prior = this.store.list().find((run) => run.preparation_id === preparationId && run.start_idempotency_key === idempotencyKey);
    if (prior && preparation.status === "consumed") {
      if (prior.root_plan_hash !== approvedRootHash) throw new Error("approved-root-hash-mismatch");
      return { run: prior, preparation, duplicate: !0 };
    }
    if (preparation.status !== "root-ready") throw new Error(`preparation is not root-ready: ${preparation.status}`);
    if (preparation.revision !== expectedPreparationRevision) throw new Error(`preparation revision conflict: expected ${expectedPreparationRevision}, current ${preparation.revision}`);
    if (preparation.root_plan_hash !== approvedRootHash) throw new Error("approved-root-hash-mismatch");
    if (Date.parse(preparation.expires_at) <= Date.now()) throw new Error("preparation-expired");
    let hashes = configurationHashes(this.workspaceRoot, preparation.route_profile);
    if (hashes.route_hash !== preparation.route_hash) throw new Error("route-configuration-drift");
    if (hashes.config_hash !== preparation.config_hash) throw new Error("planning-configuration-drift");
    if (hashes.policy_hash !== preparation.policy_hash) throw new Error("project-policy-drift");
    if (planningHarnessHash(this.pluginRoot) !== preparation.harness_hash) throw new Error("planning-harness-drift");
    let contract = executionContractFromArtifactText(preparation.root_plan_text, this.pluginRoot);
    if (contract.errors.length > 0) throw new Error(`invalid prepared root plan: ${contract.errors.join("; ")}`);
    let lineage = validateRootPlanLineage(preparation.root_plan_text, preparation.input_root_lineage_artifacts, this.pluginRoot);
    if (lineage.errors.length > 0) throw new Error(`invalid prepared root lineage: ${lineage.errors.join("; ")}`);
    let expectedLineageHash = preparation.input_root_lineage_hash ?? (lineage.artifacts.length === 0 ? lineage.artifact_set_hash : null);
    if (lineage.artifact_set_hash !== expectedLineageHash) throw new Error("prepared-root-lineage-hash-mismatch");
    if (contract.authoritative_projection_hash !== preparation.root_authoritative_projection_hash) throw new Error("prepared-root-authoritative-projection-mismatch");
    if (contract.fields.status !== "ready" || contract.fields.intent_ready !== !0) throw new Error("prepared root plan must be ready with intent_ready true");
    if (!withinProfile(preparation.requested_profile, contract.fields.profile_max)) throw new Error(`prepared root plan permits at most ${contract.fields.profile_max}`);
    let usage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at), receiptBlockers = (preparation.planner_receipts ?? []).flatMap(plannerReceiptBlockers);
    (preparation.planner_receipts ?? []).length === 0 && receiptBlockers.push("planner-receipt-missing");
    let preparedAcceptedModel = preparation.route_validation.routes?.planner?.model;
    for (let [index, receipt] of (preparation.planner_receipts ?? []).entries())
      receiptBlockers.push(...expectedPlannerReceiptBlockers(receipt, preparation, preparedAcceptedModel)), receipt.agent_id !== preparation.planner_agent_id && receiptBlockers.push("planner-agent-affinity-mismatch"), index === preparation.planner_receipts.length - 1 && receipt.produced_artifact_projection_hash !== preparation.root_authoritative_projection_hash && receiptBlockers.push("planner-produced-artifact-projection-mismatch");
    let preflightBlockers = [.../* @__PURE__ */ new Set([...receiptBlockers, ...planningBudgetBlockers(usage, preparation.planning_budget)])];
    if (preflightBlockers.length > 0) throw new Error(`planner preflight invalid: ${preflightBlockers.join("; ")}`);
    let routeValidation;
    try {
      routeValidation = this.adapterFactory({ run_id: "start-preflight" }).validateProfile(preparation.route_config);
    } catch (error) {
      routeValidation = { verified: !1, errors: [error.message] };
    }
    if (!routeValidation.verified) throw new Error(`route validation failed: ${(routeValidation.errors ?? []).join("; ")}`);
    if (JSON.stringify(routeValidation.routes?.planner?.model) !== JSON.stringify(preparedAcceptedModel)) throw new Error("planner-catalog-attestation-drift");
    let strategy = createInitialStrategy(contract), cert = contract.fields.certification ?? {}, key = qualificationKey({
      taskClass: strategy.task_class,
      verificationProfileHash: cert.verification_profile_hash,
      routePoolHash: cert.route_pool_hash ?? preparation.route_hash,
      certifiedRegion: cert.certified_region
    }), sourceNow = repositoryBaseline(this.workspaceRoot), capabilities = this.capabilitiesFactory({ model_catalog_verified: !0, expected_route_hash: preparation.route_hash, expected_planning_harness_hash: preparation.harness_hash }), creation = this.store.createFromPreparation(this.preparationStore, { preparationId, approvedRootHash, expectedPreparationRevision, idempotencyKey }, {
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
      plan_approved: !0,
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
      execution_started: !1,
      evidence_entries: [],
      evidence_grade: null,
      delivery_status: null,
      receipts: [],
      blockers: []
    });
    return creation.duplicate ? { ...creation, run: creation.run } : { ...creation, run: this.approve(creation.run.run_id) };
  }
  update(runId, mutator, eventType) {
    let current = this.store.get(runId);
    return this.store.update(runId, current.revision, null, mutator, eventType);
  }
  approve(runId) {
    let run = this.store.get(runId);
    if (!run.plan || !withinProfile(run.requested_profile, run.plan.fields.profile_max)) throw new Error("run has no compatible approved intent root");
    let routeValidation;
    try {
      routeValidation = this.adapterFactory(run).validateProfile(run.route_config);
    } catch (error) {
      routeValidation = { verified: !1, errors: [error.message] };
    }
    let manifestPath = run.project_policy.verification_profile?.manifest_path, verificationAudit = manifestPath ? auditVerificationProfile(this.workspaceRoot, manifestPath, this.pluginRoot, this.stateRoot) : { status: "blocked", valid: !1, errors: ["verification profile not configured"] }, capabilities = this.capabilitiesFactory({
      model_catalog_verified: routeValidation.verified === !0,
      verification_profile_certified: verificationAudit.status === "clean",
      expected_route_hash: run.route_hash,
      expected_planning_harness_hash: run.harness_hash
    });
    capabilities.route_pool_certified = capabilities.route_pool_certified === !0 && routeValidation.verified === !0, capabilities.route_pool_models_certified = capabilities.route_pool_models_certified === !0 || selectedModelsCertified(routeValidation, capabilities.certified_models);
    let qualifyingRuns = this.store.qualifyingHistory(run.qualification_key);
    run = this.update(runId, (draft) => ({ ...draft, route_validation: routeValidation, capabilities, verification_audit: verificationAudit, config_errors: [...draft.base_config_errors ?? [], ...routeValidation.errors ?? []] }), "approval-preflight-refreshed");
    let eligibility = evaluateEligibility({ requestedProfile: run.requested_profile, plan: run.plan.fields, project: run.project_policy, capabilities, configErrors: run.config_errors, qualifyingRuns, taskClass: run.strategy.task_class });
    return eligibility.blockers.length > 0 ? this.update(runId, (draft) => ({ ...draft, ...eligibility, lifecycle: "waiting-human", next_action: "resolve-capability-blockers" }), "eligibility-blocked") : (run = this.update(runId, (draft) => ({ ...draft, ...eligibility, lifecycle: "queued", phase: "strategy-ready", blockers: [], next_action: "execute-strategy" }), eligibility.downgraded ? "profile-auto-downgraded" : "run-approved"), eligibility.downgraded && this.store.appendDecision(runId, { phase: "eligibility", decision: "continue-supervised", reason: eligibility.downgrade_reason, input_hashes: [run.intent_hash], strategy_revision: run.strategy.revision, result: "queued" }), run);
  }
  execute(runId) {
    let run = this.store.get(runId);
    if (!run.plan_approved || run.lifecycle !== "queued") throw new Error("run is not approved and queued");
    let integrityBlockers = runIntegrityBlockers(run, this.pluginRoot);
    if (integrityBlockers.length > 0) return this.block(run, integrityBlockers);
    for (let capability of ["worker_network_isolated", "sandbox_boundary_verified", "sdk_secret_isolated", "sdk_budget_cancel_verified"]) if (!run.capabilities[capability]) throw new Error(`automated writing denied without ${capability}`);
    if (run.worktree)
      run = this.update(runId, (draft) => ({ ...draft, lifecycle: "running", execution_started: !0 }), "run-resumed");
    else {
      let worktree;
      try {
        worktree = createRunWorktree(this.workspaceRoot, runId, {
          ...this.worktreeRoot ? { root: this.worktreeRoot } : {},
          snapshotPath: join3(this.store.runDirectory(runId), "dirty-snapshot.json")
        });
      } catch (error) {
        return this.block(run, [`dirty-snapshot-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, worktree, dirty_baseline_hash: worktree.dirty_snapshot_hash, lifecycle: "running", execution_started: !0, phase: "baseline-verification", current_slice: draft.current_slice ?? 0, checkpoints: [{ slice_id: "HUMAN-BASELINE", commit: worktree.human_baseline, empty: !worktree.dirty }] }), "human-baseline-created");
    }
    if (run.strategy.task_class === "verify-existing" && !run.comparison_baseline_worktree) {
      let comparisonBaselineWorktree;
      try {
        comparisonBaselineWorktree = createComparisonBaselineWorktree(this.workspaceRoot, runId, run.worktree.baseline.head, { ...this.worktreeRoot ? { root: this.worktreeRoot } : {} });
      } catch (error) {
        return this.block(run, [`comparison-baseline-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, comparison_baseline_worktree: comparisonBaselineWorktree }), "comparison-baseline-created");
    }
    let adapter = this.adapterFactory(run);
    if (!(run.evidence_entries ?? []).some((entry) => entry.baseline_or_patched === "baseline")) {
      let baseline = this.verify(run, run.strategy.steps[0], "baseline", adapter);
      if (baseline.hard_error) return this.block(run, baseline.blockers);
      run = this.update(runId, (draft) => ({ ...draft, phase: "implementing", evidence_entries: [...draft.evidence_entries ?? [], ...baseline.entries], receipts: [...draft.receipts, ...baseline.receipt ? [baseline.receipt] : []] }), "baseline-evidence-recorded");
      let budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return this.block(run, budgetBlockers);
    }
    if (!TASK_RECIPES[run.strategy.task_class].writer_allowed) {
      if (run.strategy.task_class === "verify-existing") {
        let patched = this.verify(run, run.strategy.steps[0], "patched", adapter);
        if (patched.hard_error) return this.block(run, patched.blockers);
        run = this.update(runId, (draft) => ({ ...draft, evidence_entries: [...draft.evidence_entries, ...patched.entries], receipts: [...draft.receipts, ...patched.receipt ? [patched.receipt] : []] }), "candidate-evidence-recorded");
        let budgetBlockers = budgetBoundaryBlockers(run);
        if (budgetBlockers.length > 0) return this.block(run, budgetBlockers);
      }
      return this.finalReview(runId);
    }
    let slices = run.strategy.steps.length > 0 ? run.strategy.steps : [{ "Slice ID": "SLICE-1", "Check IDs": run.strategy.checks.map((item) => item["Check ID"]).join(", ") }];
    for (let index = run.current_slice ?? 0; index < slices.length; index += 1) {
      let result = this.executeSlice(run, slices[index], index);
      if (!result.completed) return result.run;
      run = result.run;
      let sliceCheckpoint = checkpoint(run.worktree.path, `${slices[index]["Slice ID"]}`);
      run = this.update(runId, (draft) => ({ ...draft, current_slice: index + 1, more_slices: index + 1 < slices.length, phase: "strategy-ready", checkpoints: [...draft.checkpoints ?? [], { slice_id: slices[index]["Slice ID"], ...sliceCheckpoint }] }), "slice-complete");
    }
    return this.finalReview(runId);
  }
  executeSlice(run, slice) {
    let adapter = this.adapterFactory(run), correctionCycle = run.correction_cycles ?? 0, previousFindingKeys = run.review?.finding_keys ?? [], writerAgentId = run.writer_agent_id ?? null, escalated = run.writer_escalated === !0;
    for (; ; ) {
      let pre = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
      if (!pre.authorized) {
        let budgetBlockers2 = budgetBoundaryBlockers(run);
        return { completed: !1, run: budgetBlockers2.length > 0 ? this.block(run, budgetBlockers2) : this.wait(run, pre.blockers) };
      }
      let routeChoice = selectWriterRoute({ plan: run.plan.fields, correctionCycle, findingRepeated: run.finding_repeated === !0, alreadyEscalated: escalated });
      routeChoice.escalated && !escalated && (escalated = !0, writerAgentId = null);
      let role = routeChoice.role, selected = routeSelection(run.route_validation, role), prompt = [
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
      ].filter(Boolean).join(`

`), roots = run.plan.fields.authority.allowed_roots, writablePaths = roots.filter((target) => pathInside(target, run.project_policy.allowed_write_roots)).map((target) => assertContainedPath(run.worktree.path, target));
      if (writablePaths.length !== roots.length) return { completed: !1, run: this.wait(run, ["intent-authority-exceeds-project-policy"]) };
      let denied = [.../* @__PURE__ */ new Set([...run.project_policy.protected_paths, ...run.project_policy.approval_required_paths, ...run.plan.fields.authority.protected_paths, ...run.plan.fields.authority.approval_required_paths])].map((target) => assertContainedPath(run.worktree.path, target)), phase = adapter.runPhase({ role, ...selected, prompt, cwd: run.worktree.path, agentId: writerAgentId, writerWritablePaths: writablePaths, writerDeniedPaths: denied, configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash });
      if (writerAgentId = phase.receipt.agent_id, run = this.update(run.run_id, (draft) => ({ ...draft, phase: "host-verifying", writer_agent_id: writerAgentId, writer_escalated: escalated, receipts: [...draft.receipts, phase.receipt] }), "writer-finished"), phase.response.status === "interrupted") return { completed: !1, run: this.update(run.run_id, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: ["worker-hard-cancelled"], next_action: "resume" }), "worker-interrupted") };
      let writerBlockers = phaseReceiptBlockers(phase.receipt, role, run.intent_hash);
      if (!phase.response.ok || writerBlockers.length > 0) return { completed: !1, run: this.rollbackAndWait(run, [phase.response.error?.message, ...writerBlockers].filter(Boolean)) };
      let paths = changedPaths(run.worktree.path), changedDependencies = detectDependencyChanges(run.worktree.path, run.worktree.human_baseline, paths), authorization = evaluateAuthorization({ plan: run.plan.fields, changedPaths: paths, changedDependencies, usage: this.usage(run) });
      if (run.project_policy.dependencies === "deny" && changedDependencies.length > 0 && authorization.blockers.push("project-dependency-change-denied"), run.project_policy.dependencies === "allow-listed") for (let dependency of changedDependencies) run.project_policy.allowed_dependencies.includes(dependency) || authorization.blockers.push(`project-dependency-not-allow-listed:${dependency}`);
      if (containsSensitiveChange(run.worktree.path, paths) && authorization.blockers.push("secret-material-detected"), !authorization.authorized || authorization.blockers.length > 0) {
        let restored = this.rollbackAndWait(run, authorization.blockers), budgetBlockers2 = authorization.blockers.filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
        return { completed: !1, run: budgetBlockers2.length > 0 ? this.block(restored, budgetBlockers2) : restored };
      }
      let certifiedRegion = run.plan.fields.certification?.certified_region, regionEscapes = certifiedRegion ? paths.filter((path) => !pathInside(path, [certifiedRegion])) : [];
      run.effective_profile === "autonomous" && regionEscapes.length > 0 && (run = this.update(run.run_id, (draft) => ({
        ...draft,
        effective_profile: "supervised",
        downgraded: !0,
        downgrade_reason: `certified-region-exceeded:${regionEscapes.join(",")}`
      }), "profile-auto-downgraded"), this.store.appendDecision(run.run_id, {
        phase: "scope",
        actor_receipt: phase.receipt.request_id,
        decision: "continue-supervised",
        reason: run.downgrade_reason,
        input_hashes: [run.intent_hash, run.strategy.strategy_hash],
        strategy_revision: run.strategy.revision,
        result: "supervised"
      }));
      let adjacentPaths = paths.filter((path) => !pathInside(path, run.strategy.primary_targets ?? [])), alreadyRecorded = new Set((run.strategy.deviations ?? []).filter((item) => item.kind === "adjacent-scope").flatMap((item) => item.paths ?? [])), newAdjacentPaths = adjacentPaths.filter((path) => !alreadyRecorded.has(path));
      if (newAdjacentPaths.length > 0) {
        let deviation2 = { id: `DEV-${run.strategy.revision + 1}`, kind: "adjacent-scope", paths: newAdjacentPaths, at: (/* @__PURE__ */ new Date()).toISOString() }, strategy2 = reviseStrategy(run.strategy, { deviations: [deviation2] }, { reason: `adjacent in-envelope scope: ${newAdjacentPaths.join(", ")}`, createdBy: role, authority: run.plan.fields.authority });
        run = this.update(run.run_id, (draft) => ({ ...draft, strategy: strategy2 }), "strategy-revised"), this.store.appendDecision(run.run_id, {
          phase: "adapt",
          actor_receipt: phase.receipt.request_id,
          decision: "record-adjacent-scope",
          reason: strategy2.rationale,
          input_hashes: [run.intent_hash, strategy2.parent_hash],
          strategy_revision: strategy2.revision,
          result: strategy2.strategy_hash
        });
      }
      let checkIds = String(slice["Check IDs"] ?? "").split(",").map((item) => item.trim()).filter(Boolean), checks = run.strategy.checks.filter((check) => correctionCycle > 0 || checkIds.length === 0 || checkIds.includes(check["Check ID"])), hostReceipts = checks.map((check) => {
        if (check["Evidence Class"] !== "machine-verifiable" || check["Command or Inspection"] === "verification-profile") return { check_id: check["Check ID"], unavailable: !0, reason: "verification-profile-required" };
        try {
          return { check_id: check["Check ID"], ...runHostCheck(run.worktree.path, parseHostCommand(check["Command or Inspection"])) };
        } catch (error) {
          return { check_id: check["Check ID"], unavailable: !0, reason: error.message };
        }
      }), verificationSlice = correctionCycle > 0 ? { ...slice, "Check IDs": checks.map((check) => check["Check ID"]).join(", ") } : slice, verifier = this.verify(run, verificationSlice, "patched", adapter, hostReceipts);
      if (verifier.hard_error) return { completed: !1, run: this.block(run, verifier.blockers) };
      let byCheck = new Map(verifier.entries.map((entry) => [entry.check_id, entry])), entries = checks.map((check) => byCheck.get(check["Check ID"]) ?? checkEvidence(check, hostReceipts.find((receipt) => receipt.check_id === check["Check ID"]), "patched"));
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "slice-review", check_receipts: [...draft.check_receipts ?? [], ...hostReceipts], evidence_entries: [...(draft.evidence_entries ?? []).filter((entry) => !(entry.baseline_or_patched === "patched" && entries.some((candidate) => candidate.check_id === entry.check_id))), ...entries], receipts: [...draft.receipts, ...verifier.receipt ? [verifier.receipt] : []] }), "verification-finished");
      let budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return { completed: !1, run: this.block(run, budgetBlockers) };
      let review = this.review(run, slice, entries, adapter);
      if (review.hard_error) return { completed: !1, run: this.block(run, review.blockers) };
      if (run = this.update(run.run_id, (draft) => ({ ...draft, review: review.decision, receipts: [...draft.receipts, review.receipt] }), "slice-reviewed"), budgetBlockers = budgetBoundaryBlockers(run), budgetBlockers.length > 0) return { completed: !1, run: this.block(run, budgetBlockers) };
      if (!review.decision) return { completed: !1, run: this.wait(run, review.blockers) };
      let aggregate = aggregateEvidence(run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched"));
      if (review.decision.next_action !== "none") {
        let patchedEvidence = run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched"), candidate;
        try {
          candidate = this.deliveryEvidenceCandidate(run, patchedEvidence);
        } catch (error) {
          return { completed: !1, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) };
        }
        let built;
        try {
          built = this.controllerWorkReview(run, candidate, review);
        } catch (firstError) {
          let repaired = this.review(run, slice, entries, adapter, candidate.artifact, firstError.message);
          run = this.update(run.run_id, (draft) => ({ ...draft, receipts: [...draft.receipts, ...repaired.receipt ? [repaired.receipt] : []] }), "review-input-repair-attempted");
          try {
            if (!repaired.decision || repaired.hard_error) throw new Error("repair reviewer did not return a valid decision");
            built = this.controllerWorkReview(run, candidate, repaired), review = repaired;
          } catch (secondError) {
            return { completed: !1, run: this.wait(run, [`review-input-invalid-after-one-repair:${secondError.message}; repeat Review in this Run`]) };
          }
        }
        review = { ...review, decision: built.controller_decision }, run = this.update(run.run_id, (draft) => ({ ...draft, review: built.controller_decision }), "slice-review-authority-built"), run = this.materializeControllerReview(run, candidate, built);
      }
      if (aggregate.delivery === "blocked") {
        let patchedEvidence = run.evidence_entries.filter((entry) => entry.baseline_or_patched === "patched"), candidate;
        try {
          candidate = this.deliveryEvidenceCandidate(run, patchedEvidence);
        } catch (error) {
          return { completed: !1, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) };
        }
        let materialized = this.materializeDeliveryEvidence(run, candidate);
        return { completed: !1, run: this.update(run.run_id, (draft) => ({
          ...draft,
          lifecycle: "blocked",
          delivery_status: "blocked",
          evidence_grade: "failed",
          blockers: ["known-check-failure", ...materialized.blocker ? [materialized.blocker] : []],
          next_action: "correct-or-replan"
        }), "delivery-blocked") };
      }
      if (review.decision.assessment === "achieved" && review.decision.next_action === "none" && aggregate.delivery !== "blocked") return { completed: !0, run };
      if (["clarify", "replan"].includes(review.decision.next_action)) return { completed: !1, run: this.wait(run, [`review-${review.decision.next_action}`]) };
      if (review.decision.next_action !== "correct") return { completed: !1, run: this.wait(run, ["review-not-actionable"]) };
      correctionCycle += 1;
      let findingRepeated = review.decision.finding_keys.some((key) => previousFindingKeys.includes(key));
      previousFindingKeys = review.decision.finding_keys;
      let maximum = run.project_policy.maximum_budgets?.max_correction_cycles ?? 3;
      if (correctionCycle > maximum) return { completed: !1, run: this.wait(run, ["correction-budget-exhausted"]) };
      let learning = materializeControllerLearningCandidates({
        run,
        decision: review.decision,
        correctionCycle,
        receiptIds: [review.receipt?.request_id].filter(Boolean)
      }), learningCandidateIds = learning.candidates.map((candidate) => candidate.learning_id), correctionDecision = {
        ...review.decision,
        controller_learning_correction_id: learning.correction_id,
        controller_learning_candidate_ids: learningCandidateIds
      }, deviation = {
        id: `DEV-${run.strategy.revision + 1}`,
        kind: "review-correction",
        correction_id: learning.correction_id,
        finding_keys: correctionDecision.finding_keys,
        learning_candidate_ids: learningCandidateIds,
        at: (/* @__PURE__ */ new Date()).toISOString()
      }, parsedCorrection = inspectArtifactText(run.work_review_artifact, this.pluginRoot).artifact?.correction;
      if (!parsedCorrection?.id || parsedCorrection.id !== review.decision.correction_id) return { completed: !1, run: this.wait(run, ["host-built-correction-plan-unavailable"]) };
      let correctionChecks = parsedCorrection.checks.map((check) => ({
        ...check,
        Objectives: parsedCorrection.fixes.filter((fix) => String(check["FIX IDs"]).split(",").map((item) => item.trim()).includes(fix["FIX ID"])).flatMap((fix) => String(fix["Root Objectives"]).split(",").map((item) => item.trim())).filter(Boolean).join(", "),
        "Evidence Class": "machine-verifiable"
      })), checksById = new Map([...run.strategy.checks, ...correctionChecks].map((check) => [check["Check ID"], check])), strategy = reviseStrategy(run.strategy, { deviations: [deviation], checks: [...checksById.values()] }, { reason: `review correction ${correctionCycle}`, createdBy: role, authority: run.plan.fields.authority });
      run = this.update(run.run_id, (draft) => ({
        ...draft,
        strategy,
        correction_cycles: correctionCycle,
        finding_repeated: findingRepeated,
        review: correctionDecision,
        learning_candidates: mergeControllerLearningCandidates(draft.learning_candidates, learning.candidates),
        phase: "implementing"
      }), "strategy-revised"), this.store.appendDecision(run.run_id, {
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
    let checks = run.strategy.checks.filter((check) => {
      let ids = String(slice?.["Check IDs"] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      return ids.length === 0 || ids.includes(check["Check ID"]);
    }), hostEntries = hostReceipts.filter((receipt) => receipt.passed === !0 || receipt.passed === !1).map((receipt) => checkEvidence(checks.find((check) => check["Check ID"] === receipt.check_id), receipt, stage)), unresolved = checks.filter((check) => !hostEntries.some((entry) => entry.check_id === check["Check ID"]));
    if (unresolved.length === 0) return {
      entries: calibrateRecipeEvidence(run.strategy.task_class, hostEntries, stage, run.evidence_entries ?? []),
      receipt: null
    };
    let selected;
    try {
      selected = routeSelection(run.route_validation, "verifier");
    } catch (error) {
      return {
        entries: calibrateRecipeEvidence(run.strategy.task_class, [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: !0, reason: error.message }, stage))], stage, run.evidence_entries ?? []),
        receipt: null
      };
    }
    let artifactDirectory = join3(this.store.runDirectory(run.run_id), "artifacts", `strategy-${run.strategy.revision}`, stage);
    mkdirSync3(artifactDirectory, { recursive: !0, mode: 448 });
    let recipe = TASK_RECIPES[run.strategy.task_class], prompt = [
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
    ].join(`

`), verifierCwd = stage === "baseline" && run.strategy.task_class === "verify-existing" && run.comparison_baseline_worktree?.path ? run.comparison_baseline_worktree.path : run.worktree?.path ?? this.workspaceRoot, guarded = guardReadOnlyRepository(verifierCwd, () => adapter.runPhase({ role: "verifier", ...selected, prompt, cwd: verifierCwd, verifierArtifactPaths: [artifactDirectory], configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash })), phase = guarded.value;
    if (!guarded.unchanged) return {
      entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { passed: !1, reason: "reader modified repository" }, stage))],
      receipt: { ...phase.receipt, reader_repository_unchanged: !1 },
      hard_error: !0,
      blockers: ["reader-repository-mutation:verifier"]
    };
    let blockers = phaseReceiptBlockers(phase.receipt, "verifier", run.intent_hash);
    if (!phase.response.ok || blockers.length > 0) return { entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: !0, reason: blockers.join(",") || phase.response.error?.message }, stage))], receipt: phase.receipt };
    try {
      let value = jsonObject(phase.response.result), returned = Array.isArray(value.entries) ? value.entries : [], entries = unresolved.map((check) => {
        let item = returned.find((entry) => entry.check_id === check["Check ID"]);
        return !item || !["verified", "supported", "partial", "unavailable", "failed"].includes(item.grade) ? checkEvidence(check, { unavailable: !0, reason: "verifier omitted valid evidence" }, stage) : {
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
      return { entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: !0, reason: `invalid verifier output: ${error.message}` }, stage))], receipt: phase.receipt };
    }
  }
  review(run, slice, evidenceEntries, adapter, candidateEvidence = null, repairIssue = null) {
    let selected = routeSelection(run.route_validation, "reviewer"), diff = this.gitDiff(run.worktree.path, run.strategy.task_class === "verify-existing" ? run.worktree.baseline.head : run.worktree.human_baseline), prompt = [
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
    ].filter(Boolean).join(`

`), guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runPhase({ role: "reviewer", ...selected, prompt, cwd: run.worktree.path, configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash })), phase = guarded.value;
    if (!guarded.unchanged) return { decision: null, receipt: { ...phase.receipt, reader_repository_unchanged: !1 }, blockers: ["reader-repository-mutation:reviewer"], hard_error: !0 };
    let blockers = phaseReceiptBlockers(phase.receipt, "reviewer", run.intent_hash);
    if (phase.response.ok || blockers.push(phase.response.error?.message ?? "reviewer-failed"), blockers.length > 0) return { decision: null, receipt: phase.receipt, blockers: [...new Set(blockers)] };
    try {
      let decision2 = jsonDecision(phase.response.result);
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
    if (typeof adapter.runReadOnlyFanout != "function") return this.review(run, { "Slice ID": "ROOT" }, evidenceEntries, adapter, candidateEvidence);
    let diff = this.gitDiff(run.worktree.path, run.strategy.task_class === "verify-existing" ? run.worktree.baseline.head : run.worktree.human_baseline), prompt = [
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
    ].filter(Boolean).join(`

`), phases = ["reviewer", "investigator"].map((role) => ({
      role,
      ...routeSelection(run.route_validation, role),
      prompt,
      cwd: run.worktree.path,
      configurationHash: run.route_hash,
      artifactProjectionHash: run.intent_hash
    })), results;
    try {
      let guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runReadOnlyFanout(phases));
      if (results = guarded.value, !guarded.unchanged) return { decision: null, receipts: results.map((result) => ({ ...result.receipt, reader_repository_unchanged: !1 })), blockers: ["reader-repository-mutation:fanout"], hard_error: !0 };
    } catch (error) {
      return { decision: null, receipt: null, receipts: [], blockers: [`read-fanout-failed:${error.message}`] };
    }
    let decisionRecords = [], blockers = [];
    for (let [index, result] of results.entries()) {
      let role = phases[index].role, receiptErrors = phaseReceiptBlockers(result.receipt, role, run.intent_hash);
      if (result.response.ok || receiptErrors.push(result.response.error?.message ?? `${role}-failed`), receiptErrors.length > 0) {
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
    let actionRank = { replan: 6, clarify: 5, correct: 4, "retry-review": 3, "accept-provisional": 2, none: 1 }, selected = decisionRecords.toSorted((left, right) => actionRank[right.decision.next_action] - actionRank[left.decision.next_action])[0].decision, bothAchieved = decisionRecords.length === 2 && decisionRecords.every(({ decision: decision3 }) => decision3.assessment === "achieved" && decision3.next_action === "none"), learningBySemanticIdentity = /* @__PURE__ */ new Map();
    if (selected.next_action === "correct")
      for (let { decision: sourceDecision, receipt } of decisionRecords.filter(({ decision: decision3 }) => decision3.next_action === "correct"))
        for (let candidate of sourceDecision.learning_candidates ?? []) {
          let key = controllerLearningCandidateSemanticHash(candidate), sourceBinding = {
            source_receipt_id: receipt.request_id,
            source_decision_hash: controllerLearningDecisionHash(sourceDecision, candidate)
          }, prior = learningBySemanticIdentity.get(key);
          if (!prior) {
            learningBySemanticIdentity.set(key, { ...candidate, source_bindings: [sourceBinding] });
            continue;
          }
          prior.source_bindings = [...new Map([...prior.source_bindings, sourceBinding].map((binding) => [`${binding.source_receipt_id}:${binding.source_decision_hash}`, binding])).values()].toSorted((left, right) => left.source_receipt_id.localeCompare(right.source_receipt_id));
        }
    let learningCandidates = [...learningBySemanticIdentity.values()];
    return {
      decision: {
        ...selected,
        assessment: bothAchieved ? "achieved" : selected.assessment === "achieved" ? "provisional" : selected.assessment,
        delivery_status: bothAchieved ? "verified" : selected.delivery_status === "blocked" ? "blocked" : "provisional",
        next_action: bothAchieved ? "none" : selected.next_action === "none" ? "accept-provisional" : selected.next_action,
        finding_keys: [...new Set(decisionRecords.flatMap(({ decision: item }) => item.finding_keys ?? []))].toSorted(),
        findings: decisionRecords.flatMap(({ decision: item }) => item.findings ?? []),
        learning_candidates: learningCandidates,
        agreement: bothAchieved ? "consensus" : decisionRecords.length === 2 ? "contested" : "single-valid-review"
      },
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
    let run = this.store.get(runId), authorization = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
    if (!authorization.authorized) {
      let budgetBlockers2 = budgetBoundaryBlockers(run);
      return budgetBlockers2.length > 0 ? this.block(run, budgetBlockers2) : this.wait(run, authorization.blockers);
    }
    let adapter = this.adapterFactory(run), patched = (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "patched"), evidence = patched.length > 0 ? patched : (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "baseline"), aggregate = aggregateEvidence(evidence), candidate;
    try {
      candidate = this.deliveryEvidenceCandidate(run, evidence);
    } catch (error) {
      return this.block(run, [`delivery-closeout-invalid:${error.message}`]);
    }
    let review = this.reviewFanout(run, evidence, adapter, candidate.artifact), reviewReceipts = review.receipts ?? (review.receipt ? [review.receipt] : []), rootLearning = materializeControllerLearningCandidates({
      run,
      decision: review.decision,
      correctionCycle: (run.correction_cycles ?? 0) + 1,
      receiptIds: reviewReceipts.map((receipt) => receipt?.request_id).filter(Boolean)
    }), builtReview = null;
    if (review.decision && !review.hard_error)
      try {
        builtReview = this.controllerWorkReview(run, candidate, review);
      } catch (firstError) {
        let repaired = this.reviewFanout(run, evidence, adapter, candidate.artifact, firstError.message);
        reviewReceipts = [...reviewReceipts, ...repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : [])], review = { ...repaired, blockers: [.../* @__PURE__ */ new Set([...review.blockers ?? [], ...repaired.blockers ?? []])] };
        try {
          if (rootLearning = materializeControllerLearningCandidates({
            run,
            decision: review.decision,
            correctionCycle: (run.correction_cycles ?? 0) + 1,
            receiptIds: (repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : [])).map((receipt) => receipt?.request_id).filter(Boolean)
          }), review.decision && !review.hard_error) builtReview = this.controllerWorkReview(run, candidate, review);
          else throw new Error("repair reviewer did not return a valid decision");
        } catch (secondError) {
          review = {
            ...review,
            decision: null,
            blockers: [.../* @__PURE__ */ new Set([...review.blockers ?? [], `review-input-invalid-after-one-repair:${secondError.message}; repeat Review in this Run`])]
          }, rootLearning = { correction_id: null, candidates: [] };
        }
      }
    let rootDecision = builtReview?.controller_decision ?? null, sourceBaselineAtDelivery = repositoryBaseline(this.workspaceRoot), sourceDriftAtDelivery = currentBaselineDiffers(run.source_baseline_at_start ?? run.baseline, sourceBaselineAtDelivery);
    if (run = this.update(runId, (draft) => ({
      ...draft,
      root_review_complete: !!review.decision,
      review: rootDecision,
      learning_candidates: mergeControllerLearningCandidates(draft.learning_candidates, rootLearning.candidates),
      receipts: [...draft.receipts, ...reviewReceipts],
      phase: "root-review",
      evidence_grade: aggregate.grade,
      source_baseline_at_delivery: sourceBaselineAtDelivery,
      source_drift_at_delivery: sourceDriftAtDelivery,
      integration_warnings: sourceDriftAtDelivery ? ["source-worktree-drift-may-conflict-with-human-integration"] : []
    }), "root-reviewed"), builtReview && (run = this.materializeControllerReview(run, candidate, builtReview)), rootDecision?.next_action === "correct") {
      let actorReceipts = learningSourceReceiptIds(rootLearning.candidates);
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
      let materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized2.run, [...review.blockers, ...materialized2.blocker ? [materialized2.blocker] : []]);
    }
    let budgetBlockers = budgetBoundaryBlockers(run);
    if (budgetBlockers.length > 0) {
      let materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized2.run, [...budgetBlockers, ...materialized2.blocker ? [materialized2.blocker] : []]);
    }
    if (!review.decision) return this.wait(run, review.blockers);
    if (aggregate.delivery === "blocked") {
      let materialized2 = this.materializeDeliveryEvidence(run, candidate);
      return this.update(runId, (draft) => ({ ...draft, lifecycle: "blocked", delivery_status: "blocked", blockers: ["known-check-failure", ...materialized2.blocker ? [materialized2.blocker] : []], next_action: "correct-or-replan" }), "delivery-blocked");
    }
    if (["correct", "clarify", "replan", "retry-review"].includes(rootDecision.next_action)) return this.wait(run, [`root-review-${rootDecision.next_action}`]);
    let verified = aggregate.delivery === "verified" && rootDecision.assessment === "achieved" && rootDecision.delivery_status === "verified", deliveryStatus = verified ? "verified" : "provisional";
    deliveryStatus === "provisional" && run.effective_profile === "autonomous" && (run = this.update(runId, (draft) => ({ ...draft, effective_profile: "supervised", downgraded: !0, downgrade_reason: "evidence-shortfall" }), "profile-auto-downgraded"));
    let materialized = this.materializeDeliveryEvidence(run, candidate);
    if (run = materialized.run, materialized.blocker) return this.block(run, [materialized.blocker]);
    if (deliveryStatus === "verified" && run.effective_profile === "autonomous") {
      let achieved = this.update(runId, (draft) => ({ ...draft, lifecycle: "achieved", delivery_status: "verified", delivery_accepted: !1, phase: "achieved", next_action: "none", blockers: [] }), "run-achieved");
      return this.store.appendDecision(runId, {
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
      }), achieved;
    }
    let delivery = this.update(runId, (draft) => ({ ...draft, lifecycle: "waiting-human", delivery_status: deliveryStatus, phase: deliveryStatus === "verified" ? "delivery-ready-verified" : "delivery-ready-provisional", next_action: deliveryStatus === "verified" ? "accept-verified" : "accept-provisional", blockers: [] }), "delivery-ready");
    return this.store.appendDecision(runId, {
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
    }), delivery;
  }
  deliveryEvidenceCandidate(run, evidence) {
    let snapshot2 = repositoryBaseline(run.worktree?.path ?? this.workspaceRoot), paths = run.worktree?.path ? changedPathsBetween(run.worktree.path, run.worktree.human_baseline, snapshot2.head) : changedPaths(this.workspaceRoot), supplied = new Map(evidence.map((entry) => [entry.check_id, entry])), completeEvidence = run.strategy.checks.filter((check) => check.Required === "yes").map((check) => supplied.get(check["Check ID"]) ?? {
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
    return { ...buildDeliveryEvidence({
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
    }), delivery_commit: snapshot2.head, delivered_paths: paths };
  }
  controllerWorkReview(run, candidate, review) {
    if (!review?.decision) throw new Error("controller work-review requires one valid semantic reviewer decision");
    let reviewInput = controllerReviewInput(run, review.decision, review.auditor_reports ?? []), built = buildWorkReview({
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
    let artifactMap = /* @__PURE__ */ new Map();
    for (let entry of [
      ...run.workflow_artifacts ?? [],
      { label: candidate.fields.id, text: candidate.artifact },
      { label: review.fields.id, text: review.artifact, builder_provenance: review.provenance }
    ]) {
      let artifact = entry.text.match(/^id:\s*([^\s]+)$/m)?.[1] ?? entry.label, prior = artifactMap.get(artifact);
      if (prior && prior.text !== entry.text) throw new Error(`controller task-local artifact ${artifact} conflicts with immutable bytes`);
      artifactMap.set(artifact, { label: artifact, text: entry.text, ...entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {} });
    }
    let workflowArtifacts = [...artifactMap.values()], handoffEntries = [
      { label: run.plan.fields.id, text: run.root_plan_text },
      ...workflowArtifacts.map((entry) => ({ label: entry.label, text: entry.text, ...entry.builder_provenance ? { provenance: entry.builder_provenance } : {} }))
    ], handoffPersisted = !0, handoffWarning = null;
    try {
      this.handoffStore.record(handoffEntries);
    } catch (error) {
      handoffPersisted = !1, handoffWarning = `optional controller review handoff unavailable: ${error.message}; task-local Review remains valid`;
    }
    try {
      createContentAddressedHandoffStore(run.root_plan_text, this.pluginRoot).record(handoffEntries), rememberContentAddressedRoot(run.root_plan_text, this.pluginRoot), handoffPersisted = !0, handoffWarning = null;
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
    if (run.delivery_evidence_id === candidate.fields.id && run.delivery_evidence_hash === candidate.artifact_hash && run.delivery_evidence_artifact === candidate.artifact)
      return { run, blocker: null };
    let handoffPersisted = !0, handoffWarning = null, blocker = null, entries = [
      { label: run.plan.fields.id, text: run.root_plan_text },
      { label: candidate.fields.id, text: candidate.artifact }
    ];
    try {
      this.handoffStore.record(entries);
    } catch (error) {
      handoffPersisted = !1, /conflict|invalid|corrupt|incompatible|multiple|ambiguous|stale/i.test(error.message) ? blocker = `delivery-evidence-handoff-conflict:${error.message}` : handoffWarning = `delivery evidence handoff unavailable: ${error.message}`;
    }
    if (run.root_plan_text)
      try {
        createContentAddressedHandoffStore(run.root_plan_text, this.pluginRoot).record(entries), rememberContentAddressedRoot(run.root_plan_text, this.pluginRoot), blocker || (handoffPersisted = !0, handoffWarning = null);
      } catch {
      }
    return { run: this.update(run.run_id, (draft) => ({
      ...draft,
      delivery_evidence_id: candidate.fields.id,
      delivery_evidence_hash: candidate.artifact_hash,
      delivery_evidence_artifact: candidate.artifact,
      delivery_commit: candidate.delivery_commit,
      delivered_paths: candidate.delivered_paths,
      handoff_persisted: handoffPersisted,
      integration_warnings: [.../* @__PURE__ */ new Set([...draft.integration_warnings ?? [], ...handoffWarning ? [handoffWarning] : []])]
    }), "delivery-evidence-materialized"), blocker };
  }
  acceptDelivery(runId, acceptance) {
    let run = this.store.get(runId);
    if (!["verified", "provisional"].includes(acceptance)) throw new Error("acceptance must be verified or provisional");
    if (run.lifecycle !== "waiting-human" || run.next_action !== (acceptance === "verified" ? "accept-verified" : "accept-provisional")) throw new Error("delivery is not awaiting this acceptance");
    if (run.delivery_status !== acceptance) throw new Error(`delivery acceptance mismatch: expected ${run.delivery_status}`);
    let lifecycle = acceptance === "verified" ? "achieved" : "accepted-provisional", accepted = this.update(runId, (draft) => ({ ...draft, lifecycle, delivery_accepted: !0, accepted_as: acceptance, phase: lifecycle, next_action: "none", blockers: [] }), acceptance === "verified" ? "delivery-accepted" : "provisional-delivery-accepted");
    return this.store.appendDecision(runId, {
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
    }), accepted;
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
    let target = run.checkpoints?.at(-1)?.commit ?? run.worktree?.human_baseline ?? run.baseline.head, rollback = rollbackToCheckpoint(run.worktree.path, target), restored = this.update(run.run_id, (draft) => ({ ...draft, rollbacks: [...draft.rollbacks ?? [], { at: (/* @__PURE__ */ new Date()).toISOString(), target, ...rollback, blockers: [...new Set(blockers)] }] }), "worktree-rolled-back");
    return this.wait(restored, blockers);
  }
  usage(run) {
    return usageForRun(run);
  }
  gitDiff(worktreePath, baseline) {
    let result = spawnSync2("git", ["-C", worktreePath, "diff", baseline, "--"], { encoding: "utf8", maxBuffer: 8388608 });
    if (result.status !== 0) throw new Error(result.stderr.trim());
    return result.stdout.slice(-25e4);
  }
};

export {
  deriveWorkflowState,
  captureRepositorySnapshot,
  repositorySnapshotHash,
  validateConsumedNativeReviewReceipt,
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
