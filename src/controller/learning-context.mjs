import { createHash } from "node:crypto";
import { executionContractFromArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { classifyPreparationCompatibility, classifyRunCompatibility, RUN_EVENT_SUBJECT_SCHEMA, runEventSubject } from "./protocol.mjs";
import { strategyHash } from "./strategy.mjs";
import { changedPathsBetween, workspaceDeliveryMatch } from "./worktree.mjs";

const learningIdPattern = /^LRN-[A-Za-z0-9][A-Za-z0-9-]*$/;
const findingKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const candidateKeys = new Set(["finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"]);
const candidateLimit = 16;

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonicalValue(value[key])]));
}

function stableHash(value) {
  return hash(JSON.stringify(canonicalValue(value)));
}

export function runIntegrityBlockers(run, pluginRoot) {
  const blockers = [];
  let root;
  try { root = executionContractFromArtifactText(run?.root_plan_text, pluginRoot); }
  catch (error) { return [`intent-root-unreadable:${error.message}`]; }
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

function boundedText(value, label, maximum = 4_000) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be non-empty text`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new Error(`${label} exceeds ${maximum} characters`);
  return normalized;
}

function normalizedStringArray(value, label, { maximum = 32, pattern = null, itemMaximum = 1_000 } = {}) {
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
    reusable_guidance: boundedText(candidate?.reusable_guidance, `${label} reusable_guidance`, 2_000),
    candidate_targets: normalizedStringArray(candidate?.candidate_targets, `${label} candidate_targets`, { maximum: 16, itemMaximum: 500 }),
    confirmation_evidence: boundedText(candidate?.confirmation_evidence, `${label} confirmation_evidence`, 2_000),
  };
}

function candidateIdentity(runId, rootPlanId, candidate) {
  return stableHash({ run_id: runId, root_plan_id: rootPlanId, candidate: candidatePayload(candidate) });
}

export function controllerLearningCandidateSemanticHash(candidate) {
  return stableHash(candidatePayload(candidate));
}

export function controllerLearningDecisionHash(decision, candidate) {
  return stableHash({
    assessment: decision?.assessment ?? null,
    delivery_status: decision?.delivery_status ?? null,
    next_action: decision?.next_action ?? null,
    finding_keys: unique(decision?.finding_keys).toSorted(),
    findings: decision?.findings ?? [],
    learning_candidate: candidatePayload(candidate),
  });
}

function normalizeSourceBindings(candidate, decision, receiptIds) {
  const supplied = Array.isArray(candidate?.source_bindings) ? candidate.source_bindings : null;
  const bindings = supplied ?? unique(receiptIds).map((receiptId) => ({
    source_receipt_id: receiptId,
    source_decision_hash: controllerLearningDecisionHash(decision, candidate),
  }));
  if (bindings.length === 0 || bindings.length > 16) throw new Error("controller learning candidate requires bounded reviewer provenance");
  const normalized = bindings.map((binding) => ({
    source_receipt_id: boundedText(binding?.source_receipt_id, "controller learning source receipt", 500),
    source_decision_hash: boundedText(binding?.source_decision_hash, "controller learning source decision hash", 64),
  }));
  if (normalized.some((binding) => !/^[a-f0-9]{64}$/.test(binding.source_decision_hash))) throw new Error("controller learning source decision hash is invalid");
  return [...new Map(normalized.map((binding) => [stableHash(binding), binding])).values()]
    .toSorted((left, right) => left.source_receipt_id.localeCompare(right.source_receipt_id) || left.source_decision_hash.localeCompare(right.source_decision_hash));
}

function normalizedLineageEntry(value) {
  return {
    correction_id: boundedText(value?.correction_id, "controller learning correction ID", 500),
    correction_cycle: normalizedInteger(value?.correction_cycle, "controller learning correction cycle", { minimum: 1 }),
    strategy_revision: normalizedInteger(value?.strategy_revision, "controller learning strategy revision"),
    source_bindings: normalizeSourceBindings({ source_bindings: value?.source_bindings }, null, []),
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
    lineage: (candidate?.lineage ?? []).map((entry) => normalizedLineageEntry(entry)),
  };
  if (!learningIdPattern.test(projected.learning_id)) throw new Error("controller learning candidate has an invalid learning_id");
  if (projected.source_kind !== "controller-review") throw new Error("controller learning candidate has an invalid source kind");
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(projected.root_plan_id)) throw new Error("controller learning candidate has an invalid Root ID");
  if (!/^[a-f0-9]{64}$/.test(projected.candidate_hash)) throw new Error("controller learning candidate has an invalid candidate hash");
  if (!/^cp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(projected.correction_id)) throw new Error("controller learning candidate has an invalid correction ID");
  if (projected.lineage.length === 0) throw new Error(`controller learning candidate ${projected.learning_id} has no correction lineage`);
  return projected;
}

export function normalizeDecisionLearningCandidates(value, findingKeys = [], nextAction = "none") {
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
      reusable_guidance: boundedText(candidate.reusable_guidance, `learning candidate ${index + 1} reusable_guidance`, 2_000),
      candidate_targets: candidateTargets,
      confirmation_evidence: boundedText(candidate.confirmation_evidence, `learning candidate ${index + 1} confirmation_evidence`, 2_000),
    };
  });
  const seen = new Set();
  return normalized.filter((candidate) => {
    const digest = hash(candidate);
    if (seen.has(digest)) return false;
    seen.add(digest);
    return true;
  });
}

export function materializeControllerLearningCandidates({ run, decision, correctionCycle, receiptIds = [] }) {
  const proposed = decision?.learning_candidates ?? [];
  if (decision?.next_action !== "correct") return { correction_id: null, candidates: [] };
  const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("controller learning candidates require a valid Root ID");
  const rootSuffix = rootPlanId.replace(/^wp-/, "");
  const cycle = Number.isInteger(correctionCycle) && correctionCycle > 0 ? correctionCycle : 1;
  const correctionId = `cp-${rootSuffix}-controller-${cycle}`;
  const candidates = proposed.map((candidate) => {
    const payload = candidatePayload(candidate);
    const candidateHash = candidateIdentity(run.run_id, rootPlanId, payload);
    const sourceBindings = normalizeSourceBindings(candidate, decision, receiptIds);
    const lineage = [{
      correction_id: correctionId,
      correction_cycle: cycle,
      strategy_revision: run.strategy?.revision ?? 0,
      source_bindings: sourceBindings,
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
      lineage,
    };
  });
  return { correction_id: correctionId, candidates };
}

export function mergeControllerLearningCandidates(existing = [], additions = []) {
  const merged = new Map();
  for (const candidate of [...existing, ...additions]) {
    const normalizedCandidate = projectedControllerLearningCandidate(candidate);
    const payload = candidatePayload(normalizedCandidate);
    const candidateHash = candidateIdentity(normalizedCandidate.run_id, normalizedCandidate.root_plan_id, payload);
    const expectedId = `LRN-${String(normalizedCandidate.root_plan_id).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
    if (normalizedCandidate.candidate_hash !== candidateHash || normalizedCandidate.learning_id !== expectedId) throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent content identity`);
    const lineage = normalizedCandidate.lineage;
    const first = lineage[0];
    const receiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
    if (normalizedCandidate.correction_id !== first.correction_id
      || normalizedCandidate.correction_cycle !== first.correction_cycle
      || normalizedCandidate.strategy_revision !== first.strategy_revision
      || normalizedCandidate.source_decision_hash !== first.source_bindings[0]?.source_decision_hash
      || JSON.stringify(normalizedCandidate.source_receipt_ids) !== JSON.stringify(receiptIds)) {
      throw new Error(`controller learning candidate ${normalizedCandidate.learning_id} has inconsistent correction provenance`);
    }
    const prior = merged.get(candidateHash);
    if (prior && stableHash(candidatePayload(prior)) !== stableHash(payload)) throw new Error(`controller learning candidate ${candidate.learning_id} conflicts with its prior record`);
    if (!prior) {
      merged.set(candidateHash, normalizedCandidate);
      continue;
    }
    const combinedLineage = [...new Map([...prior.lineage, ...lineage].map((entry) => [stableHash(entry), entry])).values()]
      .toSorted((left, right) => left.correction_cycle - right.correction_cycle || left.correction_id.localeCompare(right.correction_id));
    const sourceReceiptIds = unique(combinedLineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
    const primary = combinedLineage[0];
    merged.set(candidateHash, {
      ...prior,
      correction_id: primary.correction_id,
      correction_cycle: primary.correction_cycle,
      strategy_revision: primary.strategy_revision,
      lineage: combinedLineage,
      source_receipt_ids: sourceReceiptIds,
      source_decision_hash: primary.source_bindings[0].source_decision_hash,
    });
  }
  return [...merged.values()];
}

export function controllerLearningEventRefs(candidates = []) {
  return candidates.flatMap((candidate) => (candidate.lineage ?? []).map((lineage) => ({
    learning_id: candidate.learning_id,
    candidate_hash: candidate.candidate_hash,
    run_id: candidate.run_id,
    root_plan_id: candidate.root_plan_id,
    correction_id: lineage.correction_id,
    correction_cycle: lineage.correction_cycle,
    strategy_revision: lineage.strategy_revision,
    source_bindings: lineage.source_bindings,
  }))).toSorted((left, right) => left.learning_id.localeCompare(right.learning_id) || left.correction_cycle - right.correction_cycle);
}

export function deliveryPathsHash(deliveryCommit, deliveredPaths) {
  return stableHash({ delivery_commit: deliveryCommit, delivered_paths: unique(deliveredPaths).toSorted() });
}

export function verifyEventChain(events = []) {
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
  const expectedSubjectValid = expectedSubject.run_id === run.run_id
    && /^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(expectedSubject.root_plan_id))
    && /^[a-f0-9]{64}$/.test(String(expectedSubject.intent_hash))
    && ["supervised", "autonomous"].includes(expectedSubject.effective_profile);
  const projectionFields = ["delivery_evidence_hash", "delivery_commit", "delivered_paths_hash"];
  return events.some((event) => {
    if (event.type !== "decision"
      || event.payload?.result !== requiredResult
      || !event.payload?.evidence_refs?.includes(run.delivery_evidence_hash)) return false;
    const hasProjectionBinding = projectionFields.some((field) => Object.hasOwn(event.payload ?? {}, field));
    const projectionMatches = event.payload?.delivery_evidence_hash === run.delivery_evidence_hash
      && event.payload?.delivery_commit === run.delivery_commit
      && event.payload?.delivered_paths_hash === expectedPathsHash;
    const hasSubject = Object.hasOwn(event, "subject");
    const subjectMatches = expectedSubjectValid && hasSubject && stableHash(event.subject) === stableHash(expectedSubject);
    if (subjectRequired || hasSubject) return projectionMatches && subjectMatches;
    return allowUnboundLegacy && legacySubjectAbsent && (projectionMatches || !hasProjectionBinding);
  });
}

function reviewerReceiptConfirmed(run, receiptId) {
  const matches = (run.receipts ?? []).filter((receipt) => receipt?.request_id === receiptId);
  if (matches.length !== 1) return false;
  const [receipt] = matches;
  return ["reviewer", "investigator"].includes(receipt.phase)
    && receipt.model_attested === true
    && receipt.status === "finished"
    && receipt.reader_repository_unchanged !== false
    && typeof receipt.agent_id === "string" && receipt.agent_id !== ""
    && Number.isFinite(receipt.duration_ms) && receipt.duration_ms >= 0
    && Number.isFinite(receipt.usage?.totalTokens) && receipt.usage.totalTokens >= 0
    && Number.isFinite(receipt.cost_usd) && receipt.cost_usd >= 0
    && receipt.artifact_projection_hash === run.intent_hash;
}

function controllerCandidateConfirmed(candidate, { eligible, run, events, chainValid, deliveredPaths }) {
  if (!eligible || !chainValid) return false;
  let projected;
  try { projected = projectedControllerLearningCandidate(candidate); }
  catch { return false; }
  const payload = candidatePayload(projected);
  const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
  const candidateHash = candidateIdentity(run.run_id, rootPlanId, payload);
  const expectedId = `LRN-${String(rootPlanId).replace(/^wp-/, "")}-${candidateHash.slice(0, 12)}`;
  if (projected.run_id !== run.run_id || projected.root_plan_id !== rootPlanId || projected.candidate_hash !== candidateHash || projected.learning_id !== expectedId) return false;
  const lineage = projected.lineage;
  const first = lineage[0];
  const expectedReceiptIds = unique(lineage.flatMap((entry) => entry.source_bindings.map((binding) => binding.source_receipt_id))).toSorted();
  if (projected.correction_id !== first.correction_id
    || projected.correction_cycle !== first.correction_cycle
    || projected.strategy_revision !== first.strategy_revision
    || projected.source_decision_hash !== first.source_bindings[0]?.source_decision_hash
    || JSON.stringify(projected.source_receipt_ids) !== JSON.stringify(expectedReceiptIds)) return false;
  const correctionLinked = lineage.every((entry) => {
    const expectedRef = controllerLearningEventRefs([{ ...projected, lineage: [entry] }])[0];
    const sourceReceiptIds = entry.source_bindings.map((binding) => binding.source_receipt_id).toSorted();
    return events.some((event) => event.type === "decision"
      && event.payload?.correction_id === entry.correction_id
      && event.payload?.learning_candidate_ids?.includes(projected.learning_id)
      && sourceReceiptIds.every((receiptId) => (event.payload?.actor_receipts ?? []).includes(receiptId))
      && (event.payload?.learning_candidate_refs ?? []).some((reference) => stableHash(reference) === stableHash(expectedRef)));
  });
  const provenanceAttested = expectedReceiptIds.every((receiptId) => reviewerReceiptConfirmed(run, receiptId));
  const evidenceLinked = typeof run.delivery_evidence_hash === "string"
    && typeof run.delivery_commit === "string"
    && terminalDeliveryEvent(run, events, deliveredPaths);
  const finalFindings = new Set(run.review?.finding_keys ?? []);
  return correctionLinked && provenanceAttested && evidenceLinked && projected.finding_keys.every((key) => !finalFindings.has(key));
}

export function deriveControllerLearningContext({ run, events = [], workspaceRoot, pluginRoot, sourceBinding = null }) {
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
    try { storedPaths = normalizedStringArray(run.delivered_paths, "controller delivered_paths", { maximum: 10_000, itemMaximum: 4_000 }); }
    catch { blockers.push("controller-delivery-paths-invalid"); }
  }
  let deliveredPaths = null;
  if (!deliveryCommit || !humanBaseline) blockers.push("controller-delivery-fingerprint-unavailable");
  if (deliveryCommit && humanBaseline) {
    try {
      deliveredPaths = changedPathsBetween(workspaceRoot, humanBaseline, deliveryCommit);
      if (deliveredPaths.length === 0) blockers.push("controller-delivery-paths-empty");
      if (storedPaths && JSON.stringify(storedPaths) !== JSON.stringify(deliveredPaths)) blockers.push("controller-delivery-paths-mismatch");
    }
    catch { blockers.push("controller-delivery-paths-unavailable"); }
  }
  let workspaceMatch = { status: "unverifiable", matched: false, paths: deliveredPaths ?? [] };
  if (deliveryCommit && deliveredPaths) {
    workspaceMatch = workspaceDeliveryMatch(workspaceRoot, deliveryCommit, deliveredPaths);
    if (!workspaceMatch.matched) blockers.push(`controller-delivery-${workspaceMatch.status}`);
  }
  if (chain.valid && deliveredPaths && !terminalDeliveryEvent(run, events, deliveredPaths, { allowUnboundLegacy: true })) blockers.push("controller-delivery-event-unconfirmed");

  const projectedCandidates = [];
  for (const candidate of run.learning_candidates ?? []) {
    try { projectedCandidates.push(projectedControllerLearningCandidate(candidate)); }
    catch { blockers.push("controller-learning-candidate-invalid"); }
  }
  const eligible = blockers.length === 0;
  const candidates = projectedCandidates.map((candidate) => ({
    ...candidate,
    evidence_confirmed: controllerCandidateConfirmed(candidate, { eligible, run, events, chainValid: chain.valid, deliveredPaths: deliveredPaths ?? [] }),
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
    source_binding: sourceBinding?.confirmed === true
      ? { status: "confirmed", kind: sourceBinding.kind ?? "ephemeral-receipt" }
      : { status: "unconfirmed", kind: sourceBinding?.kind ?? null },
    candidates,
  };
}

export function derivePreparationLearningContext(preparation) {
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
    candidates: [],
  };
}
