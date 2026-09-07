import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { buildPluginTargets, contentDigest, defaultRoot, files, hostInstruction, hostSkills } from "../scripts/build-plugin-targets.mjs";
import { parseFrontmatter, validatePlugin, validateTarget } from "../scripts/validate-plugin.mjs";
import { checkMarkdownLinks } from "../scripts/check-markdown-links.mjs";
import { measureContext } from "../scripts/measure-context.mjs";

const temp = () => mkdtempSync(join(tmpdir(), "workflow-package-test-"));
function sourceFixture(parent) {
  const root = join(parent, "repository");
  cpSync(defaultRoot, root, { recursive: true, filter(path) {
    const first = relative(defaultRoot, path).split(/[\\/]/)[0];
    return ![".git", ".build", ".tests", "node_modules"].includes(first);
  } });
  return root;
}

test("all host packages are reproducible, closed, and valid without a runtime", () => {
  const parent = temp();
  try {
    assert.deepEqual(validatePlugin(), []);
    const first = buildPluginTargets(join(parent, "one"));
    const second = buildPluginTargets(join(parent, "two"));
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      assert.equal(first[host].hash, second[host].hash);
      assert.deepEqual(validateTarget(first[host].path, host, first.version), []);
      assert.deepEqual(checkMarkdownLinks(first[host].path), []);
      const entries = files(first[host].path).map((path) => relative(first[host].path, path));
      assert.ok(!entries.some((path) => /\.(?:[cm]?js|sh|py)$/.test(path)));
      assert.ok(!entries.some((path) => /^(?:dist|hooks|src|scripts|schemas)[\\/]/.test(path)));
      assert.equal(existsSync(join(first[host].path, "skills/implement-work")), host === "agent-plugins");
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("every packaged skill preserves the shared content and only adds its host instruction", () => {
  const parent = temp();
  try {
    const built = buildPluginTargets(parent);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      for (const skill of hostSkills(host)) {
        const source = readFileSync(join(defaultRoot, "skills", skill, "SKILL.md"), "utf8");
        const suffix = hostInstruction(host, skill);
        const expected = suffix ? `${source.trimEnd()}\n\n${suffix}\n` : source;
        assert.equal(readFileSync(join(built[host].path, "skills", skill, "SKILL.md"), "utf8"), expected);
      }
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("rebuild removes obsolete package files rather than overlaying old contents", () => {
  const parent = temp();
  try {
    const first = buildPluginTargets(parent);
    const baseline = first.cursor.hash;
    const obsolete = join(first.cursor.path, "hooks");
    mkdirSync(obsolete); writeFileSync(join(obsolete, "old.mjs"), "old runtime");
    assert.notEqual(contentDigest(first.cursor.path), baseline);
    const next = buildPluginTargets(parent);
    assert.equal(next.cursor.hash, baseline);
    assert.equal(existsSync(obsolete), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("build rejects source replacement, unrelated output, and symlink escape", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const original = readFileSync(join(root, "skills/plan-work/SKILL.md"));
    assert.throws(() => buildPluginTargets(root, root), /source directory/);
    assert.throws(() => buildPluginTargets(join(root, "skills"), root), /under .build/);
    assert.deepEqual(readFileSync(join(root, "skills/plan-work/SKILL.md")), original);
    const outside = join(parent, "outside"); mkdirSync(outside);
    writeFileSync(join(outside, "keep.txt"), "keep");
    const link = join(parent, "link"); symlinkSync(outside, link);
    assert.throws(() => buildPluginTargets(join(link, "output"), root), /symlink/);
    assert.throws(() => buildPluginTargets(outside, root), /unrelated files/);
    assert.equal(readFileSync(join(outside, "keep.txt"), "utf8"), "keep");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("invalid sources do not remove the previous generated package", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const destination = join(parent, "output");
    const first = buildPluginTargets(destination, root);
    const manifestPath = join(root, "targets/codex/.codex-plugin/plugin.json");
    const original = readFileSync(manifestPath, "utf8");
    writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(original), version: "9999.0.0" }));
    assert.throws(() => buildPluginTargets(destination, root), /version/);
    assert.equal(contentDigest(first.cursor.path), first.cursor.hash);
    writeFileSync(manifestPath, original);
    symlinkSync(join(root, "README.md"), join(root, "references/link.md"));
    assert.throws(() => buildPluginTargets(destination, root), /symlink/);
    assert.equal(contentDigest(first.cursor.path), first.cursor.hash);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("validation rejects runtime registration, missing links, and malformed discovery metadata", () => {
  const parent = temp();
  try {
    const built = buildPluginTargets(parent);
    const root = built.codex.path;
    const manifestPath = join(root, ".codex-plugin/plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.mcpServers = "./service.json";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.ok(validateTarget(root, "codex", built.version).some((message) => /runtime registration/.test(message)));
    const skill = join(root, "skills/plan-work/SKILL.md");
    writeFileSync(skill, "---\nname: plan-work\nname: duplicate\ndescription: x\n---\n[Missing](missing.md)\n");
    const errors = []; parseFrontmatter(skill, errors);
    assert.ok(errors.some((message) => /frontmatter/.test(message)));
    assert.ok(checkMarkdownLinks(root).some((message) => /missing link target/.test(message)));
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("context decreases in aggregate without increasing existing phase limits", () => {
  const measurement = measureContext();
  assert.deepEqual(measurement.failures, []);
  for (const target of Object.values(measurement.targets)) assert.ok(target.total < measurement.previousTotal);
});
