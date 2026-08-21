import { createHash } from "node:crypto";
import {
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText,
  rootContentHash,
} from "../controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import { buildWorkReview, persistWorkReview } from "../controller/work-review-builder.mjs";
import { buildManualReviewLifecycle } from "../controller/manual-review-lifecycle.mjs";
import {
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
} from "../core/manual-check-receipts.mjs";
import { boundaryReceiptVerifier } from "../core/manual-boundary-receipts.mjs";
import { humanWorkflowProjection } from "../core/human-output-projection.mjs";
import { resolveNativePlan } from "../core/native-plan-resolution.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { isWorkspaceRootsUnavailable } from "./workspace-roots.mjs";

const bundleSize = (artifacts = []) => artifacts.reduce((total, artifact) => total + artifact.text.length, 0);

export function createArtifactHandlers({
  pluginRoot,
  resolveOperationalContext,
  result,
  handoffStoreFactory = createContentAddressedHandoffStore,
  receiptOptions = {},
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
    ...(typeof error?.resolution === "string" ? { resolution: error.resolution } : {}),
  }, true);

  const codedError = (code, message, details = {}) => {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
  };

  const projectForHumans = ({
    rootPlanText = null,
    artifacts = [],
    rootPlanId = null,
    evidenceId = null,
    reviewId = null,
  } = {}) => humanWorkflowProjection({
    rootPlanText,
    artifacts,
    pluginRoot,
    rootPlanId,
    evidenceId,
    reviewId,
  });

  const mergeArtifacts = (entries) => {
    const merged = new Map();
    for (const entry of entries) {
      const prior = merged.get(entry.label);
      if (prior && prior.text !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, {
        label: entry.label,
        text: entry.text,
        ...(entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {}),
        ...(entry.legacy_review_recorded === true || prior?.legacy_review_recorded === true ? { legacy_review_recorded: true } : {}),
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

  const enrichCachedReviewProvenance = (rootPlanId, rootPlanText, artifacts, handoffStore) => {
    let cached;
    try {
      cached = handoffStore.context(rootPlanId, rootPlanText).artifacts;
    } catch {
      return artifacts;
    }
    const cachedById = new Map(cached.map((entry) => [entry.label, entry]));
    return artifacts.map((entry) => {
      const inspected = inspectArtifactText(entry.text, pluginRoot);
      const fields = inspected.artifact?.fields;
      if (inspected.errors.length > 0 || fields?.artifact !== "work-review") return entry;
      const protectedEntry = cachedById.get(fields.id);
      if (!protectedEntry) return entry;
      if (protectedEntry.text !== entry.text) {
        throw new Error(`cached work-review ${fields.id} conflicts with current-task immutable bytes`);
      }
      return protectedEntry.builder_provenance
        ? { ...entry, builder_provenance: protectedEntry.builder_provenance }
        : entry;
    });
  };

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
    const manualCheckReceipts = workspace
      ? loadManualCheckReceipts({ rootPlanText: rootPlan, pluginRoot, workspaceRoot: workspace, options: receiptOptions })
      : [];
    const closeoutResult = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged.values()],
      checkEvidence: input.check_evidence,
      changedPaths: input.changed_paths,
      strategyRevision: input.strategy_revision,
      effectiveProfile: input.effective_profile,
      repositorySnapshot: input.repository_snapshot ?? null,
      summary: input.summary ?? null,
      manualCheckReceipts,
      enforceManualCheckReceipts: input.effective_profile === "manual",
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
    rootPlanText,
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
    human_projection: projectForHumans({
      rootPlanText,
      artifacts: [{ label: persisted.fields.id, text: persisted.artifact }],
      rootPlanId: input.root_plan_id,
      evidenceId: persisted.fields.id,
    }),
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
    rootPlanText,
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
    review_route: persisted.fields.review_route,
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
    human_projection: projectForHumans({
      rootPlanText,
      artifacts: [...(input.artifacts ?? []), { label: persisted.fields.id, text: persisted.artifact }],
      rootPlanId: input.root_plan_id,
      evidenceId: persisted.fields.latest_evidence_id ?? null,
      reviewId: persisted.fields.id,
    }),
  });

  const reviewBundlePayload = ({ input, workspace, bundle, persisted, rootContentHashValue, rootPlanText }) => ({
    ...(workspace ? { workspace_root: workspace } : {}),
    workspace_binding: workspace ? "trusted-root" : "not-established",
    workspace_root_used: Boolean(workspace),
    artifact_kind: "work-review",
    root_plan_id: input.root_plan_id,
    root_content_hash: rootContentHashValue,
    delivery_evidence_id: bundle.delivery_evidence.fields.id,
    delivery_evidence_artifact: bundle.delivery_evidence.artifact,
    delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
    work_review_id: persisted.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash,
    review_input_hash: persisted.review_input_hash,
    authoritative_fields: persisted.fields,
    assessment: persisted.fields.assessment,
    delivery_status: persisted.fields.delivery_status,
    next_action: persisted.fields.next_action,
    review_route: persisted.fields.review_route,
    latest_evidence_id: persisted.fields.latest_evidence_id,
    predecessor_review_id: persisted.fields.predecessor_review_id ?? null,
    correction_id: persisted.fields.correction_id ?? null,
    changed_paths: bundle.changed_paths,
    observed_dirty_paths: bundle.observed_dirty_paths,
    repository_snapshot: bundle.repository_snapshot,
    duplicate: persisted.duplicate && bundle.delivery_evidence.duplicate,
    task_local_valid: true,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: persisted.handoff_persisted ? "root-content-cache" : "task-local",
    ...(persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {}),
    ...(persisted.warning ? { warning: persisted.warning } : {}),
    ...(persisted.handoff_error_code ? { handoff_error_code: persisted.handoff_error_code } : {}),
    human_projection: projectForHumans({
      rootPlanText,
      artifacts: [
        { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact },
        { label: persisted.fields.id, text: persisted.artifact },
      ],
      rootPlanId: input.root_plan_id,
      evidenceId: bundle.delivery_evidence.fields.id,
      reviewId: persisted.fields.id,
    }),
  });

  const record = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (const entry of input.artifacts) {
        const inspected = inspectArtifactText(entry.text, pluginRoot);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || inspected.artifact?.fields?.artifact !== "work-plan") {
          if (inspected.artifact?.fields?.artifact === "work-review") {
            throw codedError("review-artifact-rejected", "new full model-authored work-review artifacts cannot establish authority; pass review_input schema 1 to workflow_closeout with artifact_kind work-review and repeat Review in this task");
          }
          throw new Error("workflow_artifact_record accepts only valid Schema-5 work-plan artifacts");
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
          human_projection: projectForHumans({
            rootPlanText: input.root_plan ?? null,
            artifacts: input.artifacts,
          }),
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
          human_projection: projectForHumans({
            rootPlanText,
            artifacts: [...byId.values()],
          }),
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
          human_projection: projectForHumans({
            rootPlanText,
            artifacts: [...byId.values()],
          }),
        });
      }
    } catch (error) { return failure("workflow_artifact_record")(error); }
  };

  const context = async (input) => {
    try {
      const { rootPlanText, root_content_hash, handoffStore } = contentHandoff({
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
        human_projection: projectForHumans({
          rootPlanText,
          artifacts: chain.artifacts,
          rootPlanId: input.root_plan_id,
          evidenceId: chain.evidence_tip ?? null,
          reviewId: chain.review_tip ?? null,
        }),
        model_inheritance: operational.stateRoot
          ? modelInheritanceSummary(operational.stateRoot)
          : { authoritative: false, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" },
      });
    } catch (error) { return failure("workflow_artifact_context")(error); }
  };

  const closeout = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      const operational = await optionalOperational(input.workspace_root);

      // Cursor and Codex Manual Review authority stays task-local. The paired
      // result is additionally cached as non-authoritative transport so a
      // later task turn can recover the exact bytes without inventing them.
      if ((input.artifact_kind ?? "delivery-evidence") === "work-review") {
        const nativePlan = resolveNativePlan({
          candidates: input.root_plan
            ? [{ source: "workflow_closeout.root_plan from current Review task", root_text: input.root_plan }]
            : [],
          attemptedSources: ["workflow_closeout.root_plan from current Review task"],
          pluginRoot,
        });
        if (nativePlan.status !== "resolved") {
          throw codedError(
            `native-plan-${nativePlan.status}`,
            `workflow_closeout work-review native Root is ${nativePlan.status}. Inspected: ${nativePlan.attempted_sources.join(", ") || "no native source was supplied"}. ${nativePlan.resolution}`,
            nativePlan,
          );
        }
        if (!operational.workspace) {
          throw codedError(
            "review-workspace-unavailable",
            `workflow_closeout could not inspect the current repository${operational.workspace_error?.message ? `: ${operational.workspace_error.message}` : ""}`,
          );
        }
        const handoffStore = handoffStoreFactory(nativePlan.root_text, pluginRoot);
        bindBoundaryTrust(handoffStore, operational.workspace);
        const reviewArtifacts = enrichCachedReviewProvenance(
          input.root_plan_id,
          nativePlan.root_text,
          input.artifacts ?? [],
          handoffStore,
        );
        const bundle = buildManualReviewLifecycle({
          rootPlanText: nativePlan.root_text,
          artifacts: reviewArtifacts,
          reviewInput: input.review_input,
          checkEvidence: input.check_evidence ?? [],
          strategyRevision: input.strategy_revision ?? 0,
          summary: input.summary ?? null,
          workspaceRoot: operational.workspace,
          pluginRoot,
        });
        if (nativePlan.root_id !== input.root_plan_id || bundle.root_plan_id !== input.root_plan_id) {
          throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${bundle.root_plan_id}`);
        }
        let persisted = persistWorkReview({
          handoffStore,
          rootPlanText: nativePlan.root_text,
          artifacts: [
            ...reviewArtifacts,
            { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact },
          ],
          review: bundle.review,
        });
        if (persisted.handoff_persisted) {
          try {
            rememberContentAddressedRoot(nativePlan.root_text, pluginRoot);
          } catch (error) {
            persisted = {
              ...persisted,
              handoff_persisted: false,
              handoff_error_code: "handoff-persist-failed",
              warning: `optional cross-task review handoff index unavailable: ${error.message}; task-local Review remains valid`,
            };
          }
        }
        return toolResult("workflow_closeout", reviewBundlePayload({
          input,
          workspace: operational.workspace,
          bundle,
          persisted,
          rootContentHashValue: nativePlan.root_hash,
          rootPlanText: nativePlan.root_text,
        }));
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
        if (operational.legacyHandoffStore && !input.root_plan) {
          try {
            const legacy = operational.legacyHandoffStore.context(input.root_plan_id, null);
            const rootPlan = legacy.artifacts.find((entry) => entry.label === input.root_plan_id)?.text;
            if (rootPlan) {
              handoff = contentHandoff({
                rootPlanId: input.root_plan_id,
                rootPlan,
                artifacts: [...legacy.artifacts, ...(input.artifacts ?? [])],
                remember: true,
              });
            }
          } catch { /* fall through */ }
        }
        if (!handoff) {
          if (!input.root_plan) throw error;
          const merged = mergeArtifacts(input.artifacts ?? []);
          const { rootPlan, closeoutResult, artifactKind } = buildCloseout(input, merged, operational.workspace);
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
            rootPlanText: rootPlan,
          }));
        }
      }

      const { rootPlanText, root_content_hash, handoffStore } = handoff;
      let cached = [];
      const taskLocalReviewChain = (input.artifact_kind ?? "delivery-evidence") === "work-review"
        && containsRootEvidence(input.artifacts ?? [], input.root_plan_id);
      if (!taskLocalReviewChain) {
        try { cached = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.map(({ label, text, builder_provenance, legacy_review_recorded }) => ({ label, text, ...(builder_provenance ? { builder_provenance } : {}), ...(legacy_review_recorded === true ? { legacy_review_recorded: true } : {}) })); }
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
      if (artifactKind === "delivery-evidence" && persisted.handoff_persisted && operational.workspace) {
        invalidateManualCheckReceipts({ rootPlanText: rootPlan, workspaceRoot: operational.workspace, options: receiptOptions });
      }
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
        rootPlanText: rootPlan,
      }));
    } catch (error) { return failure("workflow_closeout")(error); }
  };

  return Object.freeze({ record, context, closeout });
}
