import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { archiveStateSubject, inspectState, rebuildStateIndexes } from "../src/controller/state-maintenance.mjs";

function fixture(lifecycle = "achieved") {
  const workspace = mkdtempSync(join(tmpdir(), "workflow-maintenance-workspace-"));
  const stateRoot = mkdtempSync(join(tmpdir(), "workflow-maintenance-state-"));
  const runId = `run-${lifecycle}`;
  const runDirectory = join(stateRoot, "runs", runId);
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(runDirectory, "run.json"), `${JSON.stringify({
    run_id: runId,
    run_record_schema: 2,
    artifact_schema: 5,
    controller_protocol: 5,
    plugin_version: "5.0.0",
    lifecycle,
    updated_at: "2026-08-01T00:00:00.000Z",
  })}\n`);
  return { workspace, stateRoot, runId, runDirectory };
}

test("state maintenance archive is dry-run by default and apply is hashed and recoverable", () => {
  const item = fixture();
  const dry = archiveStateSubject({ workspace: item.workspace, stateRoot: item.stateRoot, subject: item.runId });
  assert.equal(dry.applied, false);
  assert.equal(readFileSync(join(item.runDirectory, "run.json"), "utf8").length > 0, true);

  const applied = archiveStateSubject({ workspace: item.workspace, stateRoot: item.stateRoot, subject: item.runId, apply: true });
  assert.equal(applied.applied, true);
  assert.match(applied.content_hash, /^[a-f0-9]{64}$/);
  const manifest = JSON.parse(readFileSync(join(item.stateRoot, "archive", "runs", item.runId, "archive-manifest.json"), "utf8"));
  assert.equal(manifest.content_hash, applied.content_hash);
  assert.equal(manifest.files.some((file) => file.path === "run.json"), true);
});

test("state maintenance refuses nonterminal subjects", () => {
  const item = fixture("running");
  assert.throws(
    () => archiveStateSubject({ workspace: item.workspace, stateRoot: item.stateRoot, subject: item.runId, apply: true }),
    /only terminal subjects/,
  );
});

test("state maintenance inspects source records and rebuilds every derived index", () => {
  const item = fixture("stopped");
  const inspection = inspectState({ workspace: item.workspace, stateRoot: item.stateRoot });
  assert.equal(inspection.files, 1);
  assert.match(inspection.state_hash, /^[a-f0-9]{64}$/);
  const rebuilt = rebuildStateIndexes({ workspace: item.workspace, stateRoot: item.stateRoot, pluginRoot: defaultRoot });
  assert.equal(rebuilt.runs, 1);
  assert.equal(rebuilt.preparations, 0);
  assert.equal(rebuilt.handoff_artifacts, 0);
});
