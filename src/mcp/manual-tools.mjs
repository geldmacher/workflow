import { ArtifactHandoffStore, createContentAddressedHandoffStore, resolveRootPlanText } from "../controller/artifact-handoff.mjs";
import { deriveManualLearningProjection, deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { resolveHostToolApproval } from "../core/host-preferences.mjs";
import { boundaryReceiptVerifier } from "../core/manual-boundary-receipts.mjs";
import { resolveManualSubagentPolicy } from "../core/manual-subagent-policy.mjs";
import { sharedArtifactStateRoot } from "../core/state-paths.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import { preflightRootPlan } from "../../scripts/validate-artifact.source.mjs";
import { createArtifactHandlers } from "./artifact-handlers.mjs";
import { manualMcpResult } from "./manual-presentation.mjs";
import { manualToolContract } from "./manual-tool-contracts.mjs";
import { isWorkspaceRootsUnavailable } from "./workspace-roots.mjs";

function publicManualSubagentPolicy(policy = resolveManualSubagentPolicy()) {
  return Object.freeze({
    authoritative: false,
    schema: policy.schema,
    mode: policy.mode,
    source: policy.source,
    path: policy.path,
    hosts: Object.freeze({
      cursor: Object.freeze({
        preset: policy.hosts.cursor.preset,
        parent_fallback: policy.hosts.cursor.parent_fallback,
        candidates: policy.hosts.cursor.candidates.map((entry) => entry.model_id),
      }),
      codex: Object.freeze({
        preset: policy.hosts.codex.preset,
        parent_fallback: policy.hosts.codex.parent_fallback,
        candidates: policy.hosts.codex.candidates.map((entry) => entry.model_id),
      }),
    }),
    ...(policy.issues ? { issues: policy.issues } : {}),
  });
}

export function registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot,
  handoffStateRoot = sharedArtifactStateRoot,
  result,
  failure,
  includeStatus = true,
  contract = manualToolContract,
  resolveHostToolApprovalPreference = resolveHostToolApproval,
  resolveManualSubagentPolicyPreference = resolveManualSubagentPolicy,
}) {
  const namedResult = (toolName) => (value, isError = false) => manualMcpResult(toolName, value, isError);
  const namedFailure = (toolName) => (error) => namedResult(toolName)({
    error: error.message,
    ...(error?.code ? { error_code: error.code } : {}),
  }, true);
  const toolAwareResult = (toolName, value, isError = false) => namedResult(toolName)(value, isError);
  toolAwareResult.toolAware = true;

  const resolveOperationalContext = async (workspaceRoot) => {
    const workspace = await workspaceAuthority.resolve(workspaceRoot);
    return {
      workspace,
      stateRoot: operationalStateRoot(workspace),
      legacyHandoffStore: new ArtifactHandoffStore(handoffStateRoot(workspace), pluginRoot),
    };
  };

  const handoffStoreFactory = (rootPlanText, root) => createContentAddressedHandoffStore(rootPlanText, root);
  const contextResult = namedResult("workflow_artifact_context");
  const statusResult = namedResult("workflow_status");
  const preflightResult = namedResult("workflow_plan_preflight");

  const artifactHandlers = createArtifactHandlers({
    pluginRoot,
    resolveOperationalContext,
    result: toolAwareResult,
    handoffStoreFactory,
  });

  const status = async (input) => {
    try {
      if (input.run_id || input.preparation_id) throw new Error("manual workflow_status does not accept controller subjects");
      if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
      if (!input.artifacts) throw new Error("manual workflow_status requires current-task artifacts");
      if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) {
        throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      }
      let workspace = null;
      let stateRoot = null;
      let workspaceBinding = "not-established";
      try {
        const operational = await resolveOperationalContext(input.workspace_root);
        workspace = operational.workspace;
        stateRoot = operational.stateRoot;
        workspaceBinding = "trusted-root";
      } catch (error) {
        if (!isWorkspaceRootsUnavailable(error)) throw error;
      }
      const manual = deriveManualWorkflowSnapshot({
        rootPlanId: input.root_plan_id,
        artifacts: input.artifacts,
        pluginRoot,
        manualAcceptance: input.manual_acceptance ?? null,
        boundaryReceiptVerifier: workspace
          ? boundaryReceiptVerifier({ pluginRoot, workspaceRoot: workspace })
          : null,
      });
      return statusResult({
        subject_kind: "artifact-chain",
        run: null,
        ...manual,
        learning: deriveManualLearningProjection(manual),
        ...(workspace ? { workspace_root: workspace } : {}),
        workspace_binding: workspaceBinding,
        workspace_root_used: Boolean(workspace),
        model_inheritance: stateRoot
          ? modelInheritanceSummary(stateRoot)
          : { authoritative: false, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" },
        host_tool_approval: resolveHostToolApprovalPreference(),
        manual_subagent_policy: publicManualSubagentPolicy(resolveManualSubagentPolicyPreference()),
      });
    } catch (error) { return namedFailure("workflow_status")(error); }
  };

  server.registerTool("workflow_plan_preflight", contract("workflow_plan_preflight"), async (input) => preflightResult(preflightRootPlan(input.root_plan, pluginRoot)));
  server.registerTool("workflow_artifact_record", contract("workflow_artifact_record"), artifactHandlers.record);
  server.registerTool("workflow_artifact_context", contract("workflow_artifact_context"), async (input) => {
    try {
      if (!input.root_plan) {
        try {
          const operational = await resolveOperationalContext(input.workspace_root);
          const legacy = operational.legacyHandoffStore.context(input.root_plan_id, null);
          return contextResult({
            workspace_root: operational.workspace,
            workspace_binding: "trusted-root",
            workspace_root_used: true,
            handoff_authoritative: false,
            handoff_mode: "legacy-repository-cache",
            ...legacy,
            model_inheritance: modelInheritanceSummary(operational.stateRoot),
          });
        } catch (error) {
          if (!isWorkspaceRootsUnavailable(error) && !/no handoff Root/.test(error.message)) throw error;
          throw new Error(`workflow_artifact_context requires exact root_plan text for content-bound handoff${error?.message ? `; ${error.message}` : ""}`);
        }
      }
      resolveRootPlanText(pluginRoot, { rootPlanId: input.root_plan_id, rootPlan: input.root_plan });
      return artifactHandlers.context(input);
    } catch (error) { return namedFailure("workflow_artifact_context")(error); }
  });
  server.registerTool("workflow_closeout", contract("workflow_closeout"), artifactHandlers.closeout);
  if (includeStatus) server.registerTool("workflow_status", contract("workflow_status"), status);

  return Object.freeze({ status });
}
