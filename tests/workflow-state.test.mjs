import assert from "node:assert/strict";
import test from "node:test";
import { deriveWorkflowState, workflowStates } from "../scripts/derive-workflow-state.mjs";

const approved = {
  run_id: "run-1",
  root_plan_id: "wp-1",
  requested_profile: "auto-gated",
  effective_profile: "auto-gated",
  design_depth: "compact",
  plan_status: "ready",
  plan_approved: true,
  intent_ready: true,
  product_aligned: true,
  architecture_aligned: true,
};

test("derives intake and human clarification without persisted session state", () => {
  const intake = deriveWorkflowState({});
  assert.equal(intake.state, "intake");
  assert.equal(intake.design_depth, null);
  const clarification = deriveWorkflowState({ goal: "Add retry", material_open_decisions: true });
  assert.equal(clarification.state, "intent-clarification");
  assert.equal(clarification.required_actor, "human");
});

test("skips unnecessary design nodes and exposes the next actor", () => {
  const ready = deriveWorkflowState({ ...approved, design_depth: "oneshot" });
  assert.equal(ready.state, "slice-ready");
  assert.equal(ready.required_actor, "writer");
  assert.equal(ready.next_action, "implement-slice");
});

test("requires full design alignment before slices", () => {
  const architecture = deriveWorkflowState({ ...approved, design_depth: "full", architecture_aligned: false });
  assert.equal(architecture.state, "product-aligned");
  const program = deriveWorkflowState({ ...approved, design_depth: "full", program_design_aligned: false });
  assert.equal(program.state, "architecture-aligned");
});

test("never defaults an incomplete root to oneshot manual", () => {
  const invalid = deriveWorkflowState({ ...approved, design_depth: null, root_schema_valid: false });
  assert.equal(invalid.state, "replan");
  assert.equal(invalid.next_action, "create-schema-3-root");
  assert.ok(invalid.blockers.includes("invalid-schema-3-root"));
});

test("maps review decisions to writer, human, or replan", () => {
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, review: { next_action: "correct" } }).required_actor, "writer");
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, review: { next_action: "clarify" } }).state, "waiting-human");
  assert.equal(deriveWorkflowState({ ...approved, execution_started: true, review: { next_action: "replan" } }).state, "replan");
});

test("manual artifact snapshots keep plan and correction authorization with the human", () => {
  const manual = {
    ...approved,
    run_id: null,
    requested_profile: "manual",
    effective_profile: "manual",
    snapshot_source: "artifact-chain",
    revision: null,
  };
  const planGate = deriveWorkflowState({ ...manual, plan_approved: false, execution_started: false });
  assert.equal(planGate.state, "root-plan-review");
  assert.equal(planGate.next_action, "implement-plan");
  assert.equal(planGate.revision, null);

  const correctionGate = deriveWorkflowState({ ...manual, execution_started: true, review: { next_action: "correct" } });
  assert.equal(correctionGate.state, "waiting-human");
  assert.equal(correctionGate.required_actor, "human");
  assert.equal(correctionGate.next_action, "approve-correction");

  const postCorrection = deriveWorkflowState({ ...manual, execution_started: true, review: { next_action: "correct" }, correction_evidence_pending_review: true });
  assert.equal(postCorrection.state, "root-review");
  assert.deepEqual(postCorrection.allowed_actions, ["review"]);
});

test("manual review decisions expose only manual-safe actions", () => {
  const manual = {
    ...approved,
    run_id: null,
    requested_profile: "manual",
    effective_profile: "manual",
    snapshot_source: "artifact-chain",
    revision: null,
    execution_started: true,
  };
  const clarification = deriveWorkflowState({ ...manual, review: { next_action: "clarify" } });
  assert.equal(clarification.state, "waiting-human");
  assert.deepEqual(clarification.allowed_actions, ["answer", "replan"]);
  assert.equal(deriveWorkflowState({ ...manual, review: { next_action: "replan" } }).state, "replan");
  const retry = deriveWorkflowState({ ...manual, review: { next_action: "retry-review" } });
  assert.equal(retry.state, "root-review");
  assert.deepEqual(retry.allowed_actions, ["review"]);
});

test("keeps auto-gated delivery behind a final human gate", () => {
  const delivery = deriveWorkflowState({ ...approved, execution_started: true, root_review_complete: true, review: { assessment: "achieved", next_action: "none" } });
  assert.equal(delivery.state, "delivery-ready");
  assert.deepEqual(delivery.allowed_actions, ["accept", "inspect", "stop"]);
  const achieved = deriveWorkflowState({ ...approved, execution_started: true, root_review_complete: true, delivery_accepted: true, review: { assessment: "achieved", next_action: "none" } });
  assert.equal(achieved.state, "achieved");
});

test("unattended delivery may finish without a scheduled final gate", () => {
  const result = deriveWorkflowState({ ...approved, requested_profile: "unattended-eligible", effective_profile: "unattended-eligible", execution_started: true, root_review_complete: true, review: { assessment: "achieved", next_action: "none" } });
  assert.equal(result.state, "achieved");
});

test("profile downgrade and interruption fail closed", () => {
  const downgrade = deriveWorkflowState({ ...approved, downgrade_pending: true, downgrade_reason: "full-design-not-unattended" });
  assert.equal(downgrade.state, "waiting-human");
  assert.equal(downgrade.next_action, "approve-downgrade");
  assert.equal(deriveWorkflowState({ ...approved, lifecycle: "interrupted" }).state, "interrupted");
});

test("exports the complete public state vocabulary", () => {
  for (const state of ["intake", "program-design-aligned", "delivery-ready", "waiting-human", "achieved", "failed"]) assert.ok(workflowStates.includes(state));
});
