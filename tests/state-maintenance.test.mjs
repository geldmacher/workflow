import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { createContentAddressedHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import {
  archiveStateSubject,
  inspectState,
  quarantineHandoffReview,
  rebuildStateIndexes,
} from "../src/controller/state-maintenance.mjs";
import { rootContentHash } from "../src/core/state-paths.mjs";
import {
  correctionReviewArtifact,
  leanRoot,
} from "./support/manual-attestation-fixtures.mjs";

const verifiedRootCheck = [{
  check_id: "CHECK-1",
  grade: "verified",
  surface: "repository",
  method: "node --test tests/codex-hook-policy.test.mjs",
  expected: "Focused tests pass.",
  observed: "Focused tests passed.",
  repetitions: 1,
  limitations: [],
}];

function correctionChain() {
  const initial = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: verifiedRootCheck,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    enforceManualCheckReceipts: false,
    pluginRoot: defaultRoot,
  });
  const review = correctionReviewArtifact({ latestEvidenceId: initial.fields.id });
  return { initial, review };
}

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

test("handoff review quarantine is exact, dry-run first, recoverable, and allows authoritative rerecording", () => {
  const baseRoot = mkdtempSync(join(tmpdir(), "workflow-handoff-quarantine-"));
  const store = createContentAddressedHandoffStore(leanRoot, defaultRoot, { baseRoot });
  const { initial, review } = correctionChain();
  store.record([
    { label: "root", text: leanRoot },
    { label: "evidence", text: initial.artifact },
    { label: "review", text: review },
  ]);
  const rootBefore = readFileSync(store.artifactPath("wp-retry"));
  const evidenceBefore = readFileSync(store.artifactPath(initial.fields.id));
  const reviewBefore = readFileSync(store.artifactPath("wr-retry"));
  const expectedTextHash = JSON.parse(reviewBefore).text_hash;
  const input = {
    rootHash: rootContentHash(leanRoot),
    artifactId: "wr-retry",
    expectedTextHash,
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot },
    now: () => new Date("2026-08-12T12:34:56.000Z"),
  };

  const dryRun = quarantineHandoffReview(input);
  assert.equal(dryRun.applied, false);
  assert.equal(dryRun.applicable, true);
  assert.equal(existsSync(store.artifactPath("wr-retry")), true);

  const applied = quarantineHandoffReview({ ...input, apply: true });
  assert.equal(applied.applied, true);
  assert.equal(existsSync(store.artifactPath("wr-retry")), false);
  assert.deepEqual(readFileSync(applied.target), reviewBefore);
  assert.equal(existsSync(join(applied.quarantine_directory, "quarantine-manifest.json")), true);
  assert.deepEqual(readFileSync(store.artifactPath("wp-retry")), rootBefore);
  assert.deepEqual(readFileSync(store.artifactPath(initial.fields.id)), evidenceBefore);

  const authoritativeReview = review.replace("not-achieved: one correction remains.", "not-achieved: one exact correction remains.");
  store.record([{ label: "review", text: authoritativeReview }]);
  assert.equal(store.context("wp-retry", leanRoot).review_tip, "wr-retry");
  assert.equal(JSON.parse(readFileSync(store.artifactPath("wr-retry"))).text, authoritativeReview);
  assert.deepEqual(readFileSync(applied.target), reviewBefore);
});

test("handoff quarantine can recover an exact dependent-free Evidence tip", () => {
  const baseRoot = mkdtempSync(join(tmpdir(), "workflow-handoff-quarantine-evidence-"));
  const store = createContentAddressedHandoffStore(leanRoot, defaultRoot, { baseRoot });
  const { initial, review } = correctionChain();
  const delta = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [
      { label: initial.fields.id, text: initial.artifact },
      { label: "wr-retry", text: review },
    ],
    checkEvidence: [...verifiedRootCheck, {
      check_id: "CHECK-101",
      grade: "verified",
      surface: "repository",
      method: "node --test",
      expected: "pass",
      observed: "Correction Check passed.",
      repetitions: 1,
      limitations: [],
    }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    enforceManualCheckReceipts: false,
    pluginRoot: defaultRoot,
  });
  store.record([
    { label: "root", text: leanRoot },
    { label: "evidence", text: initial.artifact },
    { label: "review", text: review },
    { label: "delta", text: delta.artifact },
  ]);
  const evidenceBefore = readFileSync(store.artifactPath(delta.fields.id));
  const expectedTextHash = JSON.parse(evidenceBefore).text_hash;
  const input = {
    rootHash: rootContentHash(leanRoot),
    artifactId: delta.fields.id,
    expectedTextHash,
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot },
  };

  const dryRun = quarantineHandoffReview(input);
  assert.equal(dryRun.applicable, true);
  assert.deepEqual(dryRun.dependents, []);
  const applied = quarantineHandoffReview({ ...input, apply: true });
  assert.equal(applied.applied, true);
  assert.equal(existsSync(store.artifactPath(delta.fields.id)), false);
  assert.deepEqual(readFileSync(applied.target), evidenceBefore);
  assert.equal(store.context("wp-retry", leanRoot).evidence_tip, initial.fields.id);
  assert.equal(store.context("wp-retry", leanRoot).review_tip, "wr-retry");
});

test("handoff quarantine refuses to orphan active dependent Evidence", () => {
  const baseRoot = mkdtempSync(join(tmpdir(), "workflow-handoff-quarantine-dependent-"));
  const store = createContentAddressedHandoffStore(leanRoot, defaultRoot, { baseRoot });
  const { initial, review } = correctionChain();
  const delta = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [
      { label: initial.fields.id, text: initial.artifact },
      { label: "wr-retry", text: review },
    ],
    checkEvidence: [...verifiedRootCheck, {
      check_id: "CHECK-101",
      grade: "verified",
      surface: "repository",
      method: "node --test",
      expected: "pass",
      observed: "Correction Check passed.",
      repetitions: 1,
      limitations: [],
    }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    enforceManualCheckReceipts: false,
    pluginRoot: defaultRoot,
  });
  store.record([
    { label: "root", text: leanRoot },
    { label: "evidence", text: initial.artifact },
    { label: "review", text: review },
    { label: "delta", text: delta.artifact },
  ]);
  const expectedTextHash = JSON.parse(readFileSync(store.artifactPath("wr-retry"))).text_hash;
  const input = {
    rootHash: rootContentHash(leanRoot),
    artifactId: "wr-retry",
    expectedTextHash,
    pluginRoot: defaultRoot,
    handoffOptions: { baseRoot },
  };
  const dryRun = quarantineHandoffReview(input);
  assert.equal(dryRun.applicable, false);
  assert.deepEqual(dryRun.dependents, [delta.fields.id]);
  assert.throws(() => quarantineHandoffReview({ ...input, apply: true }), /active artifacts depend on it/);
  assert.equal(existsSync(store.artifactPath("wr-retry")), true);
});
