import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { codexOperationalStateRoot, sharedArtifactStateRoot } from "../core/state-paths.mjs";
import { PLUGIN_VERSION } from "../controller/protocol.mjs";
import { registerManualWorkflowTools } from "./manual-tools.mjs";
import { WorkspaceRootAuthority, WorkspaceRootError } from "./workspace-roots.mjs";

function hasManualRuntime(candidate) {
  return existsSync(join(candidate, "schemas", "artifacts", "work-plan.schema.json"))
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

registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot: codexOperationalStateRoot,
  handoffStateRoot: sharedArtifactStateRoot,
  result,
  failure,
  clientHost: manualClientHost,
});

await server.connect(new StdioServerTransport());
