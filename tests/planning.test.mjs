import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { WorkflowEngine } from "../src/controller/engine.mjs";
import { PlanningEngine, semanticRootDiff } from "../src/controller/planning.mjs";
import { PreparationStore, RunStore } from "../src/controller/store.mjs";
import { classifyPlanningOutput } from "../src/worker/planning-output.mjs";
import { authoritativeArtifactProjectionFromText, opaqueExtensionsFromArtifactText } from "../scripts/validate-artifact.source.mjs";

const pluginRoot = resolve(new URL("..", import.meta.url).pathname);
const canonicalRoot = readFileSync(new URL("./fixtures/artifacts/work-plan.valid.md", import.meta.url), "utf8");

function autoRoot() {
  return canonicalRoot.replace("automation_profile_max: manual", [
    "automation_profile_max: auto-gated",
    "automation_bounds:",
    "  allowed_targets: [src/retry-policy.js, test/retry-policy.test.js]",
    "  max_risk: medium",
    "  dependencies: deny",
    "  external_effects: none",
    "  delivery: repository-only",
    "  max_active_minutes: 30",
    "  max_total_tokens: 50000",
    "  max_cost_usd: 5",
    "  max_correction_cycles: 2",
    "  max_writer_escalations: 1",
  ].join("\n"));
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim());
}

function routeYaml() {
  const roles = ["planner", "writer", "writer_escalated", "reviewer", "explainer"];
  return [
    "schema: 1",
    "planning_preflight_budget:",
    "  max_active_minutes: 5",
    "  max_total_tokens: 10000",
    "  max_cost_usd: 1",
    "  max_validation_repairs: 1",
    "route_profiles:",
    "  default:",
    ...roles.flatMap((role) => [
      `    ${role}:`,
      "      model_id: premium-planner-2026-07-01",
      "      reasoning_effort: high",
      "      model_options: {}",
      "      fallback: deny",
      "      pricing_usd_per_million:",
      "        input: 1",
      "        output: 1",
      "        cache_read: 0",
      "        cache_write: 0",
    ]),
    "",
  ].join("\n");
}

function setup(root) {
  const repo = join(root, "repo");
  mkdirSync(join(repo, ".cursor"), { recursive: true });
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(join(repo, "test"), { recursive: true });
  writeFileSync(join(repo, "src", "retry-policy.js"), "export const retry = true;\n");
  writeFileSync(join(repo, "test", "retry-policy.test.js"), "// oracle\n");
  writeFileSync(join(repo, "test", "security-oracle.test.js"), "// protected oracle\n");
  writeFileSync(join(repo, ".cursor", "workflow-policy.yaml"), [
    "schema: 1",
    "automation_enabled: true",
    "unattended_enabled: false",
    "allowed_write_roots: [src, test]",
    "protected_paths: []",
    "protected_oracles: [test/security-oracle.test.js]",
    "dependencies: deny",
    "external_effects: none",
    "max_risk: high",
    "",
  ].join("\n"));
  git(root, ["init", repo]);
  git(repo, ["add", "."]);
  git(repo, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@test.invalid", "commit", "-m", "baseline"]);
  const configPath = join(root, "config.yaml");
  writeFileSync(configPath, routeYaml());
  return { repo, configPath, stateRoot: join(root, "state") };
}

function validation() {
  const model = { id: "premium-planner-2026-07-01", params: [{ id: "reasoning_effort", value: "high" }] };
  const roles = ["planner", "writer", "writer_escalated", "reviewer", "explainer"];
  return { verified: true, errors: [], routes: Object.fromEntries(roles.map((role) => [role, { valid: true, errors: [], model }])) };
}

function capabilities(additions = {}) {
  return {
    sandbox_boundary_verified: true,
    worker_network_isolated: true,
    sdk_secret_isolated: true,
    sdk_budget_cancel_verified: true,
    planner_submission_verified: true,
    model_catalog_verified: true,
    model_attestation_observed: true,
    ...additions,
  };
}

function receipt({ configurationHash, harnessHash, artifactProjectionHash = null, agentId = "planner-agent", tokens = 100 } = {}) {
  const model = { id: "premium-planner-2026-07-01", params: [{ id: "reasoning_effort", value: "high" }] };
  return {
    phase: "planner",
    requested_model: { id: model.id, reasoning_effort: "high", model_options: {} },
    accepted_model: model,
    observed_model: model,
    model_attested: true,
    sdk_version: "1.0.24",
    configuration_hash: configurationHash,
    route_hash: configurationHash,
    harness_hash: harnessHash,
    artifact_projection_hash: artifactProjectionHash,
    request_id: `request-${tokens}`,
    agent_id: agentId,
    worker_run_id: `worker-${tokens}`,
    duration_ms: 10,
    usage: { inputTokens: tokens / 2, outputTokens: tokens / 2, totalTokens: tokens },
    cost_usd: 0.001,
    remap: false,
    status: "finished",
    error: null,
  };
}

function adapter(outputs, calls) {
  return {
    validateProfile() { return validation(); },
    runPlanningPhase(input) {
      calls.push(input);
      const output = outputs.shift();
      const baseReceipt = receipt({ configurationHash: input.configurationHash, harnessHash: input.harnessHash, artifactProjectionHash: input.artifactProjectionHash, agentId: output.agentId ?? "planner-agent", tokens: output.tokens ?? 100 });
      return {
        response: { ok: output.ok !== false, error: output.error ?? null },
        receipt: { ...baseReceipt, ...(output.receipt ?? {}) },
        planningOutput: output.planningOutput,
      };
    },
  };
}

function withConfig(configPath, operation) {
  const previous = process.env.GELDMACHER_WORKFLOW_CONFIG;
  process.env.GELDMACHER_WORKFLOW_CONFIG = configPath;
  try { return operation(); }
  finally {
    if (previous === undefined) delete process.env.GELDMACHER_WORKFLOW_CONFIG;
    else process.env.GELDMACHER_WORKFLOW_CONFIG = previous;
  }
}

test("planner output requires exactly one CreatePlan or one blocker report", () => {
  assert.equal(classifyPlanningOutput({ plans: [autoRoot()], blockerReports: [] }).kind, "root");
  assert.equal(classifyPlanningOutput({ plans: [], blockerReports: [{ questions: ["Which public behavior is required?"] }] }).kind, "manual-planning-required");
  assert.throws(() => classifyPlanningOutput({ plans: [autoRoot()], blockerReports: [{ questions: ["Which public behavior is required?"] }] }), /both/);
  assert.throws(() => classifyPlanningOutput({ plans: [], blockerReports: [] }), /exactly one/);
  assert.throws(() => classifyPlanningOutput({ plans: [autoRoot(), autoRoot()], blockerReports: [] }), /exactly one/);
});

test("semantic root diff is deterministic and categorized", () => {
  assert.deepEqual(semanticRootDiff(autoRoot(), autoRoot(), pluginRoot).categories, []);
  const writerChange = autoRoot().replace("writer_tier_required: economy", "writer_tier_required: escalated");
  assert.deepEqual(semanticRootDiff(autoRoot(), writerChange, pluginRoot).categories, ["writer_tier"]);
  const objectiveChange = autoRoot().replace("Valid APP_RETRY_MULTIPLIER values", "Supported APP_RETRY_MULTIPLIER values");
  assert.ok(semanticRootDiff(autoRoot(), objectiveChange, pluginRoot).categories.includes("objectives"));
  const extensionChange = autoRoot().replace("status: ready", "status: ready\nextensions:\n  note: metadata-only");
  const extensionDiff = semanticRootDiff(autoRoot(), extensionChange, pluginRoot);
  assert.equal(extensionDiff.changed, true);
  assert.deepEqual(extensionDiff.categories, []);
});

test("existing-root planning hides extensions from the Planner and restores only the original metadata", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-extension-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const original = autoRoot().replace("status: ready", "status: ready\nextensions:\n  sentinel: ORIGINAL_EXTENSION_SECRET");
    const plannerOutput = autoRoot().replace("status: ready", "status: ready\nextensions:\n  instruction: PLANNER_EXTENSION_INJECTION");
    const calls = [];
    const planning = new PlanningEngine({
      workspaceRoot: repo,
      store: new PreparationStore(stateRoot),
      pluginRoot,
      stateRoot,
      adapterFactory: () => adapter([{ planningOutput: { kind: "root", root_plan_text: plannerOutput } }], calls),
      capabilitiesFactory: capabilities,
    });
    const preparation = withConfig(configPath, () => planning.prepare({ rootPlan: original, requestedProfile: "auto-gated", idempotencyKey: "prepare-extension-root" })).preparation;
    const inputProjection = authoritativeArtifactProjectionFromText(original, pluginRoot);
    assert.equal(preparation.input_root_authoritative_projection_hash, inputProjection.projection_hash);
    const ready = planning.execute(preparation.preparation_id);
    assert.equal(ready.status, "root-ready", JSON.stringify(ready.blockers));
    assert.doesNotMatch(calls[0].prompt, /ORIGINAL_EXTENSION_SECRET|PLANNER_EXTENSION_INJECTION/);
    assert.match(calls[0].prompt, /AUTHORITATIVE PROJECTION/);
    assert.deepEqual(opaqueExtensionsFromArtifactText(ready.root_plan_text), { present: true, value: { sentinel: "ORIGINAL_EXTENSION_SECRET" } });
    assert.equal(ready.root_plan_text.includes("PLANNER_EXTENSION_INJECTION"), false);
    assert.equal(ready.root_authoritative_projection_hash, inputProjection.projection_hash);
    assert.equal(ready.planner_receipts[0].artifact_projection_hash, inputProjection.projection_hash);
    assert.equal(ready.planner_receipts[0].produced_artifact_projection_hash, inputProjection.projection_hash);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("goal planning strips Planner-invented extensions before root approval", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-goal-extension-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const invented = autoRoot().replace("status: ready", "status: ready\nextensions:\n  instruction: PLANNER_EXTENSION_INJECTION");
    const planning = new PlanningEngine({
      workspaceRoot: repo,
      store: new PreparationStore(stateRoot),
      pluginRoot,
      stateRoot,
      adapterFactory: () => adapter([{ planningOutput: { kind: "root", root_plan_text: invented } }], []),
      capabilitiesFactory: capabilities,
    });
    const preparation = withConfig(configPath, () => planning.prepare({ goal: "Plan safely", requestedProfile: "auto-gated", idempotencyKey: "prepare-extension-goal" })).preparation;
    const ready = planning.execute(preparation.preparation_id);
    assert.equal(ready.status, "root-ready", JSON.stringify(ready.blockers));
    assert.deepEqual(opaqueExtensionsFromArtifactText(ready.root_plan_text), { present: false, value: null });
    assert.equal(ready.planner_receipts[0].artifact_projection_hash, null);
    assert.equal(ready.planner_receipts[0].produced_artifact_projection_hash, ready.root_authoritative_projection_hash);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("valid goal prepares a root without creating a run and preserves exact planner affinity across repair", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const preparationStore = new PreparationStore(stateRoot);
    const runStore = new RunStore(stateRoot);
    const calls = [];
    const outputs = [
      { planningOutput: { kind: "root", root_plan_text: "not a schema-3 root" } },
      { agentId: "planner-agent", planningOutput: { kind: "root", root_plan_text: autoRoot() } },
    ];
    const planning = new PlanningEngine({ workspaceRoot: repo, store: preparationStore, pluginRoot, stateRoot, adapterFactory: () => adapter(outputs, calls), capabilitiesFactory: capabilities });
    const prepared = withConfig(configPath, () => planning.prepare({ goal: "Add a safe retry multiplier", requestedProfile: "auto-gated", routeProfile: "default", idempotencyKey: "prepare-goal-1" })).preparation;
    assert.equal(prepared.status, "planning");
    const ready = planning.execute(prepared.preparation_id);
    assert.equal(ready.status, "root-ready", JSON.stringify(ready.blockers));
    assert.equal(ready.planner_receipts.length, 2);
    assert.equal(ready.planner_agent_id, "planner-agent");
    assert.equal(calls[0].agentId, null);
    assert.equal(calls[1].agentId, "planner-agent");
    assert.match(calls[0].prompt, /--- references\/automation-preparation-contract\.md ---/);
    assert.doesNotMatch(calls[0].prompt, /--- references\/automation-contract\.md ---/);
    assert.ok(calls[0].deniedReadPaths.includes(join(repo, ".git")));
    assert.ok(calls[0].deniedReadPaths.includes(join(repo, ".cursor", "workflow-policy.yaml")));
    assert.ok(calls[0].deniedReadPaths.includes(join(repo, "test", "security-oracle.test.js")));
    assert.equal(runStore.list().length, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("Preparation idempotency retries require the exact same request", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-idempotency-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    let adapterCalls = 0;
    const store = new PreparationStore(stateRoot);
    const planning = new PlanningEngine({
      workspaceRoot: repo,
      store,
      pluginRoot,
      stateRoot,
      adapterFactory: () => {
        adapterCalls += 1;
        return adapter([], []);
      },
      capabilitiesFactory: capabilities,
    });
    const request = { goal: "Plan safely", requestedProfile: "auto-gated", routeProfile: "default", idempotencyKey: "prepare-bound-request" };
    const first = withConfig(configPath, () => planning.prepare(request));
    const duplicate = withConfig(configPath, () => planning.prepare(request));
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.preparation.preparation_id, first.preparation.preparation_id);
    assert.match(first.preparation.preparation_request_hash, /^[a-f0-9]{64}$/);
    assert.equal(adapterCalls, 1);

    assert.throws(
      () => withConfig(configPath, () => planning.prepare({ ...request, goal: "Plan something else" })),
      /preparation idempotency conflict/,
    );
    assert.throws(
      () => withConfig(configPath, () => planning.prepare({ ...request, requestedProfile: "unattended-eligible" })),
      /preparation idempotency conflict/,
    );
    assert.throws(
      () => withConfig(configPath, () => planning.prepare({ rootPlan: autoRoot().replace("schema: 3", "schema: 2"), requestedProfile: "auto-gated", routeProfile: "default", idempotencyKey: request.idempotencyKey })),
      /invalid input root plan/,
    );
    assert.equal(store.list().length, 1);
    assert.equal(adapterCalls, 1);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("missing Planning budget blocks prepare before state or model work", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-budget-config-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    writeFileSync(configPath, routeYaml().replace(/planning_preflight_budget:\n(?:  .*\n){4}/, ""));
    let adapterCalls = 0;
    const store = new PreparationStore(stateRoot);
    const planning = new PlanningEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot, adapterFactory: () => { adapterCalls += 1; return adapter([], []); }, capabilitiesFactory: capabilities });
    assert.throws(() => withConfig(configPath, () => planning.prepare({ goal: "Plan safely", requestedProfile: "auto-gated", idempotencyKey: "prepare-no-budget" })), /planning_preflight_budget is required/);
    assert.equal(adapterCalls, 0);
    assert.equal(store.list().length, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("Planner remap and token-budget exhaustion fail without a Root", () => {
  for (const scenario of [
    { name: "remap", output: { receipt: { model_attested: false, remap: true } }, blocker: "planner-model-mismatch" },
    { name: "tokens", output: { tokens: 10_001 }, blocker: "planning-token-budget-exhausted" },
  ]) {
    const temporary = mkdtempSync(join(tmpdir(), `workflow-planning-${scenario.name}-test-`));
    try {
      const { repo, configPath, stateRoot } = setup(temporary);
      const store = new PreparationStore(stateRoot);
      const outputs = [{ ...scenario.output, planningOutput: { kind: "root", root_plan_text: autoRoot() } }];
      const planning = new PlanningEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot, adapterFactory: () => adapter(outputs, []), capabilitiesFactory: capabilities });
      const preparation = withConfig(configPath, () => planning.prepare({ goal: "Plan safely", requestedProfile: "auto-gated", idempotencyKey: `prepare-${scenario.name}-1` })).preparation;
      const failed = planning.execute(preparation.preparation_id);
      assert.equal(failed.status, "failed");
      assert.equal(failed.root_plan_text, null);
      assert.ok(failed.blockers.includes(scenario.blocker), JSON.stringify(failed.blockers));
      assert.equal(failed.planner_receipts.length, 1);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
});

test("validation repair never exceeds max_validation_repairs", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-repair-budget-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const calls = [];
    const outputs = [
      { planningOutput: { kind: "root", root_plan_text: "invalid first" } },
      { planningOutput: { kind: "root", root_plan_text: "invalid second" } },
      { planningOutput: { kind: "root", root_plan_text: autoRoot() } },
    ];
    const planning = new PlanningEngine({ workspaceRoot: repo, store: new PreparationStore(stateRoot), pluginRoot, stateRoot, adapterFactory: () => adapter(outputs, calls), capabilitiesFactory: capabilities });
    const preparation = withConfig(configPath, () => planning.prepare({ goal: "Plan safely", requestedProfile: "auto-gated", idempotencyKey: "prepare-repair-limit" })).preparation;
    const failed = planning.execute(preparation.preparation_id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.root_plan_text, null);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].agentId, "planner-agent");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("only one Planner is active per repository while completed Preparations do not form a queue", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-lock-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const store = new PreparationStore(stateRoot);
    const planning = new PlanningEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot, adapterFactory: () => adapter([{ planningOutput: { kind: "root", root_plan_text: autoRoot() } }], []), capabilitiesFactory: capabilities });
    const first = withConfig(configPath, () => planning.prepare({ goal: "First", requestedProfile: "auto-gated", idempotencyKey: "prepare-active-1" })).preparation;
    assert.throws(() => withConfig(configPath, () => planning.prepare({ goal: "Second", requestedProfile: "auto-gated", idempotencyKey: "prepare-active-2" })), /active preparation/);
    assert.equal(planning.execute(first.preparation_id).status, "root-ready");
    assert.doesNotThrow(() => withConfig(configPath, () => planning.prepare({ goal: "Second", requestedProfile: "auto-gated", idempotencyKey: "prepare-active-2" })));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("root-ready Preparations expire with their Planning time budget", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-expiry-test-"));
  try {
    const store = new PreparationStore(temporary);
    const preparation = store.create({
      status: "root-ready",
      source_kind: "goal",
      requested_profile: "auto-gated",
      root_plan_text: autoRoot(),
      root_plan_hash: "a".repeat(64),
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const expired = store.get(preparation.preparation_id);
    assert.equal(expired.status, "expired");
    assert.ok(expired.blockers.includes("preparation-expired"));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("Preparation stop is idempotent, repository-locked, and preserves Planner receipts", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-stop-test-"));
  try {
    const store = new PreparationStore(temporary);
    const preparation = store.create({
      status: "planning",
      source_kind: "goal",
      requested_profile: "auto-gated",
      planner_receipts: [{ request_id: "preserved" }],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const stopped = store.controlUpdate(preparation.preparation_id, preparation.revision, "stop-preparation-1", (draft) => ({ ...draft, status: "stopped", runner_pid: null }), "preparation-stopped");
    assert.equal(stopped.preparation.status, "stopped");
    assert.equal(stopped.preparation.planner_receipts[0].request_id, "preserved");
    const duplicate = store.controlUpdate(preparation.preparation_id, preparation.revision, "stop-preparation-1", () => { throw new Error("must not repeat"); });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.preparation.revision, stopped.preparation.revision);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("material intent questions stop preparation without root or answer loop", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-question-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const store = new PreparationStore(stateRoot);
    const outputs = [{ planningOutput: { kind: "manual-planning-required", questions: ["Which compatibility boundary should remain public?"], rationale: "The goal permits incompatible products." } }];
    const planning = new PlanningEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot, adapterFactory: () => adapter(outputs, []), capabilitiesFactory: capabilities });
    const preparation = withConfig(configPath, () => planning.prepare({ goal: "Redesign retries", requestedProfile: "auto-gated", idempotencyKey: "prepare-question-1" })).preparation;
    const stopped = planning.execute(preparation.preparation_id);
    assert.equal(stopped.status, "manual-planning-required");
    assert.equal(stopped.root_plan_text, null);
    assert.deepEqual(stopped.manual_questions, ["Which compatibility boundary should remain public?"]);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("schema-2 and incomplete roots are rejected before planner invocation", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-invalid-root-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    let adapterCalls = 0;
    const planning = new PlanningEngine({ workspaceRoot: repo, store: new PreparationStore(stateRoot), pluginRoot, stateRoot, adapterFactory: () => { adapterCalls += 1; return adapter([], []); }, capabilitiesFactory: capabilities });
    assert.throws(() => withConfig(configPath, () => planning.prepare({ rootPlan: autoRoot().replace("schema: 3", "schema: 2"), requestedProfile: "auto-gated", idempotencyKey: "prepare-invalid-1" })), /invalid input root plan/);
    assert.throws(() => withConfig(configPath, () => planning.prepare({ rootPlan: "# incomplete", requestedProfile: "auto-gated", idempotencyKey: "prepare-invalid-2" })), /invalid input root plan/);
    assert.equal(adapterCalls, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("existing valid root may be improved and requires hash-bound approval before exactly one run", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-start-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const preparationStore = new PreparationStore(stateRoot);
    const runStore = new RunStore(stateRoot);
    const outputs = [{ planningOutput: { kind: "root", root_plan_text: autoRoot() } }];
    const planning = new PlanningEngine({ workspaceRoot: repo, store: preparationStore, pluginRoot, stateRoot, adapterFactory: () => adapter(outputs, []), capabilitiesFactory: capabilities });
    const preparation = withConfig(configPath, () => planning.prepare({ rootPlan: canonicalRoot, requestedProfile: "auto-gated", idempotencyKey: "prepare-root-1" })).preparation;
    const ready = planning.execute(preparation.preparation_id);
    assert.equal(ready.status, "root-ready");
    assert.equal(ready.semantic_diff.changed, true);
    assert.ok(ready.semantic_diff.categories.includes("automation_bounds"));
    const engine = new WorkflowEngine({
      workspaceRoot: repo,
      store: runStore,
      preparationStore,
      pluginRoot,
      stateRoot,
      adapterFactory: () => ({ validateProfile: validation }),
      capabilitiesFactory: capabilities,
    });
    assert.throws(() => withConfig(configPath, () => engine.start({ preparationId: ready.preparation_id, approvedRootHash: "0".repeat(64), expectedPreparationRevision: ready.revision, idempotencyKey: "approve-root-1" })), /hash-mismatch/);
    const started = withConfig(configPath, () => engine.start({ preparationId: ready.preparation_id, approvedRootHash: ready.root_plan_hash, expectedPreparationRevision: ready.revision, idempotencyKey: "approve-root-1" }));
    assert.equal(started.run.plan_approved, true);
    assert.equal(started.run.plan_status, "ready");
    assert.equal(started.run.controller_protocol, 3);
    assert.equal(started.run.planning_receipts.length, 1);
    assert.equal(started.run.receipts.length, 0);
    assert.equal(started.preparation.status, "consumed");
    assert.equal(runStore.list().length, 1);
    const duplicate = withConfig(configPath, () => engine.start({ preparationId: ready.preparation_id, approvedRootHash: ready.root_plan_hash, expectedPreparationRevision: ready.revision, idempotencyKey: "approve-root-1" }));
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.run.run_id, started.run.run_id);
    assert.equal(runStore.list().length, 1);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("workflow_start rejects a Planner receipt whose produced projection binding was changed", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-planning-projection-receipt-test-"));
  try {
    const { repo, configPath, stateRoot } = setup(temporary);
    const preparationStore = new PreparationStore(stateRoot);
    const planning = new PlanningEngine({
      workspaceRoot: repo,
      store: preparationStore,
      pluginRoot,
      stateRoot,
      adapterFactory: () => adapter([{ planningOutput: { kind: "root", root_plan_text: autoRoot() } }], []),
      capabilitiesFactory: capabilities,
    });
    const prepared = withConfig(configPath, () => planning.prepare({ rootPlan: canonicalRoot, requestedProfile: "auto-gated", idempotencyKey: "prepare-projection-receipt" })).preparation;
    const ready = planning.execute(prepared.preparation_id);
    const tampered = preparationStore.update(ready.preparation_id, ready.revision, null, (draft) => {
      draft.planner_receipts.at(-1).produced_artifact_projection_hash = "0".repeat(64);
      return draft;
    });
    const engine = new WorkflowEngine({
      workspaceRoot: repo,
      store: new RunStore(stateRoot),
      preparationStore,
      pluginRoot,
      stateRoot,
      adapterFactory: () => ({ validateProfile: validation }),
      capabilitiesFactory: capabilities,
    });
    assert.throws(() => withConfig(configPath, () => engine.start({
      preparationId: tampered.preparation_id,
      approvedRootHash: tampered.root_plan_hash,
      expectedPreparationRevision: tampered.revision,
      idempotencyKey: "approve-tampered-projection",
    })), /planner-produced-artifact-projection-mismatch/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
