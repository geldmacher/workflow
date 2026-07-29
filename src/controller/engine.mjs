import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { executionContractFromArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { deriveWorkflowState } from "../../scripts/derive-workflow-state.mjs";
import { evaluateAuthorization, evaluateEligibility, selectWriterRoute } from "./policy.mjs";
import { resolveCapabilities } from "./capabilities.mjs";
import { CursorWorkerAdapter } from "./worker-adapter.mjs";
import { ARTIFACT_SCHEMA, classifyRunCompatibility } from "./protocol.mjs";
import { assertCompatiblePreparation } from "./protocol.mjs";
import { configurationHashes, expectedPlannerReceiptBlockers, plannerReceiptBlockers, planningBudgetBlockers, planningHarnessHash, planningUsage } from "./planning.mjs";
import { assertContainedPath, changedPaths, checkpoint, createRunWorktree, detectDependencyChanges, parseHostCommand, repositoryBaseline, rollbackToCheckpoint, runHostCheck } from "./worktree.mjs";

const profileRank = Object.freeze({ manual: 0, "auto-gated": 1, "unattended-eligible": 2 });
const secretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];

function boolCell(value) {
  return /^(?:yes|true|required)$/i.test(String(value ?? "").trim());
}

function jsonDecision(text) {
  const fenced = String(text).match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? String(text).slice(String(text).indexOf("{"), String(text).lastIndexOf("}") + 1);
  const value = JSON.parse(candidate);
  if (!["achieved", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"].includes(value.assessment)) throw new Error("review decision has invalid assessment");
  if (!["none", "correct", "clarify", "replan", "retry-review"].includes(value.next_action)) throw new Error("review decision has invalid next_action");
  if (!Array.isArray(value.finding_keys)) throw new Error("review decision requires finding_keys");
  return value;
}

function routeReceipt(validation, role) {
  const result = validation.routes?.[role];
  if (!result?.valid) throw new Error(`route ${role} is not validated`);
  return result.model;
}

function phaseReceiptBlockers(receipt, role, expectedArtifactProjectionHash = null) {
  const blockers = [];
  if (!receipt?.model_attested) blockers.push(`${role}-model-mismatch`);
  if (typeof receipt?.request_id !== "string" || receipt.request_id === "") blockers.push(`${role}-request-id-missing`);
  if (typeof receipt?.agent_id !== "string" || receipt.agent_id === "") blockers.push(`${role}-agent-id-missing`);
  if (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) blockers.push(`${role}-duration-missing`);
  if (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) blockers.push(`${role}-token-usage-missing`);
  if (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) blockers.push(`${role}-cost-missing`);
  if (expectedArtifactProjectionHash && receipt?.artifact_projection_hash !== expectedArtifactProjectionHash) blockers.push(`${role}-artifact-projection-mismatch`);
  return blockers;
}

function withinProfile(requested, maximum) {
  return (profileRank[requested] ?? 99) <= (profileRank[maximum] ?? -1);
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

export class WorkflowEngine {
  constructor({ workspaceRoot, store, preparationStore, pluginRoot, stateRoot, adapterFactory, capabilitiesFactory } = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.store = store;
    this.preparationStore = preparationStore;
    this.pluginRoot = resolve(pluginRoot);
    this.stateRoot = resolve(stateRoot);
    this.adapterFactory = adapterFactory ?? ((run) => new CursorWorkerAdapter({ runDirectory: this.store.runDirectory(run.run_id), pluginRoot: this.pluginRoot }));
    this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }

  snapshot(run) {
    const compatibility = classifyRunCompatibility(run);
    if (!compatibility.compatible) return deriveWorkflowState({
      ...run,
      lifecycle: "stopped",
      compatibility: compatibility.compatibility,
      design_depth: null,
      blockers: [...new Set([...(run.blockers ?? []), compatibility.blocker])],
    });
    return deriveWorkflowState({
      ...run,
      compatibility: compatibility.compatibility,
      root_plan_id: run.plan?.fields?.id ?? null,
      root_schema_valid: run.plan ? run.plan.fields?.schema === ARTIFACT_SCHEMA : undefined,
      design_depth: run.plan?.fields?.design_depth ?? null,
      intent_ready: run.plan?.fields?.intent_ready === true,
      product_aligned: run.plan?.fields?.design_depth === "oneshot" || Boolean(run.plan),
      architecture_aligned: run.plan?.fields?.design_depth === "oneshot" || Boolean(run.plan),
      program_design_aligned: run.plan?.fields?.design_depth !== "full" || Boolean(run.plan),
      slices_ready: Boolean(run.plan),
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
    const currentBaseline = repositoryBaseline(this.workspaceRoot);
    if (currentBaseline.head !== preparation.baseline.head || currentBaseline.branch !== preparation.baseline.branch || currentBaseline.status !== preparation.baseline.status) throw new Error("material-repository-drift");
    if (currentBaseline.status !== "") throw new Error("repository-baseline-not-clean");
    const hashes = configurationHashes(this.workspaceRoot, preparation.route_profile);
    if (hashes.route_hash !== preparation.route_hash) throw new Error("route-configuration-drift");
    if (hashes.config_hash !== preparation.config_hash) throw new Error("planning-configuration-drift");
    if (hashes.policy_hash !== preparation.policy_hash) throw new Error("project-policy-drift");
    if (planningHarnessHash(this.pluginRoot) !== preparation.harness_hash) throw new Error("planning-harness-drift");

    const contract = executionContractFromArtifactText(preparation.root_plan_text, this.pluginRoot);
    if (contract.errors.length > 0) throw new Error(`invalid prepared root plan: ${contract.errors.join("; ")}`);
    if (contract.authoritative_projection_hash !== preparation.root_authoritative_projection_hash) throw new Error("prepared-root-authoritative-projection-mismatch");
    if (contract.fields.status !== "ready" || contract.fields.intent_ready !== true) throw new Error("prepared root plan must be ready with intent_ready true");
    if (!withinProfile(preparation.requested_profile, contract.fields.automation_profile_max)) throw new Error(`prepared root plan permits at most ${contract.fields.automation_profile_max}`);
    const usage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at);
    const receiptBlockers = (preparation.planner_receipts ?? []).flatMap(plannerReceiptBlockers);
    if (preparation.planner_receipts.length === 0) receiptBlockers.push("planner-receipt-missing");
    const preparedAcceptedModel = preparation.route_validation.routes?.planner?.model;
    for (const [index, receipt] of (preparation.planner_receipts ?? []).entries()) {
      receiptBlockers.push(...expectedPlannerReceiptBlockers(receipt, preparation, preparedAcceptedModel));
      if (receipt.agent_id !== preparation.planner_agent_id) receiptBlockers.push("planner-agent-affinity-mismatch");
      if (index === preparation.planner_receipts.length - 1
        && receipt.produced_artifact_projection_hash !== preparation.root_authoritative_projection_hash) {
        receiptBlockers.push("planner-produced-artifact-projection-mismatch");
      }
    }
    const preflightBlockers = [...new Set([...receiptBlockers, ...planningBudgetBlockers(usage, preparation.planning_budget)])];
    if (preflightBlockers.length > 0) throw new Error(`planner preflight invalid: ${preflightBlockers.join("; ")}`);

    let routeValidation;
    try { routeValidation = this.adapterFactory({ run_id: "start-preflight" }).validateProfile(preparation.route_config); }
    catch (error) { routeValidation = { verified: false, errors: [error.message] }; }
    if (!routeValidation.verified) throw new Error(`route validation failed: ${(routeValidation.errors ?? []).join("; ")}`);
    if (JSON.stringify(routeValidation.routes?.planner?.model) !== JSON.stringify(preparedAcceptedModel)) throw new Error("planner-catalog-attestation-drift");
    if (preparation.route_validation.sdk_version && routeValidation.sdk_version !== preparation.route_validation.sdk_version) throw new Error("planner-sdk-version-drift");
    const capabilities = this.capabilitiesFactory({
      model_catalog_verified: true,
      expected_route_hash: preparation.route_hash,
      expected_planning_harness_hash: preparation.harness_hash,
    });
    capabilities.model_attestation_observed = capabilities.capability_receipt?.observations?.model_configuration_exact?.verified === true
      && capabilities.attested_route_hash === preparation.route_hash;
    capabilities.harness_certified = capabilities.certified_harness_hash === preparation.harness_hash;
    const creation = this.store.createFromPreparation(this.preparationStore, {
      preparationId,
      approvedRootHash,
      expectedPreparationRevision,
      idempotencyKey,
    }, {
      workspace_root: this.workspaceRoot,
      goal: preparation.goal,
      requested_profile: preparation.requested_profile,
      effective_profile: preparation.requested_profile,
      route_profile: preparation.route_profile,
      route_config: preparation.route_config,
      planning_preflight_budget: preparation.planning_budget,
      route_validation: routeValidation,
      base_config_errors: [],
      config_errors: routeValidation.errors ?? [],
      project_policy: preparation.project_policy,
      capabilities,
      root_plan_text: preparation.root_plan_text,
      root_plan_hash: preparation.root_plan_hash,
      root_authoritative_projection_hash: preparation.root_authoritative_projection_hash,
      plan: contract,
      plan_status: "ready",
      plan_approved: true,
      root_approval: {
        preparation_id: preparation.preparation_id,
        preparation_revision: preparation.revision,
        approved_root_hash: preparation.root_plan_hash,
        approved_at: new Date().toISOString(),
      },
      planning_receipts: structuredClone(preparation.planner_receipts),
      planning_usage: usage,
      lifecycle: "waiting-human",
      phase: "intent-ready",
      next_action: "eligibility-preflight",
      baseline: preparation.baseline,
      policy_hash: preparation.policy_hash,
      harness_hash: preparation.harness_hash,
      route_hash: preparation.route_hash,
      config_hash: preparation.config_hash,
      execution_started: false,
      receipts: [],
      blockers: [],
    });
    if (creation.duplicate) return { ...creation, run: creation.run };
    return { ...creation, run: this.approve(creation.run.run_id) };
  }

  update(runId, mutator, eventType) {
    const current = this.store.get(runId);
    return this.store.update(runId, current.revision, null, mutator, eventType);
  }

  approve(runId, { acceptDowngrade = false } = {}) {
    let run = this.store.get(runId);
    if (!run.plan) throw new Error("run has no valid root plan");
    if (!withinProfile(run.requested_profile, run.plan.fields.automation_profile_max)) throw new Error(`root plan permits at most ${run.plan.fields.automation_profile_max}`);
    let routeValidation;
    try { routeValidation = this.adapterFactory(run).validateProfile(run.route_config); }
    catch (error) { routeValidation = { verified: false, errors: [error.message] }; }
    const capabilities = this.capabilitiesFactory({
      model_catalog_verified: routeValidation.verified === true,
      expected_route_hash: run.route_hash,
      expected_planning_harness_hash: run.harness_hash,
    });
    capabilities.model_attestation_observed = capabilities.capability_receipt?.observations?.model_configuration_exact?.verified === true
      && capabilities.attested_route_hash === run.route_hash;
    capabilities.harness_certified = capabilities.certified_harness_hash === run.harness_hash;
    const effectiveProjectPolicy = { ...run.project_policy, qualifying_runs: this.store.qualifyingHistory() };
    run = this.update(runId, (draft) => ({
      ...draft,
      route_validation: routeValidation,
      capabilities,
      project_policy: effectiveProjectPolicy,
      config_errors: [...(draft.base_config_errors ?? []), ...(routeValidation.errors ?? [])],
    }), "approval-preflight-refreshed");
    const eligibility = evaluateEligibility({
      requestedProfile: run.requested_profile,
      plan: {
        ...run.plan.fields,
        human_review_gates: run.plan.checks.some((check) => ["human-review-required", "human-approval-required"].includes(check["Evidence Class"]))
          || run.plan.slices.some((slice) => boolCell(slice["Human review"])),
      },
      project: effectiveProjectPolicy,
      capabilities: run.capabilities,
      configErrors: run.config_errors,
    });
    if (eligibility.downgrade_pending && !acceptDowngrade) return this.update(runId, (draft) => ({ ...draft, ...eligibility, lifecycle: "waiting-human", plan_approved: true, next_action: "approve-downgrade" }), "downgrade-proposed");
    const effectiveProfile = eligibility.downgrade_pending ? "auto-gated" : eligibility.effective_profile;
    const hardBlockers = eligibility.blockers;
    if (hardBlockers.length > 0) return this.update(runId, (draft) => ({ ...draft, ...eligibility, effective_profile: effectiveProfile, lifecycle: "waiting-human", plan_approved: true, blockers: hardBlockers, next_action: "resolve-capability-blockers" }), "eligibility-blocked");
    return this.update(runId, (draft) => ({
      ...draft,
      requested_profile: run.requested_profile,
      effective_profile: effectiveProfile,
      downgrade_pending: false,
      downgrade_reason: eligibility.downgrade_reason ?? null,
      plan_approved: true,
      lifecycle: "queued",
      phase: "slice-ready",
      blockers: [],
      next_action: "implement-slice",
    }), "run-approved");
  }

  execute(runId) {
    let run = this.store.get(runId);
    if (!run.plan_approved || run.lifecycle !== "queued") throw new Error("run is not approved and queued");
    if (typeof run.plan?.authoritative_projection_text !== "string"
      || typeof run.plan?.authoritative_projection_hash !== "string"
      || run.plan.authoritative_projection_hash !== run.root_authoritative_projection_hash) {
      throw new Error("root-authoritative-projection-mismatch");
    }
    if (!run.capabilities.worker_network_isolated || !run.capabilities.sandbox_boundary_verified) throw new Error("auto execution denied without verified SDK write and worker network boundaries");
    if (!run.capabilities.sdk_secret_isolated) throw new Error("auto execution denied without verified SDK secret isolation");
    if (!run.capabilities.sdk_budget_cancel_verified) throw new Error("auto execution denied without verified SDK budget cancellation");
    const currentBaseline = repositoryBaseline(this.workspaceRoot);
    if (currentBaseline.head !== run.baseline.head || currentBaseline.status !== run.baseline.status) return this.update(runId, (draft) => ({ ...draft, lifecycle: "waiting-human", blockers: ["material-repository-drift"], next_action: "replan" }), "repository-drift");
    if (!run.worktree) {
      const worktree = createRunWorktree(this.workspaceRoot, runId);
      run = this.update(runId, (draft) => ({ ...draft, worktree, lifecycle: "running", execution_started: true, phase: "implementing", current_slice: draft.current_slice ?? 0 }), "worktree-created");
    } else run = this.update(runId, (draft) => ({ ...draft, lifecycle: "running", execution_started: true }), "run-resumed");

    const slices = run.plan.slices.length > 0 ? run.plan.slices : [{ "Slice ID": "SLICE-ROOT", Objectives: run.plan.objectives.join(", "), Dependencies: "None.", Targets: run.plan.allowedTargets.join(", "), "Observable outcome": "All approved root objectives and checks are satisfied.", "Check IDs": run.plan.checks.map((item) => item["Check ID"]).join(", "), "Human review": "no" }];
    for (let index = run.current_slice ?? 0; index < slices.length; index += 1) {
      run = this.store.get(runId);
      if (["paused", "stopped"].includes(run.lifecycle)) return run;
      const sourceNow = repositoryBaseline(this.workspaceRoot);
      if (sourceNow.head !== run.baseline.head || sourceNow.status !== run.baseline.status) return this.wait(run, ["material-repository-drift"]);
      const slice = slices[index];
      const result = this.executeSlice(run, slice, index);
      if (!result.completed) return result.run;
      run = result.run;
      const sliceCheckpoint = checkpoint(run.worktree.path, `${slice["Slice ID"]}`);
      run = this.update(runId, (draft) => ({
        ...draft,
        current_slice: index + 1,
        more_slices: index + 1 < slices.length,
        phase: "slice-ready",
        checkpoints: [...(draft.checkpoints ?? []), { slice_id: slice["Slice ID"], ...sliceCheckpoint }],
      }), "slice-complete");
      if (boolCell(slice["Human review"]) && run.effective_profile === "auto-gated") return this.update(runId, (draft) => ({ ...draft, lifecycle: "waiting-human", next_action: "approve-slice", blockers: [] }), "slice-gate");
    }
    return this.finalReview(runId);
  }

  executeSlice(run, slice, index) {
    const adapter = this.adapterFactory(run);
    let correctionCycle = 0;
    let previousFindingKeys = [];
    let writerAgentId = run.writer_agent_id ?? null;
    let escalated = run.writer_escalated === true;
    while (true) {
      const prePhaseAuthorization = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
      if (!prePhaseAuthorization.authorized) return { completed: false, run: this.wait(run, prePhaseAuthorization.blockers) };
      const routeChoice = selectWriterRoute({ plan: run.plan.fields, correctionCycle, findingRepeated: run.finding_repeated === true, alreadyEscalated: escalated });
      const role = routeChoice.role;
      if (routeChoice.escalated && !escalated) { escalated = true; writerAgentId = null; }
      const route = run.route_config[role];
      const acceptedModel = routeReceipt(run.route_validation, role);
      const prompt = correctionCycle === 0
        ? `Implement only ${slice["Slice ID"]} from the approved root plan. Do not change policy, state, .git, or protected oracle paths. Do not push, create a PR, merge, or deploy.\n\nAUTHORITATIVE ROOT PROJECTION\n${run.plan.authoritative_projection_text}\n\nSLICE\n${JSON.stringify(slice, null, 2)}`
        : `Correct the current worktree using this fresh review decision. Preserve the approved root intent and targets; you remain the writer.\n\nREVIEW\n${JSON.stringify(run.review, null, 2)}\n\nAUTHORITATIVE ROOT PROJECTION\n${run.plan.authoritative_projection_text}`;
      const rootTargets = run.plan.fields.automation_bounds.allowed_targets;
      const writablePaths = rootTargets
        .filter((target) => run.project_policy.allowed_write_roots.some((ceiling) => target === ceiling || target.startsWith(`${ceiling.replace(/\/$/, "")}/`)))
        .map((target) => assertContainedPath(run.worktree.path, target));
      if (writablePaths.length !== rootTargets.length) return { completed: false, run: this.wait(run, ["root-target-exceeds-project-policy"]) };
      const writerDeniedPaths = [...run.project_policy.protected_paths, ...run.project_policy.protected_oracles].map((target) => assertContainedPath(run.worktree.path, target));
      const phase = adapter.runPhase({ role, route, acceptedModel, prompt, cwd: run.worktree.path, agentId: writerAgentId, writerWritablePaths: writablePaths, writerDeniedPaths, configurationHash: run.route_hash, artifactProjectionHash: run.root_authoritative_projection_hash });
      writerAgentId = phase.receipt.agent_id;
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "host-verifying", writer_agent_id: writerAgentId, writer_escalated: escalated, receipts: [...draft.receipts, phase.receipt] }), "writer-finished");
      if (["paused", "stopped", "interrupted"].includes(run.lifecycle)) return { completed: false, run };
      if (phase.response.status === "interrupted") return { completed: false, run: this.update(run.run_id, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: ["worker-hard-cancelled"], next_action: "resume" }), "worker-interrupted") };
      const writerReceiptBlockers = phaseReceiptBlockers(phase.receipt, role, run.root_authoritative_projection_hash);
      if (!phase.response.ok || writerReceiptBlockers.length > 0) return { completed: false, run: this.rollbackAndWait(run, [phase.response.error?.message, ...writerReceiptBlockers].filter(Boolean)) };
      const paths = changedPaths(run.worktree.path);
      const changedDependencies = detectDependencyChanges(run.worktree.path, run.baseline.head, paths);
      const authorization = evaluateAuthorization({ plan: run.plan.fields, changedPaths: paths, changedDependencies, usage: this.usage(run) });
      if (changedDependencies.length > 0 && run.project_policy.dependencies === "deny") authorization.blockers.push("project-dependency-change-denied");
      if (run.project_policy.dependencies === "allow-listed") for (const dependency of changedDependencies) if (!run.project_policy.allowed_dependencies.includes(dependency)) authorization.blockers.push(`project-dependency-not-allow-listed:${dependency}`);
      const protectedTargets = [...run.project_policy.protected_paths, ...run.project_policy.protected_oracles];
      const protectedChanges = paths.filter((path) => protectedTargets.some((target) => path === target || path.startsWith(`${target.replace(/\/$/, "")}/`)));
      if (protectedChanges.length > 0) authorization.blockers.push(...protectedChanges.map((path) => `protected-path:${path}`));
      if (containsSensitiveChange(run.worktree.path, paths)) authorization.blockers.push("secret-material-detected");
      if (!authorization.authorized || authorization.blockers.length > 0) return { completed: false, run: this.rollbackAndWait(run, authorization.blockers) };
      const checkIds = String(slice["Check IDs"] ?? slice.Checks ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const relevantChecks = run.plan.checks.filter((check) => checkIds.length === 0 || checkIds.includes(check["Check ID"]));
      const checkReceipts = relevantChecks.map((check) => {
        const command = check["Command or Inspection"];
        try { return { check_id: check["Check ID"], ...runHostCheck(run.worktree.path, parseHostCommand(command)) }; }
        catch (error) { return { check_id: check["Check ID"], command, passed: false, error: error.message }; }
      });
      run = this.update(run.run_id, (draft) => ({ ...draft, phase: "slice-review", check_receipts: [...(draft.check_receipts ?? []), ...checkReceipts] }), "host-checks-finished");
      const review = this.review(run, slice, checkReceipts, adapter);
      run = this.update(run.run_id, (draft) => ({ ...draft, review: review.decision, receipts: [...draft.receipts, review.receipt], ...(review.interrupted ? { lifecycle: "interrupted", blockers: ["reviewer-hard-cancelled"], next_action: "resume" } : {}) }), "slice-reviewed");
      if (["paused", "stopped", "interrupted"].includes(run.lifecycle)) return { completed: false, run };
      if (!review.decision) return { completed: false, run: this.wait(run, review.blockers) };
      if (review.decision.assessment === "achieved" && review.decision.next_action === "none" && checkReceipts.every((item) => item.passed)) return { completed: true, run };
      if (["clarify", "replan"].includes(review.decision.next_action)) return { completed: false, run: this.wait(run, [`review-${review.decision.next_action}`]) };
      correctionCycle += 1;
      const findingRepeated = review.decision.finding_keys.some((key) => previousFindingKeys.includes(key));
      previousFindingKeys = review.decision.finding_keys;
      const bounds = run.plan.fields.automation_bounds;
      if (correctionCycle > bounds.max_correction_cycles) return { completed: false, run: this.wait(run, ["correction-budget-exhausted"]) };
      run = this.update(run.run_id, (draft) => ({ ...draft, correction_cycles: correctionCycle, finding_repeated: findingRepeated, review: review.decision, phase: "implementing" }), "correction-scheduled");
    }
  }

  review(run, slice, checkReceipts, adapter) {
    const route = run.route_config.reviewer;
    const acceptedModel = routeReceipt(run.route_validation, "reviewer");
    const diff = this.gitDiff(run.worktree.path, run.baseline.head);
    const prompt = [
      "Independently review the current slice. You are read-only and have no writer conversation.",
      "Judge only the approved root plan, repository diff and host check receipts.",
      "Return one JSON object with assessment, next_action, finding_keys, and findings. Use next_action none only with assessment achieved.",
      `AUTHORITATIVE ROOT PROJECTION\n${run.plan.authoritative_projection_text}`,
      `SLICE\n${JSON.stringify(slice, null, 2)}`,
      `DIFF\n${diff}`,
      `HOST CHECKS\n${JSON.stringify(checkReceipts, null, 2)}`,
    ].join("\n\n");
    const phase = adapter.runPhase({ role: "reviewer", route, acceptedModel, prompt, cwd: run.worktree.path, configurationHash: run.route_hash, artifactProjectionHash: run.root_authoritative_projection_hash });
    const blockers = phaseReceiptBlockers(phase.receipt, "reviewer", run.root_authoritative_projection_hash);
    if (!phase.response.ok) blockers.push(phase.response.error?.message ?? "reviewer-failed");
    if (blockers.length > 0) return { decision: null, receipt: phase.receipt, blockers: [...new Set(blockers)], interrupted: phase.response.status === "interrupted" };
    try { return { decision: jsonDecision(phase.response.result), receipt: phase.receipt, blockers: [] }; }
    catch (error) { return { decision: null, receipt: phase.receipt, blockers: [`reviewer-invalid-decision:${error.message}`] }; }
  }

  finalReview(runId) {
    let run = this.store.get(runId);
    const authorization = evaluateAuthorization({ plan: run.plan.fields, usage: this.usage(run) });
    if (!authorization.authorized) return this.wait(run, authorization.blockers);
    const adapter = this.adapterFactory(run);
    const review = this.review(run, { "Slice ID": "ROOT", Checks: run.plan.checks.map((check) => check["Check ID"]).join(",") }, run.check_receipts ?? [], adapter);
    run = this.update(runId, (draft) => ({ ...draft, root_review_complete: Boolean(review.decision), review: review.decision, receipts: [...draft.receipts, review.receipt], phase: "root-review", ...(review.interrupted ? { lifecycle: "interrupted", blockers: ["reviewer-hard-cancelled"], next_action: "resume" } : {}) }), "root-reviewed");
    if (["paused", "stopped", "interrupted"].includes(run.lifecycle)) return run;
    if (!review.decision) return this.wait(run, review.blockers);
    if (review.decision.assessment !== "achieved" || review.decision.next_action !== "none") return this.wait(run, ["root-review-not-achieved"]);
    if (run.effective_profile === "auto-gated") return this.update(runId, (draft) => ({ ...draft, lifecycle: "waiting-human", phase: "delivery-ready", next_action: "accept-delivery", blockers: [] }), "delivery-ready");
    return this.update(runId, (draft) => ({ ...draft, lifecycle: "achieved", phase: "achieved", next_action: "none", blockers: [] }), "run-achieved");
  }

  acceptDelivery(runId) {
    return this.update(runId, (draft) => ({ ...draft, lifecycle: "achieved", delivery_accepted: true, phase: "achieved", next_action: "none", blockers: [] }), "delivery-accepted");
  }

  wait(run, blockers) {
    return this.update(run.run_id, (draft) => ({ ...draft, lifecycle: "waiting-human", blockers: [...new Set(blockers)], next_action: "answer" }), "waiting-human");
  }

  rollbackAndWait(run, blockers) {
    const target = run.checkpoints?.at(-1)?.commit ?? run.worktree?.baseline?.head ?? run.baseline.head;
    const rollback = rollbackToCheckpoint(run.worktree.path, target);
    const restored = this.update(run.run_id, (draft) => ({ ...draft, rollbacks: [...(draft.rollbacks ?? []), { at: new Date().toISOString(), target, ...rollback, blockers: [...new Set(blockers)] }] }), "worktree-rolled-back");
    return this.wait(restored, blockers);
  }

  usage(run) {
    const usage = { totalTokens: 0, costUsd: 0, correctionCycles: run.correction_cycles ?? 0, activeMinutes: 0 };
    for (const receipt of run.receipts ?? []) {
      usage.totalTokens += receipt.usage?.totalTokens ?? 0;
      usage.costUsd += receipt.cost_usd ?? 0;
      usage.activeMinutes += (receipt.duration_ms ?? 0) / 60_000;
    }
    for (const receipt of run.check_receipts ?? []) usage.activeMinutes += (receipt.duration_ms ?? 0) / 60_000;
    return usage;
  }

  gitDiff(worktreePath, baseline) {
    const result = spawnSync("git", ["-C", worktreePath, "diff", baseline, "--"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr.trim());
    return result.stdout.slice(-250_000);
  }
}
