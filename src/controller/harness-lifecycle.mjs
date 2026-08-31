import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { harnessContractHash } from "../core/harness-attestations.mjs";
import { readProtectedRecord, writeProtectedRecord } from "../core/protected-record-store.mjs";
import { buildDeliveryEvidence, correctionHarnessVerificationIntents } from "./delivery-closeout.mjs";
import { orchestrateHarnessPhase } from "./harness-orchestrator.mjs";
import { buildWorkReview } from "./work-review-builder.mjs";

export const HARNESS_RUN_SCHEMA = 1;
const RUN_CONTRACT = "workflow-6-transactional";
const runPattern = /^run-[a-f0-9]{24}$/;
const INTERNAL_RETRY_SIGNATURE_LIMIT = 8;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function runRoot(stateRoot) {
  return join(stateRoot, "workflow-6-runs");
}

function runPath(stateRoot, runId) {
  if (!runPattern.test(String(runId ?? ""))) throw new Error("Workflow 6 run ID is invalid");
  return join(runRoot(stateRoot), "runs", `${runId}.json`);
}

function startIndexPath(stateRoot, idempotencyKey) {
  return join(runRoot(stateRoot), "start-idempotency", `${sha256(idempotencyKey)}.json`);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    return null;
  }
}

function lockOwnerPath(lock) {
  return join(lock, "owner.json");
}

function validLockOwner(owner) {
  return owner?.schema === 1
    && owner.kind === "workflow-6-lifecycle-lock"
    && typeof owner.owner_token === "string"
    && owner.owner_token.length >= 16
    && Number.isInteger(owner.pid)
    && owner.pid > 0
    && Number.isFinite(Date.parse(owner.acquired_at));
}

function withLifecycleLock(stateRoot, name, callback, {
  controllerInstanceId = "standalone",
  ownerPid = process.pid,
  pidIsAlive = processIsAlive,
  now = () => new Date(),
  staleMs = 30_000,
} = {}) {
  if (!/^[a-z0-9-]{1,96}$/.test(String(name ?? ""))) throw new Error("Workflow 6 lock name is invalid");
  const root = runRoot(stateRoot);
  const lock = join(root, "locks", `${name}.lock`);
  const ownerToken = `${controllerInstanceId}:${randomUUID()}`;
  mkdirSync(join(root, "locks"), { recursive: true, mode: 0o700 });
  let acquired = false;
  for (let attempt = 0; attempt < 2 && !acquired; attempt += 1) {
    try {
      mkdirSync(lock, { mode: 0o700 });
      acquired = true;
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner = null;
      try { owner = readProtectedRecord(lockOwnerPath(lock), root); } catch { /* ownerless or malformed */ }
      const ageMs = Math.max(0, new Date(now()).getTime() - lstatSync(lock).mtimeMs);
      const reclaimable = validLockOwner(owner) ? pidIsAlive(owner.pid) === false : ageMs >= staleMs;
      if (!reclaimable) {
        const busy = new Error("Workflow 6 run is busy");
        busy.code = "workflow-run-busy";
        throw busy;
      }
      const quarantine = `${lock}.reclaimed-${randomUUID()}`;
      try { renameSync(lock, quarantine); }
      catch (renameError) {
        if (renameError?.code === "ENOENT") continue;
        throw renameError;
      }
      rmSync(quarantine, { recursive: true, force: true });
    }
  }
  if (!acquired) throw new Error("Workflow 6 run lock could not be acquired");
  writeProtectedRecord(lockOwnerPath(lock), {
    schema: 1,
    kind: "workflow-6-lifecycle-lock",
    owner_token: ownerToken,
    controller_instance_id: controllerInstanceId,
    pid: ownerPid,
    acquired_at: new Date(now()).toISOString(),
  }, root);
  try { return callback(); }
  finally {
    let owner = null;
    try { owner = readProtectedRecord(lockOwnerPath(lock), root); } catch { /* do not release an unverifiable lock */ }
    if (validLockOwner(owner) && owner.owner_token === ownerToken) rmSync(lock, { recursive: true, force: true });
  }
}

function withRunLock(stateRoot, runId, callback, lockOptions) {
  if (!runPattern.test(String(runId ?? ""))) throw new Error("Workflow 6 run ID is invalid");
  return withLifecycleLock(stateRoot, runId, callback, lockOptions);
}

function readRun(stateRoot, runId) {
  const path = runPath(stateRoot, runId);
  if (!existsSync(path)) throw new Error(`unknown Workflow 6 run ${runId}`);
  const record = readProtectedRecord(path, runRoot(stateRoot), { maxBytes: 2 * 1024 * 1024 });
  if (!record || record.schema !== HARNESS_RUN_SCHEMA || record.kind !== "workflow-6-run" || record.contract !== RUN_CONTRACT) {
    throw new Error(`unsupported Workflow 6 run ${runId}`);
  }
  return record;
}

function writeRun(stateRoot, run) {
  writeProtectedRecord(runPath(stateRoot, run.run_id), run, runRoot(stateRoot));
  return run;
}

function exactRoot(rootPlanText, pluginRoot) {
  const inspected = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact.fields.schema !== 6) {
    throw new Error(`Workflow 6 run requires an exact valid Schema-6 Root: ${inspected.errors.join("; ") || "not a work-plan"}`);
  }
  return inspected.artifact.fields;
}

function event(run, type, additions = {}) {
  const at = new Date().toISOString();
  return {
    ...run,
    updated_at: at,
    events: [...(run.events ?? []), { at, type, revision: run.revision, ...additions }].slice(-256),
  };
}

function fingerprint(value) {
  return harnessContractHash(value);
}

function transitionId(runId, baseRevision, action, phase, idempotencyHash) {
  return `tr-${sha256(`${runId}\0${baseRevision}\0${action}\0${phase}\0${idempotencyHash}`).slice(0, 32)}`;
}

function hasIdempotency(run, key) {
  return Object.prototype.hasOwnProperty.call(run.idempotency ?? {}, key);
}

function assertIdempotency(run, key, expectedFingerprint) {
  if (!hasIdempotency(run, key)) return null;
  const entry = run.idempotency[key];
  if (entry.fingerprint !== expectedFingerprint) throw new Error("Workflow 6 idempotency key conflicts with another action or input");
  return entry;
}

function markIdempotency(run, transition, status, resultRevision = null) {
  const entries = Object.fromEntries(Object.entries(run.idempotency ?? {}).map(([key, value]) => [
    key,
    value.transition_id === transition.transition_id ? { ...value, status, result_revision: resultRevision } : value,
  ]));
  return { ...run, idempotency: entries };
}

function phaseNextAction(phase) {
  return phase === "review" ? "complete-review" : phase === "correction" ? "complete-correction" : "complete-implementation";
}

const humanStates = new Set(["root-ready", "review-needed", "correction-needed", "achieved", "open-points", "shadow-review"]);

function humanState(run) {
  if (humanStates.has(run.lifecycle)) return run.lifecycle;
  if (run.lifecycle === "implementing") return "root-ready";
  if (run.lifecycle === "reviewing") return "review-needed";
  if (run.lifecycle === "correcting") return "correction-needed";
  if (run.lifecycle === "waiting-human") return run.pending_transition?.decision === "review" ? "review-needed" : "correction-needed";
  return "shadow-review";
}

function humanNextAction(run, state = humanState(run)) {
  if (run.pending_transition || ["implementing", "reviewing", "correcting", "waiting-human"].includes(run.lifecycle)) return "none";
  if (state === "root-ready") return "implement-plan";
  if (state === "review-needed") return "review-work";
  if (state === "correction-needed") return "correct";
  if (["open-points", "shadow-review"].includes(state)) return "human-assessment";
  return "none";
}

function makeTransition({ run, action, phase, idempotencyKey, inputFingerprint, verificationMode = "root", kind = "phase", decision = null, decisionReceiptHash = null, executionLeaseValue = null }) {
  const idempotencyHash = sha256(`${idempotencyKey}\0${inputFingerprint}`);
  return {
    schema: 1,
    kind,
    transition_id: transitionId(run.run_id, run.revision, action, phase, idempotencyHash),
    base_revision: run.revision,
    action,
    phase,
    idempotency_key: idempotencyKey,
    idempotency_hash: idempotencyHash,
    input_fingerprint: inputFingerprint,
    verification_mode: verificationMode,
    decision,
    decision_receipt_hash: decisionReceiptHash,
    status: "prepared",
    handoff_status: "not-started",
    execution_lease: executionLeaseValue,
    phase_request_hash: null,
    protection_receipt_hash: null,
    staged: null,
    finalization: null,
    finalization_hash: null,
    prepared_at: new Date().toISOString(),
  };
}

function reserveTransition(stateRoot, runId, { expectedRevision, action, phase, idempotencyKey, inputFingerprint, verificationMode = "root", kind = "phase", decision = null, decisionReceiptHash = null, executionLeaseValue = null }, lockOptions) {
  return withRunLock(stateRoot, runId, () => {
    let run = readRun(stateRoot, runId);
    const duplicate = assertIdempotency(run, idempotencyKey, inputFingerprint);
    if (duplicate) return { run, duplicate: true, transition: run.pending_transition };
    if (run.revision !== expectedRevision) throw new Error(`Workflow 6 run revision conflict: expected ${expectedRevision}, current ${run.revision}`);
    if (run.pending_transition) throw new Error("Workflow 6 run already has a pending transition");
    const transition = makeTransition({ run, action, phase, idempotencyKey, inputFingerprint, verificationMode, kind, decision, decisionReceiptHash, executionLeaseValue });
    run = event({
      ...run,
      pending_transition: transition,
      lifecycle: kind === "decision" ? "waiting-human" : phase === "review" ? "reviewing" : phase === "correction" ? "correcting" : "implementing",
      phase,
      phase_status: "prepared",
      next_action: kind === "decision" ? action : phaseNextAction(phase),
      blockers: [],
      idempotency: {
        ...(run.idempotency ?? {}),
        [idempotencyKey]: { fingerprint: inputFingerprint, transition_id: transition.transition_id, status: "pending", result_revision: null },
      },
    }, "transition-prepared", { transition_id: transition.transition_id, action, phase });
    return { run: writeRun(stateRoot, run), duplicate: false, transition };
  }, lockOptions);
}

function runView(run) {
  const workflowState = humanState(run);
  return {
    schema: run.schema,
    kind: run.kind,
    run_id: run.run_id,
    root_plan_id: run.root_plan_id,
    root_hash: run.root_hash,
    requested_profile: run.requested_profile,
    effective_profile: run.effective_profile,
    downgrade_reason: run.downgrade_reason,
    workflow_state: workflowState,
    next_action: humanNextAction(run, workflowState),
    revision: run.revision,
    blockers: run.blockers,
    open_points: run.open_points ?? [],
    retry_safe: run.retry_safe ?? null,
    evidence_grade: run.evidence_grade,
    delivery_evidence_id: run.delivery_evidence?.fields?.id ?? null,
    work_review_id: run.work_review?.fields?.id ?? null,
    capability_receipt_hash: run.capability_receipt_hash,
    deployment_binding_hash: run.deployment_binding_hash,
    phase_receipt_hashes: (run.phase_results ?? []).map((entry) => entry.protection_receipt_hash),
    decision_receipt_hashes: (run.decision_receipts ?? []).map((entry) => entry.protection_receipt_hash),
    technical: {
      lifecycle: run.lifecycle,
      phase: run.phase,
      phase_status: run.phase_status,
      next_action: run.next_action,
      transition: run.pending_transition ? {
        transition_id: run.pending_transition.transition_id,
        base_revision: run.pending_transition.base_revision,
        action: run.pending_transition.action,
        phase: run.pending_transition.phase,
        status: run.pending_transition.status,
        handoff_status: run.pending_transition.handoff_status ?? null,
        phase_request_hash: run.pending_transition.phase_request_hash,
        protection_receipt_hash: run.pending_transition.protection_receipt_hash,
      } : null,
    },
    artifacts: (run.artifact_chain ?? []).map(({ label, text }) => ({ label, text })),
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

function reviewInputFromEvidence(evidence) {
  const achieved = ["verified", "supported"].includes(evidence.fields.overall_grade) && evidence.fields.status !== "blocked";
  const limitations = [...new Set((evidence.fields.check_evidence ?? []).flatMap((entry) => entry.limitations ?? []))];
  const point = achieved ? null : {
    key: "harness-evidence",
    type: "evidence",
    summary: "The protected Harness evidence does not support every required Check on the reviewed snapshot.",
    evidence: limitations.join(" ") || `Evidence grade is ${evidence.fields.overall_grade}.`,
    impact: "Workflow cannot derive Achieved from this snapshot.",
    question: "Should the human end with this limitation or authorize work that resolves the failed or unavailable evidence?",
  };
  return {
    schema: 1,
    kind: "review-input",
    outcome: achieved ? "achieved" : "open-points",
    assessment_summary: achieved
      ? "Every required verification intent is at least supported on the reviewed snapshot."
      : point.summary,
    snapshot_summary: "The project Harness reviewed the exact post-work snapshot without changing it.",
    findings: [],
    open_points: point ? [point] : [],
  };
}

function terminalState(_evidence, review) {
  if (review.fields.outcome === "correction-needed") return { lifecycle: "correction-needed", next_action: "correct" };
  if (review.fields.outcome === "open-points") return { lifecycle: "open-points", next_action: "human-assessment" };
  return { lifecycle: "achieved", next_action: "none" };
}

function correctionVerificationIntents(run, pluginRoot) {
  if (!run.work_review?.artifact || !Array.isArray(run.artifact_chain)) return null;
  const entries = [[run.root_plan_id, run.root_plan], ...run.artifact_chain.map((entry) => [entry.label, entry.text])];
  const inspected = inspectArtifactSet(entries, pluginRoot);
  if (inspected.errors.length > 0) throw new Error(`Workflow 6 correction lineage is invalid: ${inspected.errors.join("; ")}`);
  const tips = effectiveCliSummary(inspected);
  const review = inspected.effective.get(tips.review_tips[run.root_plan_id]);
  if (!review?.correction) throw new Error("Workflow 6 correction requires the current protected correction proposal");
  return correctionHarnessVerificationIntents(review.correction, executionContractFromArtifactText(run.root_plan, pluginRoot));
}

function decisionContext(run) {
  return {
    run_id: run.run_id,
    revision: run.revision,
    evidence_hash: run.delivery_evidence?.artifact_hash ?? null,
    review_hash: run.work_review?.artifact_hash ?? null,
  };
}

export function createHarnessLifecycleController({
  stateRoot,
  workspaceBinding,
  pluginRoot,
  harnessBinding,
  decisionReceiptAdapter = null,
  faultInjector = null,
  controllerInstanceId = randomUUID(),
  ownerPid = process.pid,
  pidIsAlive = processIsAlive,
  now = () => new Date(),
  lockStaleMs = 30_000,
}) {
  if (!stateRoot || !workspaceBinding || !pluginRoot) throw new Error("Workflow 6 lifecycle requires state, workspace, and plugin bindings");
  if (typeof controllerInstanceId !== "string" || !controllerInstanceId.trim()) throw new Error("Workflow 6 lifecycle requires controller_instance_id");
  if (!Number.isInteger(ownerPid) || ownerPid < 1) throw new Error("Workflow 6 lifecycle requires a valid owner PID");
  const fault = async (point, context = {}) => { if (faultInjector) await faultInjector(point, context); };
  const transitionExecutions = new Map();
  const lockOptions = { controllerInstanceId, ownerPid, pidIsAlive, now, staleMs: lockStaleMs };
  const withOwnedRunLock = (runId, callback) => withRunLock(stateRoot, runId, callback, lockOptions);
  const executionLease = () => ({
    owner_id: controllerInstanceId,
    pid: ownerPid,
    acquired_at: new Date(now()).toISOString(),
  });
  const leaseIsForeignAndLive = (transition) => {
    const lease = transition?.execution_lease;
    if (!lease || lease.owner_id === controllerInstanceId) return false;
    return pidIsAlive(lease.pid) !== false;
  };
  const response = (run, duplicate = false, explicitInProgress = false) => ({
    run: runView(run),
    duplicate,
    in_progress: explicitInProgress || transitionExecutions.has(run.pending_transition?.transition_id) || leaseIsForeignAndLive(run.pending_transition),
  });

  const finalizeFailure = (runId, transitionIdValue, orchestration) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const transition = run.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue) throw new Error("Workflow 6 failure transition changed during finalization");
    const mutating = ["implementation", "correction"].includes(transition.phase);
    const retrySafe = transition.phase === "review" || orchestration.handoff_status === "not-started";
    const signature = fingerprint({
      phase: transition.phase,
      mode: orchestration.mode ?? null,
      status: orchestration.status ?? null,
      handoff_status: orchestration.handoff_status ?? null,
      blockers: orchestration.blockers ?? [],
      downgrade_reason: orchestration.downgrade_reason ?? null,
    });
    const signatures = transition.retry_signatures ?? [];
    const repeated = signatures.includes(signature);
    const withinRetryBudget = signatures.length < INTERNAL_RETRY_SIGNATURE_LIMIT;
    if (retrySafe && !repeated && withinRetryBudget) {
      run = event({
        ...run,
        phase_status: "prepared",
        next_action: phaseNextAction(transition.phase),
        blockers: [],
        retry_safe: true,
        pending_transition: {
          ...transition,
          status: "prepared",
          handoff_status: "not-started",
          execution_lease: null,
          phase_request_hash: null,
          protection_receipt_hash: null,
          staged: null,
          finalization: null,
          finalization_hash: null,
          retry_signatures: [...signatures, signature],
        },
      }, `${transition.phase}-internal-retry`, { transition_id: transition.transition_id, retry_signature: signature });
      return writeRun(stateRoot, run);
    }
    const reason = repeated
      ? "The same technical failure signature repeated without measurable progress."
      : retrySafe
        ? "The internal retry budget ended before the phase produced a usable result."
        : "The mutating phase may have started, so an automatic retry would be unsafe.";
    run = markIdempotency(run, transition, "committed", run.revision + 1);
    run = event({
      ...run,
      revision: run.revision + 1,
      pending_transition: null,
      lifecycle: "open-points",
      phase: transition.phase,
      phase_status: orchestration.status,
      next_action: "human-assessment",
      blockers: [],
      open_points: [{
        key: repeated ? "no-progress" : "environment-unavailable",
        type: repeated ? "no-progress" : "environment",
        summary: reason,
        evidence: (orchestration.blockers ?? []).join(" ") || `Failure signature ${signature}.`,
        impact: mutating && !retrySafe ? "Repository outcome is uncertain and no automatic retry was attempted." : "The targeted Workflow phase produced no authoritative result.",
        question: "How should the human assess this limitation before any new work is authorized?",
      }],
      downgrade_reason: orchestration.downgrade_reason ?? run.downgrade_reason,
      retry_safe: retrySafe,
    }, `${transition.phase}-open-points`, {
      transition_id: transition.transition_id,
      handoff_status: orchestration.handoff_status ?? "outcome-unknown",
      retry_safe: retrySafe,
      retry_signature: signature,
    });
    return writeRun(stateRoot, run);
  });

  const persistStaged = (runId, transitionIdValue, orchestration) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const transition = run.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.status !== "executing") throw new Error("Workflow 6 transition is not executing for a staged result");
    run = event({
      ...run,
      phase_status: "result-ready",
      effective_profile: orchestration.effective_profile,
      downgrade_reason: orchestration.downgrade_reason ?? run.downgrade_reason,
      capability_receipt_hash: orchestration.capability_receipt_hash,
      deployment_binding_hash: orchestration.deployment_binding_hash,
      pending_transition: {
        ...transition,
        status: "result-ready",
        handoff_status: "staged",
        phase_request_hash: harnessContractHash(orchestration.request),
        protection_receipt_hash: orchestration.protection_receipt_hash,
        staged: {
          request: orchestration.request,
          result: orchestration.result,
          effective_profile: orchestration.effective_profile,
          downgrade_reason: orchestration.downgrade_reason ?? null,
          capability_receipt_hash: orchestration.capability_receipt_hash,
          deployment_binding_hash: orchestration.deployment_binding_hash,
        },
      },
    }, "transition-result-staged", { transition_id: transition.transition_id });
    return writeRun(stateRoot, run);
  });

  const claimPhaseExecution = (runId, transitionIdValue) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const transition = run.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.kind !== "phase") throw new Error("Workflow 6 phase transition changed before execution");
    if (transition.status === "executing") {
      if (leaseIsForeignAndLive(transition)) return { run, recovery_only: true, in_progress: true };
      run = event({
        ...run,
        pending_transition: { ...transition, execution_lease: executionLease() },
      }, "transition-recovery-claimed", { transition_id: transition.transition_id });
      return { run: writeRun(stateRoot, run), recovery_only: true, in_progress: false };
    }
    if (["result-ready", "commit-ready"].includes(transition.status)) {
      if (leaseIsForeignAndLive(transition)) return { run, recovery_only: true, in_progress: true };
      run = event({
        ...run,
        pending_transition: { ...transition, execution_lease: executionLease() },
      }, "transition-finalization-recovery-claimed", { transition_id: transition.transition_id });
      return { run: writeRun(stateRoot, run), recovery_only: true, in_progress: false };
    }
    if (transition.status !== "prepared") return { run, recovery_only: false, in_progress: false };
    if (leaseIsForeignAndLive(transition)) return { run, recovery_only: false, in_progress: true };
    run = event({
      ...run,
      phase_status: "executing",
      pending_transition: {
        ...transition,
        status: "executing",
        execution_lease: executionLease(),
        execution_started_at: new Date(now()).toISOString(),
      },
    }, "transition-execution-claimed", { transition_id: transition.transition_id });
    return { run: writeRun(stateRoot, run), recovery_only: false, in_progress: false };
  });

  const finalizationDraft = (run, transition) => {
    const staged = transition.staged;
    const resultEntry = {
      phase: transition.phase,
      result: staged.result,
      protection_receipt_hash: transition.protection_receipt_hash,
      transition_id: transition.transition_id,
    };
    if (["implementation", "correction"].includes(transition.phase)) {
      if (staged.result.status !== "completed") return { kind: "work-blocked", result_entry: resultEntry };
      return { kind: "work-completed", result_entry: resultEntry };
    }
    const workEntry = (run.phase_results ?? []).at(-1);
    if (!workEntry || !["implementation", "correction"].includes(workEntry.phase)) throw new Error("Workflow 6 Review has no protected work predecessor");
    if (staged.result.workspace_snapshot_before !== workEntry.result.workspace_snapshot_after) throw new Error("Workflow 6 Review predecessor snapshot mismatch");
    const evidence = buildDeliveryEvidence({
      rootPlanText: run.root_plan,
      artifacts: run.artifact_chain ?? [],
      checkEvidence: [],
      changedPaths: workEntry.result.changed_paths,
      effectiveProfile: staged.effective_profile,
      harnessAttestations: staged.result.check_attestations,
      harnessId: staged.result.harness_id,
      protectedAttestationHash: transition.protection_receipt_hash,
      workspaceBinding,
      workspaceSnapshotHash: staged.result.workspace_snapshot_after,
      pluginRoot,
    });
    const workReview = buildWorkReview({
      rootPlanText: run.root_plan,
      artifacts: [...(run.artifact_chain ?? []), { label: evidence.fields.id, text: evidence.artifact }],
      reviewInput: staged.result.review_input ?? reviewInputFromEvidence(evidence),
      pluginRoot,
    });
    return {
      kind: "review-completed",
      result_entry: resultEntry,
      evidence,
      work_review: workReview,
      terminal: terminalState(evidence, workReview, staged.effective_profile, staged.request),
    };
  };

  const rejectFinalization = (runId, transitionIdValue, error) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const transition = run.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || !["result-ready", "commit-ready"].includes(transition.status)) throw error;
    run = markIdempotency(run, transition, "committed", run.revision + 1);
    run = event({
      ...run,
      revision: run.revision + 1,
      pending_transition: null,
      lifecycle: "open-points",
      phase: transition.phase,
      phase_status: "invalid",
      next_action: "human-assessment",
      blockers: [],
      open_points: [{
        key: "formal-result-invalid",
        type: "formal-binding",
        summary: "The protected Harness result could not be finalized into a valid Workflow result.",
        evidence: String(error.code ?? error.message),
        impact: "No authoritative Review artifacts were committed for this phase.",
        question: "How should the human assess this formal result limitation?",
      }],
      retry_safe: transition.phase === "review",
    }, "transition-finalization-open-points", { transition_id: transition.transition_id, retry_safe: transition.phase === "review" });
    return writeRun(stateRoot, run);
  });

  const prepareFinalization = async (runId, transitionIdValue) => {
    const current = readRun(stateRoot, runId);
    const transition = current.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.status !== "result-ready") throw new Error("Workflow 6 transition has no result ready to validate");
    let draft;
    try { draft = finalizationDraft(current, transition); }
    catch (error) { return rejectFinalization(runId, transitionIdValue, error); }
    const prepared = withOwnedRunLock(runId, () => {
      let run = readRun(stateRoot, runId);
      const pending = run.pending_transition;
      if (!pending || pending.transition_id !== transition.transition_id || pending.status !== "result-ready") throw new Error("Workflow 6 transition changed before finalization preparation");
      run = event({
        ...run,
        phase_status: "commit-ready",
        pending_transition: {
          ...pending,
          status: "commit-ready",
          finalization: draft,
          finalization_hash: harnessContractHash(draft),
        },
      }, "transition-commit-ready", { transition_id: pending.transition_id });
      return writeRun(stateRoot, run);
    });
    await fault("after-finalization-ready", { runId, transition: structuredClone(prepared.pending_transition) });
    return prepared;
  };

  const finalizePhase = async (runId, transitionIdValue) => {
    const current = readRun(stateRoot, runId);
    const transition = current.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.status !== "commit-ready" || !transition.finalization) throw new Error("Workflow 6 transition has no validated finalization ready to commit");
    try {
      const draft = transition.finalization;
      if (transition.finalization_hash !== harnessContractHash(draft)) throw new Error("Workflow 6 finalization draft integrity mismatch");
      if (draft.result_entry?.transition_id !== transition.transition_id
        || draft.result_entry?.phase !== transition.phase
        || draft.result_entry?.protection_receipt_hash !== transition.protection_receipt_hash) {
        throw new Error("Workflow 6 finalization draft binding mismatch");
      }
      const allowedKinds = transition.phase === "review" ? ["review-completed"] : ["work-completed", "work-blocked"];
      if (!allowedKinds.includes(draft.kind)) throw new Error("Workflow 6 finalization draft outcome mismatch");
      if (draft.kind === "review-completed" && (!draft.evidence?.artifact || !draft.work_review?.artifact || !draft.terminal)) {
        throw new Error("Workflow 6 Review finalization draft is incomplete");
      }
    } catch (error) {
      return rejectFinalization(runId, transitionIdValue, error);
    }
    const consumeKey = `${runId}:${transition.base_revision}:${transition.action}:${transition.idempotency_hash}:${transition.transition_id}`;
    const protection = await harnessBinding.commitPhase({ transitionId: transition.transition_id, consumeKey });
    if (protection.receipt_hash !== transition.protection_receipt_hash) throw new Error("Workflow 6 committed protection differs from the staged receipt");
    await fault("after-protection-commit", { runId, transition: structuredClone(transition) });
    await fault("before-finalize", { runId, transition: structuredClone(transition) });

    return withOwnedRunLock(runId, () => {
      let run = readRun(stateRoot, runId);
      const pending = run.pending_transition;
      if (!pending || pending.transition_id !== transition.transition_id || pending.status !== "commit-ready") throw new Error("Workflow 6 transition changed before final commit");
      const staged = pending.staged;
      const draft = pending.finalization;
      if (draft.kind === "work-blocked") {
          run = markIdempotency(run, pending, "committed", run.revision + 1);
          run = event({
            ...run,
            revision: run.revision + 1,
            pending_transition: null,
            phase_results: [...(run.phase_results ?? []), draft.result_entry],
            lifecycle: "open-points",
            phase: pending.phase,
            phase_status: staged.result.status,
            next_action: "human-assessment",
            blockers: [],
            open_points: [{
              key: "harness-phase-blocked",
              type: "environment",
              summary: "The project Harness explicitly reported that the phase could not complete.",
              evidence: staged.result.limitations?.join(" ") || `Harness status is ${staged.result.status}.`,
              impact: "No Review result can be derived for the intended phase outcome.",
              question: "How should the human assess the reported Harness limitation?",
            }],
          }, `${pending.phase}-open-points`, { transition_id: pending.transition_id });
          return writeRun(stateRoot, run);
      }
      if (draft.kind === "work-completed") {
        run = markIdempotency(run, pending, "committed", run.revision + 1);
        run = {
          ...run,
          revision: run.revision + 1,
          phase_results: [...(run.phase_results ?? []), draft.result_entry],
          pending_transition: null,
          phase: pending.phase,
          phase_status: "completed",
          lifecycle: "review-needed",
          next_action: "review-work",
          blockers: [],
        };
        return writeRun(stateRoot, event(run, "fresh-review-pending", { completed_transition_id: pending.transition_id }));
      }
      if (draft.kind !== "review-completed") throw new Error("Workflow 6 persisted finalization draft is invalid");
      run = markIdempotency(run, pending, "committed", run.revision + 1);
      run = event({
        ...run,
        revision: run.revision + 1,
        pending_transition: null,
        effective_profile: staged.effective_profile,
        downgrade_reason: staged.downgrade_reason ?? run.downgrade_reason,
        phase: "review",
        phase_status: "completed",
        ...draft.terminal,
        blockers: [],
        evidence_grade: draft.evidence.fields.overall_grade,
        delivery_evidence: draft.evidence,
        work_review: draft.work_review,
        artifact_chain: [
          ...(run.artifact_chain ?? []),
          { label: draft.evidence.fields.id, text: draft.evidence.artifact },
          { label: draft.work_review.fields.id, text: draft.work_review.artifact, builder_provenance: draft.work_review.provenance },
        ],
        phase_results: [...(run.phase_results ?? []), draft.result_entry],
      }, "delivery-reviewed", { transition_id: pending.transition_id });
      return writeRun(stateRoot, run);
    });
  };

  const advancePhase = async (runId) => {
    let run = readRun(stateRoot, runId);
    let transition = run.pending_transition;
    if (!transition || transition.kind !== "phase") return run;
    if (transitionExecutions.has(transition.transition_id)) return run;
    if (["result-ready", "commit-ready"].includes(transition.status)) {
      const claimed = claimPhaseExecution(runId, transition.transition_id);
      run = claimed.run;
      transition = run.pending_transition;
      if (claimed.in_progress) return run;
    }
    if (transition.status === "commit-ready") return finalizePhase(runId, transition.transition_id);
    if (transition.status === "result-ready") {
      run = await prepareFinalization(runId, transition.transition_id);
      return run.pending_transition?.status === "commit-ready" ? finalizePhase(runId, transition.transition_id) : run;
    }
    const execute = async () => {
      const claimed = claimPhaseExecution(runId, transition.transition_id);
      run = claimed.run;
      transition = run.pending_transition;
      if (claimed.in_progress) return run;
      await fault("after-execution-claim", { runId, transition: structuredClone(transition) });
      const verificationIntents = transition.verification_mode === "correction" ? correctionVerificationIntents(run, pluginRoot) : null;
      const orchestration = await orchestrateHarnessPhase({
        harnessBinding,
        phase: transition.phase,
        profile: run.effective_profile ?? run.requested_profile,
        rootPlanText: run.root_plan,
        lineageHashes: (run.phase_results ?? []).map((entry) => entry.protection_receipt_hash),
        verificationIntents,
        workspaceBinding,
        pluginRoot,
        runId: run.run_id,
        runRevision: transition.base_revision,
        transitionId: transition.transition_id,
        idempotencyHash: transition.idempotency_hash,
        recoveryOnly: claimed.recovery_only,
      });
      await fault("after-harness-stage", { runId, transition: structuredClone(transition), orchestration });
      if (!orchestration.result || typeof orchestration.commitProtection !== "function") return finalizeFailure(runId, transition.transition_id, orchestration);
      run = persistStaged(runId, transition.transition_id, orchestration);
      await fault("after-result-stage", { runId, transition: structuredClone(run.pending_transition) });
      transition = run.pending_transition;
      run = await prepareFinalization(runId, transition.transition_id);
      return run.pending_transition?.status === "commit-ready" ? finalizePhase(runId, transition.transition_id) : run;
    };
    const transitionIdValue = transition.transition_id;
    const executing = execute().finally(() => transitionExecutions.delete(transitionIdValue));
    transitionExecutions.set(transitionIdValue, executing);
    return executing;
  };

  const advanceToGate = async (runId) => {
    let run = readRun(stateRoot, runId);
    while (run.pending_transition?.kind === "phase") {
      const transitionIdValue = run.pending_transition.transition_id;
      run = await advancePhase(runId);
      if (run.pending_transition?.transition_id === transitionIdValue
        && (transitionExecutions.has(transitionIdValue) || leaseIsForeignAndLive(run.pending_transition))) break;
    }
    return run;
  };

  const start = async ({ rootPlanText, requestedProfile, idempotencyKey }) => {
    if (!["supervised", "autonomous"].includes(requestedProfile)) throw new Error("Workflow 6 automated runs require supervised or autonomous");
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) throw new Error("Workflow 6 start requires idempotency_key");
    const root = exactRoot(rootPlanText, pluginRoot);
    const rootHash = sha256(rootPlanText);
    const runId = `run-${sha256(`${workspaceBinding}\0${rootHash}\0${requestedProfile}\0${idempotencyKey}`).slice(0, 24)}`;
    const inputFingerprint = fingerprint({ action: "implement", run_id: runId, root_hash: rootHash, requested_profile: requestedProfile });
    let duplicate = false;
    let createdTransition = null;
    withLifecycleLock(stateRoot, `start-${sha256(idempotencyKey).slice(0, 32)}`, () => {
      const indexPath = startIndexPath(stateRoot, idempotencyKey);
      const indexRoot = runRoot(stateRoot);
      const indexed = existsSync(indexPath);
      if (indexed) {
        const index = readProtectedRecord(indexPath, indexRoot);
        if (index?.schema !== 1 || index?.kind !== "workflow-6-start-idempotency" || index.contract !== RUN_CONTRACT) throw new Error("Workflow 6 start idempotency record is invalid");
        if (index.fingerprint !== inputFingerprint || index.run_id !== runId) throw new Error("Workflow 6 idempotency key conflicts with another action or input");
        if (existsSync(runPath(stateRoot, runId))) {
          const existing = readRun(stateRoot, runId);
          const entry = assertIdempotency(existing, idempotencyKey, inputFingerprint);
          if (!entry) throw new Error("Workflow 6 start idempotency conflict");
          duplicate = true;
          return;
        }
      }
      if (!indexed) writeProtectedRecord(indexPath, {
        schema: 1,
        kind: "workflow-6-start-idempotency",
        contract: RUN_CONTRACT,
        idempotency_key_hash: sha256(idempotencyKey),
        fingerprint: inputFingerprint,
        run_id: runId,
        created_at: new Date().toISOString(),
      }, indexRoot);
      const path = runPath(stateRoot, runId);
      if (existsSync(path)) {
        throw new Error("Workflow 6 run already exists without its protected start index");
      }
      const now = new Date().toISOString();
      let run = {
        schema: HARNESS_RUN_SCHEMA,
        kind: "workflow-6-run",
        contract: RUN_CONTRACT,
        run_id: runId,
        root_plan_id: root.id,
        root_hash: rootHash,
        root_plan: rootPlanText,
        requested_profile: requestedProfile,
        effective_profile: requestedProfile,
        downgrade_reason: null,
        lifecycle: "implementing",
        phase: "implementation",
        phase_status: "prepared",
        next_action: "complete-implementation",
        revision: 0,
        blockers: [],
        evidence_grade: null,
        capability_receipt_hash: null,
        deployment_binding_hash: null,
        phase_results: [],
        decision_receipts: [],
        delivery_evidence: null,
        work_review: null,
        artifact_chain: [],
        pending_transition: null,
        idempotency: {},
        events: [],
        created_at: now,
        updated_at: now,
      };
      const transition = makeTransition({ run, action: "implement", phase: "implementation", idempotencyKey, inputFingerprint, executionLeaseValue: executionLease() });
      createdTransition = transition;
      run.pending_transition = transition;
      run.idempotency[idempotencyKey] = { fingerprint: inputFingerprint, transition_id: transition.transition_id, status: "pending", result_revision: null };
      run = event(run, "run-started", { transition_id: transition.transition_id });
      writeRun(stateRoot, run);
    }, lockOptions);
    if (createdTransition) await fault("after-prepare", { runId, transition: structuredClone(createdTransition) });
    const completed = await advanceToGate(runId);
    return response(completed, duplicate);
  };

  const claimDecisionExecution = (runId, transitionIdValue) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const transition = run.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.kind !== "decision") throw new Error("Workflow 6 decision transition changed before execution");
    if (leaseIsForeignAndLive(transition)) return { run, in_progress: true };
    run = event({
      ...run,
      pending_transition: { ...transition, execution_lease: executionLease() },
    }, transition.execution_lease ? "decision-recovery-claimed" : "decision-execution-claimed", { transition_id: transition.transition_id });
    return { run: writeRun(stateRoot, run), in_progress: false };
  });

  const stageDecisionReceipt = (runId, transitionIdValue, humanDecisionReceipt) => {
    const current = readRun(stateRoot, runId);
    const transition = current.pending_transition;
    if (!transition || transition.transition_id !== transitionIdValue || transition.kind !== "decision") throw new Error("Workflow 6 human decision transition changed before staging");
    if (transition.status === "decision-ready") return current;
    if (transition.status !== "prepared") throw new Error("Workflow 6 human decision transition is not prepared");
    const staged = decisionReceiptAdapter.recover({ transitionId: transition.transition_id }) ?? decisionReceiptAdapter.stage({
        receipt: humanDecisionReceipt,
        decision: transition.decision,
        context: decisionContext(current),
        transitionId: transition.transition_id,
      });
    if (staged.receipt_hash !== transition.decision_receipt_hash) throw new Error("Workflow 6 staged human decision differs from the reserved receipt");
    return withOwnedRunLock(runId, () => {
      let run = readRun(stateRoot, runId);
      const pending = run.pending_transition;
      if (!pending || pending.transition_id !== transition.transition_id || pending.status !== "prepared") throw new Error("Workflow 6 human decision transition changed during staging");
      run = event({
        ...run,
        phase_status: "result-ready",
        pending_transition: { ...pending, status: "decision-ready", protection_receipt_hash: staged.receipt_hash },
      }, "human-decision-staged", { transition_id: pending.transition_id });
      return writeRun(stateRoot, run);
    });
  };

  const rebindPreparedDecisionReceipt = (runId, transitionIdValue, receiptHash) => withOwnedRunLock(runId, () => {
    let run = readRun(stateRoot, runId);
    const pending = run.pending_transition;
    if (!pending || pending.transition_id !== transitionIdValue || pending.kind !== "decision" || pending.status !== "prepared") throw new Error("Workflow 6 human decision cannot be rebound after staging");
    if (pending.decision_receipt_hash === receiptHash) return run;
    run = event({
      ...run,
      pending_transition: { ...pending, decision_receipt_hash: receiptHash },
    }, "human-decision-receipt-rebound", { transition_id: pending.transition_id });
    return writeRun(stateRoot, run);
  });

  const advanceDecision = async (runId, humanDecisionReceipt = null) => {
    let current = readRun(stateRoot, runId);
    let transition = current.pending_transition;
    if (!transition || transition.kind !== "decision") return current;
    if (transitionExecutions.has(transition.transition_id)) return current;
    const execute = async () => {
      const claimed = claimDecisionExecution(runId, transition.transition_id);
      current = claimed.run;
      transition = current.pending_transition;
      if (claimed.in_progress) return current;
      if (transition.status === "prepared") {
        const recovered = decisionReceiptAdapter.recover({ transitionId: transition.transition_id });
        if (!recovered && (typeof humanDecisionReceipt !== "string" || !humanDecisionReceipt)) throw new Error("Workflow 6 human decision recovery requires the exact host receipt");
        current = stageDecisionReceipt(runId, transition.transition_id, humanDecisionReceipt);
        transition = current.pending_transition;
        await fault("after-decision-stage", { runId, transition: structuredClone(transition) });
      }
      if (transition.status !== "decision-ready") throw new Error("Workflow 6 human decision is not ready to commit");
      const consumeKey = `${runId}:${transition.base_revision}:${transition.action}:${transition.idempotency_hash}:${transition.transition_id}`;
      const protection = decisionReceiptAdapter.commit({ transitionId: transition.transition_id, consumeKey });
      if (protection.receipt_hash !== transition.decision_receipt_hash) throw new Error("Workflow 6 human decision protection changed before commit");
      await fault("after-decision-commit", { runId, transition: structuredClone(transition) });
      await fault("before-finalize", { runId, transition: structuredClone(transition) });
      let continuePhase = false;
      const run = withOwnedRunLock(runId, () => {
        let value = readRun(stateRoot, runId);
        const pending = value.pending_transition;
        if (!pending || pending.transition_id !== transition.transition_id || pending.status !== "decision-ready") throw new Error("Workflow 6 decision transition changed before final commit");
        value = {
          ...value,
          revision: value.revision + 1,
          pending_transition: null,
          decision_receipts: [...(value.decision_receipts ?? []), { decision: pending.decision, run_revision: pending.base_revision, protection_receipt_hash: protection.receipt_hash, transition_id: pending.transition_id }],
        };
        const phase = pending.decision === "correct" ? "correction" : "review";
        const verificationMode = phase === "correction"
          ? "correction"
          : (value.phase_results ?? []).at(-1)?.phase === "correction" ? "correction" : "root";
        const phaseTransition = makeTransition({
          run: value,
          action: pending.action,
          phase,
          idempotencyKey: pending.idempotency_key,
          inputFingerprint: pending.input_fingerprint,
          verificationMode,
          executionLeaseValue: executionLease(),
        });
        value.pending_transition = phaseTransition;
        value.idempotency = Object.fromEntries(Object.entries(value.idempotency).map(([key, entry]) => [key, entry.transition_id === pending.transition_id ? { ...entry, transition_id: phaseTransition.transition_id } : entry]));
        value.lifecycle = phase === "correction" ? "correcting" : "reviewing";
        value.phase = phase;
        value.phase_status = "prepared";
        value.next_action = phaseNextAction(phase);
        value.blockers = [];
        continuePhase = true;
        return writeRun(stateRoot, event(value, phase === "correction" ? "correction-approved" : "review-approved", { transition_id: pending.transition_id }));
      });
      return continuePhase ? advanceToGate(runId) : run;
    };
    const transitionIdValue = transition.transition_id;
    const executing = execute().finally(() => transitionExecutions.delete(transitionIdValue));
    transitionExecutions.set(transitionIdValue, executing);
    return executing;
  };

  const control = async ({ runId, action, expectedRevision, idempotencyKey, humanDecisionReceipt }) => {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("Workflow 6 control requires expected_revision");
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) throw new Error("Workflow 6 control requires idempotency_key");
    if (!["review", "correct"].includes(action)) throw new Error(`unsupported Workflow 6 control action ${action}`);
    let current = readRun(stateRoot, runId);
    const inputFingerprint = fingerprint({ action, run_id: runId, expected_revision: expectedRevision });
    const prior = assertIdempotency(current, idempotencyKey, inputFingerprint);
    if (prior) {
      if (current.pending_transition?.kind === "decision" && current.pending_transition.status === "prepared") {
        if (!decisionReceiptAdapter) throw new Error("protected human decision adapter is unavailable");
        const verified = decisionReceiptAdapter.verify({ receipt: humanDecisionReceipt, decision: action, context: decisionContext(current) });
        current = rebindPreparedDecisionReceipt(runId, current.pending_transition.transition_id, verified.receipt_hash);
      }
      const recovered = current.pending_transition ? (current.pending_transition.kind === "decision" ? await advanceDecision(runId, humanDecisionReceipt) : await advanceToGate(runId)) : current;
      return response(recovered, true);
    }
    if (current.revision !== expectedRevision) throw new Error(`Workflow 6 run revision conflict: expected ${expectedRevision}, current ${current.revision}`);

    if (current.pending_transition) throw new Error("Workflow 6 run already has a pending transition");

    if (!decisionReceiptAdapter) throw new Error("protected human decision adapter is unavailable");
    if (action === "review" && current.lifecycle !== "review-needed") throw new Error("Workflow 6 Review is not awaiting Review Work authorization");
    if (action === "correct" && current.lifecycle !== "correction-needed") throw new Error("Workflow 6 correction is not awaiting Correct Work authorization");
    const context = decisionContext(current);
    const idempotencyHash = sha256(`${idempotencyKey}\0${inputFingerprint}`);
    const decisionTransitionId = transitionId(runId, expectedRevision, action, action, idempotencyHash);
    const verified = decisionReceiptAdapter.verify({ receipt: humanDecisionReceipt, decision: action, context });
    const reserved = reserveTransition(stateRoot, runId, {
      expectedRevision,
      action,
      phase: action,
      idempotencyKey,
      inputFingerprint,
      kind: "decision",
      decision: action,
      decisionReceiptHash: verified.receipt_hash,
      executionLeaseValue: executionLease(),
    }, lockOptions);
    if (reserved.transition.transition_id !== decisionTransitionId) throw new Error("Workflow 6 decision transition binding mismatch");
    await fault("after-prepare", { runId, transition: structuredClone(reserved.transition) });
    return response(await advanceDecision(runId, humanDecisionReceipt), reserved.duplicate);
  };

  return Object.freeze({
    start,
    control,
    status: (runId) => {
      const run = readRun(stateRoot, runId);
      return { ...runView(run), in_progress: transitionExecutions.has(run.pending_transition?.transition_id) || leaseIsForeignAndLive(run.pending_transition) };
    },
  });
}
