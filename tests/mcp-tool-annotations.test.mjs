import assert from "node:assert/strict";
import test from "node:test";
import {
  MANUAL_WORKFLOW_TOOL_NAMES,
  WORKFLOW_TOOL_ANNOTATIONS,
  toolAnnotations,
} from "../src/mcp/tool-annotations.mjs";
import { manualToolContract } from "../src/mcp/manual-tool-contracts.mjs";
import { toolContract } from "../src/mcp/tool-contracts.mjs";
import { WORKFLOW_TOOL_NAMES } from "../src/mcp/tool-registry.mjs";

const keys = ["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"];

test("canonical annotations cover exactly the six Workflow-6 tools", () => {
  assert.deepEqual([...WORKFLOW_TOOL_NAMES].sort(), [
    "workflow_artifact_context",
    "workflow_artifact_record",
    "workflow_closeout",
    "workflow_plan_preflight",
    "workflow_prepare",
    "workflow_status",
  ]);
  assert.deepEqual(Object.keys(WORKFLOW_TOOL_ANNOTATIONS).sort(), [...WORKFLOW_TOOL_NAMES].sort());
  for (const name of WORKFLOW_TOOL_NAMES) {
    const value = toolAnnotations(name);
    assert.deepEqual(Object.keys(value).sort(), keys);
    for (const key of keys) assert.equal(typeof value[key], "boolean");
    assert.deepEqual(toolContract(name).annotations, value);
  }
});

test("Manual surface stays five tools and shares the canonical contracts", () => {
  assert.deepEqual([...MANUAL_WORKFLOW_TOOL_NAMES].sort(), [
    "workflow_artifact_context",
    "workflow_artifact_record",
    "workflow_closeout",
    "workflow_plan_preflight",
    "workflow_status",
  ]);
  for (const name of MANUAL_WORKFLOW_TOOL_NAMES) {
    assert.deepEqual(manualToolContract(name).annotations, toolAnnotations(name));
  }
});

test("generic harness orchestration is conservatively open and potentially destructive", () => {
  const prepare = toolAnnotations("workflow_prepare");
  assert.equal(prepare.readOnlyHint, false);
  assert.equal(prepare.destructiveHint, true);
  assert.equal(prepare.idempotentHint, false);
  assert.equal(prepare.openWorldHint, true);
  assert.equal(toolAnnotations("workflow_closeout").readOnlyHint, false);
});

test("generic harness actions are exactly Implement, Review, and Correct with localized presentation", () => {
  const prepare = toolContract("workflow_prepare").inputSchema;
  for (const action of ["implement", "review", "correct"]) assert.equal(prepare.action.safeParse(action).success, true, action);
  for (const removed of ["start", "stop", "accept-delivery", "retry-review"]) assert.equal(prepare.action.safeParse(removed).success, false, removed);
  assert.equal(prepare.presentation_locale.safeParse("de").success, true);
  assert.equal(prepare.presentation_locale.safeParse("en").success, true);
  assert.equal(prepare.presentation_locale.safeParse("fr").success, false);
  assert.equal(toolContract("workflow_status").inputSchema.presentation_locale.safeParse("de").success, true);
});
