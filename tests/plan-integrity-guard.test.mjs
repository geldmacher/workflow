import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const nativePlan = `# Adaptive retry\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;

function event(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "CreatePlan",
    tool_input: {
      name: "Adaptive retry",
      overview: "Implement the exact Schema-5 Root.",
      plan: nativePlan,
      todos: [{ id: "STEP-1", content: "Implement the approved retry behavior and run planned Checks." }],
    },
    ...overrides,
  };
}

test("CreatePlan validates a native Schema-5 Root without closeout metadata", () => {
  const result = evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot });
  assert.deepEqual(result, {});
});

test("CreatePlan validation is the only lifecycle event", () => {
  assert.deepEqual(evaluateCreatePlanGuard({ ...event(), hook_event_name: "beforeSubmitPrompt" }, { pluginRoot: defaultRoot }), {});
  assert.deepEqual(evaluateCreatePlanGuard({ ...event(), hook_event_name: "postToolUse" }, { pluginRoot: defaultRoot }), {});
});

test("ordinary Cursor plans remain unaffected", () => {
  const value = event();
  value.tool_input.plan = "Implement the ordinary task.";
  assert.deepEqual(evaluateCreatePlanGuard(value, { pluginRoot: defaultRoot }), {});
});

test("Schema-5 native plans require implementation todos", () => {
  const value = event();
  value.tool_input.todos = [];
  const result = evaluateCreatePlanGuard(value, { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /at least one implementation todo/i);
});

test("invalid exposed Schema-5 Roots fail validation", () => {
  const value = event();
  value.tool_input.plan = nativePlan.replace(/id: wp-[^\n]+/, "id: invalid-root-id");
  const result = evaluateCreatePlanGuard(value, { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /Schema-5 CreatePlan denied/i);
});

test("CreatePlan guard fails closed for malformed hook and tool input", () => {
  assert.equal(evaluateCreatePlanGuard(null).permission, "deny");
  assert.equal(evaluateCreatePlanGuard([], { pluginRoot: defaultRoot }).permission, "deny");
  assert.equal(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "CreatePlan", tool_input: null }).permission, "deny");
  assert.deepEqual(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "Read", tool_input: {} }), {});
});

test("CreatePlan guard reports a host preflight rejection", () => {
  const result = evaluateCreatePlanGuard(event(), {
    pluginRoot: defaultRoot,
    preflightRootPlan: () => ({ feasible: false, blocking_issues: [{ message: "intent is incomplete" }] }),
  });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /Root validation failed: intent is incomplete/);
});

test("CreatePlan hook executable returns JSON and fails closed on invalid stdin", () => {
  const script = join(defaultRoot, "hooks", "plan-integrity-guard.mjs");
  const valid = spawnSync(process.execPath, [script], {
    cwd: defaultRoot,
    input: JSON.stringify({ ...event(), hook_event_name: "postToolUse" }),
    encoding: "utf8",
  });
  assert.equal(valid.status, 0);
  assert.deepEqual(JSON.parse(valid.stdout), {});

  const invalid = spawnSync(process.execPath, [script], { cwd: defaultRoot, input: "not-json", encoding: "utf8" });
  assert.equal(invalid.status, 0);
  assert.equal(JSON.parse(invalid.stdout).permission, "deny");
});
