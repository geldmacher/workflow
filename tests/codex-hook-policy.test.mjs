import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCodexHook } from "../src/core/codex-hook-policy.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const proposed = "<proposed_plan>\n" + root + "\n</proposed_plan>";

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
