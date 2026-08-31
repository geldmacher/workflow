import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  observeNativeCreatePlan,
  prepareNativeReviewReceipt,
  selectNativeReviewRoot,
} from "../hooks/native-task-review-context.mjs";
import { nativeReviewInvocationResultPath } from "../hooks/native-review-receipt.mjs";
import { createArtifactHandlers } from "../src/mcp/artifact-handlers.mjs";
import { WorkspaceRootError } from "../src/mcp/workspace-roots.mjs";
import { defaultRoot, executionContractFromArtifactText, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import {
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  harnessContractHash,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";
import { captureRepositorySnapshot } from "../src/harness/repository-snapshot.mjs";
import { supportedCheck } from "./support/workflow-fixtures.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

function planEvent() {
  return {
    tool_name: "CreatePlan",
    conversation_id: "mcp-review-v6",
    generation_id: "plan-generation",
    tool_use_id: "create-plan-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: { name: "Workflow 6", plan: rootPlan, todos: [] },
  };
}

function selectionEvent() {
  return {
    conversation_id: "mcp-review-v6",
    generation_id: "review-generation",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    prompt: "/review-work",
  };
}

function reviewEvent() {
  return {
    tool_name: "MCP:workflow_closeout",
    conversation_id: "mcp-review-v6",
    generation_id: "review-generation",
    tool_use_id: "review-call",
    workspace_roots: [defaultRoot],
    cwd: defaultRoot,
    tool_input: {
      artifact_kind: "work-review",
      check_evidence: [supportedCheck()],
      review_input: {
        schema: 1,
        kind: "review-input",
        outcome: "achieved",
        assessment_summary: "The exact Root is supported by repository evidence.",
        snapshot_summary: "The repository can still be inspected.",
        findings: [],
        open_points: [],
      },
    },
  };
}

function repositoryFinding(key = "repository-finding", overrides = {}) {
  return {
    key,
    severity: "high",
    objective_ids: ["OBJ-1"],
    check_ids: ["CHECK-1"],
    evidence: `Repository evidence for ${key}`,
    reasoning: `Repository reasoning for ${key}`,
    resolution: "correct",
    ...overrides,
  };
}

function reviewInputWithFindings(findings, overrides = {}) {
  const fixes = findings.map((finding) => ({
    key: `fix-${finding.key}`,
    finding_keys: [finding.key],
    required_outcome: `Resolve ${finding.key}.`,
    evidence: `The correction remains bounded to ${finding.key}.`,
  }));
  return {
    ...reviewEvent().tool_input.review_input,
    outcome: findings.length > 0 ? "correction-needed" : "achieved",
    findings,
    correction: findings.length > 0 ? {
      fixes,
      steps: fixes.map((fix) => ({
        key: `step-${fix.key}`,
        fix_keys: [fix.key],
        targets: ["src"],
        required_outcome: fix.required_outcome,
        implementation_latitude: "The project harness chooses the concrete implementation.",
        completion_probe: "The original Root Check is ready for fresh Review.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point if Root authority is insufficient.",
      })),
    } : undefined,
    ...overrides,
  };
}

function establishReceipt(stateRoot, nativeOptions = { workspaceRoot: defaultRoot }, event = reviewEvent()) {
  assert.equal(observeNativeCreatePlan({
    stateRoots: [stateRoot],
    input: planEvent(),
    pluginRoot: defaultRoot,
    options: nativeOptions,
  }).status, "observed");
  assert.equal(selectNativeReviewRoot({
    stateRoots: [stateRoot],
    input: selectionEvent(),
    pluginRoot: defaultRoot,
    options: nativeOptions,
  }).status, "selected");
  const prepared = prepareNativeReviewReceipt({
    stateRoots: [stateRoot],
    input: event,
    pluginRoot: defaultRoot,
    options: nativeOptions,
  });
  assert.equal(prepared.status, "prepared");
  return prepared;
}

function protectedSealHarness(workspaceBinding, snapshotHash) {
  const check = executionContractFromArtifactText(rootPlan, defaultRoot).checks[0];
  const raw = {
    schema: HARNESS_CHECK_ATTESTATION_SCHEMA,
    kind: "harness-check-attestation",
    harness_id: "project-harness",
    check_id: "CHECK-1",
    root_hash: createHash("sha256").update(rootPlan).digest("hex"),
    verification_intent_hash: verificationIntentHash(check),
    workspace_binding: workspaceBinding,
    workspace_snapshot_hash: snapshotHash,
    status: "passed",
    observed: "Protected sealing verified the exact Check intent.",
    evidence_hashes: ["f".repeat(64)],
    issued_at: "2026-08-25T10:00:00.000Z",
  };
  return {
    mode: "protected",
    status: "completed",
    blockers: [],
    request: { transition_id: "seal-transition", workspace_binding: workspaceBinding },
    result: {
      status: "completed",
      harness_id: "project-harness",
      workspace_snapshot_before: snapshotHash,
      workspace_snapshot_after: snapshotHash,
      changed_paths: [],
      check_attestations: [{ ...raw, content_hash: harnessContractHash(raw) }],
    },
    commitProtection: async () => ({ receipt_hash: "1".repeat(64) }),
  };
}

test("MCP roots transport failure preserves the receipt-bound Root and canonical workspace", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  try {
    const prepared = establishReceipt(stateRoot);
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => {
        throw new WorkspaceRootError("roots-request-failed", "simulated MCP roots/list transport failure");
      },
      resolveCursorReceiptContext: () => ({
        workspace: defaultRoot,
        stateRoot,
      }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const response = await handlers.closeout(prepared.updated_input);
    assert.equal(response.isError, false, response.value?.error);
    assert.equal(response.value.root_plan_id, "wp-adaptive-retry");
    assert.equal(response.value.workspace_root, defaultRoot);
    assert.equal(response.value.workspace_binding, "cursor-native-receipt");
    assert.equal(response.value.outcome, "achieved");
    assert.equal(response.value.task_local_valid, true);
    assert.doesNotMatch(JSON.stringify(response.value), /Root is unavailable|native-plan-unavailable/i);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor protected sealing appends a verified pair without rewriting local provisional bytes", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-seal-"));
  try {
    const snapshot = captureRepositorySnapshot(defaultRoot);
    const local = buildManualReviewLifecycle({
      rootPlanText: rootPlan,
      reviewInput: reviewEvent().tool_input.review_input,
      checkEvidence: [supportedCheck()],
      workspaceRoot: defaultRoot,
      pluginRoot: defaultRoot,
      repositoryBaseline: snapshot,
      repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
      captureSnapshot: () => structuredClone(snapshot),
    });
    const localArtifacts = [
      { label: local.delivery_evidence.fields.id, text: local.delivery_evidence.artifact },
      { label: local.review.fields.id, text: local.review.artifact },
    ];
    const verifiedInput = {
      ...reviewEvent().tool_input.review_input,
      assessment_summary: "Fresh protected evidence satisfies the exact Root.",
    };
    const event = {
      ...reviewEvent(),
      tool_input: {
        ...reviewEvent().tool_input,
        review_input: verifiedInput,
        seal_artifacts: localArtifacts,
      },
    };
    const prepared = establishReceipt(stateRoot, { workspaceRoot: defaultRoot }, event);
    const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
    const harness = protectedSealHarness(workspaceBinding, "e".repeat(64));
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      reviewHarnessPhase: async () => harness,
      result: (value, isError = false) => ({ value, isError }),
    });
    const response = await handlers.closeout(prepared.updated_input);
    assert.equal(response.isError, false, response.value?.error);
    assert.equal(response.value.chain_update, "append-seal");
    assert.equal(response.value.outcome, "achieved");
    assert.equal(response.value.next_action, "none");
    const evidence = inspectArtifactText(response.value.delivery_evidence_artifact, defaultRoot).artifact.fields;
    const review = inspectArtifactText(response.value.artifact, defaultRoot).artifact.fields;
    assert.equal(evidence.representation, "seal");
    assert.equal(evidence.predecessor_evidence_id, local.delivery_evidence.fields.id);
    assert.equal(evidence.source_review_id, local.review.fields.id);
    assert.equal(review.predecessor_review_id, local.review.fields.id);
    assert.equal(localArtifacts[0].text, local.delivery_evidence.artifact);
    assert.equal(localArtifacts[1].text, local.review.artifact);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review availability failures return non-authoritative Shadow results without artifacts", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-shadow-"));
  try {
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const missing = await handlers.closeout({
      ...reviewEvent().tool_input,
      review_input: reviewInputWithFindings([repositoryFinding("cursor-shadow-finding")]),
    });
    assert.equal(missing.isError, false);
    assert.equal(missing.value.mode, "shadow");
    assert.equal(missing.value.status, "unavailable");
    assert.equal(missing.value.artifacts_persisted, false);
    assert.equal(missing.value.workflow_state_changed, false);
    assert.equal(missing.value.persistence_scope, "none");
    assert.equal(missing.value.repository_findings_authoritative, false);
    assert.deepEqual(missing.value.repository_findings, [{
      key: "cursor-shadow-finding",
      severity: "high",
      evidence: "Repository evidence for cursor-shadow-finding",
      reasoning: "Repository reasoning for cursor-shadow-finding",
    }]);
    assert.equal(missing.value.delivery_evidence_id, undefined);
    assert.equal(missing.value.work_review_id, undefined);
    assert.equal(missing.value.recovery_action, "human-assessment");

    const prepared = establishReceipt(stateRoot, {
      workspaceRoot: defaultRoot,
      now: () => new Date("2026-08-25T10:00:00.000Z"),
    });
    const expiredHandlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      receiptOptions: { now: () => new Date("2026-08-25T10:06:00.000Z") },
      result: (value, isError = false) => ({ value, isError }),
    });
    const expired = await expiredHandlers.closeout(prepared.updated_input);
    assert.equal(expired.isError, false);
    assert.equal(expired.value.mode, "shadow");
    assert.equal(expired.value.reason_code, "native-task-receipt-expired");
    assert.equal(expired.value.artifacts_persisted, false);
    assert.equal(expired.value.persistence_scope, "none");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review replays one exact committed invocation result", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-replay-"));
  try {
    const prepared = establishReceipt(stateRoot);
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const first = await handlers.closeout(prepared.updated_input);
    const replayed = await handlers.closeout(prepared.updated_input);
    assert.equal(first.isError, false, first.value?.error);
    assert.equal(replayed.isError, false, replayed.value?.error);
    assert.equal(first.value.mode, "formal");
    assert.equal(first.value.artifacts_persisted, true);
    assert.equal(first.value.workflow_state_changed, true);
    assert.equal(first.value.persistence_scope, "native-review-invocation");
    assert.equal(replayed.value.work_review_id, first.value.work_review_id);
    assert.equal(replayed.value.delivery_evidence_id, first.value.delivery_evidence_id);
    assert.equal(replayed.value.artifact_hash, first.value.artifact_hash);
    assert.equal(replayed.value.repository_state_hash, first.value.repository_state_hash);
    assert.deepEqual(replayed.value, first.value);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review never overwrites a malformed committed invocation slot", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-result-conflict-"));
  try {
    const prepared = establishReceipt(stateRoot);
    const resultPath = nativeReviewInvocationResultPath(stateRoot, prepared.token);
    mkdirSync(dirname(resultPath), { recursive: true });
    writeFileSync(resultPath, "{malformed\n");
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "cursor",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const response = await handlers.closeout(prepared.updated_input);
    assert.equal(response.isError, true);
    assert.equal(response.value.error_code, "native-review-result-commit-failed");
    assert.match(response.value.error, /idempotent Review result \(conflict\)/);
    assert.equal(readFileSync(resultPath, "utf8"), "{malformed\n");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Cursor Review reports missing selection separately from missing Root before MCP handling", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  try {
    assert.equal(observeNativeCreatePlan({
      stateRoots: [stateRoot],
      input: planEvent(),
      pluginRoot: defaultRoot,
      options: { workspaceRoot: defaultRoot },
    }).status, "observed");
    const prepared = prepareNativeReviewReceipt({
      stateRoots: [stateRoot],
      input: reviewEvent(),
      pluginRoot: defaultRoot,
      options: { workspaceRoot: defaultRoot },
    });
    assert.equal(prepared.status, "unavailable");
    assert.equal(prepared.reason, "review-selection-unavailable");
    assert.equal(prepared.root_plan_id, "wp-adaptive-retry");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Codex and portable Review stay Shadow before Harness orchestration or artifact construction", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-"));
  let harnessCalls = 0;
  let operationalCalls = 0;
  try {
    const input = {
      ...reviewEvent().tool_input,
      root_plan_id: "wp-adaptive-retry",
      root_plan: rootPlan,
      review_input: reviewInputWithFindings([
        repositoryFinding("second-finding"),
        repositoryFinding("first-finding", { severity: "medium" }),
      ]),
    };
    for (const clientHost of ["codex", "portable"]) {
      const handlers = createArtifactHandlers({
        pluginRoot: defaultRoot,
        clientHost,
        resolveOperationalContext: async () => {
          operationalCalls += 1;
          return { workspace: defaultRoot, stateRoot };
        },
        reviewHarnessPhase: async () => {
          harnessCalls += 1;
          return { mode: "protected", status: "completed", blockers: [], result: { status: "completed" } };
        },
        result: (value, isError = false) => ({ value, isError }),
      });
      const response = await handlers.closeout(input);
      assert.equal(response.isError, false, response.value?.error);
      assert.equal(response.value.mode, "shadow");
      assert.equal(response.value.reason_code, "protected-review-binding-unavailable");
      assert.equal(response.value.artifacts_persisted, false);
      assert.equal(response.value.workflow_state_changed, false);
      assert.equal(response.value.persistence_scope, "none");
      assert.equal(response.value.repository_findings_authoritative, false);
      assert.deepEqual(response.value.repository_findings.map((finding) => finding.key), ["second-finding", "first-finding"]);
      assert.deepEqual(Object.keys(response.value.repository_findings[0]), ["key", "severity", "evidence", "reasoning"]);
      assert.match(response.value.repository_outcome, /2 non-authoritative repository findings are available/);
      for (const forbidden of ["delivery_evidence_id", "work_review_id", "artifact", "artifact_hash", "evidence_grade", "check_evidence"]) {
        assert.equal(response.value[forbidden], undefined, `${clientHost} Shadow leaked ${forbidden}`);
      }
    }
    assert.equal(harnessCalls, 0);
    assert.equal(operationalCalls, 0);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

test("Shadow findings require one valid closed Schema-1 review input and stay bounded", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-v6-mcp-shadow-findings-"));
  try {
    const handlers = createArtifactHandlers({
      pluginRoot: defaultRoot,
      clientHost: "portable",
      resolveOperationalContext: async () => ({ workspace: defaultRoot, stateRoot }),
      result: (value, isError = false) => ({ value, isError }),
    });
    const base = {
      ...reviewEvent().tool_input,
      root_plan_id: "wp-adaptive-retry",
      root_plan: rootPlan,
    };
    const malformed = await handlers.closeout({
      ...base,
      review_input: { ...reviewInputWithFindings([repositoryFinding()]), caller_authority: true },
    });
    assert.equal(malformed.isError, false);
    assert.deepEqual(malformed.value.repository_findings, []);
    assert.match(malformed.value.repository_outcome, /0 non-authoritative repository findings are available/);

    const oversized = await handlers.closeout({
      ...base,
      review_input: reviewInputWithFindings(Array.from({ length: 33 }, (_, index) => repositoryFinding(`finding-${index + 1}`))),
    });
    assert.equal(oversized.isError, false);
    assert.deepEqual(oversized.value.repository_findings, []);

    const bounded = await handlers.closeout({
      ...base,
      review_input: reviewInputWithFindings(Array.from({ length: 32 }, (_, index) => repositoryFinding(`finding-${index + 1}`))),
    });
    assert.equal(bounded.value.repository_findings.length, 32);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});
