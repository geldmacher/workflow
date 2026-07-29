const riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });

function completeBudgets(bounds) {
  return bounds
    && Number.isInteger(bounds.max_active_minutes) && bounds.max_active_minutes > 0
    && Number.isInteger(bounds.max_total_tokens) && bounds.max_total_tokens > 0
    && Number.isFinite(bounds.max_cost_usd) && bounds.max_cost_usd > 0
    && Number.isInteger(bounds.max_correction_cycles) && bounds.max_correction_cycles >= 0
    && bounds.max_writer_escalations === 1;
}

export function evaluateEligibility({ requestedProfile, plan, project, capabilities = {}, configErrors = [] }) {
  if (requestedProfile === "manual") return { requested_profile: "manual", effective_profile: "manual", eligible: true, downgrade_pending: false, blockers: [], reasons: [] };
  const blockers = [...configErrors];
  if (!project.automation_enabled) blockers.push("project-automation-disabled");
  if (!completeBudgets(plan.automation_bounds)) blockers.push("automation-budgets-missing-or-incomplete");
  if (plan.automation_bounds?.external_effects !== "none") blockers.push("external-effects-not-none");
  if (plan.automation_bounds?.delivery !== "repository-only") blockers.push("delivery-not-repository-only");
  if ((riskRank[plan.automation_bounds?.max_risk] ?? 0) > (riskRank[plan.risk] ?? 0)) blockers.push("automation-risk-exceeds-root");
  if ((riskRank[plan.risk] ?? 99) > (riskRank[project.max_risk] ?? 0)) blockers.push("root-risk-exceeds-project-policy");
  const ceiling = project.maximum_budgets;
  if (ceiling) {
    for (const key of ["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_correction_cycles"]) if ((plan.automation_bounds?.[key] ?? Number.POSITIVE_INFINITY) > ceiling[key]) blockers.push(`root-${key}-exceeds-project-policy`);
  }
  if (!capabilities.model_catalog_verified) blockers.push("model-catalog-not-verified");
  if (!capabilities.sandbox_boundary_verified) blockers.push("hard-sandbox-not-verified");
  if (!capabilities.worker_network_isolated) blockers.push("worker-network-boundary-not-verified");
  if (!capabilities.sdk_secret_isolated) blockers.push("sdk-secret-boundary-not-verified");
  if (!capabilities.sdk_budget_cancel_verified) blockers.push("sdk-budget-cancel-not-verified");
  if (!capabilities.planner_submission_verified) blockers.push("planner-submission-not-verified");
  if (requestedProfile === "auto-gated") return { requested_profile: requestedProfile, effective_profile: "auto-gated", eligible: blockers.length === 0, downgrade_pending: false, blockers: [...new Set(blockers)], reasons: [] };

  const reasons = [];
  if (plan.design_depth === "full") reasons.push("full-design-not-unattended-v1");
  if ((plan.hard_triggers ?? []).length > 0) reasons.push("hard-trigger-present");
  if (plan.automation_bounds?.dependencies !== "deny" || project.dependencies !== "deny") reasons.push("dependency-change-not-denied");
  if (project.external_effects !== "none") reasons.push("project-external-effects-not-none");
  if (!project.unattended_enabled) reasons.push("project-unattended-disabled");
  if (project.protected_oracles.length === 0) reasons.push("protected-oracle-missing");
  if (!project.harness_version) reasons.push("harness-not-certified");
  if (!capabilities.harness_certified) reasons.push("harness-capability-receipt-mismatch");
  if (project.certified_regions.length === 0) reasons.push("repository-region-not-certified");
  else for (const target of plan.automation_bounds?.allowed_targets ?? []) if (!project.certified_regions.some((region) => target === region || target.startsWith(`${region.replace(/\/$/, "")}/`))) reasons.push(`target-not-certified:${target}`);
  if (!Number.isInteger(project.minimum_qualifying_runs) || project.qualifying_runs < project.minimum_qualifying_runs) reasons.push("qualifying-history-insufficient");
  if (!capabilities.model_attestation_observed) reasons.push("observed-model-attestation-missing");
  if (plan.human_review_gates === true) reasons.push("planned-human-gate-present");
  if (blockers.length > 0 || reasons.length > 0) return {
    requested_profile: requestedProfile,
    effective_profile: "auto-gated",
    eligible: false,
    downgrade_pending: true,
    blockers: [...new Set(blockers)],
    reasons: [...new Set(reasons)],
    downgrade_reason: [...new Set([...blockers, ...reasons])].join(","),
  };
  return { requested_profile: requestedProfile, effective_profile: requestedProfile, eligible: true, downgrade_pending: false, blockers: [], reasons: [] };
}

export function evaluateAuthorization({ plan, changedPaths = [], changedDependencies = [], dependencyChanged = changedDependencies.length > 0, discoveredRisk = plan.risk, externalEffect = false, repositoryDrift = false, usage = {} }) {
  const blockers = [];
  const bounds = plan.automation_bounds;
  if (!bounds) return { authorized: false, blockers: ["automation-bounds-missing"] };
  for (const path of changedPaths) if (!(bounds.allowed_targets ?? []).some((target) => path === target || path.startsWith(`${target.replace(/\/$/, "")}/`))) blockers.push(`out-of-scope:${path}`);
  if ((riskRank[discoveredRisk] ?? riskRank[plan.risk] ?? 3) > (riskRank[bounds.max_risk] ?? 0)) blockers.push("risk-bound-exceeded");
  if (dependencyChanged && bounds.dependencies !== "allow-listed") blockers.push("dependency-change-not-authorized");
  if (bounds.dependencies === "allow-listed") for (const dependency of changedDependencies) if (!(bounds.allowed_dependencies ?? []).includes(dependency)) blockers.push(`dependency-not-allow-listed:${dependency}`);
  if (externalEffect || bounds.external_effects !== "none") blockers.push("external-effect-not-authorized");
  if (repositoryDrift) blockers.push("material-repository-drift");
  if ((usage.totalTokens ?? 0) > bounds.max_total_tokens) blockers.push("token-budget-exhausted");
  if ((usage.costUsd ?? 0) > bounds.max_cost_usd) blockers.push("cost-budget-exhausted");
  if ((usage.activeMinutes ?? 0) > bounds.max_active_minutes) blockers.push("time-budget-exhausted");
  if ((usage.correctionCycles ?? 0) > bounds.max_correction_cycles) blockers.push("correction-budget-exhausted");
  return { authorized: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export function selectWriterRoute({ plan, correctionCycle = 0, findingRepeated = false, alreadyEscalated = false }) {
  if (alreadyEscalated) return { role: "writer_escalated", escalated: true, reason: "writer-affinity-escalated" };
  if (plan.writer_tier_required === "escalated" || plan.design_depth === "full" || plan.assurance_profile === "deep") return { role: "writer_escalated", escalated: true, reason: "root-complexity" };
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
