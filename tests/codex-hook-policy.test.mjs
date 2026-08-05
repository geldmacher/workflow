import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCodexHook, isReadOnlyShell } from "../src/core/codex-hook-policy.mjs";

function step(state, input) {
  return evaluateCodexHook({ session_id: "session", turn_id: "turn", model: "gpt-parent", ...input }, state);
}

test("Codex plan-work requires Plan mode and complete preflight closeout", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$plan-work add retries" });
  assert.equal(value.output.decision, "block");

  value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  let state = value.state;
  value = step(state, { hook_event_name: "Stop", last_assistant_message: "<proposed_plan>wp-retry</proposed_plan>" });
  assert.equal(value.output.decision, "block");

  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: "artifact: work-plan\nid: wp-retry" },
    tool_response: { structuredContent: { feasible: true } },
  });
  state = value.state;
  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_artifact_record",
    tool_input: { artifacts: [{ text: "artifact: work-plan\nid: wp-retry" }] },
    tool_response: { structuredContent: { recorded: ["wp-retry"] } },
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "<proposed_plan>Plan wp-retry</proposed_plan>" });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.active_root_plan_id, "wp-retry");
});

test("Codex Workflow blocks model overrides and invalidates observed mismatches", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$review-work wp-retry" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { model: "foreign", prompt: "review" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");

  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { prompt: "review" } });
  value = evaluateCodexHook({ session_id: "session", turn_id: "turn", hook_event_name: "SubagentStart", model: "foreign", agent_id: "agent-1", agent_type: "reviewer" }, value.state);
  assert.match(value.output.systemMessage, /attestation failed/);
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = evaluateCodexHook({ hook_event_name: "SubagentStop", session_id: "session", agent_id: "agent-1" }, value.state);
  assert.equal(value.output.continue, false);
});

test("Codex review allows inspections and artifact recording but blocks mutation", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$review-work wp-retry" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rtk git diff --stat && rtk rg retry src" } });
  assert.deepEqual(value.output, {});
  assert.equal(isReadOnlyShell("git status | head -20"), true);

  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: "*** Begin Patch" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git add src/file.mjs" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "mcp__geldmacher_workflow__workflow_artifact_record", tool_input: {} });
  assert.deepEqual(value.output, {});
});

test("Codex implementation cannot stop without a closeout artifact", () => {
  let value = evaluateCodexHook({ hook_event_name: "UserPromptSubmit", session_id: "session", turn_id: "turn", model: "gpt-parent", permission_mode: "default", prompt: "Implement the plan" }, { active_root_plan_id: "wp-retry" });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "Implementation complete" });
  assert.equal(value.output.decision, "block");
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_closeout",
    tool_response: { structuredContent: { delivery_evidence_id: "de-retry" } },
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "Closeout: de-retry" });
  assert.deepEqual(value.output, {});
});
