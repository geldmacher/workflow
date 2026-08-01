import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

test("MCP records a Root, closes it out, and resolves the exact Evidence in a fresh handoff context", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-closeout-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: defaultRoot },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-closeout-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const recorded = await client.callTool({
      name: "workflow_artifact_record",
      arguments: { workspace_root: defaultRoot, artifacts: [{ label: "root", text: rootPlan }] },
    });
    assert.equal(recorded.isError, false);
    assert.equal(recorded.structuredContent.handoff_authoritative, false);

    const closed = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: defaultRoot,
        root_plan_id: "wp-adaptive-retry",
        effective_profile: "manual",
        changed_paths: ["src/retry.mjs"],
        check_evidence: [{
          check_id: "CHECK-1",
          grade: "verified",
          surface: "repository-test",
          method: "deterministic command",
          expected: "Retry verification passes twice",
          observed: "Passed twice",
          repetitions: 2,
          artifact_hashes: ["b".repeat(64)],
          limitations: [],
        }],
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, true);
    assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);

    const context = await client.callTool({
      name: "workflow_artifact_context",
      arguments: { workspace_root: defaultRoot, root_plan_id: "wp-adaptive-retry", root_plan: rootPlan },
    });
    assert.equal(context.isError, false);
    assert.equal(context.structuredContent.evidence_tip, closed.structuredContent.delivery_evidence_id);
    assert.equal(context.structuredContent.artifacts.find((entry) => entry.label === context.structuredContent.evidence_tip).text, closed.structuredContent.artifact);

    const duplicate = await client.callTool({
      name: "workflow_closeout",
      arguments: { workspace_root: defaultRoot, root_plan_id: "wp-adaptive-retry" },
    });
    assert.equal(duplicate.isError, false);
    assert.equal(duplicate.structuredContent.duplicate, true);
    assert.equal(duplicate.structuredContent.artifact, closed.structuredContent.artifact);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP returns valid Evidence with an attach instruction when only handoff persistence fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-closeout-failure-"));
  const unusableHome = join(directory, "home-is-a-file");
  writeFileSync(unusableHome, "not a directory\n");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: { ...process.env, HOME: unusableHome, CURSOR_PLUGIN_ROOT: defaultRoot },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-closeout-failure-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const closed = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: defaultRoot,
        root_plan_id: "wp-adaptive-retry",
        root_plan: rootPlan,
        effective_profile: "manual",
        changed_paths: ["src/retry.mjs"],
        check_evidence: [{
          check_id: "CHECK-1",
          grade: "verified",
          surface: "repository-test",
          method: "deterministic command",
          expected: "Retry verification passes twice",
          observed: "Passed twice",
          repetitions: 2,
          artifact_hashes: ["b".repeat(64)],
          limitations: [],
        }],
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, false);
    assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);
    assert.match(closed.structuredContent.warning, /attach the returned artifact explicitly/);
  } finally {
    await client.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
});
