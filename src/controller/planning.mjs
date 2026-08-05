import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  opaqueExtensionsFromArtifactText,
  preflightRootPlan,
  replaceOpaqueExtensions,
} from "../../scripts/validate-artifact.source.mjs";
import { loadWorkflowConfig, resolveRouteProfile } from "./config.mjs";
import { resolveCapabilities } from "./capabilities.mjs";
import { CursorWorkerAdapter } from "./worker-adapter.mjs";
import { assertCompatiblePreparation } from "./protocol.mjs";
import { repositoryBaseline } from "./worktree.mjs";
import { validateIntentBlockerReport } from "../worker/planning-output.mjs";

const profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 });
const harnessFiles = Object.freeze([
  "skills/work-planning/SKILL.md",
  "references/artifact-protocol.md",
  "references/plan-container-contract.md",
  "references/executable-contract.md",
  "references/design-contract.md",
  "references/automation-preparation-contract.md",
  "schemas/artifacts/work-plan.schema.json",
  "schemas/cursor-plan-wrapper.schema.json",
]);

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(stable(value))).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonicalText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function section(artifact, name) {
  return canonicalText(artifact?.sections?.get(name));
}

function rootProjection(rootPlanText, pluginRoot) {
  const inspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspection.errors.length > 0 || inspection.artifact?.fields?.artifact !== "work-plan") throw new Error(`invalid root plan: ${inspection.errors.join("; ") || "input is not a work-plan"}`);
  const artifact = inspection.artifact;
  const fields = artifact.fields;
  return {
    intent: stable({ id: fields.id, status: fields.status, intent_ready: fields.intent_ready, goal: fields.goal, acceptance: fields.acceptance, non_goals: fields.non_goals, constraints: fields.constraints, content: section(artifact, "Intent") }),
    lineage: stable({ predecessor_plan_id: fields.predecessor_plan_id ?? null, replan_source_review_id: fields.replan_source_review_id ?? null }),
    authority: stable(fields.authority),
    profile: stable({ profile_max: fields.profile_max, contract_level: fields.contract_level }),
    risk: stable({ risk: fields.risk, hard_triggers: fields.hard_triggers, content: section(artifact, "Risks") }),
    certification: stable(fields.certification ?? null),
  };
}

export function semanticRootDiff(beforeText, afterText, pluginRoot) {
  if (!beforeText) return null;
  const before = rootProjection(beforeText, pluginRoot);
  const after = rootProjection(afterText, pluginRoot);
  const categories = Object.keys(before).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return {
    changed: hash(beforeText) !== hash(afterText),
    categories,
    before_root_hash: hash(beforeText),
    after_root_hash: hash(afterText),
  };
}

function normalizeRootArtifacts(rootArtifacts) {
  if (rootArtifacts === undefined || rootArtifacts === null) return [];
  if (!Array.isArray(rootArtifacts) || rootArtifacts.length > 32) throw new Error("workflow_prepare root_artifacts must contain at most 32 artifacts");
  const normalized = rootArtifacts.map((entry, index) => {
    if (!entry || typeof entry.label !== "string" || entry.label.trim() === "" || typeof entry.text !== "string" || entry.text.trim() === "") {
      throw new Error(`workflow_prepare root_artifact ${index + 1} requires non-empty label and text`);
    }
    return { label: entry.label, text: entry.text };
  });
  if (new Set(normalized.map((entry) => entry.label)).size !== normalized.length) throw new Error("workflow_prepare root_artifact labels must be unique");
  if (normalized.reduce((total, entry) => total + entry.text.length, 0) > 1_000_000) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
  return normalized.sort((left, right) => left.label.localeCompare(right.label) || hash(left.text).localeCompare(hash(right.text)));
}

export function validateRootPlanLineage(rootPlanText, rootArtifacts, pluginRoot) {
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0) return { errors: contract.errors, artifacts: [], artifact_set_hash: null };
  let artifacts;
  try { artifacts = normalizeRootArtifacts(rootArtifacts); }
  catch (error) { return { errors: [error.message], artifacts: [], artifact_set_hash: null }; }
  const hasLineage = Boolean(contract.fields.predecessor_plan_id || contract.fields.replan_source_review_id);
  if (!hasLineage) {
    return artifacts.length > 0
      ? { errors: ["initial root_plan cannot include root_artifacts"], artifacts, artifact_set_hash: hash(artifacts) }
      : { errors: [], artifacts, artifact_set_hash: hash(artifacts) };
  }
  if (artifacts.length === 0) return { errors: ["replan root_plan requires its complete current lineage artifacts"], artifacts, artifact_set_hash: hash(artifacts) };
  const inspection = inspectArtifactSet([
    ...artifacts.map((entry) => [entry.label, entry.text]),
    ["workflow-prepare-root", rootPlanText],
  ], pluginRoot);
  const summary = effectiveCliSummary(inspection);
  const errors = [...inspection.errors];
  if (summary.root_tips.length !== 1 || summary.root_tips[0] !== contract.fields.id) errors.push("replan root_plan must be the unique active lineage tip");
  return { errors: [...new Set(errors)], artifacts, artifact_set_hash: hash(artifacts) };
}

export function plannerReceiptBlockers(receipt) {
  const blockers = [];
  if (!receipt?.model_attested || receipt?.remap === true) blockers.push("planner-model-mismatch");
  if (typeof receipt?.request_id !== "string" || receipt.request_id === "") blockers.push("planner-request-id-missing");
  if (typeof receipt?.agent_id !== "string" || receipt.agent_id === "") blockers.push("planner-agent-id-missing");
  if (typeof receipt?.sdk_version !== "string" || receipt.sdk_version === "") blockers.push("planner-sdk-version-missing");
  if (typeof receipt?.configuration_hash !== "string" || receipt.configuration_hash === "") blockers.push("planner-route-hash-missing");
  if (receipt?.route_hash !== receipt?.configuration_hash) blockers.push("planner-route-hash-mismatch");
  if (typeof receipt?.harness_hash !== "string" || receipt.harness_hash === "") blockers.push("planner-harness-hash-missing");
  if (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) blockers.push("planner-duration-missing");
  if (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) blockers.push("planner-token-usage-missing");
  if (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) blockers.push("planner-cost-missing");
  return blockers;
}

export function expectedPlannerReceiptBlockers(receipt, preparation, acceptedModel) {
  const selected = preparation.route_validation.routes?.planner?.selected_candidate;
  const expectedRequested = { id: selected?.model_id, reasoning_effort: selected?.reasoning_effort, model_options: selected?.model_options ?? {} };
  const blockers = [];
  if (JSON.stringify(stable(receipt?.requested_model)) !== JSON.stringify(stable(expectedRequested))) blockers.push("planner-requested-model-mismatch");
  if (JSON.stringify(stable(receipt?.accepted_model)) !== JSON.stringify(stable(acceptedModel))) blockers.push("planner-accepted-model-mismatch");
  if (receipt?.configuration_hash !== preparation.route_hash || receipt?.route_hash !== preparation.route_hash) blockers.push("planner-route-hash-mismatch");
  if (receipt?.harness_hash !== preparation.harness_hash) blockers.push("planner-harness-hash-mismatch");
  if (receipt?.artifact_projection_hash !== preparation.input_root_authoritative_projection_hash) blockers.push("planner-artifact-projection-mismatch");
  if (preparation.route_validation.sdk_version && receipt?.sdk_version !== preparation.route_validation.sdk_version) blockers.push("planner-sdk-version-mismatch");
  return blockers;
}

export function planningUsage(receipts, createdAt) {
  return {
    total_tokens: receipts.reduce((sum, receipt) => sum + (receipt.usage?.totalTokens ?? 0), 0),
    cost_usd: receipts.reduce((sum, receipt) => sum + (receipt.cost_usd ?? 0), 0),
    active_minutes: Math.max(
      receipts.reduce((sum, receipt) => sum + (receipt.duration_ms ?? 0), 0) / 60_000,
      (Date.now() - Date.parse(createdAt)) / 60_000,
    ),
  };
}

export function planningBudgetBlockers(usage, budget) {
  const blockers = [];
  if (usage.active_minutes > budget.max_active_minutes) blockers.push("planning-time-budget-exhausted");
  if (usage.total_tokens > budget.max_total_tokens) blockers.push("planning-token-budget-exhausted");
  if (usage.cost_usd > budget.max_cost_usd) blockers.push("planning-cost-budget-exhausted");
  return blockers;
}

export function loadPlanningHarness(pluginRoot) {
  const sources = harnessFiles.map((path) => {
    const absolute = join(pluginRoot, path);
    if (!existsSync(absolute)) throw new Error(`planning harness file is missing: ${path}`);
    return { path, content: readFileSync(absolute, "utf8") };
  });
  return { sources, hash: hash(sources) };
}

function planningPrompt(preparation, harness) {
  const source = preparation.source_kind === "goal"
    ? `GOAL\n${preparation.goal}`
    : `EXISTING VALID SCHEMA-5 INTENT ROOT AUTHORITATIVE PROJECTION\n${preparation.input_root_contract.authoritative_projection_text}`;
  return [
    "Act as the configured Workflow planner in read-only Cursor Plan mode.",
    "Inspect the repository, but do not modify it or cause any external effect.",
    "If one or more material product decisions remain open, call report_intent_blockers exactly once with at most three concrete questions, do not call CreatePlan, and stop.",
    "Otherwise call Cursor CreatePlan exactly once. Its plan argument must be one complete, ready, native schema-5 Workflow intent root satisfying the harness below.",
    "For an existing valid root, retain it unchanged when already adequate or propose a complete improved root. Never imply that an improvement is already approved.",
    `REQUESTED AUTO PROFILE\n${preparation.requested_profile}`,
    `REPOSITORY BASELINE\n${JSON.stringify(preparation.baseline, null, 2)}`,
    `NORMALIZED PROJECT AUTOMATION POLICY\n${JSON.stringify(preparation.project_policy, null, 2)}`,
    source,
    `VERSIONED PLANNING HARNESS (${preparation.harness_hash})\n${harness.sources.map(({ path, content }) => `--- ${path} ---\n${content}`).join("\n\n")}`,
  ].join("\n\n");
}

function normalizePlannerRootOutput(rootPlanText, preparation) {
  try {
    const opaque = preparation.source_kind === "root-plan"
      ? opaqueExtensionsFromArtifactText(preparation.input_root_text)
      : { present: false, value: null };
    return replaceOpaqueExtensions(rootPlanText, opaque);
  } catch {
    return rootPlanText;
  }
}

function repairPrompt(errors, repairsRemaining) {
  return [
    "The preceding CreatePlan output failed deterministic schema-5 validation.",
    "This is a technical contract repair only. Preserve the established product intent and use the same planner model and agent context.",
    `Call CreatePlan exactly once with a complete corrected root. Do not call report_intent_blockers unless a genuinely material product decision is now discovered. Repairs remaining after this turn: ${repairsRemaining}.`,
    `VALIDATOR ERRORS\n${errors.map((error) => `- ${error}`).join("\n")}`,
  ].join("\n\n");
}

function sameBaseline(left, right) {
  return left?.head === right?.head && left?.branch === right?.branch && left?.status === right?.status;
}

function maximumProfileAllows(requested, maximum) {
  return (profileRank[requested] ?? 99) <= (profileRank[maximum] ?? -1);
}

function preparationRequestHash({ goal, rootPlan, rootArtifactsHash, requestedProfile, routeProfile }) {
  return hash({
    source_kind: goal ? "goal" : "root-plan",
    goal: goal ?? null,
    input_root_hash: rootPlan ? hash(rootPlan) : null,
    input_root_lineage_hash: rootArtifactsHash ?? null,
    requested_profile: requestedProfile,
    route_profile: routeProfile,
  });
}

export class PlanningEngine {
  constructor({ workspaceRoot, store, pluginRoot, stateRoot, adapterFactory, capabilitiesFactory } = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.store = store;
    this.pluginRoot = resolve(pluginRoot);
    this.stateRoot = resolve(stateRoot);
    this.adapterFactory = adapterFactory ?? ((preparation) => new CursorWorkerAdapter({ runDirectory: this.store.preparationDirectory(preparation.preparation_id), pluginRoot: this.pluginRoot }));
    this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }

  prepare({ goal, rootPlan, rootArtifacts, requestedProfile, routeProfile = "default", idempotencyKey }) {
    if (Boolean(goal) === Boolean(rootPlan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (!["supervised", "autonomous"].includes(requestedProfile)) throw new Error("workflow_prepare supports supervised or autonomous");
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) throw new Error("workflow_prepare requires an idempotency key");

    let inputContract = null;
    let inputLineage = { errors: [], artifacts: [], artifact_set_hash: hash([]) };
    if (rootPlan) {
      inputContract = executionContractFromArtifactText(rootPlan, this.pluginRoot);
      if (inputContract.errors.length > 0) throw new Error(`invalid input root plan: ${inputContract.errors.join("; ")}`);
      inputLineage = validateRootPlanLineage(rootPlan, rootArtifacts, this.pluginRoot);
      if (inputLineage.errors.length > 0) throw new Error(`invalid input root lineage: ${inputLineage.errors.join("; ")}`);
    } else if (rootArtifacts !== undefined) {
      throw new Error("workflow_prepare root_artifacts require root_plan");
    }

    const requestHash = preparationRequestHash({ goal, rootPlan, rootArtifactsHash: inputLineage.artifact_set_hash, requestedProfile, routeProfile });
    const duplicate = this.store.list().find((preparation) => preparation.preparation_idempotency_key === idempotencyKey);
    if (duplicate) {
      assertCompatiblePreparation(duplicate);
      if (duplicate.preparation_request_hash !== requestHash) throw new Error("preparation idempotency conflict: key is bound to another request");
      return { preparation: duplicate, duplicate: true };
    }

    const config = loadWorkflowConfig(this.workspaceRoot);
    if (config.errors.length > 0) throw new Error(`workflow_prepare configuration invalid: ${config.errors.join("; ")}`);
    const route = resolveRouteProfile(config, routeProfile);
    const budget = structuredClone(config.user.planning_preflight_budget);
    const baseline = repositoryBaseline(this.workspaceRoot);
    const harness = loadPlanningHarness(this.pluginRoot);
    const routeHash = hash(route);
    const policyHash = hash(config.project);
    const configHash = hash({ route_profile: routeProfile, route, planning_preflight_budget: budget });
    const capabilities = this.capabilitiesFactory({ expected_route_hash: routeHash, expected_planning_harness_hash: harness.hash });
    let routeValidation;
    try { routeValidation = this.adapterFactory({ preparation_id: "preflight" }).validateProfile(route); }
    catch (error) { routeValidation = { verified: false, errors: [error.message] }; }
    const technicalBlockers = [
      ...(routeValidation.errors ?? []),
      ...(routeValidation.verified !== true ? ["model-catalog-not-verified"] : []),
      ...(!config.project.supervised_enabled ? ["project-supervised-disabled"] : []),
      ...(!capabilities.sandbox_boundary_verified ? ["hard-sandbox-not-verified"] : []),
      ...(!capabilities.worker_network_isolated ? ["worker-network-boundary-not-verified"] : []),
      ...(!capabilities.sdk_secret_isolated ? ["sdk-secret-boundary-not-verified"] : []),
      ...(!capabilities.sdk_budget_cancel_verified ? ["sdk-budget-cancel-not-verified"] : []),
      ...(!capabilities.planner_submission_verified ? ["planner-submission-not-verified"] : []),
    ];
    const now = Date.now();
    const preparation = this.store.create({
      status: technicalBlockers.length > 0 || routeValidation.verified !== true ? "failed" : "planning",
      source_kind: goal ? "goal" : "root-plan",
      goal: goal ?? null,
      input_root_text: rootPlan ?? null,
      input_root_hash: rootPlan ? hash(rootPlan) : null,
      input_root_contract: inputContract,
      input_root_authoritative_projection_hash: inputContract?.authoritative_projection_hash ?? null,
      input_root_lineage_artifacts: inputLineage.artifacts,
      input_root_lineage_hash: inputLineage.artifact_set_hash,
      requested_profile: requestedProfile,
      route_profile: routeProfile,
      route_config: route,
      route_hash: routeHash,
      config_hash: configHash,
      policy_hash: policyHash,
      harness_hash: harness.hash,
      baseline,
      project_policy: config.project,
      planning_budget: budget,
      route_validation: routeValidation,
      capabilities,
      preparation_idempotency_key: idempotencyKey,
      preparation_request_hash: requestHash,
      planner_agent_id: null,
      planner_receipts: [],
      usage: { total_tokens: 0, cost_usd: 0, active_minutes: 0 },
      root_plan_text: null,
      root_plan_hash: null,
      root_authoritative_projection_hash: null,
      semantic_diff: null,
      manual_questions: [],
      blockers: [...new Set(technicalBlockers)],
      runner_pid: null,
      expires_at: new Date(now + budget.max_active_minutes * 60_000).toISOString(),
      consumed_by_run_id: null,
    });
    return { preparation, duplicate: false };
  }

  execute(preparationId) {
    let preparation = this.store.get(preparationId);
    assertCompatiblePreparation(preparation);
    if (preparation.status !== "planning") throw new Error(`preparation is not planning: ${preparation.status}`);
    if (Date.parse(preparation.expires_at) <= Date.now()) return this.finish(preparation, "expired", ["preparation-expired"]);
    const harness = loadPlanningHarness(this.pluginRoot);
    if (harness.hash !== preparation.harness_hash) return this.finish(preparation, "failed", ["planning-harness-drift"]);
    const adapter = this.adapterFactory(preparation);
    const acceptedModel = preparation.route_validation.routes?.planner?.model;
    if (!acceptedModel) return this.finish(preparation, "failed", ["planner-route-not-validated"]);

    let prompt = planningPrompt(preparation, harness);
    let agentId = preparation.planner_agent_id;
    let repairs = 0;
    while (true) {
      const beforeUsage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at);
      const beforeBudgetBlockers = planningBudgetBlockers(beforeUsage, preparation.planning_budget);
      if (beforeBudgetBlockers.length > 0) return this.finish(preparation, "failed", beforeBudgetBlockers, beforeUsage);
      const remainingMs = Math.max(1, Date.parse(preparation.expires_at) - Date.now());
      const phase = adapter.runPlanningPhase({
        route: preparation.route_validation.routes.planner.selected_candidate,
        routePoolHash: preparation.route_validation.routes.planner.pool_hash,
        selectionReason: preparation.route_validation.routes.planner.selection_reason,
        acceptedModel,
        prompt,
        cwd: this.workspaceRoot,
        agentId,
        timeoutMs: remainingMs,
        configurationHash: preparation.route_hash,
        harnessHash: preparation.harness_hash,
        artifactProjectionHash: preparation.input_root_authoritative_projection_hash,
        deniedReadPaths: [
          join(this.workspaceRoot, ".git"),
          join(this.workspaceRoot, ".cursor", "workflow-policy.yaml"),
          ...preparation.project_policy.protected_paths.map((path) => join(this.workspaceRoot, path)),
        ],
      });
      agentId = phase.receipt.agent_id ?? agentId;
      const receipts = [...(preparation.planner_receipts ?? []), phase.receipt];
      const usage = planningUsage(receipts, preparation.created_at);
      const controlled = this.store.get(preparation.preparation_id);
      if (controlled.status !== "planning") {
        return this.store.update(controlled.preparation_id, controlled.revision, null, (draft) => ({
          ...draft,
          planner_agent_id: agentId,
          planner_receipts: [...(draft.planner_receipts ?? []), phase.receipt],
          usage: planningUsage([...(draft.planner_receipts ?? []), phase.receipt], draft.created_at),
          runner_pid: null,
        }), "planner-cancel-receipt-recorded");
      }
      preparation = this.update(preparation, (draft) => ({ ...draft, planner_agent_id: agentId, planner_receipts: receipts, usage }), "planner-turn-finished");
      if (phase.response.status === "interrupted") return this.update(preparation, (draft) => ({ ...draft, status: "interrupted", blockers: ["planner-hard-cancelled"], runner_pid: null }), "planner-interrupted");
      const blockers = [
        ...plannerReceiptBlockers(phase.receipt),
        ...expectedPlannerReceiptBlockers(phase.receipt, preparation, acceptedModel),
        ...planningBudgetBlockers(usage, preparation.planning_budget),
        ...(!phase.response.ok ? [phase.response.error?.message ?? "planner-failed"] : []),
      ];
      if (blockers.length > 0) return this.finish(preparation, "failed", blockers, usage);
      if (phase.planningOutput?.kind === "manual-planning-required") {
        let report;
        try { report = validateIntentBlockerReport(phase.planningOutput); }
        catch (error) { return this.finish(preparation, "failed", [`planner-intent-blocker-invalid:${error.message}`], usage); }
        return this.update(preparation, (draft) => ({
          ...draft,
        status: "manual-planning-required",
        root_plan_text: null,
        root_plan_hash: null,
        root_authoritative_projection_hash: null,
        semantic_diff: null,
          manual_questions: report.questions,
          blockers: report.rationale ? [report.rationale] : [],
          runner_pid: null,
        }), "manual-planning-required");
      }
      if (phase.planningOutput?.kind !== "root") return this.finish(preparation, "failed", ["planner-output-contract-violated"], usage);

      const rootPlanText = normalizePlannerRootOutput(phase.planningOutput.root_plan_text, preparation);
      const contract = executionContractFromArtifactText(rootPlanText, this.pluginRoot);
      const validationErrors = [...contract.errors];
      if (validationErrors.length === 0) {
        const preflight = preflightRootPlan(rootPlanText, this.pluginRoot);
        validationErrors.push(...preflight.blocking_issues.map((entry) => `${entry.code}: ${entry.message}`));
      }
      if (validationErrors.length === 0) validationErrors.push(...validateRootPlanLineage(rootPlanText, preparation.input_root_lineage_artifacts, this.pluginRoot).errors);
      if (validationErrors.length === 0 && preparation.input_root_contract
        && (contract.fields.predecessor_plan_id ?? null) !== (preparation.input_root_contract.fields.predecessor_plan_id ?? null)) validationErrors.push("root plan predecessor_plan_id must remain unchanged");
      if (validationErrors.length === 0 && preparation.input_root_contract
        && (contract.fields.replan_source_review_id ?? null) !== (preparation.input_root_contract.fields.replan_source_review_id ?? null)) validationErrors.push("root plan replan_source_review_id must remain unchanged");
      if (validationErrors.length === 0 && (contract.fields.status !== "ready" || contract.fields.intent_ready !== true)) validationErrors.push("root plan must be ready with intent_ready true");
      if (validationErrors.length === 0 && !maximumProfileAllows(preparation.requested_profile, contract.fields.profile_max)) validationErrors.push(`root plan permits at most ${contract.fields.profile_max}`);
      if (validationErrors.length === 0) {
        const semanticDiff = semanticRootDiff(preparation.input_root_text, rootPlanText, this.pluginRoot);
        return this.update(preparation, (draft) => ({
          ...draft,
          status: "root-ready",
          root_plan_text: rootPlanText,
          root_plan_hash: hash(rootPlanText),
          root_authoritative_projection_hash: contract.authoritative_projection_hash,
          root_plan_contract: contract,
          planner_receipts: draft.planner_receipts.map((receipt, index, receipts) => index === receipts.length - 1
            ? { ...receipt, produced_artifact_projection_hash: contract.authoritative_projection_hash }
            : receipt),
          semantic_diff: semanticDiff,
          manual_questions: [],
          blockers: [],
          runner_pid: null,
        }), "root-ready");
      }
      if (repairs >= preparation.planning_budget.max_validation_repairs) return this.finish(preparation, "failed", validationErrors.map((error) => `root-validation:${error}`), usage);
      repairs += 1;
      prompt = repairPrompt(validationErrors, preparation.planning_budget.max_validation_repairs - repairs);
    }
  }

  update(preparation, mutator, eventType) {
    return this.store.update(preparation.preparation_id, preparation.revision, null, mutator, eventType);
  }

  finish(preparation, status, blockers, usage = preparation.usage) {
    return this.update(preparation, (draft) => ({
      ...draft,
      status,
      usage,
      root_plan_text: null,
      root_plan_hash: null,
      root_authoritative_projection_hash: null,
      root_plan_contract: null,
      semantic_diff: null,
      manual_questions: [],
      blockers: [...new Set(blockers.filter(Boolean))],
      runner_pid: null,
    }), `preparation-${status}`);
  }
}

export function planningHarnessHash(pluginRoot) {
  return loadPlanningHarness(resolve(pluginRoot)).hash;
}

export function configurationHashes(workspaceRoot, routeProfile = "default") {
  const config = loadWorkflowConfig(workspaceRoot);
  if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
  const route = resolveRouteProfile(config, routeProfile);
  return {
    route_hash: hash(route),
    config_hash: hash({ route_profile: routeProfile, route, planning_preflight_budget: config.user.planning_preflight_budget }),
    policy_hash: hash(config.project),
  };
}
