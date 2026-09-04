import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { classifyCodexWorkflowPrompt, evaluateCodexHook } from "../src/core/codex-hook-policy.mjs";
import { buildWorkflowAuthorityPlan, parseWorkflowAuthorityPlan } from "../src/core/workflow-authority-core.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const proposed = "<proposed_plan>\n" + root + "\n</proposed_plan>";

function implementPlanRoot() {
  const parsed = parseWorkflowAuthorityPlan(root);
  const built = buildWorkflowAuthorityPlan(
    `${parsed.plan_markdown.trimEnd()}\n\nThe native \`<proposed_plan>\` container can mention $learn-from-work only with separate authorization.\n`,
    { ...parsed.core, source: "$plan-work" },
  );
  return built.root_plan;
}

function proposedPlanHandoff() {
  return `<proposed_plan>\n${implementPlanRoot()}</proposed_plan>`;
}

function nativeButtonHandoff() {
  return `PLEASE IMPLEMENT THIS PLAN:\n${implementPlanRoot()}`;
}

function step(state, input) {
  return evaluateCodexHook({ session_id: "s", turn_id: "t", ...input }, state, { pluginRoot: defaultRoot });
}

test("Plan mode accepts one exact Schema-6 Root and rejects unsupported schemas", () => {
  let value = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "plan" },
    prompt: "$plan-work migrate",
  });
  assert.equal(value.state.schema, 6);
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: proposed });
  assert.deepEqual(value.output, {});

  let unsupported = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "plan" },
    prompt: "$plan-work migrate",
  });
  unsupported = step(unsupported.state, {
    hook_event_name: "Stop",
    last_assistant_message: proposed.replace("schema: 6", "schema: 7"),
  });
  assert.equal(unsupported.output.decision, "block");
  assert.match(unsupported.output.reason, /Schema-6|schema 6/i);
});

test("explicit non-Plan mode blocks planning but permission_mode is not authority", () => {
  const blocked = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "default" },
    permission_mode: "plan",
    prompt: "$plan-work migrate",
  });
  assert.equal(blocked.output.decision, "block");

  const unavailable = step({}, {
    hook_event_name: "UserPromptSubmit",
    permission_mode: "default",
    prompt: "$plan-work migrate",
  });
  assert.equal(unavailable.output.decision, undefined);
  assert.equal(unavailable.state.turn.phase, "planning");
});

test("Review context delegates read-only enforcement and all execution choices to harness", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work" });
  assert.match(value.output.hookSpecificOutput.additionalContext, /project harness chooses and enforces concrete execution/i);
  assert.match(value.output.hookSpecificOutput.additionalContext, /does not classify tools or commands/i);

  for (const tool of ["apply_patch", "Shell", "Agent", "mcp__anything__tool"]) {
    value = step(value.state, { hook_event_name: "PreToolUse", tool_name: tool, tool_input: {} });
    assert.deepEqual(value.output, {}, tool);
  }
});

test("ordinary prompts and implementation are not Workflow gated", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "Implement this ordinary task" });
  assert.deepEqual(value.output, {});
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: {} });
  assert.deepEqual(value.output, {});
});

test("native Implement Plan handoff treats one valid proposed plan as opaque", () => {
  const prompt = proposedPlanHandoff();
  assert.deepEqual(classifyCodexWorkflowPrompt(prompt), { kind: "ordinary", phase: null });

  const value = step({}, { hook_event_name: "UserPromptSubmit", prompt });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.turn, null);
});

test("only Workflow invocations outside a valid proposed plan control routing", () => {
  const prompt = proposedPlanHandoff();
  assert.deepEqual(
    classifyCodexWorkflowPrompt(`${prompt}\n\n$review-work`),
    { kind: "workflow-skill", phase: "review" },
  );

  const ambiguous = step({}, {
    hook_event_name: "UserPromptSubmit",
    prompt: `${prompt}\n\n$review-work\n$work-status`,
  });
  assert.equal(ambiguous.output.decision, "block");
  assert.match(ambiguous.output.reason, /exactly one explicit Workflow skill/i);
});

test("invalid, incomplete, and multiple proposed plans do not hide Workflow invocations", () => {
  const prompt = proposedPlanHandoff();
  const invalid = "<proposed_plan>\n$plan-work\n$review-work\n</proposed_plan>";
  const incomplete = prompt.replace("</proposed_plan>", "");
  const multiple = `${prompt}\n${prompt}`;

  for (const candidate of [invalid, incomplete, multiple]) {
    assert.deepEqual(
      classifyCodexWorkflowPrompt(candidate),
      { kind: "ambiguous-workflow-skill", phase: null },
    );
  }
});

test("native Codex Implement Plan button handoff is ordinary and creates no turn", () => {
  for (const prompt of [
    nativeButtonHandoff(),
    nativeButtonHandoff().replace("PLAN:\n", "PLAN:\r\n"),
  ]) {
    assert.deepEqual(classifyCodexWorkflowPrompt(prompt), { kind: "ordinary", phase: null });
    const value = step({}, { hook_event_name: "UserPromptSubmit", prompt });
    assert.deepEqual(value.output, {});
    assert.equal(value.state.turn, null);
  }
});

test("invalid native button envelopes do not hide Workflow invocations", () => {
  const rootPlan = implementPlanRoot();
  const candidates = [
    `Please implement this plan:\n${rootPlan}`,
    `PLEASE IMPLEMENT THIS PLAN:\n${rootPlan.replace("status: ready", "status: blocked")}`,
    `PLEASE IMPLEMENT THIS PLAN:\n${rootPlan}\n$review-work`,
  ];
  for (const prompt of candidates) {
    assert.deepEqual(
      classifyCodexWorkflowPrompt(prompt),
      { kind: "ambiguous-workflow-skill", phase: null },
    );
  }
  assert.deepEqual(
    classifyCodexWorkflowPrompt("PLEASE IMPLEMENT THIS PLAN:\n$review-work"),
    { kind: "workflow-skill", phase: "review" },
  );
});
