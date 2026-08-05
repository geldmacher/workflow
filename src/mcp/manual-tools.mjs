import { ArtifactHandoffStore } from "../controller/artifact-handoff.mjs";
import { deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { preflightRootPlan } from "../../scripts/validate-artifact.source.mjs";
import { createArtifactHandlers } from "./artifact-handlers.mjs";
import { manualToolContract } from "./manual-tool-contracts.mjs";

export function registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot,
  handoffStateRoot,
  result,
  failure,
  includeStatus = true,
  contract = manualToolContract,
}) {
  const handoffContext = async (workspaceRoot) => {
    const workspace = await workspaceAuthority.resolve(workspaceRoot);
    return {
      workspace,
      stateRoot: operationalStateRoot(workspace),
      handoffStore: new ArtifactHandoffStore(handoffStateRoot(workspace), pluginRoot),
    };
  };
  const artifactHandlers = createArtifactHandlers({ pluginRoot, handoffContext, result });

  const status = async (input) => {
    try {
      if (input.run_id || input.preparation_id) throw new Error("manual workflow_status does not accept controller subjects");
      if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
      if (!input.artifacts) throw new Error("manual workflow_status requires current-task artifacts");
      if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) {
        throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      }
      const workspace = await workspaceAuthority.resolve(input.workspace_root);
      const stateRoot = operationalStateRoot(workspace);
      const manual = deriveManualWorkflowSnapshot({
        rootPlanId: input.root_plan_id,
        artifacts: input.artifacts,
        pluginRoot,
        manualAcceptance: input.manual_acceptance ?? null,
      });
      return result({
        subject_kind: "artifact-chain",
        run: null,
        ...manual,
        workspace_root: workspace,
        model_inheritance: modelInheritanceSummary(stateRoot),
      });
    } catch (error) { return failure(error); }
  };

  server.registerTool("workflow_plan_preflight", contract("workflow_plan_preflight"), async (input) => result(preflightRootPlan(input.root_plan, pluginRoot)));
  server.registerTool("workflow_artifact_record", contract("workflow_artifact_record"), artifactHandlers.record);
  server.registerTool("workflow_artifact_context", contract("workflow_artifact_context"), artifactHandlers.context);
  server.registerTool("workflow_closeout", contract("workflow_closeout"), artifactHandlers.closeout);
  if (includeStatus) server.registerTool("workflow_status", contract("workflow_status"), status);

  return Object.freeze({ status });
}
