import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const hook = join(defaultRoot, "dist/codex/workflow-hook.mjs");
const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");

function run(input, stateRoot) {
  const result = spawnSync(process.execPath, [hook], {
    cwd: defaultRoot,
    input: JSON.stringify({ session_id: "s", turn_id: "t", cwd: defaultRoot, ...input }),
    encoding: "utf8",
    env: { ...process.env, PLUGIN_DATA: stateRoot },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout || "{}");
}

test("built Codex hook accepts Schema-6 native Plan", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-codex-hook-"));
  try {
    run({ hook_event_name: "UserPromptSubmit", collaboration_mode: { mode: "plan" }, prompt: "$plan-work migrate" }, state);
    assert.deepEqual(run({ hook_event_name: "Stop", last_assistant_message: "<proposed_plan>\n" + root + "\n</proposed_plan>" }, state), {});
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test("built Codex Review never classifies or blocks concrete tools", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-codex-review-"));
  try {
    const started = run({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, state);
    assert.match(started.hookSpecificOutput.additionalContext, /project harness/i);
    for (const tool of ["apply_patch", "Shell", "Agent", "mcp__other__tool"]) {
      assert.deepEqual(run({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: {} }, state), {});
    }
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test("built hook remains fail-open when state storage is unavailable", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-codex-unavailable-"));
  try {
    const active = run({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, join(state, "missing", "state"));
    assert.equal(active.decision, undefined);
  } finally { rmSync(state, { recursive: true, force: true }); }
});
