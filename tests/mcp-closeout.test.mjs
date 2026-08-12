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

test("MCP returns valid Evidence with an attach instruction when only handoff persistence fails", async () => {
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
    assert.match(closed.structuredContent.warning, /attach the returned artifact explicitly/);
    assert.match(closed.content[0].text, /workflow_closeout — partial/);
    assert.equal(closed.structuredContent.presentation.outcome, "partial");
    assert.equal(closed.structuredContent.presentation.next_action, "attach-artifact");
    assert.match(closed.content[0].text, /attach|Attach/);
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
