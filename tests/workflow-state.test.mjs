import assert from "node:assert/strict";
import test from "node:test";
import { deriveWorkflowState, workflowStates } from "../scripts/derive-workflow-state.mjs";

const approved = {
  run_id: "run-v4", root_plan_id: "wp-v4", requested_profile: "supervised", effective_profile: "supervised",
  goal: "Fix retries", plan_status: "ready", plan_approved: true, intent_ready: true, root_schema_valid: true,
  intent_hash: "b".repeat(64),
  strategy: { revision: 0, strategy_hash: "a".repeat(64), steps: [{ id: "SLICE-1" }], deviations: [{ id: "DEV-1" }] }, blockers: [],
};

test("controller runs move from immutable intent to adaptive strategy", () => {
  const value = deriveWorkflowState(approved);
  assert.equal(value.state, "strategy-ready");
  assert.equal(value.required_actor, "controller");
  assert.equal(value.next_action, "execute-strategy");
  assert.equal(value.intent_hash, "b".repeat(64));
  assert.equal(value.strategy_revision, 0);
  assert.deepEqual(value.deviations, [{ id: "DEV-1" }]);
});

test("manual roots keep the human implementation gate", () => {
  const value = deriveWorkflowState({ ...approved, run_id: null, snapshot_source: "artifact-chain", requested_profile: "manual", effective_profile: "manual" });
  assert.equal(value.state, "root-plan-review");
  assert.equal(value.required_actor, "human");
  assert.equal(value.next_action, "implement-plan");
});

test("baseline, implementation, and review phases expose their actual actors", () => {
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, phase: "baseline-verification" }).required_actor, "verifier");
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, phase: "implementing" }).required_actor, "writer");
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, phase: "slice-review" }).required_actor, "reviewer");
});

test("verified and provisional deliveries have distinct acceptance actions", () => {
  const verified = deriveWorkflowState({ ...approved, execution_started: true, root_review_complete: true, phase: "delivery-ready-verified", delivery_status: "verified" });
  assert.equal(verified.state, "delivery-ready-verified");
  assert.deepEqual(verified.allowed_actions, ["accept-verified", "inspect", "stop"]);
  const provisional = deriveWorkflowState({ ...approved, execution_started: true, root_review_complete: true, phase: "delivery-ready-provisional", delivery_status: "provisional" });
  assert.equal(provisional.state, "delivery-ready-provisional");
  assert.equal(provisional.next_action, "accept-provisional");
});

test("accepted-provisional and blocked are honest terminal states", () => {
  assert.equal(deriveWorkflowState({ ...approved, lifecycle: "accepted-provisional" }).state, "accepted-provisional");
  assert.equal(deriveWorkflowState({ ...approved, lifecycle: "blocked", blockers: ["known-check-failure"] }).state, "blocked");
});

test("pause, interruption, and invalid root remain human controlled", () => {
  assert.deepEqual(deriveWorkflowState({ ...approved, lifecycle: "paused" }).allowed_actions, ["resume", "stop"]);
  assert.equal(deriveWorkflowState({ ...approved, lifecycle: "interrupted" }).next_action, "reconcile-and-resume");
  assert.equal(deriveWorkflowState({ ...approved, artifact_chain_valid: false }).next_action, "create-schema-5-root");
});

test("state vocabulary exports Workflow 5 delivery states", () => {
  for (const state of ["strategy-ready", "baseline-verification", "delivery-ready-verified", "delivery-ready-provisional", "accepted-provisional", "blocked"]) assert.ok(workflowStates.includes(state));
});
