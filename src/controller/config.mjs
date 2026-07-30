import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { parse } from "yaml";

export const routingRoles = Object.freeze(["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"]);
const poolKeys = Object.freeze(["selection", "fallback", "candidates"]);
const candidateKeys = Object.freeze(["model_id", "reasoning_effort", "model_options", "pricing_usd_per_million"]);
const pricingKeys = Object.freeze(["input", "output", "cache_read", "cache_write"]);
const budgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_validation_repairs"]);
const policyBudgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_correction_cycles"]);
const configKeys = Object.freeze(["schema", "route_profiles", "planning_preflight_budget", "extensions"]);
const policyKeys = Object.freeze([
  "schema", "supervised_enabled", "autonomous_enabled", "scope_envelope", "verification_profile",
  "certified_regions", "minimum_qualifying_runs", "dependencies",
  "allowed_dependencies", "external_effects", "max_risk", "maximum_budgets", "extensions",
]);
const scopeEnvelopeKeys = Object.freeze(["allowed_roots", "protected_paths", "approval_required_paths"]);
const verificationProfileKeys = Object.freeze(["profile_id", "manifest_path", "activated_hash"]);

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

function validateCandidate(candidate, label, errors) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return errors.push(`${label} is missing`);
  rejectUnknown(candidate, candidateKeys, label, errors);
  if (typeof candidate.model_id !== "string" || candidate.model_id.trim() === "") errors.push(`${label}.model_id must be a concrete non-empty ID`);
  if (typeof candidate.reasoning_effort !== "string" || candidate.reasoning_effort.trim() === "") errors.push(`${label}.reasoning_effort is required`);
  if (candidate.model_options !== undefined && (!candidate.model_options || typeof candidate.model_options !== "object" || Array.isArray(candidate.model_options))) errors.push(`${label}.model_options must be an object`);
  for (const [key, value] of Object.entries(candidate.model_options ?? {})) if (!["string", "number", "boolean"].includes(typeof value)) errors.push(`${label}.model_options.${key} must be scalar`);
  const pricing = candidate.pricing_usd_per_million;
  if (!pricing || typeof pricing !== "object") errors.push(`${label}.pricing_usd_per_million is required for enforceable cost budgets`);
  else {
    rejectUnknown(pricing, pricingKeys, `${label}.pricing_usd_per_million`, errors);
    for (const key of pricingKeys) if (!Number.isFinite(pricing[key]) || pricing[key] < 0) errors.push(`${label}.pricing_usd_per_million.${key} must be non-negative`);
  }
}

function validateRoutePool(pool, label, errors) {
  if (!pool || typeof pool !== "object" || Array.isArray(pool)) return errors.push(`${label} is missing`);
  rejectUnknown(pool, poolKeys, label, errors);
  if (pool.selection !== "ordered") errors.push(`${label}.selection must be ordered`);
  if (pool.fallback !== "approved-pool") errors.push(`${label}.fallback must be approved-pool`);
  if (!Array.isArray(pool.candidates) || pool.candidates.length === 0) errors.push(`${label}.candidates must be a non-empty array`);
  const ids = new Set();
  for (const [index, candidate] of (pool.candidates ?? []).entries()) {
    validateCandidate(candidate, `${label}.candidates[${index}]`, errors);
    if (ids.has(candidate?.model_id)) errors.push(`${label}.candidates contains duplicate model_id ${candidate.model_id}`);
    if (candidate?.model_id) ids.add(candidate.model_id);
  }
}

export function validateWorkflowConfig(config) {
  const errors = [];
  rejectUnknown(config, configKeys, "config", errors);
  validateExtensions(config?.extensions, "config", errors);
  if (config?.schema !== 2) errors.push("config schema must be 2");
  const profiles = config?.route_profiles;
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles) || Object.keys(profiles).length === 0) errors.push("at least one route_profile is required");
  for (const [profileName, profile] of Object.entries(profiles ?? {})) {
    rejectUnknown(profile, routingRoles, `route_profiles.${profileName}`, errors);
    for (const role of routingRoles) validateRoutePool(profile?.[role], `route_profiles.${profileName}.${role}`, errors);
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
  const envelope = objectLike(policy.scope_envelope) ? policy.scope_envelope : {};
  return {
    schema: policy.schema ?? 2,
    supervised_enabled: policy.supervised_enabled === true,
    autonomous_enabled: policy.autonomous_enabled === true,
    allowed_write_roots: Array.isArray(envelope.allowed_roots) ? envelope.allowed_roots : [],
    protected_paths: [...new Set([...immutableProtectedPaths, ...(Array.isArray(envelope.protected_paths) ? envelope.protected_paths : [])])],
    approval_required_paths: Array.isArray(envelope.approval_required_paths) ? envelope.approval_required_paths : [],
    verification_profile: objectLike(policy.verification_profile) ? structuredClone(policy.verification_profile) : null,
    certified_regions: Array.isArray(policy.certified_regions) ? policy.certified_regions : [],
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
  if (required && policy?.schema !== 2) errors.push("project policy schema must be 2");
  if (policy?.scope_envelope !== undefined) {
    rejectUnknown(policy.scope_envelope, scopeEnvelopeKeys, "project policy scope_envelope", errors);
    for (const key of scopeEnvelopeKeys) if (!Array.isArray(policy.scope_envelope?.[key])) errors.push(`project policy scope_envelope.${key} must be an array`);
  }
  if (policy?.verification_profile !== undefined) rejectUnknown(policy.verification_profile, verificationProfileKeys, "project policy verification_profile", errors);
  if (policy?.maximum_budgets !== undefined) rejectUnknown(policy.maximum_budgets, policyBudgetKeys, "project policy maximum_budgets", errors);
  return errors;
}

export function validateProjectPolicy(policy) {
  const errors = [];
  if (policy.schema !== 2) errors.push("project policy schema must be 2");
  if (policy.supervised_enabled && policy.allowed_write_roots.length === 0) errors.push("supervised_enabled requires scope_envelope.allowed_roots");
  for (const path of [...policy.allowed_write_roots, ...policy.protected_paths, ...policy.approval_required_paths, ...policy.certified_regions]) {
    const normalized = normalize(String(path));
    if (!path || isAbsolute(String(path)) || normalized === ".." || normalized.startsWith(`..${sep}`)) errors.push(`project policy path must stay repository-relative: ${path}`);
  }
  if (policy.autonomous_enabled) {
    if (!policy.supervised_enabled) errors.push("autonomous_enabled requires supervised_enabled");
    if (policy.certified_regions.length === 0) errors.push("autonomous_enabled requires certified_regions");
    if (!policy.verification_profile?.profile_id || !policy.verification_profile?.manifest_path || !/^[a-f0-9]{64}$/.test(policy.verification_profile?.activated_hash ?? "")) errors.push("autonomous_enabled requires an activated verification_profile");
    if (!Number.isInteger(policy.minimum_qualifying_runs) || policy.minimum_qualifying_runs < 1) errors.push("autonomous_enabled requires an explicit positive minimum_qualifying_runs");
  }
  if (!["deny", "allow-listed"].includes(policy.dependencies)) errors.push("project policy dependencies must be deny or allow-listed");
  if (policy.dependencies === "allow-listed" && policy.allowed_dependencies.length === 0) errors.push("allow-listed project dependencies require allowed_dependencies");
  if (policy.external_effects !== "none") errors.push("Workflow 4 project policy external_effects must be none");
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
  const user = readYaml(userPath) ?? { schema: 2, route_profiles: {} };
  const rawProject = readYaml(projectPath) ?? {};
  const project = normalizePolicy(rawProject);
  const errors = [
    ...validateWorkflowConfig(user),
    ...validateRawProjectPolicy(rawProject, existsSync(projectPath)),
    ...validateProjectPolicy(project),
  ];
  if (project.autonomous_enabled) {
    for (const path of project.certified_regions) if (!existsSync(join(workspace, path))) errors.push(`certified region does not exist: ${path}`);
    if (project.verification_profile?.manifest_path && !existsSync(join(workspace, project.verification_profile.manifest_path))) errors.push(`verification profile manifest does not exist: ${project.verification_profile.manifest_path}`);
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
