import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import {
  buildHarnessPhaseRequest,
  harnessEligibility,
  orchestrateHarnessPhase,
} from "../src/controller/harness-orchestrator.mjs";
import {
  HARNESS_CAPABILITY_RECEIPT_SCHEMA,
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  HARNESS_PHASE_CONTRACT_SCHEMA,
  calibrateHarnessCheckEvidence,
  harnessContractHash,
  harnessConstraintProjection,
  validateHarnessCapabilityReceipt,
  validateHarnessCheckAttestation,
  validateHarnessPhaseRequest,
  validateHarnessPhaseResult,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";
import { createHostHarnessTrustAdapter } from "../src/harness/host-trust-adapter.mjs";
import { createProtectedHarnessBinding } from "../src/harness/module-adapter.mjs";

const rootPlanText = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
const snapshot = "b".repeat(64);
const evidenceHash = "c".repeat(64);
const harnessId = "project-harness";
const deploymentBindingHash = "9".repeat(64);
const trustRoots = [];
test.after(() => trustRoots.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function trustAdapter() {
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-harness-trust-"));
  trustRoots.push(stateRoot);
  return createHostHarnessTrustAdapter({ stateRoot, harnessId });
}

function signed(value, field) {
  return { ...value, [field]: harnessContractHash(value) };
}

function capability(overrides = {}) {
  return signed({
    schema: HARNESS_CAPABILITY_RECEIPT_SCHEMA,
    kind: "harness-capability-receipt",
    harness_id: "project-harness",
    harness_version: "1.0.0",
    deployment_binding_hash: deploymentBindingHash,
    workspace_binding: workspaceBinding,
    capabilities: [
      "phase-execution",
      "authority-enforcement",
      "read-only-review",
      "workspace-snapshot",
      "evidence-attestation",
      "budget-reporting",
      "cancellation",
    ],
    qualification_keys: ["qk-retry"],
    policy_hash: "a".repeat(64),
    issued_at: "2026-08-25T00:00:00.000Z",
    expires_at: "2099-08-25T00:00:00.000Z",
    ...overrides,
  }, "content_hash");
}

function attestation(request, status = "passed", overrides = {}) {
  const check = request.verification_intents[0];
  return signed({
    schema: HARNESS_CHECK_ATTESTATION_SCHEMA,
    kind: "harness-check-attestation",
    harness_id: "project-harness",
    check_id: check["Check ID"],
    root_hash: request.root_hash,
    verification_intent_hash: verificationIntentHash(check),
    workspace_binding: request.workspace_binding,
    workspace_snapshot_hash: snapshot,
    status,
    observed: status === "passed" ? "The intended repository outcome was observed." : status === "failed" ? "The intended outcome was contradicted." : "Evidence was unavailable.",
    evidence_hashes: status === "passed" ? [evidenceHash] : [],
    issued_at: "2026-08-25T00:00:00.000Z",
    ...overrides,
  }, "content_hash");
}

function phaseResult(request, status = "passed", overrides = {}) {
  return signed({
    schema: HARNESS_PHASE_CONTRACT_SCHEMA,
    kind: "harness-phase-result",
    phase: request.phase,
    status: status === "failed" ? "blocked" : "completed",
    harness_id: harnessId,
    deployment_binding_hash: deploymentBindingHash,
    capability_receipt_hash: "a".repeat(64),
    phase_request_hash: harnessContractHash(request),
    transition_id: request.transition_id,
    root_hash: request.root_hash,
    workspace_binding: request.workspace_binding,
    workspace_snapshot_before: snapshot,
    workspace_snapshot_after: snapshot,
    changed_paths: [],
    check_attestations: [attestation(request, status)],
    usage: { active_minutes: 1, total_tokens: 10, cost_usd: 0 },
    limitations: [],
    ...overrides,
  }, "content_hash");
}

function protectedBinding(harness) {
  return createProtectedHarnessBinding({
    harness,
    harnessId,
    deploymentBindingHash,
    trustAdapter: trustAdapter(),
  });
}

test("PhaseRequest is closed and contains intent but no execution policy", () => {
  const request = buildHarnessPhaseRequest({
    phase: "review",
    rootPlanText,
    workspaceBinding,
    pluginRoot: defaultRoot,
  });
  assert.equal(request.review_read_only, true);
  assert.deepEqual(Object.keys(request.verification_intents[0]), [
    "Check ID", "Objectives", "Verification Intent", "Expected Evidence",
    "Required", "Evidence Class", "Cost Class", "Prerequisites",
  ]);
  assert.doesNotMatch(JSON.stringify(request), /working.directory|command|ddev|npm|model|sandbox|worktree/i);
  assert.throws(() => validateHarnessPhaseResult({ ...phaseResult(request), command: "anything" }, request), /unsupported fields/);
});

test("private harness execution choices are invisible and equivalent to Core", async () => {
  const privateTraces = [
    { command: "ddev exec project-check" },
    { command: "npm test" },
    { command: "sh -lc 'nested && pipeline'" },
    { command: "completely-different-project-tool verify" },
  ];
  const outputs = [];
  for (const privateTrace of privateTraces) {
    const harness = {
      privateTrace,
      capabilityReceipt: async () => capability(),
      executePhase: async (request, context) => phaseResult(request, "passed", { capability_receipt_hash: context.capability_protection_hash }),
    };
    const output = await orchestrateHarnessPhase({
      harnessBinding: protectedBinding(harness),
      phase: "review",
      profile: "manual",
      rootPlanText,
      workspaceBinding,
      pluginRoot: defaultRoot,
    });
    assert.equal(output.status, "completed", JSON.stringify(output));
    assert.doesNotMatch(JSON.stringify(output), /ddev|npm test|nested|different-project-tool/);
    const { capability_receipt_hash: ignoredCapability, content_hash: ignoredContent, ...conceptualResult } = output.result;
    outputs.push(conceptualResult);
  }
  assert.equal(new Set(outputs.map((value) => JSON.stringify(value))).size, 1);
});

test("protectedCapability is one atomic reusable host operation for an exact deployment and workspace", async () => {
  const binding = protectedBinding({
    capabilityReceipt: async () => capability(),
    executePhase: async (request, context) => phaseResult(request, "passed", { capability_receipt_hash: context.capability_protection_hash }),
  });
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const first = await binding.protectedCapability({ request });
  const repeated = await binding.protectedCapability({ request });
  assert.deepEqual(repeated.payload, first.payload);
  assert.equal(repeated.receipt_hash, first.receipt_hash);
});

test("missing capability is Shadow Mode and never blocks ordinary host use", async () => {
  const output = await orchestrateHarnessPhase({
    harnessBinding: null,
    phase: "review",
    profile: "manual",
    rootPlanText,
    workspaceBinding,
    pluginRoot: defaultRoot,
  });
  assert.equal(output.mode, "shadow");
  assert.equal(output.status, "unavailable");
  assert.deepEqual(output.blockers, ["harness-protection-unavailable"]);
});

test("attestations calibrate passed, missing, failed, and mismatched evidence honestly", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const passed = attestation(request);
  const verified = buildDeliveryEvidence({
    rootPlanText,
    checkEvidence: [],
    effectiveProfile: "manual",
    harnessAttestations: [passed],
    harnessId,
    protectedAttestationHash: "f".repeat(64),
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    pluginRoot: defaultRoot,
  });
  assert.equal(verified.fields.overall_grade, "verified");
  assert.equal(verified.fields.check_evidence[0].attestation_hash, "f".repeat(64));

  const provisional = buildDeliveryEvidence({
    rootPlanText,
    checkEvidence: [],
    effectiveProfile: "manual",
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    pluginRoot: defaultRoot,
  });
  assert.equal(provisional.fields.status, "provisional");
  assert.equal(provisional.fields.overall_grade, "unavailable");

  const failed = buildDeliveryEvidence({
    rootPlanText,
    checkEvidence: [],
    effectiveProfile: "manual",
    harnessAttestations: [attestation(request, "failed")],
    harnessId,
    protectedAttestationHash: "f".repeat(64),
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    pluginRoot: defaultRoot,
  });
  assert.equal(failed.fields.status, "blocked");
  assert.equal(failed.fields.overall_grade, "failed");

  assert.throws(() => validateHarnessCheckAttestation(attestation(request, "passed", { root_hash: "d".repeat(64) }), {
    root_hash: request.root_hash,
  }), /root_hash mismatch|hash mismatch/);
});

test("review PhaseResult enforces matching snapshots and binding", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const changed = phaseResult(request, "passed", { workspace_snapshot_after: "d".repeat(64), check_attestations: [] });
  assert.throws(() => validateHarnessPhaseResult(changed, request), /changed the repository snapshot/);
  const foreign = phaseResult(request, "passed", { workspace_binding: "e".repeat(64), check_attestations: [] });
  assert.throws(() => validateHarnessPhaseResult(foreign, request), /binding mismatch/);
});

test("Autonomous eligibility is exact and qualification-bound", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const receipt = capability();
  const protectedReceiptHash = "f".repeat(64);
  const rootFields = {
    profile_max: "autonomous",
    certification: {
      qualification_key: "qk-retry",
      harness_capability_receipt_hash: protectedReceiptHash,
      verification_intent_hash: harnessContractHash(request.verification_intents),
      certified_region: "src",
    },
  };
  assert.equal(harnessEligibility({ receipt, protectionReceiptHash: protectedReceiptHash, request, profile: "autonomous", rootFields }).eligible, true);
  const wrong = { ...rootFields, certification: { ...rootFields.certification, qualification_key: "qk-other" } };
  const downgraded = harnessEligibility({ receipt, protectionReceiptHash: protectedReceiptHash, request, profile: "autonomous", rootFields: wrong });
  assert.equal(downgraded.mode, "supervised");
  assert.match(downgraded.downgrade_reason, /qualification-key-not-earned/);
});

test("a changed host deployment binding invalidates prior Capability qualification", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const trust = trustAdapter();
  const firstCapability = capability({ qualification_keys: ["qk-retry"] });
  const firstProtection = trust.issue({
    kind: "harness-capability",
    payload: firstCapability,
    bindings: { harness_id: harnessId, workspace_binding: workspaceBinding, deployment_binding_hash: deploymentBindingHash },
    reusable: true,
  });
  const rootFields = {
    profile_max: "autonomous",
    certification: {
      qualification_key: "qk-retry",
      harness_capability_receipt_hash: firstProtection.receipt_hash,
      verification_intent_hash: harnessContractHash(request.verification_intents),
      certified_region: "src",
    },
  };
  assert.equal(harnessEligibility({ receipt: firstCapability, protectionReceiptHash: firstProtection.receipt_hash, request, profile: "autonomous", rootFields }).mode, "autonomous");

  const changedDeployment = "8".repeat(64);
  const changedCapability = capability({ deployment_binding_hash: changedDeployment, qualification_keys: ["qk-retry"] });
  const changedProtection = trust.issue({
    kind: "harness-capability",
    payload: changedCapability,
    bindings: { harness_id: harnessId, workspace_binding: workspaceBinding, deployment_binding_hash: changedDeployment },
    reusable: true,
  });
  const changed = harnessEligibility({ receipt: changedCapability, protectionReceiptHash: changedProtection.receipt_hash, request, profile: "autonomous", rootFields });
  assert.equal(changed.mode, "supervised");
  assert.match(changed.downgrade_reason, /autonomous-capability-receipt-mismatch/);
});

test("runtime and JSON schemas share the generic contract versions", () => {
  const contract = executionContractFromArtifactText(rootPlanText, defaultRoot);
  assert.equal(contract.fields.schema, 6);
  for (const [path, id] of [
    ["schemas/capability-receipt.schema.json", "urn:geldmacher:workflow:harness-capability-receipt:1"],
    ["schemas/harness-phase-request.schema.json", "urn:geldmacher:workflow:harness-phase-request:1"],
    ["schemas/harness-phase-result.schema.json", "urn:geldmacher:workflow:harness-phase-result:1"],
    ["schemas/harness-check-attestation.schema.json", "urn:geldmacher:workflow:harness-check-attestation:1"],
  ]) {
    const schema = JSON.parse(readFileSync(join(defaultRoot, path), "utf8"));
    assert.equal(schema.$id, id);
    assert.equal(schema.additionalProperties, false);
  }
});

test("closed harness validators reject authority, budget, capability, and usage drift", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  assert.throws(() => validateHarnessCapabilityReceipt(null), /must be an object/);
  assert.throws(() => validateHarnessCapabilityReceipt(capability({ capabilities: ["phase-execution", "project-command-runner"] })), /unsupported harness capability/);
  assert.throws(() => validateHarnessCapabilityReceipt(capability({ expires_at: "2020-01-01T00:00:00.000Z" })), /validity dates/);
  assert.throws(() => validateHarnessCapabilityReceipt(capability({ qualification_keys: ["invalid"] })), /qualification key/);
  assert.throws(() => validateHarnessCapabilityReceipt({ ...capability(), content_hash: "0".repeat(64) }), /hash mismatch/);

  assert.throws(() => validateHarnessPhaseRequest({ ...request, phase: "deploy" }), /unsupported harness phase/);
  assert.throws(() => validateHarnessPhaseRequest({ ...request, review_read_only: false }), /review_read_only/);
  assert.throws(() => validateHarnessPhaseRequest({ ...request, authority: { ...request.authority, external_effects: "network" } }), /repository-only/);
  assert.throws(() => validateHarnessPhaseRequest({ ...request, authority: { ...request.authority, allowed_dependencies: ["x"] } }), /requires allow-listed/);
  assert.throws(() => validateHarnessPhaseRequest({
    ...request,
    authority: { ...request.authority, dependencies: "allow-listed", allowed_dependencies: [] },
  }), /non-empty strings/);
  assert.throws(() => validateHarnessPhaseRequest({ ...request, budgets: { ...request.budgets, max_total_tokens: 1.5 } }), /positive integer/);

  const invalidUsage = phaseResult(request, "passed", { usage: { active_minutes: -1, total_tokens: 1.5, cost_usd: -1 } });
  assert.throws(() => validateHarnessPhaseResult(invalidUsage, request), /non-negative/);
  assert.throws(() => validateHarnessPhaseResult({ ...phaseResult(request), content_hash: "0".repeat(64) }, request), /content hash mismatch/);
});

test("Check attestations reject unknown, duplicate, unbound, and contradictory evidence", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  assert.throws(() => validateHarnessCheckAttestation(attestation(request, "passed", { evidence_hashes: [] })), /requires evidence_hashes|hash mismatch/);
  assert.throws(() => validateHarnessCheckAttestation(attestation(request, "passed", { status: "invented" })), /unsupported harness Check status|hash mismatch/);
  assert.throws(() => validateHarnessCheckAttestation(attestation(request, "passed", { issued_at: "not-a-date" })), /issued_at|hash mismatch/);
  assert.throws(() => validateHarnessPhaseResult(phaseResult(request, "passed", {
    check_attestations: [attestation(request), attestation(request)],
  }), request), /repeats a Check attestation/);
  assert.throws(() => validateHarnessPhaseResult(phaseResult(request, "passed", {
    check_attestations: [attestation(request, "passed", { check_id: "CHECK-99" })],
  }), request), /unknown Check/);
});

test("evidence calibration preserves human decisions and explicit unavailability", () => {
  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  const check = request.verification_intents[0];
  const base = [{ check_id: "CHECK-1", grade: "verified", observed: "Caller observation.", limitations: ["No harness attestation."] }];
  const unavailable = calibrateHarnessCheckEvidence({
    entries: base,
    plannedChecks: request.verification_intents,
    attestations: [attestation(request, "unavailable")],
    rootHash: request.root_hash,
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    expectedHarnessId: harnessId,
    protectedAttestationHash: "f".repeat(64),
  });
  assert.equal(unavailable[0].grade, "unavailable");
  assert.match(unavailable[0].limitations.join("\n"), /reported.*unavailable/i);

  const humanCheck = { ...check, "Evidence Class": "human-decision-required" };
  const humanRequest = { ...request, verification_intents: [humanCheck] };
  const humanAttestation = attestation(humanRequest);
  const human = calibrateHarnessCheckEvidence({
    entries: base,
    plannedChecks: [humanCheck],
    attestations: [humanAttestation],
    rootHash: request.root_hash,
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    expectedHarnessId: harnessId,
    protectedAttestationHash: "f".repeat(64),
  });
  assert.equal(human[0].grade, "supported");
  assert.match(human[0].limitations.join("\n"), /explicit human decision/i);
  assert.deepEqual(calibrateHarnessCheckEvidence({
    entries: [{ check_id: "CHECK-99", grade: "supported" }],
    plannedChecks: request.verification_intents,
    rootHash: request.root_hash,
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
    expectedHarnessId: harnessId,
    protectedAttestationHash: "f".repeat(64),
  }), [{ check_id: "CHECK-99", grade: "supported" }]);
  assert.throws(() => calibrateHarnessCheckEvidence({
    entries: base,
    plannedChecks: request.verification_intents,
    attestations: [attestation(request), attestation(request)],
    rootHash: request.root_hash,
    workspaceBinding,
    workspaceSnapshotHash: snapshot,
  }), /multiple harness attestations/);

  const projection = harnessConstraintProjection({
    checks: [humanCheck],
    evidence: human,
  });
  assert.equal(projection.human_attention.required, true);
  assert.equal(projection.problem_details.some((detail) => detail.blocking), true);
  assert.equal(harnessConstraintProjection({ checks: [check], evidence: [], pending: true }).human_attention.required, false);
});

test("orchestration failures downgrade to Shadow Mode without interpreting private execution", async () => {
  const invalidRoot = await orchestrateHarnessPhase({
    harnessBinding: null,
    phase: "review",
    profile: "manual",
    rootPlanText: rootPlanText.replace("schema: 6", "schema: 7"),
    workspaceBinding,
    pluginRoot: defaultRoot,
  }).catch((error) => error);
  assert.match(invalidRoot.message, /Schema-6 Root/);

  const capabilityFailure = await orchestrateHarnessPhase({
    harnessBinding: protectedBinding({
      capabilityReceipt: async () => { throw new Error("offline"); },
      executePhase: async () => { throw new Error("must not execute"); },
    }),
    phase: "review",
    profile: "manual",
    rootPlanText,
    workspaceBinding,
    pluginRoot: defaultRoot,
  });
  assert.equal(capabilityFailure.mode, "shadow");
  assert.match(capabilityFailure.blockers[0], /capability-unavailable:offline/);

  assert.throws(() => protectedBinding({ capabilityReceipt: async () => capability() }), /Harness implementation/);

  const invalidResult = await orchestrateHarnessPhase({
    harnessBinding: protectedBinding({
      capabilityReceipt: async () => capability(),
      executePhase: async () => ({ status: "invented" }),
    }),
    phase: "review",
    profile: "manual",
    rootPlanText,
    workspaceBinding,
    pluginRoot: defaultRoot,
  });
  assert.equal(invalidResult.mode, "shadow");
  assert.match(invalidResult.blockers[0], /harness-phase-invalid/);

  const request = buildHarnessPhaseRequest({ phase: "review", rootPlanText, workspaceBinding, pluginRoot: defaultRoot });
  assert.equal(harnessEligibility({ receipt: capability(), protectionReceiptHash: "f".repeat(64), request, profile: "invented", rootFields: { profile_max: "manual" } }).mode, "shadow");
  assert.match(harnessEligibility({ receipt: { broken: true }, protectionReceiptHash: "f".repeat(64), request, profile: "manual", rootFields: { profile_max: "manual" } }).blockers[0], /capability-invalid/);
});

test("host receipts reject payload drift, foreign bindings, and replay", () => {
  const trust = trustAdapter();
  const payload = capability();
  const bindings = { harness_id: harnessId, workspace_binding: workspaceBinding };
  const protectedValue = trust.issue({ kind: "harness-phase-result", payload, bindings, reusable: false });
  assert.equal(trust.verify({ receipt: protectedValue.receipt, kind: "harness-phase-result", payload, bindings, consumeKey: "run:1" }).consumed_by, "run:1");
  assert.equal(trust.verify({ receipt: protectedValue.receipt, kind: "harness-phase-result", payload, bindings, consumeKey: "run:1" }).consumed_by, "run:1");
  assert.throws(() => trust.verify({ receipt: protectedValue.receipt, kind: "harness-phase-result", payload, bindings, consumeKey: "run:2" }), /replayed/);
  assert.throws(() => trust.verify({ receipt: protectedValue.receipt, kind: "harness-phase-result", payload: { ...payload, harness_version: "2" }, bindings }), /payload mismatch/);
  assert.throws(() => trust.verify({ receipt: protectedValue.receipt, kind: "harness-phase-result", payload, bindings: { ...bindings, workspace_binding: "0".repeat(64) } }), /binding mismatch/);
});
