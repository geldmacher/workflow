const riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });

function authority(plan) {
  return plan?.authority ?? {};
}

function completeBudgets(bounds) {
  return bounds
    && Number.isInteger(bounds.max_active_minutes) && bounds.max_active_minutes > 0
    && Number.isInteger(bounds.max_total_tokens) && bounds.max_total_tokens > 0
    && Number.isFinite(bounds.max_cost_usd) && bounds.max_cost_usd > 0;
}

function pathInside(path, roots = []) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}

export function qualificationKey({ taskClass, verificationProfileHash, routePoolHash, certifiedRegion }) {
  return [taskClass, verificationProfileHash, routePoolHash, certifiedRegion].map((value) => value || "missing").join(":");
}

export function evaluateEligibility({ requestedProfile, plan, project, capabilities = {}, configErrors = [], qualifyingRuns = 0, taskClass = plan?.certification?.task_recipe }) {
  if (requestedProfile === "manual") return {
    requested_profile: "manual", effective_profile: "manual", eligible: true,
    downgraded: false, blockers: [], reasons: [],
  };

  const bounds = authority(plan);
  const blockers = [...configErrors];
  if (!project.supervised_enabled) blockers.push("project-supervised-disabled");
  if (!completeBudgets(bounds)) blockers.push("authority-budgets-missing-or-incomplete");
  if (bounds.external_effects !== "none") blockers.push("external-effects-not-none");
  if (bounds.delivery !== "repository-only") blockers.push("delivery-not-repository-only");
  if ((riskRank[plan.risk] ?? 99) > (riskRank[project.max_risk] ?? 0)) blockers.push("root-risk-exceeds-project-policy");
  const ceiling = project.maximum_budgets;
  if (ceiling) {
    for (const key of ["max_active_minutes", "max_total_tokens", "max_cost_usd"]) {
      if ((bounds[key] ?? Number.POSITIVE_INFINITY) > ceiling[key]) blockers.push(`root-${key}-exceeds-project-policy`);
    }
  }
  for (const capability of ["model_catalog_verified", "sandbox_boundary_verified", "worker_network_isolated", "sdk_secret_isolated", "sdk_budget_cancel_verified", "planner_submission_verified"]) {
    if (!capabilities[capability]) blockers.push(`${capability.replaceAll("_", "-")}-missing`);
  }
  const uniqueBlockers = [...new Set(blockers)];
  if (requestedProfile === "supervised") return {
    requested_profile: requestedProfile, effective_profile: "supervised",
    eligible: uniqueBlockers.length === 0, downgraded: false, blockers: uniqueBlockers, reasons: [],
  };

  const reasons = [];
  if (plan.contract_level !== "certified") reasons.push("certified-contract-required");
  if (!project.autonomous_enabled) reasons.push("project-autonomous-disabled");
  if (!plan.certification?.task_recipe) reasons.push("task-recipe-not-bound");
  if (plan.certification?.task_recipe && taskClass !== plan.certification.task_recipe) reasons.push("task-recipe-mismatch");
  if (!plan.certification?.verification_profile_hash) reasons.push("verification-profile-not-bound");
  if (plan.certification?.verification_profile_hash !== project.verification_profile?.activated_hash) reasons.push("verification-profile-hash-mismatch");
  if (!capabilities.verification_profile_certified) reasons.push("verification-profile-not-certified");
  if (capabilities.verification_profile_hash && plan.certification?.verification_profile_hash !== capabilities.verification_profile_hash) reasons.push("capability-verification-profile-mismatch");
  if (!capabilities.route_pool_certified) reasons.push("route-pool-not-certified");
  if (capabilities.attested_route_hash && plan.certification?.route_pool_hash !== capabilities.attested_route_hash) reasons.push("capability-route-pool-mismatch");
  if (!capabilities.route_pool_models_certified) reasons.push("selected-model-not-certified");
  if (!plan.certification?.certified_region || !project.certified_regions.includes(plan.certification.certified_region)) reasons.push("repository-region-not-certified");
  if ((plan.hard_triggers ?? []).length > 0) reasons.push("hard-trigger-present");
  if (plan.human_review_gates === true) reasons.push("planned-human-gate-present");
  if (qualifyingRuns < (project.minimum_qualifying_runs ?? Number.POSITIVE_INFINITY)) reasons.push("qualification-history-insufficient");
  const exactBinding = (capabilities.qualification_bindings ?? []).some((binding) => binding.task_class === taskClass
    && binding.verification_profile_hash === plan.certification?.verification_profile_hash
    && binding.route_pool_hash === plan.certification?.route_pool_hash
    && binding.certified_region === plan.certification?.certified_region);
  if (!exactBinding) reasons.push("qualification-binding-missing");

  const uniqueReasons = [...new Set(reasons)];
  return {
    requested_profile: requestedProfile,
    effective_profile: uniqueReasons.length > 0 ? "supervised" : "autonomous",
    eligible: uniqueBlockers.length === 0,
    downgraded: uniqueReasons.length > 0,
    blockers: uniqueBlockers,
    reasons: uniqueReasons,
    downgrade_reason: uniqueReasons.join(","),
  };
}

export function evaluateAuthorization({ plan, changedPaths = [], changedDependencies = [], dependencyChanged = changedDependencies.length > 0, discoveredRisk = plan.risk, externalEffect = false, usage = {} }) {
  const blockers = [];
  const bounds = authority(plan);
  if (!completeBudgets(bounds)) return { authorized: false, blockers: ["authority-bounds-missing"] };
  for (const path of changedPaths) {
    if (!pathInside(path, bounds.allowed_roots ?? [])) blockers.push(`out-of-envelope:${path}`);
    if (pathInside(path, bounds.protected_paths ?? [])) blockers.push(`protected-path:${path}`);
    if (pathInside(path, bounds.approval_required_paths ?? [])) blockers.push(`approval-required-path:${path}`);
  }
  if ((riskRank[discoveredRisk] ?? riskRank[plan.risk] ?? 3) > (riskRank[plan.risk] ?? 0)) blockers.push("risk-bound-exceeded");
  if (dependencyChanged && bounds.dependencies !== "allow-listed") blockers.push("dependency-change-not-authorized");
  if (bounds.dependencies === "allow-listed") for (const dependency of changedDependencies) if (!(bounds.allowed_dependencies ?? []).includes(dependency)) blockers.push(`dependency-not-allow-listed:${dependency}`);
  if (externalEffect || bounds.external_effects !== "none") blockers.push("external-effect-not-authorized");
  if ((usage.totalTokens ?? 0) > bounds.max_total_tokens) blockers.push("token-budget-exhausted");
  if ((usage.costUsd ?? 0) > bounds.max_cost_usd) blockers.push("cost-budget-exhausted");
  if ((usage.activeMinutes ?? 0) > bounds.max_active_minutes) blockers.push("time-budget-exhausted");
  if ((usage.correctionCycles ?? 0) > (plan.max_correction_cycles ?? 3)) blockers.push("correction-budget-exhausted");
  return { authorized: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export function selectWriterRoute({ plan, correctionCycle = 0, findingRepeated = false, alreadyEscalated = false }) {
  if (alreadyEscalated) return { role: "writer_escalated", escalated: true, reason: "writer-affinity-escalated" };
  if (plan.contract_level === "certified" || plan.risk === "high" || (plan.hard_triggers ?? []).length > 0) return { role: "writer_escalated", escalated: true, reason: "root-complexity" };
  if (findingRepeated || correctionCycle >= 2) return { role: "writer_escalated", escalated: true, reason: findingRepeated ? "repeated-finding" : "second-correction-cycle" };
  return { role: "writer", escalated: false, reason: "economy-default" };
}

export function estimateCost(usage, pricing) {
  if (!usage || !pricing) return null;
  const total = (usage.inputTokens ?? 0) * pricing.input
    + (usage.outputTokens ?? 0) * pricing.output
    + (usage.cacheReadTokens ?? 0) * pricing.cache_read
    + (usage.cacheWriteTokens ?? 0) * pricing.cache_write;
  return total / 1_000_000;
}
