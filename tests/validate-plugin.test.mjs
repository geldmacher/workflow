import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { validatePlugin } from "../scripts/validate-plugin.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

async function withCursorTarget(run) {
  const parent = await mkdtemp(join(tmpdir(), "workflow-v6-plugin-"));
  const target = join(parent, "geldmacher-workflow");
  await cp(join(defaultRoot, ".build", "plugins", "cursor", "geldmacher-workflow"), target, { recursive: true });
  try { await run(target); } finally { await rm(parent, { recursive: true, force: true }); }
}

test("canonical source and generated Cursor target validate as Workflow 6", async () => {
  assert.deepEqual(validatePlugin(defaultRoot), []);
  await withCursorTarget(async (target) => assert.deepEqual(validatePlugin(target), []));
});

test("validator requires the exact minimal fail-open hook surface", async () => {
  await withCursorTarget(async (target) => {
    const path = join(target, "hooks", "hooks.json");
    const hooks = JSON.parse(await readFile(path, "utf8"));
    hooks.hooks.preToolUse[1].matcher = "Shell|MCP:workflow_closeout";
    hooks.hooks.preToolUse[1].failClosed = true;
    await writeFile(path, JSON.stringify(hooks));
    const failures = validatePlugin(target).join("\n");
    assert.match(failures, /must match MCP:workflow_closeout/);
    assert.match(failures, /failClosed false/);
  });
});

test("validator rejects reintroduced execution-engine commands", async () => {
  await withCursorTarget(async (target) => {
    const manifestPath = join(target, ".cursor-plugin", "plugin.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.commands = "./commands/";
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(join(target, "commands", "work-models.md"), "---\nname: work-models\ndescription: obsolete\n---\n");
    const failures = validatePlugin(target).join("\n");
    assert.match(failures, /commands: expected/);
    assert.match(failures, /work-models/);
  });
});

test("artifact schema metadata remains exact and closed", async () => {
  await withCursorTarget(async (target) => {
    const path = join(target, "schemas", "artifacts", "work-plan-6.schema.json");
    const schema = JSON.parse(await readFile(path, "utf8"));
    schema.additionalProperties = true;
    await writeFile(path, JSON.stringify(schema));
    const failures = validatePlugin(target).join("\n");
    assert.match(failures, /additionalProperties must be false/);
  });
});
