import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildPluginTargets } from "../scripts/build-plugin-targets.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { loadReleaseSurface } from "../src/controller/release-surface.mjs";
import { WORKFLOW_TOOL_ANNOTATIONS } from "../src/mcp/tool-annotations.mjs";
import { workflowClient } from "./mcp-client.mjs";

const expectedTools = ["workflow_artifact_context", "workflow_artifact_record", "workflow_closeout", "workflow_plan_preflight", "workflow_status"];
const expectedCodexSkills = ["accept-work", "correct-work", "explain-work", "learn-from-work", "plan-work", "review-work", "work-status"];
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const manualGuide = readFileSync(join(defaultRoot, "docs", "manual-workflow.md"), "utf8");

test("canonical target metadata is Workflow 6 before generation", () => {
  const cursor = JSON.parse(readFileSync(join(defaultRoot, ".cursor-plugin", "plugin.json"), "utf8"));
  const codex = JSON.parse(readFileSync(join(defaultRoot, "targets", "codex", ".codex-plugin", "plugin.json"), "utf8"));
  const portable = JSON.parse(readFileSync(join(defaultRoot, "targets", "agent-plugins", "plugin.json"), "utf8"));
  for (const manifest of [cursor, codex, portable]) {
    assert.equal(manifest.version, "6.0.0");
    assert.match(JSON.stringify(manifest), /Workflow 6|Schema-6/);
    assert.doesNotMatch(JSON.stringify(manifest), /Schema[- ]?[345]|Workflow [345]/i);
  }
  const builder = readFileSync(join(defaultRoot, "scripts", "build-plugin-targets.mjs"), "utf8");
  assert.match(builder, /assertCanonicalManifest/);
  assert.doesNotMatch(builder, /manifest\.version\s*=\s*version/);
});

test("deterministic target build isolates Codex and exposes exactly five Manual tools", async () => {
  const output = mkdtempSync(join(tmpdir(), "workflow-target-test-"));
  const pluginData = mkdtempSync(join(tmpdir(), "workflow-codex-data-"));
  let client;
  try {
    const first = buildPluginTargets(join(output, "first"));
    const second = buildPluginTargets(join(output, "second"));
    assert.equal(first.cursor.hash, second.cursor.hash);
    assert.equal(first.codex.hash, second.codex.hash);
    assert.equal(first.agentPlugins.hash, second.agentPlugins.hash);
    assert.equal(readFileSync(join(first.cursor.path, "docs", "manual-workflow.md"), "utf8"), manualGuide);
    assert.equal(readFileSync(join(first.codex.path, "docs", "manual-workflow.md"), "utf8"), manualGuide);
    const repositorySurface = loadReleaseSurface(defaultRoot);
    assert.equal(repositorySurface.runtime_paths.includes(".cursor-plugin/marketplace.json"), false);
    assert.equal(repositorySurface.package_extras.includes(".cursor-plugin/marketplace.json"), true);
    assert.equal(existsSync(join(first.cursor.path, ".cursor-plugin", "plugin.json")), true);
    assert.equal(existsSync(join(first.cursor.path, ".cursor-plugin", "marketplace.json")), false);
    const cursorSurface = loadReleaseSurface(first.cursor.path);
    assert.equal(cursorSurface.runtime_paths.includes(".cursor-plugin/marketplace.json"), false);
    assert.equal(cursorSurface.package_extras.includes(".cursor-plugin/marketplace.json"), false);
    for (const target of [first.cursor.path, first.codex.path, first.agentPlugins.path]) {
      for (const developmentRoot of [".agents", ".build", ".cursor", ".git", "node_modules", "tests"]) {
        assert.equal(existsSync(join(target, developmentRoot)), false, `${developmentRoot} leaked into ${target}`);
      }
      assert.equal(existsSync(join(target, "agents")), false, `Workflow-owned agents leaked into ${target}`);
      const manualRuntime = readFileSync(join(target, "dist", "workflow-mcp.mjs"), "utf8");
      for (const forbidden of ["program-not-classified", "unapproved-root-check", "parseHostCommand", "runHostCheck"]) {
        assert.doesNotMatch(manualRuntime, new RegExp(forbidden), `${target} leaked execution policy ${forbidden}`);
      }
    }
    const cursorHookConfig = JSON.parse(readFileSync(join(first.cursor.path, "hooks", "hooks.json"), "utf8"));
    assert.ok(Object.values(cursorHookConfig.hooks).flat().every((entry) => entry.failClosed === false));
    const cursorHook = spawnSync(process.execPath, [join(first.cursor.path, "hooks", "closeout-guard.mjs"), "--enforce"], {
      cwd: defaultRoot,
      input: JSON.stringify({
        hook_event_name: "preToolUse",
        conversation_id: "installed-cursor-smoke",
        generation_id: "installed-cursor-generation",
        tool_use_id: "installed-cursor-write",
        tool_name: "Write",
        tool_input: { path: "src/example.mjs" },
        cwd: defaultRoot,
        workspace_roots: [defaultRoot],
      }),
      encoding: "utf8",
      env: { ...process.env, HOME: pluginData },
    });
    assert.equal(cursorHook.status, 0, cursorHook.stderr || cursorHook.stdout);
    assert.deepEqual(JSON.parse(cursorHook.stdout || "{}"), {});

    const codexHook = spawnSync(process.execPath, [join(first.codex.path, "dist", "workflow-hook.mjs")], {
      cwd: defaultRoot,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        session_id: "installed-codex-smoke",
        turn_id: "installed-codex-turn",
        tool_name: "apply_patch",
        tool_input: { patch: "x" },
        cwd: defaultRoot,
      }),
      encoding: "utf8",
      env: { ...process.env, HOME: pluginData, PLUGIN_DATA: pluginData },
    });
    assert.equal(codexHook.status, 0, codexHook.stderr || codexHook.stdout);
    assert.deepEqual(JSON.parse(codexHook.stdout || "{}"), {});
    const codexReleaseSurface = JSON.parse(readFileSync(join(first.codex.path, "release-surface.json"), "utf8"));
    assert.ok(codexReleaseSurface.runtime_paths.includes("docs"));
    const codex = first.codex.path;
    const manifest = JSON.parse(readFileSync(join(codex, ".codex-plugin", "plugin.json"), "utf8"));
    assert.equal(manifest.name, "geldmacher-workflow");
    assert.equal(manifest.hooks, undefined);
    assert.equal(manifest.skills, "./skills/");
    assert.equal(manifest.mcpServers, "./.mcp.json");
    const codexSkills = readdirSync(join(codex, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(codexSkills, expectedCodexSkills);
    const codexReview = readFileSync(join(codex, "skills", "review-work", "SKILL.md"), "utf8");
    assert.match(codexReview, /repository-read-only/i);
    assert.match(codexReview, /project harness/i);
    assert.doesNotMatch(codexReview, /command allowlist|model pool|review route/i);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(codex, "dist", "workflow-mcp.mjs")],
      cwd: pluginData,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: pluginData,
        PLUGIN_DATA: pluginData,
        GELDMACHER_WORKFLOW_SHARED_ROOT: join(pluginData, "shared"),
      },
      stderr: "pipe",
    });
    client = workflowClient("workflow-codex-target-test", [codex]);
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), expectedTools);
    for (const tool of tools.tools) {
      assert.deepEqual(tool.annotations, WORKFLOW_TOOL_ANNOTATIONS[tool.name]);
    }
    const preflight = await client.callTool({ name: "workflow_plan_preflight", arguments: { root_plan: rootPlan } });
    assert.equal(preflight.isError, false);
    assert.equal(preflight.structuredContent.feasible, true);
    assert.equal(preflight.structuredContent.root_plan_id, "wp-adaptive-retry");
    assert.equal(preflight.structuredContent.presentation.client_host, "codex");
    const mcp = JSON.parse(readFileSync(join(codex, ".mcp.json"), "utf8"));
    assert.deepEqual(Object.keys(mcp.mcpServers), ["geldmacher-workflow"]);
  } finally {
    await client?.close().catch(() => {});
    rmSync(output, { recursive: true, force: true });
    rmSync(pluginData, { recursive: true, force: true });
  }
});
