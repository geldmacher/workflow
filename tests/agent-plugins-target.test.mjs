import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildPluginTargets } from "../scripts/build-plugin-targets.mjs";
import { validateAgentPlugin } from "../scripts/validate-agent-plugin.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { workflowClient } from "./mcp-client.mjs";

const expectedSkills = [
  "accept-work",
  "correct-work",
  "engineering-work",
  "explain-work",
  "implement-work",
  "learn-from-work",
  "plan-work",
  "review-work",
  "work-status",
];
const expectedTools = [
  "workflow_artifact_context",
  "workflow_artifact_record",
  "workflow_closeout",
  "workflow_plan_preflight",
  "workflow_status",
];
const compatibility = "Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.";
const rootPlan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

function paths(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) return [path];
    return entry.isDirectory() ? paths(path) : [path];
  }).sort();
}

function digest(root) {
  const hash = createHash("sha256");
  for (const path of paths(root)) {
    const stat = lstatSync(path);
    hash.update(`${relative(root, path)}\0${stat.isSymbolicLink() ? `link:${readFileSync(path, "utf8")}` : createHash("sha256").update(readFileSync(path)).digest("hex")}\n`);
  }
  return hash.digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("Agent Plugins v1 target is deterministic, closed, and immediately discoverable", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-target-"));
  try {
    const first = buildPluginTargets(join(root, "first"));
    const second = buildPluginTargets(join(root, "second"));
    assert.equal(first.agentPlugins.hash, second.agentPlugins.hash);
    assert.equal(first.cursor.hash, second.cursor.hash);
    assert.equal(first.codex.hash, second.codex.hash);
    assert.match(first.agentPlugins.path, /agent-plugins\/geldmacher-workflow$/);

    const plugin = first.agentPlugins.path;
    const validated = validateAgentPlugin(plugin, { expectedVersion: first.version });
    assert.deepEqual(validated.skills, expectedSkills);
    assert.deepEqual(validated.servers, ["geldmacher-workflow"]);
    assert.equal(existsSync(join(plugin, "plugin.json")), true);
    assert.equal(existsSync(join(plugin, "mcp.json")), true);
    assert.equal(existsSync(join(plugin, "dist", "manual-workflow.mjs")), true);
    assert.equal(existsSync(join(plugin, ".cursor-plugin")), false);
    assert.equal(existsSync(join(plugin, ".codex-plugin")), false);
    assert.equal(existsSync(join(plugin, ".mcp.json")), false);
    const packagedReadme = readFileSync(join(plugin, "README.md"), "utf8");
    const documentedSkillCount = packagedReadme.match(/through ([0-9]+) Agent Skills/)?.[1];
    assert.equal(Number(documentedSkillCount), expectedSkills.length, "portable README skill count must match the generated Skill directories");
    for (const excluded of [".agents", ".build", ".cursor", ".git", "agents", "commands", "hooks", "node_modules", "src", "targets", "tests"]) {
      assert.equal(existsSync(join(plugin, excluded)), false, `${excluded} leaked into portable target`);
    }

    const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8"));
    assert.deepEqual(Object.keys(manifest).sort(), [
      "$schema",
      "author",
      "description",
      "homepage",
      "keywords",
      "license",
      "name",
      "repository",
      "version",
    ]);
    assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    assert.equal(manifest.version, first.version);

    const mcp = JSON.parse(readFileSync(join(plugin, "mcp.json"), "utf8"));
    assert.equal(mcp.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
    assert.deepEqual(Object.keys(mcp.mcpServers), ["geldmacher-workflow"]);
    assert.deepEqual(mcp.mcpServers["geldmacher-workflow"], {
      type: "stdio",
      command: "node",
      args: ["${PLUGIN_ROOT}/dist/workflow-mcp.mjs"],
      cwd: "${PLUGIN_ROOT}",
      env: { GELDMACHER_WORKFLOW_SHARED_ROOT: "${PLUGIN_DATA}/shared" },
    });

    for (const skill of expectedSkills) {
      const skillRoot = join(plugin, "skills", skill);
      assert.equal(existsSync(join(skillRoot, "SKILL.md")), true);
      const source = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
      assert.match(source, new RegExp(`^---\\nname: ${skill}\\n`));
      assert.equal(source.split(`compatibility: ${compatibility}`).length - 1, 1, `${skill} must declare exact runtime compatibility once`);
      assert.doesNotMatch(source, /workflow_[a-z_]+/, `${skill} must not call an MCP tool in the Manual path`);
      assert.doesNotMatch(source, /^(?:allowed-tools|license|metadata):/m, `${skill} must not predeclare optional permissions or metadata`);
      for (const match of source.matchAll(/\]\((references\/[^)]+)\)/g)) {
        assert.equal(existsSync(join(skillRoot, match[1])), true, `${skill} misses ${match[1]}`);
      }
    }
    const portableReview = readFileSync(join(plugin, "skills", "review-work", "SKILL.md"), "utf8");
    const portablePlan = readFileSync(join(plugin, "skills", "plan-work", "SKILL.md"), "utf8");
    const portableImplement = readFileSync(join(plugin, "skills", "implement-work", "SKILL.md"), "utf8");
    const portableCorrect = readFileSync(join(plugin, "skills", "correct-work", "SKILL.md"), "utf8");
    const portableEngineering = readFileSync(join(plugin, "skills", "engineering-work", "SKILL.md"), "utf8");
    const portableManual = readFileSync(join(plugin, "skills", "review-work", "references", "portable-manual.md"), "utf8");
    const sharedManualContract = readFileSync(join(plugin, "skills", "review-work", "references", "manual-workflow-contract.md"), "utf8");
    assert.match(portableReview, /repository-read-only/i);
    assert.match(portableReview, /project harness/i);
    assert.match(portableReview, /manual-workflow\.mjs build-review/i);
    assert.match(portableReview, /without MCP, adapters, MCP Roots, hooks, cache, or state/i);
    assert.match(portableReview, /presentation_locale.*active request is German.*otherwise `en`/i);
    assert.match(portableReview, /each returned artifact text exactly once, unchanged and unquoted, inside its own default-closed `<details>` block/i);
    assert.match(portableReview, /only `presentation\.next_action` through the fixed portable mapping/i);
    assert.doesNotMatch(portableReview, /Schema-5|auditor|model pool|planned command/i);
    assert.match(portablePlan, /State readiness, one concrete reason, and exactly one next action: invoke `implement-work` after approval/i);
    assert.doesNotMatch(portablePlan, /implementation(?: phase)? (?:is )?complete/i);
    assert.doesNotMatch(portablePlan, /fresh [^\n.]{0,40}review-work[^\n.]{0,20}pending/i);
    assert.doesNotMatch(portablePlan, /`review-work`/);
    assert.match(portableImplement, /project harness chooses all commands, tools, models/i);
    assert.match(portableImplement, /implementation phase is complete and fresh `review-work` is pending/i);
    assert.match(portableImplement, /Never claim that delivery or Workflow is complete/i);
    assert.match(portableCorrect, /correction phase is complete and fresh `review-work` is pending/i);
    assert.match(portableCorrect, /Never claim that delivery or Workflow is complete/i);
    assert.doesNotMatch(portableImplement, /exact standalone|planned director|one leading `rtk`/i);
    assert.match(portableManual, /shared Manual Workflow contract; that contract is the single mapping source/i);
    assert.doesNotMatch(portableManual, /\| Token \| Portable action \|/);
    for (const [token, action] of [
      ["implement-plan", "`implement-work`"],
      ["correct-plan", "revise the Root with `plan-work`"],
      ["create-schema-6-root", "`plan-work`"],
      ["create-root-plan", "`plan-work`"],
      ["review-root", "`review-work`"],
      ["correct", "`correct-work`"],
      ["accept-provisional", "`accept-work`"],
      ["replan", "`plan-work replan`"],
      ["retry-review", "`review-work`"],
      ["clarify", "answer the named decision"],
      ["provide-artifacts", "provide the exact chain"],
      ["none", "no further Workflow action"],
    ]) assert.equal(sharedManualContract.includes(`| \`${token}\` | ${action} |`), true, `${token} must retain its canonical portable action`);
    assert.match(portableEngineering, /recommend exactly one playbook/i);
    assert.match(portableEngineering, /never grants Workflow authority or evidence/i);
    assert.match(portableEngineering, /Never become sticky/i);
    assert.doesNotMatch(portableEngineering, /gpt-|claude|grok/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Agent Plugins validator rejects schema, transport, placeholder, skill, path, symlink, and secret violations", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-negative-"));
  try {
    const built = buildPluginTargets(join(root, "built"));
    const source = built.agentPlugins.path;
    const cases = [
      {
        name: "unknown manifest field",
        pattern: /additional properties|displayName/i,
        mutate(plugin) {
          const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8"));
          manifest.displayName = "Workflow";
          writeJson(join(plugin, "plugin.json"), manifest);
        },
      },
      {
        name: "version mismatch",
        pattern: /differs from package version/i,
        mutate(plugin) {
          const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8"));
          manifest.version = "9.9.9";
          writeJson(join(plugin, "plugin.json"), manifest);
        },
      },
      {
        name: "invalid transport",
        pattern: /mcp\.json|stdio/i,
        mutate(plugin) {
          const mcp = JSON.parse(readFileSync(join(plugin, "mcp.json"), "utf8"));
          mcp.mcpServers["geldmacher-workflow"].type = "websocket";
          writeJson(join(plugin, "mcp.json"), mcp);
        },
      },
      {
        name: "unsupported placeholder",
        pattern: /placeholder|args must target/i,
        mutate(plugin) {
          const mcp = JSON.parse(readFileSync(join(plugin, "mcp.json"), "utf8"));
          mcp.mcpServers["geldmacher-workflow"].args = ["${WORKSPACE_ROOT}/dist/workflow-mcp.mjs"];
          writeJson(join(plugin, "mcp.json"), mcp);
        },
      },
      {
        name: "path escape",
        pattern: /escapes|cwd must/i,
        mutate(plugin) {
          const mcp = JSON.parse(readFileSync(join(plugin, "mcp.json"), "utf8"));
          mcp.mcpServers["geldmacher-workflow"].cwd = "${PLUGIN_ROOT}/../escape";
          writeJson(join(plugin, "mcp.json"), mcp);
        },
      },
      {
        name: "skill identity",
        pattern: /skill name must match/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace("name: plan-work", "name: other-work"));
        },
      },
      {
        name: "oversized skill description",
        pattern: /description must be a non-empty string of at most 1024 characters/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(/^description:.*$/m, `description: '${"😀".repeat(1025)}'`));
        },
      },
      {
        name: "empty skill compatibility",
        pattern: /compatibility must be a non-empty string of at most 500 characters/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, "compatibility: ''"));
        },
      },
      {
        name: "oversized skill compatibility",
        pattern: /compatibility must be a non-empty string of at most 500 characters/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: '${"😀".repeat(501)}'`));
        },
      },
      {
        name: "non-string skill compatibility",
        pattern: /compatibility must be a non-empty string of at most 500 characters/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, "compatibility:\n  client: agent-plugins"));
        },
      },
      {
        name: "non-string skill license",
        pattern: /license must be a string/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\nlicense:\n  - MIT`));
        },
      },
      {
        name: "non-string skill metadata value",
        pattern: /metadata must be a string-to-string mapping/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\nmetadata:\n  version: 1`));
        },
      },
      {
        name: "non-string skill metadata key",
        pattern: /metadata must be a string-to-string mapping/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\nmetadata:\n  1: version`));
        },
      },
      ...[
        ["sequence", "metadata:\n  - item"],
        ["scalar", "metadata: value"],
        ["null", "metadata: null"],
      ].map(([shape, metadata]) => ({
        name: `${shape} skill metadata`,
        pattern: /metadata must be a string-to-string mapping/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\n${metadata}`));
        },
      })),
      {
        name: "non-string skill allowed-tools",
        pattern: /allowed-tools must be a non-empty string/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\nallowed-tools:\n  - Read`));
        },
      },
      {
        name: "empty skill allowed-tools",
        pattern: /allowed-tools must be a non-empty string/i,
        mutate(plugin) {
          const path = join(plugin, "skills", "plan-work", "SKILL.md");
          writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, `compatibility: ${compatibility}\nallowed-tools: ''`));
        },
      },
      {
        name: "missing skill reference",
        pattern: /missing local skill reference/i,
        mutate(plugin) {
          rmSync(join(plugin, "skills", "plan-work", "references", "design-contract.md"));
        },
      },
      {
        name: "symlink",
        pattern: /symlink/i,
        mutate(plugin) {
          symlinkSync("README.md", join(plugin, "README-link"));
        },
      },
      {
        name: "embedded secret",
        pattern: /secret material/i,
        mutate(plugin) {
          appendFileSync(join(plugin, "README.md"), `\n${"ghp_"}${"abcdefghijklmnopqrstuvwxyz123456"}\n`);
        },
      },
    ];

    for (const [index, item] of cases.entries()) {
      const plugin = join(root, `case-${index}`);
      cpSync(source, plugin, { recursive: true });
      item.mutate(plugin);
      assert.throws(
        () => validateAgentPlugin(plugin, { expectedVersion: built.version }),
        item.pattern,
        item.name,
      );
    }

    const descriptionBoundaryPlugin = join(root, "case-description-boundary");
    cpSync(source, descriptionBoundaryPlugin, { recursive: true });
    const descriptionBoundaryPath = join(descriptionBoundaryPlugin, "skills", "plan-work", "SKILL.md");
    writeFileSync(
      descriptionBoundaryPath,
      readFileSync(descriptionBoundaryPath, "utf8").replace(/^description:.*$/m, `description: '${"😀".repeat(1024)}'`),
    );
    assert.doesNotThrow(
      () => validateAgentPlugin(descriptionBoundaryPlugin, { expectedVersion: built.version }),
      "1024 Unicode description code points",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Agent Plugins validator accepts every supported optional field and Unicode compatibility boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-frontmatter-"));
  try {
    const built = buildPluginTargets(join(root, "built"));
    const source = built.agentPlugins.path;
    const cases = [
      {
        name: "string metadata and 500 Unicode code points",
        addition: `compatibility: '${"😀".repeat(500)}'\nlicense: Apache-2.0\nallowed-tools: Read Write\nmetadata:\n  owner: workflow`,
      },
      {
        name: "empty metadata mapping",
        addition: `compatibility: ${compatibility}\nmetadata: {}`,
      },
    ];
    for (const [index, item] of cases.entries()) {
      const plugin = join(root, `case-${index}`);
      cpSync(source, plugin, { recursive: true });
      const path = join(plugin, "skills", "plan-work", "SKILL.md");
      writeFileSync(path, readFileSync(path, "utf8").replace(`compatibility: ${compatibility}`, item.addition));
      assert.doesNotThrow(
        () => validateAgentPlugin(plugin, { expectedVersion: built.version }),
        item.name,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("portable MCP expands standard variables, exposes five tools, and writes only below PLUGIN_DATA", async () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-mcp-"));
  const data = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-data-"));
  const workspace = mkdtempSync(join(tmpdir(), "workflow-agent-plugin-workspace-"));
  let client;
  try {
    const built = buildPluginTargets(join(root, "built"));
    const plugin = built.agentPlugins.path;
    const before = digest(plugin);
    const mcp = JSON.parse(readFileSync(join(plugin, "mcp.json"), "utf8"));
    const server = mcp.mcpServers["geldmacher-workflow"];
    const expand = (value) => value
      .replaceAll("${PLUGIN_ROOT}", plugin)
      .replaceAll("${PLUGIN_DATA}", data);
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args.map(expand),
      cwd: expand(server.cwd),
      env: {
        PATH: process.env.PATH ?? "",
        HOME: data,
        PLUGIN_ROOT: plugin,
        PLUGIN_DATA: data,
        ...Object.fromEntries(Object.entries(server.env).map(([key, value]) => [key, expand(value)])),
      },
      stderr: "pipe",
    });
    client = workflowClient("workflow-agent-plugin-target-test", [workspace]);
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), expectedTools);

    const preflight = await client.callTool({
      name: "workflow_plan_preflight",
      arguments: { root_plan: rootPlan },
    });
    assert.equal(preflight.isError, false);
    assert.equal(preflight.structuredContent.feasible, true);
    assert.equal(preflight.structuredContent.root_plan_id, "wp-adaptive-retry");
    assert.equal(preflight.structuredContent.presentation.client_host, "portable");

    const shadow = await client.callTool({
      name: "workflow_closeout",
      arguments: {
        workspace_root: workspace,
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
          missing_evidence: ["Protected portable Review binding."],
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

    const recorded = await client.callTool({
      name: "workflow_artifact_record",
      arguments: {
        workspace_root: workspace,
        artifacts: [{ label: "approved-root", text: rootPlan }],
      },
    });
    assert.equal(recorded.isError, false);
    assert.equal(paths(data).length > 0, true);
    assert.equal(digest(plugin), before);
  } finally {
    await client?.close().catch(() => {});
    rmSync(root, { recursive: true, force: true });
    rmSync(data, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  }
});
