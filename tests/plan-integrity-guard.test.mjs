import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const nativePlan = `# Adaptive retry\n\n## Quick decision\n\nThe retry behavior is ready for a bounded repository implementation. Use **Implement Plan**.\n\n### Next step\n\n- Now: Implement the Plan\n- How: **Implement Plan**\n- Why: Delivers the approved Root inside its repository boundary.\n\n## Details\n\nThe change stays inside the declared retry path and uses the Root's read-only Verification.\n\n## Agent and machine contract (authoritative)\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;
const legacyNativePlan = `# Adaptive retry\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;

function event(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "CreatePlan",
    cwd: defaultRoot,
    workspace_roots: [defaultRoot],
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

test("CreatePlan keeps legacy H1-to-envelope plans compatible but rejects malformed human projection", () => {
  const legacy = event();
  legacy.tool_input.plan = legacyNativePlan;
  assert.deepEqual(evaluateCreatePlanGuard(legacy, { pluginRoot: defaultRoot }), {});

  const malformed = event();
  malformed.tool_input.plan = nativePlan.replace("## Quick decision", "## Decision");
  const denied = evaluateCreatePlanGuard(malformed, { pluginRoot: defaultRoot });
  assert.equal(denied.permission, "deny");
  assert.match(denied.user_message, /human-first native plan projection must order/i);

  for (const plan of [
    nativePlan.replace(/\n### Next step[\s\S]*?\n## Details/, "\n## Details"),
    nativePlan.replace("- Why: Delivers the approved Root inside its repository boundary.\n", ""),
    nativePlan.replace("## Details", "### Next step\n\n- Now: Duplicate\n- How: Duplicate\n- Why: Duplicate\n\n## Details"),
  ]) {
    const invalidFooter = event();
    invalidFooter.tool_input.plan = plan;
    const footerDenied = evaluateCreatePlanGuard(invalidFooter, { pluginRoot: defaultRoot });
    assert.equal(footerDenied.permission, "deny");
    assert.match(footerDenied.user_message, /Next step/i);
  }

  const duplicate = event();
  duplicate.tool_input.plan = `${nativePlan}\n\`\`\`yaml artifact-envelope\n${rootMatch[1].replace("id: wp-adaptive-retry", "id: wp-conflicting-root")}\n\`\`\`\n`;
  const duplicateDenied = evaluateCreatePlanGuard(duplicate, { pluginRoot: defaultRoot });
  assert.equal(duplicateDenied.permission, "deny");
  assert.match(duplicateDenied.user_message, /multiple workflow artifact candidates/i);
});

test("CreatePlan rejects mutating or unavailable required machine Checks", () => {
  for (const command of [
    "find . -delete",
    "sed -n -i README.md",
    "git diff --output=review.patch",
    "npm run workflow-script-that-does-not-exist",
  ]) {
    const value = event();
    value.tool_input.plan = nativePlan.replace("npm test", command);
    const result = evaluateCreatePlanGuard(value, { pluginRoot: defaultRoot });
    assert.equal(result.permission, "deny", command);
    assert.match(result.user_message, /required machine Check is not a uniquely classifiable Review command/i);
  }
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

test("CreatePlan hook executable returns JSON and stays passive on invalid stdin", () => {
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
  assert.deepEqual(JSON.parse(invalid.stdout), {});
});
