import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText,
  rootContentHash,
} from "../controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import { buildWorkReview, persistWorkReview } from "../controller/work-review-builder.mjs";
import { buildManualReviewLifecycle } from "../controller/manual-review-lifecycle.mjs";
import { boundaryReceiptVerifier } from "../harness/boundary-receipts.mjs";
import { resolveNativePlan } from "../core/native-plan-resolution.mjs";
import {
  captureRepositorySnapshot,
  repositorySnapshotHash,
  validateConsumedNativeReviewReceipt,
} from "../harness/native-task-review-state.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import {
  commitNativeReviewInvocationResult,
  consumeNativeReviewReceipt,
  nativeReviewReceiptBindingHash,
  replayNativeReviewInvocationResult,
} from "../../hooks/native-review-receipt.mjs";
import { isWorkspaceRootsUnavailable } from "./workspace-roots.mjs";
import { reviewInputSchema } from "./review-input-contract.mjs";

const bundleSize = (artifacts = []) => artifacts.reduce((total, artifact) => total + artifact.text.length, 0);
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const sanitizedShadowFindings = (reviewInput) => {
  const parsed = reviewInputSchema.safeParse(reviewInput);
  if (!parsed.success) return [];
  return parsed.data.findings.map(({ key, severity, evidence, reasoning }) => ({
    key,
    severity,
    evidence: evidence.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim(),
    reasoning: reasoning.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim(),
  }));
};

export function createArtifactHandlers({
  pluginRoot,
  resolveOperationalContext,
  resolveCursorReceiptContext = null,
  result,
  handoffStoreFactory = createContentAddressedHandoffStore,
  receiptOptions = {},
  clientHost = "portable",
  consumeReviewReceipt = consumeNativeReviewReceipt,
  reviewHarnessPhase = null,
}) {
  const toolResult = (toolName, value, isError = false) => {
    if (typeof result === "function" && result.toolAware === true) return result(toolName, value, isError);
    return result(value, isError);
  };
  const failure = (toolName) => (error) => toolResult(toolName, {
    error: error.message,
    ...(error?.code ? { error_code: error.code } : {}),
    ...(Array.isArray(error?.attempted_sources) ? { attempted_sources: error.attempted_sources } : {}),
    ...(Array.isArray(error?.candidate_ids) ? { candidate_ids: error.candidate_ids } : {}),
    ...(Array.isArray(error?.rejected_sources) ? { rejected_sources: error.rejected_sources } : {}),
    ...(typeof error?.resolution === "string" ? { resolution: error.resolution } : {}),
  }, true);

  const codedError = (code, message, details = {}) => {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
  };

  const shadowReview = (input, reasonCode, limitation, recoveryAction = "establish-formal-review-binding") => {
    const repositoryFindings = sanitizedShadowFindings(input.review_input);
    const findingLabel = repositoryFindings.length === 1 ? "finding is" : "findings are";
    return toolResult("workflow_closeout", {
      artifact_kind: "work-review",
      mode: "shadow",
      status: "unavailable",
      assessment: "shadow",
      ...(input.root_plan_id ? { root_plan_id: input.root_plan_id } : {}),
      repository_outcome: `${repositoryFindings.length} non-authoritative repository ${findingLabel} available; formal Plan conformance was not assessed.`,
      repository_findings_authoritative: false,
      repository_findings: repositoryFindings,
      evidence_status: "No Workflow Evidence or Work Review artifact was created.",
      reason_code: reasonCode,
      limitations: [limitation],
      artifacts_persisted: false,
      workflow_state_changed: false,
      persistence_scope: "none",
      recovery_action: recoveryAction,
      harness_mode: "shadow",
      harness_status: "unavailable",
      harness_limitations: [limitation],
    });
  };

  const mergeArtifacts = (entries) => {
    const merged = new Map();
    for (const entry of entries) {
      const prior = merged.get(entry.label);
      if (prior && prior.text !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, {
        label: entry.label,
        text: entry.text,
        ...(entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {}),
      });
    }
    return merged;
  };

  const inferredRootPlanId = (rootPlanId, artifacts = []) => {
    if (rootPlanId) return rootPlanId;
    for (const entry of artifacts) {
      if (!entry?.text) continue;
      const inspected = inspectArtifactText(entry.text, pluginRoot);
      if (inspected.errors.length > 0) continue;
      if (inspected.artifact?.fields?.artifact === "work-plan") return inspected.artifact.fields.id;
      if (inspected.artifact?.fields?.artifact === "work-review") return inspected.artifact.fields.root_plan_id;
      if (inspected.artifact?.fields?.artifact === "delivery-evidence") return inspected.artifact.fields.root_plan_id;
    }
    return null;
  };

  const containsRootEvidence = (artifacts = [], rootPlanId = null) => artifacts.some((entry) => {
    if (typeof entry?.text !== "string") return false;
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    const fields = inspected.artifact?.fields;
    return inspected.errors.length === 0
      && fields?.artifact === "delivery-evidence"
      && (!rootPlanId || fields.root_plan_id === rootPlanId);
  });

  const assertConsistentArtifactTexts = (artifacts = [], { rootPlan = null } = {}) => {
    const byId = new Map();
    const consider = (text, label = "artifact") => {
      if (typeof text !== "string" || !text.trim()) return;
      const inspected = inspectArtifactText(text, pluginRoot);
      if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) return;
      const id = inspected.artifact.fields.id;
      const prior = byId.get(id);
      if (prior && prior !== text) {
        throw new Error(`handoff artifact ${id} has conflicting text`);
      }
      byId.set(id, text);
      return id;
    };
    if (rootPlan) consider(rootPlan, "root");
    for (const entry of artifacts) {
      consider(entry?.text, entry?.label ?? "artifact");
    }
    return byId;
  };

  const contentHandoff = ({ rootPlanId = null, rootPlan = null, artifacts = [], remember = false } = {}) => {
    assertConsistentArtifactTexts(artifacts, { rootPlan });
    const resolvedId = inferredRootPlanId(rootPlanId, artifacts);
    const rootPlanText = resolveRootPlanText(pluginRoot, { rootPlanId: resolvedId, rootPlan, artifacts });
    const root_content_hash = rootContentHash(rootPlanText);
    const handoffStore = handoffStoreFactory(rootPlanText, pluginRoot);
    if (remember) rememberContentAddressedRoot(rootPlanText, pluginRoot);
    return { rootPlanText, root_content_hash, handoffStore, rootPlanId: resolvedId };
  };

  const hydrateLineageArtifacts = (rootPlanText, handoffStore, workspace = null) => {
    const seeded = [];
    let current = rootPlanText;
    const seen = new Set();
    while (current) {
      const inspected = inspectArtifactText(current, pluginRoot);
      const id = inspected.artifact?.fields?.id;
      if (!id || seen.has(id)) break;
      seen.add(id);
      seeded.push({ label: id, text: current });
      try {
        const chain = handoffStore.context(id, current);
        for (const entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch { /* namespace may be empty on first write */ }
      const predecessorId = inspected.artifact?.fields?.predecessor_plan_id;
      if (!predecessorId) break;
      try { current = resolveRootPlanText(pluginRoot, { rootPlanId: predecessorId }); }
      catch { break; }
      const predecessorStore = handoffStoreFactory(current, pluginRoot);
      bindBoundaryTrust(predecessorStore, workspace);
      try {
        const chain = predecessorStore.context(predecessorId, current);
        for (const entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch { seeded.push({ label: predecessorId, text: current }); }
    }
    return seeded;
  };

  const optionalOperational = async (workspaceRoot) => {
    try {
      return { ...(await resolveOperationalContext(workspaceRoot)), workspace_binding: "trusted-root" };
    } catch (error) {
      if (!isWorkspaceRootsUnavailable(error)) throw error;
      return {
        workspace: null,
        stateRoot: null,
        workspace_binding: "not-established",
        workspace_error: error,
      };
    }
  };

  const bindBoundaryTrust = (handoffStore, workspace) => {
    handoffStore.artifactSetOptions = workspace
      ? { boundaryReceiptVerifier: boundaryReceiptVerifier({ pluginRoot, workspaceRoot: workspace, options: receiptOptions }) }
      : {};
  };

  const buildCloseout = (input, merged, workspace = null) => {
    const rootPlan = input.root_plan ?? [...merged.values()].find((entry) => {
      const inspected = inspectArtifactText(entry.text, pluginRoot);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    })?.text;
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    if ((input.artifact_kind ?? "delivery-evidence") === "work-review") {
      if (!input.review_input) {
        throw codedError("review-input-invalid", "workflow_closeout work-review mode requires review_input schema 1; Root, Evidence, and repository work remain unchanged, so correct the named review_input field and repeat Review in this task");
      }
      const reviewResult = buildWorkReview({
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        reviewInput: input.review_input,
        pluginRoot,
      });
      if (reviewResult.fields.root_plan_id !== input.root_plan_id) throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${reviewResult.fields.root_plan_id}`);
      return { rootPlan, closeoutResult: reviewResult, artifactKind: "work-review" };
    }
    if (input.review_input) throw new Error("workflow_closeout review_input is allowed only when artifact_kind is work-review");
    const closeoutResult = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged.values()],
      checkEvidence: input.check_evidence,
      changedPaths: input.changed_paths,
      effectiveProfile: input.effective_profile,
      summary: input.summary ?? null,
      workspaceBinding: sha256(workspace ? resolve(workspace) : "not-established"),
      pluginRoot,
    });
    if (closeoutResult.fields.root_plan_id !== input.root_plan_id) throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${closeoutResult.fields.root_plan_id}`);
    if (!closeoutResult.artifact) throw new Error("closeout resolved an evidence tip without its exact artifact text");
    return { rootPlan, closeoutResult, artifactKind: "delivery-evidence" };
  };

  const closeoutPayload = ({
    input,
    workspace,
    workspaceBinding,
    closeoutResult,
    persisted,
    warning,
    handoffErrorCode,
    rootContentHashValue,
    handoffMode,
  }) => ({
    ...(workspace ? { workspace_root: workspace } : {}),
    workspace_binding: workspaceBinding ?? (workspace ? "trusted-root" : "not-established"),
    workspace_root_used: Boolean(workspace),
    root_plan_id: input.root_plan_id,
    delivery_evidence_id: closeoutResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash("sha256").update(persisted.artifact).digest("hex"),
    evidence_mode: persisted.fields.evidence_mode,
    overall_grade: persisted.fields.overall_grade,
    status: persisted.fields.status,
    subject_id: persisted.fields.subject_id ?? input.root_plan_id,
    source_review_id: persisted.fields.source_review_id ?? null,
    predecessor_evidence_id: persisted.fields.predecessor_evidence_id ?? null,
    changed_paths: persisted.fields.changed_paths ?? input.changed_paths ?? [],
    check_evidence: persisted.fields.check_evidence ?? [],
    ...(persisted.fields.extensions?.workflow?.repository_attribution
      ? { repository_attribution: persisted.fields.extensions.workflow.repository_attribution }
      : {}),
    duplicate: persisted.duplicate,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...(rootContentHashValue ? { root_content_hash: rootContentHashValue } : {}),
    ...(closeoutResult.constraint_summary ? { constraint_summary: closeoutResult.constraint_summary } : {}),
    ...(closeoutResult.human_attention ? { human_attention: closeoutResult.human_attention } : {}),
    ...(closeoutResult.problem_details ? { problem_details: closeoutResult.problem_details } : {}),
    ...(persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {}),
    ...(warning ? { warning } : {}),
    ...(handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}),
  });

  const reviewPayload = ({
    input,
    workspace,
    workspaceBinding,
    reviewResult,
    persisted,
    warning,
    handoffErrorCode,
    rootContentHashValue,
    handoffMode,
  }) => ({
    ...(workspace ? { workspace_root: workspace } : {}),
    workspace_binding: workspaceBinding ?? (workspace ? "trusted-root" : "not-established"),
    workspace_root_used: Boolean(workspace),
    artifact_kind: "work-review",
    root_plan_id: input.root_plan_id,
    work_review_id: reviewResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash("sha256").update(persisted.artifact).digest("hex"),
    review_input_hash: persisted.review_input_hash,
    authoritative_fields: persisted.fields,
    assessment: persisted.fields.assessment,
    delivery_status: persisted.fields.delivery_status,
    next_action: persisted.fields.next_action,
    latest_evidence_id: persisted.fields.latest_evidence_id ?? null,
    predecessor_review_id: persisted.fields.predecessor_review_id ?? null,
    correction_id: persisted.fields.correction_id ?? null,
    duplicate: persisted.duplicate,
    task_local_valid: true,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...(rootContentHashValue ? { root_content_hash: rootContentHashValue } : {}),
    ...(persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {}),
    ...(warning ? { warning } : {}),
    ...(handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}),
  });

  const reviewBundlePayload = ({ input, workspace, workspaceBinding, bundle, rootPlanId, rootContentHashValue, nativeBinding = null }) => ({
    ...(workspace ? { workspace_root: workspace } : {}),
    workspace_binding: workspaceBinding ?? (workspace ? "trusted-root" : "not-established"),
    workspace_root_used: Boolean(workspace),
    artifact_kind: "work-review",
    root_plan_id: rootPlanId,
    root_content_hash: rootContentHashValue,
    delivery_evidence_id: bundle.delivery_evidence.fields.id,
    delivery_evidence_artifact: bundle.delivery_evidence.artifact,
    delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
    work_review_id: bundle.review.fields.id,
    artifact: bundle.review.artifact,
    artifact_hash: bundle.review.artifact_hash,
    review_input_hash: bundle.review.review_input_hash,
    authoritative_fields: bundle.review.fields,
    assessment: bundle.review.fields.assessment,
    delivery_status: bundle.review.fields.delivery_status,
    evidence_status: bundle.delivery_evidence.fields.status,
    evidence_grade: bundle.delivery_evidence.fields.overall_grade,
    check_evidence: bundle.delivery_evidence.fields.check_evidence ?? [],
    finding_ids: (bundle.review.normalized_review_input?.findings ?? []).map((finding) => finding.key).filter(Boolean),
    next_action: bundle.review.fields.next_action,
    latest_evidence_id: bundle.review.fields.latest_evidence_id,
    predecessor_review_id: bundle.review.fields.predecessor_review_id ?? null,
    correction_id: bundle.review.fields.correction_id ?? null,
    changed_paths: bundle.changed_paths,
    observed_dirty_paths: bundle.observed_dirty_paths,
    pre_existing_paths: bundle.pre_existing_paths ?? [],
    repository_snapshot: bundle.repository_snapshot,
    repository_state_hash: bundle.repository_state_hash,
    chain_update: bundle.chain_update,
    repository_attribution: bundle.repository_attribution ?? {
      status: "provisional",
      boundary: "unknown",
      baseline_hash: null,
      reason_codes: ["attribution-unavailable"],
    },
    duplicate: bundle.review.duplicate && bundle.delivery_evidence.duplicate,
    task_local_valid: true,
    handoff_persisted: false,
    handoff_authoritative: false,
    handoff_mode: "task-local",
    ...(nativeBinding ? {
      native_task_binding: nativeBinding.binding_source,
      native_root_source: nativeBinding.root_source,
      native_root_binding: nativeBinding.root_binding,
      predecessor_mode: nativeBinding.predecessor_mode,
      implementation_authorization: "host-owned-unattested",
      review_selection_source: nativeBinding.review_selection_source ?? "explicit-review-command",
      review_enforcement: nativeBinding.review_enforcement ?? { status: "enforced", reason_codes: [] },
    } : {}),
  });

  const record = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (const entry of input.artifacts) {
        const inspected = inspectArtifactText(entry.text, pluginRoot);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 6 || inspected.artifact?.fields?.artifact !== "work-plan") {
          if (inspected.artifact?.fields?.artifact === "work-review") {
            throw codedError("review-artifact-rejected", "new unprotected caller-authored work-review artifacts cannot establish authority; pass review_input schema 1 to workflow_closeout with artifact_kind work-review and repeat Review in this task");
          }
          throw new Error("workflow_artifact_record accepts only valid Schema-6 work-plan artifacts");
        }
      }
      let rootPlanText;
      let root_content_hash;
      let handoffStore;
      try {
        ({ rootPlanText, root_content_hash, handoffStore } = contentHandoff({
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: true,
        }));
      } catch (error) {
        if (/conflict|invalid|corrupt|incompatible|stale|ambiguous|multiple|exact Root/i.test(error.message)) throw error;
        return toolResult("workflow_artifact_record", {
          workspace_binding: "not-established",
          workspace_root_used: false,
          handoff_authoritative: false,
          handoff_persisted: false,
          handoff_mode: "stateless",
          handoff_error_code: "handoff-persist-failed",
          recorded: [],
          duplicates: [],
          warning: `handoff cache unavailable: ${error.message}; attach the exact artifact explicitly to the next Workflow command`,
        });
      }
      const operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      const lineage = hydrateLineageArtifacts(rootPlanText, handoffStore, operational.workspace);
      const byId = new Map();
      for (const entry of [...lineage, ...input.artifacts]) {
        const inspected = inspectArtifactText(entry.text, pluginRoot);
        if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
          const priorLabel = byId.get(entry.label);
          if (priorLabel && priorLabel.text !== entry.text) {
            throw new Error(`handoff artifact label ${entry.label} has conflicting text`);
          }
          byId.set(entry.label, entry);
          continue;
        }
        const id = inspected.artifact.fields.id;
        const prior = byId.get(id);
        if (prior && prior.text !== entry.text) {
          throw new Error(`handoff artifact ${id} has conflicting text`);
        }
        byId.set(id, { label: id, text: entry.text });
      }
      try {
        const recorded = handoffStore.record([...byId.values()]);
        return toolResult("workflow_artifact_record", {
          ...(operational.workspace ? { workspace_root: operational.workspace } : {}),
          workspace_binding: operational.workspace_binding,
          workspace_root_used: Boolean(operational.workspace),
          handoff_authoritative: false,
          handoff_persisted: true,
          handoff_mode: "root-content-cache",
          root_content_hash,
          ...recorded,
          ...(operational.workspace_error && input.workspace_root
            ? { warning: `workspace binding unavailable (${operational.workspace_error.code}); recorded under root-content handoff namespace` }
            : {}),
        });
      } catch (error) {
        if (/concurrent|conflict|invalid|corrupt|incompatible|stale|ambiguous|multiple/i.test(error.message)) throw error;
        return toolResult("workflow_artifact_record", {
          ...(operational.workspace ? { workspace_root: operational.workspace } : {}),
          workspace_binding: operational.workspace_binding,
          workspace_root_used: Boolean(operational.workspace),
          handoff_authoritative: false,
          handoff_persisted: false,
          handoff_mode: "stateless",
          handoff_error_code: "handoff-persist-failed",
          root_content_hash,
          recorded: [],
          duplicates: [],
          warning: `handoff cache unavailable: ${error.message}; attach the exact artifact explicitly to the next Workflow command`,
        });
      }
    } catch (error) { return failure("workflow_artifact_record")(error); }
  };

  const context = async (input) => {
    try {
      const { root_content_hash, handoffStore } = contentHandoff({
        rootPlanId: input.root_plan_id,
        rootPlan: input.root_plan,
        artifacts: input.artifacts,
      });
      const operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      const chain = handoffStore.context(input.root_plan_id, input.root_plan ?? null);
      return toolResult("workflow_artifact_context", {
        ...(operational.workspace ? { workspace_root: operational.workspace } : {}),
        workspace_binding: operational.workspace_binding,
        workspace_root_used: Boolean(operational.workspace),
        handoff_authoritative: false,
        handoff_mode: "root-content-cache",
        root_content_hash,
        ...chain,
      });
    } catch (error) { return failure("workflow_artifact_context")(error); }
  };

  const closeout = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      const requestedArtifactKind = input.artifact_kind ?? "delivery-evidence";
      if (requestedArtifactKind === "work-review" && clientHost !== "cursor") {
        return shadowReview(
          input,
          "protected-review-binding-unavailable",
          `${clientHost} does not currently provide a protected host Root and Review invocation binding. Exact caller bytes and harness self-attestation cannot establish formal Review authority.`,
        );
      }
      let operational = await optionalOperational(input.workspace_root);

      if (requestedArtifactKind !== "work-review" && !input.root_plan_id) {
        throw codedError("root-plan-id-required", "workflow_closeout delivery-evidence mode requires root_plan_id");
      }

      // Manual Review is task-bound. Cursor consumes protected native-task
      // transport. Current Codex and portable adapters cannot establish an
      // equivalent protected host binding, so exact caller bytes remain
      // context only and must stop at Shadow Review.
      if (requestedArtifactKind === "work-review") {
        let rootPlanText = input.root_plan ?? null;
        let rootPlanId = input.root_plan_id ?? null;
        let taskArtifacts = input.artifacts ?? [];
        let nativeBinding = null;
        let nativeReceipt = null;
        if (clientHost === "cursor") {
          if (!input.native_review_receipt) {
            const rootsFailure = operational.workspace_error?.message
              ? ` MCP workspace discovery also failed: ${operational.workspace_error.message}`
              : "";
            return shadowReview(
              input,
              "native-task-receipt-unavailable",
              `The protected Cursor Root/workspace receipt is unavailable.${rootsFailure}`,
            );
          }
          let receiptFallback = false;
          if (!operational.workspace || !operational.stateRoot) {
            if (typeof resolveCursorReceiptContext !== "function") {
              return shadowReview(
                input,
                "native-task-receipt-unavailable",
                `Cursor work-review could not establish the workspace needed for its native task receipt${operational.workspace_error?.message ? `: ${operational.workspace_error.message}` : ""}`,
              );
            }
            const rootsFailure = operational.workspace_error;
            try {
              const candidate = await resolveCursorReceiptContext(input.workspace_root);
              operational = {
                ...candidate,
                workspace_binding: "cursor-native-receipt-candidate",
                workspace_error: rootsFailure,
              };
              receiptFallback = true;
            } catch (error) {
              return shadowReview(
                input,
                "native-task-receipt-unavailable",
                `Cursor work-review could not establish a receipt-bound repository${rootsFailure?.message ? ` after MCP workspace discovery failed: ${rootsFailure.message}` : ""}; workspace locator rejected: ${error.message}`,
              );
            }
          }
          const consumed = consumeReviewReceipt({
            stateRoot: operational.stateRoot,
            token: input.native_review_receipt,
            input,
            options: receiptOptions,
          });
          const receiptFailures = {
            unavailable: ["native-task-receipt-unavailable", "No protected Cursor task receipt matched this work-review call. Repeat /review-work in the same approved native Plan task."],
            expired: ["native-task-receipt-expired", "The protected Cursor task receipt expired before workflow_closeout consumed it. Repeat /review-work to create a fresh receipt."],
            replayed: ["native-task-receipt-replayed", "This protected Cursor task receipt was already consumed. Repeat /review-work to create a fresh receipt."],
            mismatch: ["native-task-receipt-mismatch", "The protected Cursor task receipt does not match this work-review call. Repeat /review-work without caller-supplied Root transport."],
            stale: ["native-task-receipt-stale", "The Cursor Root, repository epoch, or native Review turn changed before workflow_closeout consumed its receipt. Start a fresh /review-work turn."],
            busy: ["native-review-busy", "Another Cursor Review call is already active for this Root. Wait for it to finish or repeat /review-work after its failure."],
            invalid: ["native-task-receipt-invalid", "The protected Cursor task receipt is invalid. Create a fresh Plan and repeat /review-work."],
          };
          if (consumed.status !== "resolved") {
            if (consumed.status === "replayed") {
              const replay = replayNativeReviewInvocationResult({
                stateRoot: operational.stateRoot,
                token: input.native_review_receipt,
                input,
                receipt: consumed.receipt,
              });
              if (replay.status === "resolved") {
                const repositoryHash = repositorySnapshotHash(captureRepositorySnapshot(operational.workspace));
                if (repositoryHash !== replay.payload.repository_state_hash) {
                  throw codedError("native-task-receipt-stale", "The repository changed after this Review result was committed. Start a fresh /review-work turn.");
                }
                return toolResult("workflow_closeout", replay.payload);
              }
            }
            const [code, message] = receiptFailures[consumed.status] ?? receiptFailures.unavailable;
            const rootsFailure = receiptFallback && operational.workspace_error?.message
              ? ` MCP workspace discovery failed before the receipt-bound fallback: ${operational.workspace_error.message}`
              : "";
            if (["unavailable", "expired"].includes(consumed.status)) {
              return shadowReview(input, code, `${message}${rootsFailure}`);
            }
            throw codedError(code, `${message}${rootsFailure}`);
          }
          if (receiptFallback && resolve(consumed.receipt.workspace_root) !== resolve(operational.workspace)) {
            throw codedError("native-task-receipt-mismatch", "The protected Cursor task receipt does not match the receipt-bound repository locator. Repeat /review-work in the same repository.");
          }
          if (receiptFallback) {
            operational = { ...operational, workspace_binding: "cursor-native-receipt" };
          }
          if (input.root_plan_id && input.root_plan_id !== consumed.receipt.root_plan_id) {
            throw codedError("native-task-receipt-mismatch", `Cursor work-review Root ID mismatch: host-approved ${consumed.receipt.root_plan_id}, caller supplied ${input.root_plan_id}`);
          }
          rootPlanText = consumed.receipt.root_text;
          rootPlanId = consumed.receipt.root_plan_id;
          taskArtifacts = consumed.receipt.artifacts ?? [];
          nativeReceipt = consumed.receipt;
          nativeBinding = {
            binding_source: "cursor-receipt",
            root_source: consumed.receipt.root_source,
            root_binding: consumed.receipt.root_binding,
            predecessor_mode: consumed.receipt.predecessor_mode ?? "full-rebuild",
            review_selection_source: consumed.receipt.review_selection_source,
            review_enforcement: consumed.receipt.review_enforcement,
          };
        }
        const nativePlan = resolveNativePlan({
          candidates: rootPlanText
            ? [{ source: nativeBinding ? "protected Cursor native task receipt" : "workflow_closeout.root_plan from current Review task", root_text: rootPlanText }]
            : [],
          attemptedSources: [nativeBinding ? "protected Cursor native task receipt" : "workflow_closeout.root_plan from current Review task"],
          pluginRoot,
        });
        if (nativePlan.status !== "resolved") {
          if (nativePlan.status === "unavailable") {
            return shadowReview(
              input,
              "native-plan-unavailable",
              `No exact current-task Schema-6 Root is available from the formal Review transport. Inspected: ${nativePlan.attempted_sources.join(", ") || "no native source was supplied"}.`,
              "create-formal-plan-binding",
            );
          }
          throw codedError(
            `native-plan-${nativePlan.status}`,
            `workflow_closeout work-review native Root is ${nativePlan.status}. Inspected: ${nativePlan.attempted_sources.join(", ") || "no native source was supplied"}. ${nativePlan.resolution}`,
            nativePlan,
          );
        }
        if (nativeReceipt && nativePlan.root_hash !== nativeReceipt.root_hash) {
          throw codedError("native-task-receipt-mismatch", "Cursor work-review native task receipt Root hash changed before review construction");
        }
        if (!operational.workspace) {
          return shadowReview(
            input,
            "review-workspace-unavailable",
            `workflow_closeout could not inspect the current repository${operational.workspace_error?.message ? `: ${operational.workspace_error.message}` : ""}`,
          );
        }
        let harnessOrchestration = null;
        if (typeof reviewHarnessPhase === "function") {
          try {
            const reviewTransitionBindingHash = nativeReviewReceiptBindingHash(nativeReceipt);
            harnessOrchestration = await reviewHarnessPhase({
              rootPlanText: nativePlan.root_text,
              workspaceRoot: operational.workspace,
              reviewTransitionBindingHash,
            });
          } catch (error) {
            harnessOrchestration = { mode: "shadow", status: "unavailable", blockers: [`harness-review-unavailable:${error.message}`], result: null };
          }
        }
        let harnessProtectionHash = null;
        if (harnessOrchestration?.result && typeof harnessOrchestration.commitProtection === "function") {
          const transitionKey = `manual-review:${harnessOrchestration.request.transition_id}`;
          const consumedProtection = await harnessOrchestration.commitProtection(transitionKey);
          harnessProtectionHash = consumedProtection.receipt_hash;
        }
        const bundle = buildManualReviewLifecycle({
          rootPlanText: nativePlan.root_text,
          artifacts: taskArtifacts,
          reviewInput: input.review_input,
          checkEvidence: input.check_evidence ?? [],
          summary: input.summary ?? null,
          workspaceRoot: operational.workspace,
          pluginRoot,
          repositoryBaseline: nativeReceipt?.baseline ?? null,
          repositoryAttribution: nativeReceipt?.repository_attribution ? {
            status: nativeReceipt.repository_attribution.status === "bounded"
              && nativeReceipt.review_enforcement?.status === "enforced"
              && nativeReceipt.root_binding?.status === "enforced"
              ? "attributed"
              : "provisional",
            boundary: nativeReceipt.repository_attribution.boundary,
            reason_codes: [...new Set([
              ...(nativeReceipt.repository_attribution.reason_codes ?? []),
              ...(nativeReceipt.review_enforcement?.reason_codes ?? []),
              ...(nativeReceipt.root_binding?.reason_codes ?? []),
            ])],
          } : null,
          harnessPhaseResult: harnessOrchestration?.result ?? null,
          harnessProtectionHash,
          workspaceBinding: harnessOrchestration?.request?.workspace_binding ?? null,
          seal: nativeReceipt?.predecessor_mode === "provisional-seal",
        });
        if (!rootPlanId || nativePlan.root_id !== rootPlanId || bundle.root_plan_id !== rootPlanId) {
          throw new Error(`workflow_closeout Root ID mismatch: expected ${rootPlanId ?? "<unavailable>"}, received ${bundle.root_plan_id}`);
        }
        if (nativeReceipt) {
          const postBuildRepositoryHash = repositorySnapshotHash(captureRepositorySnapshot(operational.workspace));
          if (!bundle.repository_state_hash || postBuildRepositoryHash !== bundle.repository_state_hash) {
            throw codedError(
              "native-task-receipt-stale",
              "Cursor work-review repository state changed during repository observation. Start a fresh /review-work turn.",
            );
          }
          const revalidated = validateConsumedNativeReviewReceipt({
            stateRoot: operational.stateRoot,
            receipt: nativeReceipt,
            options: receiptOptions,
          });
          if (revalidated.status !== "valid") {
            throw codedError(
              "native-task-receipt-stale",
              `Cursor work-review authority changed during repository observation (${revalidated.reason ?? revalidated.status}). Start a fresh /review-work turn.`,
            );
          }
        }
        const payload = reviewBundlePayload({
          input,
          workspace: operational.workspace,
          workspaceBinding: operational.workspace_binding,
          bundle,
          rootPlanId,
          rootContentHashValue: nativePlan.root_hash,
          nativeBinding,
        });
        const response = {
          ...payload,
          mode: "formal",
          artifacts_persisted: true,
          workflow_state_changed: true,
          persistence_scope: "native-review-invocation",
          harness_mode: harnessOrchestration?.mode ?? "shadow",
          harness_status: harnessOrchestration?.status ?? "unavailable",
          harness_limitations: harnessOrchestration?.blockers ?? ["harness-protection-unavailable"],
        };
        const committed = commitNativeReviewInvocationResult({
          stateRoot: operational.stateRoot,
          token: input.native_review_receipt,
          input,
          receipt: nativeReceipt,
          payload: response,
          options: receiptOptions,
        });
        if (committed.status !== "committed") {
          throw codedError("native-review-result-commit-failed", `Cursor could not commit the idempotent Review result (${committed.status}). Start a fresh /review-work turn.`);
        }
        return toolResult("workflow_closeout", committed.payload);
      }

      let handoff;
      try {
        handoff = contentHandoff({
          rootPlanId: input.root_plan_id,
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: true,
        });
      } catch (error) {
        if (!handoff) {
          if (!input.root_plan) throw error;
          const merged = mergeArtifacts(input.artifacts ?? []);
          const { closeoutResult, artifactKind } = buildCloseout(input, merged, operational.workspace);
          const payload = artifactKind === "work-review" ? reviewPayload : closeoutPayload;
          return toolResult("workflow_closeout", payload({
            input,
            workspace: operational.workspace,
            workspaceBinding: operational.workspace_binding,
            ...(artifactKind === "work-review" ? { reviewResult: closeoutResult } : { closeoutResult }),
            persisted: { ...closeoutResult, handoff_persisted: false },
            warning: `optional cross-task handoff unavailable: ${error.message}; task-local ${artifactKind === "work-review" ? "Review" : "continuation"} remains valid`,
            handoffErrorCode: "handoff-persist-failed",
            handoffMode: "stateless",
          }));
        }
      }

      const { rootPlanText, root_content_hash, handoffStore } = handoff;
      let cached = [];
      const taskLocalReviewChain = (input.artifact_kind ?? "delivery-evidence") === "work-review"
        && containsRootEvidence(input.artifacts ?? [], input.root_plan_id);
      if (!taskLocalReviewChain) {
        try { cached = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.map(({ label, text, builder_provenance }) => ({ label, text, ...(builder_provenance ? { builder_provenance } : {}) })); }
        catch { /* exact Root still allows closeout */ }
      }
      const merged = mergeArtifacts([...cached, ...(input.artifacts ?? []), { label: "root", text: rootPlanText }]);
      let { rootPlan, closeoutResult, artifactKind } = buildCloseout({ ...input, root_plan: rootPlanText }, merged, operational.workspace);
      if (artifactKind === "work-review" && taskLocalReviewChain && !closeoutResult.duplicate) {
        try {
          const cachedReview = handoffStore.context(input.root_plan_id, rootPlanText).artifacts
            .find((entry) => entry.label === closeoutResult.fields.id);
          if (cachedReview?.text === closeoutResult.artifact
            && cachedReview.builder_provenance?.kind === "host-work-review-builder"
            && cachedReview.builder_provenance.review_input_hash === closeoutResult.review_input_hash
            && cachedReview.builder_provenance.artifact_hash === closeoutResult.artifact_hash) {
            closeoutResult = { ...closeoutResult, duplicate: true };
          }
        } catch { /* optional cache identity does not affect the task-local Review */ }
      }
      const persisted = artifactKind === "work-review" ? persistWorkReview({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        review: closeoutResult,
      }) : persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        closeout: closeoutResult,
      });
      if (persisted.handoff_persisted) rememberContentAddressedRoot(rootPlan, pluginRoot);
      const selectorNotice = !operational.workspace && input.workspace_root
        ? `; the supplied workspace_root was not used (${operational.workspace_error?.code ?? "workspace-binding-not-established"})`
        : "";
      const warning = persisted.warning
        ?? (selectorNotice ? `workspace binding unavailable${selectorNotice}` : undefined);
      const payload = artifactKind === "work-review" ? reviewPayload : closeoutPayload;
      return toolResult("workflow_closeout", payload({
        input,
        workspace: operational.workspace,
        workspaceBinding: operational.workspace_binding,
        ...(artifactKind === "work-review" ? { reviewResult: closeoutResult } : { closeoutResult }),
        persisted,
        warning,
        rootContentHashValue: root_content_hash ?? rootContentHash(rootPlan),
        handoffMode: persisted.handoff_persisted ? "root-content-cache" : "stateless",
        handoffErrorCode: persisted.handoff_error_code,
      }));
    } catch (error) { return failure("workflow_closeout")(error); }
  };

  return Object.freeze({ record, context, closeout });
}
