import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { enumerateReleaseSurface } from "../src/controller/release-surface.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const root = defaultRoot;
const canonical = join(root, "AGENTS.md");

test("canonical north-star guidance is the root AGENTS.md shared by Cursor and Codex", () => {
  assert.equal(existsSync(canonical), true);
  assert.equal(lstatSync(canonical).isFile(), true);
  assert.equal(lstatSync(canonical).isSymbolicLink(), false);
  const text = readFileSync(canonical, "utf8");
  assert.match(text, /^# Agentic delivery north star/m);
  assert.match(text, /Preserve human authority/);
  assert.match(text, /Evidence stays honest/);
  assert.match(text, /Repository-only finish line/);
  assert.match(text, /## Manual — default path/);
  assert.match(text, /## Supervised/);
  assert.match(text, /Without proof → Shadow Mode/);
  assert.match(text, /## Autonomous/);
  assert.match(text, /exact Qualification Key/);
  assert.match(text, /Shared kernel/);
  assert.match(text, /## Change guardrails/);
  assert.ok(text.split(/\r?\n/).length < 50);
  assert.doesNotMatch(text, /\.\.\/\.\.\//);
  assert.equal(existsSync(join(root, ".agents", "AGENTS.md")), false);
  assert.equal(existsSync(join(root, ".cursor", "rules", "agentic-delivery-north-star.mdc")), false);
});

test("north-star guidance stays outside shipped package and release surfaces", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const releaseSurface = JSON.parse(readFileSync(join(root, "release-surface.json"), "utf8"));
  const pluginManifest = JSON.parse(readFileSync(join(root, ".cursor-plugin", "plugin.json"), "utf8"));
  const forbidden = ["AGENTS.md", ".cursor/rules", ".cursor"];
  assert.match(readme, /Repository-local guidance lives in `AGENTS\.md` and does not ship with the plugin\./);
  for (const path of forbidden) {
    assert.equal(packageJson.files.includes(path), false, `package.json must not ship ${path}`);
    assert.equal(releaseSurface.runtime_paths.includes(path), false, `runtime_paths must not include ${path}`);
    assert.equal(releaseSurface.package_extras.includes(path), false, `package_extras must not include ${path}`);
  }
  assert.equal("rules" in pluginManifest, false);
  const packagePaths = new Set(enumerateReleaseSurface(root, "package_paths").map((entry) => entry.relative_path));
  assert.equal(packagePaths.has("AGENTS.md"), false);
});
