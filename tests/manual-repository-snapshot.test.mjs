import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  captureRepositorySnapshot,
  deriveRepositoryDelta,
  evidenceRepositorySnapshot,
  repositoryPathFingerprint,
  repositorySnapshotHash,
  validRepositorySnapshot,
} from "../src/core/manual-repository-snapshot.mjs";

function snapshot(root, overrides = {}) {
  return {
    schema: 1,
    repository_root: root,
    head: "a".repeat(40),
    dirty_paths: [],
    fingerprints: {},
    index_fingerprint: "b".repeat(64),
    status_fingerprint: "c".repeat(64),
    working_tree: "unchanged",
    captured_at: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

test("repository fingerprints distinguish files, directories, symlinks, and missing paths", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-snapshot-paths-"));
  try {
    writeFileSync(join(root, "file.txt"), "content\n");
    mkdirSync(join(root, "directory"));
    symlinkSync("file.txt", join(root, "link"));
    assert.match(repositoryPathFingerprint(root, "file.txt"), /^file:/);
    assert.match(repositoryPathFingerprint(root, "directory"), /^directory:/);
    assert.match(repositoryPathFingerprint(root, "link"), /^symlink:/);
    assert.equal(repositoryPathFingerprint(root, "missing.txt"), "missing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repository capture parses buffered and textual git output and reports command failures", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-snapshot-capture-"));
  try {
    writeFileSync(join(root, "tracked.txt"), "tracked\n");
    writeFileSync(join(root, "untracked.txt"), "untracked\n");
    const runner = (_command, args) => {
      const operation = args.slice(2).join(" ");
      if (operation === "rev-parse --show-toplevel") return { status: 0, stdout: `${root}\n` };
      if (operation === "rev-parse HEAD") return { status: 0, stdout: `${"d".repeat(40)}\n` };
      if (operation === "ls-files --stage -z --") return { status: 0, stdout: `100644 ${"e".repeat(40)} 0\ttracked.txt\0record-without-tab\0` };
      if (operation.startsWith("status ")) return { status: 0, stdout: "1 .M N... tracked.txt\0? untracked.txt\0" };
      if (operation === "diff --name-only -z HEAD --") return { status: 0, stdout: Buffer.from("tracked.txt\0") };
      if (operation === "ls-files --others --exclude-standard -z --") return { status: 0, stdout: "untracked.txt\0tracked.txt\0" };
      throw new Error(`unexpected git operation ${operation}`);
    };
    const captured = captureRepositorySnapshot(root, { spawnSync: runner });
    assert.deepEqual(captured.dirty_paths, ["tracked.txt", "untracked.txt"]);
    assert.match(captured.fingerprints["tracked.txt"], /\|index:/);
    assert.match(captured.fingerprints["untracked.txt"], /\|index:/);
    assert.equal(captured.working_tree, "modified");

    const spawnFailure = new Error("git unavailable");
    assert.throws(() => captureRepositorySnapshot(root, { spawnSync: () => ({ error: spawnFailure }) }), /git unavailable/);
    assert.throws(() => captureRepositorySnapshot(root, {
      spawnSync: () => ({ status: 1, stderr: Buffer.from("permission denied") }),
    }), /permission denied/);
    assert.throws(() => captureRepositorySnapshot(root, {
      spawnSync: () => ({ status: 2, stderr: "" }),
    }), /exit 2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repository snapshot validation, hashing, and delta reasons stay fail-safe", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-snapshot-delta-"));
  const other = mkdtempSync(join(tmpdir(), "workflow-snapshot-other-"));
  try {
    const baseline = snapshot(root, {
      dirty_paths: ["same.txt", "removed.txt"],
      fingerprints: { "same.txt": "same", "removed.txt": "before" },
      working_tree: "modified",
    });
    const current = snapshot(root, {
      dirty_paths: ["same.txt", "added.txt"],
      fingerprints: { "same.txt": "same", "added.txt": "after" },
      index_fingerprint: "f".repeat(64),
      working_tree: "modified",
    });
    assert.equal(validRepositorySnapshot(null), false);
    assert.equal(validRepositorySnapshot({ ...baseline, fingerprints: [] }), false);
    assert.equal(repositorySnapshotHash({ schema: 0 }), null);
    assert.equal(
      repositorySnapshotHash(baseline),
      repositorySnapshotHash({ ...baseline, dirty_paths: [...baseline.dirty_paths].reverse(), captured_at: "later" }),
    );
    assert.throws(() => deriveRepositoryDelta(baseline, { schema: 0 }), /current repository snapshot is invalid/);

    const unavailable = deriveRepositoryDelta(null, current);
    assert.deepEqual(unavailable.attribution_reason_codes, ["baseline-unavailable"]);
    const invalid = deriveRepositoryDelta({ schema: 0 }, current, { reasonCodes: [" supplied ", "supplied"] });
    assert.deepEqual(invalid.attribution_reason_codes, ["baseline-invalid", "supplied"]);
    const rootMismatch = deriveRepositoryDelta({ ...baseline, repository_root: other }, current);
    assert.deepEqual(rootMismatch.attribution_reason_codes, ["baseline-root-mismatch"]);
    const headDrift = deriveRepositoryDelta({ ...baseline, head: "9".repeat(40) }, current);
    assert.deepEqual(headDrift.attribution_reason_codes, ["head-drift"]);

    const attributed = deriveRepositoryDelta(baseline, current);
    assert.equal(attributed.attribution_status, "attributed");
    assert.deepEqual(attributed.changed_paths, ["added.txt", "removed.txt"]);
    assert.deepEqual(attributed.pre_existing_paths, ["same.txt"]);
    const capped = deriveRepositoryDelta(baseline, current, { boundary: "correction", reasonCodes: ["concurrent"] });
    assert.equal(capped.attribution_status, "provisional");
    assert.equal(capped.attribution_boundary, "correction");
    assert.deepEqual(capped.attribution_reason_codes, ["concurrent"]);

    assert.throws(() => evidenceRepositorySnapshot({ schema: 0 }, []), /repository snapshot is invalid/);
    const evidence = evidenceRepositorySnapshot(current, ["absent.txt"], { attributionReasonCodes: ["z", "z", ""] });
    assert.match(evidence.relevant_fingerprints, /absent\.txt=missing/);
    assert.deepEqual(evidence.attribution_reason_codes, ["z"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});
