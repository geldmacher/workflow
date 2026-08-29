import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const expectedCodexSkills = ["accept-work", "correct-work", "engineering-work", "explain-work", "learn-from-work", "plan-work", "review-work", "work-status"];
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const manualGuide = readFileSync(join(defaultRoot, "docs", "manual-workflow.md"), "utf8");
const installationGuide = readFileSync(join(defaultRoot, "docs", "installation.md"), "utf8");

function fencedBlock(markdown, language) {
  const match = markdown.match(new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```"));
  assert.ok(match, `missing ${language} code block`);
  return match[1];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("release installation guide has usable selected-host verification and a complete Codex marketplace", () => {
  assert.match(installationGuide, /Download only the archive for the intended host plus `SHA256SUMS` and `provenance\.json`/);
  assert.match(installationGuide, /You do not need the other host archive or `RELEASE_NOTES\.md`/);
  assert.doesNotMatch(installationGuide, /shasum -a 256 -c SHA256SUMS/);

  const shell = fencedBlock(installationGuide, "sh");
  assert.match(shell, /verify_release_file "\$archive"/);
  assert.match(shell, /verify_release_file "provenance\.json"/);
  assert.match(shell, /\$2 == file/);
  assert.match(shell, /count == 1/);
  assert.match(shell, /sha256sum -c -/);
  assert.match(shell, /shasum -a 256 -c -/);

  if (process.platform !== "win32") {
    const download = mkdtempSync(join(tmpdir(), "workflow-install-checksum-"));
    try {
      const archive = "geldmacher-workflow-cursor-v6.0.0.zip";
      const archiveBytes = Buffer.from("selected cursor archive");
      const provenanceBytes = Buffer.from('{"kind":"github-release-provenance"}\n');
      writeFileSync(join(download, archive), archiveBytes);
      writeFileSync(join(download, "provenance.json"), provenanceBytes);
      writeFileSync(join(download, "SHA256SUMS"), [
        `${sha256(archiveBytes)}  ${archive}`,
        `${"a".repeat(64)}  geldmacher-workflow-codex-v6.0.0.zip`,
        `${"b".repeat(64)}  RELEASE_NOTES.md`,
        `${sha256(provenanceBytes)}  provenance.json`,
        "",
      ].join("\n"));
      const result = spawnSync("/bin/sh", ["-c", shell], { cwd: download, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /geldmacher-workflow-cursor-v6\.0\.0\.zip: OK/);
      assert.match(result.stdout, /provenance\.json: OK/);
    } finally {
      rmSync(download, { recursive: true, force: true });
    }
  }

  const powershell = fencedBlock(installationGuide, "powershell");
  assert.match(powershell, /\$files = @\(\$archive, "provenance\.json"\)/);
  assert.match(powershell, /\[regex\]::Escape\(\$file\)/);
  assert.match(powershell, /\$matches\.Count -ne 1/);
  assert.match(powershell, /Get-FileHash -LiteralPath/);
  assert.match(powershell, /\$actual -ne \$expected/);

  const marketplace = JSON.parse(fencedBlock(installationGuide, "json"));
  assert.deepEqual(Object.keys(marketplace), ["name", "interface", "plugins"]);
  assert.equal(marketplace.name, "geldmacher-personal");
  assert.deepEqual(marketplace.interface, { displayName: "Geldmacher Plugins" });
  assert.equal(marketplace.plugins.length, 1);
  assert.deepEqual(marketplace.plugins[0], {
    name: "geldmacher-workflow",
    source: { source: "local", path: "./.codex/plugins/geldmacher-workflow" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools",
  });

  for (const requirement of [
    /preserve its top-level `name`, `interface`, and every unrelated item in `plugins`/,
    /Fully quit and restart the ChatGPT\/Codex desktop app/,
    /Plugins Directory/,
    /\.codex\/plugins\/cache\/geldmacher-personal\/geldmacher-workflow\/local/,
    /Local Marketplace plugins run from this cache copy, not directly from/,
    /start a new Codex task/,
    /For an update/,
    /For rollback/,
    /Hook Trust/,
    /reload Cursor/,
  ]) {
    assert.match(installationGuide, requirement);
  }

  const codexReadme = readFileSync(join(defaultRoot, "targets", "codex", "README.md"), "utf8");
  assert.match(codexReadme, /\[Install Workflow for Cursor or Codex\]\(\.\.\/\.\.\/docs\/installation\.md\)/);
  assert.match(codexReadme, /fully restart the ChatGPT\/Codex desktop app/);
  assert.match(codexReadme, /install or refresh Workflow through the Plugins Directory/);
  assert.match(codexReadme, /installed cache copy below `~\/\.codex\/plugins\/cache\/`/);
  assert.match(codexReadme, /start a new task/);
  assert.match(codexReadme, /Replacing source files alone does not activate them/);
});

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
    assert.equal(readFileSync(join(first.cursor.path, "docs", "installation.md"), "utf8"), installationGuide);
    assert.equal(readFileSync(join(first.codex.path, "docs", "installation.md"), "utf8"), installationGuide);
    assert.match(readFileSync(join(first.cursor.path, "README.md"), "utf8"), /\[Install Workflow for Cursor or Codex\]\(docs\/installation\.md\)/);
    assert.match(readFileSync(join(first.codex.path, "README.md"), "utf8"), /\[Install Workflow for Cursor or Codex\]\(docs\/installation\.md\)/);
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
      const localBuilder = readFileSync(join(target, "dist", "manual-workflow.mjs"), "utf8");
      assert.equal(existsSync(join(target, "schemas", "manual-workflow", "request-1.schema.json")), true);
      for (const forbidden of ["program-not-classified", "unapproved-root-check", "parseHostCommand", "runHostCheck"]) {
        assert.doesNotMatch(manualRuntime, new RegExp(forbidden), `${target} leaked execution policy ${forbidden}`);
      }
      assert.doesNotMatch(localBuilder, /workflow_closeout|workflow_status|node:child_process|captureRepositorySnapshot/);
    }
    const localValidationInput = JSON.stringify({ schema: 1, operation: "validate-plan", root_plan: rootPlan });
    const localValidationOutputs = [first.cursor.path, first.codex.path, first.agentPlugins.path].map((target) => {
      const result = spawnSync(process.execPath, [join(target, "dist", "manual-workflow.mjs"), "validate-plan"], {
        cwd: defaultRoot,
        input: localValidationInput,
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: pluginData },
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(JSON.parse(result.stdout).ok, true);
      return result.stdout;
    });
    assert.equal(new Set(localValidationOutputs).size, 1, "all targets must return byte-identical local validation output");
    const localReviewInput = JSON.stringify({
      schema: 1,
      operation: "build-review",
      root_plan: rootPlan,
      artifacts: [],
      review_input: {
        schema: 1,
        kind: "review-input",
        assessment: "achieved",
        recommended_action: "none",
        assessment_summary: "The target smoke observes the required repository outcome.",
        snapshot_assessment: "consistent",
        snapshot_summary: "The same closed observation is supplied to every target.",
        findings: [],
        missing_evidence: [],
      },
      repository_observation: {
        schema: 1,
        kind: "unprotected-repository-observation",
        repository_root: defaultRoot,
        changed_paths: ["src/controller/manual-status.mjs"],
        snapshot_material: ["target-smoke-tree", "target-smoke-diff"],
        limitations: ["No protected host attestation is available in this MCP-disabled target smoke."],
      },
      check_observations: [{
        check_id: "CHECK-1",
        grade: "supported",
        observed: "The target smoke observation passed.",
        evidence_material: ["target-smoke-check-1-pass"],
        limitations: [],
      }],
    });
    const localReviewOutputs = [first.cursor.path, first.codex.path, first.agentPlugins.path].map((target) => {
      const result = spawnSync(process.execPath, [join(target, "dist", "manual-workflow.mjs"), "build-review"], {
        cwd: defaultRoot,
        input: localReviewInput,
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: pluginData },
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.presentation.next_action, "accept-provisional");
      return result.stdout;
    });
    assert.equal(new Set(localReviewOutputs).size, 1, "all targets must return byte-identical local Review artifacts");
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
    assert.match(codexReview, /manual-workflow\.mjs build-review/i);
    assert.match(codexReview, /without MCP, adapters, MCP Roots, hooks, cache, or state/i);
    assert.doesNotMatch(codexReview, /workflow_[a-z_]+/);
    assert.doesNotMatch(codexReview, /command allowlist|model pool|review route/i);
    const codexEngineering = readFileSync(join(codex, "skills", "engineering-work", "SKILL.md"), "utf8");
    assert.match(codexEngineering, /recommend exactly one playbook/i);
    assert.match(codexEngineering, /never grants Workflow authority or evidence/i);
    assert.match(codexEngineering, /Do not mutate or auto-apply/i);
    assert.doesNotMatch(codexEngineering, /model pool|gpt-|claude|grok/i);
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
    const shadow = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: codex,
        root_plan_id: "wp-adaptive-retry",
        root_plan: rootPlan,
        artifact_kind: "work-review",
        review_input: {
          schema: 1,
          kind: "review-input",
          assessment: "partially-achieved",
          recommended_action: "correct",
          assessment_summary: "Repository observation only.",
          snapshot_assessment: "incomplete",
          snapshot_summary: "Formal host binding is unavailable.",
          findings: [{
            key: "repository-observation",
            severity: "medium",
            objective_ids: ["OBJ-1"],
            check_ids: ["CHECK-1"],
            evidence: "A repository-level observation is available.",
            reasoning: "The observation remains non-authoritative.",
            resolution: "correct",
          }],
          missing_evidence: ["Protected Codex Review binding."],
        },
      },
    });
    assert.equal(shadow.isError, false, JSON.stringify(shadow.structuredContent));
    assert.equal(shadow.structuredContent.mode, "shadow");
    assert.equal(shadow.structuredContent.reason_code, "protected-review-binding-unavailable");
    assert.equal(shadow.structuredContent.persistence_scope, "none");
    assert.deepEqual(Object.keys(shadow.structuredContent.repository_findings[0]), ["key", "severity", "evidence", "reasoning"]);
    assert.equal(shadow.structuredContent.delivery_evidence_id, undefined);
    assert.equal(shadow.structuredContent.work_review_id, undefined);
    const mcp = JSON.parse(readFileSync(join(codex, ".mcp.json"), "utf8"));
    assert.deepEqual(Object.keys(mcp.mcpServers), ["geldmacher-workflow"]);
  } finally {
    await client?.close().catch(() => {});
    rmSync(output, { recursive: true, force: true });
    rmSync(pluginData, { recursive: true, force: true });
  }
});
