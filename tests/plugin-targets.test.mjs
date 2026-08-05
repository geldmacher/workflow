import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildPluginTargets } from "../scripts/build-plugin-targets.mjs";
import { workflowClient } from "./mcp-client.mjs";

const expectedTools = ["workflow_artifact_context", "workflow_artifact_record", "workflow_closeout", "workflow_plan_preflight", "workflow_status"];

test("deterministic target build isolates Codex and exposes exactly five Manual tools", async () => {
  const output = mkdtempSync(join(tmpdir(), "workflow-target-test-"));
  const pluginData = mkdtempSync(join(tmpdir(), "workflow-codex-data-"));
  let client;
  try {
    const first = buildPluginTargets(join(output, "first"));
    const second = buildPluginTargets(join(output, "second"));
    assert.equal(first.cursor.hash, second.cursor.hash);
    assert.equal(first.codex.hash, second.codex.hash);
    const codex = first.codex.path;
    const manifest = JSON.parse(readFileSync(join(codex, ".codex-plugin", "plugin.json"), "utf8"));
    assert.equal(manifest.name, "geldmacher-workflow");
    assert.equal(manifest.hooks, undefined);
    assert.equal(manifest.skills, "./skills/");
    assert.equal(manifest.mcpServers, "./.mcp.json");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(codex, "dist", "workflow-mcp.mjs")],
      cwd: codex,
      env: { ...process.env, PLUGIN_ROOT: codex, PLUGIN_DATA: pluginData, GELDMACHER_WORKFLOW_SHARED_ROOT: join(pluginData, "shared") },
      stderr: "pipe",
    });
    client = workflowClient("workflow-codex-target-test", [codex]);
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), expectedTools);
  } finally {
    await client?.close().catch(() => {});
    rmSync(output, { recursive: true, force: true });
    rmSync(pluginData, { recursive: true, force: true });
  }
});
