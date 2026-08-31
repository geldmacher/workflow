import { lstatSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { createContentAddressedHandoffStore, resolveRootPlanText } from "../controller/artifact-handoff.mjs";
import { deriveManualLearningProjection, deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { boundaryReceiptVerifier } from "../harness/boundary-receipts.mjs";
import { canonicalRepositoryRoot } from "../harness/native-task-review-state.mjs";
import { preflightRootPlan } from "../../scripts/validate-artifact.source.mjs";
import { createArtifactHandlers } from "./artifact-handlers.mjs";
import { manualMcpResult } from "./manual-presentation.mjs";
import { manualToolContract } from "./manual-tool-contracts.mjs";
import { isWorkspaceRootsUnavailable } from "./workspace-roots.mjs";

export function registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot,
  result,
  includeStatus = true,
  contract = manualToolContract,
  clientHost = "portable",
  reviewHarnessPhase = null,
  runStatus = null,
}) {
  const namedResult = (toolName, presentationLocale = "en") => (value, isError = false) => manualMcpResult(toolName, value, isError, { clientHost, presentationLocale });
  const namedFailure = (toolName) => (error) => namedResult(toolName)({ error: error.message, ...(error?.code ? { error_code: error.code } : {}) }, true);
  const toolAwareResult = (toolName, value, isError = false) => namedResult(toolName)(value, isError);
  toolAwareResult.toolAware = true;

  const resolveOperationalContext = async (workspaceRoot) => {
    const workspace = await workspaceAuthority.resolve(workspaceRoot);
    return { workspace, stateRoot: operationalStateRoot(workspace) };
  };

  const resolveCursorReceiptContext = (workspaceRoot) => {
    if (typeof workspaceRoot !== "string" || !isAbsolute(workspaceRoot)) throw new Error("Cursor native Review receipt fallback requires an absolute workspace_root locator");
    const advertised = resolve(workspaceRoot);
    let stat;
    try { stat = lstatSync(advertised); }
    catch (error) { throw new Error(`Cursor native Review receipt workspace locator is unavailable: ${advertised}`, { cause: error }); }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Cursor native Review receipt workspace locator must be a real directory");
    const workspace = canonicalRepositoryRoot(advertised);
    if (!workspace) throw new Error("Cursor native Review receipt fallback requires one canonical repository");
    return { workspace, stateRoot: operationalStateRoot(workspace) };
  };

  const artifactHandlers = createArtifactHandlers({
    pluginRoot,
    resolveOperationalContext,
    resolveCursorReceiptContext,
    result: toolAwareResult,
    handoffStoreFactory: (rootPlanText, root) => createContentAddressedHandoffStore(rootPlanText, root),
    clientHost,
    reviewHarnessPhase,
  });

  const status = async (input) => {
    try {
      if (Boolean(input.artifacts) === Boolean(input.run_id)) throw new Error("workflow_status requires exactly one Schema-6 artifact chain or run_id");
      if (input.run_id) {
        if (input.root_plan_id) throw new Error("Workflow 6 run status does not accept artifact-chain controls");
        if (typeof runStatus !== "function") throw new Error("Workflow 6 run status is unavailable in this host");
        const operational = await resolveOperationalContext(input.workspace_root);
        return namedResult("workflow_status", input.presentation_locale)({
          subject_kind: "workflow-6-run",
          run: runStatus({ runId: input.run_id, stateRoot: operational.stateRoot, workspace: operational.workspace }),
          workspace_root: operational.workspace,
          workspace_binding: "trusted-root",
          workspace_root_used: true,
        });
      }
      if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("workflow_status artifact bundle exceeds 1000000 characters");
      let workspace = null;
      try { workspace = (await resolveOperationalContext(input.workspace_root)).workspace; }
      catch (error) { if (!isWorkspaceRootsUnavailable(error)) throw error; }
      const manual = deriveManualWorkflowSnapshot({
        rootPlanId: input.root_plan_id,
        artifacts: input.artifacts,
        pluginRoot,
        boundaryReceiptVerifier: workspace ? boundaryReceiptVerifier({ pluginRoot, workspaceRoot: workspace }) : null,
      });
      return namedResult("workflow_status", input.presentation_locale)({
        subject_kind: "artifact-chain",
        ...manual,
        learning: deriveManualLearningProjection(manual),
        ...(workspace ? { workspace_root: workspace } : {}),
        workspace_binding: workspace ? "trusted-root" : "not-established",
        workspace_root_used: Boolean(workspace),
      });
    } catch (error) { return namedFailure("workflow_status")(error); }
  };

  server.registerTool("workflow_plan_preflight", contract("workflow_plan_preflight"), async (input) => namedResult("workflow_plan_preflight")(preflightRootPlan(input.root_plan, pluginRoot)));
  server.registerTool("workflow_artifact_record", contract("workflow_artifact_record"), artifactHandlers.record);
  server.registerTool("workflow_artifact_context", contract("workflow_artifact_context"), async (input) => {
    try {
      resolveRootPlanText(pluginRoot, { rootPlanId: input.root_plan_id, rootPlan: input.root_plan });
      return artifactHandlers.context(input);
    } catch (error) { return namedFailure("workflow_artifact_context")(error); }
  });
  server.registerTool("workflow_closeout", contract("workflow_closeout"), artifactHandlers.closeout);
  if (includeStatus) server.registerTool("workflow_status", contract("workflow_status"), status);
  return Object.freeze({ status });
}
