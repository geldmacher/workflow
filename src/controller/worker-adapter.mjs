import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runSandboxedProcess } from "./sandbox.mjs";
import { estimateCost } from "./policy.mjs";
import { PLUGIN_VERSION } from "./protocol.mjs";
import { currentPlatform, hashPluginTree, loadWorkerRuntimeManifest, workerRuntimeDirectory } from "./runtime.mjs";

const sdkVersion = "1.0.24";

function bundledWorkerEntrypoint() {
  const candidates = [
    fileURLToPath(new URL("./workflow-worker.mjs", import.meta.url)),
    fileURLToPath(new URL("../../dist/workflow-worker.mjs", import.meta.url)),
  ];
  const entrypoint = candidates.find(existsSync);
  if (!entrypoint) throw new Error("bundled workflow-worker.mjs is missing");
  return resolve(entrypoint);
}

export function resolveWorkerRuntime({ workerEntrypoint, runtimeRoot, pluginRoot } = {}) {
  if (workerEntrypoint) return {
    entrypoint: resolve(workerEntrypoint),
    source: "explicit-development",
    automation_eligible: false,
    manifest: null,
  };
  if (process.env.GELDMACHER_WORKFLOW_WORKER) return {
    entrypoint: resolve(process.env.GELDMACHER_WORKFLOW_WORKER),
    source: "environment-override",
    automation_eligible: false,
    manifest: null,
  };
  const runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion, platform: currentPlatform(), runtimeRoot });
  const provisioned = loadWorkerRuntimeManifest(runtimeDirectory, {
    plugin_version: PLUGIN_VERSION,
    sdk_version: sdkVersion,
    platform: currentPlatform(),
    ...(pluginRoot ? { plugin_hash: hashPluginTree(pluginRoot) } : {}),
  });
  if (provisioned.valid) return {
    entrypoint: provisioned.workerPath,
    source: "provisioned",
    automation_eligible: true,
    manifest: provisioned.manifest,
    runtime_directory: runtimeDirectory,
  };
  return {
    entrypoint: bundledWorkerEntrypoint(),
    source: "development",
    automation_eligible: false,
    manifest: null,
    reason: provisioned.reason,
    runtime_directory: runtimeDirectory,
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
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
  }).filter(([, value]) => typeof value === "string" && value !== ""));
}

export function validateRouteAgainstCatalog(route, catalog) {
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

export function configurationsMatch(requested, observed) {
  if (!requested || !observed || requested.id !== observed.id) return false;
  const normalize = (params = []) => [...params].map(({ id, value }) => [id, String(value)]).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalize(requested.params)) === JSON.stringify(normalize(observed.params));
}

export class CursorWorkerAdapter {
  constructor({ runDirectory, workerEntrypoint, runtimeRoot, pluginRoot, sandbox = runSandboxedProcess } = {}) {
    this.runDirectory = resolve(runDirectory);
    this.workerRuntime = resolveWorkerRuntime({ workerEntrypoint, runtimeRoot, pluginRoot });
    this.workerEntrypoint = this.workerRuntime.entrypoint;
    this.sandbox = sandbox;
    mkdirSync(this.runDirectory, { recursive: true, mode: 0o700 });
  }

  controlPath() { return join(this.runDirectory, "worker-control.json"); }

  runtimeProvenance() {
    return {
      source: this.workerRuntime.source,
      automation_eligible: this.workerRuntime.automation_eligible,
      worker_hash: this.workerRuntime.manifest?.worker_hash ?? null,
      runtime_hash: this.workerRuntime.manifest?.runtime_hash ?? null,
      lockfile_hash: this.workerRuntime.manifest?.lockfile_hash ?? null,
      runtime_directory: this.workerRuntime.runtime_directory ?? null,
    };
  }

  workerHome() {
    const path = join(this.runDirectory, "worker-home");
    mkdirSync(path, { recursive: true, mode: 0o700 });
    return path;
  }

  controllerStatePaths() {
    return ["run.json", "preparation.json", "events.jsonl", ".lock"].map((name) => join(this.runDirectory, name));
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
      inheritEnvironment: false,
    });
  }

  validateProfile(profile) {
    const response = this.listModels();
    if (!response.ok) return { verified: false, errors: [response.error?.message ?? "model catalog failed"], sdk_version: sdkVersion };
    const routes = {};
    const errors = [];
    for (const [role, route] of Object.entries(profile)) {
      const validation = validateRouteAgainstCatalog(route, response.models);
      routes[role] = validation;
      errors.push(...validation.errors.map((error) => `${role}: ${error}`));
    }
    return {
      verified: errors.length === 0,
      errors,
      routes,
      sdk_version: sdkVersion,
      catalog_hash: createHash("sha256").update(JSON.stringify(response.models)).digest("hex"),
    };
  }

  runPhase({ role, route, acceptedModel, prompt, cwd, mode = "agent", agentId = null, force = false, writerWritablePaths = [], writerDeniedPaths = [], timeoutMs = 300_000, cancelGraceMs = 5_000, configurationHash = null, harnessHash = null, artifactProjectionHash = null }) {
    const home = this.workerHome();
    const storePath = join(home, "cursor-store");
    mkdirSync(storePath, { recursive: true, mode: 0o700 });
    const started = new Date().toISOString();
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
        deadline_at: new Date(Date.now() + Math.max(1_000, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs,
      },
      writablePaths: [home, ...(role === "writer" || role === "writer_escalated" ? writerWritablePaths : [])],
      deniedPaths: role === "writer" || role === "writer_escalated" ? writerDeniedPaths : [],
      deniedReadPaths: this.controllerStatePaths(),
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false,
    });
    const receipt = {
      phase: role,
      started_at: started,
      finished_at: new Date().toISOString(),
      requested_model: { id: route.model_id, reasoning_effort: route.reasoning_effort, model_options: route.model_options ?? {} },
      accepted_model: acceptedModel,
      observed_model: response.observed_model ?? null,
      model_attested: configurationsMatch(acceptedModel, response.observed_model),
      sdk_version: sdkVersion,
      configuration_hash: configurationHash ?? createHash("sha256").update(JSON.stringify(route)).digest("hex"),
      route_hash: configurationHash ?? createHash("sha256").update(JSON.stringify(route)).digest("hex"),
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
      worker_provenance: this.runtimeProvenance(),
    };
    return { response, receipt };
  }


  runPlanningPhase({ route, acceptedModel, prompt, cwd, agentId = null, timeoutMs = 300_000, cancelGraceMs = 5_000, configurationHash = null, harnessHash, artifactProjectionHash = null, deniedReadPaths = [] }) {
    const home = this.workerHome();
    const storePath = join(home, "cursor-store");
    mkdirSync(storePath, { recursive: true, mode: 0o700 });
    const started = new Date().toISOString();
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
        deadline_at: new Date(Date.now() + Math.max(1_000, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs,
      },
      writablePaths: [home],
      deniedPaths: [cwd],
      deniedReadPaths: [...this.controllerStatePaths(), ...deniedReadPaths],
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false,
    });
    const receipt = {
      phase: "planner",
      started_at: started,
      finished_at: new Date().toISOString(),
      requested_model: { id: route.model_id, reasoning_effort: route.reasoning_effort, model_options: route.model_options ?? {} },
      accepted_model: acceptedModel,
      observed_model: response.observed_model ?? null,
      model_attested: configurationsMatch(acceptedModel, response.observed_model),
      sdk_version: sdkVersion,
      configuration_hash: configurationHash ?? createHash("sha256").update(JSON.stringify(route)).digest("hex"),
      route_hash: configurationHash ?? createHash("sha256").update(JSON.stringify(route)).digest("hex"),
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
      worker_provenance: this.runtimeProvenance(),
    };
    return { response, receipt, planningOutput: response.planning_output ?? null };
  }

  runCapabilityProbe({ route, acceptedModel, cwd, probe, writerWritablePaths, writerDeniedPaths, timeoutMs = 120_000, cancelGraceMs = 5_000 }) {
    const home = this.workerHome();
    const storePath = join(home, "cursor-store");
    mkdirSync(storePath, { recursive: true, mode: 0o700 });
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
        deadline_at: new Date(Date.now() + Math.max(1_000, timeoutMs - cancelGraceMs)).toISOString(),
        cancel_grace_ms: cancelGraceMs,
        probe,
      },
      writablePaths: [home, ...writerWritablePaths],
      deniedPaths: writerDeniedPaths,
      deniedReadPaths: this.controllerStatePaths(),
      network: true,
      timeoutMs,
      environment: workerEnvironment(home),
      inheritEnvironment: false,
    });
  }
}

export { sdkVersion };
