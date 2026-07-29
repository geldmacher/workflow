import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { parse } from "yaml";

export const routingRoles = Object.freeze(["planner", "writer", "writer_escalated", "reviewer", "explainer"]);
const routeKeys = Object.freeze(["model_id", "reasoning_effort", "model_options", "fallback", "pricing_usd_per_million"]);
const pricingKeys = Object.freeze(["input", "output", "cache_read", "cache_write"]);
const budgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_validation_repairs"]);
const policyBudgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_correction_cycles"]);
const configKeys = Object.freeze(["schema", "route_profiles", "planning_preflight_budget", "extensions"]);
const policyKeys = Object.freeze([
  "schema", "automation_enabled", "unattended_enabled", "allowed_write_roots", "protected_paths",
  "protected_oracles", "certified_regions", "harness_version", "minimum_qualifying_runs", "dependencies",
  "allowed_dependencies", "external_effects", "max_risk", "maximum_budgets", "extensions",
]);

export function defaultUserConfigPath() {
  return join(homedir(), ".cursor", "geldmacher-workflow", "config.yaml");
}

export function defaultProjectPolicyPath(workspaceRoot) {
  return join(resolve(workspaceRoot), ".cursor", "workflow-policy.yaml");
}

function readYaml(path) {
  if (!existsSync(path)) return null;
  const value = parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: YAML root must be an object`);
  return value;
}

function objectLike(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknown(value, allowed, label, errors) {
  if (!objectLike(value)) return;
  const known = new Set(allowed);
  for (const key of Object.keys(value)) if (!known.has(key)) errors.push(`${label} has unknown field ${key}`);
}

function validateExtensions(value, label, errors) {
  if (value !== undefined && !objectLike(value)) errors.push(`${label}.extensions must be an object`);
}

function validateRoute(route, label, errors) {
  if (!route || typeof route !== "object" || Array.isArray(route)) return errors.push(`${label} is missing`);
  rejectUnknown(route, routeKeys, label, errors);
  if (typeof route.model_id !== "string" || route.model_id.trim() === "") errors.push(`${label}.model_id must be a concrete non-empty ID`);
  if (route.fallback !== "deny") errors.push(`${label}.fallback must be deny`);
  if (typeof route.reasoning_effort !== "string" || route.reasoning_effort.trim() === "") errors.push(`${label}.reasoning_effort is required`);
  if (route.model_options !== undefined && (!route.model_options || typeof route.model_options !== "object" || Array.isArray(route.model_options))) errors.push(`${label}.model_options must be an object`);
  for (const [key, value] of Object.entries(route.model_options ?? {})) if (!["string", "number", "boolean"].includes(typeof value)) errors.push(`${label}.model_options.${key} must be scalar`);
  const pricing = route.pricing_usd_per_million;
  if (!pricing || typeof pricing !== "object") errors.push(`${label}.pricing_usd_per_million is required for enforceable cost budgets`);
  else {
    rejectUnknown(pricing, pricingKeys, `${label}.pricing_usd_per_million`, errors);
    for (const key of pricingKeys) if (!Number.isFinite(pricing[key]) || pricing[key] < 0) errors.push(`${label}.pricing_usd_per_million.${key} must be non-negative`);
  }
}

export function validateWorkflowConfig(config) {
  const errors = [];
  rejectUnknown(config, configKeys, "config", errors);
  validateExtensions(config?.extensions, "config", errors);
  if (config?.schema !== 1) errors.push("config schema must be 1");
  const profiles = config?.route_profiles;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles) || Object.keys(profiles).length === 0) errors.push("at least one route_profile is required");
  for (const [profileName, profile] of Object.entries(profiles ?? {})) {
    rejectUnknown(profile, routingRoles, `route_profiles.${profileName}`, errors);
    for (const role of routingRoles) validateRoute(profile?.[role], `route_profiles.${profileName}.${role}`, errors);
  }
  if (config?.planning_preflight_budget === undefined) errors.push("planning_preflight_budget is required for auto planning");
  else {
    const budget = config.planning_preflight_budget;
    rejectUnknown(budget, budgetKeys, "planning_preflight_budget", errors);
    if (!Number.isInteger(budget?.max_active_minutes) || budget.max_active_minutes < 1) errors.push("planning_preflight_budget.max_active_minutes must be a positive integer");
    if (!Number.isInteger(budget?.max_total_tokens) || budget.max_total_tokens < 1) errors.push("planning_preflight_budget.max_total_tokens must be a positive integer");
    if (!Number.isFinite(budget?.max_cost_usd) || budget.max_cost_usd <= 0) errors.push("planning_preflight_budget.max_cost_usd must be positive");
    if (!Number.isInteger(budget?.max_validation_repairs) || budget.max_validation_repairs < 0) errors.push("planning_preflight_budget.max_validation_repairs must be a non-negative integer");
  }
  return [...new Set(errors)];
}

function normalizePolicy(policy = {}) {
  const immutableProtectedPaths = [".git", ".cursor/workflow-policy.yaml"];
  return {
    schema: policy.schema ?? 1,
    automation_enabled: policy.automation_enabled === true,
    unattended_enabled: policy.unattended_enabled === true,
    allowed_write_roots: Array.isArray(policy.allowed_write_roots) ? policy.allowed_write_roots : [],
    protected_paths: [...new Set([...immutableProtectedPaths, ...(Array.isArray(policy.protected_paths) ? policy.protected_paths : [])])],
    protected_oracles: Array.isArray(policy.protected_oracles) ? policy.protected_oracles : [],
    certified_regions: Array.isArray(policy.certified_regions) ? policy.certified_regions : [],
    harness_version: typeof policy.harness_version === "string" ? policy.harness_version : null,
    minimum_qualifying_runs: Number.isInteger(policy.minimum_qualifying_runs) ? policy.minimum_qualifying_runs : null,
    qualifying_runs: 0,
    dependencies: policy.dependencies ?? "deny",
    allowed_dependencies: Array.isArray(policy.allowed_dependencies) ? policy.allowed_dependencies : [],
    external_effects: policy.external_effects ?? "none",
    max_risk: policy.max_risk ?? "high",
    maximum_budgets: policy.maximum_budgets && typeof policy.maximum_budgets === "object" ? policy.maximum_budgets : null,
    extensions: objectLike(policy.extensions) ? structuredClone(policy.extensions) : {},
  };
}

function validateRawProjectPolicy(policy, required) {
  const errors = [];
  rejectUnknown(policy, policyKeys, "project policy", errors);
  validateExtensions(policy?.extensions, "project policy", errors);
  if (required && policy?.schema !== 1) errors.push("project policy schema must be 1");
  if (policy?.maximum_budgets !== undefined) rejectUnknown(policy.maximum_budgets, policyBudgetKeys, "project policy maximum_budgets", errors);
  return errors;
}

export function validateProjectPolicy(policy) {
  const errors = [];
  if (policy.schema !== 1) errors.push("project policy schema must be 1");
  if (policy.automation_enabled && policy.allowed_write_roots.length === 0) errors.push("automation_enabled requires allowed_write_roots");
  for (const path of [...policy.allowed_write_roots, ...policy.protected_paths, ...policy.protected_oracles, ...policy.certified_regions]) {
    const normalized = normalize(String(path));
    if (!path || isAbsolute(String(path)) || normalized === ".." || normalized.startsWith(`..${sep}`)) errors.push(`project policy path must stay repository-relative: ${path}`);
  }
  if (policy.unattended_enabled) {
    if (!policy.automation_enabled) errors.push("unattended_enabled requires automation_enabled");
    if (policy.protected_oracles.length === 0) errors.push("unattended_enabled requires protected_oracles");
    if (policy.certified_regions.length === 0) errors.push("unattended_enabled requires certified_regions");
    if (!policy.harness_version) errors.push("unattended_enabled requires harness_version");
    if (!Number.isInteger(policy.minimum_qualifying_runs) || policy.minimum_qualifying_runs < 1) errors.push("unattended_enabled requires an explicit positive minimum_qualifying_runs");
  }
  if (!["deny", "allow-listed"].includes(policy.dependencies)) errors.push("project policy dependencies must be deny or allow-listed");
  if (policy.dependencies === "allow-listed" && policy.allowed_dependencies.length === 0) errors.push("allow-listed project dependencies require allowed_dependencies");
  if (policy.external_effects !== "none") errors.push("v1 project policy external_effects must be none");
  if (!Object.hasOwn({ low: true, medium: true, high: true }, policy.max_risk)) errors.push("project policy max_risk must be low, medium, or high");
  if (policy.maximum_budgets) {
    for (const key of ["max_active_minutes", "max_total_tokens", "max_correction_cycles"]) if (!Number.isInteger(policy.maximum_budgets[key]) || policy.maximum_budgets[key] < (key === "max_correction_cycles" ? 0 : 1)) errors.push(`project policy maximum_budgets.${key} is invalid`);
    if (!Number.isFinite(policy.maximum_budgets.max_cost_usd) || policy.maximum_budgets.max_cost_usd <= 0) errors.push("project policy maximum_budgets.max_cost_usd is invalid");
  }
  return [...new Set(errors)];
}

export function loadWorkflowConfig(workspaceRoot, options = {}) {
  const workspace = realpathSync(resolve(workspaceRoot));
  const userPath = options.userConfigPath ?? process.env.GELDMACHER_WORKFLOW_CONFIG ?? defaultUserConfigPath();
  const projectPath = options.projectPolicyPath ?? defaultProjectPolicyPath(workspace);
  const user = readYaml(userPath) ?? { schema: 1, route_profiles: {} };
  const rawProject = readYaml(projectPath) ?? {};
  const project = normalizePolicy(rawProject);
  const errors = [
    ...validateWorkflowConfig(user),
    ...validateRawProjectPolicy(rawProject, existsSync(projectPath)),
    ...validateProjectPolicy(project),
  ];
  if (project.unattended_enabled) {
    for (const path of project.protected_oracles) if (!existsSync(join(workspace, path))) errors.push(`protected oracle does not exist: ${path}`);
    for (const path of project.certified_regions) if (!existsSync(join(workspace, path))) errors.push(`certified region does not exist: ${path}`);
  }
  return {
    workspace,
    userPath,
    projectPath,
    user,
    project,
    errors: [...new Set(errors)],
  };
}

export function resolveRouteProfile(config, name = "default") {
  const profile = config.user.route_profiles?.[name];
  if (!profile) throw new Error(`unknown route profile ${name}`);
  return structuredClone(profile);
}
