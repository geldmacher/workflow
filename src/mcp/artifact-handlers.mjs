import { createHash } from "node:crypto";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { isWorkspaceRootsUnavailable, WorkspaceRootError } from "./workspace-roots.mjs";

const bundleSize = (artifacts = []) => artifacts.reduce((total, artifact) => total + artifact.text.length, 0);

export function createArtifactHandlers({ pluginRoot, handoffContext, result }) {
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

  const closeoutPayload = ({ input, workspace, closeoutResult, persisted, warning, handoffErrorCode }) => ({
    ...(workspace ? { workspace_root: workspace } : {}),
    workspace_binding: workspace ? "trusted-root" : "not-established",
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
      const { workspace, handoffStore } = await handoffContext(input.workspace_root);
      return result({ workspace_root: workspace, ...handoffStore.record(input.artifacts), handoff_authoritative: false });
    } catch (error) { return failure(error); }
  };

  const context = async (input) => {
    try {
      const { workspace, stateRoot, handoffStore } = await handoffContext(input.workspace_root);
      return result({
        workspace_root: workspace,
        handoff_authoritative: false,
        ...handoffStore.context(input.root_plan_id, input.root_plan ?? null),
        model_inheritance: modelInheritanceSummary(stateRoot),
      });
    } catch (error) { return failure(error); }
  };

  const closeout = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1_000_000) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      let workspaceContext;
      try { workspaceContext = await handoffContext(input.workspace_root); }
      catch (error) {
        if (!input.root_plan || !isWorkspaceRootsUnavailable(error)) throw error;
        const merged = mergeArtifacts(input.artifacts ?? []);
        const { closeoutResult } = buildCloseout(input, merged);
        const selectorNotice = input.workspace_root ? "; the supplied workspace_root was not used" : "";
        const warning = `handoff cache unavailable (${error.code}): ${error.message}${selectorNotice}; attach the returned artifact explicitly to the next Workflow command`;
        return result(closeoutPayload({
          input,
          workspace: null,
          closeoutResult,
          persisted: { ...closeoutResult, handoff_persisted: false },
          warning,
          handoffErrorCode: error.code,
        }));
      }
      const { workspace, handoffStore } = workspaceContext;
      let cached = [];
      try { cached = handoffStore.context(input.root_plan_id, input.root_plan ?? null).artifacts.map(({ label, text }) => ({ label, text })); }
      catch (error) { if (!input.root_plan) throw error; }
      const merged = mergeArtifacts([...cached, ...(input.artifacts ?? [])]);
      const { rootPlan, closeoutResult } = buildCloseout(input, merged);
      const persisted = persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged].map(([label, text]) => ({ label, text })),
        closeout: closeoutResult,
      });
      return result(closeoutPayload({ input, workspace, closeoutResult, persisted, warning: persisted.warning }));
    } catch (error) { return failure(error); }
  };

  return Object.freeze({ record, context, closeout });
}
