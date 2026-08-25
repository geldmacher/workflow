import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const match = root.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

function presented(rootText = root) {
  const parts = rootText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return [
    "# Retry delivery",
    "",
    "## Quick decision",
    "",
    "The Schema-6 Root is ready.",
    "",
    "### Next step",
    "",
    "- Now: Implement Plan",
    "- How: Select the host-native implementation action.",
    "- Why: Authorizes delivery inside the Root.",
    "",
    "## Details",
    "",
    "The project harness chooses execution.",
    "",
    "## Agent and machine contract (authoritative)",
    "",
    "```yaml artifact-envelope",
    parts[1],
    "```",
    parts[2],
  ].join("\n");
}

function event(plan = presented()) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "CreatePlan",
    cwd: defaultRoot,
    workspace_roots: [defaultRoot],
    tool_input: { name: "Retry delivery", plan, todos: [{ id: "STEP-1", content: "Deliver the approved outcome." }] },
  };
}

test("CreatePlan accepts one human-presented Schema-6 Root", () => {
  assert.deepEqual(evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot }), {});
});

test("guard never classifies project tools named in non-authoritative prose", () => {
  const plan = presented().replace(
    "The project harness chooses execution.",
    "The project harness may privately choose DDEV, npm, nested shell, or any other project mechanism.",
  );
  assert.deepEqual(evaluateCreatePlanGuard(event(plan), { pluginRoot: defaultRoot }), {});
});

test("Schema-6 execution fields are rejected by the closed Root schema, not a command classifier", () => {
  const invalidRoot = root.replace("status: ready", "status: ready\nhost_commands:\n  - ddev exec verify");
  const result = evaluateCreatePlanGuard(event(presented(invalidRoot)), { pluginRoot: defaultRoot });
  assert.equal(result.permission, "deny");
  assert.match(result.user_message, /additional propert|unknown|Schema-6/i);
  assert.doesNotMatch(result.user_message, /program-not-classified|unapproved-root-check|command mismatch/i);
});

test("unsupported Workflow schemas are rejected while ordinary plans remain unaffected", () => {
  const unsupported = evaluateCreatePlanGuard(event(presented(root.replace("schema: 6", "schema: 7"))), { pluginRoot: defaultRoot });
  assert.equal(unsupported.permission, "deny");
  assert.match(unsupported.user_message, /Schema-6|schema 6/i);
  assert.deepEqual(evaluateCreatePlanGuard(event("Implement an ordinary task."), { pluginRoot: defaultRoot }), {});
});

test("CreatePlan guard counter-probes fail closed only for the targeted Workflow action", () => {
  assert.equal(evaluateCreatePlanGuard(null).permission, "deny");
  assert.deepEqual(evaluateCreatePlanGuard({ hook_event_name: "stop" }), {});
  assert.deepEqual(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "Shell" }), {});
  assert.equal(evaluateCreatePlanGuard({ hook_event_name: "preToolUse", tool_name: "CreatePlan", tool_input: null }).permission, "deny");
  assert.equal(evaluateCreatePlanGuard(event(presented()), {
    pluginRoot: defaultRoot,
    preflightRootPlan: () => ({ feasible: false, blocking_issues: [{ message: "Intent cannot be established" }] }),
  }).permission, "deny");
  const noTodos = event();
  noTodos.tool_input = { ...noTodos.tool_input, todos: [] };
  assert.match(evaluateCreatePlanGuard(noTodos, { pluginRoot: defaultRoot }).user_message, /at least one implementation todo/i);
});
