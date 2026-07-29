import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { deriveManualWorkflowSnapshot } from "../src/controller/manual-status.mjs";
import { repositoryKey, RunStore } from "../src/controller/store.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = join(root, "tests", "fixtures", "artifacts");
const rootPlanId = "wp-20260712T150503Z-configurable-retry-multiplier";

function artifact(name) {
  return { label: name, text: readFileSync(join(fixtureRoot, name), "utf8") };
}

const plan = artifact("work-plan.valid.md");
const initialEvidence = artifact("delivery-evidence.valid.md");
const firstReview = artifact("work-review-correction.valid.md");
const firstCorrectionEvidence = artifact("delivery-evidence-correction.valid.md");
const secondReview = artifact("work-review-correction-2.valid.md");
const secondCorrectionEvidence = artifact("delivery-evidence-correction-2.valid.md");
const achievedReview = artifact("work-review.valid.md");
const fullChain = [plan, initialEvidence, firstReview, firstCorrectionEvidence, secondReview, secondCorrectionEvidence, achievedReview];

function derive(artifacts) {
  return deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot: root, observedAt: "2026-07-29T10:00:00.000Z" });
}

test("manual status moves from root approval to review without persisted run state", () => {
  const rootOnly = derive([plan]);
  assert.equal(rootOnly.snapshot.snapshot_source, "artifact-chain");
  assert.equal(rootOnly.snapshot.run_id, null);
  assert.equal(rootOnly.snapshot.revision, null);
  assert.equal(rootOnly.snapshot.state, "root-plan-review");
  assert.equal(rootOnly.snapshot.required_actor, "human");
  assert.equal(rootOnly.snapshot.next_action, "implement-plan");

  const delivered = derive([plan, initialEvidence]);
  assert.equal(delivered.snapshot.state, "root-review");
  assert.equal(delivered.snapshot.required_actor, "reviewer");
  assert.equal(delivered.snapshot.evidence_tip, "de-20260712T150505Z-initial-retry-delivery");
});

test("manual correction waits for human approval and its evidence requires another review", () => {
  const correction = derive([plan, initialEvidence, firstReview]);
  assert.equal(correction.snapshot.state, "waiting-human");
  assert.equal(correction.snapshot.required_actor, "human");
  assert.equal(correction.snapshot.next_action, "approve-correction");
  assert.deepEqual(correction.snapshot.allowed_actions, ["inspect", "correct", "replan"]);

  const corrected = derive([plan, initialEvidence, firstReview, firstCorrectionEvidence]);
  assert.equal(corrected.snapshot.state, "root-review");
  assert.equal(corrected.snapshot.required_actor, "reviewer");
  assert.equal(corrected.snapshot.next_action, "review-root");
  assert.equal(corrected.snapshot.evidence_tip, "de-20260712T150508Z-whitespace-correction");
});

test("manual full chain reaches achieved and exposes both artifact tips", () => {
  const result = derive(fullChain);
  assert.equal(result.snapshot.state, "achieved");
  assert.equal(result.snapshot.review_tip, "wr-20260712T150511Z-retry-root-achieved");
  assert.equal(result.artifact_summary.artifact_count, 7);
  assert.deepEqual(result.snapshot.allowed_actions, ["explain", "learn"]);
});

test("manual status distinguishes missing chat context from invalid schema", () => {
  const incomplete = derive([plan, firstReview]);
  assert.equal(incomplete.snapshot.state, "waiting-human");
  assert.equal(incomplete.snapshot.next_action, "provide-artifacts");
  assert.ok(incomplete.snapshot.blockers.some((blocker) => blocker.includes("de-20260712T150505Z-initial-retry-delivery")));

  const legacy = derive([{ ...plan, text: plan.text.replace("schema: 3", "schema: 2") }]);
  assert.equal(legacy.snapshot.state, "replan");
  assert.equal(legacy.snapshot.next_action, "replan");

  const mixed = derive([plan, { ...initialEvidence, text: initialEvidence.text.replace("schema: 3", "schema: 2") }]);
  assert.equal(mixed.snapshot.state, "replan");
});

test("manual artifact-set hash is stable across input order", () => {
  const forward = derive([plan, initialEvidence]);
  const reverse = derive([initialEvidence, plan]);
  assert.equal(forward.snapshot.artifact_set_hash, reverse.snapshot.artifact_set_hash);
  assert.equal(forward.snapshot.observed_at, "2026-07-29T10:00:00.000Z");
});

test("manual status rejects a branched present chain instead of guessing a tip", () => {
  const branch = {
    label: "delivery-evidence-branch.md",
    text: secondCorrectionEvidence.text
      .replaceAll("de-20260712T150510Z-rollback-correction", "de-rollback-branch")
      .replaceAll("rs-20260712T150510Z-rollback-correction", "rs-rollback-branch"),
  };
  const result = derive([...fullChain, branch]);
  assert.equal(result.snapshot.state, "replan");
  assert.ok(result.snapshot.blockers.some((blocker) => /chain branches/.test(blocker)));
});

test("manual workflow_status is read-only and creates no controller state", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-manual-status-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "workflow-mcp.mjs")],
    cwd: root,
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: root, CURSOR_API_KEY: "must-not-be-needed" },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-manual-status-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: root, root_plan_id: rootPlanId, artifacts: [plan] },
    });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.subject_kind, "artifact-chain");
    assert.equal(response.structuredContent.run, null);
    assert.equal(response.structuredContent.snapshot.next_action, "implement-plan");
    assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("workflow_status without a selector resolves exactly one active controller subject", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-active-status-home-"));
  const stateRoot = join(home, ".cursor", "geldmacher-workflow", "state", repositoryKey(root));
  new RunStore(stateRoot).create({
    requested_profile: "auto-gated",
    effective_profile: "auto-gated",
    lifecycle: "waiting-human",
    blockers: ["test-active-run"],
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "workflow-mcp.mjs")],
    cwd: root,
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: root },
    stderr: "pipe",
  });
  const client = new Client({ name: "workflow-active-status-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const response = await client.callTool({ name: "workflow_status", arguments: { workspace_root: root } });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.subject_kind, "run");
    assert.equal(response.structuredContent.snapshot.snapshot_source, "controller-run");
    assert.equal(response.structuredContent.snapshot.revision, 0);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});
