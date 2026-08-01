import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classifyPreparationCompatibility, classifyRunCompatibility } from "../src/controller/protocol.mjs";
import { PreparationStore, RunStore } from "../src/controller/store.mjs";

test("Workflow 5 minor versions remain state-compatible while schema cuts do not", () => {
  assert.equal(classifyRunCompatibility({ run_record_schema: 2, artifact_schema: 5, controller_protocol: 5, plugin_version: "5.0.0" }).compatible, true);
  assert.equal(classifyPreparationCompatibility({ preparation_record_schema: 2, artifact_schema: 5, controller_protocol: 5, plugin_version: "5.0.0" }).compatible, true);
  assert.equal(classifyRunCompatibility({ run_record_schema: 2, artifact_schema: 4, controller_protocol: 4, plugin_version: "5.0.0" }).compatible, false);
});

test("root-ready and interrupted preparations remain active", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-preparation-index-"));
  try {
    const store = new PreparationStore(root);
    let preparation = store.create({ status: "planning", expires_at: new Date(Date.now() + 60_000).toISOString() });
    preparation = store.update(preparation.preparation_id, preparation.revision, null, (draft) => ({ ...draft, status: "root-ready" }));
    assert.equal(store.active()[0].preparation_id, preparation.preparation_id);
    preparation = store.update(preparation.preparation_id, preparation.revision, null, (draft) => ({ ...draft, status: "interrupted" }));
    assert.equal(store.active()[0].status, "interrupted");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("event heads rebuild and tail reads use 128-event checkpoints", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-event-index-"));
  try {
    const store = new RunStore(root);
    const run = store.create({ lifecycle: "paused", requested_profile: "supervised" });
    const lines = [];
    let previous = null;
    for (let index = 0; index < 10_000; index += 1) {
      const event = { id: `event-${index}`, at: "2026-08-01T00:00:00.000Z", type: "scale", payload: { index }, previous_hash: previous };
      event.event_hash = `hash-${index}`;
      previous = event.event_hash;
      lines.push(JSON.stringify(event));
    }
    writeFileSync(store.eventPath(run.run_id), `${lines.join("\n")}\n`);
    unlinkSync(store.eventHeadPath(run.run_id));
    const tail = store.events(run.run_id, 9_990);
    assert.equal(tail.length, 10);
    assert.equal(tail[0].payload.index, 9_990);
    const head = JSON.parse(readFileSync(store.eventHeadPath(run.run_id), "utf8"));
    assert.equal(head.count, 10_000);
    assert.equal(head.checkpoints.at(-1).event, 9_984);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
