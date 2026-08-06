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

const annotationKeys = Object.freeze(["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]);

const expected = Object.freeze({
  workflow_plan_preflight: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_artifact_context: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_status: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_watch: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_validate_models: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  workflow_artifact_record: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_closeout: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  workflow_prepare: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  workflow_start: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  workflow_answer: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  workflow_control: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  workflow_verification_profile: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
});

test("canonical annotations cover every Workflow tool with a complete tuple", () => {
  assert.deepEqual(Object.keys(WORKFLOW_TOOL_ANNOTATIONS).sort(), [...WORKFLOW_TOOL_NAMES].sort());
  assert.deepEqual(Object.keys(expected).sort(), [...WORKFLOW_TOOL_NAMES].sort());
  for (const name of WORKFLOW_TOOL_NAMES) {
    const value = toolAnnotations(name);
    assert.deepEqual(Object.keys(value).sort(), [...annotationKeys].sort());
    for (const key of annotationKeys) assert.equal(typeof value[key], "boolean");
    assert.deepEqual(value, expected[name]);
  }
});

test("Cursor and Manual contracts expose the same annotations without renaming tools", () => {
  for (const name of WORKFLOW_TOOL_NAMES) {
    const contract = toolContract(name);
    assert.equal(typeof contract.description, "string");
    assert.ok(contract.inputSchema);
    assert.deepEqual(contract.annotations, expected[name]);
  }
  assert.deepEqual([...MANUAL_WORKFLOW_TOOL_NAMES].sort(), [
    "workflow_artifact_context",
    "workflow_artifact_record",
    "workflow_closeout",
    "workflow_plan_preflight",
    "workflow_status",
  ]);
  for (const name of MANUAL_WORKFLOW_TOOL_NAMES) {
    assert.deepEqual(manualToolContract(name).annotations, expected[name]);
  }
});

test("mixed-action and mutating tools stay conservatively non-read-only", () => {
  for (const name of ["workflow_prepare", "workflow_start", "workflow_answer", "workflow_control", "workflow_verification_profile", "workflow_closeout", "workflow_artifact_record"]) {
    assert.equal(expected[name].readOnlyHint, false);
  }
  assert.equal(expected.workflow_control.destructiveHint, true);
  assert.equal(expected.workflow_validate_models.openWorldHint, true);
});
