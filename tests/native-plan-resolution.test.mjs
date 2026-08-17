import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveNativePlan } from "../src/core/native-plan-resolution.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const plan = readFileSync(join(root, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

test("native plan resolution returns exact current-task Root identity", () => {
  const resolution = resolveNativePlan({
    candidates: [{ source: "codex-proposed-plan", root_text: plan }],
    attemptedSources: ["codex-proposed-plan"],
    pluginRoot: root,
  });
  assert.equal(resolution.status, "resolved");
  assert.match(resolution.root_id, /^wp-/);
  assert.match(resolution.root_hash, /^[a-f0-9]{64}$/);
  assert.equal(resolution.source, "codex-proposed-plan");
});

test("native plan resolution reports inspected native sources without cache recovery", () => {
  assert.deepEqual(resolveNativePlan({ attemptedSources: ["cursor-native-plan", "cursor-task-context"], pluginRoot: root }), {
    status: "unavailable",
    attempted_sources: ["cursor-native-plan", "cursor-task-context"],
    resolution: "Restore the Schema-5 native Plan in this same task or create and approve a new native Plan, then repeat Review.",
  });
});
