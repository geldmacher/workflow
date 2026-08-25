import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { orchestrateHarnessPhase } from "../controller/harness-orchestrator.mjs";
import { createHarnessLifecycleController } from "../controller/harness-lifecycle.mjs";
import { PLUGIN_VERSION } from "../controller/protocol.mjs";
import { harnessContractHash } from "../core/harness-attestations.mjs";
import { loadProtectedProjectHarness } from "../harness/module-adapter.mjs";
import { createHostDecisionReceiptAdapter } from "../harness/host-decision-receipts.mjs";
import { registerManualWorkflowTools } from "./manual-tools.mjs";
import { toolContract } from "./tool-contracts.mjs";
import { WorkspaceRootAuthority, WorkspaceRootError } from "./workspace-roots.mjs";
import { workflowStateRoot } from "../../hooks/workflow-state.mjs";

const pluginRoot = resolve(process.env.CURSOR_PLUGIN_ROOT ?? dirname(dirname(fileURLToPath(import.meta.url))));
const server = new McpServer({ name: "workflow", version: PLUGIN_VERSION });
const workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots());
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());

function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}

function failure(error) {
  return result({ error: error.message, ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}) }, true);
}

async function reviewHarnessPhase({ rootPlanText, workspaceRoot, reviewTransitionBindingHash }) {
  if (!/^[a-f0-9]{64}$/.test(String(reviewTransitionBindingHash ?? ""))) throw new Error("Manual Review requires an exact host invocation binding");
  const workspaceBinding = harnessContractHash({ workspace_root: workspaceRoot });
  const runId = `run-${harnessContractHash({ kind: "manual-review-run", root_plan: rootPlanText, workspace_binding: workspaceBinding }).slice(0, 24)}`;
  const transitionId = `tr-${harnessContractHash({ kind: "manual-review-transition", binding_hash: reviewTransitionBindingHash }).slice(0, 32)}`;
  const idempotencyHash = harnessContractHash({ kind: "manual-review-idempotency", binding_hash: reviewTransitionBindingHash });
  let harnessBinding = null;
  try {
    harnessBinding = await loadProtectedProjectHarness({
      pluginRoot,
      stateRoot: workflowStateRoot(workspaceRoot),
      workspaceRoot,
      workspaceBinding,
    });
  } catch { /* the requested Review remains provisional */ }
  if (!harnessBinding) return { mode: "shadow", status: "unavailable", blockers: ["harness-protection-unavailable"], result: null };
  return orchestrateHarnessPhase({
    harnessBinding,
    phase: "review",
    profile: "manual",
    rootPlanText,
    workspaceBinding,
    pluginRoot,
    runId,
    runRevision: 0,
    transitionId,
    idempotencyHash,
  });
}

registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot: workflowStateRoot,
  result,
  failure,
  contract: toolContract,
  clientHost: "cursor",
  reviewHarnessPhase,
  runStatus: ({ runId, stateRoot, workspace }) => createHarnessLifecycleController({
    stateRoot,
    workspaceBinding: harnessContractHash({ workspace_root: workspace }),
    pluginRoot,
    harnessBinding: null,
  }).status(runId),
});

server.registerTool("workflow_prepare", toolContract("workflow_prepare"), async (input) => {
  try {
    const workspace = await workspaceAuthority.resolve(input.workspace_root);
    const workspaceBinding = harnessContractHash({ workspace_root: workspace });
    const stateRoot = workflowStateRoot(workspace);
    let harnessBinding = null;
    try { harnessBinding = await loadProtectedProjectHarness({ pluginRoot, stateRoot, workspaceRoot: workspace, workspaceBinding }); }
    catch { harnessBinding = null; }
    const controller = createHarnessLifecycleController({
      stateRoot,
      workspaceBinding,
      pluginRoot,
      harnessBinding,
      decisionReceiptAdapter: createHostDecisionReceiptAdapter({ stateRoot }),
    });
    let lifecycle;
    if (input.action === "start") {
      if (!input.root_plan || !input.requested_profile || input.run_id || input.expected_revision !== undefined || input.human_decision_receipt) {
        throw new Error("workflow_prepare start requires only root_plan, requested_profile, and idempotency_key");
      }
      lifecycle = await controller.start({ rootPlanText: input.root_plan, requestedProfile: input.requested_profile, idempotencyKey: input.idempotency_key });
    } else {
      if (!input.run_id || !Number.isInteger(input.expected_revision) || input.root_plan || input.requested_profile) {
        throw new Error("workflow_prepare control requires run_id, expected_revision, and idempotency_key");
      }
      lifecycle = await controller.control({
        runId: input.run_id,
        action: input.action,
        expectedRevision: input.expected_revision,
        idempotencyKey: input.idempotency_key,
        humanDecisionReceipt: input.human_decision_receipt,
      });
    }
    return result({ ...lifecycle, workspace_root: workspace, workspace_binding: workspaceBinding, ordinary_host_use_blocked: false });
  } catch (error) {
    return result({
      error: error.message,
      ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}),
      in_progress: false,
    }, true);
  }
});

await server.connect(new StdioServerTransport());
