import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { evaluateCloseoutGuard } from "../hooks/closeout-guard.mjs";
import { consumeNativeReviewReceipt } from "../hooks/native-review-receipt.mjs";
import { workflowStateRoot } from "../hooks/model-inheritance-state.mjs";
import {
  defaultRoot,
  effectiveCliSummary,
  inspectArtifactSet,
} from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";
import {
  loadSanitizedCursorReplay,
  SANITIZED_CURSOR_REPLAY_PATH,
  sanitizedReplayPrivacyFindings,
} from "./support/sanitized-cursor-replay.mjs";

function initializeFixtureRepository(parent) {
  const workspace = join(parent, "repository-sanitized");
  mkdirSync(join(workspace, "src"), { recursive: true });
  writeFileSync(join(workspace, "src", "fixture.txt"), "sanitized baseline\n");
  execFileSync("git", ["init", "--quiet", workspace]);
  execFileSync("git", ["-C", workspace, "add", "src/fixture.txt"]);
  execFileSync("git", [
    "-C", workspace,
    "-c", "commit.gpgSign=false",
    "-c", "user.name=Sanitized Fixture",
    "-c", "user.email=sanitized-fixture.invalid@example.invalid",
    "commit", "--quiet", "-m", "sanitized baseline",
  ]);
  return realpathSync(workspace);
}

function expandedSanitizedRoot() {
  const root = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
    .replace("profile_max: supervised", "profile_max: manual")
    .replace("contract_level: controlled", "contract_level: lean")
    .replaceAll("wp-adaptive-retry", "wp-sanitized-replay");
  const constraints = Array.from(
    { length: 140 },
    (_, index) => `  - Preserve sanitized deterministic replay constraint ${index + 1}.`,
  ).join("\n");
  return root.replace(/constraints:\n  - Preserve the public API\./, `constraints:\n${constraints}`);
}

test("sanitized Cursor replay fixture retains diagnosed structure without raw identity or secrets", () => {
  const source = readFileSync(SANITIZED_CURSOR_REPLAY_PATH, "utf8");
  const fixture = JSON.parse(source);
  assert.equal(fixture.fixture_schema, 1);
  assert.equal(fixture.provenance.kind, "sanitized-real-structure");
  assert.equal(fixture.provenance.raw_payload_committed, false);
  assert.deepEqual(sanitizedReplayPrivacyFindings(source), []);
  assert.equal(source.includes("{{ROOT_PLAN}}"), true);
  assert.equal(source.includes("{{WORKSPACE_ROOT}}"), true);
});

test("API-neutral loader materializes CreatePlan through planning stop with the exact truncation boundary", () => {
  const rootPlan = `${"A".repeat(3680)}${"B".repeat(420)}`;
  const toolOutput = { structuredContent: { artifact_kind: "work-review", replay: "sanitized" } };
  const replay = loadSanitizedCursorReplay({
    rootPlan,
    workspaceRoot: "/tmp/workflow-sanitized-workspace",
    transcriptPath: "/tmp/workflow-sanitized-transcript/conversation-sanitized.jsonl",
    nativeReviewReceipt: "receipt-sanitized",
    mcpToolOutput: toolOutput,
  });

  assert.deepEqual(replay.events.map((event) => [event.hook_event_name, event.tool_name ?? null]), [
    ["beforeSubmitPrompt", null],
    ["stop", null],
    ["beforeSubmitPrompt", null],
    ["preToolUse", "MCP:workflow_closeout"],
    ["postToolUse", "MCP:workflow_closeout"],
  ]);
  assert.match(replay.events[0].prompt, /^\/plan-work\b/);
  assert.equal(replay.events[1].status, "completed");
  assert.equal(replay.events[2].prompt, "/review-work");
  assert.equal(replay.events[3].tool_input.root_plan.length, 3680);
  assert.equal(replay.events[3].tool_input.root_plan, rootPlan.slice(0, 3680));
  assert.equal(replay.events[3].tool_input.root_plan_id, "wp-sanitized-replay");
  assert.equal(replay.events[4].tool_input.native_review_receipt, "receipt-sanitized");
  assert.deepEqual(replay.events[4].tool_output, toolOutput);
  assert.equal(replay.transcript[0].message.content[0].name, "CreatePlan");
  assert.equal(replay.transcript[0].message.content[0].input.plan, rootPlan);
  assert.deepEqual(replay.transcript[1], { type: "turn_ended", status: "success" });
  assert.equal(replay.post_stop_transcript[0].message.content[0].type, "text");
});

test("sanitized fixture replays stop-observed native CreatePlan through the real MCP handler and records one exact task chain", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-sanitized-e2e-home-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-sanitized-e2e-transcript-"));
  const workspaceRoot = initializeFixtureRepository(home);
  const transcriptPath = join(transcriptRoot, "conversation-sanitized.jsonl");
  const rootPlan = expandedSanitizedRoot();
  const expectedRootHash = createHash("sha256").update(rootPlan, "utf8").digest("hex");
  const truncatedRootHash = createHash("sha256").update(rootPlan.slice(0, 3680), "utf8").digest("hex");
  assert.ok(rootPlan.length > 3680);

  const replay = loadSanitizedCursorReplay({
    rootPlan,
    rootPlanId: "wp-sanitized-replay",
    workspaceRoot,
    transcriptPath,
  });
  writeFileSync(transcriptPath, `${replay.transcript.map((entry) => JSON.stringify(entry)).join("\n")}\n`);

  const options = { home, pluginRoot: defaultRoot, enforcementMode: true };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "src", "mcp", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: {
      ...process.env,
      HOME: home,
      GELDMACHER_WORKFLOW_HOME: join(home, ".geldmacher", "workflow"),
      CURSOR_PLUGIN_ROOT: defaultRoot,
    },
    stderr: "pipe",
  });
  const client = workflowClient("sanitized-cursor-native-e2e", [workspaceRoot]);

  try {
    assert.deepEqual(evaluateCloseoutGuard(replay.events[0], options), {});
    assert.deepEqual(evaluateCloseoutGuard(replay.events[1], options), {});
    assert.deepEqual(evaluateCloseoutGuard(replay.events[2], options), {});

    const prepared = evaluateCloseoutGuard(replay.events[3], options);
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(prepared.updated_input.native_review_receipt, "receipt-sanitized");
    assert.equal(prepared.updated_input.root_plan, rootPlan.slice(0, 3680));

    await client.connect(transport);
    const toolResult = await client.callTool({
      name: "workflow_closeout",
      arguments: prepared.updated_input,
    });
    assert.equal(toolResult.isError, false, JSON.stringify(toolResult.structuredContent));
    const payload = toolResult.structuredContent;
    assert.equal(payload.native_task_binding, "cursor-receipt");
    assert.equal(payload.native_root_source, "cursor-create-plan");
    assert.deepEqual(payload.native_root_binding, { status: "enforced", source: "task-transcript-stop", reason_codes: [] });
    assert.equal(payload.root_plan_id, "wp-sanitized-replay");
    assert.equal(payload.root_content_hash, expectedRootHash);
    assert.notEqual(payload.root_content_hash, truncatedRootHash);

    const postToolEvent = {
      ...replay.events[3],
      ...replay.events[4],
      tool_input: prepared.updated_input,
      tool_output: toolResult,
    };
    assert.deepEqual(evaluateCloseoutGuard(postToolEvent, options), {});

    const followupGeneration = "generation-review-followup-sanitized";
    assert.deepEqual(evaluateCloseoutGuard({
      ...replay.events[1],
      ...replay.events[2],
      generation_id: followupGeneration,
    }, options), {});
    const followupPrepared = evaluateCloseoutGuard({
      ...replay.events[2],
      ...replay.events[3],
      generation_id: followupGeneration,
      tool_use_id: "tool-closeout-followup-sanitized",
    }, options);
    assert.match(followupPrepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(
      followupPrepared.updated_input.native_review_receipt,
      prepared.updated_input.native_review_receipt,
    );

    const consumed = consumeNativeReviewReceipt({
      stateRoot: workflowStateRoot(workspaceRoot, { home }),
      token: followupPrepared.updated_input.native_review_receipt,
      input: followupPrepared.updated_input,
    });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.root_hash, expectedRootHash);
    assert.equal(consumed.receipt.predecessor_mode, "task-chain");
    assert.equal(consumed.receipt.artifacts.length, 2);

    const recordedById = new Map(consumed.receipt.artifacts.map((entry) => [entry.label, entry.text]));
    assert.equal(recordedById.get(payload.delivery_evidence_id), payload.delivery_evidence_artifact);
    assert.equal(recordedById.get(payload.work_review_id), payload.artifact);
    const taskChain = inspectArtifactSet([
      ["root", rootPlan],
      ...consumed.receipt.artifacts.map((entry) => [entry.label, entry.text]),
    ], defaultRoot);
    assert.deepEqual(taskChain.errors, []);
    const tips = effectiveCliSummary(taskChain);
    assert.equal(tips.evidence_tips["wp-sanitized-replay"], payload.delivery_evidence_id);
    assert.equal(tips.review_tips["wp-sanitized-replay"], payload.work_review_id);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("privacy guard identifies every prohibited raw payload class", () => {
  assert.deepEqual(sanitizedReplayPrivacyFindings({ value: "/Users/person/project" }), ["absolute user path"]);
  assert.deepEqual(sanitizedReplayPrivacyFindings({ value: "person@example.com" }), ["email address"]);
  assert.deepEqual(sanitizedReplayPrivacyFindings({ value: "d843b0be-9e83-4529-a55f-dbe2991f8c5d" }), ["UUID"]);
  assert.deepEqual(sanitizedReplayPrivacyFindings({ value: `sk-${"a".repeat(24)}` }), ["credential prefix"]);
  assert.deepEqual(sanitizedReplayPrivacyFindings({ value: "z".repeat(64) }), ["unknown long token"]);
});
