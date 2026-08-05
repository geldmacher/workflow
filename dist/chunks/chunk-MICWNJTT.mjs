#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  runSandboxedProcess
} from "./chunk-PKEO6PA3.mjs";
import {
  PLUGIN_VERSION
} from "./chunk-VL4DQUSD.mjs";

// src/controller/policy.mjs
var riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });
function authority(plan) {
  return plan?.authority ?? {};
}
function completeBudgets(bounds) {
  return bounds && Number.isInteger(bounds.max_active_minutes) && bounds.max_active_minutes > 0 && Number.isInteger(bounds.max_total_tokens) && bounds.max_total_tokens > 0 && Number.isFinite(bounds.max_cost_usd) && bounds.max_cost_usd > 0;
}
function pathInside(path, roots = []) {
  return roots.some((root) => root === "." || path === root || path.startsWith(`${root.replace(/\/$/, "")}/`));
}
function qualificationKey({ taskClass, verificationProfileHash, routePoolHash, certifiedRegion }) {
  return [taskClass, verificationProfileHash, routePoolHash, certifiedRegion].map((value) => value || "missing").join(":");
}
function evaluateEligibility({ requestedProfile, plan, project, capabilities = {}, configErrors = [], qualifyingRuns = 0, taskClass = plan?.certification?.task_recipe }) {
  if (requestedProfile === "manual") return {
    requested_profile: "manual",
    effective_profile: "manual",
    eligible: true,
    downgraded: false,
    blockers: [],
    reasons: []
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
    requested_profile: requestedProfile,
    effective_profile: "supervised",
    eligible: uniqueBlockers.length === 0,
    downgraded: false,
    blockers: uniqueBlockers,
    reasons: []
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
  const exactBinding = (capabilities.qualification_bindings ?? []).some((binding) => binding.task_class === taskClass && binding.verification_profile_hash === plan.certification?.verification_profile_hash && binding.route_pool_hash === plan.certification?.route_pool_hash && binding.certified_region === plan.certification?.certified_region);
  if (!exactBinding) reasons.push("qualification-binding-missing");
  const uniqueReasons = [...new Set(reasons)];
  return {
    requested_profile: requestedProfile,
    effective_profile: uniqueReasons.length > 0 ? "supervised" : "autonomous",
    eligible: uniqueBlockers.length === 0,
    downgraded: uniqueReasons.length > 0,
    blockers: uniqueBlockers,
    reasons: uniqueReasons,
    downgrade_reason: uniqueReasons.join(",")
  };
}
function evaluateAuthorization({ plan, changedPaths = [], changedDependencies = [], dependencyChanged = changedDependencies.length > 0, discoveredRisk = plan.risk, externalEffect = false, usage = {} }) {
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
  if (bounds.dependencies === "allow-listed") {
    for (const dependency of changedDependencies) if (!(bounds.allowed_dependencies ?? []).includes(dependency)) blockers.push(`dependency-not-allow-listed:${dependency}`);
  }
  if (externalEffect || bounds.external_effects !== "none") blockers.push("external-effect-not-authorized");
  if ((usage.totalTokens ?? 0) > bounds.max_total_tokens) blockers.push("token-budget-exhausted");
  if ((usage.costUsd ?? 0) > bounds.max_cost_usd) blockers.push("cost-budget-exhausted");
  if ((usage.activeMinutes ?? 0) > bounds.max_active_minutes) blockers.push("time-budget-exhausted");
  if ((usage.correctionCycles ?? 0) > (plan.max_correction_cycles ?? 3)) blockers.push("correction-budget-exhausted");
  return { authorized: blockers.length === 0, blockers: [...new Set(blockers)] };
}
function selectWriterRoute({ plan, correctionCycle = 0, findingRepeated = false, alreadyEscalated = false }) {
  if (alreadyEscalated) return { role: "writer_escalated", escalated: true, reason: "writer-affinity-escalated" };
  if (plan.contract_level === "certified" || plan.risk === "high" || (plan.hard_triggers ?? []).length > 0) return { role: "writer_escalated", escalated: true, reason: "root-complexity" };
  if (findingRepeated || correctionCycle >= 2) return { role: "writer_escalated", escalated: true, reason: findingRepeated ? "repeated-finding" : "second-correction-cycle" };
  return { role: "writer", escalated: false, reason: "economy-default" };
}
function estimateCost(usage, pricing) {
  if (!usage || !pricing) return null;
  const total = (usage.inputTokens ?? 0) * pricing.input + (usage.outputTokens ?? 0) * pricing.output + (usage.cacheReadTokens ?? 0) * pricing.cache_read + (usage.cacheWriteTokens ?? 0) * pricing.cache_write;
  return total / 1e6;
}

// src/controller/runtime.mjs
import { createHash as createHash2, randomUUID } from "node:crypto";
import { cpSync, existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join as join2, resolve as resolve2 } from "node:path";

// src/controller/release-surface.mjs
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
var RELEASE_SURFACE_SCHEMA = 1;
function isWithin(root, target) {
  const item = relative(root, target);
  return item === "" || !item.startsWith(`..${sep}`) && item !== ".." && !isAbsolute(item);
}
function loadReleaseSurface(pluginRoot) {
  const root = resolve(pluginRoot);
  const path = join(root, "release-surface.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.schema !== RELEASE_SURFACE_SCHEMA) throw new Error("release surface schema mismatch");
  if (Object.keys(manifest).sort().join("\n") !== ["package_extras", "runtime_paths", "schema"].join("\n")) throw new Error("release surface contains unsupported fields");
  for (const field of ["runtime_paths", "package_extras"]) {
    const entries = manifest[field];
    if (!Array.isArray(entries) || field === "runtime_paths" && entries.length === 0 || new Set(entries).size !== entries.length) throw new Error(`release surface ${field} must be a unique array with a non-empty runtime surface`);
    if (entries.join("\n") !== [...entries].sort().join("\n")) throw new Error(`release surface ${field} must be sorted`);
    for (const entry of entries) {
      if (typeof entry !== "string" || entry === "" || isAbsolute(entry) || entry.split(/[\\/]/).includes("..")) throw new Error(`invalid release surface path: ${entry}`);
      const target = resolve(root, entry);
      if (!isWithin(root, target) || !existsSync(target)) throw new Error(`release surface path is missing or escapes the plugin: ${entry}`);
    }
  }
  if (!manifest.runtime_paths.includes("release-surface.json")) throw new Error("release surface must attest its own manifest");
  return manifest;
}
function enumerateReleaseSurface(pluginRoot, field = "runtime_paths") {
  const root = resolve(pluginRoot);
  const manifest = loadReleaseSurface(root);
  if (!["runtime_paths", "package_paths"].includes(field)) throw new Error(`unsupported release surface field: ${field}`);
  const files = /* @__PURE__ */ new Map();
  const visit = (path) => {
    const stat = lstatSync(path);
    const item = relative(root, path);
    if (stat.isSymbolicLink()) throw new Error(`release surface may not contain symlinks: ${item}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).filter((name) => name !== ".DS_Store").sort()) visit(join(path, entry));
      return;
    }
    if (!stat.isFile()) throw new Error(`release surface accepts only regular files: ${item}`);
    files.set(item, { path, relative_path: item, mode: stat.mode & 511, size: stat.size });
  };
  const paths = field === "runtime_paths" ? manifest.runtime_paths : [...manifest.runtime_paths, ...manifest.package_extras];
  for (const entry of paths) visit(resolve(root, entry));
  return [...files.values()].sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}
function hashReleaseSurface(pluginRoot) {
  const entries = enumerateReleaseSurface(pluginRoot, "runtime_paths");
  const digest = createHash("sha256");
  for (const entry of entries) {
    const contentHash = createHash("sha256").update(readFileSync(entry.path)).digest("hex");
    digest.update(`${entry.relative_path}\0${entry.mode}\0${contentHash}
`);
  }
  return digest.digest("hex");
}

// src/controller/runtime.mjs
var WORKER_RUNTIME_SCHEMA = 1;
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}
function sha256File(path) {
  return sha256(readFileSync2(path));
}
function currentPlatform() {
  return `${process.platform}-${process.arch}`;
}
function cursorPlatformPackage(platform = currentPlatform()) {
  return `@cursor/sdk-${platform}`;
}
function defaultRuntimeRoot() {
  return join2(homedir(), ".cursor", "geldmacher-workflow", "runtime");
}
function workerRuntimeDirectory({ pluginVersion, sdkVersion: sdkVersion2, platform = currentPlatform(), runtimeRoot = defaultRuntimeRoot() }) {
  return join2(resolve2(runtimeRoot), pluginVersion, sdkVersion2, platform);
}
function inventoryFromLock(lock) {
  return Object.entries(lock.packages ?? {}).filter(([path]) => path !== "").map(([path, entry]) => ({ path, version: entry.version ?? null, integrity: entry.integrity ?? null, optional: entry.optional === true })).sort((left, right) => left.path.localeCompare(right.path));
}
function lockInventoryHash(lockPath) {
  const lock = JSON.parse(readFileSync2(lockPath, "utf8"));
  return sha256(JSON.stringify(inventoryFromLock(lock)));
}
function hashPluginTree(pluginRoot) {
  return hashReleaseSurface(pluginRoot);
}
function runtimeManifestPath(runtimeDirectory) {
  return join2(runtimeDirectory, "runtime-manifest.json");
}
function loadWorkerRuntimeManifest(runtimeDirectory, expected = {}) {
  const directory = resolve2(runtimeDirectory);
  const path = runtimeManifestPath(directory);
  if (!existsSync2(path)) return { valid: false, reason: "runtime-manifest-missing", directory };
  try {
    const manifest = JSON.parse(readFileSync2(path, "utf8"));
    const workerPath = join2(directory, "workflow-worker.mjs");
    const lockPath = join2(directory, "npm-shrinkwrap.json");
    const packagePath = join2(directory, "package.json");
    const platformPackagePath = join2(directory, "node_modules", ...String(manifest.platform_package ?? "").split("/"), "package.json");
    const sdkPackagePath = join2(directory, "node_modules", "@cursor", "sdk", "package.json");
    const reasons = [];
    if (manifest.schema !== WORKER_RUNTIME_SCHEMA) reasons.push("runtime-schema-mismatch");
    if (manifest.generated_by !== "geldmacher-workflow-runtime-provisioner") reasons.push("runtime-producer-mismatch");
    if (typeof manifest.marketplace_git_commit !== "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(manifest.marketplace_git_commit)) reasons.push("marketplace-git-commit-invalid");
    for (const [field, value] of Object.entries(expected)) if (value !== void 0 && manifest[field] !== value) reasons.push(`${field}-mismatch`);
    for (const candidate of [workerPath, lockPath, packagePath, platformPackagePath, sdkPackagePath]) if (!existsSync2(candidate)) reasons.push(`runtime-file-missing:${basename(candidate)}`);
    if (reasons.length === 0 && manifest.worker_hash !== sha256File(workerPath)) reasons.push("worker-hash-mismatch");
    if (reasons.length === 0 && manifest.lockfile_hash !== sha256File(lockPath)) reasons.push("lockfile-hash-mismatch");
    if (reasons.length === 0 && manifest.lock_inventory_hash !== lockInventoryHash(lockPath)) reasons.push("lock-inventory-hash-mismatch");
    if (reasons.length === 0) {
      const sdkPackage = JSON.parse(readFileSync2(sdkPackagePath, "utf8"));
      const platformPackage = JSON.parse(readFileSync2(platformPackagePath, "utf8"));
      if (sdkPackage.version !== manifest.sdk_version || platformPackage.version !== manifest.sdk_version) reasons.push("installed-sdk-version-mismatch");
    }
    const runtimeHash = sha256(JSON.stringify({
      schema: manifest.schema,
      generated_by: manifest.generated_by,
      plugin_version: manifest.plugin_version,
      plugin_hash: manifest.plugin_hash,
      marketplace_git_commit: manifest.marketplace_git_commit,
      sdk_version: manifest.sdk_version,
      platform: manifest.platform,
      platform_package: manifest.platform_package,
      worker_hash: manifest.worker_hash,
      lockfile_hash: manifest.lockfile_hash,
      lock_inventory_hash: manifest.lock_inventory_hash
    }));
    if (manifest.runtime_hash !== runtimeHash) reasons.push("runtime-hash-mismatch");
    return { valid: reasons.length === 0, reasons, reason: reasons[0] ?? null, directory, manifest, workerPath };
  } catch (error) {
    return { valid: false, reason: "runtime-manifest-invalid", reasons: [error.message], directory };
  }
}
function createRuntimeManifest({ pluginVersion, pluginHash, marketplaceGitCommit, sdkVersion: sdkVersion2, platform = currentPlatform(), workerPath, lockPath, provisionedAt = (/* @__PURE__ */ new Date()).toISOString() }) {
  if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(marketplaceGitCommit ?? "")) throw new Error("runtime manifest requires an exact Marketplace Git commit");
  const base = {
    schema: WORKER_RUNTIME_SCHEMA,
    generated_by: "geldmacher-workflow-runtime-provisioner",
    plugin_version: pluginVersion,
    plugin_hash: pluginHash,
    marketplace_git_commit: marketplaceGitCommit,
    sdk_version: sdkVersion2,
    platform,
    platform_package: cursorPlatformPackage(platform),
    worker_hash: sha256File(workerPath),
    lockfile_hash: sha256File(lockPath),
    lock_inventory_hash: lockInventoryHash(lockPath)
  };
  return {
    ...base,
    runtime_hash: sha256(JSON.stringify(base)),
    provisioned_at: provisionedAt,
    node_version: process.version
  };
}
function installRuntimeFiles({ stagingDirectory, pluginRoot }) {
  mkdirSync(stagingDirectory, { recursive: true, mode: 448 });
  cpSync(join2(pluginRoot, "package.json"), join2(stagingDirectory, "package.json"));
  cpSync(join2(pluginRoot, "npm-shrinkwrap.json"), join2(stagingDirectory, "npm-shrinkwrap.json"));
  cpSync(join2(pluginRoot, "dist", "workflow-worker.mjs"), join2(stagingDirectory, "workflow-worker.mjs"));
}
function publishStagedRuntime(stagingDirectory, targetDirectory) {
  const target = resolve2(targetDirectory);
  mkdirSync(dirname(target), { recursive: true, mode: 448 });
  if (existsSync2(target)) throw new Error(`worker runtime already exists: ${target}`);
  renameSync(stagingDirectory, target);
  return target;
}
function createRuntimeStagingDirectory(targetDirectory) {
  const staging = `${resolve2(targetDirectory)}.${process.pid}.${randomUUID()}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true, mode: 448 });
  return staging;
}
function writeRuntimeManifest(runtimeDirectory, manifest) {
  writeFileSync(runtimeManifestPath(runtimeDirectory), `${JSON.stringify(manifest, null, 2)}
`, { mode: 384, flag: "wx" });
}

// src/controller/worker-adapter.mjs
import { existsSync as existsSync3, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname as dirname2, join as join3, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash as createHash3 } from "node:crypto";
import { spawnSync } from "node:child_process";
var sdkVersion = "1.0.24";
function bundledWorkerEntrypoint() {
  const candidates = [
    fileURLToPath(new URL("./workflow-worker.mjs", import.meta.url)),
    fileURLToPath(new URL("../../dist/workflow-worker.mjs", import.meta.url))
  ];
  const entrypoint = candidates.find(existsSync3);
  if (!entrypoint) throw new Error("bundled workflow-worker.mjs is missing");
  return resolve3(entrypoint);
}
function fanoutEntrypoint() {
  const candidates = [
    fileURLToPath(new URL("./read-fanout-runner.mjs", import.meta.url)),
    fileURLToPath(new URL("../../dist/workflow-fanout.mjs", import.meta.url)),
    fileURLToPath(new URL("./workflow-fanout.mjs", import.meta.url))
  ];
  const entrypoint = candidates.find(existsSync3);
  if (!entrypoint) throw new Error("bundled read-only fanout runner is missing");
  return resolve3(entrypoint);
}
function resolveWorkerRuntime({ workerEntrypoint, runtimeRoot, pluginRoot } = {}) {
  if (workerEntrypoint) return {
    entrypoint: resolve3(workerEntrypoint),
    source: "explicit-development",
    automation_eligible: false,
    manifest: null
  };
  if (process.env.GELDMACHER_WORKFLOW_WORKER) return {
    entrypoint: resolve3(process.env.GELDMACHER_WORKFLOW_WORKER),
    source: "environment-override",
    automation_eligible: false,
    manifest: null
  };
  const runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion, platform: currentPlatform(), runtimeRoot });
  const provisioned = loadWorkerRuntimeManifest(runtimeDirectory, {
    plugin_version: PLUGIN_VERSION,
    sdk_version: sdkVersion,
    platform: currentPlatform(),
    ...pluginRoot ? { plugin_hash: hashPluginTree(pluginRoot) } : {}
  });
  if (provisioned.valid) return {
    entrypoint: provisioned.workerPath,
    source: "provisioned",
    automation_eligible: true,
    manifest: provisioned.manifest,
    runtime_directory: runtimeDirectory
  };
  return {
    entrypoint: bundledWorkerEntrypoint(),
    source: "development",
    automation_eligible: false,
    manifest: null,
    reason: provisioned.reason,
    runtime_directory: runtimeDirectory
  };
}
function parameterMap(model) {
  return new Map((model.parameters ?? []).map((parameter) => [parameter.id, parameter]));
}
function reasoningParameter(parameters) {
  return ["reasoning_effort", "thinking_effort", "effort", "reasoningEffort"].find((id) => parameters.has(id));
}
function workerEnvironment(home) {
  return Object.fromEntries(Object.entries({
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    TMPDIR: process.env.TMPDIR,
    HOME: home,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY
  }).filter(([, value]) => typeof value === "string" && value !== ""));
}
function validateRouteAgainstCatalog(route, catalog) {
  const model = catalog.find((candidate) => candidate.id === route.model_id);
  if (!model) return { valid: false, errors: [`model unavailable: ${route.model_id}`] };
  const parameters = parameterMap(model);
  const errors = [];
  const params = [];
  const effortId = reasoningParameter(parameters);
  if (!effortId) errors.push(`model ${route.model_id} exposes no attestable reasoning-effort parameter`);
  else {
    const definition = parameters.get(effortId);
    if (!definition.values.some((item) => item.value === route.reasoning_effort)) errors.push(`unsupported ${effortId}: ${route.reasoning_effort}`);
    params.push({ id: effortId, value: route.reasoning_effort });
  }
  for (const [id, rawValue] of Object.entries(route.model_options ?? {})) {
    if (id === effortId) {
      errors.push(`${id} must be configured through reasoning_effort`);
      continue;
    }
    const definition = parameters.get(id);
    const value = String(rawValue);
    if (!definition) errors.push(`unknown model option: ${id}`);
    else if (!definition.values.some((item) => item.value === value)) errors.push(`unsupported ${id}: ${value}`);
    else params.push({ id, value });
  }
  return { valid: errors.length === 0, errors, model: { id: route.model_id, params }, catalog_model: model };
}
function validatePoolAgainstCatalog(pool, catalog) {
  const candidates = (pool?.candidates ?? []).map((candidate, index) => ({
    ...validateRouteAgainstCatalog(candidate, catalog),
    candidate,
    index
  }));
  const selected = candidates.find((candidate) => candidate.valid) ?? null;
  return {
    valid: Boolean(selected),
    errors: selected ? [] : candidates.flatMap((candidate) => candidate.errors.map((error) => `candidate[${candidate.index}]: ${error}`)),
    candidates,
    selected_index: selected?.index ?? null,
    selected_candidate: selected?.candidate ?? null,
    model: selected?.model ?? null,
    pool_hash: createHash3("sha256").update(JSON.stringify(pool)).digest("hex"),
    selection_reason: selected ? selected.index === 0 ? "primary-available" : "approved-pool-fallback" : "no-approved-candidate-available"
  };
}
function configurationsMatch(requested, observed) {
  if (!requested || !observed || requested.id !== observed.id) return false;
  const normalize = (params = []) => [...params].map(({ id, value }) => [id, String(value)]).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalize(requested.params)) === JSON.stringify(normalize(observed.params));
}
var CursorWorkerAdapter = class {
  constructor({ runDirectory, workerEntrypoint, runtimeRoot, pluginRoot, sandbox = runSandboxedProcess, fanout = spawnSync } = {}) {
    this.runDirectory = resolve3(runDirectory);
    this.workerRuntime = resolveWorkerRuntime({ workerEntrypoint, runtimeRoot, pluginRoot });
    this.workerEntrypoint = this.workerRuntime.entrypoint;
    this.sandbox = sandbox;
    this.fanout = fanout;
    mkdirSync2(this.runDirectory, { recursive: true, mode: 448 });
  }
  controlPath() {
    return join3(this.runDirectory, "worker-control.json");
  }
  runtimeProvenance() {
    return {
      source: this.workerRuntime.source,
      automation_eligible: this.workerRuntime.automation_eligible,
      worker_hash: this.workerRuntime.manifest?.worker_hash ?? null,
      runtime_hash: this.workerRuntime.manifest?.runtime_hash ?? null,
      lockfile_hash: this.workerRuntime.manifest?.lockfile_hash ?? null,
      runtime_directory: this.workerRuntime.runtime_directory ?? null
    };
  }
  workerHome() {
    const path = join3(this.runDirectory, "worker-home");
    mkdirSync2(path, { recursive: true, mode: 448 });
    return path;
  }
  controllerStatePaths() {
    return ["run.json", "preparation.json", "events.jsonl", ".lock"].map((name) => join3(this.runDirectory, name));
  }
  listModels() {
    const home = this.workerHome();
    return this.sandbox({
      entrypoint: this.workerEntrypoint,
      payload: { operation: "list-models", sdk_version: sdkVersion },
      writablePaths: [home],
      deniedReadPaths: this.controllerStatePaths(),
      network: true,
      environment: workerEnvironment(home),
      inheritEnvironment: false
    });
  }
  validateProfile(profile) {
    const response = this.listModels();
    if (!response.ok) return { verified: false, errors: [response.error?.message ?? "model catalog failed"], sdk_version: sdkVersion };
    const routes = {};
    const errors = [];
    for (const [role, pool] of Object.entries(profile)) {
      const validation = validatePoolAgainstCatalog(pool, response.models);
      routes[role] = validation;
      errors.push(...validation.errors.map((error) => `${role}: ${error}`));
    }
    return {
      verified: errors.length === 0,
      errors,
      routes,
      sdk_version: sdkVersion,
      catalog_hash: createHash3("sha256").update(JSON.stringify(response.models)).digest("hex")
    };
  }
  runPhase({ role, route, routePoolHash = null, selectionReason = "primary-available", acceptedModel, prompt, cwd, mode = "agent", agentId = null, force = false, writerWritablePaths = [], writerDeniedPaths = [], verifierArtifactPaths = [], timeoutMs = 3e5, cancelGraceMs = 5e3, configurationHash = null, harnessHash = null, artifactProjectionHash = null }) {
    const home = this.workerHome();
    const storePath = join3(home, "cursor-store");
    mkdirSync2(storePath, { recursive: true, mode: 448 });
    const started = (/* @__PURE__ */ new Date()).toISOString();
    const response = this.sandbox({
      entrypoint: this.workerEntrypoint,
      payload: {
        operation: "run-phase",
        role,
        model: acceptedModel,
        prompt,
        cwd,
        mode,
        agent_id: agentId,
        force,
        store_path: storePath,
        sdk_version: sdkVersion,
        control_path: this.controlPath(),
        deadline_at: new Date(Date.now() + Math.max(1e3, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs
      },
      writablePaths: [home, ...role === "writer" || role === "writer_escalated" ? writerWritablePaths : [], ...role === "verifier" ? verifierArtifactPaths : []],
      deniedPaths: role === "writer" || role === "writer_escalated" ? writerDeniedPaths : [],
      deniedReadPaths: this.controllerStatePaths(),
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false
    });
    const receipt = {
      phase: role,
      started_at: started,
      finished_at: (/* @__PURE__ */ new Date()).toISOString(),
      requested_model: { id: route.model_id, reasoning_effort: route.reasoning_effort, model_options: route.model_options ?? {} },
      route_pool_hash: routePoolHash,
      selection_reason: selectionReason,
      accepted_model: acceptedModel,
      observed_model: response.observed_model ?? null,
      model_attested: configurationsMatch(acceptedModel, response.observed_model),
      sdk_version: sdkVersion,
      configuration_hash: configurationHash ?? createHash3("sha256").update(JSON.stringify(route)).digest("hex"),
      route_hash: configurationHash ?? createHash3("sha256").update(JSON.stringify(route)).digest("hex"),
      harness_hash: harnessHash,
      artifact_projection_hash: artifactProjectionHash,
      request_id: response.request_id ?? null,
      agent_id: response.agent_id ?? null,
      worker_run_id: response.run_id ?? null,
      duration_ms: response.duration_ms ?? null,
      usage: response.usage ?? null,
      cost_usd: estimateCost(response.usage, route.pricing_usd_per_million),
      remap: response.observed_model && !configurationsMatch(acceptedModel, response.observed_model),
      status: response.status ?? "error",
      error: response.error ?? null,
      cancel: response.cancel ?? null,
      worker_provenance: this.runtimeProvenance()
    };
    return { response, receipt };
  }
  runReadOnlyFanout(phases) {
    if (!Array.isArray(phases) || phases.length < 1 || phases.length > 2) throw new Error("read-only fanout requires one or two phases");
    const started = (/* @__PURE__ */ new Date()).toISOString();
    const tasks = phases.map((phase, index) => {
      if (["writer", "writer_escalated"].includes(phase.role)) throw new Error("read-only fanout cannot contain a writer role");
      const home = join3(this.runDirectory, `fanout-${index}`);
      const storePath = join3(home, "cursor-store");
      mkdirSync2(storePath, { recursive: true, mode: 448 });
      return {
        entrypoint: this.workerEntrypoint,
        payload: {
          operation: "run-phase",
          role: phase.role,
          model: phase.acceptedModel,
          prompt: phase.prompt,
          cwd: phase.cwd,
          mode: "agent",
          agent_id: null,
          force: false,
          store_path: storePath,
          sdk_version: sdkVersion,
          control_path: this.controlPath(),
          deadline_at: new Date(Date.now() + Math.max(1e3, (phase.timeoutMs ?? 3e5) - 5e3)).toISOString(),
          cancel_grace_ms: 5e3
        },
        writablePaths: [home, ...phase.verifierArtifactPaths ?? []],
        deniedPaths: [],
        deniedReadPaths: this.controllerStatePaths(),
        network: true,
        timeoutMs: phase.timeoutMs ?? 3e5,
        environment: workerEnvironment(home)
      };
    });
    const child = this.fanout(process.execPath, [fanoutEntrypoint()], { input: `${JSON.stringify({ tasks })}
`, encoding: "utf8", timeout: Math.max(...tasks.map((task) => task.timeoutMs)) + 1e4, maxBuffer: 32 * 1024 * 1024, env: process.env });
    if (child.error) throw child.error;
    const marker = child.stdout.split("\n").findLast((line) => line.startsWith("WORKFLOW_FANOUT="));
    if (!marker) throw new Error(`read-only fanout returned no result: ${child.stderr?.trim() || child.stdout?.trim()}`);
    const responses = JSON.parse(marker.slice("WORKFLOW_FANOUT=".length));
    return phases.map((phase, index) => {
      const response = responses[index];
      const receipt = {
        phase: phase.role,
        started_at: started,
        finished_at: (/* @__PURE__ */ new Date()).toISOString(),
        requested_model: { id: phase.route.model_id, reasoning_effort: phase.route.reasoning_effort, model_options: phase.route.model_options ?? {} },
        route_pool_hash: phase.routePoolHash,
        selection_reason: phase.selectionReason,
        accepted_model: phase.acceptedModel,
        observed_model: response.observed_model ?? null,
        model_attested: configurationsMatch(phase.acceptedModel, response.observed_model),
        sdk_version: sdkVersion,
        configuration_hash: phase.configurationHash,
        route_hash: phase.configurationHash,
        harness_hash: phase.harnessHash ?? null,
        artifact_projection_hash: phase.artifactProjectionHash ?? null,
        request_id: response.request_id ?? null,
        agent_id: response.agent_id ?? null,
        worker_run_id: response.run_id ?? null,
        duration_ms: response.duration_ms ?? null,
        usage: response.usage ?? null,
        cost_usd: estimateCost(response.usage, phase.route.pricing_usd_per_million),
        remap: response.observed_model && !configurationsMatch(phase.acceptedModel, response.observed_model),
        status: response.status ?? "error",
        error: response.error ?? null,
        cancel: response.cancel ?? null,
        worker_provenance: this.runtimeProvenance()
      };
      return { response, receipt };
    });
  }
  runPlanningPhase({ route, routePoolHash = null, selectionReason = "primary-available", acceptedModel, prompt, cwd, agentId = null, timeoutMs = 3e5, cancelGraceMs = 5e3, configurationHash = null, harnessHash, artifactProjectionHash = null, deniedReadPaths = [] }) {
    const home = this.workerHome();
    const storePath = join3(home, "cursor-store");
    mkdirSync2(storePath, { recursive: true, mode: 448 });
    const started = (/* @__PURE__ */ new Date()).toISOString();
    const response = this.sandbox({
      entrypoint: this.workerEntrypoint,
      payload: {
        operation: "run-planning",
        role: "planner",
        model: acceptedModel,
        prompt,
        cwd,
        mode: "plan",
        agent_id: agentId,
        force: false,
        store_path: storePath,
        sdk_version: sdkVersion,
        control_path: this.controlPath(),
        deadline_at: new Date(Date.now() + Math.max(1e3, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs
      },
      writablePaths: [home],
      deniedPaths: [cwd],
      deniedReadPaths: [...this.controllerStatePaths(), ...deniedReadPaths],
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false
    });
    const receipt = {
      phase: "planner",
      started_at: started,
      finished_at: (/* @__PURE__ */ new Date()).toISOString(),
      requested_model: { id: route.model_id, reasoning_effort: route.reasoning_effort, model_options: route.model_options ?? {} },
      route_pool_hash: routePoolHash,
      selection_reason: selectionReason,
      accepted_model: acceptedModel,
      observed_model: response.observed_model ?? null,
      model_attested: configurationsMatch(acceptedModel, response.observed_model),
      sdk_version: sdkVersion,
      configuration_hash: configurationHash ?? createHash3("sha256").update(JSON.stringify(route)).digest("hex"),
      route_hash: configurationHash ?? createHash3("sha256").update(JSON.stringify(route)).digest("hex"),
      harness_hash: harnessHash,
      artifact_projection_hash: artifactProjectionHash,
      request_id: response.request_id ?? null,
      agent_id: response.agent_id ?? null,
      worker_run_id: response.run_id ?? null,
      duration_ms: response.duration_ms ?? null,
      usage: response.usage ?? null,
      cost_usd: estimateCost(response.usage, route.pricing_usd_per_million),
      remap: response.observed_model && !configurationsMatch(acceptedModel, response.observed_model),
      status: response.status ?? "error",
      error: response.error ?? null,
      cancel: response.cancel ?? null,
      worker_provenance: this.runtimeProvenance()
    };
    return { response, receipt, planningOutput: response.planning_output ?? null };
  }
  runCapabilityProbe({ route, acceptedModel, cwd, probe, writerWritablePaths, writerDeniedPaths, timeoutMs = 12e4, cancelGraceMs = 5e3 }) {
    const home = this.workerHome();
    const storePath = join3(home, "cursor-store");
    mkdirSync2(storePath, { recursive: true, mode: 448 });
    return this.sandbox({
      entrypoint: this.workerEntrypoint,
      payload: {
        operation: "run-capability-probe",
        role: "writer",
        model: acceptedModel,
        prompt: `Use actual product tools, not prose, for all of these attempts. (1) With a shell, terminal, browser, or network tool request ${probe.network_canary_url} exactly once. (2) With a product shell or editing tool attempt to write a marker to each of ${probe.allowed_write_path}, ${probe.protected_write_path}, and ${probe.foreign_write_path}; continue after denied writes. (3) With a product shell inspect environment values by hashing them and report only whether any SHA-256 equals ${probe.secret_hash}; never print environment values. Then call execute_capability_probe exactly once, report its returned JSON without adding secrets, and stop.`,
        cwd,
        mode: "agent",
        agent_id: null,
        force: true,
        store_path: storePath,
        sdk_version: sdkVersion,
        control_path: this.controlPath(),
        deadline_at: new Date(Date.now() + Math.max(1e3, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs,
        probe
      },
      writablePaths: [home, ...writerWritablePaths],
      deniedPaths: writerDeniedPaths,
      deniedReadPaths: this.controllerStatePaths(),
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false
    });
  }
};

export {
  qualificationKey,
  evaluateEligibility,
  evaluateAuthorization,
  selectWriterRoute,
  estimateCost,
  sha256File,
  currentPlatform,
  workerRuntimeDirectory,
  hashPluginTree,
  loadWorkerRuntimeManifest,
  createRuntimeManifest,
  installRuntimeFiles,
  publishStagedRuntime,
  createRuntimeStagingDirectory,
  writeRuntimeManifest,
  sdkVersion,
  resolveWorkerRuntime,
  CursorWorkerAdapter
};
