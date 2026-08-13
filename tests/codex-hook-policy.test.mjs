import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateCodexHook, isReadOnlyShell } from "../src/core/codex-hook-policy.mjs";
import { createContentAddressedHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { formatDeliveryReportFence } from "../src/core/manual-attestation.mjs";
import { loadManualCheckReceipts } from "../src/core/manual-check-receipts.mjs";
import {
  extractRootPlanText,
  readPreflightAttestation,
  rootContentHash,
  rootPlanFingerprint,
} from "../src/core/root-plan-attestation.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  TEST_ROOT_CONTENT_HASH,
  TEST_ROOT_CONTENT_HASH_CRLF,
  closeoutStructured,
  closeoutInputMessage,
  leanRoot,
  leanRootCrlf,
  leanRootWithoutCloseout,
  planCloseoutFence,
  sharedLifecycleCasesFor,
} from "./support/manual-attestation-fixtures.mjs";

function step(state, input, options = {}) {
  return evaluateCodexHook({ session_id: "session", turn_id: "turn", model: "gpt-parent", ...input }, state, options);
}

const invalidLeanRoot = `---
artifact: work-plan
schema: 5
id: wp-retry-invalid
status: ready
intent_ready: true
profile_max: manual
contract_level: lean
risk: medium
hard_triggers: []
goal: Add retries.
acceptance:
  - Retries pass verification.
non_goals:
  - No deploy.
constraints:
  - Repository only.
authority:
  allowed_roots:
    - src
    - tests
  protected_paths:
    - .git
  approval_required_paths: []
  dependencies: deny
  external_effects: none
  delivery: repository-only
---

## Intent

Add retries.

## Acceptance

Retries pass verification.

## Boundaries

Only src and tests.

## Risks

Low residual risk.
`;

const highRoot = leanRoot
  .replace("id: wp-retry", "id: wp-high-retry")
  .replace("risk: medium", "risk: high")
  .replace("hard_triggers: []", "hard_triggers:\n  - broad-runtime-impact");

const efficientPolicy = {
  mode: "parent-or-approved",
  source: "test",
  hosts: {
    codex: {
      host: "codex",
      parent_fallback: true,
      preset: "codex-efficient-gpt-v1",
      candidates: [
        { model_id: "gpt-5.6-luna-max", reasoning_effort: "low" },
        { model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" },
      ],
    },
  },
};

test("Codex plan-work requires Plan mode and a native plan", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$plan-work add retries" });
  assert.equal(value.output.decision, "block");

  value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  let state = value.state;
  value = step(state, { hook_event_name: "Stop", last_assistant_message: "no plan marker" });
  assert.equal(value.output.decision, "block");
});

test("Codex plan-work allows low/medium Manual Roots without Hard Triggers to skip standalone preflight", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.active_root_plan_id, "wp-retry");
  assert.equal(value.state.turn, null);
});

test("Codex implementation blocks missing Root, baseline failure, and direct out-of-authority paths before mutation", () => {
  const missing = step({}, { hook_event_name: "UserPromptSubmit", prompt: "Please implement this plan." });
  assert.equal(missing.output.decision, "block");
  assert.match(missing.output.reason, /Plan required/);

  const repository = mkdtempSync(join(tmpdir(), "codex-authority-gate-"));
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    const planned = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
    const presented = step(planned.state, {
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
    });
    const implementation = step(presented.state, {
      hook_event_name: "UserPromptSubmit",
      prompt: "Please implement this plan.",
      cwd: repository,
    });
    assert.equal(implementation.output.decision, undefined);
    const baselineFailure = step(implementation.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: join(repository, "src/retry.mjs") },
      cwd: repository,
    }, {
      workspaceRoot: repository,
      captureRepositorySnapshot: () => { throw new Error("snapshot unavailable"); },
    });
    assert.equal(baselineFailure.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(baselineFailure.output.hookSpecificOutput.permissionDecisionReason, /baseline could not be captured.*snapshot unavailable/i);

    const implementation2 = step(presented.state, {
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan.",
      cwd: repository,
    });
    const capture = () => ({ repository_root: repository, snapshot_id: "baseline" });
    const outside = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: join(repository, "outside.txt") },
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(outside.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(outside.output.hookSpecificOutput.permissionDecisionReason, /outside Root authority/);
    const outsideList = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { paths: [join(repository, "src/retry.mjs"), join(repository, "outside-list.txt")] },
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(outsideList.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(outsideList.output.hookSpecificOutput.permissionDecisionReason, /outside Root authority/);
    const traversal = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "src/../outside-traversal.txt" },
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(traversal.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(traversal.output.hookSpecificOutput.permissionDecisionReason, /outside Root authority/);
    const moveDestination = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "ApplyPatch",
      tool_input: "*** Begin Patch\n*** Update File: src/retry.mjs\n*** Move to: outside-move.mjs\n*** End Patch",
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(moveDestination.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(moveDestination.output.hookSpecificOutput.permissionDecisionReason, /outside Root authority/);
    writeFileSync(join(repository, "outside-target.txt"), "protected\n");
    symlinkSync("../outside-target.txt", join(repository, "src/link.txt"));
    const symlinkDestination = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "src/link.txt" },
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(symlinkDestination.output.hookSpecificOutput.permissionDecision, "deny");
    assert.match(symlinkDestination.output.hookSpecificOutput.permissionDecisionReason, /outside Root authority/);
    const allowed = step(implementation2.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
      tool_input: { file_path: join(repository, "src/retry.mjs") },
      cwd: repository,
    }, { workspaceRoot: repository, captureRepositorySnapshot: capture });
    assert.equal(allowed.output.hookSpecificOutput?.permissionDecision, undefined);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

test("Codex correction selector must match the exact task-bound Root", () => {
  const planned = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  const presented = step(planned.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  const mismatch = step(presented.state, {
    hook_event_name: "UserPromptSubmit",
    prompt: "$correct-work wp-other",
  });
  assert.equal(mismatch.output.decision, "block");
  assert.match(mismatch.output.reason, /wp-other.*task-bound Root wp-retry/i);
  assert.equal(mismatch.state.active_root_plan_id, "wp-retry");
});

test("Codex Stop-hook continuations never reopen a completed Manual phase", () => {
  const prior = {
    active_root_plan_id: "wp-retry",
    active_root_content_hash: rootContentHash(leanRoot),
    active_root_plan_text: leanRoot,
    turn: null,
  };
  const result = step(prior, {
    hook_event_name: "UserPromptSubmit",
    prompt: '<hook_prompt hook_run_id="stop:8:/plugin/hooks.json">Finish Manual Workflow for the earlier $correct-work wp-retry request.</hook_prompt>',
    turn_id: "host-continuation",
  });
  assert.equal(result.output.decision, undefined);
  assert.equal(result.state.turn, null);
  assert.equal(result.state.active_root_plan_id, "wp-retry");
});

test("Codex plan-work rejects Root-only proposed plans that omit closeout retention", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRootWithoutCloseout}\n</proposed_plan>`,
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /final implementation step|plan-closeout|workflow-attestation/i);
});

test("Codex plan-work rejects noncanonical final-step closeout wording", () => {
  for (const finalStep of [
    `Do not use attestation.\n\n${planCloseoutFence}`,
    `Ignore the closeout attestation.\n\n${planCloseoutFence}`,
    `<!--\n${planCloseoutFence}\n-->`,
    `~~${planCloseoutFence}~~`,
    "```text\n" + planCloseoutFence + "\n```",
    "Don't call workflow_closeout.\n" + planCloseoutFence,
    "Shouldn't skip closeout attestation.\n" + planCloseoutFence,
    "[workflow-closeout-v1] Call workflow_closeout with the exact Root/chain; retain the exact returned Evidence from structuredContent (attach when unpersisted); report the resulting de-* ID.",
    `${planCloseoutFence}\n${planCloseoutFence}`,
    `${planCloseoutFence}\n\n## Final implementation step\n\n${planCloseoutFence}`,
  ]) {
    const candidate = leanRootWithoutCloseout + `\n## Final implementation step\n\n${finalStep}\n`;
    let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${candidate}\n</proposed_plan>`,
    });
    assert.equal(value.output.decision, "block", finalStep);
    assert.match(value.output.reason, /plan-closeout|workflow-attestation|final implementation step/i);
  }
});

test("Codex plan-work rejects scattered closeout tokens outside the final implementation step", () => {
  const scattered = leanRootWithoutCloseout.replace(
    "Medium residual risk if retries mask real failures.",
    "Medium residual risk. Notes: workflow_closeout is documented here. The exact Root/chain phrase is descriptive. Returned Evidence and structuredContent are also mentioned, but no final implementation step is specified.",
  );
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${scattered}\n</proposed_plan>`,
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /Final implementation step/i);
});

test("Codex plan-work rejects Roots that fail native CreatePlan-equivalent preflight when skipping MCP preflight", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${invalidLeanRoot}\n</proposed_plan>`,
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /native semantic validation|explicit-verification-required|Verification/i);
});

test("Codex plan-work runs native exact-Root preflight for high-risk Roots and keeps MCP optional", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  let state = value.state;
  value = step(state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.active_root_plan_id, "wp-high-retry");
  assert.equal(value.state.active_root_plan_text, highRoot);

  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: { structuredContent: { feasible: true, blocking_issues: [], root_plan_id: "wp-high-retry" } },
  });
  assert.equal(value.state.turn.preflight_passed, true);
  assert.equal(value.state.turn.preflight_fingerprint, rootPlanFingerprint(highRoot));
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.active_root_plan_id, "wp-high-retry");
});

test("Codex plan-work blocks ID-only proposed plans after successful preflight", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: { structuredContent: { feasible: true, blocking_issues: [], root_plan_id: "wp-high-retry" } },
  });
  assert.equal(value.state.turn.preflight_passed, true);
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: "<proposed_plan>\nwp-high-retry\n</proposed_plan>",
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /exact Schema-5 Root text|ID-only/i);
});

test("Codex rejects malformed MCP preflight authority but still accepts an independently valid native Root", () => {
  const attestation = readPreflightAttestation({
    structuredContent: { feasible: true, blocking_issues: "none", root_plan_id: "wp-high-retry" },
  });
  assert.equal(attestation.feasible, false);
  assert.deepEqual(attestation.blockers, ["invalid-blocking-issues"]);

  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: { structuredContent: { feasible: true, blocking_issues: "none", root_plan_id: "wp-high-retry" } },
  });
  assert.equal(value.state.turn.preflight_attempted, true);
  assert.equal(value.state.turn.preflight_passed, false);
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.active_root_plan_id, "wp-high-retry");
});

test("Codex plan-work ignores failed optional MCP transport but blocks a successful mismatched attestation", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  let state = value.state;

  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: {
      structuredContent: {
        feasible: false,
        blocking_issues: [{ message: "missing required check" }],
        root_plan_id: "wp-high-retry",
      },
    },
  });
  assert.equal(value.state.turn.preflight_attempted, true);
  assert.equal(value.state.turn.preflight_passed, false);
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});

  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: { isError: true, error: "validator unavailable" },
  });
  assert.equal(value.state.turn.preflight_passed, false);
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});

  value = step(state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: highRoot },
    tool_response: { structuredContent: { feasible: true, blocking_issues: [], root_plan_id: "wp-high-retry" } },
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /exactly match/);
});

test("Codex plan-work treats handoff record as optional best-effort transport", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
    tool_input: { root_plan: leanRoot },
    tool_response: { structuredContent: { feasible: true, blocking_issues: [], root_plan_id: "wp-retry" } },
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  assert.deepEqual(value.output, {});
  assert.equal(value.state.turn, null);
});

test("Codex Workflow blocks model overrides and invalidates observed mismatches", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$review-work wp-retry" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { model: "foreign", prompt: "review" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");

  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { prompt: "review" } });
  value = evaluateCodexHook({ session_id: "session", turn_id: "turn", hook_event_name: "SubagentStart", model: "foreign", agent_id: "agent-1", agent_type: "reviewer" }, value.state);
  assert.match(value.output.systemMessage, /attestation failed/);
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = evaluateCodexHook({ hook_event_name: "SubagentStop", session_id: "session", agent_id: "agent-1" }, value.state);
  assert.equal(value.output.continue, false);
});

test("Codex ordered Manual policy injects the first candidate and advances after unavailable failures", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" }, { manualSubagentPolicy: efficientPolicy });
  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "Agent",
    tool_input: { prompt: "research", agent_type: "explore" },
  }, { manualSubagentPolicy: efficientPolicy });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(value.output.hookSpecificOutput.updatedInput.model, "gpt-5.6-luna-max");
  assert.equal(value.output.hookSpecificOutput.updatedInput.reasoning_effort, "low");
  assert.equal(value.output.hookSpecificOutput.updatedInput.fork_turns, "none");
  const lunaInput = value.output.hookSpecificOutput.updatedInput;

  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_input: lunaInput,
    tool_response: { error: "model unavailable: gpt-5.6-luna-max" },
  }, { manualSubagentPolicy: efficientPolicy });
  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "Agent",
    tool_input: { prompt: "research retry", agent_type: "explore" },
  }, { manualSubagentPolicy: efficientPolicy });
  assert.equal(value.output.hookSpecificOutput.updatedInput.model, "gpt-5.6-terra-xhigh");
  const terraInput = value.output.hookSpecificOutput.updatedInput;

  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_input: terraInput,
    tool_response: { error: "unsupported model gpt-5.6-terra-xhigh" },
  }, { manualSubagentPolicy: efficientPolicy });
  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "Agent",
    tool_input: { prompt: "research parent", agent_type: "explore" },
  }, { manualSubagentPolicy: efficientPolicy });
  assert.equal(value.output.hookSpecificOutput.updatedInput.model, undefined);
  value = evaluateCodexHook({
    session_id: "session",
    turn_id: "turn",
    hook_event_name: "SubagentStart",
    model: "gpt-parent",
    agent_id: "agent-parent",
  }, value.state, { manualSubagentPolicy: efficientPolicy });
  assert.deepEqual(value.output, {});
});

test("Codex ordered Manual policy rejects Sol when it is outside the approved pool", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" }, { manualSubagentPolicy: efficientPolicy });
  value = step(value.state, {
    hook_event_name: "PreToolUse",
    tool_name: "Agent",
    tool_input: { prompt: "research", agent_type: "explore" },
  }, { manualSubagentPolicy: efficientPolicy });
  value = evaluateCodexHook({
    session_id: "session",
    turn_id: "turn",
    hook_event_name: "SubagentStart",
    model: "gpt-5.6-sol-xhigh",
    agent_id: "agent-sol",
  }, value.state, { manualSubagentPolicy: efficientPolicy });
  assert.match(value.output.systemMessage, /attestation failed/);
  assert.match(value.output.systemMessage, /gpt-5.6-sol-xhigh/);
});

test("Codex review allows inspections and artifact recording but blocks mutation", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "default", prompt: "$review-work wp-retry" });
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rtk git diff --stat && rtk rg retry src" } });
  assert.deepEqual(value.output, {});
  assert.equal(isReadOnlyShell("git status | head -20"), true);

  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: "*** Begin Patch" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git add src/file.mjs" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "spawn_agent", tool_input: { message: "edit the repository" } });
  assert.equal(value.output.hookSpecificOutput.permissionDecision, "deny");
  value = step(value.state, { hook_event_name: "PreToolUse", tool_name: "mcp__geldmacher_workflow__workflow_artifact_record", tool_input: {} });
  assert.deepEqual(value.output, {});
});

test("Codex review recovers missing Evidence once without mutation and preserves provisional status", () => {
  const temporary = mkdtempSync(join(tmpdir(), "codex-review-recovery-"));
  const repository = join(temporary, "repository");
  const options = {
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot: join(temporary, "handoff") },
    receiptOptions: { baseRoot: join(temporary, "receipts") },
  };
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
    mkdirSync(join(repository, "tests"), { recursive: true });
    writeFileSync(join(repository, "tests/preexisting-dirty.test.mjs"), "// pre-existing dirty path\n");
    let value = step({}, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "$review-work wp-retry",
      cwd: repository,
    }, options);
    assert.equal(value.state.turn.root_plan_id, "wp-retry");
    assert.equal(value.state.active_root_plan_text, undefined);
    value = step(value.state, {
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_artifact_context",
      tool_input: { root_plan_id: "wp-retry", root_plan: leanRoot },
      tool_response: {
        structuredContent: {
          root_plan_id: "wp-retry",
          artifacts: [{ label: "wp-retry", text: leanRoot }],
        },
      },
      cwd: repository,
    }, options);
    assert.equal(value.state.active_root_plan_id, "wp-retry");
    assert.equal(value.state.active_root_plan_text, leanRoot);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: closeoutInputMessage({ phase: "review-recovery", changedPaths: [] }),
      cwd: repository,
    }, options);
    assert.equal(value.output.decision, "block");
    assert.match(value.output.reason, /recovered exact Evidence|provisional|supported/i);
    assert.equal(value.state.turn.review_recovery_count, 1);
    assert.match(value.state.turn.delivery_evidence_artifact, /changed_paths:\n\s+- src\/retry\.mjs\n\s+- tests\/preexisting-dirty\.test\.mjs/);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: "Review complete with the recovered provisional Evidence; no grade was raised.",
      cwd: repository,
    }, options);
    assert.deepEqual(value.output, {});
    assert.equal(value.state.turn, null);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Codex task-local Root, Evidence, and exact Review close a correction without MCP handoff reconstruction", () => {
  const temporary = mkdtempSync(join(tmpdir(), "codex-task-local-correction-"));
  const repository = join(temporary, "repository");
  const options = {
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot: join(temporary, "handoff") },
    receiptOptions: { baseRoot: join(temporary, "receipts") },
  };
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    writeFileSync(join(repository, "src/preexisting.mjs"), "export const preexisting = false;\n");
    for (const args of [
      ["init", "--quiet"],
      ["add", "src/retry.mjs", "src/preexisting.mjs"],
      ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"],
    ]) {
      const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    writeFileSync(join(repository, "src/preexisting.mjs"), "export const preexisting = true;\n");

    let value = step({}, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work add retries",
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
      cwd: repository,
    }, options);

    value = step(value.state, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "Implement the Plan",
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { patch: "*** Begin Patch" },
      cwd: repository,
    }, options);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 2;\n");
    const checkInput = { command: "node --test tests/codex-hook-policy.test.mjs" };
    value = step(value.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Shell",
      tool_input: checkInput,
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "PostToolUse",
      tool_name: "Shell",
      tool_input: checkInput,
      tool_response: { exit_code: 0, output: "Focused Codex hook policy tests pass.\n" },
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: closeoutInputMessage({ changedPaths: [] }),
      cwd: repository,
    }, options);
    assert.deepEqual(value.output, {});
    let taskBucket = value.state.task_artifacts_by_root[value.state.active_root_content_hash];
    const initialEntry = taskBucket.artifacts.find((entry) => entry.artifact_type === "delivery-evidence");
    assert.ok(initialEntry);
    assert.match(initialEntry.text, /changed_paths:\n\s+- src\/retry\.mjs/);
    assert.doesNotMatch(initialEntry.text, /src\/preexisting\.mjs/);

    value = step(value.state, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "$review-work wp-retry",
      cwd: repository,
    }, options);
    const exactReview = correctionReviewArtifact({ latestEvidenceId: initialEntry.label });
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: exactReview,
      cwd: repository,
    }, options);
    assert.deepEqual(value.output, {});
    taskBucket = value.state.task_artifacts_by_root[value.state.active_root_content_hash];
    assert.equal(taskBucket.artifacts.find((entry) => entry.label === "wr-retry")?.text, exactReview);
    const handoffStore = createContentAddressedHandoffStore(leanRoot, defaultRoot, options.handoffOptions);
    assert.equal(handoffStore.context("wp-retry", leanRoot).review_tip, null);

    value = step(value.state, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "$correct-work wp-retry",
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { patch: "*** Begin Patch" },
      cwd: repository,
    }, options);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const correctionCloseout = closeoutInputMessage({
      phase: "correction",
      strategyRevision: 1,
      changedPaths: [],
      grade: "supported",
      observed: "Correction behavior is supported by repository inspection.",
      summary: "Applied the authorized correction and retained explicit proof limits.",
    }).replace("check_id: CHECK-1", "check_id: CHECK-101");
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: correctionCloseout,
      cwd: repository,
    }, options);
    assert.deepEqual(value.output, {});
    taskBucket = value.state.task_artifacts_by_root[value.state.active_root_content_hash];
    const delta = taskBucket.artifacts.find((entry) => entry.artifact_type === "delivery-evidence" && /representation: delta/.test(entry.text));
    assert.ok(delta);
    assert.match(delta.text, /subject_id: cp-retry/);
    assert.match(delta.text, /source_review_id: wr-retry/);
    assert.match(delta.text, new RegExp(`predecessor_evidence_id: ${initialEntry.label}`));
    assert.deepEqual(JSON.parse(JSON.stringify(handoffStore.context("wp-retry", leanRoot))).review_tip, "wr-retry");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Codex surfaces a classified native closeout failure in the Stop response", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  value = step(value.state, {
    hook_event_name: "UserPromptSubmit",
    permission_mode: "default",
    prompt: "$correct-work wp-retry",
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: closeoutInputMessage({ phase: "correction", changedPaths: [] }),
  }, {
    captureRepositorySnapshot: () => ({ schema: 1, repository_root: defaultRoot, head: "a".repeat(40), dirty_paths: [], fingerprints: {}, working_tree: "unchanged" }),
    deriveRepositoryDelta: () => ({
      baseline_available: true,
      changed_paths: [],
      repository_snapshot: { repository_root: defaultRoot, head: "a".repeat(40), working_tree: "unchanged", relevant_fingerprints: "none" },
    }),
    performNativeCloseout: () => { throw new Error("native correction closeout is missing exact Source Review for predecessor Evidence de-retry"); },
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /\[missing-source-review\]/);
  assert.match(value.output.reason, /de-retry/);
  assert.equal(value.state.turn.native_closeout_error_code, "missing-source-review");
});

test("Codex exact task-local Reviews with the same ID remain byte-conflict fail-closed", () => {
  let value = step({}, { hook_event_name: "UserPromptSubmit", permission_mode: "plan", prompt: "$plan-work add retries" });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
  });
  value = step(value.state, {
    hook_event_name: "UserPromptSubmit",
    permission_mode: "default",
    prompt: "$review-work wp-retry",
  });
  const recordedReview = correctionReviewArtifact();
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_artifact_record",
    tool_input: { artifacts: [{ label: "review", text: recordedReview }] },
    tool_response: { isError: true, error: "optional transport unavailable" },
  });
  const authoritativeReview = recordedReview.replace("one correction remains", "one exact correction remains");
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: authoritativeReview,
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /exact review capture failed closed/i);
  assert.match(value.output.reason, /conflicts with different immutable bytes/);
});

const validFullTemplate = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/delivery-evidence.valid.md"), "utf8");

function exactFullEvidenceFor(id = "de-full") {
  return validFullTemplate
    .replace("id: de-adaptive-retry", `id: ${id}`)
    .replace("root_plan_id: wp-adaptive-retry", "root_plan_id: wp-retry")
    .replace("subject_id: wp-adaptive-retry", "subject_id: wp-retry");
}

function exactDeltaEvidenceFor(id = "de-current") {
  return exactFullEvidenceFor(id)
    .replace("subject_id: wp-retry", "subject_id: cp-retry")
    .replace("source_review_id: null", "source_review_id: wr-retry")
    .replace("predecessor_evidence_id: null", "predecessor_evidence_id: de-prior")
    .replace("representation: full", "representation: delta")
    .replace(
      "## Summary\n\nThe authorized repository change is complete and verified.\n\n## Objective outcomes",
      "## Summary\n\nThe authorized correction is complete and verified.\n\n## Subject results\n\n| Objective ID | Result | Evidence |\n|---|---|---|\n| FIX-1 | achieved | CHECK-1 passed |\n\n## Objective outcomes",
    )
    .replace("| `src/retry.mjs` | Made retry handling deterministic. | OBJ-1 |", "| `src/retry.mjs` | Made retry handling deterministic. | FIX-1 |");
}

function exactBlockedEvidenceFor(id = "de-blocked") {
  return exactFullEvidenceFor(id)
    .replace("status: complete", "status: blocked")
    .replace("overall_grade: verified", "overall_grade: failed")
    .replace("| OBJ-1 | achieved | CHECK-1 passed twice |", "| OBJ-1 | blocked | BLOCKER: required Check CHECK-1 failed |")
    .replace("| CHECK-1 | passed twice | passed | src=abc123; tests=def456 |", "| CHECK-1 | failed once | failed | src=abc123; tests=def456 |")
    .replace(/grade: verified/, "grade: failed")
    .replace("The authorized repository change is complete and verified.", "BLOCKER: required Check CHECK-1 failed before delivery.");
}

const exactDeltaEvidence = exactDeltaEvidenceFor("de-current");
const exactDeltaEvidenceHash = createHash("sha256").update(exactDeltaEvidence).digest("hex");
const exactFullEvidence = exactFullEvidenceFor("de-full");
const exactFullEvidenceHash = createHash("sha256").update(exactFullEvidence).digest("hex");
const exactBlockedEvidence = exactBlockedEvidenceFor("de-blocked");
const exactBlockedEvidenceHash = createHash("sha256").update(exactBlockedEvidence).digest("hex");

function correctionReviewArtifact({
  reviewId = "wr-retry",
  correctionId = "cp-retry",
  rootPlanId = "wp-retry",
  latestEvidenceId = "de-prior",
} = {}) {
  return `---
artifact: work-review
schema: 5
id: ${reviewId}
status: complete
root_plan_id: ${rootPlanId}
latest_evidence_id: ${latestEvidenceId}
assessment: not-achieved
delivery_status: blocked
review_route: inline
next_action: correct
correction_id: ${correctionId}
predecessor_review_id: null
auditors_run:
  - inline
inspected_objectives: [OBJ-1]
reused_objectives: []
inspected_checks: [CHECK-1]
reused_checks: []
learning_candidates: [LRN-retry]
---

## Assessment

not-achieved: one correction remains.

## Evidence coverage

| Kind | Inspected | Reused | Result | Evidence |
|---|---|---|---|---|
| Objectives | OBJ-1 | None. | blocked | review |
| Checks | CHECK-1 | None. | blocked | review |
| Auditors | inline | None. | complete | review |
| Snapshot | current | None. | inconsistent | review |

## Findings

| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |
|---|---|---|---|---|---|
| retry-gap | medium | OBJ-1 | CHECK-1 | source | gap |

## Next action

correct: apply ${correctionId}.

## Correction plan

### ${correctionId}

| Correction ID | Root Plan | Source Review | Base Evidence | Predecessor Correction | Risk |
|---|---|---|---|---|---|
| ${correctionId} | ${rootPlanId} | ${reviewId} | ${latestEvidenceId} | None. | medium |

| FIX ID | Finding keys | Root Objectives | Root Checks | Required outcome | Evidence |
|---|---|---|---|---|---|
| FIX-1 | retry-gap | OBJ-1 | CHECK-1 | Close the gap. | review |

| Step ID | FIX IDs | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action |
|---|---|---|---|---|---|---|---|
| STEP-1 | FIX-1 | src/retry.mjs | Close the gap. | Focused edit. | PROBE-1: CHECK-1 passes. | CHECK-101 | Stop on scope change. |

| Check ID | FIX IDs | Working Directory | Command or Inspection | Expected Result | Required | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|
| CHECK-101 | FIX-1 | repository root | node --test | pass | yes | standard | src, tests |

| Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence |
|---|---|---|---|---|
| LRN-retry | retry-gap | Keep lineage exact. | tests guidance | correction evidence |
`;
}

function beginImplementationWithEvidence(evidenceId = "de-current", {
  artifact = exactDeltaEvidence,
  artifactHash = null,
  expectRecorded = true,
  response = null,
  handoffPersisted = true,
  activeRootPlanId = "wp-retry",
  activeRootContentHash = TEST_ROOT_CONTENT_HASH,
  closeoutRootPlanId = null,
  omitHandoffPersisted = false,
  artifacts = null,
  rootContentHash = TEST_ROOT_CONTENT_HASH,
} = {}) {
  let value = evaluateCodexHook({
    hook_event_name: "UserPromptSubmit",
    session_id: "session",
    turn_id: "turn",
    model: "gpt-parent",
    permission_mode: "default",
    prompt: "Implement the plan",
  }, {
    active_root_plan_id: activeRootPlanId,
    active_root_content_hash: activeRootContentHash,
  });
  let toolResponse;
  if (response != null) {
    toolResponse = response.structuredContent ? response : { structuredContent: response };
    if (!response.structuredContent && response.delivery_evidence_id && !response.artifact) {
      toolResponse = response;
    }
  } else {
    const structuredContent = artifact
      ? closeoutStructured(artifact, {
          delivery_evidence_id: evidenceId,
          artifact_hash: artifactHash ?? createHash("sha256").update(String(artifact), "utf8").digest("hex"),
          handoff_persisted: omitHandoffPersisted ? undefined : handoffPersisted,
          root_content_hash: rootContentHash,
        })
      : {
          delivery_evidence_id: evidenceId,
          artifact_hash: artifactHash,
          handoff_persisted: omitHandoffPersisted ? undefined : handoffPersisted,
          root_content_hash: rootContentHash,
        };
    if (omitHandoffPersisted) delete structuredContent.handoff_persisted;
    if (evidenceId == null) delete structuredContent.delivery_evidence_id;
    if (!artifact) {
      delete structuredContent.artifact;
      delete structuredContent.root_plan_id;
      delete structuredContent.status;
      delete structuredContent.subject_id;
      delete structuredContent.source_review_id;
      delete structuredContent.predecessor_evidence_id;
    }
    if (artifactHash) structuredContent.artifact_hash = artifactHash;
    toolResponse = { structuredContent };
  }
  const toolInput = {
    root_plan_id: closeoutRootPlanId ?? activeRootPlanId,
  };
  if (artifacts) {
    toolInput.artifacts = artifacts;
  } else if (typeof artifact === "string" && /source_review_id:\s*wr-/.test(artifact)) {
    const sourceReviewId = artifact.match(/^source_review_id:\s*(wr-[A-Za-z0-9-]+)/m)?.[1] ?? "wr-retry";
    const subjectId = artifact.match(/^subject_id:\s*(cp-[A-Za-z0-9-]+)/m)?.[1] ?? "cp-retry";
    const predecessor = artifact.match(/^predecessor_evidence_id:\s*(de-[A-Za-z0-9-]+)/m)?.[1] ?? "de-prior";
    toolInput.artifacts = [{
      label: sourceReviewId,
      text: correctionReviewArtifact({
        reviewId: sourceReviewId,
        correctionId: subjectId,
        rootPlanId: activeRootPlanId,
        latestEvidenceId: predecessor,
      }),
    }];
  }
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "mcp__geldmacher_workflow__workflow_closeout",
    tool_input: toolInput,
    tool_response: toolResponse,
  });
  if (expectRecorded) {
    assert.equal(value.state.turn.closeout_recorded, true);
    assert.equal(value.state.turn.delivery_evidence_id, evidenceId);
    assert.equal(value.state.turn.handoff_persisted, handoffPersisted);
  } else {
    assert.equal(value.state.turn.closeout_recorded, false);
    assert.equal(value.state.turn.delivery_evidence_id, null);
  }
  return value;
}

function report(id) {
  return formatDeliveryReportFence(id);
}

test("Codex implementation cannot stop without a closeout artifact", () => {
  let value = evaluateCodexHook({
    hook_event_name: "UserPromptSubmit",
    session_id: "session",
    turn_id: "turn",
    model: "gpt-parent",
    permission_mode: "default",
    prompt: "Implement the plan",
  }, {
    active_root_plan_id: "wp-retry",
    active_root_content_hash: TEST_ROOT_CONTENT_HASH,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: "Implementation complete" });
  assert.equal(value.output.decision, "block");
  value = beginImplementationWithEvidence("de-full", {
    artifact: exactFullEvidence,
    artifactHash: exactFullEvidenceHash,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
  assert.deepEqual(value.output, {});
});

test("Codex lifecycle closes out from one native report without an MCP call", () => {
  const temporary = mkdtempSync(join(tmpdir(), "codex-native-closeout-"));
  const repository = join(temporary, "repository");
  const options = {
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot: join(temporary, "handoff") },
    receiptOptions: { baseRoot: join(temporary, "receipts") },
  };
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
    let value = step({}, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work add retries",
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "Implement the Plan",
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { patch: "*** Begin Patch" },
      cwd: repository,
    }, options);
    assert.ok(value.state.turn.repository_baseline);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    value = step(value.state, {
      hook_event_name: "PreToolUse",
      tool_name: "Shell",
      tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
      cwd: repository,
    }, options);
    value = step(value.state, {
      hook_event_name: "PostToolUse",
      tool_name: "Shell",
      tool_input: { command: "rtk node --test tests/codex-hook-policy.test.mjs" },
      tool_response: { exit_code: 0, output: "Focused Codex hook policy tests pass.\n" },
      cwd: repository,
    }, options);
    const activeRootPlanText = value.state.active_root_plan_text;
    assert.equal(value.state.turn.check_receipt_status, "recorded", value.state.turn.check_receipt_error ?? "receipt was not recorded");
    assert.equal(loadManualCheckReceipts({
      rootPlanText: activeRootPlanText,
      pluginRoot: defaultRoot,
      workspaceRoot: repository,
      options: options.receiptOptions,
    }).length, 1);
    value = step(value.state, {
      hook_event_name: "Stop",
      last_assistant_message: closeoutInputMessage(),
      cwd: repository,
    }, options);
    assert.deepEqual(value.output, {});
    assert.equal(value.state.turn, null);
    assert.equal(loadManualCheckReceipts({
      rootPlanText: activeRootPlanText,
      pluginRoot: defaultRoot,
      workspaceRoot: repository,
      options: options.receiptOptions,
    }).length, 0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Codex implementation Stop requires the exact recorded Evidence ID", () => {
  let value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-stale") });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /typed delivery-report|exact Evidence|closeout/i);
  // Competing prose IDs are non-authoritative once the typed delivery-report matches.
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: `${report("de-current")}\nAlso de-stale` });
  assert.deepEqual(value.output, {});
});

test("Codex closeout recording requires structuredContent Schema-5 Evidence identity", () => {
  let value = beginImplementationWithEvidence(null, {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: null,
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    expectRecorded: false,
    response: {
      delivery_evidence_id: "de-current",
      artifact: exactDeltaEvidence,
      artifact_hash: exactDeltaEvidenceHash,
      handoff_persisted: true,
    },
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: createHash("sha256").update("other").digest("hex"),
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: "not-a-sha256",
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash.toUpperCase(),
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    omitHandoffPersisted: true,
    artifactHash: exactDeltaEvidenceHash,
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  const mismatchedIdArtifact = exactDeltaEvidence.replace("id: de-current", "id: de-other");
  value = beginImplementationWithEvidence("de-current", {
    artifact: mismatchedIdArtifact,
    artifactHash: createHash("sha256").update(mismatchedIdArtifact).digest("hex"),
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  const failedArtifact = exactFullEvidenceFor("de-failed").replace("status: complete", "status: failed");
  value = beginImplementationWithEvidence("de-failed", {
    artifact: failedArtifact,
    artifactHash: createHash("sha256").update(failedArtifact).digest("hex"),
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-failed") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-blocked", {
    artifact: exactBlockedEvidence,
    artifactHash: exactBlockedEvidenceHash,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-blocked") });
  assert.deepEqual(value.output, {});
});

test("Codex invalidates closeout after a mutating tool", () => {
  let value = beginImplementationWithEvidence("de-full", {
    artifact: exactFullEvidence,
    artifactHash: exactFullEvidenceHash,
  });
  value = step(value.state, {
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: { command: "touch dirty" },
    tool_response: { ok: true },
  });
  assert.equal(value.state.turn.closeout_recorded, false);
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
  assert.equal(value.output.decision, "block");
});

test("Codex invalidates closeout after Task and Agent mutations", () => {
  for (const toolName of ["Task", "Agent", "spawn_agent"]) {
    let value = beginImplementationWithEvidence("de-full", {
      artifact: exactFullEvidence,
      artifactHash: exactFullEvidenceHash,
    });
    assert.equal(value.state.turn.closeout_recorded, true);
    value = step(value.state, {
      hook_event_name: "PostToolUse",
      tool_name: toolName,
      tool_input: { prompt: "mutate via child" },
      tool_response: { ok: true },
    });
    assert.equal(value.state.turn.closeout_recorded, false, toolName);
    value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
    assert.equal(value.output.decision, "block", toolName);
  }
});

test("Codex closeout Stop binds persistence, chain Root, and raw-byte Evidence identity", () => {
  let value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: true,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.deepEqual(value.output, {});

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: true,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [report("de-current"), "", exactDeltaEvidence].join("\n"),
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: true,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [
      report("de-current"),
      "",
      `PREFIX${exactDeltaEvidence}SUFFIX`,
    ].join("\n"),
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /unpersisted|attach|exact/i);

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [report("de-current"), "", exactDeltaEvidence].join("\n"),
  });
  assert.deepEqual(value.output, {});

  value = beginImplementationWithEvidence("de-full", {
    artifact: exactFullEvidence,
    artifactHash: exactFullEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [report("de-full"), "", "```yaml", exactFullEvidence, "```"].join("\n"),
  });
  assert.deepEqual(value.output, {});

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    activeRootPlanId: "wp-other",
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    closeoutRootPlanId: "wp-foreign",
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  const crlfArtifact = exactDeltaEvidence.replaceAll("\n", "\r\n");
  const crlfHash = createHash("sha256").update(crlfArtifact, "utf8").digest("hex");
  const lfHash = createHash("sha256").update(exactDeltaEvidence, "utf8").digest("hex");
  value = beginImplementationWithEvidence("de-current", {
    artifact: crlfArtifact,
    artifactHash: lfHash,
    handoffPersisted: false,
    expectRecorded: false,
  });
  value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-current") });
  assert.equal(value.output.decision, "block");

  value = beginImplementationWithEvidence("de-current", {
    artifact: crlfArtifact,
    artifactHash: crlfHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [report("de-current"), "", exactDeltaEvidence].join("\n"),
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /exact|attach|unpersisted|byte/i);

  value = beginImplementationWithEvidence("de-current", {
    artifact: crlfArtifact,
    artifactHash: crlfHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [report("de-current"), "", crlfArtifact].join("\n"),
  });
  assert.deepEqual(value.output, {});

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [
      report("de-current"),
      "",
      exactDeltaEvidence,
      "Competing outcome: de-stale",
    ].join("\n"),
  });
  // Prose de-* mentions are non-authoritative; exact recorded attachment + delivery-report is enough.
  assert.deepEqual(value.output, {});

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [
      report("de-current"),
      "",
      exactDeltaEvidence,
      exactDeltaEvidence,
    ].join("\n"),
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

  value = beginImplementationWithEvidence("de-current", {
    artifact: exactDeltaEvidence,
    artifactHash: exactDeltaEvidenceHash,
    handoffPersisted: false,
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: [
      report("de-current"),
      "",
      `PREFIX${exactDeltaEvidence}SUFFIX`,
    ].join("\n"),
  });
  assert.equal(value.output.decision, "block");
  assert.match(value.output.reason, /typed delivery-report|exact Evidence|attach|closeout/i);
});

test("Codex stores raw Root content hash, not semantic fingerprint, as active authority", () => {
  const message = `<proposed_plan>\n${leanRootCrlf}\n</proposed_plan>`;
  assert.equal(extractRootPlanText(message), leanRootCrlf);
  let value = evaluateCodexHook({
    hook_event_name: "UserPromptSubmit",
    session_id: "session",
    turn_id: "turn",
    model: "gpt-parent",
    permission_mode: "plan",
    prompt: "$plan-work",
  });
  value = step(value.state, {
    hook_event_name: "Stop",
    last_assistant_message: message,
  });
  assert.notEqual(value.output.decision, "block");
  assert.equal(value.state.active_root_content_hash, TEST_ROOT_CONTENT_HASH_CRLF);
  assert.equal(value.state.active_root_content_hash, rootContentHash(leanRootCrlf));
  assert.notEqual(value.state.active_root_content_hash, rootPlanFingerprint(leanRootCrlf));
  assert.notEqual(value.state.active_root_content_hash, TEST_ROOT_CONTENT_HASH);
});

test("shared lifecycle matrix executes on the Codex source surface", () => {
  const executed = [];
  const cases = sharedLifecycleCasesFor("codex");
  for (const entry of cases) {
    executed.push(entry.id);
    if (entry.id === "same-id-root-hash-mismatch" || entry.id === "crlf-active-root-hash-mismatch") {
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
        rootContentHash: entry.id === "crlf-active-root-hash-mismatch"
          ? TEST_ROOT_CONTENT_HASH_CRLF
          : "0".repeat(64),
        activeRootContentHash: entry.id === "crlf-active-root-hash-mismatch"
          ? TEST_ROOT_CONTENT_HASH
          : "1".repeat(64),
        expectRecorded: false,
      });
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "mutate-after-closeout") {
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
      });
      value = step(value.state, {
        hook_event_name: "PostToolUse",
        tool_name: "Task",
        tool_input: { prompt: "mutate via child" },
        tool_response: { ok: true },
      });
      assert.equal(value.state.turn.closeout_recorded, false);
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "missing-active-root") {
      // Implementation phase needs an active Root ID; omit only the content hash.
      let value = evaluateCodexHook({
        hook_event_name: "UserPromptSubmit",
        session_id: "session",
        turn_id: "turn",
        model: "gpt-parent",
        permission_mode: "default",
        prompt: "Implement the plan",
      }, {
        active_root_plan_id: "wp-retry",
      });
      value = step(value.state, {
        hook_event_name: "PostToolUse",
        tool_name: "mcp__geldmacher_workflow__workflow_closeout",
        tool_input: { root_plan_id: "wp-retry" },
        tool_response: {
          structuredContent: closeoutStructured(exactFullEvidence, {
            delivery_evidence_id: "de-full",
            artifact_hash: exactFullEvidenceHash,
          }),
        },
      });
      assert.equal(value.state.turn.closeout_recorded, false);
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "foreign-active-root") {
      const foreign = exactFullEvidenceFor("de-foreign")
        .replaceAll("wp-retry", "wp-other")
        .replaceAll("wp-adaptive-retry", "wp-other");
      let value = beginImplementationWithEvidence("de-foreign", {
        artifact: foreign,
        artifactHash: createHash("sha256").update(foreign).digest("hex"),
        activeRootPlanId: "wp-retry",
        closeoutRootPlanId: "wp-other",
        expectRecorded: false,
      });
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-foreign") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "foreign-full-root-lineage") {
      const correction = exactDeltaEvidenceFor("de-lineage");
      let value = beginImplementationWithEvidence("de-lineage", {
        artifact: correction,
        artifactHash: createHash("sha256").update(correction).digest("hex"),
        expectRecorded: false,
        artifacts: [],
      });
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-lineage") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "text-transport-authority") {
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
        expectRecorded: false,
        response: {
          content: [{ text: JSON.stringify({
            structuredContent: closeoutStructured(exactFullEvidence, {
              delivery_evidence_id: "de-full",
              artifact_hash: exactFullEvidenceHash,
            }),
          }) }],
        },
      });
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "conflicting-structured-content") {
      const structured = closeoutStructured(exactFullEvidence, {
        delivery_evidence_id: "de-full",
        artifact_hash: exactFullEvidenceHash,
      });
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
        expectRecorded: false,
        response: {
          content: [
            { structuredContent: structured },
            { structuredContent: { ...structured, delivery_evidence_id: "de-other" } },
          ],
        },
      });
      value = step(value.state, { hook_event_name: "Stop", last_assistant_message: report("de-full") });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "persisted-artifact-dump") {
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
        handoffPersisted: true,
      });
      value = step(value.state, {
        hook_event_name: "Stop",
        last_assistant_message: [report("de-full"), "", exactFullEvidence].join("\n"),
      });
      assert.equal(value.output.decision, "block");
      continue;
    }
    if (entry.id === "unpersisted-duplicate-occurrence") {
      let value = beginImplementationWithEvidence("de-full", {
        artifact: exactFullEvidence,
        artifactHash: exactFullEvidenceHash,
        handoffPersisted: false,
      });
      value = step(value.state, {
        hook_event_name: "Stop",
        last_assistant_message: [
          report("de-full"),
          "",
          `\`\`\`yaml\n${exactFullEvidence}\`\`\``,
          `\`\`\`yaml\n${exactFullEvidence}\`\`\``,
        ].join("\n"),
      });
      assert.equal(value.output.decision, "block");
      continue;
    }
    assert.fail(`unhandled shared lifecycle case: ${entry.id}`);
  }
  assert.deepEqual(executed, cases.map((entry) => entry.id));
});
