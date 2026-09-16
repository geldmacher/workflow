import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { buildPluginTargets, contentDigest, defaultRoot, files, hostInstruction, hostSkills } from "../scripts/build-plugin-targets.mjs";
import { parseFrontmatter, validatePlugin, validateTarget } from "../scripts/validate-plugin.mjs";
import { checkMarkdownLinks } from "../scripts/check-markdown-links.mjs";

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

test("phase handoffs name skills available in the receiving host package", () => {
  const parent = temp();
  try {
    const built = buildPluginTargets(parent);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      const pairs = [["plan-work", "review-work"], ["correct-work", "review-work"], ["review-work", "correct-work"], ["review-work", "learn-from-work"], ["verification-work", "review-work"]];
      if (host === "agent-plugins") pairs.push(["plan-work", "implement-work"], ["implement-work", "review-work"]);
      for (const [source, destination] of pairs) {
        const prefix = host === "cursor" ? "/" : host === "codex" ? "$" : "";
        assert.ok(hostInstruction(host, source).includes(`${prefix}${destination}`), `${host}: ${source} -> ${destination}`);
        assert.ok(existsSync(join(built[host].path, "skills", destination, "SKILL.md")));
        if (host === "cursor") assert.ok(existsSync(join(built[host].path, "commands", `${destination}.md`)));
      }
      if (host !== "agent-plugins") {
        assert.ok(hostInstruction(host, "plan-work").includes("Implement Plan"));
        assert.ok(!hostInstruction(host, "plan-work").includes("implement-work"));
      }
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("methodology provenance stays in the repository while license notices and package docs remain intact", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const provenance = "docs/methodology-sources.md";
    assert.match(readFileSync(join(root, provenance), "utf8"), /pstack[\s\S]*71ed0d1076fec562c1b74ee353121a8d00f75382/);
    const notice = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
    const license = notice.slice(notice.indexOf("MIT License\n"));
    assert.equal(createHash("sha256").update(license).digest("hex"), "bc957ca6bee02792566a1a028d105e02e247c6e77cf057061674273da77b200e");
    writeFileSync(join(root, "docs/future-methodology.md"), "# Repository methodology\n\nPonytail\n");
    const built = buildPluginTargets(join(parent, "packages"), root);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      const packageRoot = built[host].path;
      assert.equal(existsSync(join(packageRoot, provenance)), false);
      assert.equal(existsSync(join(packageRoot, "docs/future-methodology.md")), false);
      assert.equal(readFileSync(join(packageRoot, "THIRD_PARTY_NOTICES.md"), "utf8"), notice);
      for (const name of ["auto-work.md", "project-improvement.md", "behavior-validation.md", "installation.md", "manual-workflow.md", "release-checklist.md"]) {
        assert.deepEqual(readFileSync(join(packageRoot, "docs", name)), readFileSync(join(root, "docs", name)));
      }
      for (const path of files(packageRoot).filter((path) => /\.mdc?$/.test(path))) {
        if (relative(packageRoot, path) === "THIRD_PARTY_NOTICES.md") continue;
        assert.doesNotMatch(readFileSync(path, "utf8"), /pstack|ponytail|methodology[\s_-]+sources|source influence|adapted from/i, path);
      }
      assert.deepEqual(checkMarkdownLinks(packageRoot), []);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("playbook references are complete and nested skill references survive every host build", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const referencePath = "skills/engineering-work/references";
    const playbooks = ["investigation", "runtime-forensics", "trace-forensics", "bug-fix", "feature", "refactoring", "performance", "hillclimb", "prototype", "visual-parity", "skill-authoring", "evaluation", "session-pickup", "pause-safely"];
    assert.deepEqual(files(join(root, referencePath)).map((path) => relative(join(root, referencePath), path)).sort(), [...playbooks.map((id) => `${id}.md`), "catalog.md"].sort());
    const catalog = readFileSync(join(root, referencePath, "catalog.md"), "utf8");
    for (const id of playbooks) assert.ok(catalog.includes(`[${id}](./${id}.md)`), id);
    for (const skill of ["engineering-work", "verification-work", "implement-work"]) {
      const nested = join(root, "skills", skill, "references", "nested");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, "example.md"), "# Nested reference\n\n[Skill](../../SKILL.md)\n");
    }
    const built = buildPluginTargets(join(parent, "packages"), root);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      for (const skill of hostSkills(host)) {
        const source = join(root, "skills", skill, "references");
        if (!existsSync(source)) continue;
        const destination = join(built[host].path, "skills", skill, "references");
        assert.equal(contentDigest(destination), contentDigest(source));
      }
      assert.equal(existsSync(join(built[host].path, "skills/implement-work")), host === "agent-plugins");
      assert.deepEqual(validateTarget(built[host].path, host, built.version, root), []);
      assert.deepEqual(checkMarkdownLinks(built[host].path), []);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("nested skill reference symlinks are rejected before replacing existing packages", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const destination = join(parent, "packages");
    const built = buildPluginTargets(destination, root);
    const nested = join(root, "skills/engineering-work/references/nested");
    mkdirSync(nested);
    const link = join(nested, "link");
    for (const target of [join(root, "README.md"), join(root, "references")]) {
      symlinkSync(target, link);
      assert.throws(() => buildPluginTargets(destination, root), /symlink/);
      for (const host of ["cursor", "codex", "agent-plugins"]) assert.equal(contentDigest(built[host].path), built[host].hash);
      rmSync(link);
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
    const oldReferences = ["engineering-playbooks.md", "engineering-diagnostic-playbooks.md", "engineering-delivery-playbooks.md", "engineering-continuity-playbooks.md"];
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      for (const name of oldReferences) {
        const path = join(first[host].path, "references", name);
        assert.equal(existsSync(path), false);
        writeFileSync(path, "obsolete playbook collection\n");
      }
    }
    assert.notEqual(contentDigest(first.cursor.path), baseline);
    const next = buildPluginTargets(parent);
    assert.equal(next.cursor.hash, baseline);
    assert.equal(existsSync(obsolete), false);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      assert.equal(next[host].hash, first[host].hash);
      for (const name of oldReferences) assert.equal(existsSync(join(next[host].path, "references", name)), false);
    }
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

test("an external README symlink is rejected without replacing any host package", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const destination = join(parent, "packages");
    const before = buildPluginTargets(destination, root);
    const external = join(parent, "external.md");
    writeFileSync(external, "# Outside the source repository\n");
    rmSync(join(root, "README.md"));
    symlinkSync(external, join(root, "README.md"));
    assert.throws(() => buildPluginTargets(destination, root), /symlink/);
    for (const host of ["cursor", "codex", "agent-plugins"]) assert.equal(contentDigest(before[host].path), before[host].hash);
    assert.equal(readFileSync(external, "utf8"), "# Outside the source repository\n");
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("invalid command metadata leaves every existing host package unchanged", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const destination = join(parent, "packages");
    const before = buildPluginTargets(destination, root);
    const path = join(root, "skills/review-work/SKILL.md");
    writeFileSync(path, readFileSync(path, "utf8").replace(/^description:.*$/m, "description: [unterminated"));
    assert.throws(() => buildPluginTargets(destination, root), /invalid skill metadata: review-work/);
    for (const host of ["cursor", "codex", "agent-plugins"]) assert.equal(contentDigest(before[host].path), before[host].hash);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("Cursor descriptions preserve literal replacement patterns and the command body", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const path = join(root, "skills/review-work/SKILL.md");
    const description = 'Explain $&, $$, $`, $\' and $1: "literally".';
    writeFileSync(path, readFileSync(path, "utf8").replace(/^description:.*$/m, () => `description: ${JSON.stringify(description)}`));
    const built = buildPluginTargets(join(parent, "packages"), root);
    const source = readFileSync(join(root, "commands/review-work.md"), "utf8");
    const command = join(built.cursor.path, "commands/review-work.md");
    assert.equal(parseFrontmatter(command).description, description);
    assert.equal(readFileSync(command, "utf8"), source.replace(/^description:.*$/m, () => `description: ${JSON.stringify(description)}`));
    assert.deepEqual(validateTarget(built.cursor.path, "cursor", built.version, root), []);
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


test("target inventories reject extra and missing files and ship only the referenced logo", () => {
  const parent = temp();
  try {
    const built = buildPluginTargets(parent);
    for (const host of ["cursor", "codex", "agent-plugins"]) {
      const root = built[host].path;
      assert.deepEqual(files(join(root, "assets")).map(path => relative(root, path)), ["assets/logo.svg"]);
      assert.equal(existsSync(join(root, "release-surface.json")), false);
      writeFileSync(join(root, "extra.md"), "unexpected\n");
      assert.ok(validateTarget(root, host, built.version).some(message => message.includes("exact package contents")));
      rmSync(join(root, "extra.md"));
      rmSync(join(root, "THIRD_PARTY_NOTICES.md"));
      assert.ok(validateTarget(root, host, built.version).some(message => message.includes("exact package contents")));
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("Cursor command descriptions follow changed skill metadata while source aliases retain host hints", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    const skillPath = join(root, "skills/review-work/SKILL.md");
    writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace(/^description:.*$/m, 'description: "Review: changed discovery contract"'));
    const built = buildPluginTargets(join(parent, "packages"), root);
    const command = join(built.cursor.path, "commands/review-work.md");
    assert.equal(parseFrontmatter(command).description, "Review: changed discovery contract");
    for (const name of hostSkills("cursor")) {
      const skill = parseFrontmatter(join(built.cursor.path, "skills", name, "SKILL.md"));
      const alias = parseFrontmatter(join(built.cursor.path, "commands", `${name}.md`));
      assert.equal(alias.name, skill.name);
      assert.equal(alias.description, skill.description);
    }
    assert.ok(readFileSync(command, "utf8").includes("Use Cursor Ask Mode."));
    assert.deepEqual(validateTarget(built.cursor.path, "cursor", built.version, root), []);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("check:targets rejects invalid Cursor discovery through the real CLI", () => {
  const parent = temp();
  try {
    const root = sourceFixture(parent);
    symlinkSync(join(defaultRoot, "node_modules"), join(root, "node_modules"));
    const path = join(root, ".cursor-plugin/plugin.json");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path)), skills: [] }));
    const checked = spawnSync(process.execPath, [join(root, "scripts/build-plugin-targets.mjs"), "--check"], { encoding: "utf8" });
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /Cursor skill discovery differs/);
    assert.equal(existsSync(join(root, ".build")), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
