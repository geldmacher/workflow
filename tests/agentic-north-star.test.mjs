import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { enumerateReleaseSurface } from "../src/controller/release-surface.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const canonical = join(defaultRoot, "AGENTS.md");

test("canonical Northstar defines the lifecycle-kernel and harness boundary", () => {
  assert.equal(existsSync(canonical), true);
  assert.equal(lstatSync(canonical).isFile(), true);
  assert.equal(lstatSync(canonical).isSymbolicLink(), false);
  const text = readFileSync(canonical, "utf8");
  assert.match(text, /^# Workflow north star/m);
  assert.match(text, /Plan → Implement → Review → Correct → Review/);
  assert.match(text, /## Workflow owns/);
  assert.match(text, /## The project harness owns/);
  assert.match(text, /must never parse, classify, allowlist, rewrite, compare, or execute/);
  assert.match(text, /Missing attestation caps proof at supported/);
  assert.match(text, /Ordinary Cursor and Codex prompts/);
  assert.match(text, /Repository build, test, and deployment scripts are this repository's own development harness/);
  assert.equal(existsSync(join(defaultRoot, ".agents", "AGENTS.md")), false);
  assert.equal(existsSync(join(defaultRoot, ".cursor", "rules", "agentic-delivery-north-star.mdc")), false);
});

test("the contributor Northstar is referenced but not shipped as runtime policy", () => {
  const readme = readFileSync(join(defaultRoot, "README.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(defaultRoot, "package.json"), "utf8"));
  const releaseSurface = JSON.parse(readFileSync(join(defaultRoot, "release-surface.json"), "utf8"));
  const pluginManifest = JSON.parse(readFileSync(join(defaultRoot, ".cursor-plugin", "plugin.json"), "utf8"));
  assert.match(readme, /central contributor Northstar is the root `AGENTS\.md`/);
  for (const path of ["AGENTS.md", ".cursor/rules", ".cursor"]) {
    assert.equal(packageJson.files.includes(path), false);
    assert.equal(releaseSurface.runtime_paths.includes(path), false);
    assert.equal(releaseSurface.package_extras.includes(path), false);
  }
  assert.equal("rules" in pluginManifest, false);
  const packagePaths = new Set(enumerateReleaseSurface(defaultRoot, "package_paths").map((entry) => entry.relative_path));
  assert.equal(packagePaths.has("AGENTS.md"), false);
});
