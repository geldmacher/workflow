import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { codexOperationalStateRoot } from "../core/state-paths.mjs";
import { harnessContractHash } from "../core/harness-attestations.mjs";
import { orchestrateHarnessPhase } from "../controller/harness-orchestrator.mjs";
import { createHarnessLifecycleController } from "../controller/harness-lifecycle.mjs";
import { PLUGIN_VERSION } from "../controller/protocol.mjs";
import { loadProtectedProjectHarness } from "../harness/module-adapter.mjs";
import { registerManualWorkflowTools } from "./manual-tools.mjs";
import { WorkspaceRootAuthority, WorkspaceRootError } from "./workspace-roots.mjs";

function hasManualRuntime(candidate) {
  return existsSync(join(candidate, "schemas", "artifacts", "work-plan-6.schema.json"))
    && existsSync(join(candidate, "scripts", "validate-artifact.mjs"));
}

function resolvePluginRoot(sourceDirectory) {
  const explicit = process.env.PLUGIN_ROOT?.trim();
  if (explicit) {
    const candidate = resolve(explicit);
    if (!hasManualRuntime(candidate)) throw new Error(`PLUGIN_ROOT does not contain the Workflow Manual runtime: ${candidate}`);
    return candidate;
  }

  let candidate = resolve(sourceDirectory);
  while (true) {
    if (hasManualRuntime(candidate)) return candidate;
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new Error(`Unable to locate the Workflow plugin root from MCP bundle: ${sourceDirectory}`);
}

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolvePluginRoot(sourceDirectory);
const manualClientHost = typeof __GELDMACHER_WORKFLOW_MANUAL_CLIENT_HOST__ === "string"
  ? __GELDMACHER_WORKFLOW_MANUAL_CLIENT_HOST__
  : "codex";
const server = new McpServer({ name: "geldmacher-workflow-manual", version: PLUGIN_VERSION });
const workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots());
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());

function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}

function failure(error) {
  return result({
    error: error.message,
    ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}),
  }, true);
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
      stateRoot: codexOperationalStateRoot(workspaceRoot),
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
  operationalStateRoot: codexOperationalStateRoot,
  result,
  failure,
  clientHost: manualClientHost,
  reviewHarnessPhase,
  runStatus: ({ runId, stateRoot, workspace }) => createHarnessLifecycleController({
    stateRoot,
    workspaceBinding: harnessContractHash({ workspace_root: workspace }),
    pluginRoot,
    harnessBinding: null,
  }).status(runId),
});

await server.connect(new StdioServerTransport());
