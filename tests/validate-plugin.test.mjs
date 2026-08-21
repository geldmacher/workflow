import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { validatePlugin } from "../scripts/validate-plugin.mjs";

async function write(path, contents) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, contents);
}

async function createFixture(explicitPaths) {
  const root = await mkdtemp(join(tmpdir(), "workflow-plugin-"));
  const manifest = { name: "fixture-plugin", hooks: "./hooks/hooks.json", ...(explicitPaths ? { commands: "./commands/", agents: "./agents/", skills: "./skills/" } : {}) };
  await write(join(root, ".cursor-plugin", "plugin.json"), JSON.stringify(manifest));
  const command = "node \"${CURSOR_PLUGIN_ROOT}/hooks/subagent-guard.mjs\"";
  await write(join(root, "hooks", "hooks.json"), JSON.stringify({
    version: 1,
    hooks: {
      sessionStart: [{ type: "command", command, failClosed: false }],
      beforeSubmitPrompt: [{ type: "command", command, failClosed: false }],
      preToolUse: [{ type: "command", command, matcher: "CreatePlan|Write|Edit|Delete|Shell|Task|ApplyPatch|DeleteFile|StrReplace|EditNotebook|MCP:workflow_closeout", failClosed: false }],
      subagentStart: [{ type: "command", command, failClosed: false }],
      subagentStop: [{ type: "command", command, failClosed: false }],
      postToolUse: [{ type: "command", command, matcher: "Task|CreatePlan|MCP:workflow_closeout", failClosed: false }],
    },
  }));
  await write(join(root, "hooks", "closeout-guard.mjs"), "process.stdout.write('{}');\n");
  await write(join(root, "hooks", "manual-subagent-policy.mjs"), "export const placeholder = true;\n");
  await write(join(root, "hooks", "model-inheritance-state.mjs"), "export const placeholder = true;\n");
  await write(join(root, "hooks", "native-review-receipt.mjs"), "export const placeholder = true;\n");
  await write(join(root, "hooks", "native-task-review-context.mjs"), "export const placeholder = true;\n");
  await write(join(root, "hooks", "plan-integrity-guard.mjs"), "process.stdout.write('{}');\n");
  await write(join(root, "hooks", "subagent-guard.mjs"), "process.stdout.write('{}');\n");
  for (const name of ["accept-work", "auto-work", "correct-work", "explain-work", "learn-from-work", "plan-work", "review-work", "work-control", "work-models", "work-status", "work-verification", "work-watch"]) {
    await write(join(root, "commands", `${name}.md`), `---\nname: ${name}\ndescription: Command.\n---\n`);
  }
  for (const name of ["delivery-auditor", "risk-auditor", "work-design-auditor", "work-explainer", "work-plan-auditor"]) {
    await write(join(root, "agents", `${name}.md`), `---\nname: ${name}\ndescription: Audit.\nmodel: inherit\nreadonly: true\n---\n`);
  }
  for (const name of ["work-automation", "work-execution", "work-explanation", "work-learning", "work-planning", "work-review"]) {
    await write(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Skill.\n---\n`);
  }
  for (const name of ["artifact-protocol", "automation-contract", "automation-preparation-contract", "closeout-contract", "correction-contract", "delivery-evidence-contract", "delivery-evidence-output-contract", "design-contract", "executable-contract", "explanation-contract", "host-approval-contract", "learning-contract", "manual-attestation-contract", "manual-subagent-policy", "manual-workflow-contract", "model-routing-contract", "plan-container-contract", "review-contract", "state-contract", "verification-profile-contract", "work-review-input-contract"]) {
    await write(join(root, "references", `${name}.md`), `# ${name}\n`);
  }
  await write(join(root, "schemas", "cursor-plan-wrapper.schema.json"), JSON.stringify({
    $id: "urn:geldmacher:cursor-plan-wrapper:1",
    type: "object",
    additionalProperties: true,
    required: ["todos", "isProject"],
  }));
  await write(join(root, "schemas", "host-preferences.schema.json"), JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "urn:geldmacher:workflow-host-preferences:1",
    type: "object",
    additionalProperties: false,
    required: ["schema", "tool_approval"],
    properties: {
      schema: { const: 1 },
      tool_approval: { type: "string", enum: ["strict", "allowlisted"] },
      extensions: { type: "object" },
    },
  }));
  for (const name of ["delivery-evidence", "work-plan", "work-review"]) {
    await write(join(root, "schemas", "artifacts", `${name}.schema.json`), JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: `urn:geldmacher:cursor-artifact:${name}:5`,
      additionalProperties: false,
      properties: { schema: { const: 5 }, extensions: { type: "object", additionalProperties: true } },
      "x-markdown-sections": ["Section"],
    }));
  }
  return root;
}

async function withFixture(explicit, run) {
  const root = await createFixture(explicit);
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("accepts default and explicit component discovery", async () => {
  for (const explicit of [false, true]) await withFixture(explicit, async (root) => assert.deepEqual(validatePlugin(root), []));
});

test("requires the exact bundled fail-quiet activation hook surface", async () => {
  await withFixture(false, async (root) => {
    const path = join(root, "hooks", "hooks.json");
    const config = JSON.parse(await readFile(path, "utf8"));
    config.hooks.subagentStart[0].command = "npx remote-hook@latest";
    config.hooks.subagentStart[0].failClosed = true;
    await writeFile(path, JSON.stringify(config));
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /bundled Node guard/);
    assert.match(failures, /failClosed false/);
    assert.match(failures, /must not install or resolve runtime dependencies/);
  });
});

test("requires the scoped fail-quiet CreatePlan guard", async () => {
  await withFixture(false, async (root) => {
    const path = join(root, "hooks", "hooks.json");
    const config = JSON.parse(await readFile(path, "utf8"));
    config.hooks.preToolUse[0].matcher = "*";
    config.hooks.preToolUse[0].failClosed = true;
    await writeFile(path, JSON.stringify(config));
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /must match CreatePlan\|Write/);
    assert.match(failures, /failClosed false/);
  });
});

test("validates the private Marketplace entry and source binding when present", async () => {
  await withFixture(false, async (root) => {
    const path = join(root, ".cursor-plugin", "marketplace.json");
    await write(path, JSON.stringify({ name: "fixture-rc", plugins: [{ name: "fixture-plugin", source: "." }] }));
    assert.deepEqual(validatePlugin(root), []);
    await writeFile(path, JSON.stringify({ name: "fixture-rc", plugins: [{ name: "other-plugin", source: "latest" }] }));
    assert.match(validatePlugin(root).join("\n"), /must expose exactly the current plugin with source/);
  });
});

test("accepts explicit component globs only when they match the full public surface", async () => {
  await withFixture(true, async (root) => {
    const path = join(root, ".cursor-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.commands = "./commands/*.md";
    manifest.agents = "./agents/*.md";
    manifest.skills = "./skills/*/SKILL.md";
    await writeFile(path, JSON.stringify(manifest));
    assert.deepEqual(validatePlugin(root), []);

    manifest.commands = "./commands/*.{md,txt}";
    manifest.agents = "./agents/[a-z]*.md";
    await writeFile(path, JSON.stringify(manifest));
    assert.deepEqual(validatePlugin(root), []);
  });
});

test("artifact schema metadata is exact", async () => {
  await withFixture(false, async (root) => {
    const path = join(root, "schemas", "artifacts", "work-plan.schema.json");
    const schema = JSON.parse(await readFile(path, "utf8"));
    schema.$id = "urn:geldmacher:cursor-artifact:wrong:5";
    schema.$schema = "https://json-schema.org/draft/2020-12/schema";
    await writeFile(path, JSON.stringify(schema));
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /schema id must equal urn:geldmacher:cursor-artifact:work-plan:5/);
    assert.match(failures, /\$schema must be JSON Schema draft-07/);
  });
});

test("rejects empty and incomplete explicit discovery patterns", async () => {
  await withFixture(true, async (root) => {
    const path = join(root, ".cursor-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.commands = "./commands/does-not-exist-*.md";
    await writeFile(path, JSON.stringify(manifest));
    const empty = validatePlugin(root).join("\n");
    assert.match(empty, /declared path has no component matches/);
    assert.match(empty, /explicit paths do not cover the public surface/);

    manifest.commands = "./commands/plan-work.md";
    await writeFile(path, JSON.stringify(manifest));
    assert.match(validatePlugin(root).join("\n"), /explicit paths do not cover the public surface/);
  });
});

test("rejects unknown manifest properties", async () => {
  await withFixture(false, async (root) => {
    const path = join(root, ".cursor-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.unknown = true;
    await writeFile(path, JSON.stringify(manifest));
    assert.match(validatePlugin(root).join("\n"), /additional properties.*unknown/i);
  });
});

test("rejects component path traversal", async () => {
  await withFixture(true, async (root) => {
    const path = join(root, ".cursor-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.commands = "../commands";
    await writeFile(path, JSON.stringify(manifest));
    assert.match(validatePlugin(root).join("\n"), /escapes plugin root/);
  });
});

test("rejects malformed frontmatter and non-inherited or writable agents", async () => {
  await withFixture(false, async (root) => {
    await writeFile(join(root, "commands", "plan-work.md"), "---\nname: [\n---\n");
    await writeFile(join(root, "agents", "delivery-auditor.md"), "---\nname: delivery-auditor\ndescription: Audit.\n---\n");
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /invalid YAML/);
    assert.match(failures, /model must be inherit/);
    assert.match(failures, /readonly must be true/);
  });
});

test("rejects components outside the public surface", async () => {
  await withFixture(false, async (root) => {
    await write(join(root, "commands", "extra.md"), "---\nname: extra\ndescription: Extra.\n---\n");
    assert.match(validatePlugin(root).join("\n"), /commands: expected/);
  });
});

test("scans progressive references for foreign commands and component paths", async () => {
  await withFixture(false, async (root) => {
    await writeFile(
      join(root, "references", "artifact-protocol.md"),
      "Run /budget-efficiency and read skills/context-optimization/SKILL.md.\n",
    );
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /foreign command/);
    assert.match(failures, /foreign component path/);
  });
});

test("foreign isolation is case-insensitive and covers command file paths", async () => {
  await withFixture(false, async (root) => {
    await writeFile(
      join(root, "references", "artifact-protocol.md"),
      "Geldmacher-Efficiency commands/optimize-context.md commands/setup-rtk.txt\n",
    );
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /foreign product name/);
    assert.match(failures, /foreign component path/);
  });
});
