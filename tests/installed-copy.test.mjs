import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { enumerateReleaseSurface } from "../src/controller/release-surface.mjs";
import { WORKFLOW_TOOL_ANNOTATIONS } from "../src/mcp/tool-annotations.mjs";
import { WORKFLOW_TOOL_NAMES } from "../src/mcp/tool-registry.mjs";
import { workflowClient } from "./mcp-client.mjs";

test("an isolated installed-copy surface starts MCP with the canonical tool matrix", async () => {
  const installed = mkdtempSync(join(tmpdir(), "workflow-installed-copy-"));
  const home = mkdtempSync(join(tmpdir(), "workflow-installed-home-"));
  let client;
  try {
    for (const entry of enumerateReleaseSurface(defaultRoot, "runtime_paths")) {
      const target = join(installed, entry.relative_path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(entry.path, target, { force: true });
    }
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(installed, "dist", "workflow-mcp.mjs")],
      cwd: installed,
      env: { PATH: process.env.PATH ?? "", HOME: home, CURSOR_PLUGIN_ROOT: installed },
      stderr: "pipe",
    });
    client = workflowClient("workflow-installed-copy-test", [installed]);
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [...WORKFLOW_TOOL_NAMES].sort());
    for (const tool of tools.tools) {
      assert.deepEqual(tool.annotations, WORKFLOW_TOOL_ANNOTATIONS[tool.name]);
    }
    const status = await client.callTool({ name: "workflow_status", arguments: {} });
    assert.equal(status.isError, true);
    assert.match(status.structuredContent.error, /no active Workflow Preparation or Run/);
  } finally {
    await client?.close().catch(() => {});
    rmSync(installed, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
