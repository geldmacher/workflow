import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateCodexHook, isReadOnlyShell } from "../src/core/codex-hook-policy.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const proposedPlan = `<proposed_plan>\n${rootPlan}\n</proposed_plan>`;

function step(state, input, options = {}) {
  return evaluateCodexHook({ session_id: "session", turn_id: "turn", model: "gpt-parent", ...input }, state, { pluginRoot: defaultRoot, ...options });
}

test("Codex discards legacy Manual state and initializes schema 2", () => {
  const legacy = {
    schema: 1,
    active_root_plan_id: "wp-legacy",
    active_root_plan_text: rootPlan,
    task_artifacts_by_root: { legacy: {} },
    turn: { phase: "implementation", closeout_recorded: false },
  };
  const value = step(legacy, { hook_event_name: "SessionStart" });
  assert.equal(value.state.schema, 2);
  assert.equal(value.state.kind, "manual-native-plan-review");
  assert.equal(value.state.active_root_plan_id, undefined);
  assert.equal(value.state.task_artifacts_by_root, undefined);
});

test("Codex Plan mode validates exact Root without final closeout attestation", () => {
  let value = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "plan" },
    permission_mode: "default",
    prompt: "$plan-work add retries",
  });
  assert.equal(value.state.turn.phase, "planning");
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: proposedPlan });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.turn, null);
  assert.equal(value.state.active_root_plan_id, undefined);
});

test("Codex blocks planning only on explicit non-Plan collaboration-mode evidence", () => {
  const unavailable = step({}, {
    hook_event_name: "UserPromptSubmit",
    permission_mode: "default",
    prompt: "[$geldmacher-workflow:plan-work](plugin://geldmacher-workflow/skills/plan-work/SKILL.md) add retries",
  });
  assert.equal(unavailable.output.decision, undefined);
  assert.equal(unavailable.state.turn.phase, "planning");
  assert.match(unavailable.output.hookSpecificOutput.additionalContext, /does not infer that mode from permission_mode/i);
  assert.match(unavailable.output.hookSpecificOutput.additionalContext, /stop without drafting a Root/i);

  const plan = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "plan" },
    permission_mode: "default",
    prompt: "$plan-work add retries",
  });
  assert.equal(plan.output.decision, undefined);
  assert.equal(plan.state.turn.phase, "planning");

  const defaultMode = step({}, {
    hook_event_name: "UserPromptSubmit",
    collaboration_mode: { mode: "default" },
    permission_mode: "plan",
    prompt: "$plan-work add retries",
  });
  assert.equal(defaultMode.output.decision, "block");
  assert.match(defaultMode.output.reason, /Plan mode/i);
});

test("Codex implementation needs no Workflow hook state and Stop emits no continuation", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" });
  assert.equal(value.state.turn, null);
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } });
  assert.deepEqual(value.output, {});
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "Implemented and checked." });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.turn, null);
});

test("Codex Review denies repository mutation but allows atomic review builder", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(value.output.hookSpecificOutput.permissionDecisionReason, /read-only/i);

  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_closeout",
    tool_input: { artifact_kind: "work-review" },
  });
  assert.deepEqual(value.output, {});
});

test("Codex parent model inheritance remains enforced", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work" });
  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    tool_input: { agent_type: "delivery-auditor", readonly: true, prompt: "[workflow-readonly-review-v1] inspect", model: "other" },
  });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");

  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    tool_input: { agent_type: "delivery-auditor", readonly: true, prompt: "[workflow-readonly-review-v1] inspect" },
  });
  assert.deepEqual(value.output, {});
  value = step(value.state, { hook_event_name: "SubagentStart", agent_id: "agent-1", model: "gpt-parent" });
  assert.deepEqual(value.output, {});
});

test("Codex activates only a marked Workflow agent outside an explicit command turn", () => {
  const ordinary = step({}, {
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    tool_input: { prompt: "ordinary delegation", model: "other" },
  });
  assert.deepEqual(ordinary.output, {});
  assert.equal(ordinary.state.turn, null);

  const marked = step({}, {
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    tool_input: { prompt: "[workflow-model-inherit-v1] bounded implementation", model: "other" },
  });
  assert.equal(marked.state.turn.phase, "implementation");
  assert.equal(marked.output.hookSpecificOutput.permissionDecision, "deny");
});

test("removed close-work token no longer arms a Manual phase", () => {
  const value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$close-work wp-old" });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.turn, null);
});

test("read-only shell classification is retained", () => {
  assert.equal(isReadOnlyShell("git status --short"), true);
  assert.equal(isReadOnlyShell("git add src/a.mjs"), false);
});

test("Codex classifies linked, ambiguous, continued, and ordinary prompts", () => {
  const linked = step({}, {
    hook_event_name: "UserPromptSubmit",
    permission_mode: "default",
    prompt: "[$geldmacher-workflow:plan-work](plugin://geldmacher-workflow/skills/plan-work/SKILL.md)",
  });
  assert.equal(linked.state.turn.phase, "planning");

  const ambiguous = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work and $correct-work" });
  assert.equal(ambiguous.output.decision, "block");

  const continuation = step({}, {
    hook_event_name: "UserPromptSubmit",
    prompt: '<hook_prompt hook_run_id="run-1">continue</hook_prompt>',
  });
  assert.equal(continuation.state.turn, null);
  assert.equal(step({}, { hook_event_name: "UserPromptSubmit", prompt: "Do not implement this plan?" }).state.turn, null);
  assert.equal(step({}, { hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" }).state.turn, null);
  assert.equal(step({}, { hook_event_name: "UserPromptSubmit", prompt: "$work-status" }).state.turn.phase, "work-status");
});

test("Codex Plan validation blocks missing and invalid native Roots without continuation", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work" });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "No native plan." });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /one <proposed_plan>/);

  let active = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work" });
  active = step(active.state, { hook_event_name: "Stop", stop_hook_active: true, last_assistant_message: "No native plan." });
  assert.equal(active.output.continue, false);
  assert.match(active.output.systemMessage, /Plan validation failed/);

  let invalid = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work" });
  invalid = step(invalid.state, {
    hook_event_name: "Stop",
    last_assistant_message: proposedPlan.replace(/id: wp-[^\n]+/, "id: invalid"),
  });
  assert.equal(invalid.output.decision, "block");
  assert.match(invalid.output.reason, /valid Schema-5 Root/);
});

test("Codex Review classifies shell, MCP, and auditor tools read-only", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work" });
  const state = value.state;
  assert.deepEqual(step(state, { hook_event_name: "PreToolUse", tool_name: "Shell", tool_input: { command: "git status --short" } }).output, {});
  assert.equal(step(state, { hook_event_name: "PreToolUse", tool_name: "Shell", tool_input: { command: "git add src/a.mjs" } }).output.hookSpecificOutput.permissionDecision, "deny");
  assert.deepEqual(step(state, { hook_event_name: "PreToolUse", tool_name: "mcp__repo__get_status", tool_input: {} }).output, {});
  assert.equal(step(state, { hook_event_name: "PreToolUse", tool_name: "mcp__repo__send_update", tool_input: {} }).output.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(step(state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_input: { prompt: "unmarked" } }).output.hookSpecificOutput.permissionDecision, "deny");
});

test("Codex approved routing records auditor success and advances unavailable models", () => {
  const policy = {
    mode: "parent-or-approved",
    source: "test",
    hosts: {
      codex: {
        candidates: [
          { model_id: "gpt-candidate-1", reasoning_effort: "low" },
          { model_id: "gpt-candidate-2" },
        ],
        parent_fallback: false,
      },
    },
  };
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, { manualSubagentPolicy: policy });
  const auditorInput = {
    agent_type: "delivery-auditor",
    readonly: true,
    prompt: "[workflow-readonly-review-v1] inspect",
    model_id: "stale",
    provider: "stale",
    reasoningEffort: "stale",
  };
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_use_id: "tool-1", tool_input: auditorInput }, { manualSubagentPolicy: policy });
  assert.equal(value.output.hookSpecificOutput.updatedInput.model, "gpt-candidate-1");
  assert.equal(value.output.hookSpecificOutput.updatedInput.reasoning_effort, "low");
  assert.equal(value.output.hookSpecificOutput.updatedInput.fork_turns, "none");
  value = step(value.state, { hook_event_name: "SubagentStart", agent_id: "agent-1", model: "gpt-candidate-1" }, { manualSubagentPolicy: policy });
  assert.deepEqual(value.output, {});
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "spawn_agent",
    tool_input: auditorInput,
    tool_response: { result: "ok" },
  }, { manualSubagentPolicy: policy });
  assert.deepEqual(value.state.turn.observed_review_auditors, ["delivery-auditor"]);

  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_use_id: "tool-2", tool_input: auditorInput }, { manualSubagentPolicy: policy });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "spawn_agent",
    tool_input: { ...auditorInput, model: "gpt-candidate-1" },
    tool_response: { isError: true, error: "model unavailable" },
  }, { manualSubagentPolicy: policy });
  assert.deepEqual(value.state.turn.routing.unavailable, ["gpt-candidate-1"]);
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_use_id: "tool-3", tool_input: auditorInput }, { manualSubagentPolicy: policy });
  assert.equal(value.output.hookSpecificOutput.updatedInput.model, "gpt-candidate-2");
  assert.equal("reasoning_effort" in value.output.hookSpecificOutput.updatedInput, false);
});

test("Codex rejects unattested subagent results and exhausted routing", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$correct-work" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_input: { prompt: "inspect" } });
  value = step(value.state, { hook_event_name: "SubagentStart", agent_id: "bad-agent", model: "foreign-model" });
  assert.match(value.output.systemMessage, /attestation failed/);
  assert.equal(step(value.state, { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: {} }).output.hookSpecificOutput.permissionDecision, "deny");
  const stopped = step(value.state, { hook_event_name: "SubagentStop", agent_id: "bad-agent" });
  assert.equal(stopped.output.continue, false);

  const policy = {
    mode: "parent-or-approved",
    source: "test",
    hosts: { codex: { candidates: [{ model_id: "only-candidate" }], parent_fallback: false } },
  };
  value = step({}, { hook_event_name: "UserPromptSubmit", prompt: "$correct-work" }, { manualSubagentPolicy: policy });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_input: { prompt: "inspect" } }, { manualSubagentPolicy: policy });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "spawn_agent",
    tool_input: { prompt: "inspect", model: "only-candidate" },
    tool_response: { error: "model unavailable" },
  }, { manualSubagentPolicy: policy });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_input: { prompt: "inspect" } }, { manualSubagentPolicy: policy });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(value.output.hookSpecificOutput.permissionDecisionReason, /pool is exhausted/);
});
