import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateCloseoutGuard } from "../hooks/closeout-guard.mjs";
import { hashWorkflowIdentifier } from "../hooks/workflow-state.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const baseline = Object.freeze({
  schema: 1,
  repository_root: defaultRoot,
  head: "a".repeat(40),
  dirty_paths: [],
  fingerprints: {},
  index_fingerprint: "b".repeat(64),
  status_fingerprint: "c".repeat(64),
  working_tree: "clean",
  captured_at: "2026-08-25T10:00:00.000Z",
});

function options(stateRoot) {
  return { stateRoot, workspaceRoot: defaultRoot, pluginRoot: defaultRoot, captureSnapshot: () => structuredClone(baseline) };
}

function base(overrides = {}) {
  return {
    conversation_id: "cursor-v6",
    generation_id: "review-generation",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    ...overrides,
  };
}

function establish(stateRoot) {
  const opts = options(stateRoot);
  assert.deepEqual(evaluateCloseoutGuard(base({
    hook_event_name: "postToolUse",
    tool_name: "CreatePlan",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
  }), opts), {});
  assert.deepEqual(evaluateCloseoutGuard(base({
    hook_event_name: "beforeSubmitPrompt",
    prompt: "/review-work",
  }), opts), {});
}

function reviewCall(overrides = {}) {
  return base({
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_closeout",
    tool_use_id: "review-call",
    tool_input: { artifact_kind: "work-review", check_evidence: [] },
    ...overrides,
  });
}

test("ordinary Cursor tools remain completely available during Review", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  try {
    establish(stateRoot);
    for (const [toolName, toolInput] of [
      ["Shell", { command: "ddev exec sh -lc 'npm test && custom-tool verify'" }],
      ["Task", { model: "any-project-model", prompt: "Review the repository." }],
      ["Edit", { path: "src/example.mjs" }],
      ["CompletelyUnknownProjectTool", { framework: "project-owned" }],
    ]) {
      assert.deepEqual(evaluateCloseoutGuard(base({ hook_event_name: "preToolUse", tool_name: toolName, tool_input: toolInput }), options(stateRoot)), {});
    }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("the exact Workflow Review call receives Root, workspace and opaque receipt without command evaluation", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  try {
    establish(stateRoot);
    const result = evaluateCloseoutGuard(base({
      hook_event_name: "preToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: { artifact_kind: "work-review", check_evidence: [] },
    }), options(stateRoot));
    assert.equal(result.permission, undefined);
    assert.equal(result.updated_input.root_plan_id, "wp-adaptive-retry");
    assert.equal(result.updated_input.workspace_root, defaultRoot);
    assert.match(result.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.doesNotMatch(JSON.stringify(result), /program-not-classified|unapproved-root-check|command mismatch/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("a failed Workflow transport can retry in the same selected Review turn", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  try {
    establish(stateRoot);
    const call = base({
      hook_event_name: "preToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_use_id: "review-call",
      tool_input: { artifact_kind: "work-review", check_evidence: [] },
    });
    const first = evaluateCloseoutGuard(call, options(stateRoot));
    evaluateCloseoutGuard({ ...call, hook_event_name: "postToolUseFailure" }, options(stateRoot));
    const second = evaluateCloseoutGuard(call, options(stateRoot));
    assert.match(second.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(second.updated_input.native_review_receipt, first.updated_input.native_review_receipt);
    assert.equal(second.updated_input.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("hook source contains no command, tool, or model policy", () => {
  const source = readFileSync(join(defaultRoot, "hooks", "closeout-guard.mjs"), "utf8");
  for (const forbidden of ["parseHostCommand", "runHostCheck", "program-not-classified", "unapproved-root-check", "model_pool", "modelCatalog"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("planning observation is passive and binds only the completed native CreatePlan", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-transcript-"));
  try {
    const transcript = join(transcriptRoot, "cursor-v6.jsonl");
    writeFileSync(transcript, `${[
      { role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Workflow 6", plan: rootPlan, todos: [] } }] } },
      { type: "turn_ended", status: "success" },
    ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    assert.deepEqual(evaluateCloseoutGuard(base({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "planning-generation",
      prompt: "/plan-work",
    }), options(stateRoot)), {});
    assert.deepEqual(evaluateCloseoutGuard(base({
      hook_event_name: "stop",
      generation_id: "planning-generation",
      transcript_path: transcript,
      status: "completed",
    }), options(stateRoot)), {});
    assert.deepEqual(evaluateCloseoutGuard(base({
      hook_event_name: "beforeSubmitPrompt",
      generation_id: "review-generation-after-stop",
      prompt: "/review-work",
    }), options(stateRoot)), {});
    const prepared = evaluateCloseoutGuard(reviewCall({ generation_id: "review-generation-after-stop" }), options(stateRoot));
    assert.equal(prepared.updated_input.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("recoverable observer loss restores only exact Review selection", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-transcript-"));
  try {
    evaluateCloseoutGuard(base({
      hook_event_name: "postToolUse",
      tool_name: "CreatePlan",
      generation_id: "plan-generation",
      tool_use_id: "create-plan-call",
      tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
    }), options(stateRoot));
    const transcript = join(transcriptRoot, "cursor-v6.jsonl");
    writeFileSync(transcript, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "/review-work" }] } })}\n`);
    const recovered = evaluateCloseoutGuard(reviewCall({ transcript_path: transcript }), options(stateRoot));
    assert.match(recovered.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(recovered.updated_input.root_plan_id, "wp-adaptive-retry");

    const otherState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-other-"));
    try {
      evaluateCloseoutGuard(base({
        hook_event_name: "postToolUse",
        tool_name: "CreatePlan",
        generation_id: "plan-generation",
        tool_use_id: "create-plan-call",
        tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
      }), options(otherState));
      writeFileSync(transcript, `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "not exact /review-work" }] } })}\n`);
      const denied = evaluateCloseoutGuard(reviewCall({ transcript_path: transcript }), options(otherState));
      assert.equal(denied.permission, "deny");
      assert.match(denied.user_message, /review-observer-unavailable/);
    } finally {
      rmSync(otherState, { recursive: true, force: true });
    }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
    rmSync(transcriptRoot, { recursive: true, force: true });
  }
});

test("targeted Review denials distinguish no Root, repository drift, and an inflight call", () => {
  const emptyState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-empty-"));
  const driftState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-drift-"));
  try {
    const noRoot = evaluateCloseoutGuard(reviewCall(), options(emptyState));
    assert.equal(noRoot.permission, "deny");
    assert.match(noRoot.user_message, /review-observer-unavailable|native-task-root-unavailable/);

    establish(driftState);
    let captures = 0;
    const driftOptions = {
      ...options(driftState),
      captureSnapshot: () => ({
        ...structuredClone(baseline),
        status_fingerprint: (++captures).toString(16).padStart(64, "0"),
      }),
    };
    evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work", generation_id: "drift-review" }), driftOptions);
    const drift = evaluateCloseoutGuard(reviewCall({ generation_id: "drift-review" }), driftOptions);
    assert.equal(drift.permission, "deny");
    assert.match(drift.user_message, /repository changed|repository-mutated/i);

    evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work", generation_id: "busy-review" }), options(driftState));
    assert.match(evaluateCloseoutGuard(reviewCall({ generation_id: "busy-review", tool_use_id: "first-call" }), options(driftState)).updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    const busy = evaluateCloseoutGuard(reviewCall({ generation_id: "busy-review", tool_use_id: "second-call" }), options(driftState));
    assert.equal(busy.permission, "deny");
    assert.match(busy.user_message, /already in flight|busy/i);
  } finally {
    rmSync(emptyState, { recursive: true, force: true });
    rmSync(driftState, { recursive: true, force: true });
  }
});

test("Review result and correction events remain lifecycle-only", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-"));
  try {
    establish(stateRoot);
    const call = reviewCall();
    const prepared = evaluateCloseoutGuard(call, options(stateRoot));
    assert.match(prepared.updated_input.native_review_receipt, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(evaluateCloseoutGuard({ ...call, hook_event_name: "postToolUse", tool_output: { content: [] } }, options(stateRoot)), {});
    assert.deepEqual(evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/correct-work", generation_id: "correction-generation" }), options(stateRoot)), {});
    assert.deepEqual(evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "ordinary prompt" }), options(stateRoot)), {});
    assert.deepEqual(evaluateCloseoutGuard(null, options(stateRoot)), {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Review guard converts native state contention and adapter failure into targeted denials", () => {
  const busyState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-busy-"));
  const invalidState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-invalid-adapter-"));
  try {
    establish(busyState);
    const conversation = hashWorkflowIdentifier("conversation", "cursor-v6");
    const lock = join(busyState, "manual-native-task-review", "locks", `${conversation}.lock`);
    mkdirSync(lock, { recursive: true });
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
      owner_token: "current-host-owner-token",
      pid: process.pid,
      acquired_at: new Date().toISOString(),
    })}\n`);
    const busy = evaluateCloseoutGuard(reviewCall(), { ...options(busyState), lockWaitMs: 1, lockPollMs: 1 });
    assert.equal(busy.permission, "deny");
    assert.match(busy.user_message, /busy|in flight/i);

    establish(invalidState);
    const invalid = evaluateCloseoutGuard(reviewCall(), { ...options(invalidState), now: () => Symbol("invalid-time") });
    assert.equal(invalid.permission, "deny");
    assert.match(invalid.user_message, /invalid/i);
  } finally {
    rmSync(busyState, { recursive: true, force: true });
    rmSync(invalidState, { recursive: true, force: true });
  }
});

test("Review guard CLI stays fail-open for valid, malformed, and oversized host input", () => {
  const hook = join(defaultRoot, "hooks", "closeout-guard.mjs");
  const run = (input, args = []) => spawnSync(process.execPath, [hook, ...args], { input, encoding: "utf8" });
  const valid = run(JSON.stringify({ hook_event_name: "preToolUse", tool_name: "Shell", tool_input: {} }));
  assert.equal(valid.status, 0);
  assert.equal(valid.stdout, "{}");
  const malformed = run("not-json", ["--enforce"]);
  assert.equal(malformed.status, 0);
  assert.equal(malformed.stdout, "{}");
  assert.match(malformed.stderr, /host action remains available/);
  const oversized = run("x".repeat(1024 * 1024 + 1));
  assert.equal(oversized.status, 0);
  assert.equal(oversized.stdout, "{}");
});

test("invalid, ambiguous, and caller-conflicting Root states get distinct Review denials", () => {
  const invalidState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-invalid-"));
  const ambiguousState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-ambiguous-"));
  const mismatchState = mkdtempSync(join(tmpdir(), "workflow-v6-hook-mismatch-"));
  try {
    evaluateCloseoutGuard(base({
      hook_event_name: "postToolUse",
      tool_name: "CreatePlan",
      generation_id: "plan-generation",
      tool_use_id: "invalid-plan-call",
      tool_input: { name: "Invalid", plan: "not a Workflow Root", todos: [] },
    }), options(invalidState));
    evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options(invalidState));
    const invalid = evaluateCloseoutGuard(reviewCall(), options(invalidState));
    assert.equal(invalid.permission, "deny");
    assert.match(invalid.user_message, /native-plan-root-invalid|native-task-root-unavailable/);

    const firstPlan = base({
      hook_event_name: "postToolUse",
      tool_name: "CreatePlan",
      generation_id: "same-generation",
      tool_use_id: "first-plan-call",
      tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
    });
    evaluateCloseoutGuard(firstPlan, options(ambiguousState));
    evaluateCloseoutGuard({
      ...firstPlan,
      tool_use_id: "second-plan-call",
      tool_input: { ...firstPlan.tool_input, plan: rootPlan.replace("wp-adaptive-retry", "wp-adaptive-retry-other") },
    }, options(ambiguousState));
    evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), options(ambiguousState));
    const ambiguous = evaluateCloseoutGuard(reviewCall(), options(ambiguousState));
    assert.equal(ambiguous.permission, "deny");
    assert.match(ambiguous.user_message, /workspace-ambiguous|Root.*invalid|native-task-root/i);

    establish(mismatchState);
    const mismatch = evaluateCloseoutGuard(reviewCall({
      tool_input: { artifact_kind: "work-review", root_plan_id: "caller-conflict", check_evidence: [] },
    }), options(mismatchState));
    assert.equal(mismatch.permission, "deny");
    assert.match(mismatch.user_message, /expected Root wp-adaptive-retry|receipt-mismatch/);
  } finally {
    rmSync(invalidState, { recursive: true, force: true });
    rmSync(ambiguousState, { recursive: true, force: true });
    rmSync(mismatchState, { recursive: true, force: true });
  }
});

test("workspace-derived state remains fail-open for ordinary events", () => {
  assert.deepEqual(evaluateCloseoutGuard(base({
    hook_event_name: "preToolUse",
    tool_name: "Shell",
    tool_input: { opaque_project_operation: true },
  }), { pluginRoot: defaultRoot }), {});
});

test("native Plan observer limitations remain precise at the Review boundary", () => {
  const scenarios = ["missing", "ambiguous-file", "invalid-transcript-root", "invalid-transcript"];
  for (const scenario of scenarios) {
    const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-observer-"));
    const planDirectory = mkdtempSync(join(tmpdir(), "workflow-v6-hook-plans-"));
    const transcriptRoot = mkdtempSync(join(tmpdir(), "workflow-v6-hook-transcript-"));
    try {
      const now = new Date();
      const observerOptions = { ...options(stateRoot), planDirectory, now: () => now };
      evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", generation_id: "planning-observer", prompt: "/plan-work" }), observerOptions);
      let transcriptPath;
      if (scenario === "ambiguous-file") {
        const source = `---\nname: Workflow 6\ntodos: []\n---\n${rootPlan}`;
        writeFileSync(join(planDirectory, "one.plan.md"), source);
        writeFileSync(join(planDirectory, "two.plan.md"), source);
      } else if (scenario === "invalid-transcript-root") {
        transcriptPath = join(transcriptRoot, "cursor-v6.jsonl");
        writeFileSync(transcriptPath, `${[
          { role: "assistant", message: { content: [{ type: "tool_use", name: "CreatePlan", input: { name: "Invalid", plan: "not a Root" } }] } },
          { type: "turn_ended", status: "success" },
        ].map((entry) => JSON.stringify(entry)).join("\n")}\n`);
      } else if (scenario === "invalid-transcript") {
        transcriptPath = join(transcriptRoot, "cursor-v6.jsonl");
        writeFileSync(transcriptPath, "not-json\n");
      }
      evaluateCloseoutGuard(base({
        hook_event_name: "stop",
        generation_id: "planning-observer",
        status: "completed",
        ...(transcriptPath ? { transcript_path: transcriptPath } : {}),
      }), observerOptions);
      evaluateCloseoutGuard(base({ hook_event_name: "beforeSubmitPrompt", prompt: "/review-work" }), observerOptions);
      const denied = evaluateCloseoutGuard(reviewCall(), observerOptions);
      assert.equal(denied.permission, "deny", scenario);
      const expected = scenario === "missing"
        ? /native-plan-root-unavailable/
        : scenario === "ambiguous-file"
          ? /native-plan-file-ambiguous/
          : scenario === "invalid-transcript-root"
            ? /native-plan-root-invalid/
            : /native-plan-transcript-invalid/;
      assert.match(denied.user_message, expected, scenario);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
      rmSync(planDirectory, { recursive: true, force: true });
      rmSync(transcriptRoot, { recursive: true, force: true });
    }
  }
});
