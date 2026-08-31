import assert from "node:assert/strict";
import test from "node:test";
import { deriveWorkflowState, workflowStates } from "../scripts/derive-workflow-state.mjs";

const base = { root_plan_id: "wp-state", root_schema_valid: true, artifact_chain_valid: true };

test("state vocabulary is exactly the six human-relevant states", () => {
  assert.deepEqual(new Set(workflowStates), new Set(["root-ready", "review-needed", "correction-needed", "achieved", "open-points", "shadow-review"]));
});

test("ready Root retains the human implementation gate", () => {
  const state = deriveWorkflowState({ ...base, execution_started: false });
  assert.equal(state.state, "root-ready");
  assert.equal(state.next_action, "implement-plan");
});

test("implementation or correction completion means Fresh Review pending", () => {
  for (const input of [{ execution_started: true }, { execution_started: true, correction_evidence_pending_review: true, review: { outcome: "correction-needed" } }]) {
    const state = deriveWorkflowState({ ...base, ...input });
    assert.equal(state.state, "review-needed");
    assert.equal(state.next_action, "review-work");
  }
});

test("Review outcome alone determines correction, open point, or achieved state", () => {
  const cases = [
    ["correction-needed", "correction-needed", "correct"],
    ["open-points", "open-points", "human-assessment"],
    ["achieved", "achieved", "none"],
  ];
  for (const [outcome, expectedState, action] of cases) {
    const state = deriveWorkflowState({ ...base, execution_started: true, review: { outcome }, evidence_grade: "supported" });
    assert.equal(state.state, expectedState);
    assert.equal(state.next_action, action);
  }
});

test("evidence grade does not split achieved into delivery acceptance gates", () => {
  for (const evidence_grade of ["supported", "verified"]) {
    const state = deriveWorkflowState({ ...base, execution_started: true, review: { outcome: "achieved" }, evidence_grade });
    assert.equal(state.state, "achieved");
    assert.equal(state.next_action, "none");
  }
});

test("invalid, incomplete, or absent formal binding derives Shadow Review", () => {
  for (const input of [{}, { ...base, root_schema_valid: false }, { ...base, manual_context_incomplete: true }, { ...base, artifact_chain_valid: false }]) {
    const state = deriveWorkflowState(input);
    assert.equal(state.state, "shadow-review");
    assert.equal(state.next_action, "human-assessment");
  }
});
