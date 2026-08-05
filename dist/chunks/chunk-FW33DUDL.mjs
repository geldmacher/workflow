#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  buildSandboxProfile
} from "./chunk-PKEO6PA3.mjs";
import {
  repositoryKey,
  require_dist
} from "./chunk-TM6F22GE.mjs";
import {
  __toESM
} from "./chunk-IQRLCJ3K.mjs";

// src/controller/config.mjs
var import_yaml = __toESM(require_dist(), 1);
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
var routingRoles = Object.freeze(["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"]);
var poolKeys = Object.freeze(["selection", "fallback", "candidates"]);
var candidateKeys = Object.freeze(["model_id", "reasoning_effort", "model_options", "pricing_usd_per_million"]);
var pricingKeys = Object.freeze(["input", "output", "cache_read", "cache_write"]);
var budgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_validation_repairs"]);
var policyBudgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_correction_cycles"]);
var configKeys = Object.freeze(["schema", "route_profiles", "planning_preflight_budget", "extensions"]);
var policyKeys = Object.freeze([
  "schema",
  "supervised_enabled",
  "autonomous_enabled",
  "scope_envelope",
  "verification_profile",
  "certified_regions",
  "minimum_qualifying_runs",
  "dependencies",
  "allowed_dependencies",
  "external_effects",
  "max_risk",
  "maximum_budgets",
  "extensions"
]);
var scopeEnvelopeKeys = Object.freeze(["allowed_roots", "protected_paths", "approval_required_paths"]);
var verificationProfileKeys = Object.freeze(["profile_id", "manifest_path", "activated_hash"]);
function defaultUserConfigPath() {
  return join(homedir(), ".cursor", "geldmacher-workflow", "config.yaml");
}
function defaultProjectPolicyPath(workspaceRoot) {
  return join(resolve(workspaceRoot), ".cursor", "workflow-policy.yaml");
}
function readYaml(path) {
  if (!existsSync(path)) return null;
  const value = (0, import_yaml.parse)(readFileSync(path, "utf8"));
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
  if (value !== void 0 && !objectLike(value)) errors.push(`${label}.extensions must be an object`);
}
function validateCandidate(candidate, label, errors) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return errors.push(`${label} is missing`);
  rejectUnknown(candidate, candidateKeys, label, errors);
  if (typeof candidate.model_id !== "string" || candidate.model_id.trim() === "") errors.push(`${label}.model_id must be a concrete non-empty ID`);
  if (typeof candidate.reasoning_effort !== "string" || candidate.reasoning_effort.trim() === "") errors.push(`${label}.reasoning_effort is required`);
  if (candidate.model_options !== void 0 && (!candidate.model_options || typeof candidate.model_options !== "object" || Array.isArray(candidate.model_options))) errors.push(`${label}.model_options must be an object`);
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
  const ids = /* @__PURE__ */ new Set();
  for (const [index, candidate] of (pool.candidates ?? []).entries()) {
    validateCandidate(candidate, `${label}.candidates[${index}]`, errors);
    if (ids.has(candidate?.model_id)) errors.push(`${label}.candidates contains duplicate model_id ${candidate.model_id}`);
    if (candidate?.model_id) ids.add(candidate.model_id);
  }
}
function validateWorkflowConfig(config) {
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
  if (config?.planning_preflight_budget === void 0) errors.push("planning_preflight_budget is required for auto planning");
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
    protected_paths: [.../* @__PURE__ */ new Set([...immutableProtectedPaths, ...Array.isArray(envelope.protected_paths) ? envelope.protected_paths : []])],
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
    extensions: objectLike(policy.extensions) ? structuredClone(policy.extensions) : {}
  };
}
function validateRawProjectPolicy(policy, required) {
  const errors = [];
  rejectUnknown(policy, policyKeys, "project policy", errors);
  validateExtensions(policy?.extensions, "project policy", errors);
  if (required && policy?.schema !== 2) errors.push("project policy schema must be 2");
  if (policy?.scope_envelope !== void 0) {
    rejectUnknown(policy.scope_envelope, scopeEnvelopeKeys, "project policy scope_envelope", errors);
    for (const key of scopeEnvelopeKeys) if (!Array.isArray(policy.scope_envelope?.[key])) errors.push(`project policy scope_envelope.${key} must be an array`);
  }
  if (policy?.verification_profile !== void 0) rejectUnknown(policy.verification_profile, verificationProfileKeys, "project policy verification_profile", errors);
  if (policy?.maximum_budgets !== void 0) rejectUnknown(policy.maximum_budgets, policyBudgetKeys, "project policy maximum_budgets", errors);
  return errors;
}
function validateProjectPolicy(policy) {
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
  if (policy.external_effects !== "none") errors.push("Workflow 5 project policy external_effects must be none");
  if (!Object.hasOwn({ low: true, medium: true, high: true }, policy.max_risk)) errors.push("project policy max_risk must be low, medium, or high");
  if (policy.maximum_budgets) {
    for (const key of ["max_active_minutes", "max_total_tokens", "max_correction_cycles"]) if (!Number.isInteger(policy.maximum_budgets[key]) || policy.maximum_budgets[key] < (key === "max_correction_cycles" ? 0 : 1)) errors.push(`project policy maximum_budgets.${key} is invalid`);
    if (!Number.isFinite(policy.maximum_budgets.max_cost_usd) || policy.maximum_budgets.max_cost_usd <= 0) errors.push("project policy maximum_budgets.max_cost_usd is invalid");
  }
  return [...new Set(errors)];
}
function loadWorkflowConfig(workspaceRoot, options = {}) {
  const workspace = realpathSync(resolve(workspaceRoot));
  const userPath = options.userConfigPath ?? process.env.GELDMACHER_WORKFLOW_CONFIG ?? defaultUserConfigPath();
  const projectPath = options.projectPolicyPath ?? defaultProjectPolicyPath(workspace);
  const user = readYaml(userPath) ?? { schema: 2, route_profiles: {} };
  const rawProject = readYaml(projectPath) ?? {};
  const project = normalizePolicy(rawProject);
  const errors = [
    ...validateWorkflowConfig(user),
    ...validateRawProjectPolicy(rawProject, existsSync(projectPath)),
    ...validateProjectPolicy(project)
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
    errors: [...new Set(errors)]
  };
}
function resolveRouteProfile(config, name = "default") {
  const profile = config.user.route_profiles?.[name];
  if (!profile) throw new Error(`unknown route profile ${name}`);
  return structuredClone(profile);
}

// src/controller/worktree.mjs
import { existsSync as existsSync2, mkdirSync, mkdtempSync, readFileSync as readFileSync2, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir as homedir2, tmpdir } from "node:os";
import { dirname, isAbsolute as isAbsolute2, join as join2, relative, resolve as resolve2, sep as sep2 } from "node:path";
import { spawnSync } from "node:child_process";
function git(workspace, args, options = {}) {
  const result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8", timeout: options.timeout ?? 12e4, input: options.input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  return options.raw ? result.stdout : result.stdout.trimEnd();
}
var snapshotSecretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/];
var snapshotFileLimit = 2 * 1024 * 1024;
var snapshotTotalLimit = 10 * 1024 * 1024;
function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
function captureDirtySnapshot(workspaceRoot) {
  const baseline = repositoryBaseline(workspaceRoot);
  const staged_patch = git(workspaceRoot, ["diff", "--binary", "--cached", baseline.head], { raw: true });
  const unstaged_patch = git(workspaceRoot, ["diff", "--binary"], { raw: true });
  if (snapshotSecretPatterns.some((pattern) => pattern.test(staged_patch) || pattern.test(unstaged_patch))) {
    throw new Error("secret material detected in tracked dirty snapshot");
  }
  const untrackedNames = git(workspaceRoot, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort();
  const untracked = [];
  let total = Buffer.byteLength(staged_patch) + Buffer.byteLength(unstaged_patch);
  for (const path of untrackedNames) {
    const absolute = assertContainedPath(workspaceRoot, path);
    const stats = statSync(absolute);
    if (!stats.isFile()) throw new Error(`dirty snapshot supports files only: ${path}`);
    if (stats.size > snapshotFileLimit) throw new Error(`dirty snapshot file exceeds 2 MiB: ${path}`);
    total += stats.size;
    if (total > snapshotTotalLimit) throw new Error("dirty snapshot exceeds 10 MiB");
    const bytes = readFileSync2(absolute);
    const text = bytes.toString("utf8");
    if (snapshotSecretPatterns.some((pattern) => pattern.test(text))) throw new Error(`secret material detected in dirty snapshot: ${path}`);
    untracked.push({ path, mode: stats.mode & 511, size: stats.size, hash: hash(bytes), content_base64: bytes.toString("base64") });
  }
  const payload = { schema: 1, head: baseline.head, branch: baseline.branch, status: baseline.status, staged_patch, unstaged_patch, untracked };
  return { ...payload, snapshot_hash: hash(payload), dirty: baseline.status !== "" || untracked.length > 0 };
}
function applyDirtySnapshot(worktreePath, snapshot) {
  if (snapshot.staged_patch) git(worktreePath, ["apply", "--index", "--binary", "-"], { input: snapshot.staged_patch });
  if (snapshot.unstaged_patch) git(worktreePath, ["apply", "--binary", "-"], { input: snapshot.unstaged_patch });
  for (const entry of snapshot.untracked ?? []) {
    const target = assertContainedPath(worktreePath, entry.path);
    mkdirSync(dirname(target), { recursive: true, mode: 448 });
    writeFileSync(target, Buffer.from(entry.content_base64, "base64"), { mode: entry.mode });
  }
}
function defaultWorktreeRoot(workspaceRoot) {
  return join2(homedir2(), ".cursor", "geldmacher-workflow", "worktrees", repositoryKey(workspaceRoot));
}
function repositoryBaseline(workspaceRoot) {
  return {
    head: git(workspaceRoot, ["rev-parse", "HEAD"]),
    branch: git(workspaceRoot, ["branch", "--show-current"]),
    status: git(workspaceRoot, ["status", "--porcelain=v1"])
  };
}
function createRunWorktree(workspaceRoot, runId, options = {}) {
  const root = resolve2(options.root ?? defaultWorktreeRoot(workspaceRoot));
  const path = join2(root, runId);
  if (existsSync2(path)) throw new Error(`worktree path already exists: ${path}`);
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  const branch = `workflow/${runId}`;
  const dirtySnapshot = options.dirtySnapshot ?? captureDirtySnapshot(workspaceRoot);
  const baseline = { head: dirtySnapshot.head, branch: dirtySnapshot.branch, status: dirtySnapshot.status };
  git(workspaceRoot, ["worktree", "add", "-b", branch, path, baseline.head]);
  applyDirtySnapshot(path, dirtySnapshot);
  const humanBaseline = checkpoint(path, "human-baseline");
  const persisted = { ...dirtySnapshot, staged_patch: void 0, unstaged_patch: void 0, untracked: dirtySnapshot.untracked.map(({ content_base64, ...entry }) => entry) };
  if (options.snapshotPath) writeFileSync(options.snapshotPath, `${JSON.stringify(persisted, null, 2)}
`, { mode: 384 });
  return { path, branch, baseline, dirty_snapshot_hash: dirtySnapshot.snapshot_hash, human_baseline: humanBaseline.commit, dirty: dirtySnapshot.dirty };
}
function createComparisonBaselineWorktree(workspaceRoot, runId, head, options = {}) {
  const root = resolve2(options.root ?? defaultWorktreeRoot(workspaceRoot));
  const path = join2(root, `${runId}-baseline`);
  if (existsSync2(path)) throw new Error(`comparison baseline worktree path already exists: ${path}`);
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  git(workspaceRoot, ["worktree", "add", "--detach", path, head]);
  return { path, head, mode: "read-only-comparison" };
}
function changedPaths(worktreePath) {
  const lines = git(worktreePath, ["status", "--porcelain=v1", "-uall"]);
  if (!lines) return [];
  return lines.split("\n").map((line) => line.slice(3).split(" -> ").at(-1)).filter(Boolean);
}
var dependencyManifestNames = /* @__PURE__ */ new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Gemfile", "Gemfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum"]);
function packageDependencies(value) {
  return Object.assign({}, value.dependencies, value.devDependencies, value.peerDependencies, value.optionalDependencies);
}
function detectDependencyChanges(worktreePath, baseline, paths) {
  const manifests = paths.filter((path) => dependencyManifestNames.has(path) || dependencyManifestNames.has(path.split("/").at(-1)));
  if (manifests.length === 0) return [];
  const changed = /* @__PURE__ */ new Set();
  const packagePaths = manifests.filter((path) => path.split("/").at(-1) === "package.json");
  for (const path of packagePaths) {
    let before = {};
    try {
      before = JSON.parse(git(worktreePath, ["show", `${baseline}:${path}`]));
    } catch {
      before = {};
    }
    let after = {};
    try {
      after = JSON.parse(readFileSync2(assertContainedPath(worktreePath, path), "utf8"));
    } catch {
      after = {};
    }
    const prior = packageDependencies(before);
    const current = packageDependencies(after);
    for (const name of /* @__PURE__ */ new Set([...Object.keys(prior), ...Object.keys(current)])) if (prior[name] !== current[name]) changed.add(name);
  }
  const hasPackageChange = packagePaths.length > 0 && changed.size > 0;
  for (const path of manifests) {
    const name = path.split("/").at(-1);
    if (name === "package.json") continue;
    if (["package-lock.json", "npm-shrinkwrap.json"].includes(name) && hasPackageChange) continue;
    changed.add(`unknown:${path}`);
  }
  return [...changed].sort();
}
function assertContainedPath(root, candidate) {
  const normalizedRoot = resolve2(root);
  const normalizedCandidate = resolve2(root, candidate);
  const rel = relative(normalizedRoot, normalizedCandidate);
  if (rel === "" || !rel.startsWith(`..${sep2}`) && rel !== ".." && !isAbsolute2(rel)) return normalizedCandidate;
  throw new Error(`path escapes root: ${candidate}`);
}
function checkpoint(worktreePath, label) {
  git(worktreePath, ["add", "-A"]);
  const staged = git(worktreePath, ["diff", "--cached", "--name-only"]);
  if (!staged) return { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: true };
  git(worktreePath, ["-c", "user.name=Workflow", "-c", "user.email=workflow@local.invalid", "commit", "-m", `workflow checkpoint: ${label}`]);
  return { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: false };
}
function rollbackToCheckpoint(worktreePath, commit) {
  git(worktreePath, ["reset", "--hard", commit]);
  git(worktreePath, ["clean", "-fdx"]);
  return { commit: git(worktreePath, ["rev-parse", "HEAD"]), status: git(worktreePath, ["status", "--porcelain=v1"]) };
}
function parseHostCommand(command) {
  const source = String(command).trim();
  if (!source) throw new Error("empty host check command");
  const argv = [];
  let token = "";
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (token) {
        argv.push(token);
        token = "";
      }
      continue;
    }
    if (/[|&;<>()`$]/.test(character)) throw new Error(`shell syntax is not permitted in host checks: ${character}`);
    token += character;
  }
  if (escaped || quote) throw new Error("unterminated quote or escape in host check command");
  if (token) argv.push(token);
  if (argv.length === 0 || argv[0].includes("=")) throw new Error("host checks must begin with an executable, not an environment assignment");
  return argv;
}
function runHostCheck(worktreePath, command, timeoutMs = 3e5) {
  if (!Array.isArray(command) || command.length === 0 || command.some((value) => typeof value !== "string" || value === "")) throw new Error("host checks must be non-empty argv arrays");
  const temporary = mkdtempSync(join2(tmpdir(), "workflow-host-check-"));
  const started = Date.now();
  try {
    const profile = join2(temporary, "host-check.sb");
    writeFileSync(profile, buildSandboxProfile({ writablePaths: [temporary], network: false }), { mode: 384 });
    const executable = process.platform === "darwin" && existsSync2("/usr/bin/sandbox-exec") ? "/usr/bin/sandbox-exec" : null;
    if (!executable) throw new Error("hard host-check sandbox unavailable");
    const childEnvironment = [
      `PATH=${process.env.PATH}`,
      `LANG=${process.env.LANG ?? "C.UTF-8"}`,
      `LC_ALL=${process.env.LC_ALL ?? "C.UTF-8"}`,
      "CI=1",
      `TMPDIR=${temporary}`,
      `HOME=${temporary}`
    ];
    const result = spawnSync(executable, ["-f", profile, "/usr/bin/env", "-i", ...childEnvironment, command[0], ...command.slice(1)], {
      cwd: worktreePath,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: process.env
    });
    return {
      command,
      status: result.status,
      signal: result.signal,
      passed: result.status === 0,
      duration_ms: Date.now() - started,
      stdout: result.stdout?.slice(-5e4) ?? "",
      stderr: result.stderr?.slice(-5e4) ?? ""
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export {
  loadWorkflowConfig,
  resolveRouteProfile,
  repositoryBaseline,
  createRunWorktree,
  createComparisonBaselineWorktree,
  changedPaths,
  detectDependencyChanges,
  assertContainedPath,
  checkpoint,
  rollbackToCheckpoint,
  parseHostCommand,
  runHostCheck
};
