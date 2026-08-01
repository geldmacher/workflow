import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  evaluateHookEvent,
  evaluateSubagentStart,
  MODEL_INHERIT_MARKER,
  READONLY_REVIEW_MARKER,
} from "../hooks/subagent-guard.mjs";
import {
  MODEL_INCIDENT_CAUSES,
  modelInheritanceSummary,
} from "../hooks/model-inheritance-state.mjs";
import { defaultRoot } from "../scripts/validate-plugin.mjs";

const base = Object.freeze({
  conversation_id: "conversation-1",
  cursor_version: "3.14.7",
  transcript_path: null,
});

function harness() {
  const root = mkdtempSync(join(tmpdir(), "workflow-model-inheritance-"));
  let milliseconds = Date.parse("2026-08-01T10:00:00.000Z");
  const options = {
    stateRoot: join(root, "state"),
    readTranscript: () => "",
    now: () => new Date(milliseconds += 1_000),
  };
  return {
    root,
    options,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

function captureParent(options, model = "cursor-parent-high", modelId = "parent") {
  return evaluateHookEvent({
    ...base,
    hook_event_name: "sessionStart",
    model,
    model_id: modelId,
    model_params: [{ id: "effort", value: "high" }, { id: "fast", value: true }],
  }, options);
}

function taskRequest(toolUseId, modelField = Symbol.for("omitted"), overrides = {}) {
  const toolInput = {
    prompt: `${MODEL_INHERIT_MARKER} implement STEP-1`,
    subagent_type: "general-purpose",
  };
  if (modelField !== Symbol.for("omitted")) toolInput.model = modelField;
  return {
    ...base,
    hook_event_name: "preToolUse",
    tool_name: "Task",
    tool_use_id: toolUseId,
    tool_input: toolInput,
    model: "parent",
    ...overrides,
  };
}

function subagentStart(toolUseId, childModel = "cursor-parent-high", overrides = {}) {
  return {
    ...base,
    hook_event_name: "subagentStart",
    tool_call_id: toolUseId,
    task: `${MODEL_INHERIT_MARKER} implement STEP-1`,
    subagent_type: "general-purpose",
    subagent_model: childModel,
    ...overrides,
  };
}

function allFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? allFiles(child) : [child];
  });
}

test("declares the complete provider-neutral incident cause vocabulary", () => {
  assert.deepEqual(MODEL_INCIDENT_CAUSES, [
    "explicit-child-model",
    "actual-child-mismatch",
    "parent-model-unavailable",
    "child-model-unavailable",
    "uncorrelated-subagent-start",
    "deny-not-enforced",
  ]);
});

test("Task preflight allows only omitted model and inherit for arbitrary parents", () => {
  for (const [parent, modelField] of [
    ["cursor-model-a", Symbol.for("omitted")],
    ["vendor/model-b", "inherit"],
  ]) {
    const run = harness();
    try {
      captureParent(run.options, parent, parent.split("/").at(-1));
      assert.deepEqual(evaluateHookEvent(taskRequest(`task-${parent}`, modelField, { model: parent.split("/").at(-1) }), run.options), {});
    } finally { run.close(); }
  }
});

test("Task preflight rejects every concrete child model, including the parent slug", () => {
  for (const concrete of ["cursor-parent-high", "other-provider/child", "", 42]) {
    const run = harness();
    try {
      captureParent(run.options);
      const result = evaluateHookEvent(taskRequest(`task-${String(concrete)}`, concrete), run.options);
      assert.equal(result.permission, "deny");
      assert.match(result.user_message, /explicit-child-model/);
      assert.match(result.user_message, /incident: mi-/);
      const summary = modelInheritanceSummary(run.options.stateRoot);
      assert.equal(summary.status, "deviated");
      assert.equal(summary.last_incident.cause, "explicit-child-model");
    } finally { run.close(); }
  }
});

test("subagentStart accepts actual equality and denies actual mismatch", () => {
  const run = harness();
  try {
    captureParent(run.options, "vendor-parent-xhigh", "vendor-parent");
    assert.deepEqual(evaluateHookEvent(taskRequest("task-equal", "inherit", { model: "vendor-parent" }), run.options), {});
    assert.deepEqual(evaluateHookEvent(subagentStart("task-equal", "vendor-parent-xhigh"), run.options), {});

    assert.deepEqual(evaluateHookEvent(taskRequest("task-mismatch", Symbol.for("omitted"), { model: "vendor-parent" }), run.options), {});
    const mismatch = evaluateSubagentStart(subagentStart("task-mismatch", "foreign-child"), run.options);
    assert.equal(mismatch.permission, "deny");
    assert.match(mismatch.user_message, /actual-child-mismatch/);
    assert.match(mismatch.user_message, /vendor-parent-xhigh/);
    assert.match(mismatch.user_message, /foreign-child/);
  } finally { run.close(); }
});

test("missing parent, missing child, and uncorrelated starts are unattestable", () => {
  for (const [name, setup, event, cause] of [
    ["parent", () => {}, () => taskRequest("missing-parent"), "parent-model-unavailable"],
    ["child", (options) => { captureParent(options); evaluateHookEvent(taskRequest("missing-child"), options); }, () => subagentStart("missing-child", "cursor-parent-high", { subagent_model: undefined }), "child-model-unavailable"],
    ["correlation", captureParent, () => subagentStart("never-preflighted"), "uncorrelated-subagent-start"],
  ]) {
    const run = harness();
    try {
      setup(run.options);
      const result = evaluateHookEvent(event(), run.options);
      assert.equal(result.permission, "deny", name);
      assert.match(result.user_message, new RegExp(cause), name);
      assert.equal(modelInheritanceSummary(run.options.stateRoot).last_incident.status, "unattestable");
    } finally { run.close(); }
  }
});

test("beforeSubmitPrompt replaces the parent model between turns", () => {
  const run = harness();
  try {
    captureParent(run.options, "parent-a", "a");
    evaluateHookEvent({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      model: "parent-b",
      model_id: "b",
      model_params: [{ id: "effort", value: "medium" }],
      prompt: "sensitive text is ignored",
    }, run.options);
    assert.deepEqual(evaluateHookEvent(taskRequest("switched", "inherit", { model: "b" }), run.options), {});
    assert.deepEqual(evaluateHookEvent(subagentStart("switched", "parent-b"), run.options), {});
  } finally { run.close(); }
});

test("parallel and duplicate Task events remain separately correlated and idempotent", () => {
  const run = harness();
  try {
    captureParent(run.options);
    const first = taskRequest("parallel-a", "foreign-a");
    const second = taskRequest("parallel-b", "foreign-b");
    const firstResult = evaluateHookEvent(first, run.options);
    const duplicateResult = evaluateHookEvent(first, run.options);
    evaluateHookEvent(second, run.options);
    assert.equal(firstResult.user_message, duplicateResult.user_message);
    const summary = modelInheritanceSummary(run.options.stateRoot);
    assert.equal(summary.incident_count, 2);
  } finally { run.close(); }
});

test("a child executed and returned despite deny becomes deny-not-enforced", () => {
  const run = harness();
  try {
    captureParent(run.options);
    assert.equal(evaluateHookEvent(taskRequest("host-bypass", "foreign-child"), run.options).permission, "deny");
    assert.equal(evaluateHookEvent(subagentStart("host-bypass", "foreign-child"), run.options).permission, "deny");
    assert.deepEqual(evaluateHookEvent({
      ...base,
      hook_event_name: "subagentStop",
      tool_call_id: "host-bypass",
      subagent_type: "general-purpose",
    }, run.options), {});
    assert.deepEqual(evaluateHookEvent({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "Task",
      tool_use_id: "host-bypass",
      tool_output: "verified result remains usable",
    }, run.options), {});
    const summary = modelInheritanceSummary(run.options.stateRoot);
    assert.equal(summary.status, "deviated");
    assert.equal(summary.last_incident.cause, "deny-not-enforced");
    assert.equal(summary.last_incident.enforcement, "deny-not-enforced");
    assert.equal(summary.last_incident.child_executed, true);
    assert.equal(summary.last_incident.result_returned, true);
    assert.equal(summary.evidence_effect, "none");
    assert.equal(summary.result_policy, "verified-results-remain-usable");
  } finally { run.close(); }
});

test("unmarked non-Workflow Tasks remain untouched", () => {
  const run = harness();
  try {
    assert.deepEqual(evaluateHookEvent({
      ...taskRequest("ordinary", "foreign-model"),
      tool_input: { prompt: "ordinary unrelated task", model: "foreign-model" },
    }, run.options), {});
    assert.deepEqual(evaluateHookEvent({
      ...subagentStart("ordinary", "foreign-model"),
      task: "ordinary unrelated task",
    }, run.options), {});
    assert.equal(modelInheritanceSummary(run.options.stateRoot).incident_count, 0);
  } finally { run.close(); }
});

test("review delegation still requires a marked named read-only role", () => {
  const run = harness();
  try {
    captureParent(run.options);
    evaluateHookEvent(taskRequest("review-role", "inherit", {
      tool_input: {
        prompt: `${READONLY_REVIEW_MARKER} audit delivery`,
        subagent_type: "general-purpose",
        model: "inherit",
      },
    }), run.options);
    const result = evaluateHookEvent(subagentStart("review-role", "cursor-parent-high", {
      task: `${READONLY_REVIEW_MARKER} audit delivery`,
      subagent_type: "general-purpose",
    }), run.options);
    assert.equal(result.permission, "deny");
    assert.match(result.user_message, /named read-only plugin agent/);
  } finally { run.close(); }
});

test("persisted state contains no prompts, email addresses, or absolute workspace paths", () => {
  const run = harness();
  try {
    const secretPrompt = `${MODEL_INHERIT_MARKER} contact private.person@example.test in /Users/private/workspace`;
    captureParent(run.options);
    evaluateHookEvent(taskRequest("privacy", "foreign-child", {
      tool_input: { prompt: secretPrompt, subagent_type: "general-purpose", model: "foreign-child" },
      workspace_roots: ["/Users/private/workspace"],
    }), run.options);
    const persisted = allFiles(run.options.stateRoot).map((path) => readFileSync(path, "utf8")).join("\n");
    assert.doesNotMatch(persisted, /private\.person@example\.test/);
    assert.doesNotMatch(persisted, /\/Users\/private\/workspace/);
    assert.doesNotMatch(persisted, /contact private/);
  } finally { run.close(); }
});

test("malformed hook input fails closed without echoing prompt content", () => {
  assert.equal(evaluateHookEvent(null).permission, "deny");

  const hookPath = join(defaultRoot, "hooks", "subagent-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], { input: "not-json secret-prompt", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.permission, "deny");
  assert.doesNotMatch(result.stdout, /secret-prompt/);
});
