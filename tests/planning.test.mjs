import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { PlanningEngine, semanticRootDiff } from "../src/controller/planning.mjs";
import { PreparationStore } from "../src/controller/store.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const roles = ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"];

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "workflow-planning-"));
  const repo = join(root, "repo");
  const state = join(root, "state");
  const configPath = join(root, "config.yaml");
  mkdirSync(join(repo, ".cursor"), { recursive: true });
  writeFileSync(join(repo, "README.md"), "planning test\n");
  git(repo, ["init"]);
  git(repo, ["add", "README.md"]);
  git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "base"]);
  const pool = (role) => `    ${role}:\n      selection: ordered\n      fallback: approved-pool\n      candidates:\n        - model_id: ${role}-v1\n          reasoning_effort: high\n          model_options: {}\n          pricing_usd_per_million: { input: 1, output: 2, cache_read: 0, cache_write: 0 }`;
  writeFileSync(configPath, `schema: 2\nplanning_preflight_budget:\n  max_active_minutes: 5\n  max_total_tokens: 10000\n  max_cost_usd: 2\n  max_validation_repairs: 1\nroute_profiles:\n  default:\n${roles.map(pool).join("\n")}\n`);
  writeFileSync(join(repo, ".cursor", "workflow-policy.yaml"), `schema: 2\nsupervised_enabled: true\nautonomous_enabled: false\nscope_envelope:\n  allowed_roots: [src, tests]\n  protected_paths: []\n  approval_required_paths: []\ncertified_regions: []\nminimum_qualifying_runs: 2\ndependencies: deny\nallowed_dependencies: []\nexternal_effects: none\nmax_risk: medium\nmaximum_budgets:\n  max_active_minutes: 60\n  max_total_tokens: 100000\n  max_cost_usd: 10\n  max_correction_cycles: 3\n`);
  return { root, repo, state, configPath, store: new PreparationStore(state) };
}

function validation() {
  return {
    verified: true,
    errors: [],
    sdk_version: "1.0.24",
    routes: Object.fromEntries(roles.map((role) => [role, {
      selected_candidate: { model_id: `${role}-v1`, reasoning_effort: "high", model_options: {}, pricing_usd_per_million: { input: 1, output: 2, cache_read: 0, cache_write: 0 } },
      model: { id: `${role}-v1`, params: [{ id: "reasoning_effort", value: "high" }] },
      pool_hash: role.repeat(8).slice(0, 64).padEnd(64, "a"),
      selection_reason: "primary-available",
    }])),
  };
}

function receipt(input, agentId = "planner-agent") {
  return {
    phase: "planner", requested_model: { id: input.route.model_id, reasoning_effort: input.route.reasoning_effort, model_options: input.route.model_options },
    accepted_model: input.acceptedModel, observed_model: input.acceptedModel, model_attested: true, remap: false,
    request_id: `request-${Math.random()}`, agent_id: agentId, worker_run_id: "worker-1", sdk_version: "1.0.24",
    configuration_hash: input.configurationHash, route_hash: input.configurationHash, route_pool_hash: input.routePoolHash,
    selection_reason: input.selectionReason, harness_hash: input.harnessHash, artifact_projection_hash: input.artifactProjectionHash,
    duration_ms: 10, usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 }, cost_usd: 0.001, status: "finished",
  };
}

function engine(env, outputs) {
  let calls = 0;
  const adapter = {
    validateProfile: () => validation(),
    runPlanningPhase: (input) => {
      const output = outputs[Math.min(calls, outputs.length - 1)];
      calls += 1;
      return { response: { ok: true, status: "finished" }, receipt: receipt(input), planningOutput: output };
    },
  };
  return {
    planning: new PlanningEngine({
      workspaceRoot: env.repo, store: env.store, pluginRoot: defaultRoot, stateRoot: env.state,
      adapterFactory: () => adapter,
      capabilitiesFactory: () => ({ sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true }),
    }),
    calls: () => calls,
  };
}

function withConfig(path, action) {
  const prior = process.env.GELDMACHER_WORKFLOW_CONFIG;
  process.env.GELDMACHER_WORKFLOW_CONFIG = path;
  try { return action(); } finally {
    if (prior === undefined) delete process.env.GELDMACHER_WORKFLOW_CONFIG;
    else process.env.GELDMACHER_WORKFLOW_CONFIG = prior;
  }
}

test("semantic root diff separates intent, authority, profile, risk, and certification", () => {
  const changed = rootPlan.replace("max_total_tokens: 50000", "max_total_tokens: 40000");
  assert.deepEqual(semanticRootDiff(rootPlan, changed, defaultRoot).categories, ["authority"]);
  assert.deepEqual(semanticRootDiff(rootPlan, rootPlan.replace("public contract.", "public interface."), defaultRoot).categories, ["intent"]);
});

test("existing Schema 4 root prepares and becomes hash-bound root-ready", () => {
  const env = setup();
  try {
    const value = engine(env, [{ kind: "root", root_plan_text: rootPlan }]);
    const prepared = withConfig(env.configPath, () => value.planning.prepare({ rootPlan, requestedProfile: "supervised", idempotencyKey: "prepare-root-v4" })).preparation;
    assert.equal(prepared.status, "planning");
    const ready = value.planning.execute(prepared.preparation_id);
    assert.equal(ready.status, "root-ready");
    assert.match(ready.root_plan_hash, /^[a-f0-9]{64}$/);
    assert.equal(ready.root_plan_contract.fields.contract_level, "controlled");
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});

test("goal planning repairs technical schema output on the same writer affinity", () => {
  const env = setup();
  try {
    const value = engine(env, [{ kind: "root", root_plan_text: "# incomplete" }, { kind: "root", root_plan_text: rootPlan }]);
    const prepared = withConfig(env.configPath, () => value.planning.prepare({ goal: "Make retries deterministic", requestedProfile: "supervised", idempotencyKey: "prepare-goal-v4" })).preparation;
    const ready = value.planning.execute(prepared.preparation_id);
    assert.equal(ready.status, "root-ready");
    assert.equal(value.calls(), 2);
    assert.equal(new Set(ready.planner_receipts.map((item) => item.agent_id)).size, 1);
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});

test("material questions stop planning without fabricating a root", () => {
  const env = setup();
  try {
    const value = engine(env, [{ kind: "manual-planning-required", questions: ["Which public behavior is required?"], rationale: "Goal is ambiguous" }]);
    const prepared = withConfig(env.configPath, () => value.planning.prepare({ goal: "Change behavior safely", requestedProfile: "supervised", idempotencyKey: "prepare-question" })).preparation;
    const stopped = value.planning.execute(prepared.preparation_id);
    assert.equal(stopped.status, "manual-planning-required");
    assert.equal(stopped.root_plan_text, null);
    assert.deepEqual(stopped.manual_questions, ["Which public behavior is required?"]);
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});

test("Preparation idempotency is bound to the exact request", () => {
  const env = setup();
  try {
    const value = engine(env, [{ kind: "root", root_plan_text: rootPlan }]);
    const first = withConfig(env.configPath, () => value.planning.prepare({ rootPlan, requestedProfile: "supervised", idempotencyKey: "same-key-123" }));
    const duplicate = withConfig(env.configPath, () => value.planning.prepare({ rootPlan, requestedProfile: "supervised", idempotencyKey: "same-key-123" }));
    assert.equal(duplicate.preparation.preparation_id, first.preparation.preparation_id);
    assert.equal(duplicate.duplicate, true);
    assert.throws(() => withConfig(env.configPath, () => value.planning.prepare({ goal: "Different request", requestedProfile: "supervised", idempotencyKey: "same-key-123" })), /idempotency conflict/);
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});

test("Workflow 3 and incomplete roots fail before any planner invocation", () => {
  const env = setup();
  try {
    const value = engine(env, [{ kind: "root", root_plan_text: rootPlan }]);
    assert.throws(() => withConfig(env.configPath, () => value.planning.prepare({ rootPlan: rootPlan.replace("schema: 4", "schema: 3"), requestedProfile: "supervised", idempotencyKey: "old-root-123" })), /invalid input root plan/);
    assert.throws(() => withConfig(env.configPath, () => value.planning.prepare({ rootPlan: "# incomplete", requestedProfile: "supervised", idempotencyKey: "bad-root-123" })), /invalid input root plan/);
    assert.equal(value.calls(), 0);
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});

test("dirty source state does not invalidate Preparation baseline", () => {
  const env = setup();
  try {
    writeFileSync(join(env.repo, "README.md"), "human dirty state\n");
    const value = engine(env, [{ kind: "root", root_plan_text: rootPlan }]);
    const prepared = withConfig(env.configPath, () => value.planning.prepare({ rootPlan, requestedProfile: "supervised", idempotencyKey: "dirty-root-123" })).preparation;
    assert.match(prepared.baseline.status, /README.md/);
    assert.equal(value.planning.execute(prepared.preparation_id).status, "root-ready");
  } finally { rmSync(env.root, { recursive: true, force: true }); }
});
