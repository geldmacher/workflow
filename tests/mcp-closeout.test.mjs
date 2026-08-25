import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  observeNativeCreatePlan,
  prepareNativeReviewReceipt,
  selectNativeReviewRoot,
} from "../hooks/native-task-review-context.mjs";
import { createArtifactHandlers } from "../src/mcp/artifact-handlers.mjs";
import { WorkspaceRootError } from "../src/mcp/workspace-roots.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

function planEvent() {
  return {
    tool_name: "CreatePlan",
    conversation_id: "mcp-review-v6",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
  };
}

function selectionEvent() {
  return {
    conversation_id: "mcp-review-v6",
    generation_id: "review-generation",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    prompt: "/review-work",
  };
}

function reviewEvent() {
  return {
    tool_name: "MCP:workflow_closeout",
    conversation_id: "mcp-review-v6",
    generation_id: "review-generation",
    tool_use_id: "review-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: {
      artifact_kind: "work-review",
      check_evidence: [],
      review_input: {
        schema: 1,
        kind: "review-input",
        assessment: "provisional",
        recommended_action: "accept-provisional",
        assessment_summary: "The exact Root is intact; harness evidence is unavailable.",
        snapshot_assessment: "consistent",
        snapshot_summary: "The repository can still be inspected.",
        findings: [],
        missing_evidence: ["CHECK-1"],
      },
    },
  };
}

function establishReceipt(stateRoot) {
  assert.equal(observeNativeCreatePlan({
    stateRoots: [stateRoot],
    input: planEvent(),
    pluginRoot: defaultRoot,
    options: { workspaceRoot: defaultRoot },
  }).status, "observed");
  assert.equal(selectNativeReviewRoot({
    stateRoots: [stateRoot],
    input: selectionEvent(),
    pluginRoot: defaultRoot,
    options: { workspaceRoot: defaultRoot },
  }).status, "selected");
  const prepared = prepareNativeReviewReceipt({
    stateRoots: [stateRoot],
    input: reviewEvent(),
    pluginRoot: defaultRoot,
    options: { workspaceRoot: defaultRoot },
  });
  assert.equal(prepared.status, "prepared");
  return prepared;
}

test("MCP roots transport failure preserves the receipt-bound Root and canonical workspace", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  try {
    const prepared = establishReceipt(stateRoot);
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => {
        throw new WorkspaceRootError("roots-request-failed", "simulated MCP roots/list transport failure");
      },
      resolveCursorReceiptContext: () => ({
        workspace: defaultRoot,
        stateRoot,
      }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const response = await handlers.closeout(prepared.updated_input);
    assert.equal(response.isError, false, response.value?.error);
    assert.equal(response.value.root_plan_id, "wp-adaptive-retry");
    assert.equal(response.value.workspace_root, defaultRoot);
    assert.equal(response.value.workspace_binding, "cursor-native-receipt");
    assert.equal(response.value.delivery_status, "provisional");
    assert.equal(response.value.task_local_valid, true);
    assert.doesNotMatch(JSON.stringify(response.value), /Root is unavailable|native-plan-unavailable/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review reports missing selection separately from missing Root before MCP handling", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  try {
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: planEvent(),
      pluginRoot: defaultRoot,
      options: { workspaceRoot: defaultRoot },
    }).status, "observed");
    const prepared = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent(),
      pluginRoot: defaultRoot,
      options: { workspaceRoot: defaultRoot },
    });
    assert.equal(prepared.status, "unavailable");
    assert.equal(prepared.reason, "review-selection-unavailable");
    assert.equal(prepared.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("each unreceipted Manual Review receives a fresh opaque Harness transition binding", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  const transitionBindings = [];
  try {
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "portable",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      reviewHarnessPhase: async (request) => {
        transitionBindings.push(request.reviewTransitionBindingHash);
        return { mode: "shadow", status: "unavailable", blockers: ["test-shadow"], result: null };
      },
      result: (value, isError = false) => ({ value, isError }),
    });
    const input = {
      ...reviewEvent().tool_input,
      root_plan_id: "wp-adaptive-retry",
      root_plan: rootPlan,
    };
    const first = await handlers.closeout(input);
    const second = await handlers.closeout(input);
    assert.equal(first.isError, false, first.value?.error);
    assert.equal(second.isError, false, second.value?.error);
    assert.equal(transitionBindings.length, 2);
    assert.match(transitionBindings[0], /^[a-f0-9]{64}$/);
    assert.match(transitionBindings[1], /^[a-f0-9]{64}$/);
    assert.notEqual(transitionBindings[0], transitionBindings[1]);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});
