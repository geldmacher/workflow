import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  approveNativeImplementPlan,
  consumeNativeReviewReceipt,
  observeNativeCreatePlan,
  observeNativeReviewResult,
  prepareNativeReviewReceipt,
} from "../hooks/native-task-review-context.mjs";
import { hashWorkflowIdentifier } from "../hooks/model-inheritance-state.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

const achievedReviewInput = {
  schema: 1,
  kind: "review-input",
  assessment: "achieved",
  recommended_action: "none",
  assessment_summary: "The exact verified Evidence satisfies the Root.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The repository matches the reviewed delivery.",
  findings: [],
  missing_evidence: [],
  auditor_reports: [],
};

const verifiedCheck = {
  check_id: "CHECK-1",
  grade: "verified",
  observed: "Retry verification passes twice.",
  repetitions: 2,
};

function createEvent(overrides = {}) {
  return {
    hook_event_name: "postToolUse",
    tool_name: "CreatePlan",
    conversation_id: "conversation-1",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    tool_input: {
      name: "Adaptive retry",
      plan: rootPlan,
      todos: [{ id: "STEP-1", content: "Implement retry handling." }],
    },
    ...overrides,
  };
}

function approvalEvent(overrides = {}) {
  return {
    hook_event_name: "beforeSubmitPrompt",
    conversation_id: "conversation-1",
    generation_id: "implementation-generation",
    prompt: "Adaptive retry\n\nImplement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.",
    ...overrides,
  };
}

function reviewEvent(overrides = {}) {
  return {
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_closeout",
    conversation_id: "conversation-1",
    generation_id: "review-generation",
    tool_use_id: "review-call",
    tool_input: {
      artifact_kind: "work-review",
      check_evidence: [verifiedCheck],
      review_input: achievedReviewInput,
    },
    ...overrides,
  };
}

function establishActive(stateRoot) {
  assert.equal(observeNativeCreatePlan({ stateRoots: [stateRoot], input: createEvent(), pluginRoot: defaultRoot }).status, "observed");
  assert.equal(approveNativeImplementPlan({ stateRoots: [stateRoot], input: approvalEvent() }).status, "approved");
}

test("Cursor receipt binds exact approved Root while ignoring truncated model transport", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-"));
  try {
    establishActive(stateRoot);
    const event = reviewEvent({ tool_input: { ...reviewEvent().tool_input, root_plan_id: "wp-adaptive-retry", root_plan: rootPlan.slice(0, 300) } });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot });
    assert.equal(prepared.status, "prepared");
    const receiptDirectory = join(stateRoot, "manual-native-task-review", "receipts", "pending", prepared.request_hash);
    const [receiptName] = readdirSync(receiptDirectory);
    assert.equal(statSync(receiptDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(join(receiptDirectory, receiptName)).mode & 0o777, 0o600);
    const consumed = consumeNativeReviewReceipt({ stateRoot, input: event.tool_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
    assert.equal(consumed.receipt.root_plan_id, "wp-adaptive-retry");
    assert.equal(consumed.receipt.predecessor_mode, "full-rebuild");
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, input: event.tool_input }), { status: "replayed" });
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot }).status, "replayed");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("receipt preparation fails closed without generation or tool-call identity", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-identity-"));
  try {
    establishActive(stateRoot);
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ generation_id: undefined, tool_use_id: undefined }),
      pluginRoot: defaultRoot,
    }).status, "mismatch");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("receipt consumption rejects changed Root bytes", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-tamper-"));
  try {
    establishActive(stateRoot);
    const event = reviewEvent();
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot });
    const receiptDirectory = join(stateRoot, "manual-native-task-review", "receipts", "pending", prepared.request_hash);
    const receiptPath = join(receiptDirectory, readdirSync(receiptDirectory)[0]);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    writeFileSync(receiptPath, `${JSON.stringify({ ...receipt, root_text: `${receipt.root_text}\n` }, null, 2)}\n`, { mode: 0o600 });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, input: event.tool_input }), { status: "mismatch" });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor receipt rejects a model-supplied Root ID mismatch", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-mismatch-"));
  try {
    establishActive(stateRoot);
    const result = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ tool_input: { ...reviewEvent().tool_input, root_plan_id: "wp-other-root" } }),
      pluginRoot: defaultRoot,
    });
    assert.equal(result.status, "mismatch");
    assert.equal(result.expected_root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("an unapproved newer CreatePlan blocks the previously approved Root", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-newer-plan-"));
  const newerRoot = rootPlan.replaceAll("wp-adaptive-retry", "wp-newer-retry");
  try {
    establishActive(stateRoot);
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: createEvent({
        generation_id: "newer-plan-generation",
        tool_use_id: "newer-plan-call",
        tool_input: { name: "Newer retry", plan: newerRoot },
      }),
      pluginRoot: defaultRoot,
    }).status, "observed");
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot }).status, "unapproved");
    assert.equal(approveNativeImplementPlan({ stateRoots: [stateRoot], input: approvalEvent() }).status, "ambiguous");
    assert.equal(approveNativeImplementPlan({
      stateRoots: [stateRoot],
      input: approvalEvent({ prompt: "Newer retry\n\nImplement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself." }),
    }).status, "approved");
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: reviewEvent(), pluginRoot: defaultRoot });
    assert.equal(prepared.status, "prepared");
    const consumed = consumeNativeReviewReceipt({ stateRoot, input: reviewEvent().tool_input });
    assert.equal(consumed.receipt.root_plan_id, "wp-newer-retry");
    assert.equal(consumed.receipt.root_text, newerRoot);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor receipt expires and remains distinguishable from unavailable", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-expired-"));
  try {
    establishActive(stateRoot);
    const start = new Date("2026-08-21T10:00:00.000Z");
    const event = reviewEvent();
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot, options: { now: () => start } }).status, "prepared");
    const later = new Date(start.getTime() + 6 * 60 * 1000);
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, input: event.tool_input, options: { now: () => later } }), { status: "expired" });
    assert.deepEqual(consumeNativeReviewReceipt({ stateRoot, input: event.tool_input, options: { now: () => later } }), { status: "expired" });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor recovers the exact approved Root from the same transcript", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-transcript-state-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-transcript-"));
  const conversationId = "conversation-transcript";
  const transcriptPath = join(transcriptRoot, `${conversationId}.jsonl`);
  try {
    const lines = [
      { role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: createEvent().tool_input }] } },
      { role: "user", message: { content: [{ type: "text", text: approvalEvent().prompt }] } },
    ];
    writeFileSync(transcriptPath, `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const event = reviewEvent({ conversation_id: conversationId, transcript_path: transcriptPath });
    const prepared = prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: event, pluginRoot: defaultRoot });
    assert.equal(prepared.status, "prepared");
    const consumed = consumeNativeReviewReceipt({ stateRoot, input: event.tool_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("Successful Review output becomes the next same-task predecessor chain", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-chain-"));
  try {
    establishActive(stateRoot);
    const bundle = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: achievedReviewInput,
      checkEvidence: [verifiedCheck],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
    });
    const output = {
      artifact_kind: "work-review",
      root_plan_id: "wp-adaptive-retry",
      delivery_evidence_artifact: bundle.delivery_evidence.artifact,
      delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
      artifact: bundle.review.artifact,
      artifact_hash: bundle.review.artifact_hash,
      review_input_hash: bundle.review.review_input_hash,
    };
    const recorded = observeNativeReviewResult({
      stateRoots: [stateRoot],
      input: { ...reviewEvent(), hook_event_name: "postToolUse", tool_output: { structuredContent: output } },
      pluginRoot: defaultRoot,
    });
    assert.equal(recorded.status, "recorded");

    const next = reviewEvent({ generation_id: "review-generation-2", tool_use_id: "review-call-2" });
    assert.equal(prepareNativeReviewReceipt({ stateRoots: [stateRoot], input: next, pluginRoot: defaultRoot }).status, "prepared");
    const consumed = consumeNativeReviewReceipt({ stateRoot, input: next.tool_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.predecessor_mode, "task-chain");
    assert.equal(consumed.receipt.artifacts.length, 2);
    assert.equal(consumed.receipt.artifacts.find((entry) => entry.text === bundle.review.artifact).builder_provenance.kind, "host-work-review-builder");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Transcript recovery rejects a different conversation file", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-cross-task-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-cross-task-transcript-"));
  const transcriptPath = join(transcriptRoot, "different-conversation.jsonl");
  try {
    mkdirSync(dirname(transcriptPath), { recursive: true });
    writeFileSync(transcriptPath, "\n");
    const result = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ transcript_path: transcriptPath }),
      pluginRoot: defaultRoot,
    });
    assert.equal(result.status, "mismatch");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("Transcript recovery does not replace an existing invalid task context", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-invalid-state-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-native-review-invalid-transcript-"));
  const conversationId = "conversation-invalid-state";
  const transcriptPath = join(transcriptRoot, `${conversationId}.jsonl`);
  try {
    writeFileSync(transcriptPath, `${[
      { role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: createEvent().tool_input }] } },
      { role: "user", message: { content: [{ type: "text", text: approvalEvent().prompt }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const conversationHash = hashWorkflowIdentifier("conversation", conversationId);
    const storedPath = join(stateRoot, "manual-native-task-review", "conversations", `${conversationHash}.json`);
    mkdirSync(dirname(storedPath), { recursive: true });
    writeFileSync(storedPath, "{not-json\n");
    assert.equal(prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent({ conversation_id: conversationId, transcript_path: transcriptPath }),
      pluginRoot: defaultRoot,
    }).status, "invalid");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});
