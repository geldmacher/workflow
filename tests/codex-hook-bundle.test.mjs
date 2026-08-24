import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const hookPath = join(defaultRoot, "dist", "codex", "workflow-hook.mjs");
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

function runHook(input, stateRoot) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: defaultRoot,
    input: JSON.stringify({ session_id: "bundle-session", turn_id: "bundle-turn", model: "gpt-parent", cwd: defaultRoot, ...input }),
    encoding: "utf8",
    env: { ...process.env, PLUGIN_DATA: stateRoot },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout || "{}");
}

function stateFiles(root) {
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
  return walk(root).filter((path) => path.endsWith(".json"));
}

test("built Codex hook validates native Plan without closeout ceremony", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-plan-"));
  try {
    const started = runHook({
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "[$geldmacher-workflow:plan-work](plugin://geldmacher-workflow/skills/plan-work/SKILL.md) bundle",
    }, stateRoot);
    assert.match(started.hookSpecificOutput.additionalContext, /Native task plans are the only Manual plan authority/);
    assert.match(started.hookSpecificOutput.additionalContext, /does not infer that mode from permission_mode/i);
    assert.deepEqual(runHook({ hook_event_name: "Stop", last_assistant_message: `<proposed_plan>\n${rootPlan}\n</proposed_plan>` }, stateRoot), {});
    const stored = JSON.parse(readFileSync(stateFiles(stateRoot)[0], "utf8"));
    assert.equal(stored.schema, 2);
    assert.equal(stored.kind, "manual-native-plan-review");
    assert.equal(stored.turn, null);
    assert.equal(stored.active_root_plan_id, undefined);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook stays inactive throughout ordinary implementation", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-implementation-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" }, stateRoot);
    assert.deepEqual(runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, stateRoot), {});
    const stopped = runHook({ hook_event_name: "Stop", last_assistant_message: "Implemented and checked." }, stateRoot);
    assert.deepEqual(stopped, {});
    assert.equal("decision" in stopped, false);
    assert.equal("continue" in stopped, false);
    assert.deepEqual(stateFiles(stateRoot), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook cannot turn unavailable inactive state into a host blockade", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-bundle-passive-"));
  const unavailable = join(root, "plugin-data-is-a-file");
  writeFileSync(unavailable, "not a directory");
  try {
    assert.deepEqual(runHook({ hook_event_name: "SessionStart" }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement this plan" }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, unavailable), {});
    assert.deepEqual(runHook({ hook_event_name: "Stop", last_assistant_message: "Done." }, unavailable), {});

    const active = runHook({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, unavailable);
    assert.equal(active.decision, undefined);
    assert.match(active.hookSpecificOutput.additionalContext, /Host-native tools remain available/);
    assert.match(active.hookSpecificOutput.additionalContext, /do not claim verified Workflow evidence/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("built Codex hook cannot turn corrupt active state or malformed input into a host blockade", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-corrupt-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, stateRoot);
    writeFileSync(stateFiles(stateRoot)[0], "{not-json");

    const preToolUse = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { patch: "x" },
    }, stateRoot);
    assert.deepEqual(preToolUse, {});
    assert.equal(preToolUse.decision, undefined);
    assert.equal(preToolUse.hookSpecificOutput, undefined);

    const malformed = spawnSync(process.execPath, [hookPath], {
      cwd: defaultRoot,
      input: "{not-json",
      encoding: "utf8",
      env: { ...process.env, PLUGIN_DATA: stateRoot },
    });
    assert.equal(malformed.status, 0, malformed.stderr || malformed.stdout);
    assert.deepEqual(JSON.parse(malformed.stdout), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook enforces read-only Review and admits atomic builder", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-review-"));
  try {
    runHook({ hook_event_name: "UserPromptSubmit", prompt: "$review-work" }, stateRoot);
    const denied = runHook({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { patch: "x" } }, stateRoot);
    assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
    const allowed = runHook({
      hook_event_name: "PreToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { artifact_kind: "work-review" },
    }, stateRoot);
    assert.deepEqual(allowed, {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook discards legacy state and removed close-work input", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-legacy-"));
  try {
    const ordinary = runHook({ hook_event_name: "UserPromptSubmit", prompt: "$close-work wp-old" }, stateRoot);
    assert.deepEqual(ordinary, {});
    assert.deepEqual(stateFiles(stateRoot), []);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook contains no native recovery prompt surface", () => {
  const bundle = readFileSync(hookPath, "utf8");
  assert.doesNotMatch(bundle, /\$close-work|\/close-work/);
  assert.doesNotMatch(bundle, /followup_message/);
  assert.doesNotMatch(bundle, /active_root_plan_id/);
});
