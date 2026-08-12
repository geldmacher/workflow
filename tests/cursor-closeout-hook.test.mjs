import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  evaluateCloseoutGuard,
  readActiveRootPlan,
  recordActiveRootPlan,
  stateRoots,
} from "../hooks/closeout-guard.mjs";
import { PLAN_CLOSEOUT_ATTESTATION } from "../src/core/manual-attestation.mjs";
import { loadManualCheckReceipts } from "../src/core/manual-check-receipts.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  TEST_ROOT_CONTENT_HASH,
  TEST_ROOT_CONTENT_HASH_CRLF,
  closeoutStructured,
  closeoutInputMessage,
  deliveryReportMessage,
  leanRoot,
  makeEvidence,
  sharedLifecycleCasesFor,
} from "./support/manual-attestation-fixtures.mjs";

const CLOSEOUT_TODO = Object.freeze({
  id: "STEP-closeout",
  content: "[workflow-model-inherit-v1] Verify required checks and close out delivery.",
  workflow_attestation: PLAN_CLOSEOUT_ATTESTATION,
  status: "completed",
});

function withState(run) {
  const stateRoot = mkdtempSync(join(tmpdir(), "cursor-closeout-"));
  try {
    return run(stateRoot);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}

function withActiveRoot(base, stateRoot, rootPlanId = "wp-retry", rootContentHash = TEST_ROOT_CONTENT_HASH) {
  recordActiveRootPlan(base, { rootPlanId, rootContentHash }, { stateRoot });
  return { stateRoot, activeRootPlanId: rootPlanId, activeRootContentHash: rootContentHash };
}

test("Cursor closeout guard records structuredContent and validates delivery-report follow-up", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-cursor", subjectId: "wp-retry" });
    const base = {
      conversation_id: "conv-1",
      generation_id: "gen-1",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const options = withActiveRoot(base, stateRoot);

    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: {
        structuredContent: closeoutStructured(artifact),
      },
    }, options);

    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: deliveryReportMessage("de-cursor"),
    }, options);

    const okStop = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
    }, options);
    assert.deepEqual(okStop, {});

    const artifact2 = makeEvidence({ id: "de-cursor-2" });
    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-2",
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: {
        structuredContent: closeoutStructured(artifact2),
      },
    }, options);

    const followUp = evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-2",
      hook_event_name: "stop",
      status: "completed",
      prompt: "Implement the plan",
    }, options);
    assert.match(String(followUp.followup_message ?? ""), /recovery follow-up|not an unbypassable hard stop/i);
    assert.match(String(followUp.followup_message ?? ""), /delivery-report|workflow-attestation/i);
  });
});

test("Cursor closeout guard invalidates recorded closeout after a mutating tool", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-mutate" });
    const base = {
      conversation_id: "conv-mutate",
      generation_id: "gen-mutate",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const options = withActiveRoot(base, stateRoot);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: { structuredContent: closeoutStructured(artifact) },
    }, options);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: deliveryReportMessage("de-mutate"),
    }, options);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "Shell",
      tool_input: { command: "touch dirty" },
    }, options);
    const followUp = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
    }, options);
    assert.match(String(followUp.followup_message ?? ""), /recovery follow-up/i);
  });
});

test("Cursor closeout guard rejects foreign Root self-binding", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-foreign", rootPlanId: "wp-other", subjectId: "wp-other" });
    const base = {
      conversation_id: "conv-foreign",
      generation_id: "gen-foreign",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const options = withActiveRoot(base, stateRoot, "wp-retry");
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-other" },
      tool_output: { structuredContent: closeoutStructured(artifact) },
    }, options);
    const followUp = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
      prompt: "Implement the plan",
    }, options);
    assert.match(String(followUp.followup_message ?? ""), /recovery follow-up/i);
  });
});

test("Cursor closeout guard accepts string tool payloads and rejects incomplete identity", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-string" });
    const base = {
      conversation_id: "conv-string",
      generation_id: "gen-string",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const options = withActiveRoot(base, stateRoot);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: JSON.stringify({ root_plan_id: "wp-retry" }),
      tool_output: JSON.stringify({
        structuredContent: closeoutStructured(artifact),
      }),
    }, options);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: deliveryReportMessage("de-string"),
    }, options);
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
    }, options), {});

    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-bad",
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: { structuredContent: { delivery_evidence_id: "de-bad" } },
    }, options);
    const blocked = evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-bad",
      hook_event_name: "stop",
      status: "completed",
      prompt: "/close-work",
    }, options);
    assert.match(String(blocked.followup_message ?? ""), /recovery follow-up/i);
  });
});

test("Cursor closeout guard ignores non-completed stops and non-closeout tools", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-ignore",
      generation_id: "gen-ignore",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "Read",
      tool_input: { path: "README.md" },
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: "no closeout required",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "aborted",
      prompt: "Implement the plan",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard(null, { stateRoot }), {});
  });
});

test("Cursor closeout guard does not hijack an unrelated Ask turn with stale Root state", () => {
  withState((stateRoot) => {
    const prior = {
      conversation_id: "conv-prior-plan",
      generation_id: "gen-prior-plan",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    recordActiveRootPlan(prior, {
      rootPlanId: "wp-decouple-plugin-refs",
      rootContentHash: TEST_ROOT_CONTENT_HASH,
      phase: "implementation",
    }, { stateRoot });

    const current = {
      conversation_id: "conv-gitlab-issue",
      generation_id: "gen-gitlab-issue",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...current,
      hook_event_name: "beforeSubmitPrompt",
      prompt: "Review GitLab work item #18 and explain the result.",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...current,
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "glab issue view 18" },
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...current,
      hook_event_name: "afterAgentResponse",
      text: "GitLab OAuth is blocked by invalid_grant; no closeout-input belongs to this task.",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...current,
      hook_event_name: "stop",
      status: "completed",
    }, { stateRoot }), {});
    assert.equal(readActiveRootPlan(current, { stateRoot }), null);
  });
});

test("Cursor closeout guard requires a current Workflow turn even when this conversation has an older Root", () => {
  withState((stateRoot) => {
    const prior = {
      conversation_id: "conv-reused",
      generation_id: "gen-plan",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    recordActiveRootPlan(prior, {
      rootPlanId: "wp-decouple-plugin-refs",
      rootContentHash: TEST_ROOT_CONTENT_HASH,
      phase: "implementation",
    }, { stateRoot });

    const current = { ...prior, generation_id: "gen-unrelated-ask" };
    evaluateCloseoutGuard({
      ...current,
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "glab issue view 18" },
    }, { stateRoot });
    evaluateCloseoutGuard({
      ...current,
      hook_event_name: "afterAgentResponse",
      text: "No issue data is available because OAuth returned invalid_grant.",
    }, { stateRoot });
    assert.deepEqual(evaluateCloseoutGuard({
      ...current,
      hook_event_name: "stop",
      status: "completed",
    }, { stateRoot }), {});
  });
});

test("Cursor closeout guard covers transport unwrap and missing active Root", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-transport" });
    const base = {
      conversation_id: "conv-transport",
      generation_id: "gen-transport",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: "{not-json",
      tool_output: "also-not-json",
    }, { stateRoot });
    const missingRoot = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
      prompt: "/close-work",
    }, { stateRoot });
    assert.match(String(missingRoot.followup_message ?? ""), /no bound Schema-5 Root|no .*Root.*current task/i);
    assert.doesNotMatch(String(missingRoot.followup_message ?? ""), /Call workflow_closeout|closeout-input/i);
    assert.doesNotMatch(String(missingRoot.followup_message ?? ""), /```yaml workflow-attestation|kind:\s*delivery-report|de-\*/i);

    const options = withActiveRoot(base, stateRoot);
    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-response",
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_response: { structuredContent: closeoutStructured(artifact) },
    }, options);
    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-result-json",
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: JSON.stringify({ root_plan_id: "wp-retry" }),
      result_json: JSON.stringify({ structuredContent: closeoutStructured(makeEvidence({ id: "de-result" })) }),
    }, options);
    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-result-json",
      hook_event_name: "afterAgentResponse",
      text: deliveryReportMessage("de-result"),
    }, options);
    evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-result-json",
      hook_event_name: "postToolUse",
      tool_name: "ApplyPatch",
      tool_input: { patch: "x" },
    }, options);
    const afterPatch = evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-result-json",
      hook_event_name: "stop",
      status: "completed",
    }, options);
    assert.match(String(afterPatch.followup_message ?? ""), /recovery follow-up/i);
  });
});

test("Cursor closeout guard CLI fails closed on malformed input", () => {
  const hookPath = join(defaultRoot, "hooks", "closeout-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], {
    input: "not-json",
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout || "{}");
  assert.match(String(payload.followup_message ?? ""), /failed closed|unavailable|delivery-report/i);
});

test("Cursor closeout guard CLI accepts a valid stop with no pending turn", () => {
  const hookPath = join(defaultRoot, "hooks", "closeout-guard.mjs");
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({
      hook_event_name: "stop",
      status: "completed",
      conversation_id: "cli-conv",
      generation_id: "cli-gen",
      workspace_roots: ["/tmp/cursor-closeout-cli"],
    }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout || "{}"), {});
});

test("shared lifecycle matrix executes on the Cursor surface", () => {
  const executed = [];
  const cases = sharedLifecycleCasesFor("cursor");
  for (const entry of cases) {
    executed.push(entry.id);
    withState((stateRoot) => {
      const base = {
        conversation_id: `conv-${entry.id}`,
        generation_id: `gen-${entry.id}`,
        workspace_roots: ["/tmp/cursor-closeout-workspace"],
      };
      const stopFollowUp = (options) => evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
        prompt: "Implement the plan",
      }, options);

      if (entry.id === "missing-active-root") {
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: { structuredContent: closeoutStructured(makeEvidence({ id: "de-missing-root" })) },
        }, { stateRoot });
        const message = String(stopFollowUp({ stateRoot }).followup_message ?? "");
        assert.match(message, /no bound Schema-5 Root|no .*Root.*current task/i);
        assert.doesNotMatch(message, /Call workflow_closeout|closeout-input/i);
        assert.doesNotMatch(message, /```yaml workflow-attestation|kind:\s*delivery-report|de-\*/i);
        return;
      }
      const options = withActiveRoot(base, stateRoot);
      if (entry.id === "foreign-active-root") {
        const artifact = makeEvidence({ id: "de-foreign-root", rootPlanId: "wp-other", subjectId: "wp-other" });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-other" },
          tool_output: { structuredContent: closeoutStructured(artifact) },
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "same-id-root-hash-mismatch" || entry.id === "crlf-active-root-hash-mismatch") {
        const hash = entry.id === "crlf-active-root-hash-mismatch"
          ? TEST_ROOT_CONTENT_HASH_CRLF
          : "0".repeat(64);
        const activeOptions = entry.id === "crlf-active-root-hash-mismatch"
          ? withActiveRoot(base, stateRoot, "wp-retry", TEST_ROOT_CONTENT_HASH)
          : options;
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: {
            structuredContent: closeoutStructured(makeEvidence({ id: "de-hash" }), {
              root_content_hash: hash,
            }),
          },
        }, activeOptions);
        assert.match(String(stopFollowUp(activeOptions).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "mutate-after-closeout") {
        const artifact = makeEvidence({ id: "de-matrix-mutate" });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: { structuredContent: closeoutStructured(artifact) },
        }, options);
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "afterAgentResponse",
          text: deliveryReportMessage("de-matrix-mutate"),
        }, options);
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "Task",
          tool_input: { prompt: "mutate" },
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "persisted-artifact-dump") {
        const artifact = makeEvidence({ id: "de-matrix-dump" });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: { structuredContent: closeoutStructured(artifact) },
        }, options);
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "afterAgentResponse",
          text: deliveryReportMessage("de-matrix-dump", { artifact }),
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "foreign-full-root-lineage") {
        const correction = makeEvidence({
          id: "de-cursor-lineage",
          subjectId: "cp-retry",
          sourceReviewId: "wr-retry",
          predecessorEvidenceId: "de-prior",
          representation: "delta",
        });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: { structuredContent: closeoutStructured(correction) },
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "text-transport-authority") {
        const artifact = makeEvidence({ id: "de-cursor-text" });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: {
            content: [{ text: JSON.stringify({ structuredContent: closeoutStructured(artifact) }) }],
          },
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "conflicting-structured-content") {
        const artifact = makeEvidence({ id: "de-cursor-conflict" });
        const structured = closeoutStructured(artifact);
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: {
            content: [
              { structuredContent: structured },
              { structuredContent: { ...structured, delivery_evidence_id: "de-other" } },
            ],
          },
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      if (entry.id === "unpersisted-duplicate-occurrence") {
        const artifact = makeEvidence({ id: "de-cursor-dup" });
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "postToolUse",
          tool_name: "MCP:workflow_closeout",
          tool_input: { root_plan_id: "wp-retry" },
          tool_output: {
            structuredContent: closeoutStructured(artifact, { handoff_persisted: false }),
          },
        }, options);
        const message = `${deliveryReportMessage("de-cursor-dup")}\n\`\`\`yaml\n${artifact}\`\`\`\n\`\`\`yaml\n${artifact}\`\`\`\n`;
        evaluateCloseoutGuard({
          ...base,
          hook_event_name: "afterAgentResponse",
          text: message,
        }, options);
        assert.match(String(stopFollowUp(options).followup_message ?? ""), /recovery follow-up/i);
        return;
      }
      assert.fail(`unhandled shared lifecycle case: ${entry.id}`);
    });
  }
  assert.deepEqual(executed, cases.map((entry) => entry.id));
});

test("Cursor closeout guard permits native delivery-closeout todos but keeps legacy MCP todo gating", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-todo-gate",
      generation_id: "gen-todo-gate",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
      prompt: "Implement the plan",
    };
    const options = withActiveRoot(base, stateRoot);
    const nativePending = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      tool_name: "TodoWrite",
      tool_input: { merge: true, todos: [CLOSEOUT_TODO] },
    }, options);
    assert.deepEqual(nativePending, {});

    const legacyTodo = {
      ...CLOSEOUT_TODO,
      workflow_attestation: { schema: 1, kind: "plan-closeout", action: "workflow_closeout" },
    };
    const denied = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      tool_name: "TodoWrite",
      tool_input: { merge: true, todos: [legacyTodo] },
    }, options);
    assert.equal(denied.permission, "deny");
    assert.match(String(denied.user_message ?? ""), /cannot be marked completed before workflow_closeout/i);

    const artifact = makeEvidence({ id: "de-todo-gate" });
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: { structuredContent: closeoutStructured(artifact) },
    }, options);
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      tool_name: "TodoWrite",
      tool_input: { merge: true, todos: [CLOSEOUT_TODO] },
    }, options), {});
  });
});

test("Cursor closeout stop without a bound Root stays silent", () => {
  withState((stateRoot) => {
    assert.deepEqual(evaluateCloseoutGuard({
      conversation_id: "conv-stop-missing",
      generation_id: "gen-stop-missing",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
      hook_event_name: "stop",
      status: "completed",
      prompt: "Implement the plan",
    }, { stateRoot }), {});
  });
});

test("Cursor closeout guard records lean Evidence despite interpretative normalizations", () => {
  withState((stateRoot) => {
    const artifact = makeEvidence({ id: "de-lean-norm" })
      .replace("evidence_mode: full", "evidence_mode: lean")
      .replace(/\nstrategy_revision: 1\n/, "\n")
      .replace(/\n    baseline_or_patched: patched\n/g, "\n");
    const base = {
      conversation_id: "conv-lean-norm",
      generation_id: "gen-lean-norm",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const options = withActiveRoot(base, stateRoot);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: {
        structuredContent: closeoutStructured(artifact, {
          artifact_hash: createHash("sha256").update(artifact, "utf8").digest("hex"),
        }),
      },
    }, options);
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: deliveryReportMessage("de-lean-norm"),
    }, options);
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
    }, options), {});
  });
});

test("Cursor closeout guard records active Root from Implement Plan prompts", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-active-root-prompt",
      generation_id: "gen-active-root-prompt",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    const envelope = [
      "Implement the plan as specified.",
      "",
      "```yaml artifact-envelope",
      leanRoot.replace(/^---\n/, "").replace(/\n---\n[\s\S]*$/, ""),
      "```",
      "",
      "## Intent",
      "",
      "Add retries for transient MCP tool failures.",
    ].join("\n");
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: envelope,
    }, { stateRoot }), {});
    const active = readActiveRootPlan(base, { stateRoot });
    assert.equal(active?.root_plan_id, "wp-retry");
    assert.match(String(active?.root_content_hash ?? ""), /^[a-f0-9]{64}$/);
  });
});

test("Cursor lifecycle closes out from one native report without an MCP call", () => {
  withState((stateRoot) => {
    const temporary = mkdtempSync(join(tmpdir(), "cursor-native-closeout-"));
    const repository = join(temporary, "repository");
    try {
      mkdirSync(join(repository, "src"), { recursive: true });
      writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
      for (const args of [
        ["init", "--quiet"],
        ["add", "src/retry.mjs"],
        ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"],
      ]) {
        const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      }
      const base = {
        conversation_id: "conv-native-closeout",
        generation_id: "gen-native-closeout",
        workspace_roots: [repository],
      };
      const options = {
        stateRoot,
        handoffOptions: { baseRoot: join(temporary, "handoff") },
        receiptOptions: { baseRoot: join(temporary, "receipts") },
      };
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: `Implement the Plan\n\n${leanRoot}`,
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { path: "src/retry.mjs" },
      }, options);
      writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Shell",
        tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "postToolUse",
        tool_name: "Shell",
        tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
        tool_output: { exit_code: 0, output: "Focused Codex hook policy tests pass.\n" },
      }, options);
      assert.equal(loadManualCheckReceipts({
        rootPlanText: leanRoot,
        pluginRoot: defaultRoot,
        workspaceRoot: repository,
        options: options.receiptOptions,
      }).length, 1);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Shell",
        tool_input: { command: "git status --short" },
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "postToolUse",
        tool_name: "Shell",
        tool_input: { command: "git status --short" },
        tool_output: { exit_code: 0, output: "" },
      }, options);
      assert.equal(loadManualCheckReceipts({
        rootPlanText: leanRoot,
        pluginRoot: defaultRoot,
        workspaceRoot: repository,
        options: options.receiptOptions,
      }).length, 1);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "afterAgentResponse",
        text: closeoutInputMessage(),
      }, options);
      assert.equal(loadManualCheckReceipts({
        rootPlanText: leanRoot,
        pluginRoot: defaultRoot,
        workspaceRoot: repository,
        options: options.receiptOptions,
      }).length, 0);
      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
      }, options), {});
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "postToolUse",
        tool_name: "Edit",
        tool_input: { path: "src/retry.mjs" },
      }, options);
      const invalidated = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
      }, options);
      assert.match(String(invalidated.followup_message ?? ""), /recovery follow-up|closeout attestation is incomplete/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});

test("Cursor review recovery hydrates missing Evidence through one read-only continuation", () => {
  withState((stateRoot) => {
    const temporary = mkdtempSync(join(tmpdir(), "cursor-review-recovery-"));
    const repository = join(temporary, "repository");
    try {
      mkdirSync(join(repository, "src"), { recursive: true });
      writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
      for (const args of [
        ["init", "--quiet"],
        ["add", "src/retry.mjs"],
        ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"],
      ]) {
        const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      }
      writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
      const base = {
        conversation_id: "conv-review-recovery",
        generation_id: "gen-review-recovery",
        workspace_roots: [repository],
      };
      const options = {
        stateRoot,
        handoffOptions: { baseRoot: join(temporary, "handoff") },
      };
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: `Implement the Plan\n\n${leanRoot}`,
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: "/review-work wp-retry",
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "afterAgentResponse",
        text: closeoutInputMessage({ phase: "review-recovery" }),
      }, options);
      const recovery = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
      }, options);
      assert.match(String(recovery.followup_message ?? ""), /recovered and persisted exact Evidence|read-only review once/i);
      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
      }, options), {});
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});

test("Cursor closeout guard covers literal Root, fallback roots, merge todos, and unknown events", () => {
  withState((stateRoot) => {
    assert.equal(stateRoots({ cwd: stateRoot }).length, 1);
    assert.equal(stateRoots({}, { cwd: stateRoot }).length, 1);
    const base = {
      conversation_id: "conv-fallback-branches",
      generation_id: "gen-fallback-branches",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `${leanRoot}\n\n[workflow-model-inherit-v1]`,
    }, { stateRoot }), {});
    assert.equal(readActiveRootPlan(base, { stateRoot })?.root_plan_id, "wp-retry");
    const denied = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "preToolUse",
      tool_name: "TodoWrite",
      tool_input: { merge: [CLOSEOUT_TODO] },
    }, { stateRoot });
    assert.deepEqual(denied, {});
    assert.deepEqual(evaluateCloseoutGuard({ ...base, hook_event_name: "futureEvent" }, { stateRoot }), {});
  });
});
