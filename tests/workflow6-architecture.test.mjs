import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "node_modules", "dist", "targets"].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("root AGENTS.md is the single contributor Northstar", () => {
  const roots = files(defaultRoot)
    .filter((path) => path.endsWith("/AGENTS.md") && !path.includes("/node_modules/") && !path.includes("/.git/"));
  assert.deepEqual(roots, [join(defaultRoot, "AGENTS.md")]);
  const northstar = readFileSync(roots[0], "utf8");
  assert.match(northstar, /## Workflow owns/i);
  assert.match(northstar, /project harness owns/i);
  assert.match(northstar, /every concrete execution choice/i);
  assert.match(northstar, /Ordinary Cursor and Codex prompts/i);
});

test("runtime Core has no concrete execution engine dependencies", () => {
  const runtimeFiles = [
    ...files(join(defaultRoot, "src/core")),
    ...files(join(defaultRoot, "src/controller")),
    ...files(join(defaultRoot, "src/mcp")),
    ...files(join(defaultRoot, "hooks")),
  ].filter((path) => path.endsWith(".mjs"));
  const runtime = runtimeFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(
    runtime,
    /node:child_process|parseHostCommand|runHostCheck|program-not-classified|unapproved-root-check|manual-check-receipts|MODEL_INHERIT|model-supplied|model-authored|quarantine-handoff/,
  );
  for (const removed of [
    "src/controller/capabilities.mjs",
    "src/controller/engine.mjs",
    "src/controller/runner.mjs",
    "src/controller/sandbox.mjs",
    "src/controller/worktree.mjs",
    "src/controller/verification-profile.mjs",
    "src/controller/worker-adapter.mjs",
    "src/core/closeout-retention.mjs",
    "src/core/manual-attestation.mjs",
    "src/core/manual-journey.mjs",
    "src/core/manual-subagent-policy.mjs",
  ]) assert.equal(existsSync(join(defaultRoot, removed)), false, removed);
});

test("Workflow imports only the external Host Adapter and never the project Harness locator", () => {
  const source = readFileSync(join(defaultRoot, "src/harness/module-adapter.mjs"), "utf8");
  assert.match(source, /GELDMACHER_WORKFLOW_HOST_ADAPTER_MODULE/);
  assert.match(source, /harness_locator: harnessLocator/);
  assert.doesNotMatch(source, /import\s*\(\s*(?:harnessLocator|process\.env\[PROJECT_HARNESS_ENV\])/);
});

test("removed execution-policy commands and schemas stay absent", () => {
  for (const removed of [
    "commands/work-models.md",
    "commands/work-verification.md",
    "commands/work-watch.md",
    "commands/work-control.md",
    "schemas/execution-strategy.schema.json",
    "schemas/verification-profile.schema.json",
    "schemas/manual-subagent-policy.schema.json",
  ]) assert.equal(existsSync(join(defaultRoot, removed)), false, removed);
});

test("no pre-Workflow-6 compatibility surface remains", () => {
  for (const removed of [
    "schemas/artifacts/work-plan.schema.json",
    "schemas/artifacts/delivery-evidence.schema.json",
    "schemas/artifacts/work-review.schema.json",
    "src/core/handoff-migration.mjs",
    "tests/handoff-migration.test.mjs",
    "tests/fixtures/tool-contracts-5.5.0.json",
    "docs/migration-workflow-4.md",
    "docs/migration-workflow-5.md",
    "docs/migration-workflow-6.md",
  ]) assert.equal(existsSync(join(defaultRoot, removed)), false, removed);

  const maintained = [
    "README.md",
    "AGENTS.md",
    ...files(join(defaultRoot, "src")),
    ...files(join(defaultRoot, "commands")),
    ...files(join(defaultRoot, "skills")),
    ...files(join(defaultRoot, "references")),
    ...files(join(defaultRoot, "docs")),
  ].map((path) => path.startsWith(defaultRoot) ? path : join(defaultRoot, path))
    .filter((path) => /\.(?:md|mjs|json)$/.test(path));
  const source = maintained.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(source, /Schema 3 through 5|read-only-workflow-[345]|legacy_review_recorded|handoff-migration|GELDMACHER_WORKFLOW_LEGACY/);
  assert.doesNotMatch(source, /schema\s*(?::|===|!==)\s*[345]\b|workflow-[a-z-]+-v[1-5]\b/i);
});

test("Schema-6 authoritative artifact schemas contain no execution fields", () => {
  for (const name of ["work-plan-6", "delivery-evidence-6", "work-review-6"]) {
    const source = readFileSync(join(defaultRoot, "schemas/artifacts", name + ".schema.json"), "utf8");
    assert.doesNotMatch(source, /Working Directory|Command or Inspection|host_commands|route_pool|task_recipe|repetitions|model/);
  }
});
