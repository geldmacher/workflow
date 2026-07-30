import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateProjectPolicy, validateWorkflowConfig } from "../src/controller/config.mjs";
import { evaluateAuthorization, evaluateEligibility, qualificationKey, selectWriterRoute } from "../src/controller/policy.mjs";
import { RunStore } from "../src/controller/store.mjs";
import { classifyRunCompatibility, protocolFields } from "../src/controller/protocol.mjs";
import { captureDirtySnapshot, createRunWorktree, repositoryBaseline } from "../src/controller/worktree.mjs";
import { validatePoolAgainstCatalog } from "../src/controller/worker-adapter.mjs";

const candidate = (id = "model-v1") => ({
  model_id: id,
  reasoning_effort: "high",
  model_options: {},
  pricing_usd_per_million: { input: 1, output: 2, cache_read: 0.1, cache_write: 0.2 },
});
const pool = (...candidates) => ({ selection: "ordered", fallback: "approved-pool", candidates });
const roles = ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"];
const config = () => ({
  schema: 2,
  planning_preflight_budget: { max_active_minutes: 5, max_total_tokens: 10000, max_cost_usd: 2, max_validation_repairs: 1 },
  route_profiles: { default: Object.fromEntries(roles.map((role) => [role, pool(candidate(`${role}-v1`))])) },
});
const project = (overrides = {}) => ({
  schema: 2,
  supervised_enabled: true,
  autonomous_enabled: false,
  allowed_write_roots: ["src", "tests"],
  protected_paths: [".git", ".cursor/workflow-policy.yaml"],
  approval_required_paths: [],
  verification_profile: null,
  certified_regions: [],
  minimum_qualifying_runs: 2,
  qualifying_runs: 0,
  dependencies: "deny",
  allowed_dependencies: [],
  external_effects: "none",
  max_risk: "medium",
  maximum_budgets: { max_active_minutes: 60, max_total_tokens: 100000, max_cost_usd: 10, max_correction_cycles: 3 },
  extensions: {},
  ...overrides,
});
const authority = {
  allowed_roots: ["src", "tests"], protected_paths: [".git"], approval_required_paths: [],
  dependencies: "deny", external_effects: "none", delivery: "repository-only",
  max_active_minutes: 30, max_total_tokens: 50000, max_cost_usd: 5,
};
const capabilities = {
  model_catalog_verified: true, sandbox_boundary_verified: true, worker_network_isolated: true,
  sdk_secret_isolated: true, sdk_budget_cancel_verified: true, planner_submission_verified: true,
};

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

test("User Config Schema 2 requires seven closed ordered approved pools", () => {
  assert.deepEqual(validateWorkflowConfig(config()), []);
  const missing = config();
  delete missing.route_profiles.default.verifier;
  assert.match(validateWorkflowConfig(missing).join("\n"), /verifier.*missing/);
  const free = config();
  free.route_profiles.default.writer.fallback = "free-choice";
  assert.match(validateWorkflowConfig(free).join("\n"), /approved-pool/);
});

test("ordered pools select only the first available approved candidate", () => {
  const catalog = [{ id: "second-v1", parameters: [{ id: "reasoning_effort", values: [{ value: "high" }] }] }];
  const result = validatePoolAgainstCatalog(pool(candidate("missing-v1"), candidate("second-v1")), catalog);
  assert.equal(result.valid, true);
  assert.equal(result.selected_index, 1);
  assert.equal(result.selection_reason, "approved-pool-fallback");
  assert.match(result.pool_hash, /^[a-f0-9]{64}$/);
});

test("Project Policy Schema 2 keeps external effects closed and autonomous granular", () => {
  assert.deepEqual(validateProjectPolicy(project()), []);
  assert.match(validateProjectPolicy(project({ external_effects: "network" })).join("\n"), /external_effects must be none/);
  assert.match(validateProjectPolicy(project({ autonomous_enabled: true })).join("\n"), /certified_regions|verification_profile/);
});

test("autonomous deficits downgrade to supervised while hard safety deficits block", () => {
  const plan = {
    risk: "medium", contract_level: "certified", hard_triggers: [], authority,
    certification: { task_recipe: "bugfix", verification_profile_hash: "a".repeat(64), certified_region: "src", route_pool_hash: "b".repeat(64) },
  };
  const policy = project({ autonomous_enabled: true, certified_regions: ["src"], verification_profile: { activated_hash: "a".repeat(64) } });
  const downgraded = evaluateEligibility({ requestedProfile: "autonomous", plan, project: policy, capabilities, qualifyingRuns: 2 });
  assert.equal(downgraded.eligible, true);
  assert.equal(downgraded.effective_profile, "supervised");
  assert.match(downgraded.reasons.join("\n"), /verification-profile-not-certified/);
  const blocked = evaluateEligibility({ requestedProfile: "autonomous", plan, project: policy, capabilities: { ...capabilities, sdk_secret_isolated: false }, qualifyingRuns: 2 });
  assert.equal(blocked.eligible, false);
  assert.match(blocked.blockers.join("\n"), /sdk-secret-isolated-missing/);
});

test("fully certified qualification key enables autonomous only for its exact tuple", () => {
  const key = qualificationKey({ taskClass: "bugfix", verificationProfileHash: "a".repeat(64), routePoolHash: "b".repeat(64), certifiedRegion: "src" });
  assert.equal(key.split(":").length, 4);
  const plan = { risk: "medium", contract_level: "certified", hard_triggers: [], authority, certification: { task_recipe: "bugfix", verification_profile_hash: "a".repeat(64), certified_region: "src", route_pool_hash: "b".repeat(64) } };
  const result = evaluateEligibility({
    requestedProfile: "autonomous", plan,
    project: project({ autonomous_enabled: true, certified_regions: ["src"], verification_profile: { activated_hash: "a".repeat(64) } }),
    capabilities: {
      ...capabilities,
      verification_profile_certified: true,
      verification_profile_hash: "a".repeat(64),
      route_pool_certified: true,
      route_pool_models_certified: true,
      attested_route_hash: "b".repeat(64),
      qualification_bindings: [{ task_class: "bugfix", verification_profile_hash: "a".repeat(64), route_pool_hash: "b".repeat(64), certified_region: "src" }],
    }, qualifyingRuns: 2,
  });
  assert.equal(result.effective_profile, "autonomous");
  assert.equal(result.downgraded, false);
  const mismatchedRecipe = evaluateEligibility({
    requestedProfile: "autonomous", plan, taskClass: "feature",
    project: project({ autonomous_enabled: true, certified_regions: ["src"], verification_profile: { activated_hash: "a".repeat(64) } }),
    capabilities: result.effective_profile === "autonomous" ? {
      ...capabilities,
      verification_profile_certified: true,
      verification_profile_hash: "a".repeat(64),
      route_pool_certified: true,
      route_pool_models_certified: true,
      attested_route_hash: "b".repeat(64),
      qualification_bindings: [{ task_class: "bugfix", verification_profile_hash: "a".repeat(64), route_pool_hash: "b".repeat(64), certified_region: "src" }],
    } : capabilities,
    qualifyingRuns: 2,
  });
  assert.equal(mismatchedRecipe.effective_profile, "supervised");
  assert.match(mismatchedRecipe.reasons.join("\n"), /task-recipe-mismatch|qualification-binding-missing/);
});

test("scope envelope permits adjacent in-root changes and blocks protected or expanded effects", () => {
  const plan = { risk: "medium", authority };
  assert.equal(evaluateAuthorization({ plan, changedPaths: ["src/retry.mjs", "tests/retry.test.mjs"] }).authorized, true);
  const denied = evaluateAuthorization({ plan, changedPaths: ["README.md", ".git/config"], externalEffect: true });
  assert.equal(denied.authorized, false);
  assert.match(denied.blockers.join("\n"), /out-of-envelope:README.md|protected-path:.git\/config|external-effect-not-authorized/);
});

test("writer affinity changes only at escalation boundaries", () => {
  assert.equal(selectWriterRoute({ plan: { contract_level: "controlled", risk: "medium", hard_triggers: [] } }).role, "writer");
  assert.equal(selectWriterRoute({ plan: { contract_level: "controlled", risk: "medium", hard_triggers: [] }, findingRepeated: true }).role, "writer_escalated");
  assert.equal(selectWriterRoute({ plan: { contract_level: "controlled", risk: "medium", hard_triggers: [] }, alreadyEscalated: true }).reason, "writer-affinity-escalated");
});

test("Decision Ledger events are hash chained", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-store-"));
  try {
    const store = new RunStore(root);
    const run = store.create({ requested_profile: "supervised", lifecycle: "waiting-human" });
    store.appendDecision(run.run_id, { phase: "strategy", decision: "revise", reason: "equivalent check", input_hashes: ["a".repeat(64)], strategy_revision: 1 });
    const events = store.events(run.run_id);
    assert.equal(events.length, 2);
    assert.equal(events[1].previous_hash, events[0].event_hash);
    assert.match(events[1].event_hash, /^[a-f0-9]{64}$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("run mutations remain idempotent across a strategy revision", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-idempotency-"));
  try {
    const store = new RunStore(root);
    const run = store.create({ requested_profile: "supervised", lifecycle: "queued", strategy: { revision: 0 } });
    let mutations = 0;
    const first = store.update(run.run_id, run.revision, "strategy-revision-key", (draft) => {
      mutations += 1;
      return { ...draft, strategy: { revision: 1, parent_hash: "a".repeat(64) } };
    }, "strategy-revised");
    const duplicate = store.update(run.run_id, run.revision, "strategy-revision-key", () => {
      mutations += 1;
      throw new Error("duplicate mutator must not run");
    }, "strategy-revised");
    assert.equal(mutations, 1);
    assert.equal(duplicate.revision, first.revision);
    assert.deepEqual(duplicate.strategy, first.strategy);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("accepted-provisional never contributes to qualifying history", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-history-"));
  try {
    const store = new RunStore(root);
    let verified = store.create({ requested_profile: "supervised", lifecycle: "waiting-human" });
    verified = store.update(verified.run_id, verified.revision, null, (draft) => ({ ...draft, lifecycle: "achieved", effective_profile: "supervised", root_review_complete: true, review: { assessment: "achieved" }, delivery_accepted: true, evidence_grade: "verified", qualification_key: "key", blockers: [] }));
    let provisional = store.create({ requested_profile: "supervised", lifecycle: "waiting-human" });
    provisional = store.update(provisional.run_id, provisional.revision, null, (draft) => ({ ...draft, lifecycle: "accepted-provisional", effective_profile: "supervised", delivery_accepted: true, evidence_grade: "partial", qualification_key: "key", blockers: [] }));
    assert.equal(store.qualifyingHistory("key"), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Workflow 3 runs remain visible read-only and cannot block Workflow 4", () => {
  const old = { run_record_schema: 1, artifact_schema: 3, controller_protocol: 3, plugin_version: "3.0.0" };
  assert.equal(classifyRunCompatibility(old).compatibility, "read-only-workflow-3");
  assert.equal(classifyRunCompatibility(protocolFields()).compatible, true);
});

test("dirty snapshot reproduces tracked and untracked human state without changing the source worktree", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-dirty-"));
  const repo = join(root, "repo");
  const worktrees = join(root, "worktrees");
  mkdirSync(repo);
  try {
    git(repo, ["init"]);
    mkdirSync(join(repo, "src"));
    writeFileSync(join(repo, "src", "value.txt"), "base\n");
    git(repo, ["add", "src/value.txt"]);
    git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "base"]);
    writeFileSync(join(repo, "src", "value.txt"), "staged\n");
    git(repo, ["add", "src/value.txt"]);
    writeFileSync(join(repo, "src", "value.txt"), "working\n");
    writeFileSync(join(repo, "notes.txt"), "human note\n");
    const before = repositoryBaseline(repo);
    const sourceBytes = readFileSync(join(repo, "src", "value.txt"), "utf8");
    const snapshot = captureDirtySnapshot(repo);
    const created = createRunWorktree(repo, "dirty-test", { root: worktrees, dirtySnapshot: snapshot });
    assert.equal(readFileSync(join(created.path, "src", "value.txt"), "utf8"), "working\n");
    assert.equal(readFileSync(join(created.path, "notes.txt"), "utf8"), "human note\n");
    assert.equal(created.dirty_snapshot_hash, snapshot.snapshot_hash);
    assert.notEqual(created.human_baseline, before.head);
    assert.deepEqual(repositoryBaseline(repo), before);
    assert.equal(readFileSync(join(repo, "src", "value.txt"), "utf8"), sourceBytes);
    git(repo, ["worktree", "remove", "--force", created.path]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("dirty snapshot rejects recognizable secret material", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-secret-"));
  try {
    git(root, ["init"]);
    writeFileSync(join(root, "base.txt"), "base\n");
    git(root, ["add", "base.txt"]);
    git(root, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "base"]);
    writeFileSync(join(root, "secret.txt"), "-----BEGIN PRIVATE KEY-----\nnot-safe\n");
    assert.throws(() => captureDirtySnapshot(root), /secret material/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
