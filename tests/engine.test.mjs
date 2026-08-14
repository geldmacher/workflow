import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { WorkflowEngine } from "../src/controller/engine.mjs";
import { RunStore } from "../src/controller/store.mjs";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { deriveControllerLearningContext } from "../src/controller/learning-context.mjs";
import { runView } from "../src/controller/protocol.mjs";
import { createInitialStrategy, calibrateRecipeEvidence, reviseStrategy, strategyHash } from "../src/controller/strategy.mjs";
import { repositoryBaseline } from "../src/controller/worktree.mjs";
import { defaultRoot, executionContractFromArtifactText, inspectArtifactSet, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const roles = ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"];

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function setup({ patchedGrade = "verified", repetitions = 2, taskClass = "bugfix", effectiveProfile = "supervised", readerMutates = false, writerPath = "src/result.mjs", maxTotalTokens = 50000, certification = null, interruptWriterOnce = false, reviewDecisions = [] } = {}) {
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
  let planText = rootPlan
    .replace("max_total_tokens: 50000", `max_total_tokens: ${maxTotalTokens}`)
    // Engine harness grades come from the verifier mock; keep host checks on the verification-profile path.
    .replace("| npm test |", "| verification-profile |");
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
  const completeReviewDecision = (value) => ({
    assessment_summary: value.assessment === "achieved" ? "The exact controller Evidence satisfies the Root." : "The typed findings determine the bounded next action.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The controller reviewer inspected the current worktree snapshot and candidate Evidence.",
    missing_evidence: [],
    ...value,
    findings: (value.findings ?? []).map((finding) => ({
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: finding.summary,
      reasoning: finding.summary,
      resolution: "correct",
      ...finding,
    })),
  });
  const decision = JSON.stringify(completeReviewDecision({ assessment: "achieved", delivery_status: "verified", next_action: "none", finding_keys: [], findings: [] }));
  const queuedReviewDecisions = [...reviewDecisions];
  const nextReviewDecision = () => JSON.stringify(completeReviewDecision(queuedReviewDecisions.shift() ?? JSON.parse(decision)));
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
        const requestedChecks = [...new Set([...input.prompt.matchAll(/"Check ID":\s*"(CHECK-[1-9][0-9]*)"/g)].map((match) => match[1]))];
        const result = JSON.stringify({ entries: (requestedChecks.length > 0 ? requestedChecks : ["CHECK-1"]).map((checkId) => ({
          check_id: checkId, grade, surface: "repository-test", method: taskClass === "performance" ? "benchmark trace metric" : taskClass === "refactor" ? "equivalence harness" : "verification profile",
          expected: "expected", observed: grade === "failed" ? "assertion failed" : "observed", repetitions,
          artifact_hashes: ["b".repeat(64)], limitations: grade === "unavailable" ? ["surface unavailable"] : [],
        })) });
        return { response: { ok: true, status: "finished", result }, receipt: makeReceipt(input.role, input) };
      }
      return { response: { ok: true, status: "finished", result: input.role === "reviewer" ? nextReviewDecision() : decision }, receipt: makeReceipt(input.role, input) };
    },
    runReadOnlyFanout: (phases) => phases.map((input) => {
      calls.push(input.role);
      reviewPrompts.push(input.prompt);
      return { response: { ok: true, status: "finished", result: nextReviewDecision() }, receipt: makeReceipt(input.role, input) };
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
    assert.match(delivered.work_review_id, /^wr-adaptive-retry-[a-f0-9]{12}$/);
    assert.equal(delivered.work_review_builder_provenance.kind, "host-work-review-builder");
    assert.equal(delivered.work_review_builder_provenance.artifact_hash, delivered.work_review_hash);
    assert.deepEqual(inspectArtifactSet([["root", delivered.root_plan_text], ...delivered.workflow_artifacts.map((entry) => [entry.label, entry.text])], defaultRoot).errors, []);
    assert.equal(inspectArtifactText(delivered.delivery_evidence_artifact, defaultRoot).artifact.fields.evidence_mode, "full");
    assert.equal(new ArtifactHandoffStore(env.state, defaultRoot).context("wp-adaptive-retry").evidence_tip, delivered.delivery_evidence_id);
    assert.ok(env.reviewPrompts.some((prompt) => prompt.includes("CANDIDATE DELIVERY EVIDENCE") && prompt.includes(delivered.delivery_evidence_id)));
    assert.equal("delivery_evidence_artifact" in runView(delivered), false);
    assert.equal("work_review_artifact" in runView(delivered), false);
    assert.equal("workflow_artifacts" in runView(delivered), false);
    const accepted = env.engine.acceptDelivery(env.run.run_id, "verified");
    assert.equal(accepted.lifecycle, "achieved");
  } finally { cleanup(env); }
});

test("controller repairs a missing reviewer-owned collection instead of defaulting it", () => {
  const malformed = {
    assessment: "achieved",
    delivery_status: "verified",
    next_action: "none",
    finding_keys: [],
    findings: [],
    missing_evidence: null,
  };
  const env = setup({ reviewDecisions: [malformed, malformed] });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.lifecycle, "waiting-human");
    assert.equal(delivered.delivery_status, "verified");
    assert.equal(env.reviewPrompts.filter((prompt) => prompt.includes("ONE REVIEW-INPUT REPAIR")).length, 2);
    assert.ok(env.reviewPrompts.some((prompt) => prompt.includes("missing_evidence as an array")));
  } finally { cleanup(env); }
});

test("controller repairs a malformed nonselected auditor report without coercion", () => {
  const achieved = { assessment: "achieved", delivery_status: "verified", next_action: "none", finding_keys: [], findings: [] };
  const malformedAuditor = { ...achieved, assessment_summary: 7 };
  const env = setup({ reviewDecisions: [achieved, achieved, malformedAuditor, achieved, achieved] });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.lifecycle, "waiting-human");
    assert.equal(delivered.delivery_status, "verified");
    assert.equal(env.reviewPrompts.filter((prompt) => prompt.includes("ONE REVIEW-INPUT REPAIR")).length, 2);
    assert.ok(env.reviewPrompts.some((prompt) => prompt.includes("auditor_reports[1].summary must be a string")));
  } finally { cleanup(env); }
});

test("controller repairs a missing finding resolution instead of inventing correct", () => {
  const correctionDecision = (resolution) => ({
    assessment: "mostly-achieved",
    delivery_status: "blocked",
    next_action: "correct",
    finding_keys: ["retry-boundary"],
    findings: [{ key: "retry-boundary", summary: "Retry result needs a stable boundary.", resolution }],
    learning_candidates: [{
      finding_keys: ["retry-boundary"],
      reusable_guidance: "Keep retry results behind the repository retry boundary.",
      candidate_targets: ["AGENTS.md"],
      confirmation_evidence: "The corrected delivery passes CHECK-1 without the finding.",
    }],
  });
  const malformed = correctionDecision(null);
  const repaired = correctionDecision("correct");
  const env = setup({ reviewDecisions: [malformed, malformed, repaired, repaired] });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.lifecycle, "waiting-human");
    assert.equal(delivered.review.next_action, "correct");
    assert.ok(env.reviewPrompts.filter((prompt) => prompt.includes("ONE REVIEW-INPUT REPAIR")).length >= 1);
    assert.ok(env.reviewPrompts.some((prompt) => prompt.includes("requires a typed resolution")));
  } finally { cleanup(env); }
});

test("controller corrections retain bounded learning lineage until verified acceptance and integration", () => {
  const env = setup({ reviewDecisions: [{
    assessment: "mostly-achieved",
    delivery_status: "blocked",
    next_action: "correct",
    finding_keys: ["retry-boundary"],
    findings: [{ key: "retry-boundary", summary: "Retry result needs a stable boundary." }],
    learning_candidates: [{
      finding_keys: ["retry-boundary"],
      reusable_guidance: "Keep retry results behind the repository retry boundary.",
      candidate_targets: ["AGENTS.md"],
      confirmation_evidence: "The corrected delivery passes CHECK-1 without the finding.",
    }],
  }] });
  try {
    const delivered = env.engine.execute(env.run.run_id);
    assert.equal(delivered.delivery_status, "verified");
    assert.deepEqual(delivered.delivered_paths, ["src/result.mjs"]);
    assert.match(delivered.delivery_commit, /^[a-f0-9]{40}$/);
    assert.equal(delivered.learning_candidates.length, 1);
    assert.match(delivered.work_review_id, /^wr-adaptive-retry-[a-f0-9]{12}$/);
    assert.deepEqual(inspectArtifactSet([["root", delivered.root_plan_text], ...delivered.workflow_artifacts.map((entry) => [entry.label, entry.text])], defaultRoot).errors, []);
    assert.match(delivered.learning_candidates[0].learning_id, /^LRN-adaptive-retry-/);
    assert.match(delivered.learning_candidates[0].correction_id, /^cp-adaptive-retry-controller-1$/);
    const correctionEvent = env.store.events(delivered.run_id).find((event) => event.payload?.learning_candidate_ids?.length > 0);
    assert.equal(correctionEvent.payload.correction_id, delivered.learning_candidates[0].correction_id);
    assert.equal(correctionEvent.payload.actor_receipt, delivered.learning_candidates[0].source_receipt_ids[0]);
    assert.deepEqual(correctionEvent.payload.actor_receipts, delivered.learning_candidates[0].source_receipt_ids);

    const accepted = env.engine.acceptDelivery(delivered.run_id, "verified");
    const beforeIntegration = deriveControllerLearningContext({ run: accepted, events: env.store.events(accepted.run_id), workspaceRoot: env.repo, pluginRoot: defaultRoot, sourceBinding: { confirmed: true, kind: "test-receipt" } });
    assert.equal(beforeIntegration.eligible, false);
    assert.ok(beforeIntegration.blockers.includes("controller-delivery-not-integrated"));

    git(env.repo, ["checkout", delivered.delivery_commit, "--", "src/result.mjs"]);
    const integrated = deriveControllerLearningContext({ run: accepted, events: env.store.events(accepted.run_id), workspaceRoot: env.repo, pluginRoot: defaultRoot, sourceBinding: { confirmed: true, kind: "test-receipt" } });
    assert.equal(integrated.eligible, true);
    assert.equal(integrated.workspace_match.status, "matched");
    assert.equal(integrated.candidates[0].evidence_confirmed, true);
  } finally { cleanup(env); }
});

test("review fanout semantically deduplicates candidates and preserves exact proposing receipts", () => {
  const achieved = { assessment: "achieved", delivery_status: "verified", next_action: "none", finding_keys: [], findings: [] };
  const firstCorrect = {
    assessment: "mostly-achieved",
    delivery_status: "blocked",
    next_action: "correct",
    finding_keys: ["target-order", "retry-boundary"],
    findings: [
      { key: "target-order", summary: "Target order must not change identity." },
      { key: "retry-boundary", summary: "Retry boundary needs guidance." },
    ],
    learning_candidates: [{
      finding_keys: ["target-order", "retry-boundary"],
      reusable_guidance: "Canonicalize set-like reviewer fields before deduplication.",
      candidate_targets: ["docs/profiles.md", "AGENTS.md"],
      confirmation_evidence: "The corrected fanout test retains one candidate.",
    }],
  };
  const secondCorrect = {
    ...firstCorrect,
    finding_keys: ["retry-boundary", "target-order"],
    findings: [...firstCorrect.findings].reverse(),
    learning_candidates: [{
      ...firstCorrect.learning_candidates[0],
      finding_keys: ["retry-boundary", "target-order"],
      candidate_targets: ["AGENTS.md", "docs/profiles.md"],
    }],
  };
  const env = setup({ reviewDecisions: [achieved, firstCorrect, secondCorrect] });
  try {
    const waiting = env.engine.execute(env.run.run_id);
    assert.equal(waiting.lifecycle, "waiting-human");
    assert.equal(waiting.learning_candidates.length, 1);
    assert.equal(waiting.learning_candidates[0].lineage.length, 1);
    const bindings = waiting.learning_candidates[0].lineage[0].source_bindings;
    assert.equal(bindings.length, 2);
    assert.ok(bindings.some((binding) => binding.source_receipt_id.startsWith("reviewer-")));
    assert.ok(bindings.some((binding) => binding.source_receipt_id.startsWith("investigator-")));
    const correctionEvent = env.store.events(waiting.run_id).find((item) => item.payload?.learning_candidate_refs?.length > 0);
    assert.equal(correctionEvent.payload.learning_candidate_refs.length, 1);
    assert.deepEqual(correctionEvent.payload.learning_candidate_refs[0].source_bindings, bindings);
    assert.deepEqual(correctionEvent.payload.actor_receipts, bindings.map((binding) => binding.source_receipt_id).sort());
  } finally { cleanup(env); }
});

test("controller rejects a candidate whose cited finding has no valid review record", () => {
  const env = setup({ reviewDecisions: [{
    assessment: "mostly-achieved",
    delivery_status: "blocked",
    next_action: "correct",
    finding_keys: ["retry-boundary"],
    findings: [],
    learning_candidates: [{
      finding_keys: ["retry-boundary"],
      reusable_guidance: "Keep the retry boundary explicit.",
      candidate_targets: ["AGENTS.md"],
      confirmation_evidence: "CHECK-1 passes after correction.",
    }],
  }] });
  try {
    const waiting = env.engine.execute(env.run.run_id);
    assert.equal(waiting.lifecycle, "waiting-human");
    assert.match(waiting.blockers.join("\n"), /finding without a valid review finding/);
    assert.deepEqual(waiting.learning_candidates ?? [], []);
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
