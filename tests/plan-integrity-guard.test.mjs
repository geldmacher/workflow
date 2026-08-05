import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const marker = "[workflow-model-inherit-v1]";
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const nativePlan = `# Adaptive retry\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;

function event(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "CreatePlan",
    tool_input: {
      name: "Adaptive retry",
      overview: "Implement and verify deterministic retry handling.",
      plan: nativePlan,
      todos: [
        { id: "STEP-1", content: `${marker} STEP-1 implement deterministic retry handling` },
        { id: "closeout", content: `${marker} Run CHECK-1, call workflow_closeout with the exact Root/chain, and print its returned artifact unchanged` },
      ],
    },
    ...overrides,
  };
}

test("CreatePlan guard accepts a valid native Schema-5 plan", () => {
  assert.deepEqual(evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot }), {});
});

test("CreatePlan guard rejects the KIP pattern without marked deterministic closeout", () => {
  const result = evaluateCreatePlanGuard(event({
    tool_input: {
      name: "Decouple handoff tooling",
      overview: "Remove local handoff guidance.",
      plan: nativePlan,
      todos: [
        { id: "STEP-1", content: "Delete local handoff tooling" },
        { id: "STEP-2", content: "Rewrite project guidance" },
      ],
    },
  }), { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /workflow-model-inherit-v1/);
  assert.match(result.user_message, /workflow_closeout|returned artifact unchanged/);
  assert.match(result.user_message, /no Plan was created/);
});

test("CreatePlan guard rejects cache-dependent or lossy closeout todos", () => {
  for (const replacement of [
    "call workflow_closeout with cached context, and print its returned artifact unchanged",
    "call workflow_closeout with the exact Root/chain, and report completion",
    "call workflow_closeout with the exact Root/chain, and print the artifact unchanged",
  ]) {
    const candidate = event();
    candidate.tool_input.todos[1].content = `${marker} Run CHECK-1, ${replacement}`;
    const result = evaluateCreatePlanGuard(candidate, { pluginRoot: defaultRoot });
    assert.equal(result.permission, "deny");
  }
});

test("CreatePlan guard leaves ordinary Cursor plans untouched", () => {
  const ordinary = event();
  ordinary.tool_input.plan = "# Ordinary plan\n\nImplement a local refactor.";
  ordinary.tool_input.todos = [{ id: "step", content: "Implement the refactor" }];
  assert.deepEqual(evaluateCreatePlanGuard(ordinary, { pluginRoot: defaultRoot }), {});
});

test("CreatePlan guard fails closed for invalid or todo-less Workflow payloads", () => {
  const invalid = event();
  invalid.tool_input = { name: "Missing plan" };
  assert.equal(evaluateCreatePlanGuard(invalid, { pluginRoot: defaultRoot }).permission, "deny");

  const todoLess = event();
  todoLess.tool_input.todos = [];
  const result = evaluateCreatePlanGuard(todoLess, { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /native todos are required/);
});

test("CreatePlan guard fails closed for malformed hook input without echoing it", () => {
  const hookPath = join(defaultRoot, "hooks", "plan-integrity-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], { input: "not-json secret-plan", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.permission, "deny");
  assert.doesNotMatch(result.stdout, /secret-plan/);
});
