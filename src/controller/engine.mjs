import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { executionContractFromArtifactText, inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { deriveWorkflowState } from "../../scripts/derive-workflow-state.mjs";
import { evaluateAuthorization, evaluateEligibility, qualificationKey, selectWriterRoute } from "./policy.mjs";
import { resolveCapabilities } from "./capabilities.mjs";
import { CursorWorkerAdapter } from "./worker-adapter.mjs";
import { ARTIFACT_SCHEMA, assertCompatiblePreparation, classifyRunCompatibility } from "./protocol.mjs";
import { configurationHashes, expectedPlannerReceiptBlockers, plannerReceiptBlockers, planningBudgetBlockers, planningHarnessHash, planningUsage, validateRootPlanLineage } from "./planning.mjs";
import { aggregateEvidence, calibrateRecipeEvidence, checkEvidence, createInitialStrategy, reviseStrategy, strategyHash, TASK_RECIPES } from "./strategy.mjs";
import { auditVerificationProfile } from "./verification-profile.mjs";
import { assertContainedPath, changedPaths, changedPathsBetween, checkpoint, createComparisonBaselineWorktree, createRunWorktree, detectDependencyChanges, parseHostCommand, repositoryBaseline, rollbackToCheckpoint, runHostCheck } from "./worktree.mjs";
import { ArtifactHandoffStore, createContentAddressedHandoffStore, rememberContentAddressedRoot } from "./artifact-handoff.mjs";
import { buildDeliveryEvidence } from "./delivery-closeout.mjs";
import { buildWorkReview } from "./work-review-builder.mjs";
import {
  controllerLearningCandidateSemanticHash,
  controllerLearningDecisionHash,
  controllerLearningEventRefs,
  deliveryPathsHash,
  materializeControllerLearningCandidates,
  mergeControllerLearningCandidates,
  normalizeDecisionLearningCandidates,
  runIntegrityBlockers,
} from "./learning-context.mjs";

const profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 });
const secretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function learningSourceHashes(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? [])
    .flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_decision_hash))))];
}

function learningSourceReceiptIds(candidates = []) {
  return [...new Set(candidates.flatMap((candidate) => (candidate.lineage ?? [])
    .flatMap((lineage) => (lineage.source_bindings ?? []).map((binding) => binding.source_receipt_id))))].sort();
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

function reviewerSummary(decision) {
  if (typeof decision?.assessment_summary !== "string") throw new Error("review decision requires assessment_summary as a string");
  const value = decision.assessment_summary.trim();
  if (!value) throw new Error("review decision requires assessment_summary");
  return value;
}

function reviewerSnapshot(decision) {
  if (!["consistent", "contradicted", "incomplete"].includes(decision?.snapshot_assessment)) throw new Error("review decision requires a valid snapshot_assessment");
  if (typeof decision?.snapshot_summary !== "string") throw new Error("review decision requires snapshot_summary as a string");
  const summary = decision.snapshot_summary.trim();
  if (!summary) throw new Error("review decision requires snapshot_summary");
  return { assessment: decision.snapshot_assessment, summary };
}

function controllerReviewInput(run, decision, auditorReports = []) {
  if (!Array.isArray(decision?.findings)) throw new Error("review decision requires findings as an array");
  if (!Array.isArray(decision?.missing_evidence)) throw new Error("review decision requires missing_evidence as an array");
  const findingByKey = new Map();
  for (const item of decision.findings) {
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
      summary,
    });
  }
  const keys = [...new Set(decision?.finding_keys ?? [])].sort();
  if (keys.some((key) => !findingByKey.has(key))) throw new Error("review decision finding_keys must each have one complete typed finding");
  const findings = keys.map((key) => findingByKey.get(key));
  const snapshot = reviewerSnapshot(decision);
  const input = {
    schema: 1,
    kind: "review-input",
    assessment: decision.assessment,
    recommended_action: decision.next_action,
    assessment_summary: reviewerSummary(decision),
    snapshot_assessment: snapshot.assessment,
    snapshot_summary: snapshot.summary,
    findings: findings.map(({ summary: _summary, ...finding }) => finding),
    missing_evidence: decision.missing_evidence,
    auditor_reports: auditorReports,
  };
  if (decision.next_action !== "correct") return input;
  const learning = decision.learning_candidates ?? [];
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
      evidence: finding.evidence,
    })),
    checks: requiredChecks.map((check) => ({
      key: `check-${String(check["Check ID"]).toLowerCase()}`,
      fix_keys: fixKeys,
      working_directory: check["Working Directory"] ?? "repository root",
      command_or_inspection: check["Command or Inspection"],
      expected_result: check["Expected Result"],
      required: true,
      cost_class: check["Cost Class"] ?? "standard",
      prerequisites: String(check.Prerequisites ?? "Root-authorized correction").split(",").map((item) => item.trim()).filter(Boolean),
    })),
    steps: findings.map((finding) => ({
      key: `step-${finding.key}`,
      fix_keys: [`fix-${finding.key}`],
      targets: run.strategy?.primary_targets ?? run.plan.fields.authority.allowed_roots,
      required_outcome: finding.summary,
      implementation_latitude: "Use the smallest strategy-compatible correction inside the approved Root authority.",
      completion_probe: `The mapped finding ${finding.key} is absent and all correction Checks pass.`,
      check_keys: checkKeys,
      deviation_action: "Stop and replan if the immutable Root boundary or risk must change.",
    })),
    learning_candidates: learning.map((candidate) => ({
      key: `learning-${controllerLearningCandidateSemanticHash(candidate).slice(0, 12)}`,
      finding_keys: candidate.finding_keys,
      reusable_guidance: candidate.reusable_guidance,
      candidate_targets: candidate.candidate_targets,
      confirmation_evidence: candidate.confirmation_evidence,
    })),
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
    selectionReason: result.selection_reason,
  };
}

function selectedModelsCertified(routeValidation, certifiedModels) {
  if (!Array.isArray(certifiedModels) || certifiedModels.length === 0) return false;
  return Object.entries(routeValidation.routes ?? {}).every(([role, route]) => certifiedModels.some((model) => model.role === role
    && model.id === route.model?.id
    && JSON.stringify(model.params ?? []) === JSON.stringify(route.model?.params ?? [])));
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
    if (!existsSync(candidate) || !statSync(candidate).isFile() || statSync(candidate).size > 2 * 1024 * 1024) continue;
    let source;
    try { source = readFileSync(candidate, "utf8"); } catch { continue; }
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
    usage.activeMinutes += (receipt.duration_ms ?? 0) / 60_000;
  }
  for (const receipt of run.check_receipts ?? []) usage.activeMinutes += (receipt.duration_ms ?? 0) / 60_000;
  return usage;
}

function budgetBoundaryBlockers(run) {
  return evaluateAuthorization({ plan: run.plan.fields, usage: usageForRun(run) }).blockers
    .filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
}

export class WorkflowEngine {
  constructor({ workspaceRoot, store, preparationStore, pluginRoot, stateRoot, worktreeRoot, adapterFactory, capabilitiesFactory, handoffStore } = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.store = store;
    this.preparationStore = preparationStore;
    this.pluginRoot = resolve(pluginRoot);
    this.stateRoot = resolve(stateRoot);
    this.worktreeRoot = worktreeRoot ? resolve(worktreeRoot) : null;
    this.handoffStore = handoffStore ?? new ArtifactHandoffStore(this.stateRoot, this.pluginRoot);
    this.adapterFactory = adapterFactory ?? ((run) => new CursorWorkerAdapter({ runDirectory: this.store.runDirectory(run.run_id), pluginRoot: this.pluginRoot }));
    this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }

  snapshot(run) {
    const compatibility = classifyRunCompatibility(run);
    if (!compatibility.compatible) return deriveWorkflowState({
      ...run, lifecycle: "stopped", compatibility: compatibility.compatibility,
      blockers: [...new Set([...(run.blockers ?? []), compatibility.blocker])],
    });
    return deriveWorkflowState({
      ...run,
      compatibility: compatibility.compatibility,
      root_plan_id: run.plan?.fields?.id ?? null,
      root_schema_valid: run.plan ? run.plan.fields?.schema === ARTIFACT_SCHEMA : undefined,
      intent_ready: run.plan?.fields?.intent_ready === true,
      product_aligned: Boolean(run.plan), architecture_aligned: Boolean(run.plan), program_design_aligned: Boolean(run.plan),
      slices_ready: Boolean(run.strategy?.steps?.length), strategy_revision: run.strategy?.revision ?? null,
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
    const preflightBlockers = [...new Set([...receiptBlockers, ...planningBudgetBlockers(usage, preparation.planning_budget)])];
    if (preflightBlockers.length > 0) throw new Error(`planner preflight invalid: ${preflightBlockers.join("; ")}`);

    let routeValidation;
    try { routeValidation = this.adapterFactory({ run_id: "start-preflight" }).validateProfile(preparation.route_config); }
    catch (error) { routeValidation = { verified: false, errors: [error.message] }; }
    if (!routeValidation.verified) throw new Error(`route validation failed: ${(routeValidation.errors ?? []).join("; ")}`);
    if (JSON.stringify(routeValidation.routes?.planner?.model) !== JSON.stringify(preparedAcceptedModel)) throw new Error("planner-catalog-attestation-drift");

    const strategy = createInitialStrategy(contract);
    const cert = contract.fields.certification ?? {};
    const key = qualificationKey({
      taskClass: strategy.task_class,
      verificationProfileHash: cert.verification_profile_hash,
      routePoolHash: cert.route_pool_hash ?? preparation.route_hash,
      certifiedRegion: cert.certified_region,
    });
    const sourceNow = repositoryBaseline(this.workspaceRoot);
    const capabilities = this.capabilitiesFactory({ model_catalog_verified: true, expected_route_hash: preparation.route_hash, expected_planning_harness_hash: preparation.harness_hash });
    const creation = this.store.createFromPreparation(this.preparationStore, { preparationId, approvedRootHash, expectedPreparationRevision, idempotencyKey }, {
      workspace_root: this.workspaceRoot, goal: contract.fields.goal,
      requested_profile: preparation.requested_profile, effective_profile: preparation.requested_profile,
      route_profile: preparation.route_profile, route_config: preparation.route_config, route_validation: routeValidation,
      base_config_errors: [], config_errors: routeValidation.errors ?? [], project_policy: preparation.project_policy, capabilities,
      root_plan_text: preparation.root_plan_text, root_plan_hash: preparation.root_plan_hash,
      root_authoritative_projection_hash: preparation.root_authoritative_projection_hash, intent_hash: preparation.root_authoritative_projection_hash,
      plan: contract, strategy, qualification_key: key,
      plan_status: "ready", plan_approved: true,
      root_approval: { preparation_id: preparation.preparation_id, preparation_revision: preparation.revision, approved_root_hash: preparation.root_plan_hash, approved_at: new Date().toISOString() },
      planning_receipts: structuredClone(preparation.planner_receipts), planning_usage: usage,
      lifecycle: "waiting-human", phase: "intent-ready", next_action: "eligibility-preflight",
      baseline: preparation.baseline, source_drift_at_start: currentBaselineDiffers(preparation.baseline, sourceNow), source_baseline_at_start: sourceNow,
      policy_hash: preparation.policy_hash, harness_hash: preparation.harness_hash, route_hash: preparation.route_hash, config_hash: preparation.config_hash,
      execution_started: false, evidence_entries: [], evidence_grade: null, delivery_status: null, receipts: [], blockers: [],
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
    try { routeValidation = this.adapterFactory(run).validateProfile(run.route_config); }
    catch (error) { routeValidation = { verified: false, errors: [error.message] }; }
    const manifestPath = run.project_policy.verification_profile?.manifest_path;
    const verificationAudit = manifestPath
      ? auditVerificationProfile(this.workspaceRoot, manifestPath, this.pluginRoot, this.stateRoot)
      : { status: "blocked", valid: false, errors: ["verification profile not configured"] };
    const capabilities = this.capabilitiesFactory({
      model_catalog_verified: routeValidation.verified === true,
      verification_profile_certified: verificationAudit.status === "clean",
      expected_route_hash: run.route_hash, expected_planning_harness_hash: run.harness_hash,
    });
    capabilities.route_pool_certified = capabilities.route_pool_certified === true && routeValidation.verified === true;
    capabilities.route_pool_models_certified = capabilities.route_pool_models_certified === true
      || selectedModelsCertified(routeValidation, capabilities.certified_models);
    const qualifyingRuns = this.store.qualifyingHistory(run.qualification_key);
    run = this.update(runId, (draft) => ({ ...draft, route_validation: routeValidation, capabilities, verification_audit: verificationAudit, config_errors: [...(draft.base_config_errors ?? []), ...(routeValidation.errors ?? [])] }), "approval-preflight-refreshed");
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
          ...(this.worktreeRoot ? { root: this.worktreeRoot } : {}),
          snapshotPath: join(this.store.runDirectory(runId), "dirty-snapshot.json"),
        });
      } catch (error) {
        return this.block(run, [`dirty-snapshot-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, worktree, dirty_baseline_hash: worktree.dirty_snapshot_hash, lifecycle: "running", execution_started: true, phase: "baseline-verification", current_slice: draft.current_slice ?? 0, checkpoints: [{ slice_id: "HUMAN-BASELINE", commit: worktree.human_baseline, empty: !worktree.dirty }] }), "human-baseline-created");
    } else run = this.update(runId, (draft) => ({ ...draft, lifecycle: "running", execution_started: true }), "run-resumed");

    if (run.strategy.task_class === "verify-existing" && !run.comparison_baseline_worktree) {
      let comparisonBaselineWorktree;
      try {
        comparisonBaselineWorktree = createComparisonBaselineWorktree(this.workspaceRoot, runId, run.worktree.baseline.head, { ...(this.worktreeRoot ? { root: this.worktreeRoot } : {}) });
      } catch (error) {
        return this.block(run, [`comparison-baseline-blocked:${error.message}`]);
      }
      run = this.update(runId, (draft) => ({ ...draft, comparison_baseline_worktree: comparisonBaselineWorktree }), "comparison-baseline-created");
    }

    const adapter = this.adapterFactory(run);
    if (!(run.evidence_entries ?? []).some((entry) => entry.baseline_or_patched === "baseline")) {
      const baseline = this.verify(run, run.strategy.steps[0], "baseline", adapter);
      if (baseline.hard_error) return this.block(run, baseline.blockers);
      run = this.update(runId, (draft) => ({ ...draft, phase: "implementing", evidence_entries: [...(draft.evidence_entries ?? []), ...baseline.entries], receipts: [...draft.receipts, ...(baseline.receipt ? [baseline.receipt] : [])] }), "baseline-evidence-recorded");
      const budgetBlockers = budgetBoundaryBlockers(run);
      if (budgetBlockers.length > 0) return this.block(run, budgetBlockers);
    }

    const recipe = TASK_RECIPES[run.strategy.task_class];
    if (!recipe.writer_allowed) {
      if (run.strategy.task_class === "verify-existing") {
        const patched = this.verify(run, run.strategy.steps[0], "patched", adapter);
        if (patched.hard_error) return this.block(run, patched.blockers);
        run = this.update(runId, (draft) => ({ ...draft, evidence_entries: [...draft.evidence_entries, ...patched.entries], receipts: [...draft.receipts, ...(patched.receipt ? [patched.receipt] : [])] }), "candidate-evidence-recorded");
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
      run = this.update(runId, (draft) => ({ ...draft, current_slice: index + 1, more_slices: index + 1 < slices.length, phase: "strategy-ready", checkpoints: [...(draft.checkpoints ?? []), { slice_id: slices[index]["Slice ID"], ...sliceCheckpoint }] }), "slice-complete");
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
        const budgetBlockers = budgetBoundaryBlockers(run);
        return { completed: false, run: budgetBlockers.length > 0 ? this.block(run, budgetBlockers) : this.wait(run, pre.blockers) };
      }
      const routeChoice = selectWriterRoute({ plan: run.plan.fields, correctionCycle, findingRepeated: run.finding_repeated === true, alreadyEscalated: escalated });
      if (routeChoice.escalated && !escalated) { escalated = true; writerAgentId = null; }
      const role = routeChoice.role;
      const selected = routeSelection(run.route_validation, role);
      const prompt = [
        correctionCycle === 0 ? "Implement the current adaptive strategy slice." : "Correct the current worktree using the fresh review decision.",
        "Stay inside the immutable intent authority. You may adapt method and adjacent files inside allowed_roots. Do not push, create a PR, merge, deploy, or cause external effects.",
        `IMMUTABLE INTENT\n${run.plan.authoritative_projection_text}`,
        `CURRENT STRATEGY\n${JSON.stringify(run.strategy, null, 2)}`,
        `SLICE\n${JSON.stringify(slice, null, 2)}`,
        correctionCycle > 0 ? `REVIEW\n${JSON.stringify(run.review, null, 2)}` : "",
        correctionCycle > 0 && run.work_review_artifact ? `AUTHORITATIVE WORK REVIEW\n${run.work_review_artifact}` : "",
      ].filter(Boolean).join("\n\n");
      const roots = run.plan.fields.authority.allowed_roots;
      const writablePaths = roots.filter((target) => pathInside(target, run.project_policy.allowed_write_roots)).map((target) => assertContainedPath(run.worktree.path, target));
      if (writablePaths.length !== roots.length) return { completed: false, run: this.wait(run, ["intent-authority-exceeds-project-policy"]) };
      const denied = [...new Set([...run.project_policy.protected_paths, ...run.project_policy.approval_required_paths, ...run.plan.fields.authority.protected_paths, ...run.plan.fields.authority.approval_required_paths])].map((target) => assertContainedPath(run.worktree.path, target));
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
      if (run.project_policy.dependencies === "allow-listed") for (const dependency of changedDependencies) if (!run.project_policy.allowed_dependencies.includes(dependency)) authorization.blockers.push(`project-dependency-not-allow-listed:${dependency}`);
      if (containsSensitiveChange(run.worktree.path, paths)) authorization.blockers.push("secret-material-detected");
      if (!authorization.authorized || authorization.blockers.length > 0) {
        const restored = this.rollbackAndWait(run, authorization.blockers);
        const budgetBlockers = authorization.blockers.filter((blocker) => ["token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"].includes(blocker));
        return { completed: false, run: budgetBlockers.length > 0 ? this.block(restored, budgetBlockers) : restored };
      }

      const certifiedRegion = run.plan.fields.certification?.certified_region;
      const regionEscapes = certifiedRegion ? paths.filter((path) => !pathInside(path, [certifiedRegion])) : [];
      if (run.effective_profile === "autonomous" && regionEscapes.length > 0) {
        run = this.update(run.run_id, (draft) => ({
          ...draft,
          effective_profile: "supervised",
          downgraded: true,
          downgrade_reason: `certified-region-exceeded:${regionEscapes.join(",")}`,
        }), "profile-auto-downgraded");
        this.store.appendDecision(run.run_id, {
          phase: "scope",
          actor_receipt: phase.receipt.request_id,
          decision: "continue-supervised",
          reason: run.downgrade_reason,
          input_hashes: [run.intent_hash, run.strategy.strategy_hash],
          strategy_revision: run.strategy.revision,
          result: "supervised",
        });
      }

      const adjacentPaths = paths.filter((path) => !pathInside(path, run.strategy.primary_targets ?? []));
      const alreadyRecorded = new Set((run.strategy.deviations ?? []).filter((item) => item.kind === "adjacent-scope").flatMap((item) => item.paths ?? []));
      const newAdjacentPaths = adjacentPaths.filter((path) => !alreadyRecorded.has(path));
      if (newAdjacentPaths.length > 0) {
        const deviation = { id: `DEV-${run.strategy.revision + 1}`, kind: "adjacent-scope", paths: newAdjacentPaths, at: new Date().toISOString() };
        const strategy = reviseStrategy(run.strategy, { deviations: [deviation] }, { reason: `adjacent in-envelope scope: ${newAdjacentPaths.join(", ")}`, createdBy: role, authority: run.plan.fields.authority });
        run = this.update(run.run_id, (draft) => ({ ...draft, strategy }), "strategy-revised");
        this.store.appendDecision(run.run_id, {
          phase: "adapt",
          actor_receipt: phase.receipt.request_id,
          decision: "record-adjacent-scope",
          reason: strategy.rationale,
          input_hashes: [run.intent_hash, strategy.parent_hash],
          strategy_revision: strategy.revision,
          result: strategy.strategy_hash,
        });
      }

      const checkIds = String(slice["Check IDs"] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const checks = run.strategy.checks.filter((check) => correctionCycle > 0 || checkIds.length === 0 || checkIds.includes(check["Check ID"]));
      const hostReceipts = checks.map((check) => {
        if (check["Evidence Class"] !== "machine-verifiable" || check["Command or Inspection"] === "verification-profile") return { check_id: check["Check ID"], unavailable: true, reason: "verification-profile-required" };
        try { return { check_id: check["Check ID"], ...runHostCheck(run.worktree.path, parseHostCommand(check["Command or Inspection"])) }; }
        catch (error) { return { check_id: check["Check ID"], unavailable: true, reason: error.message }; }
      });
      const verificationSlice = correctionCycle > 0
        ? { ...slice, "Check IDs": checks.map((check) => check["Check ID"]).join(", ") }
        : slice;
      const verifier = this.verify(run, verificationSlice, "patched", adapter, hostReceipts);
      if (verifier.hard_error) return { completed: false, run: this.block(run, verifier.blockers) };
      const byCheck = new Map(verifier.entries.map((entry) => [entry.check_id, entry]));
      const entries = checks.map((check) => byCheck.get(check["Check ID"]) ?? checkEvidence(check, hostReceipts.find((receipt) => receipt.check_id === check["Check ID"]), "patched"));
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "slice-review", check_receipts: [...(draft.check_receipts ?? []), ...hostReceipts], evidence_entries: [...(draft.evidence_entries ?? []).filter((entry) => !(entry.baseline_or_patched === "patched" && entries.some((candidate) => candidate.check_id === entry.check_id))), ...entries], receipts: [...draft.receipts, ...(verifier.receipt ? [verifier.receipt] : [])] }), "verification-finished");
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
        try { candidate = this.deliveryEvidenceCandidate(run, patchedEvidence); }
        catch (error) { return { completed: false, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) }; }
        let built;
        try { built = this.controllerWorkReview(run, candidate, review); }
        catch (firstError) {
          const repaired = this.review(run, slice, entries, adapter, candidate.artifact, firstError.message);
          run = this.update(run.run_id, (draft) => ({ ...draft, receipts: [...draft.receipts, ...(repaired.receipt ? [repaired.receipt] : [])] }), "review-input-repair-attempted");
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
        try { candidate = this.deliveryEvidenceCandidate(run, patchedEvidence); }
        catch (error) { return { completed: false, run: this.block(run, [`delivery-closeout-invalid:${error.message}`]) }; }
        const materialized = this.materializeDeliveryEvidence(run, candidate);
        return { completed: false, run: this.update(run.run_id, (draft) => ({
          ...draft,
          lifecycle: "blocked",
          delivery_status: "blocked",
          evidence_grade: "failed",
          blockers: ["known-check-failure", ...(materialized.blocker ? [materialized.blocker] : [])],
          next_action: "correct-or-replan",
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
        receiptIds: [review.receipt?.request_id].filter(Boolean),
      });
      const learningCandidateIds = learning.candidates.map((candidate) => candidate.learning_id);
      const correctionDecision = {
        ...review.decision,
        controller_learning_correction_id: learning.correction_id,
        controller_learning_candidate_ids: learningCandidateIds,
      };
      const deviation = {
        id: `DEV-${run.strategy.revision + 1}`,
        kind: "review-correction",
        correction_id: learning.correction_id,
        finding_keys: correctionDecision.finding_keys,
        learning_candidate_ids: learningCandidateIds,
        at: new Date().toISOString(),
      };
      const parsedCorrection = inspectArtifactText(run.work_review_artifact, this.pluginRoot).artifact?.correction;
      if (!parsedCorrection?.id || parsedCorrection.id !== review.decision.correction_id) return { completed: false, run: this.wait(run, ["host-built-correction-plan-unavailable"]) };
      const correctionChecks = parsedCorrection.checks.map((check) => ({
        ...check,
        Objectives: parsedCorrection.fixes.filter((fix) => String(check["FIX IDs"]).split(",").map((item) => item.trim()).includes(fix["FIX ID"])).flatMap((fix) => String(fix["Root Objectives"]).split(",").map((item) => item.trim())).filter(Boolean).join(", "),
        "Evidence Class": "machine-verifiable",
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
        phase: "implementing",
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
        learning_candidate_refs: controllerLearningEventRefs(learning.candidates),
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
      receipt: null,
    };
    let selected;
    try { selected = routeSelection(run.route_validation, "verifier"); }
    catch (error) {
      return {
        entries: calibrateRecipeEvidence(run.strategy.task_class, [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { unavailable: true, reason: error.message }, stage))], stage, run.evidence_entries ?? []),
        receipt: null,
      };
    }
    const artifactDirectory = join(this.store.runDirectory(run.run_id), "artifacts", `strategy-${run.strategy.revision}`, stage);
    mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
    const recipe = TASK_RECIPES[run.strategy.task_class];
    const prompt = [
      `Act as a read-only verifier for the ${stage} state. Do not modify repository files.`,
      `Use task recipe ${run.strategy.task_class}: ${JSON.stringify(recipe)}.`,
      "Return one JSON object with entries. Each entry requires check_id, grade, surface, method, expected, observed, repetitions, artifact_hashes, limitations.",
      "Grades are verified|supported|partial|unavailable|failed. A reviewer opinion is not verification.",
      `INTENT\n${run.plan.authoritative_projection_text}`,
      `STRATEGY\n${JSON.stringify(run.strategy, null, 2)}`,
      `CHECKS\n${JSON.stringify(unresolved, null, 2)}`,
      `ARTIFACT DIRECTORY\n${artifactDirectory}`,
    ].join("\n\n");
    const verifierCwd = stage === "baseline" && run.strategy.task_class === "verify-existing" && run.comparison_baseline_worktree?.path
      ? run.comparison_baseline_worktree.path
      : run.worktree?.path ?? this.workspaceRoot;
    const guarded = guardReadOnlyRepository(verifierCwd, () => adapter.runPhase({ role: "verifier", ...selected, prompt, cwd: verifierCwd, verifierArtifactPaths: [artifactDirectory], configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash }));
    const phase = guarded.value;
    if (!guarded.unchanged) return {
      entries: [...hostEntries, ...unresolved.map((check) => checkEvidence(check, { passed: false, reason: "reader modified repository" }, stage))],
      receipt: { ...phase.receipt, reader_repository_unchanged: false },
      hard_error: true,
      blockers: ["reader-repository-mutation:verifier"],
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
          check_id: check["Check ID"], feature_id: item.feature_id ?? null, grade: item.grade,
          surface: item.surface ?? "repository", method: item.method ?? "verification-profile", baseline_or_patched: stage,
          expected: item.expected ?? check["Expected Result"] ?? "", observed: item.observed ?? "",
          repetitions: Number.isInteger(item.repetitions) ? item.repetitions : 0,
          artifact_hashes: Array.isArray(item.artifact_hashes) ? item.artifact_hashes.filter((value) => /^[a-f0-9]{64}$/.test(value)) : [],
          limitations: Array.isArray(item.limitations) ? item.limitations : [],
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
      `INTENT\n${run.plan.authoritative_projection_text}`,
      `STRATEGY\n${JSON.stringify(run.strategy, null, 2)}`,
      `SLICE\n${JSON.stringify(slice, null, 2)}`,
      `DIFF\n${diff}`,
      `CANDIDATE DELIVERY EVIDENCE\n${candidateEvidence ?? JSON.stringify(evidenceEntries, null, 2)}`,
      repairIssue ? `ONE REVIEW-INPUT REPAIR\nThe prior semantic response could not be normalized: ${repairIssue}. Root, Evidence, and repository work are preserved. Correct only the named semantic field and return the complete JSON again in this Run.` : "",
    ].filter(Boolean).join("\n\n");
    const guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runPhase({ role: "reviewer", ...selected, prompt, cwd: run.worktree.path, configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash }));
    const phase = guarded.value;
    if (!guarded.unchanged) return { decision: null, receipt: { ...phase.receipt, reader_repository_unchanged: false }, blockers: ["reader-repository-mutation:reviewer"], hard_error: true };
    const blockers = phaseReceiptBlockers(phase.receipt, "reviewer", run.intent_hash);
    if (!phase.response.ok) blockers.push(phase.response.error?.message ?? "reviewer-failed");
    if (blockers.length > 0) return { decision: null, receipt: phase.receipt, blockers: [...new Set(blockers)] };
    try {
      const decision = jsonDecision(phase.response.result);
      return {
        decision,
        receipt: phase.receipt,
        auditor_reports: [{ role: "delivery-auditor", assessment: decision.assessment, summary: decision.assessment_summary }],
        blockers: [],
      };
    }
    catch (error) { return { decision: null, receipt: phase.receipt, blockers: [`reviewer-invalid-decision:${error.message}`] }; }
  }

  reviewFanout(run, evidenceEntries, adapter, candidateEvidence = null, repairIssue = null) {
    if (typeof adapter.runReadOnlyFanout !== "function") return this.review(run, { "Slice ID": "ROOT" }, evidenceEntries, adapter, candidateEvidence);
    const diff = this.gitDiff(run.worktree.path, run.strategy.task_class === "verify-existing" ? run.worktree.baseline.head : run.worktree.human_baseline);
    const prompt = [
      "Independently judge the immutable intent, current strategy, diff and evidence. You are read-only.",
      "Return semantic JSON only: assessment, next_action, assessment_summary, snapshot_assessment, snapshot_summary, finding_keys, findings, missing_evidence, and learning_candidates. Each finding requires key, summary, severity, objective_ids, check_ids, evidence, reasoning, and resolution. For correct, learning_candidates is required and each item contains finding_keys, reusable_guidance, candidate_targets, and confirmation_evidence. Do not assign artifact, Correction, Check, Step, Finding, or Learning IDs. Do not upgrade evidence and never treat a known failure as provisional.",
      `INTENT\n${run.plan.authoritative_projection_text}`,
      `STRATEGY\n${JSON.stringify(run.strategy, null, 2)}`,
      `DIFF\n${diff}`,
      `CANDIDATE DELIVERY EVIDENCE\n${candidateEvidence ?? JSON.stringify(evidenceEntries, null, 2)}`,
      repairIssue ? `ONE REVIEW-INPUT REPAIR\nThe prior semantic response could not be normalized: ${repairIssue}. Root, Evidence, and repository work are preserved. Correct only the named semantic field and return the complete JSON again in this Run.` : "",
    ].filter(Boolean).join("\n\n");
    const phases = ["reviewer", "investigator"].map((role) => ({
      role, ...routeSelection(run.route_validation, role), prompt, cwd: run.worktree.path,
      configurationHash: run.route_hash, artifactProjectionHash: run.intent_hash,
    }));
    let results;
    try {
      const guarded = guardReadOnlyRepository(run.worktree.path, () => adapter.runReadOnlyFanout(phases));
      results = guarded.value;
      if (!guarded.unchanged) return { decision: null, receipts: results.map((result) => ({ ...result.receipt, reader_repository_unchanged: false })), blockers: ["reader-repository-mutation:fanout"], hard_error: true };
    }
    catch (error) { return { decision: null, receipt: null, receipts: [], blockers: [`read-fanout-failed:${error.message}`] }; }
    const decisionRecords = [];
    const blockers = [];
    for (const [index, result] of results.entries()) {
      const role = phases[index].role;
      const receiptErrors = phaseReceiptBlockers(result.receipt, role, run.intent_hash);
      if (!result.response.ok) receiptErrors.push(result.response.error?.message ?? `${role}-failed`);
      if (receiptErrors.length > 0) { blockers.push(...receiptErrors); continue; }
      try { decisionRecords.push({ role, decision: jsonDecision(result.response.result), receipt: result.receipt }); }
      catch (error) { blockers.push(`${role}-invalid-decision:${error.message}`); }
    }
    if (decisionRecords.length === 0) return { decision: null, receipts: results.map((result) => result.receipt), blockers: [...new Set(blockers)] };
    const actionRank = { replan: 6, clarify: 5, correct: 4, "retry-review": 3, "accept-provisional": 2, none: 1 };
    const selected = decisionRecords.toSorted((left, right) => actionRank[right.decision.next_action] - actionRank[left.decision.next_action])[0].decision;
    const bothAchieved = decisionRecords.length === 2 && decisionRecords.every(({ decision }) => decision.assessment === "achieved" && decision.next_action === "none");
    const learningBySemanticIdentity = new Map();
    if (selected.next_action === "correct") {
      for (const { decision: sourceDecision, receipt } of decisionRecords.filter(({ decision }) => decision.next_action === "correct")) {
        for (const candidate of sourceDecision.learning_candidates ?? []) {
          const key = controllerLearningCandidateSemanticHash(candidate);
          const sourceBinding = {
            source_receipt_id: receipt.request_id,
            source_decision_hash: controllerLearningDecisionHash(sourceDecision, candidate),
          };
          const prior = learningBySemanticIdentity.get(key);
          if (!prior) {
            learningBySemanticIdentity.set(key, { ...candidate, source_bindings: [sourceBinding] });
            continue;
          }
          prior.source_bindings = [...new Map([...prior.source_bindings, sourceBinding].map((binding) => [`${binding.source_receipt_id}:${binding.source_decision_hash}`, binding])).values()]
            .toSorted((left, right) => left.source_receipt_id.localeCompare(right.source_receipt_id));
        }
      }
    }
    const learningCandidates = [...learningBySemanticIdentity.values()];
    const decision = {
      ...selected,
      assessment: bothAchieved ? "achieved" : selected.assessment === "achieved" ? "provisional" : selected.assessment,
      delivery_status: bothAchieved ? "verified" : selected.delivery_status === "blocked" ? "blocked" : "provisional",
      next_action: bothAchieved ? "none" : selected.next_action === "none" ? "accept-provisional" : selected.next_action,
      finding_keys: [...new Set(decisionRecords.flatMap(({ decision: item }) => item.finding_keys ?? []))].toSorted(),
      findings: decisionRecords.flatMap(({ decision: item }) => item.findings ?? []),
      learning_candidates: learningCandidates,
      agreement: bothAchieved ? "consensus" : decisionRecords.length === 2 ? "contested" : "single-valid-review",
    };
    return {
      decision,
      receipts: results.map((result) => result.receipt),
      auditor_reports: decisionRecords.map(({ role, decision: sourceDecision }) => ({
        role: role === "investigator" ? "risk-auditor" : "delivery-auditor",
        assessment: sourceDecision.assessment,
        summary: sourceDecision.assessment_summary,
      })),
      blockers,
    };
  }

  finalReview(runId) {
    let run = this.store.get(runId);
    const authorization = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
    if (!authorization.authorized) {
      const budgetBlockers = budgetBoundaryBlockers(run);
      return budgetBlockers.length > 0 ? this.block(run, budgetBlockers) : this.wait(run, authorization.blockers);
    }
    const adapter = this.adapterFactory(run);
    const patched = (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "patched");
    const evidence = patched.length > 0 ? patched : (run.evidence_entries ?? []).filter((entry) => entry.baseline_or_patched === "baseline");
    const aggregate = aggregateEvidence(evidence);
    let candidate;
    try { candidate = this.deliveryEvidenceCandidate(run, evidence); }
    catch (error) { return this.block(run, [`delivery-closeout-invalid:${error.message}`]); }
    let review = this.reviewFanout(run, evidence, adapter, candidate.artifact);
    let reviewReceipts = review.receipts ?? (review.receipt ? [review.receipt] : []);
    let rootLearning = materializeControllerLearningCandidates({
      run,
      decision: review.decision,
      correctionCycle: (run.correction_cycles ?? 0) + 1,
      receiptIds: reviewReceipts.map((receipt) => receipt?.request_id).filter(Boolean),
    });
    let builtReview = null;
    if (review.decision && !review.hard_error) {
      try { builtReview = this.controllerWorkReview(run, candidate, review); }
      catch (firstError) {
        const repaired = this.reviewFanout(run, evidence, adapter, candidate.artifact, firstError.message);
        reviewReceipts = [...reviewReceipts, ...(repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : []))];
        review = { ...repaired, blockers: [...new Set([...(review.blockers ?? []), ...(repaired.blockers ?? [])])] };
        try {
          rootLearning = materializeControllerLearningCandidates({
            run,
            decision: review.decision,
            correctionCycle: (run.correction_cycles ?? 0) + 1,
            receiptIds: (repaired.receipts ?? (repaired.receipt ? [repaired.receipt] : [])).map((receipt) => receipt?.request_id).filter(Boolean),
          });
          if (review.decision && !review.hard_error) builtReview = this.controllerWorkReview(run, candidate, review);
          else throw new Error("repair reviewer did not return a valid decision");
        } catch (secondError) {
          review = {
            ...review,
            decision: null,
            blockers: [...new Set([...(review.blockers ?? []), `review-input-invalid-after-one-repair:${secondError.message}; repeat Review in this Run`])],
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
      integration_warnings: sourceDriftAtDelivery ? ["source-worktree-drift-may-conflict-with-human-integration"] : [],
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
        learning_candidate_refs: controllerLearningEventRefs(rootLearning.candidates),
      });
    }
    if (review.hard_error) {
      const materialized = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized.run, [...review.blockers, ...(materialized.blocker ? [materialized.blocker] : [])]);
    }
    const budgetBlockers = budgetBoundaryBlockers(run);
    if (budgetBlockers.length > 0) {
      const materialized = this.materializeDeliveryEvidence(run, candidate);
      return this.block(materialized.run, [...budgetBlockers, ...(materialized.blocker ? [materialized.blocker] : [])]);
    }
    if (!review.decision) return this.wait(run, review.blockers);
    if (aggregate.delivery === "blocked") {
      const materialized = this.materializeDeliveryEvidence(run, candidate);
      return this.update(runId, (draft) => ({ ...draft, lifecycle: "blocked", delivery_status: "blocked", blockers: ["known-check-failure", ...(materialized.blocker ? [materialized.blocker] : [])], next_action: "correct-or-replan" }), "delivery-blocked");
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
        evidence_refs: [...new Set([...evidence.flatMap((entry) => entry.artifact_hashes), run.delivery_evidence_hash])].filter(Boolean),
        result: "achieved",
        delivery_evidence_hash: run.delivery_evidence_hash,
        delivery_commit: run.delivery_commit,
        delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths),
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
      evidence_refs: [...new Set([...evidence.flatMap((entry) => entry.artifact_hashes), run.delivery_evidence_hash])].filter(Boolean),
      result: delivery.lifecycle,
      delivery_evidence_hash: run.delivery_evidence_hash,
      delivery_commit: run.delivery_commit,
      delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths),
    });
    return delivery;
  }

  deliveryEvidenceCandidate(run, evidence) {
    const snapshot = repositoryBaseline(run.worktree?.path ?? this.workspaceRoot);
    const paths = run.worktree?.path
      ? changedPathsBetween(run.worktree.path, run.worktree.human_baseline, snapshot.head)
      : changedPaths(this.workspaceRoot);
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
      limitations: ["delivery stopped before this required Check could run"],
    });
    const candidate = buildDeliveryEvidence({
      rootPlanText: run.root_plan_text,
      artifacts: run.workflow_artifacts ?? [],
      checkEvidence: completeEvidence,
      changedPaths: paths,
      strategyRevision: run.strategy?.revision ?? 0,
      effectiveProfile: run.effective_profile,
      repositorySnapshot: {
        head: snapshot.head,
        working_tree: snapshot.status ? "modified" : "unchanged",
        relevant_fingerprints: `intent:${run.intent_hash};strategy:${run.strategy?.strategy_hash ?? "none"}`,
        known_failures: aggregateEvidence(completeEvidence).delivery === "blocked" ? "required Check failed" : "none",
      },
      pluginRoot: this.pluginRoot,
    });
    return { ...candidate, delivery_commit: snapshot.head, delivered_paths: paths };
  }

  controllerWorkReview(run, candidate, review) {
    if (!review?.decision) throw new Error("controller work-review requires one valid semantic reviewer decision");
    const reviewInput = controllerReviewInput(run, review.decision, review.auditor_reports ?? []);
    const built = buildWorkReview({
      rootPlanText: run.root_plan_text,
      artifacts: [...(run.workflow_artifacts ?? []), { label: candidate.fields.id, text: candidate.artifact }],
      reviewInput,
      pluginRoot: this.pluginRoot,
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
        learning_candidate_ids: built.fields.learning_candidates ?? [],
      },
    };
  }

  materializeControllerReview(run, candidate, review) {
    const artifactMap = new Map();
    for (const entry of [
      ...(run.workflow_artifacts ?? []),
      { label: candidate.fields.id, text: candidate.artifact },
      { label: review.fields.id, text: review.artifact, builder_provenance: review.provenance },
    ]) {
      const artifact = entry.text.match(/^id:\s*([^\s]+)$/m)?.[1] ?? entry.label;
      const prior = artifactMap.get(artifact);
      if (prior && prior.text !== entry.text) throw new Error(`controller task-local artifact ${artifact} conflicts with immutable bytes`);
      artifactMap.set(artifact, { label: artifact, text: entry.text, ...(entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {}) });
    }
    const workflowArtifacts = [...artifactMap.values()];
    const handoffEntries = [
      { label: run.plan.fields.id, text: run.root_plan_text },
      ...workflowArtifacts.map((entry) => ({ label: entry.label, text: entry.text, ...(entry.builder_provenance ? { provenance: entry.builder_provenance } : {}) })),
    ];
    let handoffPersisted = true;
    let handoffWarning = null;
    try { this.handoffStore.record(handoffEntries); }
    catch (error) {
      handoffPersisted = false;
      handoffWarning = `optional controller review handoff unavailable: ${error.message}; task-local Review remains valid`;
    }
    try {
      createContentAddressedHandoffStore(run.root_plan_text, this.pluginRoot).record(handoffEntries);
      rememberContentAddressedRoot(run.root_plan_text, this.pluginRoot);
      handoffPersisted = true;
      handoffWarning = null;
    } catch {
      // Controller Run state retains the complete exact chain; cross-task cache is resilience only.
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
      integration_warnings: [...new Set([...(draft.integration_warnings ?? []), ...(handoffWarning ? [handoffWarning] : [])])],
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
      { label: candidate.fields.id, text: candidate.artifact },
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
        // Shared root-content transport is best-effort; controller state handoff remains authoritative for the Run.
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
      integration_warnings: [...new Set([...(draft.integration_warnings ?? []), ...(handoffWarning ? [handoffWarning] : [])])],
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
      delivered_paths_hash: deliveryPathsHash(run.delivery_commit, run.delivered_paths),
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
      next_action: "inspect-and-replan",
    }), "hard-boundary-blocked");
  }

  rollbackAndWait(run, blockers) {
    const target = run.checkpoints?.at(-1)?.commit ?? run.worktree?.human_baseline ?? run.baseline.head;
    const rollback = rollbackToCheckpoint(run.worktree.path, target);
    const restored = this.update(run.run_id, (draft) => ({ ...draft, rollbacks: [...(draft.rollbacks ?? []), { at: new Date().toISOString(), target, ...rollback, blockers: [...new Set(blockers)] }] }), "worktree-rolled-back");
    return this.wait(restored, blockers);
  }

  usage(run) {
    return usageForRun(run);
  }

  gitDiff(worktreePath, baseline) {
    const result = spawnSync("git", ["-C", worktreePath, "diff", baseline, "--"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr.trim());
    return result.stdout.slice(-250_000);
  }
}
