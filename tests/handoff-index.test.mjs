import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";

test("handoff context reads only the indexed lineage, not 1000 unrelated artifact bodies", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-handoff-index-"));
  try {
    const store = new ArtifactHandoffStore(state, defaultRoot);
    const root = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
    store.record([{ label: "root", text: root }]);
    const index = store.index();
    for (let number = 0; number < 1_000; number += 1) {
      const id = `de-foreign-${String(number).padStart(4, "0")}`;
      writeFileSync(store.artifactPath(id), "intentionally unreadable unrelated record\n");
      index.entries.push({
        artifact_id: id,
        artifact_type: "delivery-evidence",
        root_plan_id: `wp-foreign-${String(number).padStart(4, "0")}`,
        predecessor_plan_id: null,
        references: [],
        text_hash: "0".repeat(64),
      });
    }
    writeFileSync(store.indexPath(), `${JSON.stringify(index, null, 2)}\n`);
    const context = store.context("wp-adaptive-retry");
    assert.equal(context.root_plan_id, "wp-adaptive-retry");
    assert.equal(context.artifacts.length, 1);
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test("handoff context never writes a missing, corrupt, or stale index", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-handoff-readonly-index-"));
  try {
    const store = new ArtifactHandoffStore(state, defaultRoot);
    const root = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
    store.record([{ label: "root", text: root }]);
    const indexPath = store.indexPath();

    rmSync(indexPath, { force: true });
    assert.equal(existsSync(indexPath), false);
    assert.equal(store.context("wp-adaptive-retry").artifacts.length, 1);
    assert.equal(existsSync(indexPath), false);

    writeFileSync(indexPath, "{ corrupt\n");
    const corruptBefore = { content: readFileSync(indexPath, "utf8"), mtimeMs: statSync(indexPath).mtimeMs };
    assert.equal(store.context("wp-adaptive-retry").artifacts.length, 1);
    assert.equal(readFileSync(indexPath, "utf8"), corruptBefore.content);
    assert.equal(statSync(indexPath).mtimeMs, corruptBefore.mtimeMs);

    writeFileSync(indexPath, `${JSON.stringify({ schema: 1, entries: [] }, null, 2)}\n`);
    const staleBefore = { content: readFileSync(indexPath, "utf8"), mtimeMs: statSync(indexPath).mtimeMs };
    assert.equal(store.context("wp-adaptive-retry").artifacts.length, 1);
    assert.equal(readFileSync(indexPath, "utf8"), staleBefore.content);
    assert.equal(statSync(indexPath).mtimeMs, staleBefore.mtimeMs);

    assert.deepEqual(store.index().entries.map((entry) => entry.artifact_id), ["wp-adaptive-retry"]);
    assert.equal(existsSync(indexPath), true);
    assert.deepEqual(JSON.parse(readFileSync(indexPath, "utf8")).entries.map((entry) => entry.artifact_id), ["wp-adaptive-retry"]);
  } finally { rmSync(state, { recursive: true, force: true }); }
});
