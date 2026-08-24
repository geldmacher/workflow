import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateCloseoutGuard } from "../hooks/closeout-guard.mjs";
import { consumeNativeReviewReceipt } from "../hooks/native-task-review-context.mjs";
import { hashWorkflowIdentifier, workflowStateRoot } from "../hooks/model-inheritance-state.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

function input(overrides = {}) {
  return {
    conversation_id: "cursor-native-plan-review",
    generation_id: "generation-1",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    ...overrides,
  };
}

test("Cursor implementation and correction finish without lifecycle closeout", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-plan-review-"));
  try {
    const options = { stateRoot };
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "Implement this plan" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "afterAgentResponse", text: "Implemented." }), options), {});
    const stop = evaluateCloseoutGuard(input({ hook_event_name: "stop" }), options);
    assert.deepEqual(stop, {});
    assert.equal("followup_message" in stop, false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor planning stop passively captures the current transcript Root without a follow-up turn", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-state-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-transcript-"));
  try {
    const options = { stateRoot, pluginRoot: defaultRoot };
    const conversationId = "cursor-native-plan-review";
    const transcriptPath = join(transcriptRoot, `${conversationId}.jsonl`);
    writeFileSync(transcriptPath, `${[
      { role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Adaptive retry", plan: rootPlan } }] } },
      { type: "turn_ended", status: "success" },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);

    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "plan-generation",
      prompt: "/plan-work stabilize native Root binding",
      transcript_path: transcriptPath,
    }), options), {});
    const stopped = evaluateCloseoutGuard(input({
      hook_event_name: "stop",
      generation_id: "plan-generation",
      status: "completed",
      transcript_path: transcriptPath,
    }), options);
    assert.deepEqual(stopped, {});
    assert.equal("followup_message" in stopped, false);

    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "review-generation",
      prompt: "/review-work",
      transcript_path: transcriptPath,
    }), options), {});
    const prepared = evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      transcript_path: transcriptPath,
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: null },
    }), options);
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.updated_input.native_review_receipt, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_source, "cursor-create-plan");
    assert.deepEqual(consumed.receipt.root_binding, { status: "enforced", source: "task-transcript-stop", reason_codes: [] });
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("planning stop never reconstructs a Root without a current generation marker", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-no-marker-state-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-no-marker-transcript-"));
  try {
    const transcriptPath = join(transcriptRoot, "cursor-native-plan-review.jsonl");
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Adaptive retry", plan: rootPlan } }] } })}\n${JSON.stringify({ type: "turn_ended", status: "success" })}\n`);
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "stop",
      generation_id: "historical-plan-generation",
      status: "completed",
      transcript_path: transcriptPath,
    }), { stateRoot, pluginRoot: defaultRoot }), {});
    assert.equal(existsSync(join(stateRoot, "manual-native-task-review", "conversations")), false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("planning stop cannot carry a generation marker into another workspace", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-workspace-state-"));
  const foreignWorkspace = mkdtempSync(join(tmpdir(), "cursor-plan-stop-foreign-workspace-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "cursor-plan-stop-workspace-transcript-"));
  try {
    spawnSync("git", ["init", "--quiet", foreignWorkspace], { encoding: "utf8" });
    const options = { stateRoot, pluginRoot: defaultRoot };
    const transcriptPath = join(transcriptRoot, "cursor-native-plan-review.jsonl");
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Adaptive retry", plan: rootPlan } }] } })}\n${JSON.stringify({ type: "turn_ended", status: "success" })}\n`);
    evaluateCloseoutGuard(input({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "plan-generation",
      prompt: "/plan-work",
      transcript_path: transcriptPath,
    }), options);
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "stop",
      generation_id: "plan-generation",
      status: "completed",
      workspace_roots: [foreignWorkspace],
      cwd: foreignWorkspace,
      transcript_path: transcriptPath,
    }), options), {});
    const conversationPath = join(
      stateRoot,
      "manual-native-task-review",
      "conversations",
      `${hashWorkflowIdentifier("conversation", "cursor-native-plan-review")}.json`,
    );
    assert.equal(existsSync(conversationPath), false);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(foreignWorkspace, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("Cursor Review remains repository-read-only while allowing marked auditors", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-review-readonly-"));
  try {
    const options = { stateRoot };
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options);
    const denied = evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /read-only/i);
    const shellDenied = evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: { command: "git status --short" } }), options);
    assert.equal(shellDenied.permission, "deny");
    assert.match(shellDenied.user_message, /exact machine-verifiable Check/i);
    const mcpDenied = evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "MCP:third_party_write", tool_input: {} }), options);
    assert.equal(mcpDenied.permission, "deny");
    assert.match(mcpDenied.user_message, /read-only/i);
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "MCP:workflow_status", tool_input: {} }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      tool_name: "Task",
      tool_input: {
        readonly: true,
        subagent_type: "delivery-auditor",
        prompt: "[workflow-readonly-review-v1] Inspect delivery.",
      },
    }), options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("corrupt active Review state fails closed while absent state remains passive", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-review-corrupt-state-"));
  try {
    const options = { stateRoot, enforcementMode: true };
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options);
    const turn = join(
      stateRoot,
      "manual-native-plan-review",
      hashWorkflowIdentifier("conversation", "cursor-native-plan-review"),
      `${hashWorkflowIdentifier("generation", "generation-1")}.json`,
    );
    writeFileSync(turn, "{broken\n");
    const denied = evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /native-review-state-invalid/);

    const absent = mkdtempSync(join(tmpdir(), "cursor-review-absent-state-"));
    try {
      assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write" }), { stateRoot: absent, enforcementMode: true }), {});
    } finally { rmSync(absent, { recursive: true, force: true }); }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor ignores legacy Manual lifecycle files", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-legacy-manual-"));
  try {
    const legacy = join(stateRoot, "manual-closeout", "legacy");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "turn.json"), JSON.stringify({ schema: 1, required: true, closeout_recorded: false }));
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "stop" }), { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write" }), { stateRoot }), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor phase tracking ignores unrelated and invalid input", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-phase-tracking-"));
  try {
    const options = { stateRoot };
    assert.deepEqual(evaluateCloseoutGuard(null, options), {});
    assert.deepEqual(evaluateCloseoutGuard([], options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "Explain the repository" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/correct-work" }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review parses shell input and records completed auditors", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-review-observation-"));
  try {
    const options = { stateRoot };
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options);
    assert.equal(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: JSON.stringify({ command: "git status --short" }) }), options).permission, "deny");
    assert.equal(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: "not-json" }), options).permission, "deny");
    assert.equal(evaluateCloseoutGuard(input({ hook_event_name: "preToolUse", tool_name: "Task", tool_input: "not-json" }), options).permission, "deny");
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "postToolUse",
      tool_name: "spawn_agent",
      tool_input: {
        readonly: true,
        agent_type: "risk-auditor",
        prompt: "[workflow-readonly-review-v1] Inspect risk.",
      },
    }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "postToolUse",
      tool_name: "spawn_agent",
      tool_input: {
        readonly: true,
        agent_type: "delivery-auditor",
        prompt: "[workflow-readonly-review-v1] Inspect delivery.",
      },
    }), options), {});
    const turn = JSON.parse(readFileSync(join(
      stateRoot,
      "manual-native-plan-review",
      hashWorkflowIdentifier("conversation", "cursor-native-plan-review"),
      `${hashWorkflowIdentifier("generation", "generation-1")}.json`,
    ), "utf8"));
    assert.equal(turn.revision, 3);
    assert.deepEqual(turn.observed_review_auditors, ["delivery-auditor", "risk-auditor"]);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor lifecycle binds explicit Review to one opaque work-review receipt", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-review-receipt-"));
  try {
    const options = { stateRoot, pluginRoot: defaultRoot };
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }), options), {});
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "review-generation",
      prompt: "/review-work",
    }), options), {});
    for (const command of ["npm test", "rtk npm test"]) {
      assert.deepEqual(evaluateCloseoutGuard(input({
        hook_event_name: "preToolUse",
        generation_id: "review-generation",
        tool_name: "Shell",
        tool_use_id: `approved-${command}`,
        tool_input: { command, cwd: defaultRoot },
      }), options), {});
    }
    for (const command of [
      "find . -delete",
      "sed -n -i README.md",
      "git diff --output=review.patch",
      "node --test tests/other.test.mjs",
      "npm run missing-script",
      "npm test -- --extra",
    ]) {
      const denied = evaluateCloseoutGuard(input({
        hook_event_name: "preToolUse",
        generation_id: "review-generation",
        tool_name: "Shell",
        tool_use_id: `denied-${command}`,
        tool_input: { command, cwd: defaultRoot },
      }), options);
      assert.equal(denied.permission, "deny", command);
    }
    const toolInput = {
      artifact_kind: "work-review",
      root_plan_id: "wp-adaptive-retry",
      root_plan: rootPlan.slice(0, 250),
      check_evidence: [],
      review_input: { schema: 1, kind: "review-input" },
    };
    const prepared = evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: toolInput,
    }), options);
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    const consumed = consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.updated_input.native_review_receipt,
      input: prepared.updated_input,
    });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.root_text, rootPlan);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("missing Review observer recovers only from one exact current transcript command and stays provisional", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-review-recovery-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "cursor-native-review-recovery-transcript-"));
  const transcriptPath = join(transcriptRoot, "cursor-review-recovery.jsonl");
  try {
    const options = { stateRoot, pluginRoot: defaultRoot, workspaceRoot: defaultRoot };
    const base = {
      conversation_id: "cursor-review-recovery",
      transcript_path: transcriptPath,
      workspace_roots: [defaultRoot],
      cwd: defaultRoot,
    };
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }, options);
    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "/review-work" }] } })}\n`);
    const toolInput = { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } };
    const prepared = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      generation_id: "recovered-review-generation",
      tool_use_id: "recovered-review-call",
      tool_name: "MCP:workflow_closeout",
      tool_input: toolInput,
    }, options);
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.updated_input.native_review_receipt, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.review_enforcement.status, "unavailable");
    assert.deepEqual(consumed.receipt.review_enforcement.reason_codes, ["review-observer-unavailable"]);

    writeFileSync(transcriptPath, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "/review-work later" }] } })}\n`);
    const denied = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      generation_id: "failed-recovery-generation",
      tool_use_id: "failed-recovery-call",
      tool_name: "MCP:workflow_closeout",
      tool_input: toolInput,
    }, options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /Hook Trust/i);

    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      generation_id: "ordinary-closeout-generation",
      tool_name: "MCP:workflow_closeout",
      tool_input: { artifact_kind: "delivery-evidence" },
    }, options), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("a mutating tool in another Cursor conversation contaminates repository attribution", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-review-contamination-"));
  try {
    const options = { stateRoot, pluginRoot: defaultRoot };
    const workspace = { workspace_roots: [defaultRoot], cwd: defaultRoot };
    evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }), options);
    assert.deepEqual(evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      conversation_id: "concurrent-conversation",
      generation_id: "implementation-generation",
      tool_name: "Write",
      tool_use_id: "concurrent-write",
      tool_input: { path: "README.md" },
    }), options), {});
    evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "review-generation",
      prompt: "/review-work",
    }), options);
    const prepared = evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } },
    }), options);
    const consumed = consumeNativeReviewReceipt({
      stateRoot,
      token: prepared.updated_input.native_review_receipt,
      input: prepared.updated_input,
    });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.repository_attribution.status, "unavailable");
    assert.ok(consumed.receipt.repository_attribution.reason_codes.includes("concurrent-repository-activity"));
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor lifecycle blocks a mismatched Review Root before MCP execution", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-native-review-mismatch-"));
  try {
    const options = { stateRoot, pluginRoot: defaultRoot };
    evaluateCloseoutGuard(input({
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }), options);
    evaluateCloseoutGuard(input({ hook_event_name: "beforeSubmitPrompt", generation_id: "review-generation", prompt: "/review-work" }), options);
    const denied = evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_input: { artifact_kind: "work-review", root_plan_id: "wp-other-root" },
    }), options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /native-task-receipt-mismatch/);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("multi-root Cursor input writes no Root authority even when cwd is unique", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-native-multiroot-home-"));
  const parent = mkdtempSync(join(tmpdir(), "cursor-native-multiroot-workspaces-"));
  const first = join(parent, "first");
  const second = join(parent, "second");
  mkdirSync(first);
  mkdirSync(second);
  assert.equal(spawnSync("git", ["-C", first, "init", "--quiet"]).status, 0);
  assert.equal(spawnSync("git", ["-C", second, "init", "--quiet"]).status, 0);
  try {
    const base = {
      conversation_id: "cursor-multiroot-selection",
      workspace_roots: [first, second],
      cwd: first,
    };
    const options = { home, pluginRoot: defaultRoot };
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }, options), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "review-generation",
      prompt: "/review-work",
    }, options), {});
    const shellDenied = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "Shell",
      tool_use_id: "diagnostic-read",
      tool_input: { command: "git status --short" },
    }, options);
    assert.equal(shellDenied.permission, "deny");
    const denied = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } },
    }, options);
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /native-workspace-ambiguous/i);
    assert.equal(existsSync(join(workflowStateRoot(realpathSync(first), { home }), "manual-native-task-review", "conversations")), false);
    assert.equal(existsSync(join(workflowStateRoot(realpathSync(second), { home }), "manual-native-task-review", "conversations")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(parent, { recursive: true, force: true });
  }
});

test("symlink and repository subdirectory paths share one canonical Review identity", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-native-canonical-home-"));
  const links = mkdtempSync(join(tmpdir(), "cursor-native-canonical-link-"));
  const linked = join(links, "workflow-link");
  symlinkSync(defaultRoot, linked);
  try {
    const options = { home, pluginRoot: defaultRoot };
    const workspace = { workspace_roots: [linked, join(defaultRoot, "src")], cwd: defaultRoot };
    evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "postToolUse",
      generation_id: "canonical-plan",
      tool_name: "CreatePlan",
      tool_use_id: "canonical-create",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }), options);
    evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "canonical-review",
      prompt: "/review-work",
    }), options);
    const prepared = evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      generation_id: "canonical-review",
      tool_use_id: "canonical-closeout",
      tool_name: "MCP:workflow_closeout",
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } },
    }), options);
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    const stateRoot = workflowStateRoot(realpathSync(defaultRoot), { home });
    const consumed = consumeNativeReviewReceipt({ stateRoot, token: prepared.updated_input.native_review_receipt, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.equal(consumed.receipt.workspace_root, realpathSync(defaultRoot));
    assert.equal(consumed.receipt.baseline.repository_root, realpathSync(defaultRoot));
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(links, { recursive: true, force: true });
  }
});

test("multi-root and parallel-generation mutations revoke or contaminate single-root Review authority", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-native-contamination-home-"));
  const second = mkdtempSync(join(tmpdir(), "cursor-native-contamination-second-"));
  const firstStateRoot = workflowStateRoot(realpathSync(defaultRoot), { home });
  try {
    const options = { home, pluginRoot: defaultRoot };
    const workspace = { workspace_roots: [defaultRoot], cwd: defaultRoot };
    evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "postToolUse",
      generation_id: "plan-generation",
      tool_name: "CreatePlan",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Adaptive retry", plan: rootPlan },
    }), options);
    assert.deepEqual(evaluateCloseoutGuard(input({
      hook_event_name: "preToolUse",
      conversation_id: "other-conversation",
      generation_id: "other-generation",
      tool_name: "Write",
      tool_use_id: "multi-root-write",
      workspace_roots: [defaultRoot, second],
      cwd: defaultRoot,
      tool_input: { path: "README.md" },
    }), options), {});
    evaluateCloseoutGuard(input({ ...workspace, hook_event_name: "beforeSubmitPrompt", generation_id: "review-generation", prompt: "/review-work" }), options);
    const prepared = evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      generation_id: "review-generation",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } },
    }), options);
    const consumed = consumeNativeReviewReceipt({ stateRoot: firstStateRoot, token: prepared.updated_input.native_review_receipt, input: prepared.updated_input });
    assert.equal(consumed.status, "resolved");
    assert.ok(consumed.receipt.repository_attribution.reason_codes.includes("concurrent-repository-activity"));

    evaluateCloseoutGuard(input({ ...workspace, hook_event_name: "beforeSubmitPrompt", generation_id: "review-generation-2", prompt: "/review-work" }), options);
    const pending = evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      generation_id: "review-generation-2",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call-2",
      tool_input: { artifact_kind: "work-review", check_evidence: [], review_input: { schema: 1, kind: "review-input" } },
    }), options);
    assert.deepEqual(evaluateCloseoutGuard(input({
      ...workspace,
      hook_event_name: "preToolUse",
      generation_id: "parallel-generation",
      tool_name: "Write",
      tool_use_id: "parallel-write",
      tool_input: { path: "README.md" },
    }), options), {});
    assert.equal(consumeNativeReviewReceipt({ stateRoot: firstStateRoot, token: pending.updated_input.native_review_receipt, input: pending.updated_input }).status, "unavailable");
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});

test("registered Cursor lifecycle hook is passive outside explicit Workflow and enforces Review", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-passive-hook-home-"));
  const secondary = mkdtempSync(join(tmpdir(), "cursor-passive-hook-repository-"));
  assert.equal(spawnSync("git", ["-C", secondary, "init", "--quiet"]).status, 0);
  const script = join(new URL("..", import.meta.url).pathname, "hooks", "closeout-guard.mjs");
  const run = (overrides) => {
    const result = spawnSync(process.execPath, [script], {
      input: JSON.stringify(input({
        model: "cursor-parent",
        transcript_path: null,
        workspace_roots: [defaultRoot, secondary],
        cwd: defaultRoot,
        ...overrides,
      })),
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout || "{}");
  };
  try {
    assert.deepEqual(run({ hook_event_name: "beforeSubmitPrompt", prompt: "Implement this plan" }), {});
    assert.deepEqual(run({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } }), {});
    assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);

    assert.deepEqual(run({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), {});
    const denied = run({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } });
    assert.equal(denied.permission, "deny");
    assert.match(denied.user_message, /native-workspace-ambiguous/i);

    const invalid = spawnSync(process.execPath, [script], { input: "not-json", encoding: "utf8", env: { ...process.env, HOME: home } });
    assert.equal(invalid.status, 0);
    assert.deepEqual(JSON.parse(invalid.stdout), {});
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(secondary, { recursive: true, force: true });
  }
});

test("dedicated mutation hook fails closed on internal input failure", () => {
  const script = join(new URL("..", import.meta.url).pathname, "hooks", "closeout-guard.mjs");
  const healthy = spawnSync(process.execPath, [script, "--enforce"], {
    input: JSON.stringify(input({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: { path: "src/a.mjs" } })),
    encoding: "utf8",
  });
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.deepEqual(JSON.parse(healthy.stdout), {});
  const failed = spawnSync(process.execPath, [script, "--enforce"], { input: "not-json", encoding: "utf8" });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /fail-closed enforcement unavailable/i);

  const hooks = JSON.parse(readFileSync(join(new URL("..", import.meta.url).pathname, "hooks", "hooks.json"), "utf8"));
  const enforcement = hooks.hooks.preToolUse.find((entry) => entry.command.includes("closeout-guard.mjs"));
  assert.equal(enforcement.failClosed, true);
  assert.match(enforcement.matcher, /MCP:\.\*/);
  assert.equal(hooks.hooks.beforeSubmitPrompt.length, 2);
  assert.ok(hooks.hooks.beforeSubmitPrompt.every((entry) => entry.failClosed === false));
});
