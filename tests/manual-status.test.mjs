import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { deriveManualWorkflowSnapshot } from "../src/controller/manual-status.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = join(root, "tests", "fixtures", "artifacts");
const rootPlanId = "wp-adaptive-retry";
const artifact = (name) => ({ label: name, text: readFileSync(join(fixtureRoot, name), "utf8") });
const planFixture = artifact("work-plan.valid.md");
const plan = { ...planFixture, text: planFixture.text.replace("profile_max: supervised", "profile_max: manual").replace("contract_level: controlled", "contract_level: lean") };
const evidence = artifact("delivery-evidence.valid.md");
const review = artifact("work-review.valid.md");
const derive = (artifacts) => deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot: root, observedAt: "2026-07-30T10:00:00.000Z" });

test("manual remains a compact human-started path without controller state", () => {
  const value = derive([plan]);
  assert.equal(value.snapshot.snapshot_source, "artifact-chain");
  assert.equal(value.snapshot.run_id, null);
  assert.equal(value.snapshot.contract_level, "lean");
  assert.equal(value.snapshot.state, "root-plan-review");
  assert.equal(value.snapshot.next_action, "implement-plan");
});

test("manual evidence waits for review and a verified review achieves", () => {
  const delivered = derive([plan, evidence]);
  assert.equal(delivered.snapshot.state, "root-review");
  assert.equal(delivered.snapshot.required_actor, "reviewer");
  const achieved = derive([plan, evidence, review]);
  assert.equal(achieved.snapshot.state, "achieved");
  assert.equal(achieved.snapshot.evidence_tip, "de-adaptive-retry");
  assert.equal(achieved.snapshot.review_tip, "wr-adaptive-retry");
});

test("manual status distinguishes absent context, invalid Schema 4, and Workflow 3 history", () => {
  assert.equal(derive([]).snapshot.next_action, "provide-artifacts");
  const invalid = derive([{ ...plan, text: plan.text.replace(/^goal:.*\n/m, "") }]);
  assert.equal(invalid.snapshot.state, "replan");
  const legacy = derive([{ ...plan, text: plan.text.replace("schema: 4", "schema: 3") }]);
  assert.equal(legacy.snapshot.state, "stopped");
  assert.equal(legacy.snapshot.compatibility, "read-only-workflow-3");
});

test("manual artifact-set hash is stable across input order", () => {
  assert.equal(derive([plan, evidence]).snapshot.artifact_set_hash, derive([evidence, plan]).snapshot.artifact_set_hash);
});

test("manual workflow_status is read-only and creates no controller state", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-manual-status-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "workflow-mcp.mjs")],
    cwd: root,
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: root },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-manual-status-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const response = await client.callTool({ name: "workflow_status", arguments: { workspace_root: root, root_plan_id: rootPlanId, artifacts: [plan] } });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.subject_kind, "artifact-chain");
    assert.equal(response.structuredContent.snapshot.next_action, "implement-plan");
    assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});
