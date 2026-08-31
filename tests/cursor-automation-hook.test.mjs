import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateAutomationGuard, parseAutomationDecisionPrompt } from "../hooks/automation-guard.mjs";
import { hashWorkflowIdentifier } from "../hooks/workflow-state.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { writeProtectedRecord } from "../src/core/protected-record-store.mjs";

const runId = `run-${"a".repeat(24)}`;
const evidenceHash = "b".repeat(64);
const reviewHash = "c".repeat(64);

function runRecord(overrides = {}) {
  return {
    schema: 1,
    kind: "workflow-6-run",
    contract: "workflow-6-transactional",
    run_id: runId,
    revision: 2,
    lifecycle: "correction-needed",
    pending_transition: null,
    delivery_evidence: { artifact_hash: evidenceHash },
    work_review: { artifact_hash: reviewHash },
    ...overrides,
  };
}

function setup(record = runRecord()) {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-cursor-automation-"));
  const runsRoot = join(stateRoot, "workflow-6-runs");
  writeProtectedRecord(join(runsRoot, "runs", `${runId}.json`), record, runsRoot);
  const identity = {
    conversation_id: "cursor-automation-hook-test",
    generation_id: "generation-1",
    workspace_root: defaultRoot,
  };
  return {
    stateRoot,
    runsRoot,
    identity,
    options: { stateRoot, workspaceRoot: defaultRoot, now: () => new Date("2026-08-25T12:00:00.000Z") },
  };
}

function select(context, action = "correct", revision = 2) {
  return evaluateAutomationGuard({
    ...context.identity,
    hook_event_name: "beforeSubmitPrompt",
    prompt: `/auto-work ${action} ${runId}@${revision}`,
  }, context.options);
}

function prepare(context, additions = {}) {
  return evaluateAutomationGuard({
    ...context.identity,
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_prepare",
    tool_use_id: additions.tool_use_id ?? "tool-1",
    tool_input: {
      action: "correct",
      run_id: runId,
      expected_revision: 2,
      idempotency_key: "correct-2",
      ...(additions.tool_input ?? {}),
    },
  }, context.options);
}

test("Cursor automation prompt grammar is exact", () => {
  assert.deepEqual(parseAutomationDecisionPrompt(`/auto-work review ${runId}@0`), { action: "review", run_id: runId, revision: 0 });
  assert.deepEqual(parseAutomationDecisionPrompt(`/auto-work correct ${runId}@2`), { action: "correct", run_id: runId, revision: 2 });
  assert.equal(parseAutomationDecisionPrompt(`/auto-work stop ${runId}@0`), null);
  assert.equal(parseAutomationDecisionPrompt(`/auto-work resume ${runId}@2`), null);
  assert.equal(parseAutomationDecisionPrompt(`/auto-work accept-delivery ${runId}`), null);
  assert.equal(parseAutomationDecisionPrompt(`Please /auto-work accept-delivery ${runId}@2`), null);
});

test("exact selection injects one host receipt and rejects caller or binding drift", () => {
  const context = setup();
  try {
    select(context);
    const caller = prepare(context, { tool_input: { human_decision_receipt: "caller-token" } });
    assert.equal(caller.permission, "deny");
    assert.match(caller.user_message, /caller|host-injected/i);

    const wrongAction = prepare(context, { tool_input: { action: "review" } });
    assert.equal(wrongAction.permission, "deny");
    assert.match(wrongAction.user_message, /differs from the exact/i);

    const wrongRevision = prepare(context, { tool_input: { expected_revision: 0 } });
    assert.equal(wrongRevision.permission, "deny");

    const injected = prepare(context);
    assert.match(injected.updated_input.human_decision_receipt, /^[A-Za-z0-9_-]{43}$/);
    const busy = prepare(context, { tool_use_id: "tool-2" });
    assert.equal(busy.permission, "deny");
    assert.match(busy.user_message, /in-flight/i);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("artifact-tip drift and Run drift invalidate a previous human selection", () => {
  const context = setup();
  try {
    select(context);
    writeProtectedRecord(join(context.runsRoot, "runs", `${runId}.json`), runRecord({
      delivery_evidence: { artifact_hash: "d".repeat(64) },
    }), context.runsRoot);
    const drifted = prepare(context);
    assert.equal(drifted.permission, "deny");
    assert.match(drifted.user_message, /artifact tips changed/i);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("only a proven transport failure revokes the receipt and preserves the exact selection", () => {
  const context = setup();
  try {
    select(context);
    const first = prepare(context);
    const firstReceipt = first.updated_input.human_decision_receipt;
    evaluateAutomationGuard({
      ...context.identity,
      hook_event_name: "postToolUseFailure",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: "tool-1",
      error_message: "MCP transport connection reset",
    }, context.options);
    const retried = prepare(context, { tool_use_id: "tool-2" });
    assert.match(retried.updated_input.human_decision_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(retried.updated_input.human_decision_receipt, firstReceipt);
    evaluateAutomationGuard({
      ...context.identity,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: "tool-2",
    }, context.options);
    const replay = prepare(context, { tool_use_id: "tool-3" });
    assert.equal(replay.permission, "deny");
    assert.match(replay.user_message, /selection-unavailable/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a non-transport tool failure consumes the selection instead of minting a retry receipt", () => {
  const context = setup();
  try {
    select(context);
    prepare(context);
    evaluateAutomationGuard({
      ...context.identity,
      hook_event_name: "postToolUseFailure",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: "tool-1",
      error_message: "Workflow revision conflict",
    }, context.options);
    const retry = prepare(context, { tool_use_id: "tool-2" });
    assert.equal(retry.permission, "deny");
    assert.match(retry.user_message, /selection-unavailable/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("automation guard is fail-open outside exact human controls and fail-closed only for targeted receipt misuse", () => {
  assert.deepEqual(evaluateAutomationGuard(null), {});
  assert.deepEqual(evaluateAutomationGuard([]), {});
  assert.deepEqual(evaluateAutomationGuard({ hook_event_name: "other" }), {});
  assert.deepEqual(evaluateAutomationGuard({ hook_event_name: "beforeSubmitPrompt", prompt: `/auto-work stop ${runId}@2` }), {});
  const context = setup();
  try {
    assert.deepEqual(evaluateAutomationGuard({ ...context.identity, hook_event_name: "preToolUse", tool_name: "Shell", tool_input: {} }, context.options), {});
    assert.deepEqual(prepare(context, { tool_input: { action: "implement" } }), {});
    const caller = prepare(context, { tool_input: { action: "implement", human_decision_receipt: "caller" } });
    assert.equal(caller.permission, "deny");
    const missing = prepare(context);
    assert.equal(missing.permission, "deny");
    assert.deepEqual(evaluateAutomationGuard({ ...context.identity, hook_event_name: "postToolUse", tool_name: "MCP:workflow_prepare", tool_use_id: "missing" }, context.options), {});
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("expired, unavailable, pending, Review, and Correction selections follow exact Run state", () => {
  const expired = setup();
  try {
    select(expired);
    expired.options.now = () => new Date("2026-08-25T12:11:00.000Z");
    assert.match(prepare(expired).user_message, /expired/);
  } finally { rmSync(expired.stateRoot, { recursive: true, force: true }); }

  const unavailable = setup();
  try {
    select(unavailable);
    rmSync(join(unavailable.runsRoot, "runs", `${runId}.json`));
    assert.match(prepare(unavailable).user_message, /Run is unavailable/);
  } finally { rmSync(unavailable.stateRoot, { recursive: true, force: true }); }

  const pending = setup(runRecord({ pending_transition: { transition_id: `tr-${"d".repeat(32)}` } }));
  try {
    select(pending);
    assert.match(prepare(pending).user_message, /selection-unavailable/);
  } finally { rmSync(pending.stateRoot, { recursive: true, force: true }); }

  for (const [action, lifecycle] of [["correct", "correction-needed"], ["review", "review-needed"]]) {
    const context = setup(runRecord({ lifecycle }));
    try {
      select(context, action);
      const guarded = prepare(context, { tool_input: { action }, tool_use_id: `tool-${action}` });
      assert.match(guarded.updated_input.human_decision_receipt, /^[A-Za-z0-9_-]{43}$/);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("fallback host identities, workspace discovery, and non-Date clocks remain exactly bound", () => {
  const context = setup();
  const identity = {
    session_id: "cursor-session-fallback",
    turn_id: "cursor-turn-fallback",
    workspace_roots: [defaultRoot],
  };
  const options = { stateRoot: context.stateRoot, now: () => "2026-08-25T12:00:00.000Z" };
  try {
    evaluateAutomationGuard({
      ...identity,
      hook_event_name: "beforeSubmitPrompt",
      command: `/auto-work correct ${runId}@2`,
    }, options);
    const guarded = evaluateAutomationGuard({
      ...identity,
      hook_event_name: "preToolUse",
      tool_name: "MCP:workflow_prepare",
      tool_input: { action: "correct", run_id: runId, expected_revision: 2, idempotency_key: "fallback" },
    }, options);
    assert.match(guarded.updated_input.human_decision_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(evaluateAutomationGuard({ ...identity, workspace_roots: [defaultRoot, context.stateRoot], hook_event_name: "other" }, options), {});
    assert.deepEqual(evaluateAutomationGuard({ hook_event_name: "other", workspace_root: defaultRoot, transcript_path: "transcript" }, {}), {});
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("each persisted selection binding and malformed selection state fails independently", () => {
  for (const overrides of [
    { revision: 3 },
    { work_review: { artifact_hash: "e".repeat(64) } },
    { pending_transition: { transition_id: `tr-${"f".repeat(32)}` } },
  ]) {
    const context = setup();
    try {
      select(context);
      writeProtectedRecord(join(context.runsRoot, "runs", `${runId}.json`), runRecord(overrides), context.runsRoot);
      assert.match(prepare(context).user_message, /Run revision or artifact tips changed/);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }

  const malformed = setup();
  try {
    select(malformed);
    const conversation = hashWorkflowIdentifier("conversation", malformed.identity.conversation_id);
    const generation = hashWorkflowIdentifier("generation", malformed.identity.generation_id);
    const path = join(malformed.stateRoot, "native-automation-decisions", conversation, `${generation}.json`);
    writeFileSync(path, JSON.stringify({ schema: 2, kind: "wrong" }));
    assert.match(prepare(malformed).user_message, /differs from the exact/);
  } finally { rmSync(malformed.stateRoot, { recursive: true, force: true }); }
});
