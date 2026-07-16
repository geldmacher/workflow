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
  const manifest = { name: "fixture-plugin", ...(explicitPaths ? { commands: "./commands/", agents: "./agents/", skills: "./skills/" } : {}) };
  await write(join(root, ".cursor-plugin", "plugin.json"), JSON.stringify(manifest));
  for (const name of ["correct-work", "learn-from-work", "plan-work", "review-work"]) {
    await write(join(root, "commands", `${name}.md`), `---\nname: ${name}\ndescription: Command.\n---\n`);
  }
  for (const name of ["delivery-auditor", "risk-auditor", "work-plan-auditor"]) {
    await write(join(root, "agents", `${name}.md`), `---\nname: ${name}\ndescription: Audit.\nmodel: inherit\n---\n`);
  }
  for (const name of ["work-execution", "work-learning", "work-planning", "work-review"]) {
    await write(join(root, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Skill.\n---\n`);
  }
  for (const name of ["artifact-protocol", "correction-contract", "delivery-evidence-contract", "delivery-evidence-output-contract", "executable-contract", "learning-contract", "plan-container-contract", "review-contract"]) {
    await write(join(root, "references", `${name}.md`), `# ${name}\n`);
  }
  await write(join(root, "schemas", "cursor-plan-wrapper.schema.json"), JSON.stringify({
    $id: "urn:geldmacher:cursor-plan-wrapper:1",
    type: "object",
    additionalProperties: true,
    required: ["todos", "isProject"],
  }));
  for (const name of ["delivery-evidence", "work-plan", "work-review"]) {
    await write(join(root, "schemas", "artifacts", `${name}.schema.json`), JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: `urn:geldmacher:cursor-artifact:${name}:2`, additionalProperties: true, "x-markdown-sections": ["Section"],
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
    schema.$id = "urn:geldmacher:cursor-artifact:wrong:2";
    schema.$schema = "https://json-schema.org/draft/2020-12/schema";
    await writeFile(path, JSON.stringify(schema));
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /schema id must equal urn:geldmacher:cursor-artifact:work-plan:2/);
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

test("rejects malformed frontmatter and non-inherited agents", async () => {
  await withFixture(false, async (root) => {
    await writeFile(join(root, "commands", "plan-work.md"), "---\nname: [\n---\n");
    await writeFile(join(root, "agents", "delivery-auditor.md"), "---\nname: delivery-auditor\ndescription: Audit.\n---\n");
    const failures = validatePlugin(root).join("\n");
    assert.match(failures, /invalid YAML/);
    assert.match(failures, /model must be inherit/);
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
