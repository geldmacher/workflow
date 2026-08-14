import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  evaluateCloseoutGuard,
  readActiveRootPlan,
  readManualChain,
  recordActiveRootPlan,
  stateRoots,
  updateManualChain,
} from "../hooks/closeout-guard.mjs";
import { PLAN_CLOSEOUT_ATTESTATION } from "../src/core/manual-attestation.mjs";
import { loadManualCheckReceipts } from "../src/core/manual-check-receipts.mjs";
import { createContentAddressedHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";
import {
  TEST_ROOT_CONTENT_HASH,
  TEST_ROOT_CONTENT_HASH_CRLF,
  closeoutStructured,
  closeoutInputMessage,
  correctionReviewArtifact,
  deliveryReportMessage,
  evidenceHash,
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

function chainValidEvidence(options = {}) {
  return makeEvidence(options).replace(/^intent_hash: .*$/m, `intent_hash: ${executionContractFromArtifactText(leanRoot, defaultRoot).authoritative_projection_hash}`);
}

function reviewInputMessage(overrides = {}) {
  return `\`\`\`json workflow-review-input\n${JSON.stringify({
    schema: 1,
    kind: "review-input",
    assessment: "provisional",
    recommended_action: "accept-provisional",
    assessment_summary: "The exact Evidence remains explicitly provisional.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The reviewed snapshot matches the exact Evidence tip.",
    findings: [],
    missing_evidence: [],
    auditor_reports: [],
    ...overrides,
  })}\n\`\`\``;
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
    assert.deepEqual(followUp, {});
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

test("Cursor closeout guard rejects malformed Implement Plan Roots and records one exact valid Root", () => {
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
    const malformed = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: envelope,
    }, { stateRoot });
    assert.equal(malformed.permission, "deny");
    assert.match(malformed.user_message, /missing required section Acceptance/);
    assert.equal(readActiveRootPlan(base, { stateRoot }), null);
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Please implement this plan.\n\n${leanRoot}`,
    }, { stateRoot }), {});
    const active = readActiveRootPlan(base, { stateRoot });
    assert.equal(active?.root_plan_id, "wp-retry");
    assert.match(String(active?.root_content_hash ?? ""), /^[a-f0-9]{64}$/);
  });
});

test("Cursor implementation blocks missing Root, baseline failure, and direct out-of-authority paths before mutation", () => {
  withState((stateRoot) => {
    const repository = mkdtempSync(join(tmpdir(), "cursor-authority-gate-"));
    try {
      mkdirSync(join(repository, "src"), { recursive: true });
      const base = {
        conversation_id: "conv-authority-gate",
        generation_id: "gen-authority-gate",
        workspace_roots: [repository],
      };
      const missing = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: "Please implement this plan.",
      }, { stateRoot });
      assert.equal(missing.permission, "deny");
      assert.match(missing.user_message, /Plan required/);

      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: `Please implement this plan.\n\n${leanRoot}`,
      }, { stateRoot }), {});
      const baselineFailure = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: join(repository, "src/retry.mjs") },
      }, {
        stateRoot,
        captureRepositorySnapshot: () => { throw new Error("snapshot unavailable"); },
      });
      assert.equal(baselineFailure.permission, "deny");
      assert.match(baselineFailure.user_message, /baseline could not be captured.*snapshot unavailable/i);

      const secondBase = { ...base, conversation_id: "conv-authority-path", generation_id: "gen-authority-path" };
      assert.deepEqual(evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "beforeSubmitPrompt",
        prompt: `Implement the plan.\n\n${leanRoot}`,
      }, { stateRoot }), {});
      const capture = () => ({ repository_root: repository, snapshot_id: "baseline" });
      const outside = evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: join(repository, "outside.txt") },
      }, { stateRoot, captureRepositorySnapshot: capture });
      assert.equal(outside.permission, "deny");
      assert.match(outside.user_message, /outside Root authority/);
      const outsidePatch = evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "ApplyPatch",
        tool_input: "*** Begin Patch\n*** Add File: outside-patch.txt\n+blocked\n*** End Patch",
      }, { stateRoot, captureRepositorySnapshot: capture });
      assert.equal(outsidePatch.permission, "deny");
      assert.match(outsidePatch.user_message, /outside Root authority/);
      const traversal = evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "src/../outside-traversal.txt" },
      }, { stateRoot, captureRepositorySnapshot: capture });
      assert.equal(traversal.permission, "deny");
      assert.match(traversal.user_message, /outside Root authority/);
      const moveDestination = evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "ApplyPatch",
        tool_input: "*** Begin Patch\n*** Update File: src/retry.mjs\n*** Move to: outside-move.mjs\n*** End Patch",
      }, { stateRoot, captureRepositorySnapshot: capture });
      assert.equal(moveDestination.permission, "deny");
      assert.match(moveDestination.user_message, /outside Root authority/);
      writeFileSync(join(repository, "outside-target.txt"), "protected\n");
      symlinkSync("../outside-target.txt", join(repository, "src/link.txt"));
      const symlinkDestination = evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "src/link.txt" },
      }, { stateRoot, captureRepositorySnapshot: capture });
      assert.equal(symlinkDestination.permission, "deny");
      assert.match(symlinkDestination.user_message, /outside Root authority/);
      assert.deepEqual(evaluateCloseoutGuard({
        ...secondBase,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: join(repository, "src/retry.mjs") },
      }, { stateRoot, captureRepositorySnapshot: capture }), {});
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});

test("Cursor Review is read-only and correction selector stays bound to the exact Root", () => {
  withState((stateRoot) => {
    const repository = mkdtempSync(join(tmpdir(), "cursor-review-write-gate-"));
    try {
      mkdirSync(join(repository, "src"), { recursive: true });
      const base = {
        conversation_id: "conv-review-write-gate",
        generation_id: "gen-review-write-gate",
        workspace_roots: [repository],
      };
      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: `Implement the plan.\n\n${leanRoot}`,
      }, { stateRoot }), {});
      const correctionMismatch = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: "/correct-work wp-other",
      }, { stateRoot });
      assert.equal(correctionMismatch.permission, "deny");
      assert.match(correctionMismatch.user_message, /wp-other.*task-bound Root wp-retry/i);

      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "beforeSubmitPrompt",
        prompt: "/review-work wp-retry",
      }, { stateRoot }), {});
      const deniedEdit = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "src/retry.mjs" },
      }, { stateRoot });
      assert.equal(deniedEdit.permission, "deny");
      assert.match(deniedEdit.user_message, /Review is repository-read-only/);
      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Shell",
        tool_input: { command: "git diff -- src/retry.mjs" },
      }, { stateRoot }), {});
      const unprotectedAuditor = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Task",
        tool_input: {
          subagent_type: "delivery-auditor",
          prompt: "[workflow-readonly-review-v1] Inspect only.",
        },
      }, { stateRoot });
      assert.equal(unprotectedAuditor.permission, "deny");
      assert.deepEqual(evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Task",
        tool_input: {
          subagent_type: "delivery-auditor",
          readonly: true,
          prompt: "[workflow-readonly-review-v1] Inspect only.",
        },
      }, { stateRoot }), {});
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
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
      const base = {
        conversation_id: "conv-review-recovery",
        generation_id: "gen-review-recovery-implementation",
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
        hook_event_name: "preToolUse",
        tool_name: "Edit",
        tool_input: { path: "src/retry.mjs" },
      }, options);
      writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
      evaluateCloseoutGuard({
        ...base,
        generation_id: "gen-review-recovery-review",
        hook_event_name: "beforeSubmitPrompt",
        prompt: "/review-work wp-retry",
      }, options);
      evaluateCloseoutGuard({
        ...base,
        generation_id: "gen-review-recovery-review",
        hook_event_name: "afterAgentResponse",
        text: closeoutInputMessage({ phase: "review-recovery" }),
      }, options);
      const recovery = evaluateCloseoutGuard({
        ...base,
        generation_id: "gen-review-recovery-review",
        hook_event_name: "stop",
        status: "completed",
      }, options);
      assert.match(String(recovery.followup_message ?? ""), /recovered and persisted exact Evidence|read-only review once/i);
      const continuation = {
        ...base,
        generation_id: "gen-review-recovery-continuation",
      };
      assert.deepEqual(evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "beforeSubmitPrompt",
        prompt: recovery.followup_message,
      }, options), {});
      const evidenceId = readManualChain(continuation, options).current_evidence.delivery_evidence_id;
      assert.deepEqual(evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "afterAgentResponse",
        text: reviewInputMessage(),
      }, options), {});
      assert.deepEqual(evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "stop",
        status: "completed",
        loop_count: 1,
      }, options), {});
      const completed = readManualChain(continuation, options);
      assert.ok(completed.current_review, JSON.stringify(completed, null, 2));
      assert.match(completed.current_review.review_artifact_id, /^wr-retry-[a-f0-9]{12}$/);
      assert.equal(completed.current_review.builder_provenance?.kind, "host-work-review-builder");
      assert.equal(completed.phase_status, "review-complete");
      assert.equal(completed.pending_continuation, null);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});

test("Cursor internal closeout and Review commit one Root-scoped chain across generations", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-fast-review",
      generation_id: "gen-fast-implementation",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Implement the Plan\n\n${leanRoot}`,
    }, { stateRoot }), {});
    const artifact = chainValidEvidence({ id: "de-fast-review" });
    const reviewBase = { ...base, generation_id: "gen-fast-review" };
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "beforeSubmitPrompt",
      prompt: "/review-work wp-retry",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: { structuredContent: closeoutStructured(artifact) },
    }, { stateRoot }), {});
    const auditorToolInput = {
      subagent_type: "delivery-auditor",
      readonly: true,
      prompt: "[workflow-readonly-review-v1] Inspect the exact Root and Evidence read-only.",
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "preToolUse",
      tool_name: "Task",
      tool_input: auditorToolInput,
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "postToolUse",
      tool_name: "Task",
      tool_input: auditorToolInput,
      tool_output: { status: "completed", result: "No remaining delivery gap." },
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "afterAgentResponse",
      text: reviewInputMessage({
        assessment: "achieved",
        recommended_action: "none",
        assessment_summary: "The exact verified Evidence satisfies the Root.",
        auditor_reports: [{ role: "delivery-auditor", assessment: "achieved", summary: "The host-observed delivery auditor found no remaining gap." }],
      }),
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...reviewBase,
      hook_event_name: "stop",
      status: "completed",
    }, { stateRoot }), {});
    const chain = readManualChain(reviewBase, { stateRoot });
    assert.equal(chain.root.root_plan_id, "wp-retry");
    assert.equal(chain.current_evidence.delivery_evidence_id, "de-fast-review");
    assert.match(chain.current_review.review_artifact_id, /^wr-retry-[a-f0-9]{12}$/);
    assert.equal(chain.current_review.builder_provenance?.kind, "host-work-review-builder");
    assert.match(chain.current_review.review_artifact, /review_route: targeted/);
    assert.match(chain.current_review.review_artifact, /- delivery-auditor/);
    assert.equal(chain.phase_status, "review-complete");
    const ordinaryWrite = {
      ...reviewBase,
      generation_id: "gen-write-after-complete-review",
      tool_name: "Edit",
      tool_input: { path: "src/unrelated.mjs" },
    };
    assert.deepEqual(evaluateCloseoutGuard({ ...ordinaryWrite, hook_event_name: "preToolUse" }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({ ...ordinaryWrite, hook_event_name: "postToolUse" }, { stateRoot }), {});
    const unchanged = readManualChain(reviewBase, { stateRoot });
    assert.equal(unchanged.revision, chain.revision);
    assert.equal(unchanged.current_evidence.delivery_evidence_hash, chain.current_evidence.delivery_evidence_hash);
    assert.equal(unchanged.current_review.review_artifact_hash, chain.current_review.review_artifact_hash);
    assert.equal(unchanged.phase_status, "review-complete");
  });
});

test("Cursor gives malformed Review input exactly one plain same-task repair", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-review-input-repair",
      generation_id: "gen-review-input-repair",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    evaluateCloseoutGuard({ ...base, hook_event_name: "beforeSubmitPrompt", prompt: `Implement the Plan\n\n${leanRoot}` }, { stateRoot });
    evaluateCloseoutGuard({ ...base, hook_event_name: "beforeSubmitPrompt", prompt: "/review-work wp-retry" }, { stateRoot });
    const evidence = chainValidEvidence({ id: "de-review-input-repair" });
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "postToolUse",
      tool_name: "MCP:workflow_closeout",
      tool_input: { root_plan_id: "wp-retry" },
      tool_output: { structuredContent: closeoutStructured(evidence) },
    }, { stateRoot });
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "afterAgentResponse",
      text: "```json workflow-review-input\n{bad}\n```",
    }, { stateRoot });
    const recovery = evaluateCloseoutGuard({ ...base, hook_event_name: "stop", status: "completed" }, { stateRoot });
    assert.match(recovery.followup_message, /could not be read/i);
    assert.match(recovery.followup_message, /Root, Evidence, and repository work are preserved/i);
    assert.match(recovery.followup_message, /same task/i);

    const continuation = { ...base, generation_id: "gen-review-input-repair-continuation" };
    assert.deepEqual(evaluateCloseoutGuard({ ...continuation, hook_event_name: "beforeSubmitPrompt", prompt: recovery.followup_message }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({ ...continuation, hook_event_name: "afterAgentResponse", text: reviewInputMessage({ assessment: "achieved", recommended_action: "none" }) }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({ ...continuation, hook_event_name: "stop", status: "completed", loop_count: 1 }, { stateRoot }), {});
    assert.equal(readManualChain(continuation, { stateRoot }).phase_status, "review-complete");
  });
});

test("Cursor terminalizes a second failed Stop and leaves later ordinary prompts quiet", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-terminal-stop",
      generation_id: "gen-terminal-stop",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Implement the Plan\n\n${leanRoot}`,
    }, { stateRoot });
    const first = evaluateCloseoutGuard({ ...base, hook_event_name: "stop", status: "completed" }, { stateRoot });
    assert.match(String(first.followup_message ?? ""), /closeout attestation is incomplete/i);
    const continuation = {
      ...base,
      generation_id: "gen-terminal-stop-continuation",
    };
    assert.deepEqual(evaluateCloseoutGuard({
      ...continuation,
      hook_event_name: "beforeSubmitPrompt",
      prompt: first.followup_message,
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...continuation,
      hook_event_name: "afterAgentResponse",
      text: "The closeout observation remains unavailable.",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...continuation,
      hook_event_name: "stop",
      status: "completed",
      loop_count: 1,
    }, { stateRoot }), {});
    assert.equal(readManualChain(base, { stateRoot }).phase_status, "terminal-blocked");
    assert.equal(readManualChain(base, { stateRoot }).pending_continuation, null);
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-ordinary-after-terminal",
      hook_event_name: "beforeSubmitPrompt",
      prompt: "Explain this module without changing it.",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-ordinary-after-terminal",
      hook_event_name: "stop",
      status: "completed",
    }, { stateRoot }), {});
    const terminal = readManualChain(base, { stateRoot });
    const ordinaryWrite = {
      ...base,
      generation_id: "gen-write-after-terminal",
      tool_name: "Edit",
      tool_input: { path: "src/unrelated.mjs" },
    };
    assert.deepEqual(evaluateCloseoutGuard({ ...ordinaryWrite, hook_event_name: "preToolUse" }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({ ...ordinaryWrite, hook_event_name: "postToolUse" }, { stateRoot }), {});
    const unchanged = readManualChain(base, { stateRoot });
    assert.equal(unchanged.revision, terminal.revision);
    assert.deepEqual(unchanged.terminal_diagnostic, terminal.terminal_diagnostic);
    assert.equal(unchanged.phase_status, "terminal-blocked");
  });
});

test("a genuine human prompt supersedes one generated Cursor continuation without stale enforcement", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-human-supersedes-recovery",
      generation_id: "gen-human-supersedes-recovery",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Implement the Plan\n\n${leanRoot}`,
    }, { stateRoot });
    const recovery = evaluateCloseoutGuard({
      ...base,
      hook_event_name: "stop",
      status: "completed",
      loop_count: 0,
    }, { stateRoot });
    assert.ok(recovery.followup_message);

    const ordinary = { ...base, generation_id: "gen-human-ordinary" };
    assert.deepEqual(evaluateCloseoutGuard({
      ...ordinary,
      hook_event_name: "beforeSubmitPrompt",
      prompt: "Explain the retry module without changing it.",
    }, { stateRoot }), {});
    const terminal = readManualChain(ordinary, { stateRoot });
    assert.equal(terminal.phase_status, "terminal-blocked");
    assert.equal(terminal.pending_continuation, null);
    assert.equal(terminal.terminal_diagnostic.code, "closeout-recovery-superseded");
    assert.deepEqual(evaluateCloseoutGuard({
      ...ordinary,
      hook_event_name: "stop",
      status: "completed",
    }, { stateRoot }), {});
    assert.deepEqual(evaluateCloseoutGuard({
      ...ordinary,
      hook_event_name: "preToolUse",
      tool_name: "Read",
      tool_input: { path: "src/retry.mjs" },
    }, { stateRoot }), {});

    const interrupted = {
      ...base,
      conversation_id: "conv-human-interrupts-consumed-recovery",
      generation_id: "gen-interrupted-source",
    };
    evaluateCloseoutGuard({
      ...interrupted,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Implement the Plan\n\n${leanRoot}`,
    }, { stateRoot });
    const interruptedRecovery = evaluateCloseoutGuard({
      ...interrupted,
      hook_event_name: "stop",
      status: "completed",
      loop_count: 0,
    }, { stateRoot });
    const generated = { ...interrupted, generation_id: "gen-interrupted-generated" };
    evaluateCloseoutGuard({
      ...generated,
      hook_event_name: "beforeSubmitPrompt",
      prompt: interruptedRecovery.followup_message,
    }, { stateRoot });
    const replacementHumanPrompt = { ...interrupted, generation_id: "gen-interrupted-human" };
    assert.deepEqual(evaluateCloseoutGuard({
      ...replacementHumanPrompt,
      hook_event_name: "beforeSubmitPrompt",
      prompt: "Summarize the repository state only.",
    }, { stateRoot }), {});
    const interruptedTerminal = readManualChain(replacementHumanPrompt, { stateRoot });
    assert.equal(interruptedTerminal.phase_status, "terminal-blocked");
    assert.equal(interruptedTerminal.pending_continuation, null);
  });
});

test("Cursor invalidates committed Evidence when a required Check later fails", () => {
  withState((stateRoot) => {
    const temporary = mkdtempSync(join(tmpdir(), "cursor-late-check-failure-"));
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
        conversation_id: "conv-late-check-failure",
        generation_id: "gen-late-check-failure",
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
        tool_output: { exit_code: 0, output: "ok\n" },
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "afterAgentResponse",
        text: closeoutInputMessage(),
      }, options);
      assert.equal(readManualChain(base, options).current_evidence.invalidated, false);

      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "preToolUse",
        tool_name: "Shell",
        tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
      }, options);
      evaluateCloseoutGuard({
        ...base,
        hook_event_name: "postToolUseFailure",
        tool_name: "Shell",
        tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
        failure_type: "error",
        error_message: "Process exited with code 1",
      }, options);
      const invalidated = readManualChain(base, options);
      assert.equal(invalidated.current_evidence.invalidated, true);
      assert.equal(invalidated.current_evidence.invalidate_reason, "required-check-failed-after-evidence");
      assert.equal(invalidated.known_failed_check.check_id, "CHECK-1");
      assert.equal(invalidated.phase_status, "evidence-invalidated");

      const recovery = evaluateCloseoutGuard({
        ...base,
        hook_event_name: "stop",
        status: "completed",
      }, options);
      assert.match(String(recovery.followup_message ?? ""), /required Check CHECK-1 failed|previous Evidence is invalidated/i);
      const continuation = { ...base, generation_id: "gen-late-check-recovery" };
      assert.deepEqual(evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "beforeSubmitPrompt",
        prompt: recovery.followup_message,
      }, options), {});
      evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "afterAgentResponse",
        text: closeoutInputMessage({
          grade: "failed",
          observed: "Focused tests failed.",
          limitations: ["The required Check returned exit code 1."],
          summary: "Recorded the required Check failure for Review.",
        }),
      }, options);
      assert.deepEqual(evaluateCloseoutGuard({
        ...continuation,
        hook_event_name: "stop",
        status: "completed",
        loop_count: 1,
      }, options), {});
      const replacement = readManualChain(continuation, options);
      assert.equal(replacement.current_evidence.invalidated, false, JSON.stringify(replacement, null, 2));
      assert.match(replacement.current_evidence.delivery_evidence_artifact, /grade:\s*failed/);
      assert.equal(replacement.known_failed_check, null);
      assert.equal(replacement.pending_continuation, null);
      const handoff = createContentAddressedHandoffStore(leanRoot, defaultRoot, options.handoffOptions);
      assert.equal(handoff.context("wp-retry", leanRoot).evidence_tip, replacement.current_evidence.delivery_evidence_id);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});

test("Cursor correction starts only from the exact current correct Review tip", () => {
  withState((stateRoot) => {
    const base = {
      conversation_id: "conv-current-correction",
      generation_id: "gen-current-correction-implementation",
      workspace_roots: ["/tmp/cursor-closeout-workspace"],
    };
    evaluateCloseoutGuard({
      ...base,
      hook_event_name: "beforeSubmitPrompt",
      prompt: `Implement the Plan\n\n${leanRoot}`,
    }, { stateRoot });
    const missing = evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-current-correction-missing",
      hook_event_name: "beforeSubmitPrompt",
      prompt: "/correct-work",
    }, { stateRoot });
    assert.equal(missing.permission, "deny");
    assert.match(missing.user_message, /exact current Review tip/i);

    updateManualChain(base, {
      current_review: {
        review_artifact_id: "wr-current-correction",
        next_action: "correct",
        correction_id: "cp-current-correction",
        recorded_at: new Date().toISOString(),
      },
      phase_status: "review-complete",
    }, { stateRoot });
    const incomplete = evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-current-correction-incomplete",
      hook_event_name: "beforeSubmitPrompt",
      prompt: "/correct-work",
    }, { stateRoot });
    assert.equal(incomplete.permission, "deny");
    assert.match(incomplete.user_message, /exact current Review tip.*Evidence tip|exact current Evidence tip/i);

    const evidence = makeEvidence({ id: "de-current-correction" });
    const review = correctionReviewArtifact({
      reviewId: "wr-current-correction",
      correctionId: "cp-current-correction",
      latestEvidenceId: "de-current-correction",
    });
    updateManualChain(base, {
      current_evidence: {
        closeout_recorded: true,
        delivery_report_ok: true,
        delivery_evidence_id: "de-current-correction",
        delivery_evidence_artifact: evidence,
        delivery_evidence_hash: evidenceHash(evidence),
        delivery_evidence_root_plan_id: "wp-retry",
        invalidated: false,
        recorded_at: new Date().toISOString(),
      },
      current_review: {
        review_artifact_id: "wr-current-correction",
        review_artifact: review,
        review_artifact_hash: evidenceHash(review),
        latest_evidence_id: "de-current-correction",
        next_action: "correct",
        correction_id: "cp-current-correction",
        recorded_at: new Date().toISOString(),
      },
      phase_status: "review-complete",
    }, { stateRoot });
    assert.deepEqual(evaluateCloseoutGuard({
      ...base,
      generation_id: "gen-current-correction-approved",
      hook_event_name: "beforeSubmitPrompt",
      prompt: "/correct-work",
    }, { stateRoot }), {});
    assert.equal(readManualChain(base, { stateRoot }).phase, "correction");
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
