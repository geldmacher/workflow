import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { migrateCursorHandoff } from "../src/core/handoff-migration.mjs";

const fixture = (name) => readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", name), "utf8");
const chain = ["work-plan.valid.md", "delivery-evidence.valid.md", "work-review.valid.md"].map((name) => ({ label: name, text: fixture(name) }));

test("Cursor handoff import is empty-safe, complete, and idempotent", () => {
  const base = mkdtempSync(join(tmpdir(), "workflow-migration-"));
  try {
    const empty = migrateCursorHandoff({ sourceRoot: join(base, "empty-source"), targetRoot: join(base, "empty-target"), pluginRoot: defaultRoot, observedAt: "2026-08-03T00:00:00.000Z" });
    assert.equal(empty.record_count, 0);
    const source = new ArtifactHandoffStore(join(base, "source"), defaultRoot);
    source.record(chain);
    const first = migrateCursorHandoff({ sourceRoot: join(base, "source"), targetRoot: join(base, "target"), pluginRoot: defaultRoot, observedAt: "2026-08-03T01:00:00.000Z" });
    assert.deepEqual(first.recorded.sort(), ["de-adaptive-retry", "wp-adaptive-retry", "wr-adaptive-retry"]);
    const repeat = migrateCursorHandoff({ sourceRoot: join(base, "source"), targetRoot: join(base, "target"), pluginRoot: defaultRoot, observedAt: "2026-08-03T02:00:00.000Z" });
    assert.equal(repeat.duplicate_import, true);
    assert.equal(repeat.observed_at, first.observed_at);

    const many = new ArtifactHandoffStore(join(base, "many-source"), defaultRoot);
    for (let index = 1; index <= 33; index += 1) {
      many.record([{ label: `root-${index}`, text: chain[0].text.replace("wp-adaptive-retry", `wp-import-${index}`) }]);
    }
    const manyResult = migrateCursorHandoff({ sourceRoot: join(base, "many-source"), targetRoot: join(base, "many-target"), pluginRoot: defaultRoot });
    assert.equal(manyResult.recorded.length, 33);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("Cursor handoff import blocks immutable conflicts, corrupt records, and incomplete chains", () => {
  const base = mkdtempSync(join(tmpdir(), "workflow-migration-invalid-"));
  try {
    const sourceRoot = join(base, "source");
    const source = new ArtifactHandoffStore(sourceRoot, defaultRoot);
    source.record(chain);
    const conflictTarget = new ArtifactHandoffStore(join(base, "conflict-target"), defaultRoot);
    conflictTarget.record([{ label: "root", text: chain[0].text.replace("Make retry handling deterministic", "Make retry handling observable") }]);
    assert.throws(() => migrateCursorHandoff({ sourceRoot, targetRoot: join(base, "conflict-target"), pluginRoot: defaultRoot }), /conflicts/);

    const corruptPath = source.artifactPath("wp-adaptive-retry");
    const corrupt = JSON.parse(readFileSync(corruptPath, "utf8"));
    corrupt.text = corrupt.text.replace("Make retry handling deterministic", "corrupt text");
    writeFileSync(corruptPath, `${JSON.stringify(corrupt)}\n`);
    assert.throws(() => migrateCursorHandoff({ sourceRoot, targetRoot: join(base, "corrupt-target"), pluginRoot: defaultRoot }), /corrupt/);

    const incompleteRoot = join(base, "incomplete");
    const incomplete = new ArtifactHandoffStore(incompleteRoot, defaultRoot);
    incomplete.record(chain);
    unlinkSync(incomplete.artifactPath("de-adaptive-retry"));
    assert.throws(() => migrateCursorHandoff({ sourceRoot: incompleteRoot, targetRoot: join(base, "incomplete-target"), pluginRoot: defaultRoot }), /incomplete|invalid|missing/i);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
