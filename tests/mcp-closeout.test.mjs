import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";
import { recordModelIncident, workflowStateRoot } from "../hooks/model-inheritance-state.mjs";

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

    const closed = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: defaultRoot,
        root_plan_id: "wp-adaptive-retry",
        effective_profile: "manual",
        changed_paths: ["src/retry.mjs"],
        check_evidence: [verifiedCheck],
      },
    });
    assert.equal(closed.isError, false);
    assert.equal(closed.structuredContent.handoff_persisted, true);
    assert.equal(closed.structuredContent.handoff_mode, "root-content-cache");
    assert.equal(closed.structuredContent.workspace_binding, "trusted-root");
    assert.equal(closed.structuredContent.workspace_root_used, true);
    assert.deepEqual(inspectArtifactText(closed.structuredContent.artifact, defaultRoot).errors, []);

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
  } finally {
    await client.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
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
