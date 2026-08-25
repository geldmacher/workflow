import { createHash } from "node:crypto";
import { executionContractFromArtifactText, inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import {
  HARNESS_PHASE_CONTRACT_SCHEMA,
  harnessContractHash,
  validateHarnessCapabilityReceipt,
  validateHarnessPhaseRequest,
  validateHarnessPhaseResult,
} from "../core/harness-attestations.mjs";

const REQUIRED_CAPABILITIES = Object.freeze({
  planning: ["phase-execution", "authority-enforcement", "budget-reporting"],
  implementation: ["phase-execution", "authority-enforcement", "workspace-snapshot", "evidence-attestation", "budget-reporting"],
  review: ["phase-execution", "authority-enforcement", "read-only-review", "workspace-snapshot", "evidence-attestation", "budget-reporting"],
  correction: ["phase-execution", "authority-enforcement", "workspace-snapshot", "evidence-attestation", "budget-reporting"],
});
const PROFILE_RANK = Object.freeze({ manual: 1, supervised: 2, autonomous: 3 });

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function authorityProjection(authority) {
  const { max_active_minutes: ignoredMinutes, max_total_tokens: ignoredTokens, max_cost_usd: ignoredCost, ...authorityOnly } = authority ?? {};
  return authorityOnly;
}

function budgets(authority) {
  return {
    max_active_minutes: authority?.max_active_minutes ?? null,
    max_total_tokens: authority?.max_total_tokens ?? null,
    max_cost_usd: authority?.max_cost_usd ?? null,
  };
}

export function buildHarnessPhaseRequest({
  phase,
  rootPlanText,
  lineageHashes = [],
  workspaceBinding,
  verificationIntents = null,
  pluginRoot,
  runId = null,
  runRevision = 0,
  transitionId = null,
  idempotencyHash = null,
}) {
  const inspected = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact.fields.schema !== 6) {
    throw new Error(`harness phase requires an exact valid Schema-6 Root: ${inspected.errors.join("; ") || "not a work-plan"}`);
  }
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  const rootHash = sha256(rootPlanText);
  const effectiveRunId = runId ?? `run-${sha256(`manual\0${phase}\0${rootHash}\0${workspaceBinding}`).slice(0, 24)}`;
  const effectiveTransitionId = transitionId ?? `tr-${sha256(`${effectiveRunId}\0${runRevision}\0${phase}`).slice(0, 32)}`;
  return validateHarnessPhaseRequest({
    schema: HARNESS_PHASE_CONTRACT_SCHEMA,
    kind: "harness-phase-request",
    phase,
    run_id: effectiveRunId,
    run_revision: runRevision,
    transition_id: effectiveTransitionId,
    idempotency_hash: idempotencyHash ?? sha256(`${effectiveTransitionId}\0manual`),
    root_plan_id: inspected.artifact.fields.id,
    root_hash: rootHash,
    lineage_hashes: [...new Set(lineageHashes)],
    workspace_binding: workspaceBinding,
    authority: authorityProjection(contract.fields.authority),
    verification_intents: verificationIntents ?? contract.checks,
    budgets: budgets(contract.fields.authority),
    review_read_only: phase === "review",
  });
}

function genericEligibility(capability, request, profile, rootFields) {
  const blockers = [];
  const maximum = PROFILE_RANK[rootFields?.profile_max] ?? 0;
  if (PROFILE_RANK[profile] > maximum) blockers.push("requested-profile-exceeds-root-authority");
  if (capability.workspace_binding !== request.workspace_binding) blockers.push("harness-workspace-binding-mismatch");
  if (Date.parse(capability.expires_at) <= Date.now()) blockers.push("harness-capability-expired");
  for (const required of REQUIRED_CAPABILITIES[request.phase] ?? []) {
    if (!capability.capabilities.includes(required)) blockers.push(`harness-capability-missing:${required}`);
  }
  return blockers;
}

export function harnessEligibility({ receipt, protectionReceiptHash, request, profile, rootFields }) {
  if (!PROFILE_RANK[profile]) return { eligible: false, mode: "shadow", blockers: ["requested-profile-invalid"] };
  if (!receipt || !/^[a-f0-9]{64}$/.test(String(protectionReceiptHash ?? ""))) {
    return { eligible: false, mode: "shadow", blockers: ["harness-capability-protection-unavailable"] };
  }
  let capability;
  try { capability = validateHarnessCapabilityReceipt(receipt); }
  catch (error) { return { eligible: false, mode: "shadow", blockers: [`harness-capability-invalid:${error.message}`] }; }
  const requestedBlockers = genericEligibility(capability, request, profile, rootFields);
  if (profile !== "autonomous") {
    return { eligible: requestedBlockers.length === 0, mode: requestedBlockers.length === 0 ? profile : "shadow", blockers: requestedBlockers, receipt: capability };
  }
  const autonomousBlockers = [...requestedBlockers];
  const certification = rootFields?.certification;
  if (!certification) autonomousBlockers.push("autonomous-certification-missing");
  else {
    if (certification.harness_capability_receipt_hash !== protectionReceiptHash) autonomousBlockers.push("autonomous-capability-receipt-mismatch");
    if (!capability.qualification_keys.includes(certification.qualification_key)) autonomousBlockers.push("autonomous-qualification-key-not-earned");
    if (certification.verification_intent_hash !== harnessContractHash(request.verification_intents)) autonomousBlockers.push("autonomous-verification-intent-mismatch");
  }
  if (autonomousBlockers.length === 0) return { eligible: true, mode: "autonomous", blockers: [], receipt: capability };
  const supervisedBlockers = genericEligibility(capability, request, "supervised", rootFields);
  if (supervisedBlockers.length === 0) return {
    eligible: true,
    mode: "supervised",
    blockers: [],
    receipt: capability,
    downgrade_reason: autonomousBlockers.join(","),
  };
  return { eligible: false, mode: "shadow", blockers: [...new Set([...autonomousBlockers, ...supervisedBlockers])], receipt: capability };
}

function shadow(request, blockers, handoffStatus = "not-started") {
  return {
    mode: "shadow",
    status: "unavailable",
    request,
    blockers: Array.isArray(blockers) ? blockers : [blockers],
    result: null,
    handoff_status: handoffStatus,
    ordinary_host_use_blocked: false,
  };
}

export async function orchestrateHarnessPhase({
  harnessBinding = null,
  phase,
  profile,
  rootPlanText,
  lineageHashes = [],
  verificationIntents = null,
  workspaceBinding,
  pluginRoot,
  runId = null,
  runRevision = 0,
  transitionId = null,
  idempotencyHash = null,
  recoveryOnly = false,
}) {
  const request = buildHarnessPhaseRequest({
    phase, rootPlanText, lineageHashes, workspaceBinding, verificationIntents, pluginRoot,
    runId, runRevision, transitionId, idempotencyHash,
  });
  const root = inspectArtifactText(rootPlanText, pluginRoot).artifact.fields;
  if (!harnessBinding) return shadow(request, "harness-protection-unavailable");
  const trustedHarnessId = harnessBinding.harnessId;
  const deploymentBindingHash = harnessBinding.deploymentBindingHash;

  let capability;
  let protectedCapability;
  try {
    protectedCapability = await harnessBinding.protectedCapability({ request });
    capability = validateHarnessCapabilityReceipt(protectedCapability?.payload);
    if (capability.harness_id !== trustedHarnessId) throw new Error("harness capability identity differs from the host binding");
    if (capability.deployment_binding_hash !== deploymentBindingHash) throw new Error("harness capability deployment differs from the host binding");
    if (!/^[a-f0-9]{64}$/.test(String(protectedCapability?.receipt_hash ?? ""))) throw new Error("host capability protection is unavailable");
  } catch (error) {
    return shadow(request, `harness-capability-unavailable:${error.message}`);
  }

  const eligibility = harnessEligibility({
    receipt: capability,
    protectionReceiptHash: protectedCapability.receipt_hash,
    request,
    profile,
    rootFields: root,
  });
  if (!eligibility.eligible) {
    return shadow(request, eligibility.blockers.length > 0 ? eligibility.blockers : ["harness-executor-unavailable"]);
  }

  let handoffAttempted = false;
  let hostResultObserved = false;
  try {
    let staged = await harnessBinding.recoverPhase({ transitionId: request.transition_id });
    if (!staged && recoveryOnly) return shadow(request, "host transition has no safely recoverable staged result", "recovery-unavailable");
    if (!staged) {
      handoffAttempted = true;
      staged = await harnessBinding.stagePhase({
        request,
        capability,
        capabilityReceiptHash: protectedCapability.receipt_hash,
        effectiveProfile: eligibility.mode,
      });
    }
    hostResultObserved = true;
    const result = validateHarnessPhaseResult(staged?.payload, request, {
      harness_id: trustedHarnessId,
      deployment_binding_hash: deploymentBindingHash,
      capability_receipt_hash: protectedCapability.receipt_hash,
    });
    if (!/^[a-f0-9]{64}$/.test(String(staged?.receipt_hash ?? ""))) throw new Error("host phase protection was not staged");
    const output = {
      mode: eligibility.mode,
      requested_profile: profile,
      effective_profile: eligibility.mode,
      downgrade_reason: eligibility.downgrade_reason ?? null,
      status: result.status,
      request,
      blockers: [],
      result,
      handoff_status: "staged",
      capability_receipt_hash: protectedCapability.receipt_hash,
      deployment_binding_hash: deploymentBindingHash,
      protection_receipt_hash: staged.receipt_hash,
      protection_status: staged.status,
      ordinary_host_use_blocked: false,
    };
    Object.defineProperty(output, "commitProtection", {
      enumerable: false,
      value: (consumeKey) => harnessBinding.commitPhase({ transitionId: request.transition_id, consumeKey }),
    });
    return output;
  } catch (error) {
    return shadow(request, `harness-phase-invalid:${error.message}`, recoveryOnly ? "recovery-unavailable" : handoffAttempted || hostResultObserved ? "outcome-unknown" : "not-started");
  }
}
