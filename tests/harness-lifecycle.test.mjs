import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateAutomationGuard } from "../hooks/automation-guard.mjs";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";
import { createHarnessLifecycleController } from "../src/controller/harness-lifecycle.mjs";
import {
  HARNESS_CAPABILITY_RECEIPT_SCHEMA,
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  HARNESS_PHASE_CONTRACT_SCHEMA,
  harnessContractHash,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";
import { createHostDecisionReceiptAdapter } from "../src/harness/host-decision-receipts.mjs";
import { createHostHarnessTrustAdapter } from "../src/harness/host-trust-adapter.mjs";
import { createProtectedHarnessBinding } from "../src/harness/module-adapter.mjs";
import { readProtectedRecord, writeProtectedRecord } from "../src/core/protected-record-store.mjs";
import { authorityCore, rootPlan } from "./support/workflow-fixtures.mjs";

const manualRoot = rootPlan("manual");
const supervisedRoot = rootPlan("supervised");
const harnessId = "project-harness";
const deploymentBindingHash = "5".repeat(64);
const before = "1".repeat(64);
const after = "2".repeat(64);

function signed(value, field = "content_hash") {
  return { ...value, [field]: harnessContractHash(value) };
}

function capability(workspaceBinding, qualificationKeys = []) {
  return signed({
    schema: HARNESS_CAPABILITY_RECEIPT_SCHEMA,
    kind: "harness-capability-receipt",
    harness_id: harnessId,
    harness_version: "1.0.0",
    deployment_binding_hash: deploymentBindingHash,
    workspace_binding: workspaceBinding,
    capabilities: ["phase-execution", "authority-enforcement", "read-only-review", "workspace-snapshot", "evidence-attestation", "budget-reporting", "cancellation"],
    qualification_keys: qualificationKeys,
    policy_hash: "3".repeat(64),
    issued_at: "2026-08-25T00:00:00.000Z",
    expires_at: "2099-08-25T00:00:00.000Z",
  });
}

function attestation(request, check, snapshot, status = "passed") {
  return signed({
    schema: HARNESS_CHECK_ATTESTATION_SCHEMA,
    kind: "harness-check-attestation",
    harness_id: harnessId,
    check_id: check["Check ID"],
    root_hash: request.root_hash,
    verification_intent_hash: verificationIntentHash(check),
    workspace_binding: request.workspace_binding,
    workspace_snapshot_hash: snapshot,
    status,
    observed: status === "passed" ? "The verification intent passed." : "The verification intent failed.",
    evidence_hashes: status === "passed" ? ["4".repeat(64)] : [],
    issued_at: "2026-08-25T00:00:00.000Z",
  });
}

function correctionReviewInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One protected verification outcome remains unsatisfied.",
    snapshot_summary: "The failed outcome is bound to the reviewed repository snapshot.",
    findings: [{
      key: "verification-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The project Harness attested that CHECK-1 failed.",
      reasoning: "The Root acceptance outcome is not established on the current snapshot.",
      resolution: "correct",
    }],
    open_points: [],
    correction: {
      fixes: [{
        key: "close-gap",
        finding_keys: ["verification-gap"],
        required_outcome: "Establish the Root acceptance outcome.",
        evidence: "The correction remains bounded to OBJ-1 and CHECK-1.",
      }],
      steps: [{
        key: "apply-correction",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Establish the Root acceptance outcome.",
        implementation_latitude: "The project Harness chooses the concrete implementation.",
        completion_probe: "The corrected acceptance outcome is observable.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point if the Root authority must change.",
      }],
    },
  };
}

function harness(workspaceBinding, reviewStatuses = ["passed"], qualificationKeys = [], counters = {}, failExecutionOncePhase = null, includeReviewInput = true, blockOncePhase = null, reviewSnapshot = after, suppliedReviewInput = correctionReviewInput()) {
  let reviewIndex = 0;
  return {
    capabilityReceipt: async () => capability(workspaceBinding, qualificationKeys),
    executePhase: async (request, context) => {
      counters[request.phase] = (counters[request.phase] ?? 0) + 1;
      if (request.phase === failExecutionOncePhase && counters[request.phase] === 1) throw new Error("host lost the unstaged phase result");
      const review = request.phase === "review";
      const blockedOnce = request.phase === blockOncePhase && counters[request.phase] === 1;
      const status = blockedOnce ? "failed" : review ? (reviewStatuses[Math.min(reviewIndex++, reviewStatuses.length - 1)] ?? "passed") : "passed";
      if (status === "invalid") return { invalid: true };
      const snapshotBefore = request.phase === "implementation" ? before : review ? reviewSnapshot : after;
      const snapshotAfter = review ? reviewSnapshot : after;
      return signed({
        schema: HARNESS_PHASE_CONTRACT_SCHEMA,
        kind: "harness-phase-result",
        phase: request.phase,
        status: status === "failed" ? "blocked" : "completed",
        harness_id: harnessId,
        deployment_binding_hash: deploymentBindingHash,
        capability_receipt_hash: context.capability_protection_hash,
        phase_request_hash: harnessContractHash(request),
        transition_id: request.transition_id,
        root_hash: request.root_hash,
        workspace_binding: request.workspace_binding,
        workspace_snapshot_before: snapshotBefore,
        workspace_snapshot_after: snapshotAfter,
        changed_paths: review ? [] : ["src/retry.mjs"],
        check_attestations: request.verification_intents.map((check) => attestation(request, check, snapshotAfter, status)),
        ...(review && status === "failed" && includeReviewInput ? { review_input: suppliedReviewInput } : {}),
        usage: { active_minutes: 1, total_tokens: 20, cost_usd: 0 },
        limitations: [],
      });
    },
  };
}

function setup({ reviewStatuses = ["passed"], qualificationKeys = [], faultInjector = null, failExecutionOncePhase = null, includeReviewInput = true, blockOncePhase = null, reviewSnapshot = after, reviewInput = correctionReviewInput(), commitReceiptMismatch = false, capabilityFailures = [], capabilityFailurePhase = null, controllerOptions = {} } = {}) {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-6-lifecycle-"));
  const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
  const trustAdapter = createHostHarnessTrustAdapter({ stateRoot, harnessId });
  const decisionReceiptAdapter = createHostDecisionReceiptAdapter({ stateRoot });
  const counters = {};
  const harnessCapability = capability(workspaceBinding, qualificationKeys);
  const baseHarnessBinding = createProtectedHarnessBinding({
    harness: harness(workspaceBinding, reviewStatuses, qualificationKeys, counters, failExecutionOncePhase, includeReviewInput, blockOncePhase, reviewSnapshot, reviewInput),
    harnessId,
    deploymentBindingHash,
    trustAdapter,
  });
  let capabilityFailureIndex = 0;
  const harnessBinding = Object.freeze({
    ...baseHarnessBinding,
    async protectedCapability(input) {
      if ((!capabilityFailurePhase || input.request?.phase === capabilityFailurePhase) && capabilityFailureIndex < capabilityFailures.length) {
        throw new Error(capabilityFailures[capabilityFailureIndex++]);
      }
      return baseHarnessBinding.protectedCapability(input);
    },
    async commitPhase(input) {
      counters.phase_commits = (counters.phase_commits ?? 0) + 1;
      const protectedResult = await baseHarnessBinding.commitPhase(input);
      return commitReceiptMismatch ? { receipt_hash: "0".repeat(64) } : protectedResult;
    },
  });
  const protectedCapability = trustAdapter.issue({
    kind: "harness-capability",
    payload: harnessCapability,
    bindings: { harness_id: harnessId, workspace_binding: workspaceBinding, deployment_binding_hash: deploymentBindingHash },
    reusable: true,
  });
  const controller = createHarnessLifecycleController({
    stateRoot,
    workspaceBinding,
    pluginRoot: defaultRoot,
    harnessBinding,
    decisionReceiptAdapter,
    faultInjector,
    ...controllerOptions,
  });
  return { stateRoot, workspaceBinding, decisionReceiptAdapter, controller, counters, protectedCapability, harnessBinding };
}

function peerController(context, options = {}) {
  return createHarnessLifecycleController({
    stateRoot: context.stateRoot,
    workspaceBinding: context.workspaceBinding,
    pluginRoot: defaultRoot,
    harnessBinding: context.harnessBinding,
    decisionReceiptAdapter: context.decisionReceiptAdapter,
    ...options,
  });
}

function cursorDecision(context, run, action, toolUseId) {
  const identity = {
    conversation_id: "cursor-public-automation-e2e",
    generation_id: `${action}-${run.run_id}-${run.revision}`,
    workspace_root: defaultRoot,
  };
  const options = { stateRoot: context.stateRoot, workspaceRoot: defaultRoot };
  evaluateAutomationGuard({
    ...identity,
    hook_event_name: "beforeSubmitPrompt",
    prompt: `/auto-work ${action} ${run.run_id}@${run.revision}`,
  }, options);
  const guarded = evaluateAutomationGuard({
    ...identity,
    hook_event_name: "preToolUse",
    tool_name: "MCP:workflow_prepare",
    tool_use_id: toolUseId,
    tool_input: {
      action,
      run_id: run.run_id,
      expected_revision: run.revision,
      idempotency_key: `${action}-${run.revision}`,
    },
  }, options);
  assert.match(guarded.updated_input?.human_decision_receipt ?? "", /^[A-Za-z0-9_-]{43}$/);
  return { identity, options, toolUseId, input: guarded.updated_input };
}

async function authorizePhase(context, run, action, toolUseId = `${action}-tool-${run.revision}`) {
  const decision = cursorDecision(context, run, action, toolUseId);
  return context.controller.control({
    runId: run.run_id,
    action,
    expectedRevision: run.revision,
    idempotencyKey: decision.input.idempotency_key,
    humanDecisionReceipt: decision.input.human_decision_receipt,
  });
}

async function reviewCurrent(context, run, toolUseId) {
  assert.equal(run.workflow_state, "review-needed", JSON.stringify(run));
  assert.equal(run.next_action, "review-work");
  return authorizePhase(context, run, "review", toolUseId);
}

async function implementAndReview(context, options = {}) {
  const implemented = await context.controller.start({
    rootPlanText: options.rootPlanText ?? supervisedRoot,
    requestedProfile: options.requestedProfile ?? "supervised",
    idempotencyKey: options.idempotencyKey ?? "implement",
  });
  const reviewed = await reviewCurrent(context, implemented.run, options.toolUseId);
  return { implemented, reviewed };
}

function artifactHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

test("Supervised implementation stops at Review needed and a separate Review Work reaches Achieved", async () => {
  const context = setup();
  try {
    const { implemented, reviewed } = await implementAndReview(context, { idempotencyKey: "start-1" });
    assert.equal(implemented.run.workflow_state, "review-needed");
    assert.equal(implemented.run.artifacts.length, 0);
    assert.equal(implemented.run.phase_receipt_hashes.length, 1);
    assert.equal(reviewed.run.workflow_state, "achieved", JSON.stringify(reviewed.run));
    assert.equal(reviewed.run.effective_profile, "supervised");
    assert.equal(reviewed.run.artifacts.length, 2);
    assert.equal(reviewed.run.phase_receipt_hashes.length, 2);
    assert.equal(reviewed.run.evidence_grade, "verified");
    assert.equal(reviewed.run.decision_receipt_hashes.length, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a lost MCP response replays the exact committed Correct Work decision without a new decision", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "transport-commit-start" });
    assert.equal(started.run.workflow_state, "correction-needed");
    const decision = cursorDecision(context, started.run, "correct", "transport-tool-1");
    const accepted = await context.controller.control({
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    assert.equal(accepted.run.workflow_state, "review-needed");
    assert.equal(accepted.run.artifacts.length, 2);
    evaluateAutomationGuard({
      ...decision.identity,
      hook_event_name: "postToolUseFailure",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: decision.toolUseId,
      error_message: "MCP transport connection closed after dispatch",
    }, decision.options);
    const { human_decision_receipt: ignored, ...exactCall } = decision.input;
    const driftedRetry = evaluateAutomationGuard({
      ...decision.identity,
      hook_event_name: "preToolUse",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: "transport-tool-drift",
      tool_input: { ...exactCall, idempotency_key: "different-retry" },
    }, decision.options);
    assert.equal(driftedRetry.permission, "deny");
    assert.match(driftedRetry.user_message, /transport retry differs/);
    const replayGuard = evaluateAutomationGuard({
      ...decision.identity,
      hook_event_name: "preToolUse",
      tool_name: "MCP:workflow_prepare",
      tool_use_id: "transport-tool-2",
      tool_input: exactCall,
    }, decision.options);
    assert.equal(replayGuard.updated_input.human_decision_receipt, decision.input.human_decision_receipt);
    const replayed = await context.controller.control({
      runId: exactCall.run_id,
      action: exactCall.action,
      expectedRevision: exactCall.expected_revision,
      idempotencyKey: exactCall.idempotency_key,
      humanDecisionReceipt: replayGuard.updated_input.human_decision_receipt,
    });
    assert.equal(replayed.duplicate, true);
    assert.equal(replayed.run.workflow_state, "review-needed");
    evaluateAutomationGuard({ ...decision.identity, hook_event_name: "postToolUse", tool_name: "MCP:workflow_prepare", tool_use_id: "transport-tool-2" }, decision.options);
    const finalReview = await reviewCurrent(context, replayed.run, "transport-review");
    assert.equal(finalReview.run.workflow_state, "achieved");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("failed Review blocks, protected correction reruns, and Autonomous gaps downgrade to Supervised", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const autonomousWithoutCertification = rootPlan("autonomous", { certification: {
      qualification_key: "qk-missing",
      harness_capability_receipt_hash: "9".repeat(64),
      verification_intent_hash: "8".repeat(64),
      certified_region: "src",
    } });
    const { implemented, reviewed: started } = await implementAndReview(context, {
      rootPlanText: autonomousWithoutCertification,
      requestedProfile: "autonomous",
      idempotencyKey: "start-2",
    });
    assert.equal(implemented.run.workflow_state, "review-needed");
    assert.equal(started.run.effective_profile, "supervised");
    assert.match(started.run.downgrade_reason, /autonomous-/);
    assert.equal(started.run.workflow_state, "correction-needed");

    const decision = cursorDecision(context, started.run, "correct", "correction-tool-1");
    const corrected = await context.controller.control({
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    assert.equal(corrected.run.workflow_state, "review-needed");
    assert.equal(corrected.run.effective_profile, "supervised");
    assert.equal(corrected.run.artifacts.length, 2);
    const freshReview = await reviewCurrent(context, corrected.run, "correction-review");
    assert.equal(freshReview.run.workflow_state, "achieved");
    assert.equal(freshReview.run.artifacts.length, 4);
    assert.match(freshReview.run.artifacts[2].text, /representation: delta/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("qualified Autonomous runs achieve without a final human gate", async () => {
  const context = setup({ qualificationKeys: ["qk-retry"] });
  try {
    const verificationIntents = executionContractFromArtifactText(supervisedRoot, defaultRoot).checks;
    const autonomousRoot = rootPlan("autonomous", { certification: {
      qualification_key: "qk-retry",
      harness_capability_receipt_hash: context.protectedCapability.receipt_hash,
      verification_intent_hash: harnessContractHash(verificationIntents),
      certified_region: "src",
    } });
    const { implemented, reviewed } = await implementAndReview(context, { rootPlanText: autonomousRoot, requestedProfile: "autonomous", idempotencyKey: "start-autonomous" });
    assert.equal(implemented.run.workflow_state, "review-needed");
    assert.equal(reviewed.run.effective_profile, "autonomous");
    assert.equal(reviewed.run.workflow_state, "achieved");
    assert.equal(reviewed.run.next_action, "none");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("technical Review retry stays internal and does not re-run implementation", async () => {
  const context = setup({ reviewStatuses: ["invalid", "passed"] });
  try {
    const implemented = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "start-recovery" });
    const reviewed = await reviewCurrent(context, implemented.run, "retry-review");
    assert.equal(reviewed.run.workflow_state, "achieved");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review, 2);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("changing technical Review failure signatures exhaust the internal retry budget as one Environment Open Point", async () => {
  const context = setup({
    capabilityFailurePhase: "review",
    capabilityFailures: Array.from({ length: 9 }, (_, index) => `temporary-capability-failure-${index + 1}`),
  });
  try {
    const implemented = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "retry-budget" });
    const reviewed = await reviewCurrent(context, implemented.run, "retry-budget-review");
    assert.equal(reviewed.run.workflow_state, "open-points");
    assert.equal(reviewed.run.next_action, "human-assessment");
    assert.equal(reviewed.run.retry_safe, true);
    assert.equal(reviewed.run.open_points[0].type, "environment");
    assert.match(reviewed.run.open_points[0].summary, /retry budget ended/);
    assert.match(reviewed.run.open_points[0].evidence, /temporary-capability-failure-9/);
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("prepared and staged implementation transitions recover idempotently and stop at Review needed", async () => {
  for (const point of ["after-prepare", "after-harness-stage", "after-result-stage", "after-finalization-ready", "after-protection-commit", "before-finalize"]) {
    let injected = false;
    const context = setup({
      faultInjector: async (candidate) => {
        if (!injected && candidate === point) {
          injected = true;
          throw new Error(`fault:${point}`);
        }
      },
    });
    try {
      await assert.rejects(() => context.controller.start({
        rootPlanText: supervisedRoot,
        requestedProfile: "supervised",
        idempotencyKey: `fault-${point}`,
      }), new RegExp(`fault:${point}`));
      const recovered = await context.controller.start({
        rootPlanText: supervisedRoot,
        requestedProfile: "supervised",
        idempotencyKey: `fault-${point}`,
      });
      assert.equal(recovered.duplicate, true);
      assert.equal(recovered.run.workflow_state, "review-needed", point);
      assert.equal(context.counters.implementation, 1, `${point}: implementation replayed`);
      assert.equal(context.counters.review ?? 0, 0, `${point}: Review crossed the human gate`);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("independent controllers observe an identical live start without waiting or duplicating execution", async () => {
  const context = setup();
  try {
    const peer = peerController(context);
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "concurrent-start" };
    const results = await Promise.all([context.controller.start(input), peer.start(input)]);
    const observed = results.find((entry) => entry.in_progress);
    const completed = results.find((entry) => !entry.in_progress);
    assert.equal(observed.duplicate, true);
    assert.equal(observed.run.workflow_state, "root-ready");
    assert.equal(observed.run.next_action, "none");
    assert.equal(completed.run.workflow_state, "review-needed");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review ?? 0, 0);
    const replay = await peer.start(input);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.in_progress, false);
    assert.equal(replay.run.workflow_state, "review-needed");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a dead mutating lease recovers only host staging and never blindly invokes the Harness", async () => {
  for (const [faultPoint, expectedLifecycle, expectedExecutions] of [
    ["after-execution-claim", "open-points", 0],
    ["after-harness-stage", "review-needed", 1],
  ]) {
    let injected = false;
    const deadPid = 999_991;
    const context = setup({
      controllerOptions: { controllerInstanceId: `dead-${faultPoint}`, ownerPid: deadPid },
      faultInjector: async (point) => {
        if (!injected && point === faultPoint) {
          injected = true;
          throw new Error(`owner-crash:${faultPoint}`);
        }
      },
    });
    try {
      const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: `dead-lease-${faultPoint}` };
      await assert.rejects(() => context.controller.start(input), new RegExp(`owner-crash:${faultPoint}`));
      const recovery = peerController(context, {
        controllerInstanceId: `recovery-${faultPoint}`,
        pidIsAlive: (pid) => pid === deadPid ? false : true,
      });
      const recovered = await recovery.start(input);
      assert.equal(recovered.duplicate, true);
      assert.equal(recovered.in_progress, false);
      assert.equal(recovered.run.workflow_state, expectedLifecycle);
      assert.equal(context.counters.implementation ?? 0, expectedExecutions);
      if (faultPoint === "after-execution-claim") {
        assert.equal(recovered.run.next_action, "human-assessment");
        assert.equal(recovered.run.retry_safe, false);
      }
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("a real crashed subprocess lease cannot cause blind mutating execution", async () => {
  let prepared = null;
  const context = setup({
    reviewStatuses: ["failed", "passed"],
    faultInjector: async (point, detail) => {
      if (!prepared && point === "after-prepare") {
        prepared = detail;
        throw new Error("leave-prepared-for-child");
      }
    },
  });
  try {
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "real-child-crash" };
    await assert.rejects(() => context.controller.start(input), /leave-prepared-for-child/);
    const child = spawnSync(process.execPath, [join(defaultRoot, "tests/support/lifecycle-dead-owner.mjs"), context.stateRoot, prepared.runId], { encoding: "utf8" });
    assert.equal(child.status, 86, child.stderr);
    const recovered = await peerController(context).start(input);
    assert.equal(recovered.run.workflow_state, "open-points");
    assert.equal(recovered.run.next_action, "human-assessment");
    assert.equal(context.counters.implementation ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("independent controllers converge while an explicitly authorized read-only Review retry is active", async () => {
  const context = setup({ reviewStatuses: ["invalid", "passed"] });
  try {
    const peer = peerController(context);
    const implemented = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "concurrent-review-retry" });
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "review",
      context: { run_id: implemented.run.run_id, revision: implemented.run.revision, evidence_hash: null, review_hash: null },
    });
    const input = { runId: implemented.run.run_id, action: "review", expectedRevision: implemented.run.revision, idempotencyKey: "concurrent-review", humanDecisionReceipt: receipt.receipt };
    const results = await Promise.all([context.controller.control(input), peer.control(input)]);
    const observed = results.find((entry) => entry.in_progress);
    const completed = results.find((entry) => !entry.in_progress);
    assert.equal(observed.duplicate, true);
    assert.equal(completed.run.workflow_state, "achieved");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review, 2);
    const replay = await peer.control(input);
    assert.equal(replay.run.workflow_state, "achieved");
    assert.equal(replay.in_progress, false);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("independent controllers observe an identical live human decision and commit it once", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const peer = peerController(context);
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "control-concurrency-start" });
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "correct",
      context: {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      },
    });
    const input = {
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: "shared-control-key",
      humanDecisionReceipt: receipt.receipt,
    };
    const accepted = await Promise.all([context.controller.control(input), peer.control(input)]);
    const observed = accepted.find((entry) => entry.in_progress);
    const completed = accepted.find((entry) => !entry.in_progress);
    assert.equal(observed.duplicate, true);
    assert.equal(observed.run.workflow_state, "correction-needed");
    assert.equal(completed.run.workflow_state, "review-needed");
    assert.equal(completed.run.decision_receipt_hashes.length, 2);
    const replay = await peer.control(input);
    assert.equal(replay.in_progress, false);
    assert.equal(replay.run.workflow_state, "review-needed");
    await assert.rejects(() => context.controller.control({
      ...input,
      action: "review",
      expectedRevision: completed.run.revision,
    }), /idempotency key conflicts/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("start idempotency is workspace-wide, input-bound, and preserves revision zero", async () => {
  let captured = null;
  const context = setup({
    faultInjector: async (point, detail) => {
      if (!captured && point === "after-prepare") {
        captured = detail.transition;
        throw new Error("stop-at-revision-zero");
      }
    },
  });
  try {
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "workspace-key" }), /revision-zero/);
    assert.equal(captured.base_revision, 0);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "autonomous", idempotencyKey: "workspace-key" }), /idempotency key conflicts/);
    const recovered = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "workspace-key" });
    assert.equal(recovered.run.workflow_state, "review-needed");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a decision crash can rebind only an exact fresh host receipt before staging", async () => {
  let failDecisionPrepare = true;
  const context = setup({
    reviewStatuses: ["failed", "passed"],
    faultInjector: async (point, detail) => {
      if (failDecisionPrepare && point === "after-prepare" && detail.transition.kind === "decision" && detail.transition.decision === "correct") {
        failDecisionPrepare = false;
        throw new Error("decision-prepare-crash");
      }
    },
  });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "decision-crash-start" });
    const decisionContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const first = context.decisionReceiptAdapter.issue({
      decision: "correct",
      context: decisionContext,
    });
    const input = {
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: "decision-crash",
    };
    await assert.rejects(() => context.controller.control({ ...input, humanDecisionReceipt: first.receipt }), /decision-prepare-crash/);
    context.decisionReceiptAdapter.revoke({ receipt: first.receipt, decision: "correct", context: decisionContext });
    const replacement = context.decisionReceiptAdapter.issue({ decision: "correct", context: decisionContext });
    const accepted = await context.controller.control({ ...input, humanDecisionReceipt: replacement.receipt });
    assert.equal(accepted.duplicate, true);
    assert.equal(accepted.run.workflow_state, "review-needed");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("staged and consumed human decisions recover without replay across commit faults", async () => {
  for (const point of ["after-decision-stage", "after-decision-commit", "before-finalize"]) {
    let injected = false;
    const context = setup({
      reviewStatuses: ["failed", "passed"],
      faultInjector: async (candidate, detail) => {
        if (!injected && candidate === point && detail.transition.kind === "decision" && detail.transition.decision === "correct") {
          injected = true;
          throw new Error(`decision-fault:${point}`);
        }
      },
    });
    try {
      const { reviewed: started } = await implementAndReview(context, { idempotencyKey: `decision-${point}-start` });
      const decisionContext = {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      };
      const decision = context.decisionReceiptAdapter.issue({ decision: "correct", context: decisionContext });
      const input = {
        runId: started.run.run_id,
        action: "correct",
        expectedRevision: started.run.revision,
        idempotencyKey: `decision-${point}`,
        humanDecisionReceipt: decision.receipt,
      };
      await assert.rejects(() => context.controller.control(input), new RegExp(`decision-fault:${point}`));
      const recovered = await context.controller.control(input);
      assert.equal(recovered.duplicate, true);
      assert.equal(recovered.run.workflow_state, "review-needed", point);
      assert.equal(recovered.run.decision_receipt_hashes.length, 2);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("lifecycle public inputs and terminal actions fail at their exact boundary", async () => {
  assert.throws(() => createHarnessLifecycleController({}), /requires state, workspace/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state" }), /requires state, workspace/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state", workspaceBinding: "binding" }), /requires state, workspace/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state", workspaceBinding: "binding", pluginRoot: defaultRoot, controllerInstanceId: "" }), /requires controller_instance_id/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state", workspaceBinding: "binding", pluginRoot: defaultRoot, ownerPid: 0 }), /requires a valid owner PID/);
  const context = setup();
  try {
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "manual", idempotencyKey: "bad-profile" }), /require supervised or autonomous/);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "" }), /requires idempotency_key/);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: null }), /requires idempotency_key/);
    await assert.rejects(() => context.controller.start({ rootPlanText: "not a Root", requestedProfile: "supervised", idempotencyKey: "bad-root" }), /exact valid Schema-6 Root/);
    assert.throws(() => context.controller.status("bad"), /run ID is invalid/);
    assert.throws(() => context.controller.status(`run-${"f".repeat(24)}`), /unknown Workflow 6 run/);

    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "public-boundaries" });
    await assert.rejects(() => context.controller.start({ rootPlanText: started.run.artifacts[0].text, requestedProfile: "supervised", idempotencyKey: "evidence-is-not-root" }), /not a work-plan|exact valid Schema-6 Root/);
    for (const input of [
      { action: "correct", expectedRevision: -1, idempotencyKey: "x" },
      { action: "correct", expectedRevision: 1.5, idempotencyKey: "x" },
      { action: "correct", expectedRevision: started.run.revision, idempotencyKey: "" },
      { action: "correct", expectedRevision: started.run.revision, idempotencyKey: null },
      { action: "invented", expectedRevision: started.run.revision, idempotencyKey: "x" },
      { action: "correct", expectedRevision: started.run.revision + 1, idempotencyKey: "x" },
    ]) await assert.rejects(() => context.controller.control({ runId: started.run.run_id, ...input }), /expected_revision|idempotency_key|unsupported|revision conflict/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "resume", expectedRevision: started.run.revision, idempotencyKey: "removed-resume" }), /unsupported/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "stop", expectedRevision: started.run.revision, idempotencyKey: "removed-stop" }), /unsupported/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "removed-accept" }), /unsupported/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "correct", expectedRevision: started.run.revision, idempotencyKey: "not-correctable", humanDecisionReceipt: "invalid" }), /not awaiting Correct Work/);

    const unprotected = createHarnessLifecycleController({
      stateRoot: context.stateRoot,
      workspaceBinding: context.workspaceBinding,
      pluginRoot: defaultRoot,
      harnessBinding: context.harnessBinding,
    });
    await assert.rejects(() => unprotected.control({ runId: started.run.run_id, action: "correct", expectedRevision: started.run.revision, idempotencyKey: "no-decision-adapter" }), /decision adapter is unavailable/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("Achieved and Open Points are terminal and removed control actions stay unsupported", async () => {
  const stoppedContext = setup();
  try {
    const { reviewed: started } = await implementAndReview(stoppedContext, { idempotencyKey: "stop-start" });
    assert.equal(started.run.workflow_state, "achieved");
    await assert.rejects(() => stoppedContext.controller.control({ runId: started.run.run_id, action: "stop", expectedRevision: started.run.revision, idempotencyKey: "stop-achieved", humanDecisionReceipt: "unused" }), /unsupported/);
    await assert.rejects(() => stoppedContext.controller.control({ runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "removed-accept" }), /unsupported/);
  } finally { rmSync(stoppedContext.stateRoot, { recursive: true, force: true }); }

  const provisionalContext = setup({ reviewStatuses: ["unavailable"] });
  try {
    const implemented = await provisionalContext.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "provisional-start" });
    const started = await reviewCurrent(provisionalContext, implemented.run, "unavailable-review");
    assert.equal(started.run.workflow_state, "open-points");
    assert.equal(started.run.next_action, "human-assessment");
    await assert.rejects(() => provisionalContext.controller.control({ runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "removed-provisional-accept" }), /unsupported/);
  } finally { rmSync(provisionalContext.stateRoot, { recursive: true, force: true }); }
});

test("removed stop control cannot create a seventh public state", async () => {
  const context = setup({ reviewStatuses: ["failed"] });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "stop-correction-start" });
    assert.equal(started.run.workflow_state, "correction-needed");
    await assert.rejects(() => context.controller.control({
      runId: started.run.run_id,
      action: "stop",
      expectedRevision: started.run.revision,
      idempotencyKey: "stop-correction",
      humanDecisionReceipt: "unused",
    }), /unsupported/);
    assert.equal(context.controller.status(started.run.run_id).workflow_state, "correction-needed");
    assert.equal(context.counters.correction ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("an unknown internal lifecycle is conservatively projected as Shadow Review", async () => {
  const context = setup();
  try {
    const started = await context.controller.start({
      rootPlanText: supervisedRoot,
      requestedProfile: "supervised",
      idempotencyKey: "unknown-internal-state",
    });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${started.run.run_id}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    run.lifecycle = "future-internal-state";
    writeProtectedRecord(path, run, runsRoot);

    const projected = context.controller.status(started.run.run_id);
    assert.equal(projected.workflow_state, "shadow-review");
    assert.equal(projected.next_action, "human-assessment");
    assert.equal(projected.technical.lifecycle, "future-internal-state");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("correction recovery falls back to Root Checks only when the protected Review pointer is absent", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "root-check-fallback-start" });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${started.run.run_id}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    run.work_review = null;
    writeProtectedRecord(path, run, runsRoot);
    const current = context.controller.status(started.run.run_id);
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "correct",
      context: {
        run_id: current.run_id,
        revision: current.revision,
        evidence_hash: current.artifacts[0] ? artifactHash(current.artifacts[0].text) : null,
        review_hash: null,
      },
    });
    const corrected = await context.controller.control({
      runId: current.run_id,
      action: "correct",
      expectedRevision: current.revision,
      idempotencyKey: "root-check-fallback",
      humanDecisionReceipt: receipt.receipt,
    });
    assert.equal(corrected.run.workflow_state, "review-needed");
    assert.equal(context.counters.correction, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("correction refuses a corrupted protected artifact lineage before Harness execution", async () => {
  const context = setup({ reviewStatuses: ["failed"] });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "corrupt-correction-lineage-start" });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${started.run.run_id}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    run.artifact_chain[0].text = "corrupted Evidence";
    writeProtectedRecord(path, run, runsRoot);
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "correct",
      context: {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      },
    });
    await assert.rejects(() => context.controller.control({
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: "corrupt-correction-lineage",
      humanDecisionReceipt: receipt.receipt,
    }), /correction lineage is invalid/);
    assert.equal(context.counters.correction ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("correction refuses a valid protected Review that carries no correction proposal", async () => {
  const context = setup();
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "missing-correction-proposal-start" });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${started.run.run_id}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    run.lifecycle = "correction-needed";
    run.next_action = "correct";
    writeProtectedRecord(path, run, runsRoot);
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "correct",
      context: {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      },
    });
    await assert.rejects(() => context.controller.control({
      runId: started.run.run_id,
      action: "correct",
      expectedRevision: started.run.revision,
      idempotencyKey: "missing-correction-proposal",
      humanDecisionReceipt: receipt.receipt,
    }), /requires the current protected correction proposal/);
    assert.equal(context.counters.correction ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("Review finalization without its protected work predecessor becomes a Formal Binding Open Point", async () => {
  let reviewRunId = null;
  const context = setup({
    controllerOptions: { controllerInstanceId: "missing-predecessor-owner" },
    faultInjector: async (point, detail) => {
      if (!reviewRunId && point === "after-result-stage" && detail.transition.phase === "review") {
        reviewRunId = detail.runId;
        throw new Error("review-result-stage-crash");
      }
    },
  });
  try {
    const implemented = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "missing-work-predecessor" });
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "review",
      context: { run_id: implemented.run.run_id, revision: implemented.run.revision, evidence_hash: null, review_hash: null },
    });
    const input = { runId: implemented.run.run_id, action: "review", expectedRevision: implemented.run.revision, idempotencyKey: "missing-work-review", humanDecisionReceipt: receipt.receipt };
    await assert.rejects(() => context.controller.control(input), /review-result-stage-crash/);
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${reviewRunId}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    delete run.phase_results;
    writeProtectedRecord(path, run, runsRoot);
    const recovered = await peerController(context, { controllerInstanceId: "missing-predecessor-owner" }).control(input);
    assert.equal(recovered.run.workflow_state, "open-points");
    assert.equal(recovered.run.open_points[0].type, "formal-binding");
    assert.match(recovered.run.open_points[0].evidence, /no protected work predecessor/);
    assert.equal(context.counters.phase_commits, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("an unstaged mutating result reaches stable Open Points and can never be resumed", async () => {
  const context = setup({ failExecutionOncePhase: "implementation" });
  try {
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "lost-host-result" };
    const recovered = await context.controller.start(input);
    assert.equal(recovered.run.workflow_state, "open-points");
    assert.equal(recovered.run.next_action, "human-assessment");
    assert.equal(recovered.run.retry_safe, false);
    assert.equal(context.counters.implementation, 1);
    const duplicate = await context.controller.start(input);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.run.workflow_state, "open-points");
    assert.equal(context.counters.implementation, 1);
    await assert.rejects(() => context.controller.control({ runId: recovered.run.run_id, action: "resume", expectedRevision: recovered.run.revision, idempotencyKey: "explicit-resume" }), /unsupported/);
    assert.equal(context.counters.implementation, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("live, fresh ownerless, and malformed Run locks reject a competing control without being released", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "lock-start" });
    const receiptContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "correct", context: receiptContext });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const lock = join(runsRoot, "locks", `${started.run.run_id}.lock`);
    for (const mode of ["ownerless", "live", "malformed"]) {
      mkdirSync(lock, { recursive: true });
      if (mode === "live") {
        writeProtectedRecord(join(lock, "owner.json"), {
          schema: 1,
          kind: "workflow-6-lifecycle-lock",
          owner_token: "live-owner-token-1234567890",
          controller_instance_id: "foreign-live-controller",
          pid: process.pid,
          acquired_at: new Date().toISOString(),
        }, runsRoot);
      } else if (mode === "malformed") {
        writeFileSync(join(lock, "owner.json"), "{}\n", { mode: 0o600 });
      }
      await assert.rejects(() => context.controller.control({
        runId: started.run.run_id,
        action: "correct",
        expectedRevision: started.run.revision,
        idempotencyKey: `locked-control-${mode}`,
        humanDecisionReceipt: receipt.receipt,
      }), /run is busy/);
      assert.equal(existsSync(lock), true, `${mode} lock was released by a non-owner`);
      rmSync(lock, { recursive: true, force: true });
    }
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("dead and conservatively stale lifecycle locks are reclaimed while fresh ownerless locks remain", async () => {
  for (const mode of ["dead-owner", "stale-ownerless"]) {
    const context = setup({ reviewStatuses: ["failed", "passed"] });
    try {
      const { reviewed: started } = await implementAndReview(context, { idempotencyKey: `lock-reclaim-${mode}` });
      const receiptContext = {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      };
      const receipt = context.decisionReceiptAdapter.issue({ decision: "correct", context: receiptContext });
      const runsRoot = join(context.stateRoot, "workflow-6-runs");
      const lock = join(runsRoot, "locks", `${started.run.run_id}.lock`);
      mkdirSync(lock, { recursive: true });
      if (mode === "dead-owner") {
        writeProtectedRecord(join(lock, "owner.json"), {
          schema: 1,
          kind: "workflow-6-lifecycle-lock",
          owner_token: "dead-owner-token-1234567890",
          controller_instance_id: "dead-controller",
          pid: 999_992,
          acquired_at: "2026-08-25T00:00:00.000Z",
        }, runsRoot);
      } else {
        const old = new Date(Date.now() - 60_000);
        utimesSync(lock, old, old);
      }
      const controller = peerController(context, {
        pidIsAlive: (pid) => pid === 999_992 ? false : true,
        lockStaleMs: 1_000,
      });
      const corrected = await controller.control({
        runId: started.run.run_id,
        action: "correct",
        expectedRevision: started.run.revision,
        idempotencyKey: `lock-reclaim-stop-${mode}`,
        humanDecisionReceipt: receipt.receipt,
      });
      assert.equal(corrected.run.workflow_state, "review-needed");
      assert.equal(existsSync(lock), false);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("a pending revision-zero transition is visible and recovered by the exact start replay", async () => {
  let prepared = null;
  const context = setup({
    faultInjector: async (point, detail) => {
      if (!prepared && point === "after-prepare") {
        prepared = detail;
        throw new Error("prepared-crash");
      }
    },
  });
  try {
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "pending-start" }), /prepared-crash/);
    const status = context.controller.status(prepared.runId);
    assert.equal(status.revision, 0);
    assert.equal(status.technical.transition.transition_id, prepared.transition.transition_id);
    assert.equal(status.technical.transition.status, "prepared");
    const resumed = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "pending-start" });
    assert.equal(resumed.run.workflow_state, "review-needed");
    assert.equal(context.counters.implementation, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("corrupt Run records, orphan Runs, and non-directory state fail closed", async () => {
  const context = setup();
  try {
    const corruptId = `run-${"e".repeat(24)}`;
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    writeProtectedRecord(join(runsRoot, "runs", `${corruptId}.json`), {
      schema: 1,
      kind: "wrong-run-kind",
      contract: "workflow-6-transactional",
      run_id: corruptId,
    }, runsRoot);
    assert.throws(() => context.controller.status(corruptId), /unsupported Workflow 6 run/);

    const key = "orphan-run";
    const rootHash = sha256(supervisedRoot);
    const orphanId = `run-${sha256(`${context.workspaceBinding}\0${rootHash}\0supervised\0${key}`).slice(0, 24)}`;
    writeProtectedRecord(join(runsRoot, "runs", `${orphanId}.json`), {
      schema: 1,
      kind: "workflow-6-run",
      contract: "workflow-6-transactional",
      run_id: orphanId,
    }, runsRoot);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: key }), /already exists without its protected start index/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }

  const root = mkdtempSync(join(tmpdir(), "workflow-state-not-directory-"));
  try {
    const stateFile = join(root, "state-file");
    writeFileSync(stateFile, "not a directory");
    const controller = createHarnessLifecycleController({ stateRoot: stateFile, workspaceBinding: "1".repeat(64), pluginRoot: defaultRoot, harnessBinding: null });
    await assert.rejects(() => controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "bad-state" }), /ENOTDIR|not a directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("default failed Review construction and human-reserved Autonomous Checks reach their conservative gates", async () => {
  const failed = setup({ reviewStatuses: ["failed"], includeReviewInput: false });
  try {
    const implemented = await failed.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "default-failed-review" });
    const started = await reviewCurrent(failed, implemented.run, "default-failed-review-work");
    assert.equal(started.run.workflow_state, "open-points");
    assert.equal(started.run.next_action, "human-assessment");
  } finally { rmSync(failed.stateRoot, { recursive: true, force: true }); }

  const autonomous = setup({ qualificationKeys: ["qk-retry"] });
  try {
    const verification = authorityCore("autonomous").verification.map((check) => ({ ...check, evidence_class: "human-decision-required" }));
    const placeholder = {
      qualification_key: "qk-retry",
      harness_capability_receipt_hash: autonomous.protectedCapability.receipt_hash,
      verification_intent_hash: "0".repeat(64),
      certified_region: "src",
    };
    const verificationIntents = executionContractFromArtifactText(rootPlan("autonomous", { verification, certification: placeholder }), defaultRoot).checks;
    const humanRoot = rootPlan("autonomous", { verification, certification: { ...placeholder, verification_intent_hash: harnessContractHash(verificationIntents) } });
    const implemented = await autonomous.controller.start({ rootPlanText: humanRoot, requestedProfile: "autonomous", idempotencyKey: "human-check-autonomous" });
    const started = await reviewCurrent(autonomous, implemented.run, "human-check-review");
    assert.equal(started.run.effective_profile, "autonomous");
    assert.equal(started.run.workflow_state, "achieved");
    assert.equal(started.run.next_action, "none");
  } finally { rmSync(autonomous.stateRoot, { recursive: true, force: true }); }
});

test("a protected blocked work phase ends with a concrete Open Point", async () => {
  const context = setup({ blockOncePhase: "implementation" });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "blocked-work" });
    assert.equal(started.run.workflow_state, "open-points");
    assert.equal(started.run.next_action, "human-assessment");
    assert.equal(started.run.open_points[0].key, "harness-phase-blocked");
    assert.equal(context.counters.implementation, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("protected start index recovery and schema variants remain exact", async () => {
  const context = setup();
  try {
    const key = "prepared-index-only";
    const rootHash = sha256(supervisedRoot);
    const runId = `run-${sha256(`${context.workspaceBinding}\0${rootHash}\0supervised\0${key}`).slice(0, 24)}`;
    const inputFingerprint = harnessContractHash({ action: "implement", run_id: runId, root_hash: rootHash, requested_profile: "supervised" });
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    writeProtectedRecord(join(runsRoot, "start-idempotency", `${sha256(key)}.json`), {
      schema: 1,
      kind: "workflow-6-start-idempotency",
      contract: "workflow-6-transactional",
      idempotency_key_hash: sha256(key),
      fingerprint: inputFingerprint,
      run_id: runId,
      created_at: "2026-08-25T00:00:00.000Z",
    }, runsRoot);
    const recovered = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: key });
    assert.equal(recovered.run.run_id, runId);

    for (const [suffix, record] of [
      ["1", { schema: 2, kind: "workflow-6-run", contract: "workflow-6-transactional" }],
      ["2", { schema: 1, kind: "workflow-6-run", contract: "wrong-contract" }],
    ]) {
      const invalidId = `run-${suffix.repeat(24)}`;
      writeProtectedRecord(join(runsRoot, "runs", `${invalidId}.json`), { ...record, run_id: invalidId }, runsRoot);
      assert.throws(() => context.controller.status(invalidId), /unsupported Workflow 6 run/);
    }
    assert.throws(() => context.controller.status(null), /run ID is invalid/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a protected start index cannot recover a Run whose matching idempotency entry was removed", async () => {
  const context = setup();
  try {
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "missing-run-idempotency" };
    const started = await context.controller.start(input);
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const path = join(runsRoot, "runs", `${started.run.run_id}.json`);
    const run = readProtectedRecord(path, runsRoot, { maxBytes: 2 * 1024 * 1024 });
    run.idempotency = {};
    writeProtectedRecord(path, run, runsRoot);
    await assert.rejects(() => context.controller.start(input), /start idempotency conflict/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("same-receipt decision recovery and pending-action conflicts stay transition-bound", async () => {
  let crash = true;
  let pendingRun = null;
  const context = setup({
    reviewStatuses: ["failed", "passed"],
    faultInjector: async (point, detail) => {
      if (crash && point === "after-prepare" && detail.transition.kind === "decision" && detail.transition.decision === "correct") {
        crash = false;
        pendingRun = detail.runId;
        throw new Error("same-receipt-crash");
      }
    },
  });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "same-receipt-start" });
    const receiptContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "correct", context: receiptContext });
    const input = { runId: started.run.run_id, action: "correct", expectedRevision: started.run.revision, idempotencyKey: "same-receipt", humanDecisionReceipt: receipt.receipt };
    await assert.rejects(() => context.controller.control(input), /same-receipt-crash/);
    await assert.rejects(() => context.controller.control({ runId: pendingRun, action: "review", expectedRevision: started.run.revision, idempotencyKey: "different-pending", humanDecisionReceipt: receipt.receipt }), /already has a pending transition/);
    const recovered = await context.controller.control(input);
    assert.equal(recovered.run.workflow_state, "review-needed");
    await assert.rejects(() => context.controller.control({ runId: recovered.run.run_id, action: "correct", expectedRevision: recovered.run.revision, idempotencyKey: "correct-terminal", humanDecisionReceipt: receipt.receipt }), /not awaiting Correct Work/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("blocked correction ends with a concrete Open Point and no hidden resume", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"], blockOncePhase: "correction" });
  try {
    const { reviewed: started } = await implementAndReview(context, { idempotencyKey: "blocked-correction-start" });
    const decisionContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "correct", context: decisionContext });
    const blocked = await context.controller.control({ runId: started.run.run_id, action: "correct", expectedRevision: started.run.revision, idempotencyKey: "blocked-correction", humanDecisionReceipt: receipt.receipt });
    assert.equal(blocked.run.workflow_state, "open-points");
    assert.equal(blocked.run.technical.phase, "correction");
    assert.equal(blocked.run.next_action, "human-assessment");
    assert.equal(blocked.run.open_points[0].key, "harness-phase-blocked");
    assert.equal(context.counters.correction, 1);
    assert.equal(context.counters.review, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("snapshot and protection conflicts never finalize staged phase results", async () => {
  const snapshotConflict = setup({ reviewSnapshot: "7".repeat(64) });
  try {
    const implemented = await snapshotConflict.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "snapshot-conflict" });
    const rejected = await reviewCurrent(snapshotConflict, implemented.run, "snapshot-conflict-review");
    assert.equal(rejected.run.workflow_state, "open-points");
    assert.equal(rejected.run.technical.phase, "review");
    assert.equal(rejected.run.next_action, "human-assessment");
    assert.equal(rejected.run.retry_safe, true);
    assert.match(rejected.run.open_points[0].evidence, /predecessor snapshot mismatch/);
    assert.equal(snapshotConflict.counters.implementation, 1);
    assert.equal(snapshotConflict.counters.review, 1);
    assert.equal(snapshotConflict.counters.phase_commits, 1, "invalid Review consumed its staged protection");
    await assert.rejects(() => snapshotConflict.controller.control({
      runId: rejected.run.run_id,
      action: "review",
      expectedRevision: rejected.run.revision,
      idempotencyKey: "snapshot-conflict-terminal-review",
      humanDecisionReceipt: "unused",
    }), /not awaiting Review Work/);
  } finally { rmSync(snapshotConflict.stateRoot, { recursive: true, force: true }); }

  const protectionConflict = setup({ commitReceiptMismatch: true });
  try {
    await assert.rejects(() => protectionConflict.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "protection-conflict" }), /committed protection differs/);
    assert.equal(protectionConflict.counters.implementation, 1);
  } finally { rmSync(protectionConflict.stateRoot, { recursive: true, force: true }); }
});

test("invalid Review input is rejected before receipt commit and remains safely reviewable", async () => {
  const context = setup({ reviewStatuses: ["failed"], reviewInput: { schema: 1, kind: "invalid-review-input" } });
  try {
    const implemented = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "invalid-review-input" });
    const rejected = await reviewCurrent(context, implemented.run, "invalid-review-input-work");
    assert.equal(rejected.run.workflow_state, "open-points");
    assert.equal(rejected.run.technical.phase, "review");
    assert.equal(rejected.run.next_action, "human-assessment");
    assert.equal(rejected.run.retry_safe, true);
    assert.equal(context.counters.phase_commits, 1, "invalid Review input consumed its phase receipt");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a corrupted persisted finalization draft is rejected before protection commit", async () => {
  let injected = false;
  const deadPid = 999_993;
  const context = setup({
    controllerOptions: { controllerInstanceId: "finalization-crash-owner", ownerPid: deadPid },
    faultInjector: async (point) => {
      if (!injected && point === "after-finalization-ready") {
        injected = true;
        throw new Error("finalization-draft-crash");
      }
    },
  });
  try {
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "corrupt-finalization" };
    await assert.rejects(() => context.controller.start(input), /finalization-draft-crash/);
    const runId = `run-${sha256(`${context.workspaceBinding}\0${sha256(supervisedRoot)}\0supervised\0${input.idempotencyKey}`).slice(0, 24)}`;
    const root = join(context.stateRoot, "workflow-6-runs");
    const path = join(root, "runs", `${runId}.json`);
    const run = readProtectedRecord(path, root, { maxBytes: 2 * 1024 * 1024 });
    run.pending_transition.finalization.kind = "review-completed";
    writeProtectedRecord(path, run, root);
    const recovered = await peerController(context, { pidIsAlive: (pid) => pid === deadPid ? false : true }).start(input);
    assert.equal(recovered.run.workflow_state, "open-points");
    assert.equal(recovered.run.next_action, "human-assessment");
    assert.equal(context.counters.phase_commits ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("binding and completeness drift in a persisted finalization never consumes protection", async () => {
  const cases = [
    {
      name: "work-binding",
      crashPhase: "implementation",
      mutate: (draft) => { draft.result_entry.phase = "review"; },
      nextAction: "human-assessment",
      priorCommits: 0,
    },
    {
      name: "review-artifacts",
      crashPhase: "review",
      mutate: (draft) => { draft.evidence = null; },
      nextAction: "human-assessment",
      priorCommits: 1,
    },
  ];
  for (const candidate of cases) {
    let injected = false;
    const deadPid = 999_994;
    const context = setup({
      controllerOptions: { controllerInstanceId: `draft-${candidate.name}`, ownerPid: deadPid },
      faultInjector: async (point, detail) => {
        if (!injected && point === "after-finalization-ready" && detail.transition.phase === candidate.crashPhase) {
          injected = true;
          throw new Error(`draft-crash:${candidate.name}`);
        }
      },
    });
    try {
      const startInput = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: `draft-${candidate.name}` };
      let runId;
      let recover;
      if (candidate.crashPhase === "review") {
        const implemented = await context.controller.start(startInput);
        runId = implemented.run.run_id;
        const receipt = context.decisionReceiptAdapter.issue({ decision: "review", context: { run_id: runId, revision: implemented.run.revision, evidence_hash: null, review_hash: null } });
        const reviewInput = { runId, action: "review", expectedRevision: implemented.run.revision, idempotencyKey: `review-${candidate.name}`, humanDecisionReceipt: receipt.receipt };
        await assert.rejects(() => context.controller.control(reviewInput), new RegExp(`draft-crash:${candidate.name}`));
        recover = (controller) => controller.control(reviewInput);
      } else {
        await assert.rejects(() => context.controller.start(startInput), new RegExp(`draft-crash:${candidate.name}`));
        runId = `run-${sha256(`${context.workspaceBinding}\0${sha256(supervisedRoot)}\0supervised\0${startInput.idempotencyKey}`).slice(0, 24)}`;
        recover = (controller) => controller.start(startInput);
      }
      const root = join(context.stateRoot, "workflow-6-runs");
      const path = join(root, "runs", `${runId}.json`);
      const run = readProtectedRecord(path, root, { maxBytes: 2 * 1024 * 1024 });
      candidate.mutate(run.pending_transition.finalization);
      run.pending_transition.finalization_hash = harnessContractHash(run.pending_transition.finalization);
      writeProtectedRecord(path, run, root);
      const recovered = await recover(peerController(context, { pidIsAlive: (pid) => pid === deadPid ? false : true }));
      assert.equal(recovered.run.workflow_state, "open-points");
      assert.equal(recovered.run.next_action, candidate.nextAction);
      assert.equal(context.counters.phase_commits ?? 0, candidate.priorCommits);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("missing Host Adapter protection retries internally and then creates one concrete Open Point", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-no-host-adapter-"));
  try {
    const controller = createHarnessLifecycleController({
      stateRoot,
      workspaceBinding: harnessContractHash({ workspace_root: defaultRoot }),
      pluginRoot: defaultRoot,
      harnessBinding: null,
    });
    const started = await controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "shadow-no-adapter" });
    assert.equal(started.run.workflow_state, "open-points");
    assert.equal(started.run.next_action, "human-assessment");
    assert.equal(started.run.open_points[0].type, "no-progress");
    assert.equal(started.run.revision, 1);
  } finally { rmSync(stateRoot, { recursive: true, force: true }); }
});

test("invalid or conflicting protected start indexes cannot redirect a Run", async () => {
  const context = setup();
  try {
    const runsRoot = join(context.stateRoot, "workflow-6-runs");
    const invalidKey = "invalid-index";
    writeProtectedRecord(join(runsRoot, "start-idempotency", `${sha256(invalidKey)}.json`), {
      schema: 1,
      kind: "wrong-index-kind",
      contract: "workflow-6-transactional",
    }, runsRoot);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: invalidKey }), /start idempotency record is invalid/);

    const wrongRunKey = "wrong-index-run";
    const rootHash = sha256(supervisedRoot);
    const expectedRunId = `run-${sha256(`${context.workspaceBinding}\0${rootHash}\0supervised\0${wrongRunKey}`).slice(0, 24)}`;
    const inputFingerprint = harnessContractHash({ action: "implement", run_id: expectedRunId, root_hash: rootHash, requested_profile: "supervised" });
    writeProtectedRecord(join(runsRoot, "start-idempotency", `${sha256(wrongRunKey)}.json`), {
      schema: 1,
      kind: "workflow-6-start-idempotency",
      contract: "workflow-6-transactional",
      fingerprint: inputFingerprint,
      run_id: `run-${"9".repeat(24)}`,
    }, runsRoot);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: wrongRunKey }), /idempotency key conflicts/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});
