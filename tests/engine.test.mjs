import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { WorkflowEngine } from "../src/controller/engine.mjs";
import { RunStore } from "../src/controller/store.mjs";
import { detectDependencyChanges, repositoryBaseline } from "../src/controller/worktree.mjs";

const pluginRoot = resolve(new URL("..", import.meta.url).pathname);
const canonicalRoot = readFileSync(new URL("./fixtures/artifacts/work-plan.valid.md", import.meta.url), "utf8");

function autoCapableRoot() {
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

function setupRepo(root) {
  const repo = join(root, "repo");
  mkdirSync(join(repo, "src"), { recursive: true });
  git(root, ["init", repo]);
  writeFileSync(join(repo, "src", "feature.js"), "export const value = 0;\n");
  git(repo, ["add", "."]);
  git(repo, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@test.invalid", "commit", "-m", "baseline"]);
  return repo;
}

function routes() {
  const model = { id: "model-2026-07-01", params: [{ id: "reasoning_effort", value: "high" }] };
  const route = { model_id: model.id, reasoning_effort: "high", model_options: {}, fallback: "deny", pricing_usd_per_million: { input: 1, output: 1, cache_read: 0, cache_write: 0 } };
  const names = ["planner", "writer", "writer_escalated", "reviewer", "explainer"];
  return {
    config: Object.fromEntries(names.map((name) => [name, structuredClone(route)])),
    validation: { verified: true, routes: Object.fromEntries(names.map((name) => [name, { valid: true, model: structuredClone(model), errors: [] }])) },
  };
}

function baseRun(repo, routeData) {
  const projectionHash = "b".repeat(64);
  return {
    workspace_root: repo,
    requested_profile: "auto-gated",
    effective_profile: "auto-gated",
    route_profile: "default",
    route_config: routeData.config,
    route_validation: routeData.validation,
    route_hash: "route-hash",
    config_errors: [],
    project_policy: {
      schema: 1, automation_enabled: true, unattended_enabled: false, allowed_write_roots: ["src"], protected_paths: [".git"], protected_oracles: [],
      certified_regions: [], harness_version: "test-harness", minimum_qualifying_runs: null, qualifying_runs: 0, dependencies: "deny", external_effects: "none",
    },
    capabilities: {
      sandbox_boundary_verified: true, worker_network_isolated: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true,
      planner_submission_verified: true, model_catalog_verified: true, model_attestation_observed: true,
    },
    root_plan_text: "approved root",
    root_plan_hash: "root-hash",
    root_authoritative_projection_hash: projectionHash,
    plan: {
      fields: {
        id: "wp-controller-test", intent_ready: true, status: "ready", risk: "medium", assurance_profile: "standard", design_depth: "compact",
        automation_profile_max: "auto-gated", writer_tier_required: "economy", hard_triggers: [],
        automation_bounds: {
          allowed_targets: ["src"], max_risk: "medium", dependencies: "deny", external_effects: "none", delivery: "repository-only",
          max_active_minutes: 10, max_total_tokens: 50_000, max_cost_usd: 5, max_correction_cycles: 2, max_writer_escalations: 1,
        },
      },
      objectives: ["OBJ-1"],
      checks: [],
      slices: [{ "Slice ID": "SLICE-1", Objectives: "OBJ-1", Dependencies: "None.", Targets: "src/feature.js", "Observable outcome": "Feature is corrected.", "Check IDs": "", "Human review": "no" }],
      allowedTargets: ["src"],
      prohibitedTargets: ["all other files"],
      authoritative_projection_text: JSON.stringify({ fields: { id: "wp-controller-test" }, sections: [] }),
      authoritative_projection_hash: projectionHash,
    },
    plan_status: "ready",
    plan_approved: true,
    lifecycle: "queued",
    phase: "slice-ready",
    next_action: "implement-slice",
    baseline: repositoryBaseline(repo),
    worktree: { path: repo, branch: "workflow/test", baseline: repositoryBaseline(repo) },
    execution_started: false,
    current_slice: 0,
    blockers: [],
  };
}

test("auto-gated loop keeps corrections with the writer, escalates once, reviews fresh, and stops at local delivery", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    const roles = [];
    const reviewDecisions = [
      { assessment: "partially-achieved", next_action: "correct", finding_keys: ["same-finding"], findings: ["first"] },
      { assessment: "partially-achieved", next_action: "correct", finding_keys: ["same-finding"], findings: ["repeated"] },
      { assessment: "achieved", next_action: "none", finding_keys: [], findings: [] },
      { assessment: "achieved", next_action: "none", finding_keys: [], findings: [] },
    ];
    const adapter = {
      runPhase({ role, agentId, artifactProjectionHash }) {
        roles.push({ role, agentId: agentId ?? null });
        if (["writer", "writer_escalated"].includes(role)) appendFileSync(join(repo, "src", "feature.js"), `// ${role}\n`);
        const response = { ok: true, result: role === "reviewer" ? JSON.stringify(reviewDecisions.shift()) : "implemented" };
        const receipt = { phase: role, request_id: `${role}-request`, agent_id: `${role}-agent`, model_attested: true, duration_ms: 10, usage: { totalTokens: 10 }, cost_usd: 0.001, artifact_projection_hash: artifactProjectionHash };
        return { response, receipt };
      },
    };
    const run = store.create(baseRun(repo, routeData));
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => adapter });
    const delivered = engine.execute(run.run_id);
    assert.equal(delivered.lifecycle, "waiting-human");
    assert.equal(delivered.next_action, "accept-delivery", JSON.stringify(delivered, null, 2));
    assert.deepEqual(roles.filter(({ role }) => role.startsWith("writer")).map(({ role }) => role), ["writer", "writer", "writer_escalated"]);
    assert.equal(roles.filter(({ role }) => role === "reviewer").length, 4);
    assert.equal(roles[2].agentId, "writer-agent");
    assert.match(readFileSync(join(repo, "src", "feature.js"), "utf8"), /writer_escalated/);
    assert.equal(store.get(run.run_id).writer_escalated, true);
    assert.equal(store.get(run.run_id).checkpoints.length, 1);
    const accepted = engine.acceptDelivery(run.run_id);
    assert.equal(accepted.lifecycle, "achieved");
    assert.equal(accepted.delivery_accepted, true);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("hard Worker timeout is recorded as interrupted and never as successful or waiting-human", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-hard-cancel-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    const created = store.create(baseRun(repo, routeData));
    const engine = new WorkflowEngine({
      workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"),
      adapterFactory: () => ({
        runPhase({ role }) {
          return {
            response: { ok: false, status: "interrupted", error: { message: "cooperative cancel grace exceeded" } },
            receipt: { phase: role, status: "interrupted", error: { message: "cooperative cancel grace exceeded" } },
          };
        },
      }),
    });
    const result = engine.execute(created.run_id);
    assert.equal(result.lifecycle, "interrupted");
    assert.equal(result.next_action, "resume");
    assert.deepEqual(result.blockers, ["worker-hard-cancelled"]);
    assert.equal(result.receipts.at(-1).status, "interrupted");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("writer and reviewer receive only the frozen authoritative root projection", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-projection-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    const projectionHash = "a".repeat(64);
    const runInput = baseRun(repo, routeData);
    runInput.root_plan_text = "RAW ROOT WITH NEVER_SHOW_EXTENSION";
    runInput.root_authoritative_projection_hash = projectionHash;
    runInput.plan.authoritative_projection_text = JSON.stringify({ fields: { id: "wp-controller-test" }, sections: [] });
    runInput.plan.authoritative_projection_hash = projectionHash;
    const calls = [];
    const adapter = {
      runPhase(input) {
        calls.push(input);
        if (input.role === "writer") appendFileSync(join(repo, "src", "feature.js"), "// projected\n");
        return {
          response: { ok: true, result: input.role === "reviewer" ? JSON.stringify({ assessment: "achieved", next_action: "none", finding_keys: [], findings: [] }) : "implemented" },
          receipt: {
            phase: input.role,
            request_id: `${input.role}-request`,
            agent_id: `${input.role}-agent`,
            model_attested: true,
            duration_ms: 1,
            usage: { totalTokens: 1 },
            cost_usd: 0,
            artifact_projection_hash: input.artifactProjectionHash,
          },
        };
      },
    };
    const run = store.create(runInput);
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => adapter });
    const delivered = engine.execute(run.run_id);
    assert.equal(delivered.next_action, "accept-delivery", JSON.stringify(delivered.blockers));
    assert.ok(calls.length >= 3);
    for (const call of calls) {
      assert.equal(call.artifactProjectionHash, projectionHash);
      assert.doesNotMatch(call.prompt, /NEVER_SHOW_EXTENSION/);
      assert.match(call.prompt, /AUTHORITATIVE ROOT PROJECTION/);
    }
    assert.ok(delivered.receipts.every((receipt) => receipt.artifact_projection_hash === projectionHash));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("execution rejects a Run whose frozen projection binding is missing or changed", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-projection-integrity-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const runInput = baseRun(repo, routes());
    runInput.plan.authoritative_projection_hash = "c".repeat(64);
    const run = store.create(runInput);
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => ({ runPhase() { throw new Error("must not run"); } }) });
    assert.throws(() => engine.execute(run.run_id), /root-authoritative-projection-mismatch/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("authorization catches a mock writer that changes outside the frozen root target", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-scope-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    const adapter = {
      runPhase({ role, artifactProjectionHash }) {
        if (role === "writer") writeFileSync(join(repo, "outside.js"), "not authorized\n");
        return { response: { ok: true, result: "{}" }, receipt: { phase: role, request_id: `${role}-request`, agent_id: `${role}-agent`, model_attested: true, duration_ms: 1, usage: { totalTokens: 1 }, cost_usd: 0, artifact_projection_hash: artifactProjectionHash } };
      },
    };
    const run = store.create(baseRun(repo, routeData));
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => adapter });
    const stopped = engine.execute(run.run_id);
    assert.equal(stopped.lifecycle, "waiting-human");
    assert.ok(stopped.blockers.includes("out-of-scope:outside.js"));
    assert.equal(stopped.rollbacks.length, 1);
    assert.equal(readFileSync(join(repo, "src", "feature.js"), "utf8"), "export const value = 0;\n");
    assert.equal(spawnSync("git", ["-C", repo, "status", "--porcelain=v1"], { encoding: "utf8" }).stdout, "");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("missing reviewer receipt fields stop the loop and preserve the failed phase receipt", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-receipt-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    const adapter = {
      runPhase({ role, artifactProjectionHash }) {
        if (role === "writer") appendFileSync(join(repo, "src", "feature.js"), "// changed\n");
        return {
          response: { ok: true, result: role === "reviewer" ? JSON.stringify({ assessment: "achieved", next_action: "none", finding_keys: [], findings: [] }) : "implemented" },
          receipt: { phase: role, request_id: role === "reviewer" ? null : `${role}-request`, agent_id: `${role}-agent`, model_attested: true, duration_ms: 1, usage: { totalTokens: 1 }, cost_usd: 0, artifact_projection_hash: artifactProjectionHash },
        };
      },
    };
    const run = store.create(baseRun(repo, routeData));
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => adapter });
    const stopped = engine.execute(run.run_id);
    assert.equal(stopped.lifecycle, "waiting-human");
    assert.ok(stopped.blockers.includes("reviewer-request-id-missing"));
    assert.equal(stopped.receipts.at(-1).phase, "reviewer");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("exhausted budgets stop before another model phase", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-engine-budget-test-"));
  try {
    const repo = setupRepo(temporary);
    const store = new RunStore(join(temporary, "state"));
    const routeData = routes();
    let phaseCalls = 0;
    let run = store.create(baseRun(repo, routeData));
    run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, receipts: [{ usage: { totalTokens: 50_001 }, cost_usd: 0, duration_ms: 1 }] }));
    const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot, stateRoot: join(temporary, "state"), adapterFactory: () => ({ runPhase() { phaseCalls += 1; throw new Error("must not run"); } }) });
    const stopped = engine.execute(run.run_id);
    assert.equal(stopped.lifecycle, "waiting-human");
    assert.ok(stopped.blockers.includes("token-budget-exhausted"));
    assert.equal(phaseCalls, 0);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("dependency inspection names direct npm changes and treats lock-only drift as unknown", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-dependency-test-"));
  try {
    const repo = join(temporary, "repo");
    mkdirSync(repo);
    git(temporary, ["init", repo]);
    writeFileSync(join(repo, "package.json"), JSON.stringify({ dependencies: { zod: "4.4.3" } }));
    writeFileSync(join(repo, "package-lock.json"), "{}\n");
    git(repo, ["add", "."]);
    git(repo, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@test.invalid", "commit", "-m", "baseline"]);
    const baseline = repositoryBaseline(repo).head;
    writeFileSync(join(repo, "package.json"), JSON.stringify({ dependencies: { zod: "4.4.4", yaml: "2.8.1" } }));
    writeFileSync(join(repo, "package-lock.json"), "{\"changed\":true}\n");
    assert.deepEqual(detectDependencyChanges(repo, baseline, ["package.json", "package-lock.json"]), ["yaml", "zod"]);
    git(repo, ["restore", "package.json"]);
    assert.deepEqual(detectDependencyChanges(repo, baseline, ["package-lock.json"]), ["unknown:package-lock.json"]);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
