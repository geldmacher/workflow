import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { formatDeliveryReportFence } from "../src/core/manual-attestation.mjs";
import { extractRootPlanText, rootContentHash, rootPlanFingerprint } from "../src/core/root-plan-attestation.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  closeoutInputMessage,
  closeoutStructured,
  planCloseoutFence,
  sharedLifecycleCasesFor,
} from "./support/manual-attestation-fixtures.mjs";

function report(id) {
  return formatDeliveryReportFence(id);
}

const hookPath = join(defaultRoot, "dist/codex/workflow-hook.mjs");

const leanRoot = `---
artifact: work-plan
schema: 5
id: wp-bundle-lean
status: ready
intent_ready: true
profile_max: manual
contract_level: lean
risk: medium
hard_triggers: []
goal: Bundle lean path for Codex planning.
acceptance:
  - Bundle path accepts a native Schema-5 Root.
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

Bundle lean path for Codex planning.

## Acceptance

Bundle path accepts a native Schema-5 Root.

### Verification

| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|---|
| CHECK-1 | OBJ-1 | repository root | node --test tests/codex-hook-bundle.test.mjs | Built Codex hook bundle enforces planning gates. | yes | machine-verifiable | standard | dist, tests |

## Boundaries

Only listed authority roots.

## Risks

Medium residual risk if the bundle drifts from source policy.

## Final implementation step

${planCloseoutFence}
`;

const leanRootHash = rootContentHash(leanRoot);
const leanRootCrlf = leanRoot.replace(/\n/g, "\r\n");
const leanRootHashCrlf = rootContentHash(leanRootCrlf);

function bundleCloseout(artifact, overrides = {}) {
  return closeoutStructured(artifact, {
    root_content_hash: leanRootHash,
    ...overrides,
  });
}

const highRoot = leanRoot
  .replace("id: wp-bundle-lean", "id: wp-bundle-high")
  .replace("risk: medium", "risk: high")
  .replace("hard_triggers: []", "hard_triggers:\n  - broad-runtime-impact");

function runHook(input, stateRoot, extraEnv = {}) {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: defaultRoot,
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      PLUGIN_DATA: stateRoot,
      ...extraEnv,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout || "{}");
}

test("built Codex hook bundle closes out natively without an MCP call", () => {
  const temporary = mkdtempSync(join(tmpdir(), "codex-hook-bundle-native-"));
  const stateRoot = join(temporary, "state");
  const repository = join(temporary, "repository");
  const extraEnv = { GELDMACHER_WORKFLOW_SHARED_ROOT: join(temporary, "handoff") };
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
      session_id: "bundle-native-session",
      turn_id: "bundle-native-plan",
      model: "gpt-parent",
      cwd: repository,
    };
    runHook({
      ...base,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle native",
    }, stateRoot, extraEnv);
    assert.deepEqual(runHook({
      ...base,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
    }, stateRoot, extraEnv), {});
    const implementation = { ...base, turn_id: "bundle-native-implementation" };
    runHook({
      ...implementation,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "default",
      prompt: "Implement the Plan",
    }, stateRoot, extraEnv);
    runHook({
      ...implementation,
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { patch: "*** Begin Patch" },
    }, stateRoot, extraEnv);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const completed = runHook({
      ...implementation,
      hook_event_name: "Stop",
      last_assistant_message: closeoutInputMessage({ rootPlanId: "wp-bundle-lean" }),
    }, stateRoot, extraEnv);
    assert.deepEqual(completed, {});
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("built Codex hook bundle runs local Manual preflight and keeps MCP preflight optional", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-hook-bundle-"));
  try {
    const base = {
      session_id: "bundle-session",
      turn_id: "bundle-turn",
      model: "gpt-parent",
      cwd: defaultRoot,
    };

    runHook({
      ...base,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle",
    }, stateRoot);

    const leanStop = runHook({
      ...base,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
    }, stateRoot);
    assert.deepEqual(leanStop, {});

    const highBase = { ...base, session_id: "bundle-session-high", turn_id: "bundle-turn-high" };
    runHook({
      ...highBase,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle high",
    }, stateRoot);

    const highAllowed = runHook({
      ...highBase,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
    }, stateRoot);
    assert.deepEqual(highAllowed, {});

    const failedBase = { ...base, session_id: "bundle-session-failed", turn_id: "bundle-turn-failed" };
    runHook({
      ...failedBase,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle failed transport",
    }, stateRoot);
    runHook({
      ...failedBase,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
      tool_input: { root_plan: highRoot },
      tool_response: {
        structuredContent: {
          feasible: false,
          blocking_issues: [{ message: "blocked" }],
          root_plan_id: "wp-bundle-high",
        },
      },
    }, stateRoot);
    const infeasible = runHook({
      ...failedBase,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
    }, stateRoot);
    assert.deepEqual(infeasible, {});

    const attestedBase = { ...base, session_id: "bundle-session-attested", turn_id: "bundle-turn-attested" };
    runHook({
      ...attestedBase,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle attested",
    }, stateRoot);
    runHook({
      ...attestedBase,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_plan_preflight",
      tool_input: { root_plan: highRoot },
      tool_response: {
        structuredContent: {
          feasible: true,
          blocking_issues: [],
          root_plan_id: "wp-bundle-high",
        },
      },
    }, stateRoot);

    const idOnly = runHook({
      ...attestedBase,
      hook_event_name: "Stop",
      last_assistant_message: "<proposed_plan>\nwp-bundle-high\n</proposed_plan>",
    }, stateRoot);
    assert.equal(idOnly.decision, "block");

    const allowed = runHook({
      ...attestedBase,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${highRoot}\n</proposed_plan>`,
    }, stateRoot);
    assert.deepEqual(allowed, {});
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("built Codex hook bundle Stop binds persistence, chain Root, and raw-byte Evidence identity", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-hook-bundle-impl-"));
  try {
    const base = {
      session_id: "bundle-impl-session",
      turn_id: "bundle-impl-plan",
      model: "gpt-parent",
      cwd: defaultRoot,
    };

    runHook({
      ...base,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle impl",
    }, stateRoot);
    const planned = runHook({
      ...base,
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
    }, stateRoot);
    assert.deepEqual(planned, {});

    const wrapperPlan = leanRoot.replace(
      planCloseoutFence,
      `Do not use attestation.\n\n${planCloseoutFence}`,
    );
    runHook({
      ...base,
      turn_id: "bundle-impl-plan-wrapper",
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle wrapper",
    }, stateRoot);
    const wrapperBlocked = runHook({
      ...base,
      turn_id: "bundle-impl-plan-wrapper",
      hook_event_name: "Stop",
      last_assistant_message: `<proposed_plan>\n${wrapperPlan}\n</proposed_plan>`,
    }, stateRoot);
    assert.equal(wrapperBlocked.decision, "block");

    const impl = {
      ...base,
      turn_id: "bundle-impl-turn",
      permission_mode: "default",
    };
    runHook({
      ...impl,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);

    const missing = runHook({
      ...impl,
      hook_event_name: "Stop",
      last_assistant_message: "Implementation complete",
    }, stateRoot);
    assert.equal(missing.decision, "block");

    const exactBundleEvidence = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/delivery-evidence.valid.md"), "utf8")
      .replace("id: de-adaptive-retry", "id: de-bundle-current")
      .replace("root_plan_id: wp-adaptive-retry", "root_plan_id: wp-bundle-lean")
      .replace("subject_id: wp-adaptive-retry", "subject_id: wp-bundle-lean");
    const exactBundleEvidenceHash = createHash("sha256").update(exactBundleEvidence).digest("hex");
    const crlfLfBundleEvidence = exactBundleEvidence.replace("id: de-bundle-current", "id: de-bundle-crlf");
    const crlfBundleEvidence = crlfLfBundleEvidence.replaceAll("\n", "\r\n");
    const crlfBundleEvidenceHash = createHash("sha256").update(crlfBundleEvidence, "utf8").digest("hex");

    runHook({
      ...impl,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: true,
        }),
      },
    }, stateRoot);

    const idOnlyPersisted = runHook({
      ...impl,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.deepEqual(idOnlyPersisted, {});

    const implPersistedAttach = { ...impl, turn_id: "bundle-impl-persisted-attach" };
    runHook({
      ...implPersistedAttach,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...implPersistedAttach,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: true,
        }),
      },
    }, stateRoot);
    const dumpedPersisted = runHook({
      ...implPersistedAttach,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-current"),
        "",
        exactBundleEvidence,
      ].join("\n"),
    }, stateRoot);
    assert.equal(dumpedPersisted.decision, "block");
    assert.match(dumpedPersisted.reason, /typed delivery-report|exact Evidence|attach|closeout/i);
    const embeddedPersisted = runHook({
      ...implPersistedAttach,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-current"),
        "",
        `PREFIX${exactBundleEvidence}SUFFIX`,
      ].join("\n"),
    }, stateRoot);
    assert.equal(embeddedPersisted.decision, "block");
    assert.match(embeddedPersisted.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

    const implUnpersisted = { ...impl, turn_id: "bundle-impl-unpersisted" };
    runHook({
      ...implUnpersisted,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...implUnpersisted,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: false,
        }),
      },
    }, stateRoot);

    const unpersistedIdOnly = runHook({
      ...implUnpersisted,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.equal(unpersistedIdOnly.decision, "block");
    assert.match(unpersistedIdOnly.reason, /typed delivery-report|exact Evidence|attach|unpersisted|closeout/i);

    const unpersistedAttached = runHook({
      ...implUnpersisted,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-current"),
        "",
        exactBundleEvidence,
      ].join("\n"),
    }, stateRoot);
    assert.deepEqual(unpersistedAttached, {});

    const implForeign = { ...impl, turn_id: "bundle-impl-foreign" };
    runHook({
      ...implForeign,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...implForeign,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-foreign" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: true,
        }),
      },
    }, stateRoot);
    const foreignRoot = runHook({
      ...implForeign,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.equal(foreignRoot.decision, "block");

    const implCrlf = { ...impl, turn_id: "bundle-impl-crlf" };
    runHook({
      ...implCrlf,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...implCrlf,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(crlfBundleEvidence, {
          delivery_evidence_id: "de-bundle-crlf",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: false,
        }),
      },
    }, stateRoot);
    const crlfHashMismatch = runHook({
      ...implCrlf,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-crlf"),
    }, stateRoot);
    assert.equal(crlfHashMismatch.decision, "block");

    runHook({
      ...implCrlf,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(crlfBundleEvidence, {
          delivery_evidence_id: "de-bundle-crlf",
          artifact_hash: crlfBundleEvidenceHash,
          handoff_persisted: false,
        }),
      },
    }, stateRoot);
    const crlfLfAttach = runHook({
      ...implCrlf,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-crlf"),
        "",
        crlfLfBundleEvidence,
      ].join("\n"),
    }, stateRoot);
    assert.equal(crlfLfAttach.decision, "block");
    const crlfExactAttach = runHook({
      ...implCrlf,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-crlf"),
        "",
        crlfBundleEvidence,
      ].join("\n"),
    }, stateRoot);
    assert.deepEqual(crlfExactAttach, {});

    const impl2 = { ...impl, turn_id: "bundle-impl-turn-2" };
    runHook({
      ...impl2,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...impl2,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: false,
        }),
      },
    }, stateRoot);

    const stale = runHook({
      ...impl2,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-stale"),
    }, stateRoot);
    assert.equal(stale.decision, "block");
    assert.match(stale.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

    const competing = runHook({
      ...impl2,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-current"),
        "",
        exactBundleEvidence,
        "and also de-bundle-stale",
      ].join("\n"),
    }, stateRoot);
    // Prose de-* mentions are non-authoritative under structured attestation.
    assert.deepEqual(competing, {});

    const implDuplicate = { ...impl, turn_id: "bundle-impl-duplicate" };
    runHook({
      ...implDuplicate,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...implDuplicate,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: false,
        }),
      },
    }, stateRoot);
    const duplicate = runHook({
      ...implDuplicate,
      hook_event_name: "Stop",
      last_assistant_message: [
        report("de-bundle-current"),
        "",
        exactBundleEvidence,
        exactBundleEvidence,
      ].join("\n"),
    }, stateRoot);
    assert.equal(duplicate.decision, "block");
    assert.match(duplicate.reason, /typed delivery-report|exact Evidence|attach|closeout/i);

    const impl3 = { ...impl, turn_id: "bundle-impl-turn-3" };
    runHook({
      ...impl3,
      hook_event_name: "UserPromptSubmit",
      prompt: "Implement the plan",
    }, stateRoot);
    runHook({
      ...impl3,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: {
          artifact: exactBundleEvidence,
          artifact_hash: exactBundleEvidenceHash,
          handoff_persisted: true,
        },
      },
    }, stateRoot);
    const missingDesignatedId = runHook({
      ...impl3,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.equal(missingDesignatedId.decision, "block");

    runHook({
      ...impl3,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: bundleCloseout(exactBundleEvidence, {
          delivery_evidence_id: "de-bundle-current",
          artifact_hash: createHash("sha256").update("not-the-artifact").digest("hex"),
          handoff_persisted: true,
        }),
      },
    }, stateRoot);
    const hashMismatch = runHook({
      ...impl3,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.equal(hashMismatch.decision, "block");

    runHook({
      ...impl3,
      hook_event_name: "PostToolUse",
      tool_name: "mcp__geldmacher_workflow__workflow_closeout",
      tool_input: { root_plan_id: "wp-bundle-lean" },
      tool_response: {
        structuredContent: {
          delivery_evidence_id: "de-bundle-current",
          artifact: exactBundleEvidence,
          artifact_hash: exactBundleEvidenceHash,
        },
      },
    }, stateRoot);
    const missingHandoffPersisted = runHook({
      ...impl3,
      hook_event_name: "Stop",
      last_assistant_message: report("de-bundle-current"),
    }, stateRoot);
    assert.equal(missingHandoffPersisted.decision, "block");

    for (const toolName of ["Task", "Agent", "spawn_agent"]) {
      const implMutate = { ...impl, turn_id: `bundle-impl-mutate-${toolName}` };
      runHook({
        ...implMutate,
        hook_event_name: "UserPromptSubmit",
        prompt: "Implement the plan",
      }, stateRoot);
      runHook({
        ...implMutate,
        hook_event_name: "PostToolUse",
        tool_name: "mcp__geldmacher_workflow__workflow_closeout",
        tool_input: { root_plan_id: "wp-bundle-lean" },
        tool_response: {
          structuredContent: bundleCloseout(exactBundleEvidence, {
            delivery_evidence_id: "de-bundle-current",
            artifact_hash: exactBundleEvidenceHash,
            handoff_persisted: true,
          }),
        },
      }, stateRoot);
      runHook({
        ...implMutate,
        hook_event_name: "PostToolUse",
        tool_name: toolName,
        tool_input: { prompt: "mutate via child" },
        tool_response: { ok: true },
      }, stateRoot);
      const afterMutate = runHook({
        ...implMutate,
        hook_event_name: "Stop",
        last_assistant_message: report("de-bundle-current"),
      }, stateRoot);
      assert.equal(afterMutate.decision, "block", toolName);
    }
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Codex bundle stores raw Root content hash as active authority", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "codex-bundle-raw-hash-"));
  try {
    const base = {
      session_id: "bundle-raw-hash",
      turn_id: "bundle-raw-hash-turn",
      model: "gpt-parent",
      cwd: defaultRoot,
    };
    runHook({
      ...base,
      hook_event_name: "UserPromptSubmit",
      permission_mode: "plan",
      prompt: "$plan-work bundle raw hash",
    }, stateRoot);
    const message = `<proposed_plan>\n${leanRootCrlf}\n</proposed_plan>`;
    assert.equal(extractRootPlanText(message), leanRootCrlf);
    runHook({
      ...base,
      hook_event_name: "Stop",
      last_assistant_message: message,
    }, stateRoot);
    const findHash = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          const nested = findHash(path);
          if (nested) return nested;
          continue;
        }
        if (!entry.name.endsWith(".json")) continue;
        const state = JSON.parse(readFileSync(path, "utf8"));
        if (typeof state.active_root_content_hash === "string") return state.active_root_content_hash;
      }
      return null;
    };
    const activeHash = findHash(stateRoot);
    assert.equal(activeHash, leanRootHashCrlf);
    assert.notEqual(activeHash, rootPlanFingerprint(leanRootCrlf));
    assert.notEqual(activeHash, leanRootHash);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("shared lifecycle matrix executes on the Codex bundle surface", () => {
  const executed = [];
  const cases = sharedLifecycleCasesFor("bundle");
  for (const entry of cases) {
    executed.push(entry.id);
    const stateRoot = mkdtempSync(join(tmpdir(), `codex-bundle-matrix-${entry.id}-`));
    try {
      const base = {
        session_id: `bundle-matrix-${entry.id}`,
        turn_id: `bundle-matrix-turn-${entry.id}`,
        model: "gpt-parent",
        cwd: defaultRoot,
      };
      if (entry.id === "missing-active-root") {
        runHook({
          ...base,
          hook_event_name: "UserPromptSubmit",
          permission_mode: "plan",
          prompt: "$plan-work bundle matrix missing root",
        }, stateRoot);
        runHook({
          ...base,
          hook_event_name: "Stop",
          last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
        }, stateRoot);
        // Keep the active Root ID so implementation starts, but drop the content hash.
        const clearHash = (dir) => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
              clearHash(path);
              continue;
            }
            if (!entry.name.endsWith(".json")) continue;
            const state = JSON.parse(readFileSync(path, "utf8"));
            delete state.active_root_content_hash;
            writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
          }
        };
        clearHash(stateRoot);
        const impl = {
          ...base,
          turn_id: `${base.turn_id}-impl`,
          permission_mode: "default",
        };
        runHook({
          ...impl,
          hook_event_name: "UserPromptSubmit",
          prompt: "Implement the plan",
        }, stateRoot);
        const artifact = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/delivery-evidence.valid.md"), "utf8")
          .replace("id: de-adaptive-retry", "id: de-bundle-missing-root")
          .replace("root_plan_id: wp-adaptive-retry", "root_plan_id: wp-bundle-lean")
          .replace("subject_id: wp-adaptive-retry", "subject_id: wp-bundle-lean");
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(artifact, {
              delivery_evidence_id: "de-bundle-missing-root",
              artifact_hash: createHash("sha256").update(artifact).digest("hex"),
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-missing-root"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }

      runHook({
        ...base,
        hook_event_name: "UserPromptSubmit",
        permission_mode: "plan",
        prompt: "$plan-work bundle matrix",
      }, stateRoot);
      runHook({
        ...base,
        hook_event_name: "Stop",
        last_assistant_message: `<proposed_plan>\n${leanRoot}\n</proposed_plan>`,
      }, stateRoot);
      const impl = {
        ...base,
        turn_id: `${base.turn_id}-impl`,
        permission_mode: "default",
      };
      runHook({
        ...impl,
        hook_event_name: "UserPromptSubmit",
        prompt: "Implement the plan",
      }, stateRoot);

      const artifact = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/delivery-evidence.valid.md"), "utf8")
        .replace("id: de-adaptive-retry", "id: de-bundle-matrix")
        .replace("root_plan_id: wp-adaptive-retry", "root_plan_id: wp-bundle-lean")
        .replace("subject_id: wp-adaptive-retry", "subject_id: wp-bundle-lean");
      const artifactHash = createHash("sha256").update(artifact).digest("hex");
      const correction = artifact
        .replace("id: de-bundle-matrix", "id: de-bundle-correction")
        .replace("subject_id: wp-bundle-lean", "subject_id: cp-bundle")
        .replace("source_review_id: null", "source_review_id: wr-bundle")
        .replace("predecessor_evidence_id: null", "predecessor_evidence_id: de-prior")
        .replace("representation: full", "representation: delta");

      if (entry.id === "same-id-root-hash-mismatch" || entry.id === "crlf-active-root-hash-mismatch") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(artifact, {
              delivery_evidence_id: "de-bundle-matrix",
              artifact_hash: artifactHash,
              root_content_hash: entry.id === "crlf-active-root-hash-mismatch"
                ? leanRootHashCrlf
                : "0".repeat(64),
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-matrix"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "foreign-active-root") {
        const foreign = artifact
          .replaceAll("wp-bundle-lean", "wp-other")
          .replace("id: de-bundle-matrix", "id: de-bundle-foreign");
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-other" },
          tool_response: {
            structuredContent: closeoutStructured(foreign, {
              delivery_evidence_id: "de-bundle-foreign",
              artifact_hash: createHash("sha256").update(foreign).digest("hex"),
              root_plan_id: "wp-other",
              root_content_hash: leanRootHash,
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-foreign"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "mutate-after-closeout") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(artifact, {
              delivery_evidence_id: "de-bundle-matrix",
              artifact_hash: artifactHash,
            }),
          },
        }, stateRoot);
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "Task",
          tool_input: { prompt: "mutate via child" },
          tool_response: { ok: true },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-matrix"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "persisted-artifact-dump") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(artifact, {
              delivery_evidence_id: "de-bundle-matrix",
              artifact_hash: artifactHash,
              handoff_persisted: true,
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: [
            report("de-bundle-matrix"),
            "",
            artifact,
          ].join("\n"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "foreign-full-root-lineage") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(correction, {
              delivery_evidence_id: "de-bundle-correction",
              artifact_hash: createHash("sha256").update(correction).digest("hex"),
              subject_id: "cp-bundle",
              source_review_id: "wr-bundle",
              predecessor_evidence_id: "de-prior",
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-correction"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "text-transport-authority") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            content: [{
              text: JSON.stringify({
                structuredContent: bundleCloseout(artifact, {
                  delivery_evidence_id: "de-bundle-matrix",
                  artifact_hash: artifactHash,
                }),
              }),
            }],
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-matrix"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "conflicting-structured-content") {
        const structured = bundleCloseout(artifact, {
          delivery_evidence_id: "de-bundle-matrix",
          artifact_hash: artifactHash,
        });
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            content: [
              { structuredContent: structured },
              { structuredContent: { ...structured, delivery_evidence_id: "de-other" } },
            ],
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: report("de-bundle-matrix"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      if (entry.id === "unpersisted-duplicate-occurrence") {
        runHook({
          ...impl,
          hook_event_name: "PostToolUse",
          tool_name: "mcp__geldmacher_workflow__workflow_closeout",
          tool_input: { root_plan_id: "wp-bundle-lean" },
          tool_response: {
            structuredContent: bundleCloseout(artifact, {
              delivery_evidence_id: "de-bundle-matrix",
              artifact_hash: artifactHash,
              handoff_persisted: false,
            }),
          },
        }, stateRoot);
        const blocked = runHook({
          ...impl,
          hook_event_name: "Stop",
          last_assistant_message: [
            report("de-bundle-matrix"),
            "",
            `\`\`\`yaml\n${artifact}\`\`\``,
            `\`\`\`yaml\n${artifact}\`\`\``,
          ].join("\n"),
        }, stateRoot);
        assert.equal(blocked.decision, "block");
        continue;
      }
      assert.fail(`unhandled shared lifecycle case: ${entry.id}`);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  }
  assert.deepEqual(executed, cases.map((entry) => entry.id));
});
