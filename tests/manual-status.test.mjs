import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { deriveManualWorkflowSnapshot, resolveManualRootPlanId } from "../src/controller/manual-status.mjs";
import { authoritativeArtifactProjectionFromText } from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = join(root, "tests", "fixtures", "artifacts");
const rootPlanId = "wp-adaptive-retry";
const artifact = (name) => ({ label: name, text: readFileSync(join(fixtureRoot, name), "utf8") });
const planFixture = artifact("work-plan.valid.md");
const plan = { ...planFixture, text: planFixture.text.replace("profile_max: supervised", "profile_max: manual").replace("contract_level: controlled", "contract_level: lean") };
const evidenceFixture = artifact("delivery-evidence.valid.md");
const evidence = { ...evidenceFixture, text: evidenceFixture.text.replace(/^intent_hash:.*$/m, `intent_hash: ${authoritativeArtifactProjectionFromText(plan.text).projection_hash}`) };
const review = artifact("work-review.valid.md");
const derive = (artifacts) => deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot: root, observedAt: "2026-07-30T10:00:00.000Z" });
const deriveActive = (artifacts) => deriveManualWorkflowSnapshot({ artifacts, pluginRoot: root, observedAt: "2026-07-30T10:00:00.000Z" });
const provisionalEvidence = {
  ...evidence,
  text: evidence.text
    .replace("status: complete", "status: provisional")
    .replace("overall_grade: verified", "overall_grade: unavailable")
    .replace("    grade: verified", "    grade: unavailable")
    .replace("    limitations: []", "    limitations:\n      - Live verification surface unavailable"),
};
const provisionalReview = {
  ...review,
  text: review.text
    .replace("assessment: achieved", "assessment: provisional")
    .replace("delivery_status: verified", "delivery_status: provisional")
    .replace("next_action: none", "next_action: accept-provisional")
    .replace("Achieved. The required evidence is verified and no finding remains.", "Provisional. The delivery is plausible, but one verification surface is unavailable.")
    .replace("## Next action\n\nNone.", "## Next action\n\naccept-provisional: the human may explicitly accept the open evidence limitation."),
};
const replanReview = {
  ...review,
  label: "work-review.replan.md",
  text: review.text
    .replace("id: wr-adaptive-retry", "id: wr-adaptive-replan")
    .replace("assessment: achieved", "assessment: not-achieved")
    .replace("delivery_status: verified", "delivery_status: blocked")
    .replace("next_action: none", "next_action: replan")
    .replace("Achieved. The required evidence is verified and no finding remains.", "Not-achieved. Changed intent requires a replacement Root.")
    .replace("## Next action\n\nNone.", "## Next action\n\nreplan: create a newly approved Root."),
};
const replacementPlan = {
  ...plan,
  label: "work-plan.replanned.md",
  text: plan.text.replace("id: wp-adaptive-retry", "id: wp-adaptive-retry-v2\npredecessor_plan_id: wp-adaptive-retry\nreplan_source_review_id: wr-adaptive-replan"),
};

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

test("manual status distinguishes absent context, invalid Schema 5, and Workflow 3/4 history", () => {
  assert.equal(derive([]).snapshot.next_action, "provide-artifacts");
  const invalid = derive([{ ...plan, text: plan.text.replace(/^goal:.*\n/m, "") }]);
  assert.equal(invalid.snapshot.state, "replan");
  const legacy = derive([{ ...plan, text: plan.text.replace("schema: 5", "schema: 3") }]);
  assert.equal(legacy.snapshot.state, "stopped");
  assert.equal(legacy.snapshot.compatibility, "read-only-workflow-3");
  const workflow4 = derive([{ ...plan, text: plan.text.replace("schema: 5", "schema: 4") }]);
  assert.equal(workflow4.snapshot.state, "stopped");
  assert.equal(workflow4.snapshot.compatibility, "read-only-workflow-4");
});

test("manual artifact-set hash is stable across input order", () => {
  assert.equal(derive([plan, evidence]).snapshot.artifact_set_hash, derive([evidence, plan]).snapshot.artifact_set_hash);
});

test("manual active root resolution selects one Root or the unique replan lineage tip", () => {
  assert.equal(resolveManualRootPlanId({ artifacts: [plan], pluginRoot: root }), rootPlanId);
  assert.equal(deriveActive([plan]).snapshot.root_plan_id, rootPlanId);
  const replanned = deriveActive([plan, evidence, replanReview, replacementPlan]);
  assert.equal(replanned.snapshot.root_plan_id, "wp-adaptive-retry-v2");
  assert.equal(replanned.snapshot.state, "root-plan-review");
  assert.equal(deriveManualWorkflowSnapshot({ rootPlanId, artifacts: [plan, evidence, replanReview, replacementPlan], pluginRoot: root }).snapshot.root_plan_id, rootPlanId);

  const unrelated = { ...plan, label: "unrelated.md", text: plan.text.replace("id: wp-adaptive-retry", "id: wp-unrelated") };
  assert.throws(() => deriveActive([plan, unrelated]), /active root resolution is ambiguous/);
});

test("manual provisional acceptance is stateless and hash-bound", () => {
  const artifacts = [plan, provisionalEvidence, provisionalReview];
  const ready = derive(artifacts);
  assert.equal(ready.snapshot.state, "delivery-ready-provisional");
  assert.equal(ready.snapshot.next_action, "accept-provisional");
  const accepted = deriveManualWorkflowSnapshot({
    rootPlanId,
    artifacts,
    pluginRoot: root,
    observedAt: "2026-07-30T10:00:00.000Z",
    manualAcceptance: "provisional",
  });
  assert.equal(accepted.snapshot.state, "accepted-provisional");
  assert.equal(accepted.snapshot.acceptance_persisted, false);
  assert.equal(accepted.snapshot.acceptance_basis_hash, ready.snapshot.artifact_set_hash);
  assert.equal(derive(artifacts).snapshot.state, "delivery-ready-provisional");
});

test("manual provisional acceptance rejects failed, stale, legacy, and verified chains", () => {
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId, artifacts: [plan, evidence, review], pluginRoot: root, manualAcceptance: "provisional" }), /requires the unique current provisional review tip/);
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId, artifacts: [plan, provisionalEvidence], pluginRoot: root, manualAcceptance: "provisional" }), /requires the unique current provisional review tip/);
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId, artifacts: [{ ...plan, text: plan.text.replace("schema: 5", "schema: 4") }], pluginRoot: root, manualAcceptance: "provisional" }), /read-only/);
  const failed = {
    ...provisionalEvidence,
    text: provisionalEvidence.text
      .replace("status: provisional", "status: blocked")
      .replaceAll("unavailable", "failed")
      .replace("| CHECK-1 | passed twice | passed |", "| CHECK-1 | assertion failed | failed |")
      .replace("The authorized repository change is complete and verified.", "BLOCKER: required check failed deterministically."),
  };
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId, artifacts: [plan, failed, provisionalReview], pluginRoot: root, manualAcceptance: "provisional" }), /rejects an invalid artifact chain|requires the unique current provisional review tip/);
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
  const client = workflowClient("workflow-manual-status-test", [root]);
  try {
    await client.connect(transport);
    const response = await client.callTool({ name: "workflow_status", arguments: { workspace_root: root, root_plan_id: rootPlanId, artifacts: [plan] } });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.subject_kind, "artifact-chain");
    assert.equal(response.structuredContent.snapshot.next_action, "implement-plan");
    assert.deepEqual(response.structuredContent.model_inheritance, {
      authoritative: false,
      status: "clean",
      incident_count: 0,
      last_incident: null,
      enforcement: "no-incident",
      evidence_effect: "none",
      result_policy: "verified-results-remain-usable",
      qualification_policy: "exact-model-attestation-still-required",
      match_policy: "parent-or-configured-approved-candidates",
    });
    assert.equal(response.structuredContent.host_tool_approval.tool_approval, "strict");
    assert.equal(response.structuredContent.host_tool_approval.authoritative, false);
    assert.equal(response.structuredContent.host_tool_approval.grants_host_approval, false);
    assert.equal(response.structuredContent.host_tool_approval.source, "default");
    assert.equal(response.structuredContent.manual_subagent_policy.authoritative, false);
    assert.equal(response.structuredContent.manual_subagent_policy.mode, "parent-only");
    assert.equal(response.structuredContent.manual_subagent_policy.source, "default");
    assert.deepEqual(response.structuredContent.manual_subagent_policy.hosts.cursor.candidates, []);
    assert.deepEqual(response.structuredContent.manual_subagent_policy.hosts.codex.candidates, []);
    const active = await client.callTool({ name: "workflow_status", arguments: { workspace_root: root, artifacts: [plan] } });
    assert.equal(active.isError, false);
    assert.equal(active.structuredContent.snapshot.root_plan_id, rootPlanId);
    const replanned = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: root, artifacts: [plan, evidence, replanReview, replacementPlan] },
    });
    assert.equal(replanned.isError, false);
    assert.equal(replanned.structuredContent.snapshot.root_plan_id, "wp-adaptive-retry-v2");
    const unrelated = { ...plan, label: "unrelated.md", text: plan.text.replace("id: wp-adaptive-retry", "id: wp-unrelated") };
    const ambiguous = await client.callTool({ name: "workflow_status", arguments: { workspace_root: root, artifacts: [plan, unrelated] } });
    assert.equal(ambiguous.isError, true);
    assert.match(ambiguous.content[0].text, /active root resolution is ambiguous/);
    const accepted = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: root, artifacts: [plan, provisionalEvidence, provisionalReview], manual_acceptance: "provisional" },
    });
    assert.equal(accepted.isError, false);
    assert.equal(accepted.structuredContent.snapshot.state, "accepted-provisional");
    assert.equal(accepted.structuredContent.snapshot.acceptance_persisted, false);
    assert.equal(accepted.structuredContent.snapshot.root_plan_id, rootPlanId);
    const fresh = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: root, root_plan_id: rootPlanId, artifacts: [plan, provisionalEvidence, provisionalReview] },
    });
    assert.equal(fresh.structuredContent.snapshot.state, "delivery-ready-provisional");
    assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("manual workflow_status surfaces allowlisted host preference without granting approval", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-manual-status-allowlisted-"));
  const workflowHome = join(home, ".geldmacher", "workflow");
  mkdirSync(workflowHome, { recursive: true });
  writeFileSync(join(workflowHome, "preferences.yaml"), "schema: 1\ntool_approval: allowlisted\n");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, "dist", "workflow-mcp.mjs")],
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      CURSOR_PLUGIN_ROOT: root,
      GELDMACHER_WORKFLOW_HOME: workflowHome,
    },
    stderr: "pipe",
  });
  const client = workflowClient("workflow-manual-status-allowlisted", [root]);
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: root, root_plan_id: rootPlanId, artifacts: [plan] },
    });
    assert.equal(response.isError, false);
    assert.equal(response.structuredContent.host_tool_approval.tool_approval, "allowlisted");
    assert.equal(response.structuredContent.host_tool_approval.source, "file");
    assert.equal(response.structuredContent.host_tool_approval.authoritative, false);
    assert.equal(response.structuredContent.host_tool_approval.grants_host_approval, false);
    assert.equal(response.structuredContent.host_tool_approval.host_allowlist_required, true);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});
