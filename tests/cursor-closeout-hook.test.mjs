import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateCloseoutGuard } from "../hooks/closeout-guard.mjs";

function input(overrides = {}) {
  return {
    conversation_id: "cursor-native-plan-review",
    generation_id: "generation-1",
    workspace_roots: ["/tmp/cursor-native-plan-review"],
    ...overrides,
  };
}

test("Cursor implementation and correction finish without lifecycle closeout", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-plan-review-"));
  try {
    const options = { stateRoot };
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "Implement this plan" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "afterAgentResponse", text: "Implemented." }), options), {});
    const stop = evaluateCloseoutGuard(input({ hook_event_name: "stop" }), options);
    assert.deepEqual(stop, {});
    assert.equal("followup_message" in stop, false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review remains repository-read-only while allowing marked auditors", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-review-readonly-"));
  try {
    const options = { stateRoot };
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options);
    const denied = evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /read-only/i);
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: { command: "git status --short" } }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      tool_name: "Task",
      tool_input: {
        readonly: true,
        subagent_type: "delivery-auditor",
        prompt: "[workflow-readonly-review-v1] Inspect delivery.",
      },
    }), options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor ignores legacy Manual lifecycle files", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-legacy-manual-"));
  try {
    const legacy = join(stateRoot, "manual-closeout", "legacy");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "turn.json"), JSON.stringify({ schema: 1, required: true, closeout_recorded: false }));
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "stop" }), { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write" }), { stateRoot }), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor phase tracking ignores unrelated and invalid input", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-phase-tracking-"));
  try {
    const options = { stateRoot };
    assert.deepEqual(evaluateCloseoutGuard(null, options), {});
    assert.deepEqual(evaluateCloseoutGuard([], options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "Explain the repository" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/correct-work" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review parses shell input and records completed auditors", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-review-observation-"));
  try {
    const options = { stateRoot };
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options);
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: JSON.stringify({ command: "git status --short" }) }), options), {});
    assert.equal(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: "not-json" }), options).permission, "deny");
    assert.equal(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Task", tool_input: "not-json" }), options).permission, "deny");
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "postToolUse",
      tool_name: "spawn_agent",
      tool_input: {
        readonly: true,
        agent_type: "risk-auditor",
        prompt: "[workflow-readonly-review-v1] Inspect risk.",
      },
    }), options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("registered Cursor lifecycle hook is passive outside explicit Workflow and enforces Review", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-passive-hook-home-"));
  const script = join(new URL("..", import.meta.url).pathname, "hooks", "subagent-guard.mjs");
  const run = (overrides) => {
    const result = spawnSync(process.execPath, [script], {
      input: JSON.stringify(input({
        model: "cursor-parent",
        transcript_path: null,
        workspace_roots: ["/tmp/cursor-native-plan-review", "/tmp/cursor-native-plan-review-secondary"],
        ...overrides,
      })),
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout || "{}");
  };
  try {
    assert.deepEqual(run({ hook_event_name: "beforeSubmitPrompt", prompt: "Implement this plan" }), {});
    assert.deepEqual(run({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), {});
    assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);

    assert.deepEqual(run({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), {});
    const denied = run({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } });
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /read-only/i);

    const invalid = spawnSync(process.execPath, [script], { input: "not-json", encoding: "utf8", env: { ...process.env, HOME: home } });
    assert.equal(invalid.status, 0);
    assert.deepEqual(JSON.parse(invalid.stdout), {});
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
