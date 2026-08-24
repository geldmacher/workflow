import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { evaluateCloseoutGuard } from "../hooks/closeout-guard.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";

const fixture = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");
const expandedConstraints = Array.from({ length: 140 }, (_, index) => `  - Preserve deterministic native Review constraint ${index + 1}.`).join("\n");
const exactRoot = fixture.replace(/constraints:\n  - Preserve the public API\./, `constraints:\n${expandedConstraints}`);
const truncatedRoot = exactRoot.slice(0, 3680);
const rootHash = createHash("sha256").update(exactRoot, "utf8").digest("hex");

const reviewInput = {
  schema: 1,
  kind: "review-input",
  assessment: "achieved",
  recommended_action: "none",
  assessment_summary: "The synthetic regression delivery satisfies its exact Root.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The repository was observed by the host-owned builder.",
  findings: [],
  missing_evidence: [],
  auditor_reports: [],
};

test("diagnosed Cursor chat shape binds exact CreatePlan bytes instead of the 3680-byte model copy", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-cursor-regression-home-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-cursor-regression-transcript-"));
  const conversationId = "d843b0be-9e83-4529-a55f-dbe2991f8c5d";
  const transcriptPath = join(transcriptRoot, `${conversationId}.jsonl`);
  const transcript = [
    {
      role: "assistant",
      message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Adaptive retry", plan: exactRoot } }] },
    },
    {
      role: "user",
      message: { content: [{ type: "text", text: "Adaptive retry\n\nImplement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself." }] },
    },
  ];
  writeFileSync(transcriptPath, `${transcript.map((entry) => JSON.stringify(entry)).join("\n")}\n`);

  const hookBase = {
    conversation_id: conversationId,
    session_id: conversationId,
    transcript_path: transcriptPath,
    workspace_roots: [defaultRoot],
  };
  const toolInput = {
    workspace_root: defaultRoot,
    root_plan_id: "wp-adaptive-retry",
    root_plan: truncatedRoot,
    artifact_kind: "work-review",
    check_evidence: [{ check_id: "CHECK-1", grade: "verified", observed: "Retry verification passes twice.", repetitions: 2 }],
    review_input: reviewInput,
  };
  const options = { home, pluginRoot: defaultRoot };
  assert.deepEqual(evaluateCloseoutGuard({
    ...hookBase,
    cwd: defaultRoot,
    hook_event_name: "postToolUse",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    tool_name: "CreatePlan",
    tool_input: { name: "Adaptive retry", plan: exactRoot },
  }, options), {});
  assert.deepEqual(evaluateCloseoutGuard({
    ...hookBase,
    cwd: defaultRoot,
    hook_event_name: "beforeSubmitPrompt",
    generation_id: "review-generation",
    prompt: "/review-work",
  }, options), {});
  const prepared = evaluateCloseoutGuard({
    ...hookBase,
    cwd: defaultRoot,
    hook_event_name: "preToolUse",
    generation_id: "review-generation",
    tool_use_id: "review-closeout-call",
    tool_name: "MCP:workflow_closeout",
    tool_input: toolInput,
  }, options);
  assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: {
      ...process.env,
      HOME: home,
      GELDMACHER_WORKFLOW_HOME: join(home, ".geldmacher", "workflow"),
      CURSOR_PLUGIN_ROOT: defaultRoot,
    },
    stderr: "pipe",
  });
  const client = workflowClient("cursor-native-review-regression", [defaultRoot]);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: "workflow_closeout", arguments: prepared.updated_input });
    assert.equal(result.isError, false, JSON.stringify(result.structuredContent));
    assert.equal(result.structuredContent.native_task_binding, "cursor-receipt");
    assert.equal(result.structuredContent.root_content_hash, rootHash);
    assert.notEqual(result.structuredContent.root_content_hash, createHash("sha256").update(truncatedRoot).digest("hex"));
    assert.notEqual(result.structuredContent.error_code, "native-plan-unavailable");
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});
