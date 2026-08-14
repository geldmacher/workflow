import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { defaultRoot, executionContractFromArtifactText, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";
import { recordModelIncident, workflowStateRoot } from "../hooks/model-inheritance-state.mjs";
import { PreparationStore, repositoryKey, RunStore } from "../src/controller/store.mjs";
import { createInitialStrategy } from "../src/controller/strategy.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import {
  beginManualCheckReceipt,
  completeManualCheckReceipt,
  loadManualCheckReceipts,
} from "../src/core/manual-check-receipts.mjs";

const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");
const controlledRootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const controlledEvidence = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "delivery-evidence.valid.md"), "utf8");

const achievedReviewInput = {
  schema: 1,
  kind: "review-input",
  assessment: "achieved",
  recommended_action: "none",
  assessment_summary: "The exact verified Evidence satisfies the Root.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The Evidence snapshot matches the reviewed state.",
  findings: [],
  missing_evidence: [],
  auditor_reports: [],
};

const verifiedCheck = {
  check_id: "CHECK-1",
  grade: "verified",
  surface: "repository-test",
  method: "deterministic command",
  expected: "Retry verification passes twice",
  observed: "Passed twice",
  repetitions: 2,
  artifact_hashes: ["b".repeat(64)],
  limitations: [],
};

function mcpEnv(home, extra = {}) {
  return {
    ...process.env,
    HOME: home,
    GELDMACHER_WORKFLOW_HOME: join(home, ".geldmacher", "workflow"),
    CURSOR_PLUGIN_ROOT: defaultRoot,
    ...extra,
  };
}

test("MCP plan preflight is read-only and independent from workspace roots", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-preflight-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-preflight-test", [], { advertiseRoots: false });
  try {
    await client.connect(transport);
    const preflight = await client.callTool({ name: "workflow_plan_preflight", arguments: { root_plan: rootPlan } });
    assert.equal(preflight.isError, false);
    assert.equal(preflight.structuredContent.feasible, true);
    assert.equal(preflight.structuredContent.approval_granted, false);
    assert.equal(preflight.structuredContent.mutation_performed, false);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("controller status requires an ephemeral returned-source receipt and projects preparation learning uniformly", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-learning-source-home-"));
  const workspacePath = join(home, "repo");
  mkdirSync(workspacePath);
  const workspace = realpathSync(workspacePath);
  const stateRoot = join(home, ".cursor", "geldmacher-workflow", "state", repositoryKey(workspace));
  const runStore = new RunStore(stateRoot);
  const controllerRootText = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8")
    .replace("id: wp-adaptive-retry", "id: wp-historical");
  const controllerRoot = executionContractFromArtifactText(controllerRootText, defaultRoot);
  const run = runStore.create({
    run_id: "run-historical",
    requested_profile: "supervised",
    effective_profile: "supervised",
    lifecycle: "waiting-human",
    delivery_status: "verified",
    evidence_grade: "verified",
    root_review_complete: false,
    review: { assessment: "achieved", delivery_status: "verified", finding_keys: [] },
    blockers: [],
    plan: controllerRoot,
    root_plan_text: controllerRootText,
    root_plan_hash: controllerRoot.raw_hash,
    root_authoritative_projection_hash: controllerRoot.authoritative_projection_hash,
    intent_hash: controllerRoot.authoritative_projection_hash,
    strategy: createInitialStrategy(controllerRoot),
  });
  const preparationStore = new PreparationStore(stateRoot);
  const preparation = preparationStore.create({
    preparation_id: "prep-current",
    source_kind: "goal",
    requested_profile: "supervised",
    status: "planning",
    blockers: [],
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-learning-source-test", [workspace]);
  try {
    await client.connect(transport);
    const historical = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: workspace, run_id: run.run_id },
    });
    assert.equal(historical.isError, false, JSON.stringify(historical.structuredContent));
    assert.equal(historical.structuredContent.learning.source_binding.status, "unconfirmed");
    assert.ok(historical.structuredContent.learning.blockers.includes("controller-learning-source-not-current-task-bound"));

    const returned = await client.callTool({
      name: "workflow_watch",
      arguments: { workspace_root: workspace, run_id: run.run_id, after_event: 0, timeout_ms: 0 },
    });
    assert.equal(returned.isError, false);
    assert.equal(Object.hasOwn(returned.structuredContent, "learning_source_receipt"), false);
    const answered = await client.callTool({
      name: "workflow_answer",
      arguments: { workspace_root: workspace, run_id: run.run_id, answer: "Bind this exact Run in the current task.", expected_revision: 0, idempotency_key: "learning-source-answer" },
    });
    assert.equal(answered.isError, false);
    assert.equal(typeof answered.structuredContent.learning_source_receipt, "string");
    const bound = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: workspace, run_id: run.run_id, learning_source_receipt: answered.structuredContent.learning_source_receipt },
    });
    assert.equal(bound.isError, false);
    assert.equal(bound.structuredContent.learning.source_binding.status, "confirmed");
    assert.equal(bound.structuredContent.learning.blockers.includes("controller-learning-source-not-current-task-bound"), false);

    const preparationStatus = await client.callTool({
      name: "workflow_status",
      arguments: { workspace_root: workspace, preparation_id: preparation.preparation_id },
    });
    assert.equal(preparationStatus.isError, false);
    assert.equal(preparationStatus.structuredContent.learning.eligible, false);
    assert.equal(preparationStatus.structuredContent.learning.source_kind, "controller-preparation");
    assert.ok(preparationStatus.structuredContent.learning.blockers.includes("learning-source-not-delivery-run"));
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP records a Root, closes it out, and resolves the exact Evidence in a fresh handoff context", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-closeout-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-closeout-test", [defaultRoot]);
  try {
    await client.connect(transport);
    const recorded = await client.callTool({
      name: "workflow_artifact_record",
      arguments: { workspace_root: defaultRoot, artifacts: [{ label: "root", text: rootPlan }] },
    });
    assert.equal(recorded.isError, false);
    assert.equal(recorded.structuredContent.handoff_authoritative, false);
    assert.equal(recorded.structuredContent.handoff_mode, "root-content-cache");
    assert.equal(typeof recorded.structuredContent.root_content_hash, "string");

    const { artifact_hashes: _ignoredHashes, ...parityCheck } = verifiedCheck;
    const summary = "The MCP and native transports share this deterministic closeout input.";
    const receiptOptions = { homeRoot: join(home, ".geldmacher", "workflow") };
    const candidate = beginManualCheckReceipt({
      rootPlanText: rootPlan,
      pluginRoot: defaultRoot,
      workspaceRoot: defaultRoot,
      toolName: "Shell",
      toolInput: { command: "rtk npm test" },
    });
    assert.ok(candidate);
    assert.equal(completeManualCheckReceipt({
      candidate,
      rootPlanText: rootPlan,
      workspaceRoot: defaultRoot,
      toolResponse: { exit_code: 0, output: "Retry verification passes twice\n" },
      options: receiptOptions,
    }).status, "recorded");
    const receipts = loadManualCheckReceipts({
      rootPlanText: rootPlan,
      pluginRoot: defaultRoot,
      workspaceRoot: defaultRoot,
      options: receiptOptions,
    });
    assert.equal(receipts.length, 1);
    const closed = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: defaultRoot,
        root_plan_id: "wp-adaptive-retry",
        effective_profile: "manual",
        changed_paths: ["src/retry.mjs"],
        check_evidence: [parityCheck],
        summary,
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, true);
    assert.equal(closed.structuredContent.handoff_mode, "root-content-cache");
    assert.equal(closed.structuredContent.workspace_binding, "trusted-root");
    assert.equal(closed.structuredContent.workspace_root_used, true);
    assert.deepEqual(closed.structuredContent.changed_paths, ["src/retry.mjs"]);
    assert.match(closed.content[0].text, /changed paths \(1\): src\/retry\.mjs/);
    assert.equal(closed.structuredContent.presentation.outcome, "ready");
    assert.deepEqual(closed.structuredContent.constraint_summary.evidence_gap_checks, []);
    assert.equal(closed.structuredContent.human_attention.required, false);
    assert.match(closed.content[0].text, /host-attested machine Checks: 1\/1/);
    assert.equal(loadManualCheckReceipts({
      rootPlanText: rootPlan,
      pluginRoot: defaultRoot,
      workspaceRoot: defaultRoot,
      options: receiptOptions,
    }).length, 0);
    assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);
    const direct = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      checkEvidence: [parityCheck],
      changedPaths: ["src/retry.mjs"],
      strategyRevision: 0,
      effectiveProfile: "manual",
      summary,
      manualCheckReceipts: receipts,
      pluginRoot: defaultRoot,
    });
    assert.equal(closed.structuredContent.artifact, direct.artifact);
    assert.equal(closed.structuredContent.artifact_hash, direct.artifact_hash);

    recordModelIncident(workflowStateRoot(defaultRoot, { home }), {
      cause: "actual-child-mismatch",
      status: "deviated",
      phase: "review",
      subagent_type: "delivery-auditor",
      parent_model: "parent-model",
      observed_child_model: "foreign-model",
      enforcement: "denied-at-start",
      task_hash: "a".repeat(32),
      recorded_at: "2026-08-01T10:00:00.000Z",
    });

    const context = await client.callTool({
      name: "workflow_artifact_context",
      arguments: { workspace_root: defaultRoot, root_plan_id: "wp-adaptive-retry", root_plan: rootPlan },
    });
    assert.equal(context.isError, false);
    assert.equal(context.structuredContent.evidence_tip, closed.structuredContent.delivery_evidence_id);
    assert.equal(context.structuredContent.artifacts.find((entry) => entry.label === context.structuredContent.evidence_tip).text, closed.structuredContent.artifact);
    assert.equal(context.structuredContent.model_inheritance.authoritative, false);
    assert.equal(context.structuredContent.model_inheritance.status, "deviated");
    assert.equal(context.structuredContent.model_inheritance.last_incident.cause, "actual-child-mismatch");
    assert.equal(context.structuredContent.model_inheritance.evidence_effect, "none");

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

test("MCP work-review mode builds one host-owned review and remains idempotent without adding a sixth tool", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-review-mode-home-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-review-mode-test", [defaultRoot]);
  try {
    await client.connect(transport);
    const argumentsValue = {
      workspace_root: defaultRoot,
      artifact_kind: "work-review",
      root_plan_id: "wp-adaptive-retry",
      root_plan: controlledRootPlan,
      artifacts: [{ label: "evidence", text: controlledEvidence }],
      review_input: achievedReviewInput,
    };
    const first = await client.callTool({ name: "workflow_closeout", arguments: argumentsValue });
    assert.equal(first.isError, false, JSON.stringify(first.structuredContent));
    assert.equal(first.structuredContent.artifact_kind, "work-review");
    assert.match(first.structuredContent.work_review_id, /^wr-adaptive-retry-[a-f0-9]{12}$/);
    assert.equal(first.structuredContent.delivery_status, "verified");
    assert.equal(first.structuredContent.next_action, "none");
    assert.equal(first.structuredContent.task_local_valid, true);
    assert.equal(first.structuredContent.handoff_authoritative, false);
    assert.match(first.structuredContent.artifact, /^---\nartifact: work-review/m);

    const retry = await client.callTool({ name: "workflow_closeout", arguments: argumentsValue });
    assert.equal(retry.isError, false, JSON.stringify(retry.structuredContent));
    assert.equal(retry.structuredContent.work_review_id, first.structuredContent.work_review_id);
    assert.equal(retry.structuredContent.artifact, first.structuredContent.artifact);
    assert.equal(retry.structuredContent.duplicate, true);

    const freshTaskReview = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        review_input: {
          ...achievedReviewInput,
          assessment_summary: "A fresh task-local assessment must not inherit the optional cached Review tip.",
        },
      },
    });
    assert.equal(freshTaskReview.isError, false, JSON.stringify(freshTaskReview.structuredContent));
    assert.equal(freshTaskReview.structuredContent.predecessor_review_id, null);
    assert.notEqual(freshTaskReview.structuredContent.work_review_id, first.structuredContent.work_review_id);

    const missingJudgments = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        review_input: { schema: 1, kind: "review-input", assessment: "achieved", recommended_action: "none" },
      },
    });
    assert.equal(missingJudgments.isError, true);
    assert.equal(missingJudgments.structuredContent.error_code, "review-input-invalid");
    assert.equal(missingJudgments.structuredContent.presentation.phase, "review");
    assert.equal(missingJudgments.structuredContent.presentation.next_action, "retry-review");
    assert.match(missingJudgments.content[0].text, /assessment_summary|findings|snapshot_assessment/);
    assert.match(missingJudgments.content[0].text, /Root, Evidence, Checks, and repository work remain unchanged/i);
    assert.doesNotMatch(missingJudgments.content[0].text, /MCP error -32602/);

    const mistypedJudgment = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        review_input: { ...achievedReviewInput, assessment_summary: 7 },
      },
    });
    assert.equal(mistypedJudgment.isError, true);
    assert.equal(mistypedJudgment.structuredContent.error_code, "review-input-invalid");
    assert.match(mistypedJudgment.structuredContent.error, /review_input\.assessment_summary must be a string/);
    assert.equal(mistypedJudgment.structuredContent.presentation.next_action, "retry-review");

    const authorityInjection = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        review_input: { ...achievedReviewInput, root_plan_id: "wp-model-owned" },
      },
    });
    assert.equal(authorityInjection.isError, true);
    assert.equal(authorityInjection.structuredContent.error_code, "review-input-invalid");
    assert.match(authorityInjection.structuredContent.error, /unsupported field root_plan_id/);
    assert.equal(authorityInjection.structuredContent.presentation.next_action, "retry-review");

    const contradictoryJudgment = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        review_input: {
          ...achievedReviewInput,
          auditor_reports: [{
            role: "delivery-auditor",
            assessment: "not-achieved",
            summary: "The delivery auditor found an unresolved blocking issue.",
          }],
        },
      },
    });
    assert.equal(contradictoryJudgment.isError, true);
    assert.equal(contradictoryJudgment.structuredContent.error_code, "review-input-invalid");
    assert.equal(contradictoryJudgment.structuredContent.presentation.phase, "review");
    assert.equal(contradictoryJudgment.structuredContent.presentation.next_action, "retry-review");
    assert.match(contradictoryJudgment.structuredContent.presentation.next_action_recovery, /Root, Evidence, Checks, and repository work remain unchanged/i);

    const rawReview = await client.callTool({
      name: "workflow_artifact_record",
      arguments: { artifacts: [{ label: "review", text: first.structuredContent.artifact }] },
    });
    assert.equal(rawReview.isError, true);
    assert.equal(rawReview.structuredContent.error_code, "review-artifact-rejected");
    assert.match(rawReview.structuredContent.error, /cannot establish authority/);

    const rawReviewCloseout = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        ...argumentsValue,
        artifacts: [...argumentsValue.artifacts, { label: "raw-review", text: first.structuredContent.artifact, legacy_review_recorded: true }],
        review_input: {
          ...achievedReviewInput,
          assessment_summary: "A newly imported raw Review must not enter predecessor authority.",
        },
      },
    });
    assert.equal(rawReviewCloseout.isError, true);
    assert.equal(rawReviewCloseout.structuredContent.error_code, "review-artifact-rejected");
    assert.match(rawReviewCloseout.structuredContent.error, /rejects newly imported work-review.*without protected builder provenance/);
    const tools = await client.listTools();
    const manualNames = new Set([
      "workflow_artifact_context",
      "workflow_artifact_record",
      "workflow_closeout",
      "workflow_plan_preflight",
      "workflow_status",
    ]);
    assert.deepEqual(tools.tools.map((tool) => tool.name).filter((name) => manualNames.has(name)).sort(), [...manualNames].sort());
    assert.equal(tools.tools.some((tool) => tool.name === "workflow_review"), false);
    const reviewInputContract = tools.tools.find((tool) => tool.name === "workflow_closeout")
      ?.inputSchema?.properties?.review_input;
    assert.equal(reviewInputContract.anyOf[0].additionalProperties, false);
    assert.ok(reviewInputContract.anyOf[0].required.includes("assessment_summary"));
    assert.match(reviewInputContract.anyOf[1].description, /Recovery-only malformed review_input object/);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP returns task-local valid Evidence when only optional handoff persistence fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-closeout-failure-"));
  const unusableHome = join(directory, "home-is-a-file");
  writeFileSync(unusableHome, "not a directory\n");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: {
      ...process.env,
      HOME: unusableHome,
      GELDMACHER_WORKFLOW_HOME: join(unusableHome, ".geldmacher", "workflow"),
      CURSOR_PLUGIN_ROOT: defaultRoot,
    },
    stderr: "pipe",
  });
  const client = workflowClient("workflow-closeout-failure-test", [defaultRoot]);
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
        check_evidence: [verifiedCheck],
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, false);
    assert.equal(closed.structuredContent.handoff_error_code, "handoff-persist-failed");
    assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);
    assert.match(closed.structuredContent.warning, /task-local continuation remains valid/);
    assert.match(closed.content[0].text, /workflow_closeout — partial/);
    assert.equal(closed.structuredContent.presentation.outcome, "partial");
    assert.equal(closed.structuredContent.presentation.next_action, "review-root");
    assert.match(closed.content[0].text, /Review delivery/);
    assert.equal(closed.structuredContent.presentation.schema, 1);
  } finally {
    await client.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
});

test("MCP artifact record stays best-effort when handoff persistence fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-record-failure-"));
  const unusableHome = join(directory, "home-is-a-file");
  writeFileSync(unusableHome, "not a directory\n");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: {
      ...process.env,
      HOME: unusableHome,
      GELDMACHER_WORKFLOW_HOME: join(unusableHome, ".geldmacher", "workflow"),
      CURSOR_PLUGIN_ROOT: defaultRoot,
    },
    stderr: "pipe",
  });
  const client = workflowClient("workflow-record-failure-test", [defaultRoot]);
  try {
    await client.connect(transport);
    const recorded = await client.callTool({
      name: "workflow_artifact_record",
      arguments: { artifacts: [{ label: "root", text: rootPlan }] },
    });
    assert.equal(recorded.isError, false);
    assert.equal(recorded.structuredContent.handoff_persisted, false);
    assert.equal(recorded.structuredContent.handoff_error_code, "handoff-persist-failed");
    assert.equal(recorded.structuredContent.handoff_authoritative, false);
    assert.match(recorded.structuredContent.warning, /attach the exact artifact explicitly/);
    assert.match(recorded.content[0].text, /workflow_artifact_record — partial/);
  } finally {
    await client.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
});

test("MCP artifact record rejects same-ID Roots with conflicting text before handoff persist", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-record-conflict-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-record-conflict-test", [defaultRoot]);
  try {
    await client.connect(transport);
    const conflicting = rootPlan.replace(
      "Make retry handling deterministic",
      "Make retry handling conflicting",
    );
    const recorded = await client.callTool({
      name: "workflow_artifact_record",
      arguments: {
        artifacts: [
          { label: "root-a", text: rootPlan },
          { label: "root-b", text: conflicting },
        ],
      },
    });
    assert.equal(recorded.isError, true);
    assert.match(recorded.structuredContent.error, /conflicting text/);
    assert.equal(recorded.structuredContent.handoff_persisted, undefined);
    assert.equal(Object.hasOwn(recorded.structuredContent, "recorded"), false);
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP closeout persists content-bound Evidence when roots are unavailable and the exact Root is supplied", async () => {
  for (const scenario of [
    { name: "capability-absent", roots: [], options: { advertiseRoots: false }, code: "roots-request-failed" },
    { name: "empty", roots: [], options: {}, code: "roots-empty" },
    { name: "request-failed", roots: [], options: { rootError: "roots capability unavailable" }, code: "roots-request-failed" },
  ]) {
    const home = mkdtempSync(join(tmpdir(), `workflow-rootless-${scenario.name}-`));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
      cwd: defaultRoot,
      env: mcpEnv(home),
      stderr: "pipe",
    });
    const client = workflowClient(`workflow-rootless-${scenario.name}`, scenario.roots, scenario.options);
    try {
      await client.connect(transport);
      const emptyContext = await client.callTool({
        name: "workflow_artifact_context",
        arguments: { workspace_root: join(home, "unavailable-workspace"), root_plan_id: "wp-adaptive-retry", root_plan: rootPlan },
      });
      assert.equal(emptyContext.isError, false);
      assert.equal(emptyContext.structuredContent.workspace_binding, "not-established");
      assert.equal(emptyContext.structuredContent.handoff_mode, "root-content-cache");
      assert.equal(emptyContext.structuredContent.evidence_tip, null);

      const closed = await client.callTool({
        name: "workflow_closeout",
        arguments: {
          workspace_root: join(home, "unavailable-workspace"),
          root_plan_id: "wp-adaptive-retry",
          root_plan: rootPlan,
          effective_profile: "manual",
          changed_paths: ["src/retry.mjs"],
          check_evidence: [verifiedCheck],
        },
      });
      assert.equal(closed.isError, false);
      assert.equal(closed.structuredContent.handoff_persisted, true);
      assert.equal(closed.structuredContent.handoff_mode, "root-content-cache");
      assert.equal(closed.structuredContent.workspace_binding, "not-established");
      assert.equal(closed.structuredContent.workspace_root_used, false);
      assert.equal(Object.hasOwn(closed.structuredContent, "workspace_root"), false);
      assert.match(closed.structuredContent.warning ?? "", /workspace binding unavailable|supplied workspace_root was not used/);
      assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);
      assert.equal(existsSync(join(home, ".cursor", "geldmacher-workflow")), false);

      const context = await client.callTool({
        name: "workflow_artifact_context",
        arguments: { root_plan_id: "wp-adaptive-retry", root_plan: rootPlan },
      });
      assert.equal(context.isError, false);
      assert.equal(context.structuredContent.handoff_mode, "root-content-cache");
      assert.equal(context.structuredContent.workspace_binding, "not-established");
      assert.equal(context.structuredContent.evidence_tip, closed.structuredContent.delivery_evidence_id);

      const missingRoot = await client.callTool({
        name: "workflow_closeout",
        arguments: { root_plan_id: "wp-missing-root", effective_profile: "manual", check_evidence: [verifiedCheck] },
      });
      assert.equal(missingRoot.isError, true);
      assert.match(missingRoot.structuredContent.error, /exact Root|handoff/i);

      const conflictingChain = await client.callTool({
        name: "workflow_closeout",
        arguments: {
          root_plan_id: "wp-adaptive-retry",
          root_plan: rootPlan,
          artifacts: [
            { label: "duplicate", text: rootPlan },
            { label: "duplicate", text: rootPlan.replace("Make retry handling deterministic", "Make retry handling conflicting") },
          ],
          effective_profile: "manual",
          changed_paths: ["src/retry.mjs"],
          check_evidence: [verifiedCheck],
        },
      });
      assert.equal(conflictingChain.isError, true);
      assert.match(conflictingChain.structuredContent.error, /conflicting text/);
      assert.equal(Object.hasOwn(conflictingChain.structuredContent, "artifact"), false);

      const mismatchedRoot = await client.callTool({
        name: "workflow_closeout",
        arguments: {
          root_plan_id: "wp-different-root",
          root_plan: rootPlan,
          effective_profile: "manual",
          changed_paths: ["src/retry.mjs"],
          check_evidence: [verifiedCheck],
        },
      });
      assert.equal(mismatchedRoot.isError, true);
      assert.match(mismatchedRoot.structuredContent.error, /Root ID mismatch|exact Root ID mismatch/);
      assert.equal(Object.hasOwn(mismatchedRoot.structuredContent, "artifact"), false);
    } finally {
      await client.close().catch(() => {});
      rmSync(home, { recursive: true, force: true });
    }
  }
});

test("MCP closeout uses host-configured workspace when roots are unavailable", async () => {
  const home = mkdtempSync(join(tmpdir(), "workflow-host-bound-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
    cwd: defaultRoot,
    env: mcpEnv(home, { GELDMACHER_WORKFLOW_WORKSPACE_ROOT: defaultRoot }),
    stderr: "pipe",
  });
  const client = workflowClient("workflow-host-bound", [], { advertiseRoots: false });
  try {
    await client.connect(transport);
    const closed = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        root_plan_id: "wp-adaptive-retry",
        root_plan: rootPlan,
        effective_profile: "manual",
        changed_paths: ["src/retry.mjs"],
        check_evidence: [verifiedCheck],
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, true);
    assert.equal(closed.structuredContent.workspace_binding, "trusted-root");
    assert.equal(closed.structuredContent.workspace_root_used, true);
    assert.equal(closed.structuredContent.workspace_root, realpathSync(defaultRoot));
  } finally {
    await client.close().catch(() => {});
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP closeout never falls back for foreign or symlink workspace roots", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-root-boundary-"));
  const home = join(directory, "home");
  const foreign = join(directory, "foreign");
  const real = join(directory, "real");
  const alias = join(directory, "alias");
  mkdirSync(home);
  mkdirSync(foreign);
  mkdirSync(real);
  symlinkSync(real, alias);
  for (const scenario of [
    { name: "foreign", roots: [defaultRoot], workspace: foreign, pattern: /not an advertised MCP root/ },
    { name: "symlink", roots: [alias], workspace: alias, pattern: /symlink redirected/ },
    { name: "multiple", roots: [defaultRoot, foreign], workspace: undefined, pattern: /multiple MCP workspace roots/ },
  ]) {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(defaultRoot, "dist", "workflow-mcp.mjs")],
      cwd: defaultRoot,
      env: mcpEnv(home),
      stderr: "pipe",
    });
    const client = workflowClient(`workflow-boundary-${scenario.name}`, scenario.roots);
    try {
      await client.connect(transport);
      const closed = await client.callTool({
        name: "workflow_closeout",
        arguments: {
          workspace_root: scenario.workspace,
          root_plan_id: "wp-adaptive-retry",
          root_plan: rootPlan,
          effective_profile: "manual",
          changed_paths: ["src/retry.mjs"],
          check_evidence: [verifiedCheck],
        },
      });
      assert.equal(closed.isError, true);
      assert.match(closed.structuredContent.error, scenario.pattern);
      assert.match(closed.structuredContent.error_code, /^(?:root-(?:foreign|symlink)|roots-multiple)$/);
    } finally {
      await client.close().catch(() => {});
    }
  }
  rmSync(directory, { recursive: true, force: true });
});
