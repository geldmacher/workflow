import { createHash } from "node:crypto";
import {
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText,
  rootContentHash,
} from "../controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import {
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
} from "../core/manual-check-receipts.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { isWorkspaceRootsUnavailable, WorkspaceRootError } from "./workspace-roots.mjs";

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
    ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}),
  }, true);

  const mergeArtifacts = (entries) => {
    const merged = new Map();
    for (const entry of entries) {
      const prior = merged.get(entry.label);
      if (prior && prior !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, entry.text);
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

  const hydrateLineageArtifacts = (rootPlanText, handoffStore) => {
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

  const buildCloseout = (input, merged, workspace = null) => {
    const rootPlan = input.root_plan ?? [...merged.values()].find((text) => {
      const inspected = inspectArtifactText(text, pluginRoot);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    });
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    const manualCheckReceipts = workspace
      ? loadManualCheckReceipts({ rootPlanText: rootPlan, pluginRoot, workspaceRoot: workspace, options: receiptOptions })
      : [];
    const closeoutResult = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged].map(([label, text]) => ({ label, text })),
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
    return { rootPlan, closeoutResult };
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

  const record = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (const entry of input.artifacts) {
        const inspected = inspectArtifactText(entry.text, pluginRoot);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || !["work-plan", "work-review"].includes(inspected.artifact?.fields?.artifact)) {
          throw new Error("workflow_artifact_record accepts only valid Schema-5 work-plan and work-review artifacts");
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
      const lineage = hydrateLineageArtifacts(rootPlanText, handoffStore);
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
      const chain = handoffStore.context(input.root_plan_id, input.root_plan ?? null);
      return toolResult("workflow_artifact_context", {
        ...(operational.workspace ? { workspace_root: operational.workspace } : {}),
        workspace_binding: operational.workspace_binding,
        workspace_root_used: Boolean(operational.workspace),
        handoff_authoritative: false,
        handoff_mode: "root-content-cache",
        root_content_hash,
        ...chain,
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
          const { closeoutResult } = buildCloseout(input, merged, operational.workspace);
          return toolResult("workflow_closeout", closeoutPayload({
            input,
            workspace: operational.workspace,
            workspaceBinding: operational.workspace_binding,
            closeoutResult,
            persisted: { ...closeoutResult, handoff_persisted: false },
            warning: `handoff cache unavailable: ${error.message}; attach the returned artifact explicitly to the next Workflow command`,
            handoffErrorCode: "handoff-persist-failed",
            handoffMode: "stateless",
          }));
        }
      }

      const { rootPlanText, root_content_hash, handoffStore } = handoff;
      let cached = [];
      try { cached = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.map(({ label, text }) => ({ label, text })); }
      catch { /* exact Root still allows closeout */ }
      const merged = mergeArtifacts([...cached, ...(input.artifacts ?? []), { label: "root", text: rootPlanText }]);
      const { rootPlan, closeoutResult } = buildCloseout({ ...input, root_plan: rootPlanText }, merged, operational.workspace);
      const persisted = persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged].map(([label, text]) => ({ label, text })),
        closeout: closeoutResult,
      });
      if (persisted.handoff_persisted) rememberContentAddressedRoot(rootPlan, pluginRoot);
      if (persisted.handoff_persisted && operational.workspace) {
        invalidateManualCheckReceipts({ rootPlanText: rootPlan, workspaceRoot: operational.workspace, options: receiptOptions });
      }
      const selectorNotice = !operational.workspace && input.workspace_root
        ? `; the supplied workspace_root was not used (${operational.workspace_error?.code ?? "workspace-binding-not-established"})`
        : "";
      const warning = persisted.warning
        ?? (selectorNotice ? `workspace binding unavailable${selectorNotice}` : undefined);
      return toolResult("workflow_closeout", closeoutPayload({
        input,
        workspace: operational.workspace,
        workspaceBinding: operational.workspace_binding,
        closeoutResult,
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
