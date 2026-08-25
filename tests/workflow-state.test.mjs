import assert from "node:assert/strict";
import test from "node:test";
import { deriveWorkflowState, workflowStates } from "../scripts/derive-workflow-state.mjs";

const approved = {
  root_plan_id: "wp-v6",
  requested_profile: "manual",
  effective_profile: "manual",
  goal: "Deliver safely",
  plan_status: "ready",
  plan_approved: true,
  intent_ready: true,
  root_schema_valid: true,
  blockers: [],
};

test("approved roots retain the human implementation gate", () => {
  const value = deriveWorkflowState(approved);
  assert.equal(value.state, "root-plan-review");
  assert.equal(value.required_actor, "human");
  assert.equal(value.next_action, "implement-plan");
  assert.equal("strategy_revision" in value, false);
  assert.equal("strategy_hash" in value, false);
});

test("generic harness phase status drives only lifecycle state", () => {
  assert.equal(deriveWorkflowState({ ...approved, phase: "implement", phase_status: "running" }).state, "implementing");
  assert.equal(deriveWorkflowState({ ...approved, phase: "correct", phase_status: "running" }).state, "correcting");
  assert.equal(deriveWorkflowState({ ...approved, phase: "review", phase_status: "running" }).state, "reviewing");
  const unavailable = deriveWorkflowState({ ...approved, harness_status: "unavailable" });
  assert.equal(unavailable.state, "waiting-human");
  assert.ok(unavailable.blockers.includes("harness-unavailable"));
  const failed = deriveWorkflowState({ ...approved, harness_status: "failed" });
  assert.equal(failed.state, "blocked");
});

test("invalid roots require a human-approved Schema-6 replan", () => {
  const value = deriveWorkflowState({ ...approved, artifact_chain_valid: false });
  assert.equal(value.state, "replan");
  assert.equal(value.next_action, "create-schema-6-root");
  assert.ok(value.blockers.includes("schema-6-replan-required"));
});

test("verified and provisional deliveries keep distinct human gates", () => {
  const verified = deriveWorkflowState({ ...approved, delivery_status: "verified" });
  assert.equal(verified.state, "delivery-ready-verified");
  assert.equal(verified.required_actor, "reviewer");
  const provisional = deriveWorkflowState({ ...approved, delivery_status: "provisional" });
  assert.equal(provisional.state, "delivery-ready-provisional");
  assert.equal(provisional.required_actor, "human");
  assert.equal(provisional.next_action, "accept-provisional");
});

test("achieved and accepted provisional are honest terminal states", () => {
  const achieved = deriveWorkflowState({ ...approved, review: { assessment: "achieved", next_action: "none" } });
  assert.equal(achieved.state, "achieved");
  assert.deepEqual(achieved.allowed_actions, ["explain", "learn"]);
  const accepted = deriveWorkflowState({ ...approved, delivery_status: "provisional", manual_acceptance: "provisional", artifact_set_hash: "a".repeat(64) });
  assert.equal(accepted.state, "accepted-provisional");
  assert.equal(accepted.acceptance_persisted, false);
});

test("state vocabulary is lifecycle-only", () => {
  for (const state of ["implementing", "reviewing", "correcting", "delivery-ready-verified", "delivery-ready-provisional", "blocked"]) {
    assert.ok(workflowStates.includes(state));
  }
  assert.equal(workflowStates.includes("strategy-ready"), false);
  assert.equal(workflowStates.includes("host-verifying"), false);
});
