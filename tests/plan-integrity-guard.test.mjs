import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { nativePlan } from "./support/workflow-fixtures.mjs";

function event(plan = nativePlan(), additions = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "CreatePlan",
    tool_input: { name: "Any host title", overview: "Any overview", todos: [], plan, isProject: true },
    ...additions,
  };
}

test("active Workflow Plan Work accepts free-form Markdown with one generated Core and no host todos", () => {
  assert.deepEqual(evaluateCreatePlanGuard(event(), { activePlanWork: true }), {});
});

test("active Plan Work rejects text, Core, duplicate, and trailing-content tampering with a repair reason", () => {
  const cases = [
    nativePlan().replace("Adaptive retry delivery", "Changed delivery"),
    nativePlan().replace("risk: medium", "risk: high"),
    `${nativePlan()}\n${nativePlan().match(/<details>[\s\S]*<\/details>/)[0]}\n`,
    `${nativePlan()}\nTrailing content.\n`,
  ];
  for (const plan of cases) {
    const result = evaluateCreatePlanGuard(event(plan), { activePlanWork: true });
    assert.equal(result.permission, "deny");
    assert.match(result.user_message, /workflow-plan-repair-required/);
    assert.match(result.user_message, /internally|intern/i);
  }
});

test("active Plan Work catches malformed Workflow claims independent of fence label", () => {
  for (const plan of [
    "```json\n{\"artifact\":\"work-plan\",\"schema\":6}\n```",
    "```text\nartifact: work-plan\nschema: 6\n```",
    "Plan prose claiming a Workflow work-plan without a generated Core.",
  ]) {
    const result = evaluateCreatePlanGuard(event(plan), { activePlanWork: true });
    assert.equal(result.permission, "deny");
    assert.match(result.user_message, /workflow-plan-repair-required/);
  }
});

test("active Plan Work returns a machine-readable repair denial for Authority preflight failures", () => {
  const result = evaluateCreatePlanGuard(event(), {
    activePlanWork: true,
    preflightRootPlan: () => ({
      feasible: false,
      blocking_issues: [{ message: "Objective coverage is incomplete.\nRepair the Core." }],
    }),
  });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /workflow-plan-repair-required/);
  assert.match(result.user_message, /Authority validation failed: Objective coverage is incomplete\. Repair the Core\./);
  assert.match(result.user_message, /Repair it internally/);
});

test("outside active Workflow Plan Work CreatePlan is fail-open even for malformed claims", () => {
  assert.deepEqual(evaluateCreatePlanGuard(event("artifact: work-plan\nschema: 5"), { activePlanWork: false }), {});
  assert.deepEqual(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "Other", tool_input: {} }), {});
});

test("invalid hook input fails closed only when the CreatePlan payload itself is targeted", () => {
  assert.equal(evaluateCreatePlanGuard(null).permission, "deny");
  assert.equal(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "CreatePlan", tool_input: null }, { activePlanWork: true }).permission, "deny");
  assert.deepEqual(evaluateCreatePlanGuard({ hook_event_name: "postToolUse", tool_name: "CreatePlan", tool_input: null }), {});
});
