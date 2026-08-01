import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateSubagentStart,
  MODEL_INHERIT_MARKER,
  READONLY_REVIEW_MARKER,
} from "../hooks/subagent-guard.mjs";
import { defaultRoot } from "../scripts/validate-plugin.mjs";

const base = Object.freeze({
  hook_event_name: "subagentStart",
  subagent_type: "general-purpose",
  task: "Inspect the repository",
  model: "cursor-selected-primary",
});

test("Workflow planning, implementation, and correction allow inherited-model subagents", () => {
  for (const input of [
    { ...base, task: `${MODEL_INHERIT_MARKER} implement STEP-1`, subagent_type: "shell" },
    { ...base, task: "[workflow-primary-writer-v1] continue an existing plan", subagent_type: "general-purpose" },
    { ...base, task: "/plan-work", subagent_type: "general-purpose" },
    { ...base, task: "/plan-work", model: "unknown", model_id: "cursor-primary-id" },
    { ...base, task: "/correct-work" },
    { ...base, task: "Run tests", subagent_type: "work-explainer" },
  ]) {
    const readTranscript = input.task === "Run tests" ? () => `todo ${MODEL_INHERIT_MARKER}` : () => "";
    assert.deepEqual(evaluateSubagentStart(input, { readTranscript }), {});
  }
});

test("Workflow rejects explicit child models and unverified parent models", () => {
  for (const input of [
    { ...base, task: `${MODEL_INHERIT_MARKER} implement`, subagent_model: "cursor-selected-primary" },
    { ...base, task: "/correct-work", model: "different-child", subagent_model: "different-child" },
    { ...base, task: "/plan-work", model: undefined },
    { ...base, task: "/plan-work", model: "unknown" },
  ]) {
    const result = evaluateSubagentStart(input, { readTranscript: () => "" });
    assert.equal(result.permission, "deny");
    assert.match(result.user_message, /inherit|parent model/i);
  }
});

test("unmarked non-Workflow tasks remain untouched", () => {
  assert.deepEqual(evaluateSubagentStart(base, { readTranscript: () => "ordinary task" }), {});
  assert.deepEqual(evaluateSubagentStart({ ...base, subagent_model: "another-model" }, { readTranscript: () => "ordinary task" }), {});
});

test("review delegation requires inheritance and a named read-only role", () => {
  for (const model of ["cursor-model-a", "cursor-model-b"]) {
    assert.deepEqual(evaluateSubagentStart({
      ...base,
      model,
      subagent_type: "delivery-auditor",
      task: `${READONLY_REVIEW_MARKER} audit delivery`,
    }, { readTranscript: () => "/review-work" }), {});
  }

  for (const input of [
    { ...base, subagent_type: "general-purpose", task: `${READONLY_REVIEW_MARKER} audit` },
    { ...base, subagent_type: "delivery-auditor", task: "unmarked audit" },
    { ...base, model: undefined, subagent_type: "delivery-auditor", task: `${READONLY_REVIEW_MARKER} audit` },
    { ...base, subagent_model: "other-model", subagent_type: "delivery-auditor", task: `${READONLY_REVIEW_MARKER} audit` },
  ]) {
    const result = evaluateSubagentStart(input, { readTranscript: () => "/review-work" });
    assert.equal(result.permission, "deny");
  }
});

test("malformed hook input fails closed without echoing prompt content", () => {
  assert.equal(evaluateSubagentStart(null).permission, "deny");
  assert.equal(evaluateSubagentStart({ hook_event_name: "subagentStart" }).permission, "deny");

  const hookPath = join(defaultRoot, "hooks", "subagent-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], { input: "not-json secret-prompt", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.permission, "deny");
  assert.doesNotMatch(result.stdout, /secret-prompt/);
});
