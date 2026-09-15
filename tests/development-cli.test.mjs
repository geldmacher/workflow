import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { defaultRoot } from "../scripts/build-plugin-targets.mjs";
import { correctSource } from "../.agents/skills/verify-auto-work/scripts/fixture.mjs";
import { checkMarkdownLinks } from "../scripts/check-markdown-links.mjs";

const run = (script, args = []) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: tmpdir() });

test("development CLIs execute through physical and aliased paths; imports stay inert", () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "workflow-cli-")));
  const root = join(parent, "source");
  const alias = join(parent, "alias");
  try {
    mkdirSync(root);
    for (const name of ["scripts", "schemas", "skills", "references", "commands", "docs", "targets", ".cursor-plugin", ".agents", "package.json"]) {
      cpSync(join(defaultRoot, name), join(root, name), { recursive: true });
    }
    symlinkSync(join(defaultRoot, "node_modules"), join(root, "node_modules"));
    symlinkSync(root, alias, "dir");
    execFileSync("git", ["init", "--quiet", root]);
    writeFileSync(join(root, "broken.md"), "[missing](missing.md)\n");
    const manifestPath = join(root, ".cursor-plugin/plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath));
    manifest.version = "999.0.0";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const cases = [
      ["scripts/validate-plugin.mjs", [], /identity or version mismatch/],
      ["scripts/check-markdown-links.mjs", [], /missing link target/],
      ["scripts/local-plugin-deploy.mjs", ["invalid-command"], /unsupported command/],
      ["scripts/plugin-github-release.mjs", ["--invalid-argument"], /Usage:/],
      [".agents/skills/verify-auto-work/scripts/fixture.mjs", ["invalid-action"], /Use prepare/],
    ];
    const roots = [root, alias];
    if (root.startsWith("/private/var/")) roots.push(root.replace(/^\/private/, ""));
    for (const [script, args, diagnostic] of cases) {
      for (const base of roots) {
        const result = run(join(base, script), args);
        assert.equal(result.status, 1, `${base}/${script}: ${result.stderr}`);
        assert.match(result.stdout + result.stderr, diagnostic);
      }
      const imported = run("--input-type=module", ["-e", `await import(${JSON.stringify(pathToFileURL(join(root, script)).href)})`]);
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout + imported.stderr, "");
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("source links use Git visibility; packages include ignored-looking directories", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-links-"));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    writeFileSync(join(root, ".gitignore"), ".tmp-*/\n");
    writeFileSync(join(root, "tracked.md"), "# Tracked\n");
    writeFileSync(join(root, "deleted.md"), "[missing](missing.md)\n");
    execFileSync("git", ["-C", root, "add", "."]);
    rmSync(join(root, "deleted.md"));
    mkdirSync(join(root, ".tmp-evidence"));
    writeFileSync(join(root, ".tmp-evidence/notes.md"), "[missing](missing.md)\n");
    assert.deepEqual(checkMarkdownLinks(root, { source: true }), []);
    writeFileSync(join(root, "new.md"), "[tracked](tracked.md#tracked)\n");
    assert.deepEqual(checkMarkdownLinks(root, { source: true }), []);
    writeFileSync(join(root, "new.md"), "[bad](tracked.md#absent)\n");
    assert.match(checkMarkdownLinks(root, { source: true }).join(), /missing anchor/);
    writeFileSync(join(root, "new.md"), "[bad](../outside.md)\n");
    assert.match(checkMarkdownLinks(root, { source: true }).join(), /escapes plugin root/);
    rmSync(join(root, "new.md"));
    writeFileSync(join(root, "tracked.md"), "[bad](missing.md)\n");
    assert.match(checkMarkdownLinks(root, { source: true }).join(), /missing link target/);
    writeFileSync(join(root, "tracked.md"), "# Tracked\n");
    rmSync(join(root, ".git"), { recursive: true });
    assert.match(checkMarkdownLinks(root).join(), /notes.md: missing link target/);
    assert.throws(() => checkMarkdownLinks(root, { source: true }), /git|repository/);
    assert.ok(existsSync(join(root, ".tmp-evidence/notes.md")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("fixture CLI prepares, inspects, simulates delivery and retains evidence through cleanup", () => {
  const script = join(defaultRoot, ".agents/skills/verify-auto-work/scripts/fixture.mjs");
  const invoke = (...args) => {
    const result = run(script, args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const prepared = invoke("prepare");
  try {
    const before = invoke("inspect", prepared.base);
    assert.equal(before.sourceChanged, false);
    writeFileSync(join(prepared.workspace, "csv.mjs"), correctSource);
    const after = invoke("inspect", prepared.base);
    assert.equal(after.sourceChanged, true);
    assert.equal(after.unrelatedPreserved, true);
    const delivered = invoke("deliver", prepared.base, after.sourceDigest, "authorized-local-simulation");
    assert.equal(delivered.simulation, true);
    assert.equal(delivered.count, 1);
    assert.equal(invoke("cleanup", prepared.base).workspaceRemoved, true);
    assert.ok(existsSync(join(prepared.evidence, "final-state.json")));
    assert.ok(existsSync(join(prepared.evidence, "delivery.json")));
    assert.equal(existsSync(prepared.workspace), false);
  } finally { rmSync(prepared.base, { recursive: true, force: true }); }
});
