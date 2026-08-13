import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
const expectedJourneyStates = [
  "plan-ready", "implementation-active", "closeout-recovery-required", "review-ready", "review-active",
  "correction-approval-required", "replan-approval-required", "provisional-acceptance-required",
  "clarification-required", "blocked", "done",
];
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const manualGuide = readFileSync(join(defaultRoot, "docs", "manual-workflow.md"), "utf8");

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
      const manualRuntime = readFileSync(join(target, "dist", "workflow-mcp.mjs"), "utf8");
      for (const state of expectedJourneyStates) assert.match(manualRuntime, new RegExp(`\\b${state}\\b`), `${target} misses journey state ${state}`);
      for (const action of ["Implement Plan", "review-work", "correct-work", "plan-work replan", "accept-work"]) {
        assert.match(manualRuntime, new RegExp(action.replace(" ", "\\s+")), `${target} misses shared action ${action}`);
      }
    }
    const codexReleaseSurface = JSON.parse(readFileSync(join(first.codex.path, "release-surface.json"), "utf8"));
    assert.ok(codexReleaseSurface.runtime_paths.includes("docs"));
    const codex = first.codex.path;
    const manifest = JSON.parse(readFileSync(join(codex, ".codex-plugin", "plugin.json"), "utf8"));
    assert.equal(manifest.name, "geldmacher-workflow");
    assert.equal(manifest.hooks, undefined);
    assert.equal(manifest.skills, "./skills/");
    assert.equal(manifest.mcpServers, "./.mcp.json");
    const codexReview = readFileSync(join(codex, "skills", "review-work", "SKILL.md"), "utf8");
    const codexCorrect = readFileSync(join(codex, "skills", "correct-work", "SKILL.md"), "utf8");
    const codexExplain = readFileSync(join(codex, "skills", "explain-work", "SKILL.md"), "utf8");
    const explanationContract = readFileSync(join(codex, "references", "explanation-contract.md"), "utf8");
    const reviewContract = readFileSync(join(codex, "references", "review-contract.md"), "utf8");
    for (const heading of ["What was achieved", "What this means", "Verification and limits", "Technical traceability"]) {
      assert.match(`${codexReview}\n${codexExplain}\n${explanationContract}`, new RegExp(heading, "i"));
    }
    assert.match(codexReview, /current reviewer.*not another subagent or model call/is);
    assert.match(codexReview, /protected root-boundary receipt.*Never invent/is);
    assert.match(`${codexReview}\n${reviewContract}`, /first three.*stand alone.*without.*implementation history.*code knowledge/is);
    assert.match(reviewContract, /separates executor claims from independently inspected evidence/is);
    assert.match(codexExplain, /Final repository explanation.*only for `achieved`/is);
    assert.match(`${codexCorrect}\n${codexReview}`, /every inherited required Root Check not effectively `passed`/is);
    assert.match(codexCorrect, /Equivalent Checks run once.*stable closeout state.*each ID keeps honest Evidence/is);
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
    const mcp = JSON.parse(readFileSync(join(codex, ".mcp.json"), "utf8"));
    assert.deepEqual(Object.keys(mcp.mcpServers), ["geldmacher-workflow"]);
  } finally {
    await client?.close().catch(() => {});
    rmSync(output, { recursive: true, force: true });
    rmSync(pluginData, { recursive: true, force: true });
  }
});
