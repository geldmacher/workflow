import { createHash } from "node:crypto";
import {
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText,
  rootContentHash,
} from "../controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { isWorkspaceRootsUnavailable, WorkspaceRootError } from "./workspace-roots.mjs";

const bundleSize = (artifacts = []) => artifacts.reduce((total, artifact) => total + artifact.text.length, 0);

export function createArtifactHandlers({
  pluginRoot,
  resolveOperationalContext,
  result,
  handoffStoreFactory = createContentAddressedHandoffStore,
}) {
  const failure = (error) => result({
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

  const contentHandoff = ({ rootPlanId = null, rootPlan = null, artifacts = [], remember = false } = {}) => {
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

  const buildCloseout = (input, merged) => {
    const rootPlan = input.root_plan ?? [...merged.values()].find((text) => {
      const inspected = inspectArtifactText(text, pluginRoot);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    });
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    const closeoutResult = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged].map(([label, text]) => ({ label, text })),
      checkEvidence: input.check_evidence,
      changedPaths: input.changed_paths,
      strategyRevision: input.strategy_revision,
      effectiveProfile: input.effective_profile,
      repositorySnapshot: input.repository_snapshot ?? null,
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
    duplicate: persisted.duplicate,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...(rootContentHashValue ? { root_content_hash: rootContentHashValue } : {}),
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
      const { rootPlanText, root_content_hash, handoffStore } = contentHandoff({
        rootPlan: input.root_plan,
        artifacts: input.artifacts,
        remember: true,
      });
      const operational = await optionalOperational(input.workspace_root);
      const lineage = hydrateLineageArtifacts(rootPlanText, handoffStore);
      const byId = new Map();
      for (const entry of [...lineage, ...input.artifacts]) {
        const inspected = inspectArtifactText(entry.text, pluginRoot);
        if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
          byId.set(entry.label, entry);
          continue;
        }
        byId.set(inspected.artifact.fields.id, { label: inspected.artifact.fields.id, text: entry.text });
      }
      const recorded = handoffStore.record([...byId.values()]);
      return result({
        ...(operational.workspace ? { workspace_root: operational.workspace } : {}),
        workspace_binding: operational.workspace_binding,
        workspace_root_used: Boolean(operational.workspace),
        handoff_authoritative: false,
        handoff_mode: "root-content-cache",
        root_content_hash,
        ...recorded,
        ...(operational.workspace_error && input.workspace_root
          ? { warning: `workspace binding unavailable (${operational.workspace_error.code}); recorded under root-content handoff namespace` }
          : {}),
      });
    } catch (error) { return failure(error); }
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
      return result({
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
    } catch (error) { return failure(error); }
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
          const { closeoutResult } = buildCloseout(input, merged);
          return result(closeoutPayload({
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
      const { rootPlan, closeoutResult } = buildCloseout({ ...input, root_plan: rootPlanText }, merged);
      const persisted = persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged].map(([label, text]) => ({ label, text })),
        closeout: closeoutResult,
      });
      if (persisted.handoff_persisted) rememberContentAddressedRoot(rootPlan, pluginRoot);
      const selectorNotice = !operational.workspace && input.workspace_root
        ? `; the supplied workspace_root was not used (${operational.workspace_error?.code ?? "workspace-binding-not-established"})`
        : "";
      const warning = persisted.warning
        ?? (selectorNotice ? `workspace binding unavailable${selectorNotice}` : undefined);
      return result(closeoutPayload({
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
    } catch (error) { return failure(error); }
  };

  return Object.freeze({ record, context, closeout });
}
