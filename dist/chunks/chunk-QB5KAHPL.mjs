#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  buildSandboxProfile
} from "./chunk-FTS4RQ3D.mjs";
import {
  repositoryKey,
  require_dist
} from "./chunk-7JUFD6FK.mjs";
import {
  __toESM
} from "./chunk-WU6JOB3C.mjs";

// src/controller/config.mjs
var import_yaml = __toESM(require_dist(), 1);
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
var routingRoles = Object.freeze(["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"]), poolKeys = Object.freeze(["selection", "fallback", "candidates"]), candidateKeys = Object.freeze(["model_id", "reasoning_effort", "model_options", "pricing_usd_per_million"]), pricingKeys = Object.freeze(["input", "output", "cache_read", "cache_write"]), budgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_validation_repairs"]), policyBudgetKeys = Object.freeze(["max_active_minutes", "max_total_tokens", "max_cost_usd", "max_correction_cycles"]), configKeys = Object.freeze(["schema", "route_profiles", "planning_preflight_budget", "extensions"]), policyKeys = Object.freeze([
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
]), scopeEnvelopeKeys = Object.freeze(["allowed_roots", "protected_paths", "approval_required_paths"]), verificationProfileKeys = Object.freeze(["profile_id", "manifest_path", "activated_hash"]);
function defaultUserConfigPath() {
  return join(homedir(), ".cursor", "geldmacher-workflow", "config.yaml");
}
function defaultProjectPolicyPath(workspaceRoot) {
  return join(resolve(workspaceRoot), ".cursor", "workflow-policy.yaml");
}
function readYaml(path) {
  if (!existsSync(path)) return null;
  let value = (0, import_yaml.parse)(readFileSync(path, "utf8"));
  if (!value || typeof value != "object" || Array.isArray(value)) throw new Error(`${path}: YAML root must be an object`);
  return value;
}
function objectLike(value) {
  return !!value && typeof value == "object" && !Array.isArray(value);
}
function rejectUnknown(value, allowed, label, errors) {
  if (!objectLike(value)) return;
  let known = new Set(allowed);
  for (let key of Object.keys(value)) known.has(key) || errors.push(`${label} has unknown field ${key}`);
}
function validateExtensions(value, label, errors) {
  value !== void 0 && !objectLike(value) && errors.push(`${label}.extensions must be an object`);
}
function validateCandidate(candidate, label, errors) {
  if (!candidate || typeof candidate != "object" || Array.isArray(candidate)) return errors.push(`${label} is missing`);
  rejectUnknown(candidate, candidateKeys, label, errors), (typeof candidate.model_id != "string" || candidate.model_id.trim() === "") && errors.push(`${label}.model_id must be a concrete non-empty ID`), (typeof candidate.reasoning_effort != "string" || candidate.reasoning_effort.trim() === "") && errors.push(`${label}.reasoning_effort is required`), candidate.model_options !== void 0 && (!candidate.model_options || typeof candidate.model_options != "object" || Array.isArray(candidate.model_options)) && errors.push(`${label}.model_options must be an object`);
  for (let [key, value] of Object.entries(candidate.model_options ?? {})) ["string", "number", "boolean"].includes(typeof value) || errors.push(`${label}.model_options.${key} must be scalar`);
  let pricing = candidate.pricing_usd_per_million;
  if (!pricing || typeof pricing != "object") errors.push(`${label}.pricing_usd_per_million is required for enforceable cost budgets`);
  else {
    rejectUnknown(pricing, pricingKeys, `${label}.pricing_usd_per_million`, errors);
    for (let key of pricingKeys) (!Number.isFinite(pricing[key]) || pricing[key] < 0) && errors.push(`${label}.pricing_usd_per_million.${key} must be non-negative`);
  }
}
function validateRoutePool(pool, label, errors) {
  if (!pool || typeof pool != "object" || Array.isArray(pool)) return errors.push(`${label} is missing`);
  rejectUnknown(pool, poolKeys, label, errors), pool.selection !== "ordered" && errors.push(`${label}.selection must be ordered`), pool.fallback !== "approved-pool" && errors.push(`${label}.fallback must be approved-pool`), (!Array.isArray(pool.candidates) || pool.candidates.length === 0) && errors.push(`${label}.candidates must be a non-empty array`);
  let ids = /* @__PURE__ */ new Set();
  for (let [index, candidate] of (pool.candidates ?? []).entries())
    validateCandidate(candidate, `${label}.candidates[${index}]`, errors), ids.has(candidate?.model_id) && errors.push(`${label}.candidates contains duplicate model_id ${candidate.model_id}`), candidate?.model_id && ids.add(candidate.model_id);
}
function validateWorkflowConfig(config) {
  let errors = [];
  rejectUnknown(config, configKeys, "config", errors), validateExtensions(config?.extensions, "config", errors), config?.schema !== 2 && errors.push("config schema must be 2");
  let profiles = config?.route_profiles;
  (!profiles || typeof profiles != "object" || Array.isArray(profiles) || Object.keys(profiles).length === 0) && errors.push("at least one route_profile is required");
  for (let [profileName, profile] of Object.entries(profiles ?? {})) {
    rejectUnknown(profile, routingRoles, `route_profiles.${profileName}`, errors);
    for (let role of routingRoles) validateRoutePool(profile?.[role], `route_profiles.${profileName}.${role}`, errors);
  }
  if (config?.planning_preflight_budget === void 0) errors.push("planning_preflight_budget is required for auto planning");
  else {
    let budget = config.planning_preflight_budget;
    rejectUnknown(budget, budgetKeys, "planning_preflight_budget", errors), (!Number.isInteger(budget?.max_active_minutes) || budget.max_active_minutes < 1) && errors.push("planning_preflight_budget.max_active_minutes must be a positive integer"), (!Number.isInteger(budget?.max_total_tokens) || budget.max_total_tokens < 1) && errors.push("planning_preflight_budget.max_total_tokens must be a positive integer"), (!Number.isFinite(budget?.max_cost_usd) || budget.max_cost_usd <= 0) && errors.push("planning_preflight_budget.max_cost_usd must be positive"), (!Number.isInteger(budget?.max_validation_repairs) || budget.max_validation_repairs < 0) && errors.push("planning_preflight_budget.max_validation_repairs must be a non-negative integer");
  }
  return [...new Set(errors)];
}
function normalizePolicy(policy = {}) {
  let immutableProtectedPaths = [".git", ".cursor/workflow-policy.yaml"], envelope = objectLike(policy.scope_envelope) ? policy.scope_envelope : {};
  return {
    schema: policy.schema ?? 2,
    supervised_enabled: policy.supervised_enabled === !0,
    autonomous_enabled: policy.autonomous_enabled === !0,
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
    maximum_budgets: policy.maximum_budgets && typeof policy.maximum_budgets == "object" ? policy.maximum_budgets : null,
    extensions: objectLike(policy.extensions) ? structuredClone(policy.extensions) : {}
  };
}
function validateRawProjectPolicy(policy, required) {
  let errors = [];
  if (rejectUnknown(policy, policyKeys, "project policy", errors), validateExtensions(policy?.extensions, "project policy", errors), required && policy?.schema !== 2 && errors.push("project policy schema must be 2"), policy?.scope_envelope !== void 0) {
    rejectUnknown(policy.scope_envelope, scopeEnvelopeKeys, "project policy scope_envelope", errors);
    for (let key of scopeEnvelopeKeys) Array.isArray(policy.scope_envelope?.[key]) || errors.push(`project policy scope_envelope.${key} must be an array`);
  }
  return policy?.verification_profile !== void 0 && rejectUnknown(policy.verification_profile, verificationProfileKeys, "project policy verification_profile", errors), policy?.maximum_budgets !== void 0 && rejectUnknown(policy.maximum_budgets, policyBudgetKeys, "project policy maximum_budgets", errors), errors;
}
function validateProjectPolicy(policy) {
  let errors = [];
  policy.schema !== 2 && errors.push("project policy schema must be 2"), policy.supervised_enabled && policy.allowed_write_roots.length === 0 && errors.push("supervised_enabled requires scope_envelope.allowed_roots");
  for (let path of [...policy.allowed_write_roots, ...policy.protected_paths, ...policy.approval_required_paths, ...policy.certified_regions]) {
    let normalized = normalize(String(path));
    (!path || isAbsolute(String(path)) || normalized === ".." || normalized.startsWith(`..${sep}`)) && errors.push(`project policy path must stay repository-relative: ${path}`);
  }
  if (policy.autonomous_enabled && (policy.supervised_enabled || errors.push("autonomous_enabled requires supervised_enabled"), policy.certified_regions.length === 0 && errors.push("autonomous_enabled requires certified_regions"), (!policy.verification_profile?.profile_id || !policy.verification_profile?.manifest_path || !/^[a-f0-9]{64}$/.test(policy.verification_profile?.activated_hash ?? "")) && errors.push("autonomous_enabled requires an activated verification_profile"), (!Number.isInteger(policy.minimum_qualifying_runs) || policy.minimum_qualifying_runs < 1) && errors.push("autonomous_enabled requires an explicit positive minimum_qualifying_runs")), ["deny", "allow-listed"].includes(policy.dependencies) || errors.push("project policy dependencies must be deny or allow-listed"), policy.dependencies === "allow-listed" && policy.allowed_dependencies.length === 0 && errors.push("allow-listed project dependencies require allowed_dependencies"), policy.external_effects !== "none" && errors.push("Workflow 5 project policy external_effects must be none"), Object.hasOwn({ low: !0, medium: !0, high: !0 }, policy.max_risk) || errors.push("project policy max_risk must be low, medium, or high"), policy.maximum_budgets) {
    for (let key of ["max_active_minutes", "max_total_tokens", "max_correction_cycles"]) (!Number.isInteger(policy.maximum_budgets[key]) || policy.maximum_budgets[key] < (key === "max_correction_cycles" ? 0 : 1)) && errors.push(`project policy maximum_budgets.${key} is invalid`);
    (!Number.isFinite(policy.maximum_budgets.max_cost_usd) || policy.maximum_budgets.max_cost_usd <= 0) && errors.push("project policy maximum_budgets.max_cost_usd is invalid");
  }
  return [...new Set(errors)];
}
function loadWorkflowConfig(workspaceRoot, options = {}) {
  let workspace = realpathSync(resolve(workspaceRoot)), userPath = options.userConfigPath ?? process.env.GELDMACHER_WORKFLOW_CONFIG ?? defaultUserConfigPath(), projectPath = options.projectPolicyPath ?? defaultProjectPolicyPath(workspace), user = readYaml(userPath) ?? { schema: 2, route_profiles: {} }, rawProject = readYaml(projectPath) ?? {}, project = normalizePolicy(rawProject), errors = [
    ...validateWorkflowConfig(user),
    ...validateRawProjectPolicy(rawProject, existsSync(projectPath)),
    ...validateProjectPolicy(project)
  ];
  if (project.autonomous_enabled) {
    for (let path of project.certified_regions) existsSync(join(workspace, path)) || errors.push(`certified region does not exist: ${path}`);
    project.verification_profile?.manifest_path && !existsSync(join(workspace, project.verification_profile.manifest_path)) && errors.push(`verification profile manifest does not exist: ${project.verification_profile.manifest_path}`);
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
  let profile = config.user.route_profiles?.[name];
  if (!profile) throw new Error(`unknown route profile ${name}`);
  return structuredClone(profile);
}

// src/controller/worktree.mjs
import { existsSync as existsSync2, lstatSync, mkdirSync, mkdtempSync, readFileSync as readFileSync2, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir as homedir2, tmpdir } from "node:os";
import { dirname, isAbsolute as isAbsolute2, join as join2, relative, resolve as resolve2, sep as sep2 } from "node:path";
import { spawnSync } from "node:child_process";
function git(workspace, args, options = {}) {
  let result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8", timeout: options.timeout ?? 12e4, input: options.input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  return options.raw ? result.stdout : result.stdout.trimEnd();
}
var snapshotSecretPatterns = [/(?:^|\n)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[opsu]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/], snapshotFileLimit = 2 * 1024 * 1024, snapshotTotalLimit = 10 * 1024 * 1024;
function hash(value) {
  return createHash("sha256").update(typeof value == "string" ? value : JSON.stringify(value)).digest("hex");
}
function captureDirtySnapshot(workspaceRoot) {
  let baseline = repositoryBaseline(workspaceRoot), staged_patch = git(workspaceRoot, ["diff", "--binary", "--cached", baseline.head], { raw: !0 }), unstaged_patch = git(workspaceRoot, ["diff", "--binary"], { raw: !0 });
  if (snapshotSecretPatterns.some((pattern) => pattern.test(staged_patch) || pattern.test(unstaged_patch)))
    throw new Error("secret material detected in tracked dirty snapshot");
  let untrackedNames = git(workspaceRoot, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort(), untracked = [], total = Buffer.byteLength(staged_patch) + Buffer.byteLength(unstaged_patch);
  for (let path of untrackedNames) {
    let absolute = assertContainedPath(workspaceRoot, path), stats = statSync(absolute);
    if (!stats.isFile()) throw new Error(`dirty snapshot supports files only: ${path}`);
    if (stats.size > snapshotFileLimit) throw new Error(`dirty snapshot file exceeds 2 MiB: ${path}`);
    if (total += stats.size, total > snapshotTotalLimit) throw new Error("dirty snapshot exceeds 10 MiB");
    let bytes = readFileSync2(absolute), text = bytes.toString("utf8");
    if (snapshotSecretPatterns.some((pattern) => pattern.test(text))) throw new Error(`secret material detected in dirty snapshot: ${path}`);
    untracked.push({ path, mode: stats.mode & 511, size: stats.size, hash: hash(bytes), content_base64: bytes.toString("base64") });
  }
  let payload = { schema: 1, head: baseline.head, branch: baseline.branch, status: baseline.status, staged_patch, unstaged_patch, untracked };
  return { ...payload, snapshot_hash: hash(payload), dirty: baseline.status !== "" || untracked.length > 0 };
}
function applyDirtySnapshot(worktreePath, snapshot) {
  snapshot.staged_patch && git(worktreePath, ["apply", "--index", "--binary", "-"], { input: snapshot.staged_patch }), snapshot.unstaged_patch && git(worktreePath, ["apply", "--binary", "-"], { input: snapshot.unstaged_patch });
  for (let entry of snapshot.untracked ?? []) {
    let target = assertContainedPath(worktreePath, entry.path);
    mkdirSync(dirname(target), { recursive: !0, mode: 448 }), writeFileSync(target, Buffer.from(entry.content_base64, "base64"), { mode: entry.mode });
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
  let root = resolve2(options.root ?? defaultWorktreeRoot(workspaceRoot)), path = join2(root, runId);
  if (existsSync2(path)) throw new Error(`worktree path already exists: ${path}`);
  mkdirSync(dirname(path), { recursive: !0, mode: 448 });
  let branch = `workflow/${runId}`, dirtySnapshot = options.dirtySnapshot ?? captureDirtySnapshot(workspaceRoot), baseline = { head: dirtySnapshot.head, branch: dirtySnapshot.branch, status: dirtySnapshot.status };
  git(workspaceRoot, ["worktree", "add", "-b", branch, path, baseline.head]), applyDirtySnapshot(path, dirtySnapshot);
  let humanBaseline = checkpoint(path, "human-baseline"), persisted = { ...dirtySnapshot, staged_patch: void 0, unstaged_patch: void 0, untracked: dirtySnapshot.untracked.map(({ content_base64, ...entry }) => entry) };
  return options.snapshotPath && writeFileSync(options.snapshotPath, `${JSON.stringify(persisted, null, 2)}
`, { mode: 384 }), { path, branch, baseline, dirty_snapshot_hash: dirtySnapshot.snapshot_hash, human_baseline: humanBaseline.commit, dirty: dirtySnapshot.dirty };
}
function createComparisonBaselineWorktree(workspaceRoot, runId, head, options = {}) {
  let root = resolve2(options.root ?? defaultWorktreeRoot(workspaceRoot)), path = join2(root, `${runId}-baseline`);
  if (existsSync2(path)) throw new Error(`comparison baseline worktree path already exists: ${path}`);
  return mkdirSync(dirname(path), { recursive: !0, mode: 448 }), git(workspaceRoot, ["worktree", "add", "--detach", path, head]), { path, head, mode: "read-only-comparison" };
}
function changedPaths(worktreePath) {
  let lines = git(worktreePath, ["status", "--porcelain=v1", "-uall"]);
  return lines ? lines.split(`
`).map((line) => line.slice(3).split(" -> ").at(-1)).filter(Boolean) : [];
}
function changedPathsBetween(workspaceRoot, fromRef, toRef = "HEAD") {
  if (!fromRef || !toRef) throw new Error("cumulative changed paths require two Git references");
  return git(workspaceRoot, ["diff", "--no-renames", "--name-only", "-z", `${fromRef}..${toRef}`], { raw: !0 }).split("\0").filter(Boolean).sort();
}
function gitStatus(workspace, args) {
  let result = spawnSync("git", ["-C", workspace, ...args], { encoding: "utf8", timeout: 12e4 });
  return result.error ? { status: null, error: result.error.message } : { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
function workspaceDeliveryMatch(workspaceRoot, deliveryCommit, deliveredPaths = []) {
  let paths = [...new Set(deliveredPaths)].sort();
  if (gitStatus(workspaceRoot, ["cat-file", "-e", `${deliveryCommit}^{commit}`]).status !== 0) return { status: "unverifiable", matched: !1, paths, reason: "delivery-commit-unavailable" };
  if (paths.length === 0) return { status: "matched", matched: !0, paths, reason: "no-delivered-paths" };
  let deliveredTree = gitStatus(workspaceRoot, ["--literal-pathspecs", "ls-tree", "-r", "-t", "--name-only", "-z", deliveryCommit, "--", ...paths]);
  if (deliveredTree.status !== 0) return { status: "unverifiable", matched: !1, paths, reason: deliveredTree.stderr?.trim() || "delivery-tree-comparison-failed" };
  let presentAtDelivery = new Set(deliveredTree.stdout.split("\0").filter(Boolean)), recreatedDeletion = !1;
  try {
    recreatedDeletion = paths.some((path) => {
      if (presentAtDelivery.has(path)) return !1;
      try {
        return lstatSync(assertContainedPath(workspaceRoot, path)), !0;
      } catch (error) {
        if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return !1;
        throw error;
      }
    });
  } catch (error) {
    return { status: "unverifiable", matched: !1, paths, reason: error.message || "delivery-deletion-comparison-failed" };
  }
  let comparison = gitStatus(workspaceRoot, ["--literal-pathspecs", "diff", "--quiet", deliveryCommit, "--", ...paths]);
  return comparison.status === 0 && !recreatedDeletion ? { status: "matched", matched: !0, paths, reason: "delivered-content-present" } : [0, 1].includes(comparison.status) ? gitStatus(workspaceRoot, ["merge-base", "--is-ancestor", deliveryCommit, "HEAD"]).status === 0 ? { status: "drifted", matched: !1, paths, reason: "integrated-content-drifted" } : { status: "not-integrated", matched: !1, paths, reason: "delivered-content-not-present" } : { status: "unverifiable", matched: !1, paths, reason: comparison.stderr?.trim() || "delivery-comparison-failed" };
}
var dependencyManifestNames = /* @__PURE__ */ new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock", "Gemfile", "Gemfile.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum"]);
function packageDependencies(value) {
  return Object.assign({}, value.dependencies, value.devDependencies, value.peerDependencies, value.optionalDependencies);
}
function detectDependencyChanges(worktreePath, baseline, paths) {
  let manifests = paths.filter((path) => dependencyManifestNames.has(path) || dependencyManifestNames.has(path.split("/").at(-1)));
  if (manifests.length === 0) return [];
  let changed = /* @__PURE__ */ new Set(), packagePaths = manifests.filter((path) => path.split("/").at(-1) === "package.json");
  for (let path of packagePaths) {
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
    let prior = packageDependencies(before), current = packageDependencies(after);
    for (let name of /* @__PURE__ */ new Set([...Object.keys(prior), ...Object.keys(current)])) prior[name] !== current[name] && changed.add(name);
  }
  let hasPackageChange = packagePaths.length > 0 && changed.size > 0;
  for (let path of manifests) {
    let name = path.split("/").at(-1);
    name !== "package.json" && (["package-lock.json", "npm-shrinkwrap.json"].includes(name) && hasPackageChange || changed.add(`unknown:${path}`));
  }
  return [...changed].sort();
}
function assertContainedPath(root, candidate) {
  let normalizedRoot = resolve2(root), normalizedCandidate = resolve2(root, candidate), rel = relative(normalizedRoot, normalizedCandidate);
  if (rel === "" || !rel.startsWith(`..${sep2}`) && rel !== ".." && !isAbsolute2(rel)) return normalizedCandidate;
  throw new Error(`path escapes root: ${candidate}`);
}
function checkpoint(worktreePath, label) {
  return git(worktreePath, ["add", "-A"]), git(worktreePath, ["diff", "--cached", "--name-only"]) ? (git(worktreePath, ["-c", "user.name=Workflow", "-c", "user.email=workflow@local.invalid", "commit", "-m", `workflow checkpoint: ${label}`]), { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: !1 }) : { commit: git(worktreePath, ["rev-parse", "HEAD"]), empty: !0 };
}
function rollbackToCheckpoint(worktreePath, commit) {
  return git(worktreePath, ["reset", "--hard", commit]), git(worktreePath, ["clean", "-fdx"]), { commit: git(worktreePath, ["rev-parse", "HEAD"]), status: git(worktreePath, ["status", "--porcelain=v1"]) };
}
function parseHostCommand(command) {
  let source = String(command).trim();
  if (!source) throw new Error("empty host check command");
  let argv = [], token = "", quote = null, escaped = !1;
  for (let character of source) {
    if (escaped) {
      token += character, escaped = !1;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = !0;
      continue;
    }
    if (quote) {
      character === quote ? quote = null : token += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      token && (argv.push(token), token = "");
      continue;
    }
    if (/[|&;<>()`$]/.test(character)) throw new Error(`shell syntax is not permitted in host checks: ${character}`);
    token += character;
  }
  if (escaped || quote) throw new Error("unterminated quote or escape in host check command");
  if (token && argv.push(token), argv.length === 0 || argv[0].includes("=")) throw new Error("host checks must begin with an executable, not an environment assignment");
  return argv;
}
function runHostCheck(worktreePath, command, timeoutMs = 3e5) {
  if (!Array.isArray(command) || command.length === 0 || command.some((value) => typeof value != "string" || value === "")) throw new Error("host checks must be non-empty argv arrays");
  let temporary = mkdtempSync(join2(tmpdir(), "workflow-host-check-")), started = Date.now();
  try {
    let profile = join2(temporary, "host-check.sb");
    writeFileSync(profile, buildSandboxProfile({ writablePaths: [temporary], network: !1 }), { mode: 384 });
    let executable = process.platform === "darwin" && existsSync2("/usr/bin/sandbox-exec") ? "/usr/bin/sandbox-exec" : null;
    if (!executable) throw new Error("hard host-check sandbox unavailable");
    let childEnvironment = [
      `PATH=${process.env.PATH}`,
      `LANG=${process.env.LANG ?? "C.UTF-8"}`,
      `LC_ALL=${process.env.LC_ALL ?? "C.UTF-8"}`,
      "CI=1",
      `TMPDIR=${temporary}`,
      `HOME=${temporary}`
    ], result = spawnSync(executable, ["-f", profile, "/usr/bin/env", "-i", ...childEnvironment, command[0], ...command.slice(1)], {
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
    rmSync(temporary, { recursive: !0, force: !0 });
  }
}

export {
  loadWorkflowConfig,
  resolveRouteProfile,
  repositoryBaseline,
  createRunWorktree,
  createComparisonBaselineWorktree,
  changedPaths,
  changedPathsBetween,
  workspaceDeliveryMatch,
  detectDependencyChanges,
  assertContainedPath,
  checkpoint,
  rollbackToCheckpoint,
  parseHostCommand,
  runHostCheck
};
