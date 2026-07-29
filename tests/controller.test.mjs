import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadWorkflowConfig, validateWorkflowConfig, validateProjectPolicy } from "../src/controller/config.mjs";
import { evaluateAuthorization, evaluateEligibility, selectWriterRoute } from "../src/controller/policy.mjs";
import { buildSandboxProfile, probeSandboxBoundary } from "../src/controller/sandbox.mjs";
import { RunStore } from "../src/controller/store.mjs";
import { parseHostCommand, runHostCheck } from "../src/controller/worktree.mjs";
import { configurationsMatch, CursorWorkerAdapter, validateRouteAgainstCatalog } from "../src/controller/worker-adapter.mjs";
import { loadCapabilityReceipt, receiptAutomationSafe, validateCapabilityReceipt } from "../src/controller/capabilities.mjs";
import { WorkflowEngine } from "../src/controller/engine.mjs";
import { runView } from "../src/controller/protocol.mjs";
import { createRuntimeManifest, loadWorkerRuntimeManifest, writeRuntimeManifest } from "../src/controller/runtime.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);

function route() {
  return {
    model_id: "cursor-model-2026-07-01",
    reasoning_effort: "high",
    model_options: { max_mode: true },
    fallback: "deny",
    pricing_usd_per_million: { input: 1, output: 2, cache_read: 0.1, cache_write: 0.2 },
  };
}

function planningBudget() {
  return { max_active_minutes: 5, max_total_tokens: 10_000, max_cost_usd: 1, max_validation_repairs: 1 };
}

function bounds() {
  return {
    allowed_targets: ["src"], max_risk: "medium", dependencies: "deny", external_effects: "none", delivery: "repository-only",
    max_active_minutes: 20, max_total_tokens: 20_000, max_cost_usd: 2, max_correction_cycles: 2, max_writer_escalations: 1,
  };
}

function project(overrides = {}) {
  return {
    schema: 1, automation_enabled: true, unattended_enabled: false, allowed_write_roots: ["src"], protected_paths: [".git"],
    protected_oracles: [], certified_regions: [], harness_version: null, minimum_qualifying_runs: null, qualifying_runs: 0,
    dependencies: "deny", external_effects: "none", ...overrides,
    max_risk: overrides.max_risk ?? "high", maximum_budgets: overrides.maximum_budgets ?? null,
  };
}

test("routing config requires every concrete fallback-deny role and enforceable pricing", () => {
  const profile = Object.fromEntries(["planner", "writer", "writer_escalated", "reviewer", "explainer"].map((roleName) => [roleName, route()]));
  assert.deepEqual(validateWorkflowConfig({ schema: 1, route_profiles: { default: profile }, planning_preflight_budget: planningBudget() }), []);
  profile.writer.fallback = "allow";
  profile.reviewer.pricing_usd_per_million = null;
  const errors = validateWorkflowConfig({ schema: 1, route_profiles: { default: profile }, planning_preflight_budget: planningBudget() }).join("\n");
  assert.match(errors, /writer\.fallback must be deny/);
  assert.match(errors, /reviewer\.pricing_usd_per_million is required/);
});

test("configuration is closed except for extensions and scalar model_options", () => {
  const profile = Object.fromEntries(["planner", "writer", "writer_escalated", "reviewer", "explainer"].map((roleName) => [roleName, route()]));
  assert.deepEqual(validateWorkflowConfig({ schema: 1, route_profiles: { default: profile }, planning_preflight_budget: planningBudget(), extensions: { owner: "team" } }), []);
  assert.match(validateWorkflowConfig({ schema: 1, route_profiles: { default: profile }, planning_preflight_budget: planningBudget(), mystery: true }).join("\n"), /unknown field mystery/);
  const routeUnknown = structuredClone(profile);
  routeUnknown.writer.unknown = true;
  assert.match(validateWorkflowConfig({ schema: 1, route_profiles: { default: routeUnknown }, planning_preflight_budget: planningBudget() }).join("\n"), /writer has unknown field unknown/);
  const pricingUnknown = structuredClone(profile);
  pricingUnknown.reviewer.pricing_usd_per_million.unknown = 1;
  assert.match(validateWorkflowConfig({ schema: 1, route_profiles: { default: pricingUnknown }, planning_preflight_budget: planningBudget() }).join("\n"), /pricing_usd_per_million has unknown field unknown/);
});

test("project policy fails closed before automation or unattended eligibility", () => {
  assert.deepEqual(validateProjectPolicy(project()), []);
  const errors = validateProjectPolicy(project({ unattended_enabled: true })).join("\n");
  assert.match(errors, /protected_oracles/);
  assert.match(errors, /certified_regions/);
  assert.match(errors, /harness_version/);
  assert.match(errors, /minimum_qualifying_runs/);
  assert.match(validateProjectPolicy(project({ allowed_write_roots: ["../outside"] })).join("\n"), /repository-relative/);
});

test("project policy cannot remove immutable git and policy-file protections", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-policy-test-"));
  try {
    const policyPath = join(directory, "policy.yaml");
    writeFileSync(policyPath, "schema: 1\nprotected_paths: []\n");
    const config = loadWorkflowConfig(directory, { userConfigPath: join(directory, "missing-user.yaml"), projectPolicyPath: policyPath });
    assert.ok(config.project.protected_paths.includes(".git"));
    assert.ok(config.project.protected_paths.includes(".cursor/workflow-policy.yaml"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("raw project policy rejects unknown fields but accepts extensions", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-policy-shape-test-"));
  try {
    const userPath = join(directory, "config.yaml");
    const policyPath = join(directory, "policy.yaml");
    writeFileSync(userPath, "schema: 1\nroute_profiles: {}\n");
    writeFileSync(policyPath, "schema: 1\nextensions:\n  owner: team\nunknown_policy: true\n");
    const invalid = loadWorkflowConfig(directory, { userConfigPath: userPath, projectPolicyPath: policyPath });
    assert.match(invalid.errors.join("\n"), /project policy has unknown field unknown_policy/);
    writeFileSync(policyPath, "schema: 1\nextensions:\n  owner: team\n");
    const validShape = loadWorkflowConfig(directory, { userConfigPath: userPath, projectPolicyPath: policyPath });
    assert.ok(validShape.errors.every((error) => !/project policy/.test(error)));
    assert.equal(validShape.project.extensions.owner, "team");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("SDK worker does not inherit project, user, team, or plugin setting sources", () => {
  const source = readFileSync(join(root, "src", "worker", "cursor-worker.mjs"), "utf8");
  assert.match(source, /settingSources:\s*\[\]/);
});

test("Planner sandbox separates SDK storage from controller state and inherits only a minimal environment", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-planner-sandbox-test-"));
  const previous = process.env.WORKFLOW_TEST_CONTROLLER_SECRET;
  try {
    process.env.WORKFLOW_TEST_CONTROLLER_SECRET = "must-not-cross";
    writeFileSync(join(directory, "preparation.json"), "{}\n");
    let invocation;
    const acceptedModel = { id: route().model_id, params: [{ id: "reasoning_effort", value: "high" }, { id: "max_mode", value: "true" }] };
    const adapter = new CursorWorkerAdapter({
      runDirectory: directory,
      workerEntrypoint: join(root, "dist", "workflow-worker.mjs"),
      sandbox(input) {
        invocation = input;
        return {
          ok: true, observed_model: acceptedModel, request_id: "request", agent_id: "agent", run_id: "worker-run",
          duration_ms: 1, usage: { totalTokens: 1 }, status: "finished", planning_output: { kind: "root", root_plan_text: "root" },
        };
      },
    });
    adapter.runPlanningPhase({ route: route(), acceptedModel, prompt: "plan", cwd: root, configurationHash: "route-hash", harnessHash: "harness-hash" });
    assert.equal(invocation.inheritEnvironment, false);
    assert.equal(invocation.environment.WORKFLOW_TEST_CONTROLLER_SECRET, undefined);
    assert.deepEqual(invocation.writablePaths, [join(directory, "worker-home")]);
    assert.ok(invocation.deniedReadPaths.includes(join(directory, "preparation.json")));
    assert.ok(invocation.deniedPaths.includes(root));
    assert.equal(invocation.payload.control_path, join(directory, "worker-control.json"));
    assert.ok(Date.parse(invocation.payload.deadline_at) > Date.now());
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_TEST_CONTROLLER_SECRET;
    else process.env.WORKFLOW_TEST_CONTROLLER_SECRET = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("worker uses cooperative SDK cancellation and emits terminal cancel evidence", () => {
  const source = readFileSync(join(root, "src", "worker", "cursor-worker.mjs"), "utf8");
  assert.match(source, /await run\.cancel\(\)/);
  assert.match(source, /terminal_status: result\.status/);
  assert.match(source, /within_grace_period/);
});

test("capability receipt schema 2 is closed, hash-bound, expiring, and rejects schema 1", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-capability-receipt-test-"));
  try {
    const path = join(directory, "capability-receipt.json");
    writeFileSync(path, JSON.stringify({ schema: 1, automation_safe: true }));
    assert.equal(loadCapabilityReceipt(directory), null);
    const hash = "a".repeat(64);
    const models = ["planner", "writer", "writer_escalated", "reviewer", "explainer"]
      .flatMap((roleName) => Array.from({ length: 3 }, () => ({ role: roleName, id: `${roleName}-v1`, params: [{ id: "reasoning_effort", value: "high" }] })));
    const ids = models.map((model, index) => `${model.role}-${index}`);
    const observation = { verified: true, repetitions: 3, evidence_hash: hash };
    const receipt = {
      schema: 2,
      generated_by: "geldmacher-workflow-capability-spike",
      issued_at: new Date(Date.now() - 1_000).toISOString(),
      expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1_000).toISOString(),
      plugin_version: "3.0.0",
      artifact_schema: 3,
      controller_protocol: 3,
      sdk_version: "1.0.24",
      platform: `${process.platform}-${process.arch}`,
      node_version: process.version,
      os_version: `${osPlatform()}-${osRelease()}`,
      cursor_version: "2026.07.23-e383d2b",
      marketplace_git_commit: "b".repeat(40),
      plugin_hash: hash,
      worker_hash: hash,
      runtime_hash: hash,
      lockfile_hash: hash,
      attested_route_hash: hash,
      model_catalog_hash: hash,
      planning_harness_hash: hash,
      cursor_harness_hash: hash,
      model_attestation: { requested: models, accepted: models, observed: models, request_ids: ids, agent_ids: ids, run_ids: ids },
      audit: { lockfile_hash: hash, evidence_hash: hash, production_packages: 104, high: 0, critical: 0, moderate: 0, risk_acceptance_hash: null },
      observations: {
        local_mcp: observation, marketplace_mcp: observation, marketplace_worker_runtime: observation,
        sdk_write_boundary: observation, worker_network_isolated: observation, sdk_secret_isolated: observation,
        sdk_budget_cancel: observation, restart_resume: observation, crash_interrupt_resume: observation,
        planner_submission: observation, model_configuration_exact: observation, cursor_harness: observation,
      },
      evidence_hashes: { report: hash },
      automation_safe: false,
    };
    receipt.automation_safe = receiptAutomationSafe(receipt);
    writeFileSync(path, JSON.stringify(receipt));
    assert.equal(loadCapabilityReceipt(directory).automation_safe, true);
    assert.equal(validateCapabilityReceipt({ ...receipt, unexpected: true }).valid, false);
    assert.equal(validateCapabilityReceipt({ ...receipt, expires_at: new Date(Date.now() - 1).toISOString() }).valid, false);
    assert.equal(validateCapabilityReceipt({ ...receipt, runtime_hash: "c".repeat(64) }, { runtime_hash: hash }).valid, false);
    for (const key of Object.keys(receipt.observations)) {
      const candidate = structuredClone(receipt);
      candidate.observations[key].verified = false;
      candidate.automation_safe = receiptAutomationSafe(candidate);
      const validation = validateCapabilityReceipt(candidate);
      assert.equal(candidate.automation_safe, false, key);
      assert.ok(validation.errors.includes("automation-not-safe"), key);
    }
    const moderateWithoutAcceptance = structuredClone(receipt);
    moderateWithoutAcceptance.audit.moderate = 1;
    moderateWithoutAcceptance.automation_safe = receiptAutomationSafe(moderateWithoutAcceptance);
    assert.equal(moderateWithoutAcceptance.automation_safe, false);
    moderateWithoutAcceptance.audit.risk_acceptance_hash = hash;
    assert.equal(receiptAutomationSafe(moderateWithoutAcceptance), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("provisioned worker runtime binds plugin, worker, lock inventory, SDK, and platform package", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-runtime-manifest-test-"));
  try {
    const sdkDirectory = join(directory, "node_modules", "@cursor", "sdk");
    const platformDirectory = join(directory, "node_modules", "@cursor", `sdk-${process.platform}-${process.arch}`);
    mkdirSync(sdkDirectory, { recursive: true });
    mkdirSync(platformDirectory, { recursive: true });
    writeFileSync(join(directory, "workflow-worker.mjs"), "export default true;\n");
    writeFileSync(join(directory, "package.json"), JSON.stringify({ dependencies: { "@cursor/sdk": "1.0.24" } }));
    writeFileSync(join(directory, "package-lock.json"), JSON.stringify({ packages: { "": {}, "node_modules/@cursor/sdk": { version: "1.0.24", integrity: "sha512-sdk" }, [`node_modules/@cursor/sdk-${process.platform}-${process.arch}`]: { version: "1.0.24", integrity: "sha512-platform", optional: true } } }));
    writeFileSync(join(sdkDirectory, "package.json"), JSON.stringify({ name: "@cursor/sdk", version: "1.0.24" }));
    writeFileSync(join(platformDirectory, "package.json"), JSON.stringify({ name: `@cursor/sdk-${process.platform}-${process.arch}`, version: "1.0.24" }));
    const manifest = createRuntimeManifest({
      pluginVersion: "3.0.0", pluginHash: "d".repeat(64), sdkVersion: "1.0.24",
      marketplaceGitCommit: "e".repeat(40),
      workerPath: join(directory, "workflow-worker.mjs"), lockPath: join(directory, "package-lock.json"),
    });
    writeRuntimeManifest(directory, manifest);
    assert.equal(loadWorkerRuntimeManifest(directory, { plugin_version: "3.0.0", plugin_hash: "d".repeat(64), sdk_version: "1.0.24", platform: `${process.platform}-${process.arch}` }).valid, true);
    writeFileSync(join(directory, "workflow-worker.mjs"), "export default false;\n");
    assert.equal(loadWorkerRuntimeManifest(directory, { plugin_version: "3.0.0", plugin_hash: "d".repeat(64), sdk_version: "1.0.24" }).reason, "worker-hash-mismatch");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("catalog validation rejects aliases and unknown or silently ignored model options", () => {
  const catalog = [{
    id: "cursor-model-2026-07-01",
    displayName: "Pinned model",
    parameters: [
      { id: "reasoning_effort", values: [{ value: "low" }, { value: "high" }] },
      { id: "max_mode", values: [{ value: "true" }, { value: "false" }] },
    ],
  }];
  const valid = validateRouteAgainstCatalog(route(), catalog);
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.model, { id: "cursor-model-2026-07-01", params: [{ id: "reasoning_effort", value: "high" }, { id: "max_mode", value: "true" }] });
  assert.equal(validateRouteAgainstCatalog({ ...route(), model_id: "latest" }, catalog).valid, false);
  assert.match(validateRouteAgainstCatalog({ ...route(), model_options: { mystery: true } }, catalog).errors.join("\n"), /unknown model option/);
});

test("model attestation compares canonical model and parameter values independent of order", () => {
  const left = { id: "m", params: [{ id: "effort", value: "high" }, { id: "max", value: "true" }] };
  const right = { id: "m", params: [...left.params].reverse() };
  assert.equal(configurationsMatch(left, right), true);
  assert.equal(configurationsMatch(left, { id: "m2", params: left.params }), false);
  assert.equal(configurationsMatch(left, { id: "m", params: [{ id: "effort", value: "low" }] }), false);
});

test("auto-gated eligibility requires model, hard write, worker-network, and SDK-secret boundaries", () => {
  const base = { requestedProfile: "auto-gated", plan: { risk: "medium", automation_bounds: bounds() }, project: project(), configErrors: [] };
  const blocked = evaluateEligibility({ ...base, capabilities: { model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: false, sdk_secret_isolated: false, sdk_budget_cancel_verified: false, planner_submission_verified: false } });
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.blockers.includes("worker-network-boundary-not-verified"));
  assert.ok(blocked.blockers.includes("sdk-secret-boundary-not-verified"));
  assert.ok(blocked.blockers.includes("sdk-budget-cancel-not-verified"));
  assert.ok(blocked.blockers.includes("planner-submission-not-verified"));
  const eligible = evaluateEligibility({ ...base, capabilities: { model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true } });
  assert.equal(eligible.eligible, true);
});

test("project risk and budget ceilings cannot be expanded by an approved root", () => {
  const value = evaluateEligibility({
    requestedProfile: "auto-gated",
    plan: { risk: "high", automation_bounds: bounds() },
    project: project({ max_risk: "medium", maximum_budgets: { max_active_minutes: 10, max_total_tokens: 10_000, max_cost_usd: 1, max_correction_cycles: 1 } }),
    capabilities: { model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true },
    configErrors: [],
  });
  assert.ok(value.blockers.includes("root-risk-exceeds-project-policy"));
  assert.ok(value.blockers.includes("root-max_active_minutes-exceeds-project-policy"));
  assert.ok(value.blockers.includes("root-max_total_tokens-exceeds-project-policy"));
  assert.ok(value.blockers.includes("root-max_cost_usd-exceeds-project-policy"));
  assert.ok(value.blockers.includes("root-max_correction_cycles-exceeds-project-policy"));
});

test("unattended eligibility is computed and proposes a visible downgrade", () => {
  const value = evaluateEligibility({
    requestedProfile: "unattended-eligible",
    plan: { risk: "medium", design_depth: "full", hard_triggers: ["material-uncertainty"], automation_bounds: bounds() },
    project: project(),
    capabilities: { model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true, model_attestation_observed: false },
    configErrors: [],
  });
  assert.equal(value.effective_profile, "auto-gated");
  assert.equal(value.downgrade_pending, true);
  assert.ok(value.reasons.includes("full-design-not-unattended-v1"));
  assert.ok(value.reasons.includes("observed-model-attestation-missing"));
});

test("unattended becomes eligible only with certified targets, harness, history, and attested routes", () => {
  const value = evaluateEligibility({
    requestedProfile: "unattended-eligible",
    plan: { risk: "medium", design_depth: "compact", hard_triggers: [], automation_bounds: bounds(), human_review_gates: false },
    project: project({ unattended_enabled: true, protected_oracles: ["test/oracle.test.js"], certified_regions: ["src"], harness_version: "harness-1", minimum_qualifying_runs: 1, qualifying_runs: 1 }),
    capabilities: { model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true, model_attestation_observed: true, harness_certified: true },
    configErrors: [],
  });
  assert.equal(value.eligible, true);
  assert.equal(value.effective_profile, "unattended-eligible");
});

test("authorization stops path, risk, drift, effects, dependency, and budget expansion", () => {
  const result = evaluateAuthorization({
    plan: { risk: "medium", automation_bounds: bounds() }, changedPaths: ["src/ok.js", "package.json"], discoveredRisk: "high",
    dependencyChanged: true, externalEffect: true, repositoryDrift: true,
    usage: { totalTokens: 20_001, costUsd: 3, activeMinutes: 21, correctionCycles: 3 },
  });
  assert.equal(result.authorized, false);
  for (const key of ["out-of-scope:package.json", "risk-bound-exceeded", "dependency-change-not-authorized", "external-effect-not-authorized", "material-repository-drift", "token-budget-exhausted", "cost-budget-exhausted", "time-budget-exhausted", "correction-budget-exhausted"]) assert.ok(result.blockers.includes(key), key);
});

test("auto-gated dependency changes require exact root allow-list entries", () => {
  const plan = { risk: "medium", automation_bounds: { ...bounds(), allowed_targets: ["src", "package.json"], dependencies: "allow-listed", allowed_dependencies: ["zod"] } };
  assert.equal(evaluateAuthorization({ plan, changedPaths: ["package.json"], changedDependencies: ["zod"] }).authorized, true);
  const blocked = evaluateAuthorization({ plan, changedPaths: ["package.json"], changedDependencies: ["unknown:package-lock.json"] });
  assert.ok(blocked.blockers.includes("dependency-not-allow-listed:unknown:package-lock.json"));
});

test("writer stays stable and escalates once only at a review-correction boundary", () => {
  const plan = { design_depth: "compact", assurance_profile: "standard", writer_tier_required: "economy" };
  assert.equal(selectWriterRoute({ plan, correctionCycle: 0 }).role, "writer");
  assert.equal(selectWriterRoute({ plan, correctionCycle: 1, findingRepeated: true }).role, "writer_escalated");
  assert.equal(selectWriterRoute({ plan, correctionCycle: 2 }).role, "writer_escalated");
  assert.equal(selectWriterRoute({ plan, correctionCycle: 9, alreadyEscalated: true }).reason, "writer-affinity-escalated");
});

test("run store enforces revisions, idempotency, event cursors, and stale-run interruption", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-store-test-"));
  try {
    const store = new RunStore(directory);
    let run = store.create({ requested_profile: "auto-gated", lifecycle: "waiting-human" });
    run = store.update(run.run_id, 0, "same-key", (draft) => ({ ...draft, lifecycle: "running" }), "started");
    assert.equal(run.revision, 1);
    assert.equal(store.update(run.run_id, 0, "same-key", () => { throw new Error("must not run"); }).revision, 1);
    assert.throws(() => store.update(run.run_id, 0, "new-key", (draft) => draft), /revision conflict/);
    assert.throws(() => store.create({ requested_profile: "auto-gated", lifecycle: "waiting-human" }), /active run/);
    assert.equal(store.events(run.run_id, 1).at(-1).type, "started");
    const reopened = new RunStore(directory).get(run.run_id);
    assert.equal(reopened.lifecycle, "running");
    const achieved = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, lifecycle: "achieved", effective_profile: "auto-gated", root_review_complete: true, review: { assessment: "achieved" }, delivery_accepted: true, blockers: [] }));
    assert.equal(achieved.lifecycle, "achieved");
    assert.equal(store.qualifyingHistory(), 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("earlier protocol run records remain read-only and do not block or qualify", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-legacy-store-test-"));
  try {
    const store = new RunStore(directory);
    const oldRun = {
      run_id: "run-old", revision: 0, lifecycle: "running", requested_profile: "auto-gated", blockers: [],
      run_record_schema: 1, artifact_schema: 3, controller_protocol: 2, plugin_version: "3.0.0",
    };
    mkdirSync(store.runDirectory(oldRun.run_id), { recursive: true });
    writeFileSync(store.runPath(oldRun.run_id), JSON.stringify(oldRun));
    const originalBytes = readFileSync(store.runPath(oldRun.run_id), "utf8");
    assert.equal(store.active().length, 0);
    assert.equal(store.qualifyingHistory(), 0);
    assert.throws(() => store.update(oldRun.run_id, 0, "legacy-key", (draft) => draft), /incompatible-run-protocol/);
    const engine = new WorkflowEngine({ workspaceRoot: directory, store, pluginRoot: root, stateRoot: directory });
    const snapshot = engine.snapshot(store.get(oldRun.run_id));
    assert.equal(snapshot.compatibility, "read-only-incompatible");
    assert.equal(snapshot.state, "stopped");
    assert.ok(snapshot.blockers.includes("incompatible-run-protocol"));
    const visibleRun = runView(store.get(oldRun.run_id));
    assert.equal(visibleRun.lifecycle, "stopped");
    assert.ok(visibleRun.blockers.includes("incompatible-run-protocol"));
    assert.equal(readFileSync(store.runPath(oldRun.run_id), "utf8"), originalBytes);
    assert.doesNotThrow(() => store.create({ requested_profile: "auto-gated", lifecycle: "waiting-human" }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("host checks are direct argv and reject shell syntax or environment assignments", () => {
  assert.deepEqual(parseHostCommand("npm run test -- --filter 'safe path'"), ["npm", "run", "test", "--", "--filter", "safe path"]);
  assert.throws(() => parseHostCommand("npm test | tee result"), /shell syntax/);
  assert.throws(() => parseHostCommand("NODE_ENV=test npm test"), /environment assignment/);
});

test("host checks can read but cannot write the repository or inherit controller secrets", { skip: process.platform !== "darwin" }, () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-host-check-test-"));
  const priorKey = process.env.CURSOR_API_KEY;
  try {
    process.env.CURSOR_API_KEY = "test-only-secret";
    const readOnly = runHostCheck(directory, [process.execPath, "-e", "process.stdout.write(String(Boolean(process.env.CURSOR_API_KEY)))"]);
    if (probeSandboxBoundary().verified) {
      assert.equal(readOnly.passed, true);
      assert.equal(readOnly.stdout, "false");
      const write = runHostCheck(directory, [process.execPath, "-e", "require('node:fs').writeFileSync('forbidden.txt','x')"]);
      assert.equal(write.passed, false);
    } else {
      assert.equal(readOnly.passed, false);
      assert.match(readOnly.stderr, /sandbox_apply|operation not permitted/i);
    }
  } finally {
    if (priorKey === undefined) delete process.env.CURSOR_API_KEY;
    else process.env.CURSOR_API_KEY = priorKey;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("sandbox profile is read-only by default and the local boundary probe is explicit", () => {
  const profile = buildSandboxProfile({ writablePaths: ["/private/tmp/workflow-safe"], deniedPaths: ["/private/tmp/workflow-safe/oracle"] });
  assert.match(profile, /deny default/);
  assert.match(profile, /allow file-read/);
  assert.match(profile, /workflow-safe/);
  assert.match(profile, /deny file-write.*oracle/);
  assert.doesNotMatch(profile, /allow network/);
  const probe = probeSandboxBoundary();
  assert.equal(typeof probe.verified, "boolean");
  if (process.platform === "darwin") assert.equal(probe.available, true);
});

test("bundled MCP server exposes the seven versioned controller tools", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "workflow-mcp.mjs")],
    cwd: root,
    env: { ...process.env, CURSOR_PLUGIN_ROOT: root },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const response = await client.listTools();
    assert.deepEqual(response.tools.map((tool) => tool.name).sort(), ["workflow_answer", "workflow_control", "workflow_prepare", "workflow_start", "workflow_status", "workflow_validate_models", "workflow_watch"]);
  } finally { await client.close(); }
});
