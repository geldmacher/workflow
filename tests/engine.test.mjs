import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { WorkflowEngine } from "../src/controller/engine.mjs";
import { RunStore } from "../src/controller/store.mjs";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { runView } from "../src/controller/protocol.mjs";
import { createInitialStrategy, calibrateRecipeEvidence, reviseStrategy, strategyHash } from "../src/controller/strategy.mjs";
import { repositoryBaseline } from "../src/controller/worktree.mjs";
import { defaultRoot, executionContractFromArtifactText, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const roles = ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"];

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function setup({ patchedGrade = "verified", repetitions = 2, taskClass = "bugfix", effectiveProfile = "supervised", readerMutates = false, writerPath = "src/result.mjs", maxTotalTokens = 50000, certification = null, interruptWriterOnce = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "workflow-engine-"));
  const repo = join(root, "repo");
  const state = join(root, "state");
  const worktrees = join(root, "worktrees");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(join(repo, "tests"), { recursive: true });
  writeFileSync(join(repo, "src", "retry.mjs"), "export const retry = 1;\n");
  writeFileSync(join(repo, "tests", "retry.test.mjs"), "// baseline\n");
  git(repo, ["init"]);
  git(repo, ["add", "."]);
  git(repo, ["-c", "user.name=Test", "-c", "user.email=test@invalid", "commit", "-m", "base"]);
  const store = new RunStore(state);
  let planText = rootPlan.replace("max_total_tokens: 50000", `max_total_tokens: ${maxTotalTokens}`);
  if (effectiveProfile === "autonomous") {
    const bound = {
      task_recipe: taskClass,
      certified_region: certification?.certified_region ?? "src",
      verification_profile_id: certification?.verification_profile_id ?? "verify-repository",
      verification_profile_hash: certification?.verification_profile_hash ?? "b".repeat(64),
      route_pool_hash: certification?.route_pool_hash ?? "a".repeat(64),
    };
    planText = planText
      .replace("profile_max: supervised", "profile_max: autonomous")
      .replace("contract_level: controlled", "contract_level: certified")
      .replace("---\n\n## Intent", [
        "certification:",
        `  verification_profile_id: ${bound.verification_profile_id}`,
        `  verification_profile_hash: ${bound.verification_profile_hash}`,
        `  task_recipe: ${bound.task_recipe}`,
        `  certified_region: ${bound.certified_region}`,
        `  route_pool_hash: ${bound.route_pool_hash}`,
        "---", "", "## Intent",
      ].join("\n"));
  }
  const contract = executionContractFromArtifactText(planText, defaultRoot);
  const strategy = createInitialStrategy(contract);
  strategy.task_class = taskClass;
  strategy.recipe_version = "recipe-1";
  const { strategy_hash: _oldStrategyHash, ...strategyProjection } = strategy;
  strategy.strategy_hash = strategyHash(strategyProjection);
  const routeValidation = {
    verified: true, errors: [],
    routes: Object.fromEntries(roles.map((role) => [role, {
      valid: true,
      selected_candidate: { model_id: `${role}-v1`, reasoning_effort: "high", model_options: {}, pricing_usd_per_million: { input: 1, output: 1, cache_read: 0, cache_write: 0 } },
      model: { id: `${role}-v1`, params: [{ id: "reasoning_effort", value: "high" }] },
      pool_hash: "a".repeat(64), selection_reason: "primary-available",
    }])),
  };
  const calls = [];
  const reviewPrompts = [];
  const verifierCwds = [];
  const writerAgentInputs = [];
  let writerAttempts = 0;
  const makeReceipt = (role, input) => ({
    phase: role, requested_model: { id: input.route?.model_id, reasoning_effort: input.route?.reasoning_effort, model_options: input.route?.model_options ?? {} },
    accepted_model: input.acceptedModel, observed_model: input.acceptedModel, model_attested: true,
    request_id: `${role}-${calls.length}`, agent_id: `${role}-agent`, worker_run_id: `${role}-run`,
    duration_ms: 5, usage: { totalTokens: 10 }, cost_usd: 0.0001,
    artifact_projection_hash: input.artifactProjectionHash, status: "finished",
  });
  const decision = JSON.stringify({ assessment: "achieved", delivery_status: "verified", next_action: "none", finding_keys: [], findings: [] });
  const adapter = {
    validateProfile: () => routeValidation,
    runPhase: (input) => {
      calls.push(input.role);
      if (["reviewer", "investigator"].includes(input.role)) reviewPrompts.push(input.prompt);
      if (["writer", "writer_escalated"].includes(input.role)) {
        writerAgentInputs.push(input.agentId);
        writerAttempts += 1;
        if (interruptWriterOnce && writerAttempts === 1) return { response: { ok: false, status: "interrupted" }, receipt: makeReceipt(input.role, input) };
        writeFileSync(join(input.cwd, writerPath), "export const result = true;\n");
        return { response: { ok: true, status: "finished" }, receipt: makeReceipt(input.role, input) };
      }
      if (input.role === "verifier") {
        verifierCwds.push(input.cwd);
        if (readerMutates) writeFileSync(join(input.cwd, "reader-mutation.txt"), "forbidden\n");
        const stage = input.prompt.includes("for the baseline state") ? "baseline" : "patched";
        const grade = stage === "baseline" ? "verified" : patchedGrade;
        const result = JSON.stringify({ entries: [{
          check_id: "CHECK-1", grade, surface: "repository-test", method: taskClass === "performance" ? "benchmark trace metric" : taskClass === "refactor" ? "equivalence harness" : "verification profile",
          expected: "expected", observed: grade === "failed" ? "assertion failed" : "observed", repetitions,
          artifact_hashes: ["b".repeat(64)], limitations: grade === "unavailable" ? ["surface unavailable"] : [],
        }] });
        return { response: { ok: true, status: "finished", result }, receipt: makeReceipt(input.role, input) };
      }
      return { response: { ok: true, status: "finished", result: decision }, receipt: makeReceipt(input.role, input) };
    },
    runReadOnlyFanout: (phases) => phases.map((input) => {
      calls.push(input.role);
      reviewPrompts.push(input.prompt);
      return { response: { ok: true, status: "finished", result: decision }, receipt: makeReceipt(input.role, input) };
    }),
  };
  const capabilities = { worker_network_isolated: true, sandbox_boundary_verified: true, sdk_secret_isolated: true, sdk_budget_cancel_verified: true };
  const projectPolicy = {
    schema: 2, supervised_enabled: true, autonomous_enabled: effectiveProfile === "autonomous",
    allowed_write_roots: ["src", "tests"], protected_paths: [".git"], approval_required_paths: [],
    dependencies: "deny", allowed_dependencies: [], external_effects: "none", max_risk: "medium",
    maximum_budgets: { max_active_minutes: 60, max_total_tokens: 100000, max_cost_usd: 10, max_correction_cycles: 3 },
    certified_regions: ["src"], minimum_qualifying_runs: 1, verification_profile: null,
  };
  const run = store.create({
    requested_profile: effectiveProfile, effective_profile: effectiveProfile, lifecycle: "queued", phase: "strategy-ready",
    plan_approved: true, plan: contract, root_plan_text: planText, root_plan_hash: contract.raw_hash,
    root_authoritative_projection_hash: contract.authoritative_projection_hash, intent_hash: contract.authoritative_projection_hash,
    strategy, route_validation: routeValidation, route_config: {}, route_hash: "a".repeat(64), harness_hash: "b".repeat(64),
    project_policy: projectPolicy, capabilities, baseline: repositoryBaseline(repo), receipts: [], check_receipts: [], evidence_entries: [], blockers: [],
  });
  const engine = new WorkflowEngine({ workspaceRoot: repo, store, pluginRoot: defaultRoot, stateRoot: state, worktreeRoot: worktrees, adapterFactory: () => adapter, capabilitiesFactory: () => capabilities });
  return { root, repo, state, store, run, engine, calls, reviewPrompts, verifierCwds, writerAgentInputs };
}

function cleanup(env) {
  const current = env.store.get(env.run.run_id);
  for (const path of [current.worktree?.path, current.comparison_baseline_worktree?.path].filter(Boolean)) {
    const result = spawnSync("git", ["-C", env.repo, "worktree", "remove", "--force", path], { encoding: "utf8" });
    if (result.status !== 0 && !/not a working tree/.test(result.stderr)) throw new Error(result.stderr);
  }
  rmSync(env.root, { recursive: true, force: true });
}

test("supervised verified delivery waits for explicit human acceptance", () => {
  const env = setup();
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.lifecycle, "waiting-human");
    assert.equal(delivered.delivery_status, "verified");
    assert.equal(delivered.phase, "delivery-ready-verified");
    assert.match(delivered.delivery_evidence_id, /^de-/);
    assert.match(delivered.delivery_evidence_hash, /^[a-f0-9]{64}$/);
    assert.equal(inspectArtifactText(delivered.delivery_evidence_artifact, defaultRoot).artifact.fields.evidence_mode, "full");
    assert.equal(new ArtifactHandoffStore(env.state, defaultRoot).context("wp-adaptive-retry").evidence_tip, delivered.delivery_evidence_id);
    assert.ok(env.reviewPrompts.some((prompt) => prompt.includes("CANDIDATE DELIVERY EVIDENCE") && prompt.includes(delivered.delivery_evidence_id)));
    assert.equal("delivery_evidence_artifact" in runView(delivered), false);
    const accepted = env.engine.acceptDelivery(env.run.run_id, "verified");
    assert.equal(accepted.lifecycle, "achieved");
  } finally { cleanup(env); }
});

test("evidence gap delivers provisional and acceptance remains non-qualifying", () => {
  const env = setup({ patchedGrade: "unavailable" });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.delivery_status, "provisional");
    assert.equal(delivered.next_action, "accept-provisional");
    assert.equal(inspectArtifactText(delivered.delivery_evidence_artifact, defaultRoot).artifact.fields.status, "provisional");
    assert.throws(() => env.engine.acceptDelivery(env.run.run_id, "verified"), /not awaiting|acceptance mismatch/);
    const accepted = env.engine.acceptDelivery(env.run.run_id, "provisional");
    assert.equal(accepted.lifecycle, "accepted-provisional");
    assert.equal(env.store.qualifyingHistory(), 0);
  } finally { cleanup(env); }
});

test("known failed patched evidence terminates blocked and cannot be accepted", () => {
  const env = setup({ patchedGrade: "failed" });
  try {
    const blocked = env.engine.execute(env.run.run_id);
    assert.equal(blocked.lifecycle, "blocked");
    assert.equal(blocked.delivery_status, "blocked");
    assert.match(blocked.blockers.join("\n"), /known-check-failure/);
    assert.match(blocked.delivery_evidence_id, /^de-/);
    const blockedEvidence = inspectArtifactText(blocked.delivery_evidence_artifact, defaultRoot);
    assert.deepEqual(blockedEvidence.errors, []);
    assert.equal(blockedEvidence.artifact.fields.status, "blocked");
    assert.throws(() => env.engine.acceptDelivery(env.run.run_id, "provisional"), /not awaiting|acceptance mismatch/);
  } finally { cleanup(env); }
});

test("any repository mutation by a read-only verifier is a hard error", () => {
  const env = setup({ readerMutates: true });
  try {
    const blocked = env.engine.execute(env.run.run_id);
    assert.equal(blocked.lifecycle, "blocked");
    assert.match(blocked.blockers.join("\n"), /reader-repository-mutation:verifier/);
  } finally { cleanup(env); }
});

test("autonomous evidence shortfall downgrades visibly to supervised", () => {
  const env = setup({ patchedGrade: "partial", effectiveProfile: "autonomous" });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.effective_profile, "supervised");
    assert.equal(delivered.downgraded, true);
    assert.equal(delivered.downgrade_reason, "evidence-shortfall");
    assert.equal(delivered.delivery_status, "provisional");
  } finally { cleanup(env); }
});

test("source drift is carried as an integration warning and does not stop supervised work", () => {
  const env = setup();
  try {
    writeFileSync(join(env.repo, "src", "retry.mjs"), "export const retry = 2; // human drift\n");
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.delivery_status, "verified");
    assert.equal(delivered.source_drift_at_delivery, true);
    assert.deepEqual(delivered.integration_warnings, ["source-worktree-drift-may-conflict-with-human-integration"]);
  } finally { cleanup(env); }
});

test("unsafe dirty snapshots stop as a hard blocked boundary", () => {
  const env = setup();
  try {
    writeFileSync(join(env.repo, "credentials.txt"), `sk-${"a".repeat(32)}\n`);
    const blocked = env.engine.execute(env.run.run_id);
    assert.equal(blocked.lifecycle, "blocked");
    assert.match(blocked.blockers.join("\n"), /dirty-snapshot-blocked:secret material detected/);
  } finally { cleanup(env); }
});

test("budgets remain hard across writer, verifier, and reviewer receipts", () => {
  const env = setup({ maxTotalTokens: 35 });
  try {
    const blocked = env.engine.execute(env.run.run_id);
    assert.equal(blocked.lifecycle, "blocked");
    assert.match(blocked.blockers.join("\n"), /token-budget-exhausted/);
  } finally { cleanup(env); }
});

test("autonomous writes outside the certified region downgrade and continue supervised", () => {
  const env = setup({
    effectiveProfile: "autonomous",
    writerPath: "tests/result.test.mjs",
    certification: { task_recipe: "bugfix", certified_region: "src" },
  });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.effective_profile, "supervised");
    assert.equal(delivered.delivery_status, "verified");
    assert.match(delivered.downgrade_reason, /certified-region-exceeded:tests\/result.test.mjs/);
  } finally { cleanup(env); }
});

test("adjacent in-envelope writes become hash-chained strategy deviations", () => {
  const env = setup();
  try {
    const current = env.store.get(env.run.run_id);
    const strategy = reviseStrategy(current.strategy, { primary_targets: ["src/retry.mjs"] }, { reason: "narrow primary target", createdBy: "planner", authority: current.plan.fields.authority });
    env.store.update(current.run_id, current.revision, null, (draft) => ({ ...draft, strategy }), "strategy-test-narrowed");
    const delivered = env.engine.execute(env.run.run_id);
    const deviation = delivered.strategy.deviations.find((item) => item.kind === "adjacent-scope");
    assert.deepEqual(deviation.paths, ["src/result.mjs"]);
    assert.equal(delivered.strategy.parent_hash.length, 64);
  } finally { cleanup(env); }
});

test("interrupted runs preserve strategy revision, writer affinity, and resume position", () => {
  const env = setup({ interruptWriterOnce: true });
  try {
    const initial = env.store.get(env.run.run_id);
    const strategy = reviseStrategy(initial.strategy, { primary_targets: ["src"] }, { reason: "pre-run refinement", createdBy: "planner", authority: initial.plan.fields.authority });
    env.store.update(initial.run_id, initial.revision, null, (draft) => ({ ...draft, strategy }), "strategy-refined");
    const interrupted = env.engine.execute(env.run.run_id);
    assert.equal(interrupted.lifecycle, "interrupted");
    const paused = env.store.update(interrupted.run_id, interrupted.revision, null, (draft) => ({ ...draft, lifecycle: "paused", next_action: "resume" }), "run-paused");
    const queued = env.store.update(paused.run_id, paused.revision, null, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "execute-strategy" }), "run-resumed");
    const delivered = env.engine.execute(queued.run_id);
    assert.equal(delivered.delivery_status, "verified");
    assert.equal(delivered.strategy.revision, strategy.revision);
    assert.equal(delivered.current_slice, 1);
    assert.deepEqual(env.writerAgentInputs, [null, "writer-agent"]);
  } finally { cleanup(env); }
});

test("out-of-envelope writer changes roll back to the last checkpoint", () => {
  const env = setup({ writerPath: "README.md" });
  try {
    const waiting = env.engine.execute(env.run.run_id);
    assert.equal(waiting.lifecycle, "waiting-human");
    assert.match(waiting.blockers.join("\n"), /out-of-envelope:README.md/);
    assert.equal(waiting.rollbacks.length, 1);
    assert.equal(readFileSync(join(waiting.worktree.path, "src", "retry.mjs"), "utf8"), "export const retry = 1;\n");
    assert.throws(() => readFileSync(join(waiting.worktree.path, "README.md"), "utf8"), /ENOENT/);
  } finally { cleanup(env); }
});

test("intent and strategy tampering are blocked before execution", () => {
  for (const mutation of ["intent", "strategy"]) {
    const env = setup();
    try {
      const current = env.store.get(env.run.run_id);
      env.store.update(current.run_id, current.revision, null, (draft) => {
        if (mutation === "intent") draft.plan.fields.goal = "Tampered intent outside the approved root.";
        else draft.strategy.strategy_hash = "f".repeat(64);
        return draft;
      }, `${mutation}-tampered`);
      const blocked = env.engine.execute(env.run.run_id);
      assert.equal(blocked.lifecycle, "blocked");
      assert.match(blocked.blockers.join("\n"), mutation === "intent" ? /intent-root-state-mismatch/ : /strategy-hash-mismatch/);
    } finally { cleanup(env); }
  }
});

test("investigation and verify-existing recipes never invoke a writer", () => {
  for (const taskClass of ["investigation", "verify-existing"]) {
    const env = setup({ taskClass });
    try {
      env.engine.execute(env.run.run_id);
      assert.equal(env.calls.some((role) => role === "writer" || role === "writer_escalated"), false);
      assert.equal(env.calls.filter((role) => role === "verifier").length, taskClass === "verify-existing" ? 2 : 1);
      if (taskClass === "verify-existing") {
        assert.equal(env.verifierCwds.length, 2);
        assert.notEqual(env.verifierCwds[0], env.verifierCwds[1]);
        const completed = env.store.get(env.run.run_id);
        assert.equal(env.verifierCwds[0], completed.comparison_baseline_worktree.path);
        assert.equal(env.verifierCwds[1], completed.worktree.path);
      }
    } finally { cleanup(env); }
  }
});

test("task recipes calibrate repeated and comparable evidence instead of trusting labels", () => {
  const entry = { check_id: "CHECK-1", grade: "verified", surface: "surface-a", method: "test", expected: "ok", observed: "ok", repetitions: 1, limitations: [] };
  assert.equal(calibrateRecipeEvidence("bugfix", [entry], "patched")[0].grade, "partial");
  const baseline = [{ ...entry, repetitions: 2 }];
  const patched = [{ ...entry, surface: "surface-b", repetitions: 2 }];
  assert.equal(calibrateRecipeEvidence("bugfix", patched, "patched", baseline)[0].grade, "partial");
  assert.equal(calibrateRecipeEvidence("refactor", [{ ...entry, method: "equivalence harness" }], "patched")[0].grade, "verified");
});

test("strategy revisions remain hash chained and cannot escape authority", () => {
  const contract = executionContractFromArtifactText(rootPlan, defaultRoot);
  const strategy = createInitialStrategy(contract);
  const revised = reviseStrategy(strategy, { primary_targets: ["src/retry.mjs"], deviations: [{ id: "DEV-1" }] }, { reason: "adjacent fix", createdBy: "writer", authority: contract.fields.authority });
  assert.equal(revised.revision, 1);
  assert.equal(revised.parent_hash, strategy.strategy_hash);
  assert.throws(() => reviseStrategy(strategy, { primary_targets: ["README.md"] }, { reason: "escape", createdBy: "writer", authority: contract.fields.authority }), /escapes authority/);
});
