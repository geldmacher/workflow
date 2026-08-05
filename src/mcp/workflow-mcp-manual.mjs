import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { codexOperationalStateRoot, sharedArtifactStateRoot } from "../core/state-paths.mjs";
import { PLUGIN_VERSION } from "../controller/protocol.mjs";
import { registerManualWorkflowTools } from "./manual-tools.mjs";
import { WorkspaceRootAuthority, WorkspaceRootError } from "./workspace-roots.mjs";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(process.env.PLUGIN_ROOT ?? resolve(sourceDirectory, "../.."));
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
});

await server.connect(new StdioServerTransport());
