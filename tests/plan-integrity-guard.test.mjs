import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCreatePlanGuard } from "../hooks/plan-integrity-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const rootMatch = rootPlan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const humanDetails = `### Outcome and approach

- Outcome: Retry handling is deterministic without changing the public contract.
- Approach and rationale: Update retry implementation and focused tests while preserving the public API.

### Scope and boundaries

- In scope: Repository changes under src and tests.
- Non-goals: No deployment or external service change.
- Constraints: Preserve the public API and repository-only delivery.

### Verification, risks, and recovery

- Acceptance and verification: Run retry verification twice and confirm the public API remains stable.
- Risks and trade-offs: The main risk is a public-contract regression; prefer the smallest deterministic change.
- Unknowns and recovery: Replan if scope, acceptance, or risk must change.`;
const nativePlan = `# Adaptive retry\n\n## Quick decision\n\nImplement deterministic retry handling after approval.\n\n### Next step\n\nHuman: approve Implement Plan.\n\n## Details\n\n${humanDetails}\n\n## Agent and machine contract (authoritative)\n\nThe sections above are human projections. The exact Root below is the only implementation authority.\n\n### Completion handoff\n\nAfter **Implement Plan**, reply in this order: \`Quick decision\` with result, Check summary, optional blocker, and one action (\`Human: start fresh /review-work or $review-work\`); complete human \`Details\` covering outcome, approach, scope/non-goals, verification/limits, risks/unknowns/recovery; then authoritative \`Agent and machine contract\` with exact changed paths, Check commands/directories/observations, failures/uncertainty, and continuation. Do not claim Evidence, Review, or Learning.\n\n\`\`\`yaml artifact-envelope\n${rootMatch[1]}\n\`\`\`\n${rootMatch[2]}`;

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

test("CreatePlan accepts human-first layers before the authoritative Root", () => {
  const result = evaluateCreatePlanGuard(event(), { pluginRoot: defaultRoot });
  assert.deepEqual(result, {});
  assert.ok(nativePlan.indexOf("## Quick decision") < nativePlan.indexOf("## Details"));
  assert.ok(nativePlan.indexOf("## Details") < nativePlan.indexOf("## Agent and machine contract"));
  assert.ok(nativePlan.indexOf("## Agent and machine contract") < nativePlan.indexOf("```yaml artifact-envelope"));
});

test("CreatePlan rejects missing, reordered, or incomplete human-first layers", () => {
  const variants = [
    ["missing layers", nativePlan.replace(/## Quick decision[\s\S]*?(?=\`\`\`yaml artifact-envelope)/, "Arbitrary preamble only.\n\n")],
    ["renamed details", nativePlan.replace("## Details", "## Background")],
    ["reordered layers", nativePlan
      .replace("## Quick decision", "## TEMP")
      .replace("## Details", "## Quick decision")
      .replace("## TEMP", "## Details")],
    ["missing next step", nativePlan.replace("### Next step", "### Suggested action")],
    ["duplicate next step", nativePlan.replace("## Details", "## Details\n\n### Next step\n\nHuman: take a conflicting second action.")],
    ["next step outside quick decision", nativePlan
      .replace("### Next step\n\nHuman: approve Implement Plan.\n\n", "")
      .replace("## Details\n\n", "## Details\n\n### Next step\n\nHuman: approve Implement Plan.\n\n")],
    ["missing completion handoff", nativePlan.replace("### Completion handoff", "### Completion notes")],
    ["incomplete completion handoff", nativePlan.replace("Human: start fresh /review-work or $review-work", "Agent: optionally review later")],
    ["missing human detail coverage", nativePlan.replace("- Non-goals: No deployment or external service change.", "- Non-goals:")],
    ["renamed machine contract", nativePlan.replace("## Agent and machine contract (authoritative)", "## Technical appendix")],
  ];
  for (const [label, plan] of variants) {
    const value = event();
    value.tool_input.plan = plan;
    const result = evaluateCreatePlanGuard(value, { pluginRoot: defaultRoot });
    assert.equal(result.permission, "deny", label);
    assert.match(result.user_message, /ordered H2 layers|Quick decision requires exactly one|Next step.*Quick decision|Completion handoff|Details coverage|Details requires/, label);
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
