import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { buildPluginTargets, defaultRoot } from "../scripts/build-plugin-targets.mjs";
import { measureContext, formatContext } from "../scripts/measure-context.mjs";

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "workflow-context-test-"));
  const root = join(parent, "source");
  cpSync(defaultRoot, root, { recursive: true, filter: path => ![".git", ".build", ".tests", "node_modules"].includes(relative(defaultRoot, path).split(/[\\/]/)[0]) });
  return { parent, root };
}

test("context covers packaged instructions once, including required planning and selected-method references", () => {
  const item = fixture();
  try {
    const built = buildPluginTargets(join(item.parent, "packages"), item.root);
    const result = measureContext(item.root);
    assert.deepEqual(result.failures, []);
    for (const [host, scenarios] of Object.entries(result.targets)) {
      for (const [name, scenario] of Object.entries(scenarios)) {
        assert.equal(new Set(scenario.documents).size, scenario.documents.length, name);
        assert.ok(scenario.limit >= scenario.tokens, `${host} ${name}`);
        if (name !== "discovery") {
          const tokens = scenario.documents.reduce((sum, path) => sum + Math.ceil(readFileSync(join(built[host].path, path), "utf8").length / 4), 0);
          assert.equal(scenario.tokens, tokens, `${host} ${name}`);
        }
      }
      for (const name of ["plan", "autoWork"]) {
        assert.ok(scenarios[name].documents.includes("references/implementation-work.md"));
        assert.ok(scenarios[name].documents.includes("skills/engineering-work/references/catalog.md"));
      }
      assert.ok(scenarios.learning.documents.includes("references/learning-work.md"));
      assert.ok(scenarios["planMethod:refactoring"].documents.includes("skills/engineering-work/references/refactoring.md"));
      assert.ok(!scenarios.autoWork.documents.includes("skills/auto-work/references/delivery.md"));
      assert.ok(scenarios.autoWorkDelivery.documents.includes("skills/auto-work/references/delivery.md"));
      assert.ok(!scenarios.verificationCreation.documents.includes("skills/verification-work/references/maintain.md"));
    }
  } finally { rmSync(item.parent, { recursive: true, force: true }); }
});

test("discovery counts parsed descriptions per host entry and ignores skill body growth", () => {
  const item = fixture();
  try {
    const path = join(item.root, "skills/auto-work/SKILL.md");
    const source = readFileSync(path, "utf8");
    const description = parse(source.match(/^---\n([\s\S]*?)\n---/)[1]).description;
    const before = measureContext(item.root);
    // YAML quoting and instruction text are not part of the advertised description.
    const bodyOnly = source.replace(/^description:.*$/m, `description: '${description.replaceAll("'", "''")}'`) + "\n" + "body ".repeat(80);
    writeFileSync(path, bodyOnly);
    const afterBody = measureContext(item.root);
    for (const host of Object.keys(before.targets)) {
      assert.deepEqual(afterBody.targets[host].discovery, before.targets[host].discovery);
    }

    // Eight advertised characters add two estimated tokens per entry, regardless of rounding.
    writeFileSync(path, bodyOnly.replace(/^description:.*$/m, `description: ${JSON.stringify(description + "12345678")}`));
    const afterDescription = measureContext(item.root);
    for (const [host, delta] of [["cursor", 4], ["codex", 2], ["agent-plugins", 2]]) {
      assert.equal(afterDescription.targets[host].discovery.tokens - before.targets[host].discovery.tokens, delta);
    }

    writeFileSync(path, source.replace(/^description:.*$/m, `description: ${JSON.stringify("x".repeat(4000))}`));
    const overflow = measureContext(item.root);
    for (const host of Object.keys(before.targets)) {
      assert.ok(overflow.failures.some(message => message.startsWith(`${host} discovery:`)));
      assert.equal(overflow.targets[host].discovery.limit, before.targets[host].discovery.limit);
    }
  } finally { rmSync(item.parent, { recursive: true, force: true }); }
});

for (const [path, scenario, unaffected] of [
  ["skills/auto-work/references/operation.md", "autoWork", "plan"],
  ["references/verification-work.md", "verificationInspect", "review"],
  ["skills/auto-work/references/delivery.md", "autoWorkDelivery", "autoWork"],
  ["references/learning-work.md", "learning", "plan"],
  ["skills/engineering-work/references/refactoring.md", "planMethod:refactoring", "plan"],
]) {
  test(`context growth in ${path} fails its fixed gate without inflating unrelated scenarios`, () => {
    const item = fixture();
    try {
      const limits = readFileSync(join(item.root, "scripts/context-limits.json"));
      const before = measureContext(item.root);
      const target = join(item.root, path);
      writeFileSync(target, readFileSync(target, "utf8") + "x".repeat(40000));
      const after = measureContext(item.root);
      for (const host of Object.keys(before.targets)) {
        assert.equal(after.targets[host][scenario].tokens - before.targets[host][scenario].tokens, 10000);
        assert.deepEqual(after.targets[host][unaffected], before.targets[host][unaffected]);
        assert.ok(after.failures.some(message => message.startsWith(`${host} ${scenario}:`)));
      }
      assert.deepEqual(readFileSync(join(item.root, "scripts/context-limits.json")), limits);
      if (["autoWork", "verificationInspect"].includes(scenario)) {
        symlinkSync(join(defaultRoot, "node_modules"), join(item.root, "node_modules"));
        const checked = spawnSync(process.execPath, [join(item.root, "scripts/measure-context.mjs"), "--check"], { cwd: item.parent, encoding: "utf8" });
        assert.equal(checked.status, 1, checked.stderr);
        assert.match(checked.stdout, /Context budget failed/);
      }
    } finally { rmSync(item.parent, { recursive: true, force: true }); }
  });
}

test("missing and stale context limits fail closed", () => {
  const budgets = JSON.parse(readFileSync(join(defaultRoot, "scripts/context-limits.json"), "utf8")).limits;
  delete budgets.autoWork;
  budgets.obsoleteScenario = 1000;
  const result = measureContext(defaultRoot, budgets);
  assert.ok(result.failures.some(message => message.includes("autoWork: missing positive")));
  assert.ok(result.failures.includes("unused context limit: obsoleteScenario"));
});

test("context CLI is compact by default and exposes full inventories with --json", () => {
  const command = join(defaultRoot, "scripts/measure-context.mjs");
  const compact = spawnSync(process.execPath, [command, "--check"], { encoding: "utf8" });
  assert.equal(compact.status, 0, compact.stderr);
  assert.ok(compact.stdout.split("\n").length < 80);
  const detailed = spawnSync(process.execPath, [command, "--check", "--json"], { encoding: "utf8" });
  assert.equal(detailed.status, 0, detailed.stderr);
  const result = JSON.parse(detailed.stdout);
  assert.deepEqual(result.failures, []);
  assert.equal(compact.stdout.trimEnd(), formatContext(result));
  assert.ok(result.targets.codex.autoWork.documents.length > 0);
});
