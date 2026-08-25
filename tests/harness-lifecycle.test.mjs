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

const manualRoot = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const supervisedRoot = manualRoot
  .replace("profile_max: manual", "profile_max: supervised")
  .replace("contract_level: lean", "contract_level: controlled")
  .replace("  external_effects: none", "  max_active_minutes: 30\n  max_total_tokens: 50000\n  max_cost_usd: 5\n  external_effects: none");
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
    assessment: "mostly-achieved",
    recommended_action: "correct",
    assessment_summary: "One protected verification outcome remains unsatisfied.",
    snapshot_assessment: "consistent",
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
    missing_evidence: [],
    correction: {
      fixes: [{
        key: "close-gap",
        finding_keys: ["verification-gap"],
        required_outcome: "Establish the Root acceptance outcome.",
        evidence: "The correction remains bounded to OBJ-1 and CHECK-1.",
      }],
      checks: [{
        key: "verify-correction",
        fix_keys: ["close-gap"],
        verification_intent: "Prove the corrected acceptance outcome on the current snapshot.",
        expected_evidence: "Protected project-Harness evidence for the corrected outcome.",
        evidence_class: "harness-verifiable",
        required: true,
        cost_class: "standard",
        prerequisites: ["The correction outcome is available for review."],
      }],
      steps: [{
        key: "apply-correction",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Establish the Root acceptance outcome.",
        implementation_latitude: "The project Harness chooses the concrete implementation.",
        completion_probe: "The corrected acceptance outcome is observable.",
        check_keys: ["verify-correction"],
        deviation_action: "Replan if the Root authority must change.",
      }],
      learning_candidates: [{
        key: "preserve-boundary",
        finding_keys: ["verification-gap"],
        reusable_guidance: "Keep verification intent separate from project execution choices.",
        candidate_targets: ["project guidance"],
        confirmation_evidence: "A protected corrected delivery.",
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

function setup({ reviewStatuses = ["passed"], qualificationKeys = [], faultInjector = null, failExecutionOncePhase = null, includeReviewInput = true, blockOncePhase = null, reviewSnapshot = after, reviewInput = correctionReviewInput(), commitReceiptMismatch = false, controllerOptions = {} } = {}) {
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
  const harnessBinding = Object.freeze({
    ...baseHarnessBinding,
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

function artifactHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

test("Supervised runs build protected Evidence and Review before human acceptance", async () => {
  const context = setup();
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "start-1" });
    assert.equal(started.run.lifecycle, "delivery-ready-verified", JSON.stringify(started.run));
    assert.equal(started.run.effective_profile, "supervised");
    assert.equal(started.run.artifacts.length, 2);
    assert.equal(started.run.phase_receipt_hashes.length, 2);
    assert.equal(started.run.delivery_status, "verified");

    const decision = cursorDecision(context, started.run, "accept-delivery", "accept-tool-1");
    const accepted = await context.controller.control({
      runId: started.run.run_id,
      action: "accept-delivery",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    evaluateAutomationGuard({ ...decision.identity, hook_event_name: "postToolUse", tool_name: "MCP:workflow_prepare", tool_use_id: decision.toolUseId }, decision.options);
    assert.equal(accepted.run.lifecycle, "achieved");
    assert.equal(accepted.run.decision_receipt_hashes.length, 1);
    const replay = await context.controller.control({
      runId: started.run.run_id,
      action: "accept-delivery",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    assert.equal(replay.duplicate, true);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a lost MCP response replays the exact committed human transition without a new decision", async () => {
  const context = setup();
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "transport-commit-start" });
    const decision = cursorDecision(context, started.run, "accept-delivery", "transport-tool-1");
    const accepted = await context.controller.control({
      runId: started.run.run_id,
      action: "accept-delivery",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    assert.equal(accepted.run.lifecycle, "achieved");
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
    assert.equal(replayed.run.lifecycle, "achieved");
    evaluateAutomationGuard({ ...decision.identity, hook_event_name: "postToolUse", tool_name: "MCP:workflow_prepare", tool_use_id: "transport-tool-2" }, decision.options);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("failed Review blocks, protected correction reruns, and Autonomous gaps downgrade to Supervised", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"] });
  try {
    const autonomousWithoutCertification = supervisedRoot
      .replace("profile_max: supervised", "profile_max: autonomous")
      .replace("contract_level: controlled", "contract_level: certified")
      .replace("risk: medium", "risk: medium")
      .replace("hard_triggers: []", "hard_triggers: []\ncertification:\n  qualification_key: qk-missing\n  harness_capability_receipt_hash: \"" + "9".repeat(64) + "\"\n  verification_intent_hash: \"" + "8".repeat(64) + "\"\n  certified_region: src");
    const started = await context.controller.start({ rootPlanText: autonomousWithoutCertification, requestedProfile: "autonomous", idempotencyKey: "start-2" });
    assert.equal(started.run.effective_profile, "supervised");
    assert.match(started.run.downgrade_reason, /autonomous-/);
    assert.equal(started.run.lifecycle, "blocked");

    const decision = cursorDecision(context, started.run, "approve-correction", "correction-tool-1");
    const corrected = await context.controller.control({
      runId: started.run.run_id,
      action: "approve-correction",
      expectedRevision: started.run.revision,
      idempotencyKey: decision.input.idempotency_key,
      humanDecisionReceipt: decision.input.human_decision_receipt,
    });
    assert.equal(corrected.run.lifecycle, "delivery-ready-verified");
    assert.equal(corrected.run.effective_profile, "supervised");
    assert.equal(corrected.run.artifacts.length, 4);
    assert.match(corrected.run.artifacts[2].text, /representation: delta/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("qualified Autonomous runs achieve without a final human gate", async () => {
  const context = setup({ qualificationKeys: ["qk-retry"] });
  try {
    const verificationIntents = executionContractFromArtifactText(supervisedRoot, defaultRoot).checks;
    const autonomousRoot = supervisedRoot
      .replace("profile_max: supervised", "profile_max: autonomous")
      .replace("contract_level: controlled", "contract_level: certified")
      .replace("hard_triggers: []", [
        "hard_triggers: []",
        "certification:",
        "  qualification_key: qk-retry",
        `  harness_capability_receipt_hash: ${context.protectedCapability.receipt_hash}`,
        `  verification_intent_hash: ${harnessContractHash(verificationIntents)}`,
        "  certified_region: src",
      ].join("\n"));
    const started = await context.controller.start({ rootPlanText: autonomousRoot, requestedProfile: "autonomous", idempotencyKey: "start-autonomous" });
    assert.equal(started.run.effective_profile, "autonomous");
    assert.equal(started.run.lifecycle, "achieved");
    assert.equal(started.run.next_action, "none");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("resume continues a protected pending Review without re-running work", async () => {
  const context = setup({ reviewStatuses: ["invalid", "passed"] });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "start-recovery" });
    assert.equal(started.run.lifecycle, "shadow");
    assert.equal(started.run.phase, "review");
    assert.equal(context.counters.implementation, 1);

    const resumed = await context.controller.control({
      runId: started.run.run_id,
      action: "resume",
      expectedRevision: started.run.revision,
      idempotencyKey: "resume-review",
    });
    assert.equal(resumed.run.lifecycle, "delivery-ready-verified");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review, 2);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("prepared and staged phase transitions recover idempotently after every Core fault boundary", async () => {
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
      assert.equal(recovered.run.lifecycle, "delivery-ready-verified", point);
      assert.equal(context.counters.implementation, 1, `${point}: implementation replayed`);
      assert.equal(context.counters.review, 1, `${point}: review replayed`);
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
    assert.equal(observed.run.lifecycle, "implementing");
    assert.equal(completed.run.lifecycle, "delivery-ready-verified");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review, 1);
    const replay = await peer.start(input);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.in_progress, false);
    assert.equal(replay.run.lifecycle, "delivery-ready-verified");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a dead mutating lease recovers only host staging and never blindly invokes the Harness", async () => {
  for (const [faultPoint, expectedLifecycle, expectedExecutions] of [
    ["after-execution-claim", "shadow", 0],
    ["after-harness-stage", "delivery-ready-verified", 1],
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
      assert.equal(recovered.run.lifecycle, expectedLifecycle);
      assert.equal(context.counters.implementation ?? 0, expectedExecutions);
      if (faultPoint === "after-execution-claim") {
        assert.equal(recovered.run.next_action, "stop");
        assert.equal(recovered.run.retry_safe, false);
      }
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("a real crashed subprocess lease cannot cause blind mutating execution", async () => {
  let prepared = null;
  const context = setup({
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
    assert.equal(recovered.run.lifecycle, "shadow");
    assert.equal(recovered.run.next_action, "stop");
    assert.equal(context.counters.implementation ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("independent controllers observe one live read-only resume and converge on its result", async () => {
  const context = setup({ reviewStatuses: ["invalid", "passed"] });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "concurrent-resume-start" });
    assert.equal(started.run.lifecycle, "shadow");
    const peer = peerController(context);
    const input = {
      runId: started.run.run_id,
      action: "resume",
      expectedRevision: started.run.revision,
      idempotencyKey: "concurrent-review-resume",
    };
    const results = await Promise.all([context.controller.control(input), peer.control(input)]);
    const observed = results.find((entry) => entry.in_progress);
    const completed = results.find((entry) => !entry.in_progress);
    assert.equal(observed.duplicate, true);
    assert.equal(completed.run.lifecycle, "delivery-ready-verified");
    assert.equal(context.counters.implementation, 1);
    assert.equal(context.counters.review, 2);
    const replay = await peer.control(input);
    assert.equal(replay.run.lifecycle, "delivery-ready-verified");
    assert.equal(replay.in_progress, false);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("independent controllers observe an identical live human decision and commit it once", async () => {
  const context = setup();
  try {
    const peer = peerController(context);
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "control-concurrency-start" });
    const receipt = context.decisionReceiptAdapter.issue({
      decision: "accept-delivery",
      context: {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      },
    });
    const input = {
      runId: started.run.run_id,
      action: "accept-delivery",
      expectedRevision: started.run.revision,
      idempotencyKey: "shared-control-key",
      humanDecisionReceipt: receipt.receipt,
    };
    const accepted = await Promise.all([context.controller.control(input), peer.control(input)]);
    const observed = accepted.find((entry) => entry.in_progress);
    const completed = accepted.find((entry) => !entry.in_progress);
    assert.equal(observed.duplicate, true);
    assert.equal(observed.run.lifecycle, "waiting-human");
    assert.equal(completed.run.lifecycle, "achieved");
    assert.equal(completed.run.decision_receipt_hashes.length, 1);
    const replay = await peer.control(input);
    assert.equal(replay.in_progress, false);
    assert.equal(replay.run.lifecycle, "achieved");
    await assert.rejects(() => context.controller.control({
      ...input,
      action: "stop",
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
    assert.equal(recovered.run.lifecycle, "delivery-ready-verified");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("a decision crash can rebind only an exact fresh host receipt before staging", async () => {
  let failDecisionPrepare = true;
  const context = setup({
    faultInjector: async (point, detail) => {
      if (failDecisionPrepare && point === "after-prepare" && detail.transition.kind === "decision") {
        failDecisionPrepare = false;
        throw new Error("decision-prepare-crash");
      }
    },
  });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "decision-crash-start" });
    const decisionContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const first = context.decisionReceiptAdapter.issue({
      decision: "accept-delivery",
      context: decisionContext,
    });
    const input = {
      runId: started.run.run_id,
      action: "accept-delivery",
      expectedRevision: started.run.revision,
      idempotencyKey: "decision-crash",
    };
    await assert.rejects(() => context.controller.control({ ...input, humanDecisionReceipt: first.receipt }), /decision-prepare-crash/);
    context.decisionReceiptAdapter.revoke({ receipt: first.receipt, decision: "accept-delivery", context: decisionContext });
    const replacement = context.decisionReceiptAdapter.issue({ decision: "accept-delivery", context: decisionContext });
    const accepted = await context.controller.control({ ...input, humanDecisionReceipt: replacement.receipt });
    assert.equal(accepted.duplicate, true);
    assert.equal(accepted.run.lifecycle, "achieved");
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("staged and consumed human decisions recover without replay across commit faults", async () => {
  for (const point of ["after-decision-stage", "after-decision-commit", "before-finalize"]) {
    let injected = false;
    const context = setup({
      faultInjector: async (candidate, detail) => {
        if (!injected && candidate === point && detail.transition.kind === "decision") {
          injected = true;
          throw new Error(`decision-fault:${point}`);
        }
      },
    });
    try {
      const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: `decision-${point}-start` });
      const decisionContext = {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      };
      const decision = context.decisionReceiptAdapter.issue({ decision: "accept-delivery", context: decisionContext });
      const input = {
        runId: started.run.run_id,
        action: "accept-delivery",
        expectedRevision: started.run.revision,
        idempotencyKey: `decision-${point}`,
        humanDecisionReceipt: decision.receipt,
      };
      await assert.rejects(() => context.controller.control(input), new RegExp(`decision-fault:${point}`));
      const recovered = await context.controller.control(input);
      assert.equal(recovered.duplicate, true);
      assert.equal(recovered.run.lifecycle, "achieved", point);
      assert.equal(recovered.run.decision_receipt_hashes.length, 1);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("lifecycle public inputs and terminal actions fail at their exact boundary", async () => {
  assert.throws(() => createHarnessLifecycleController({}), /requires state, workspace/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state" }), /requires state, workspace/);
  assert.throws(() => createHarnessLifecycleController({ stateRoot: "state", workspaceBinding: "binding" }), /requires state, workspace/);
  const context = setup();
  try {
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "manual", idempotencyKey: "bad-profile" }), /require supervised or autonomous/);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "" }), /requires idempotency_key/);
    await assert.rejects(() => context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: null }), /requires idempotency_key/);
    await assert.rejects(() => context.controller.start({ rootPlanText: "not a Root", requestedProfile: "supervised", idempotencyKey: "bad-root" }), /exact valid Schema-6 Root/);
    assert.throws(() => context.controller.status("bad"), /run ID is invalid/);
    assert.throws(() => context.controller.status(`run-${"f".repeat(24)}`), /unknown Workflow 6 run/);

    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "public-boundaries" });
    await assert.rejects(() => context.controller.start({ rootPlanText: started.run.artifacts[0].text, requestedProfile: "supervised", idempotencyKey: "evidence-is-not-root" }), /not a work-plan|exact valid Schema-6 Root/);
    for (const input of [
      { action: "resume", expectedRevision: -1, idempotencyKey: "x" },
      { action: "resume", expectedRevision: 1.5, idempotencyKey: "x" },
      { action: "resume", expectedRevision: started.run.revision, idempotencyKey: "" },
      { action: "resume", expectedRevision: started.run.revision, idempotencyKey: null },
      { action: "invented", expectedRevision: started.run.revision, idempotencyKey: "x" },
      { action: "resume", expectedRevision: started.run.revision + 1, idempotencyKey: "x" },
    ]) await assert.rejects(() => context.controller.control({ runId: started.run.run_id, ...input }), /expected_revision|idempotency_key|unsupported|revision conflict/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "resume", expectedRevision: started.run.revision, idempotencyKey: "not-waiting" }), /not awaiting resume/);
    await assert.rejects(() => context.controller.control({ runId: started.run.run_id, action: "approve-correction", expectedRevision: started.run.revision, idempotencyKey: "not-blocked", humanDecisionReceipt: "invalid" }), /correction is not awaiting approval/);

    const unprotected = createHarnessLifecycleController({
      stateRoot: context.stateRoot,
      workspaceBinding: context.workspaceBinding,
      pluginRoot: defaultRoot,
      harnessBinding: context.harnessBinding,
    });
    await assert.rejects(() => unprotected.control({ runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "no-decision-adapter" }), /decision adapter is unavailable/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("stop and provisional acceptance use distinct protected terminal states", async () => {
  const stoppedContext = setup();
  try {
    const started = await stoppedContext.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "stop-start" });
    const receiptContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = stoppedContext.decisionReceiptAdapter.issue({ decision: "stop", context: receiptContext });
    const stopped = await stoppedContext.controller.control({ runId: started.run.run_id, action: "stop", expectedRevision: started.run.revision, idempotencyKey: "stop-control", humanDecisionReceipt: receipt.receipt });
    assert.equal(stopped.run.lifecycle, "stopped");
    assert.equal(stopped.run.phase_status, "cancelled");
    await assert.rejects(() => stoppedContext.controller.control({ runId: stopped.run.run_id, action: "stop", expectedRevision: stopped.run.revision, idempotencyKey: "stop-again", humanDecisionReceipt: receipt.receipt }), /already terminal/);
  } finally { rmSync(stoppedContext.stateRoot, { recursive: true, force: true }); }

  const provisionalContext = setup({ reviewStatuses: ["unavailable"] });
  try {
    const started = await provisionalContext.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "provisional-start" });
    assert.equal(started.run.lifecycle, "delivery-ready-provisional");
    const receipt = provisionalContext.decisionReceiptAdapter.issue({
      decision: "accept-delivery",
      context: {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      },
    });
    const accepted = await provisionalContext.controller.control({ runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "provisional-accept", humanDecisionReceipt: receipt.receipt });
    assert.equal(accepted.run.lifecycle, "accepted-provisional");
  } finally { rmSync(provisionalContext.stateRoot, { recursive: true, force: true }); }
});

test("an unstaged mutating result reaches a stable stop gate and can never be resumed", async () => {
  const context = setup({ failExecutionOncePhase: "implementation" });
  try {
    const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "lost-host-result" };
    const shadow = await context.controller.start(input);
    assert.equal(shadow.run.lifecycle, "shadow");
    assert.equal(shadow.run.next_action, "stop");
    assert.equal(shadow.run.retry_safe, false);
    assert.equal(context.counters.implementation, 1);
    const duplicate = await context.controller.start(input);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.run.lifecycle, "shadow");
    assert.equal(context.counters.implementation, 1);
    await assert.rejects(() => context.controller.control({ runId: shadow.run.run_id, action: "resume", expectedRevision: shadow.run.revision, idempotencyKey: "explicit-resume" }), /not awaiting resume/);
    assert.equal(context.counters.implementation, 1);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("live, fresh ownerless, and malformed Run locks reject a competing control without being released", async () => {
  const context = setup();
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "lock-start" });
    const receiptContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "stop", context: receiptContext });
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
        action: "stop",
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
    const context = setup();
    try {
      const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: `lock-reclaim-${mode}` });
      const receiptContext = {
        run_id: started.run.run_id,
        revision: started.run.revision,
        evidence_hash: artifactHash(started.run.artifacts[0].text),
        review_hash: artifactHash(started.run.artifacts[1].text),
      };
      const receipt = context.decisionReceiptAdapter.issue({ decision: "stop", context: receiptContext });
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
      const stopped = await controller.control({
        runId: started.run.run_id,
        action: "stop",
        expectedRevision: started.run.revision,
        idempotencyKey: `lock-reclaim-stop-${mode}`,
        humanDecisionReceipt: receipt.receipt,
      });
      assert.equal(stopped.run.lifecycle, "stopped");
      assert.equal(existsSync(lock), false);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("a pending revision-zero transition is visible and resumable without duplicate execution", async () => {
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
    assert.equal(status.transition.transition_id, prepared.transition.transition_id);
    assert.equal(status.transition.status, "prepared");
    const resumed = await context.controller.control({ runId: prepared.runId, action: "resume", expectedRevision: 0, idempotencyKey: "pending-resume" });
    assert.equal(resumed.run.lifecycle, "delivery-ready-verified");
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
    const started = await failed.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "default-failed-review" });
    assert.equal(started.run.lifecycle, "blocked");
    assert.equal(started.run.delivery_status, "blocked");
  } finally { rmSync(failed.stateRoot, { recursive: true, force: true }); }

  const autonomous = setup({ qualificationKeys: ["qk-retry"] });
  try {
    const humanVerificationRoot = supervisedRoot.replace("| harness-verifiable |", "| human-decision-required |");
    const verificationIntents = executionContractFromArtifactText(humanVerificationRoot, defaultRoot).checks;
    const humanRootBase = humanVerificationRoot
      .replace("profile_max: supervised", "profile_max: autonomous")
      .replace("contract_level: controlled", "contract_level: certified");
    const humanRoot = humanRootBase.replace("hard_triggers: []", [
      "hard_triggers: []",
      "certification:",
      "  qualification_key: qk-retry",
      `  harness_capability_receipt_hash: ${autonomous.protectedCapability.receipt_hash}`,
      `  verification_intent_hash: ${harnessContractHash(verificationIntents)}`,
      "  certified_region: src",
    ].join("\n"));
    const started = await autonomous.controller.start({ rootPlanText: humanRoot, requestedProfile: "autonomous", idempotencyKey: "human-check-autonomous" });
    assert.equal(started.run.effective_profile, "autonomous");
    assert.equal(started.run.lifecycle, "delivery-ready-provisional");
    assert.equal(started.run.next_action, "accept-delivery");
  } finally { rmSync(autonomous.stateRoot, { recursive: true, force: true }); }
});

test("a protected blocked work phase commits once and resumes through a fresh transition", async () => {
  const context = setup({ blockOncePhase: "implementation" });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "blocked-work" });
    assert.equal(started.run.lifecycle, "blocked");
    assert.equal(started.run.next_action, "resume");
    assert.deepEqual(started.run.blockers, ["harness-phase-blocked"]);
    const resumed = await context.controller.control({ runId: started.run.run_id, action: "resume", expectedRevision: started.run.revision, idempotencyKey: "blocked-work-resume" });
    assert.equal(resumed.run.lifecycle, "delivery-ready-verified");
    assert.equal(context.counters.implementation, 2);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("protected start index recovery and schema variants remain exact", async () => {
  const context = setup();
  try {
    const key = "prepared-index-only";
    const rootHash = sha256(supervisedRoot);
    const runId = `run-${sha256(`${context.workspaceBinding}\0${rootHash}\0supervised\0${key}`).slice(0, 24)}`;
    const inputFingerprint = harnessContractHash({ action: "start", run_id: runId, root_hash: rootHash, requested_profile: "supervised" });
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

test("same-receipt decision recovery and pending-action conflicts stay transition-bound", async () => {
  let crash = true;
  let pendingRun = null;
  const context = setup({
    faultInjector: async (point, detail) => {
      if (crash && point === "after-prepare" && detail.transition.kind === "decision") {
        crash = false;
        pendingRun = detail.runId;
        throw new Error("same-receipt-crash");
      }
    },
  });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "same-receipt-start" });
    const receiptContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "accept-delivery", context: receiptContext });
    const input = { runId: started.run.run_id, action: "accept-delivery", expectedRevision: started.run.revision, idempotencyKey: "same-receipt", humanDecisionReceipt: receipt.receipt };
    await assert.rejects(() => context.controller.control(input), /same-receipt-crash/);
    await assert.rejects(() => context.controller.control({ runId: pendingRun, action: "stop", expectedRevision: started.run.revision, idempotencyKey: "different-pending", humanDecisionReceipt: receipt.receipt }), /already has a pending transition/);
    const recovered = await context.controller.control(input);
    assert.equal(recovered.run.lifecycle, "achieved");
    await assert.rejects(() => context.controller.control({ runId: recovered.run.run_id, action: "accept-delivery", expectedRevision: recovered.run.revision, idempotencyKey: "accept-terminal", humanDecisionReceipt: receipt.receipt }), /not awaiting acceptance/);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("blocked correction resumes as correction and then performs a fresh Review", async () => {
  const context = setup({ reviewStatuses: ["failed", "passed"], blockOncePhase: "correction" });
  try {
    const started = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "blocked-correction-start" });
    const decisionContext = {
      run_id: started.run.run_id,
      revision: started.run.revision,
      evidence_hash: artifactHash(started.run.artifacts[0].text),
      review_hash: artifactHash(started.run.artifacts[1].text),
    };
    const receipt = context.decisionReceiptAdapter.issue({ decision: "approve-correction", context: decisionContext });
    const blocked = await context.controller.control({ runId: started.run.run_id, action: "approve-correction", expectedRevision: started.run.revision, idempotencyKey: "blocked-correction", humanDecisionReceipt: receipt.receipt });
    assert.equal(blocked.run.lifecycle, "blocked");
    assert.equal(blocked.run.phase, "correction");
    assert.equal(blocked.run.next_action, "resume");
    const resumed = await context.controller.control({ runId: blocked.run.run_id, action: "resume", expectedRevision: blocked.run.revision, idempotencyKey: "resume-correction" });
    assert.equal(resumed.run.lifecycle, "delivery-ready-verified");
    assert.equal(context.counters.correction, 2);
    assert.equal(context.counters.review, 2);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("snapshot and protection conflicts never finalize staged phase results", async () => {
  const snapshotConflict = setup({ reviewSnapshot: "7".repeat(64) });
  try {
    const rejected = await snapshotConflict.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "snapshot-conflict" });
    assert.equal(rejected.run.lifecycle, "shadow");
    assert.equal(rejected.run.phase, "review");
    assert.equal(rejected.run.next_action, "resume");
    assert.equal(rejected.run.retry_safe, true);
    assert.match(rejected.run.blockers[0], /predecessor snapshot mismatch/);
    assert.equal(snapshotConflict.counters.implementation, 1);
    assert.equal(snapshotConflict.counters.review, 1);
    assert.equal(snapshotConflict.counters.phase_commits, 1, "invalid Review consumed its staged protection");
    const stopReceipt = snapshotConflict.decisionReceiptAdapter.issue({
      decision: "stop",
      context: { run_id: rejected.run.run_id, revision: rejected.run.revision, evidence_hash: null, review_hash: null },
    });
    const stopped = await snapshotConflict.controller.control({
      runId: rejected.run.run_id,
      action: "stop",
      expectedRevision: rejected.run.revision,
      idempotencyKey: "snapshot-conflict-stop",
      humanDecisionReceipt: stopReceipt.receipt,
    });
    assert.equal(stopped.run.lifecycle, "stopped");
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
    const rejected = await context.controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "invalid-review-input" });
    assert.equal(rejected.run.lifecycle, "shadow");
    assert.equal(rejected.run.phase, "review");
    assert.equal(rejected.run.next_action, "resume");
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
    assert.equal(recovered.run.lifecycle, "shadow");
    assert.equal(recovered.run.next_action, "stop");
    assert.equal(context.counters.phase_commits ?? 0, 0);
  } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
});

test("binding and completeness drift in a persisted finalization never consumes protection", async () => {
  const cases = [
    {
      name: "work-binding",
      crashPhase: "implementation",
      mutate: (draft) => { draft.result_entry.phase = "review"; },
      nextAction: "stop",
      priorCommits: 0,
    },
    {
      name: "work-review-transition",
      crashPhase: "implementation",
      mutate: (draft) => { draft.review_transition = null; },
      nextAction: "stop",
      priorCommits: 0,
    },
    {
      name: "review-artifacts",
      crashPhase: "review",
      mutate: (draft) => { draft.evidence = null; },
      nextAction: "resume",
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
      const input = { rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: `draft-${candidate.name}` };
      await assert.rejects(() => context.controller.start(input), new RegExp(`draft-crash:${candidate.name}`));
      const runId = `run-${sha256(`${context.workspaceBinding}\0${sha256(supervisedRoot)}\0supervised\0${input.idempotencyKey}`).slice(0, 24)}`;
      const root = join(context.stateRoot, "workflow-6-runs");
      const path = join(root, "runs", `${runId}.json`);
      const run = readProtectedRecord(path, root, { maxBytes: 2 * 1024 * 1024 });
      candidate.mutate(run.pending_transition.finalization);
      run.pending_transition.finalization_hash = harnessContractHash(run.pending_transition.finalization);
      writeProtectedRecord(path, run, root);
      const recovered = await peerController(context, { pidIsAlive: (pid) => pid === deadPid ? false : true }).start(input);
      assert.equal(recovered.run.lifecycle, "shadow");
      assert.equal(recovered.run.next_action, candidate.nextAction);
      assert.equal(context.counters.phase_commits ?? 0, candidate.priorCommits);
    } finally { rmSync(context.stateRoot, { recursive: true, force: true }); }
  }
});

test("missing Host Adapter protection creates one phase-local Shadow result", async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-no-host-adapter-"));
  try {
    const controller = createHarnessLifecycleController({
      stateRoot,
      workspaceBinding: harnessContractHash({ workspace_root: defaultRoot }),
      pluginRoot: defaultRoot,
      harnessBinding: null,
    });
    const started = await controller.start({ rootPlanText: supervisedRoot, requestedProfile: "supervised", idempotencyKey: "shadow-no-adapter" });
    assert.equal(started.run.lifecycle, "shadow");
    assert.deepEqual(started.run.blockers, ["harness-protection-unavailable"]);
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
    const inputFingerprint = harnessContractHash({ action: "start", run_id: expectedRunId, root_hash: rootHash, requested_profile: "supervised" });
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
