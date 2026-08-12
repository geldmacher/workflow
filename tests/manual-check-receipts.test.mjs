import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import {
  beginManualCheckReceipt,
  completeManualCheckReceipt,
  invalidateManualCheckReceipts,
  isReadOnlyShell,
  loadManualCheckReceipts,
  MANUAL_CHECK_RECEIPT_SURFACE,
  manualConstraintProjection,
  manualToolResultStatus,
  normalizeManualCheckCommand,
} from "../src/core/manual-check-receipts.mjs";
import { captureRepositorySnapshot } from "../src/core/manual-repository-snapshot.mjs";
import { rootContentHash, sharedArtifactStateRoot } from "../src/core/state-paths.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { leanRoot } from "./support/manual-attestation-fixtures.mjs";

const plannedCommand = "node --test tests/codex-hook-policy.test.mjs";
const fixedNow = new Date("2026-08-12T10:00:00.000Z");

function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-manual-receipt-"));
  const repository = join(temporary, "repository");
  const proof = join(temporary, "proof");
  mkdirSync(join(repository, "src"), { recursive: true });
  writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
  git(repository, ["init", "--quiet"]);
  git(repository, ["add", "src/retry.mjs"]);
  git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);
  return {
    temporary,
    repository,
    receiptOptions: { baseRoot: proof },
    cleanup: () => rmSync(temporary, { recursive: true, force: true }),
  };
}

function begin(repository, extra = {}) {
  return beginManualCheckReceipt({
    rootPlanText: leanRoot,
    pluginRoot: defaultRoot,
    workspaceRoot: repository,
    toolName: "Shell",
    toolInput: { command: plannedCommand },
    now: () => fixedNow,
    ...extra,
  });
}

function evidence(receipts, extra = {}) {
  return buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: [{
      check_id: "CHECK-1",
      grade: "verified",
      surface: "agent-claimed-host",
      method: "forged method",
      expected: "Focused tests pass.",
      observed: "Focused tests passed.",
      repetitions: 99,
      artifact_hashes: ["a".repeat(64)],
      limitations: [],
    }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    manualCheckReceipts: receipts,
    pluginRoot: defaultRoot,
    ...extra,
  });
}

test("manual receipt matching accepts one exact optional rtk wrapper and rejects ambiguous commands or working directories", () => {
  const value = fixture();
  try {
    assert.equal(normalizeManualCheckCommand(`  rtk ${plannedCommand}  `), plannedCommand);
    assert.equal(begin(value.repository, { toolInput: { command: `rtk ${plannedCommand}` } })?.check_id, "CHECK-1");
    assert.equal(begin(value.repository, { toolInput: { command: `${plannedCommand} && git status` } }), null);
    assert.equal(begin(value.repository, { toolInput: { command: `rtk rtk ${plannedCommand}` } }), null);
    assert.equal(begin(value.repository, { toolInput: { command: plannedCommand, workdir: "src" } }), null);
    assert.equal(begin(value.repository, { toolName: "Write", toolInput: { command: plannedCommand } }), null);
    assert.equal(isReadOnlyShell(`rtk ${plannedCommand}`), true);
    assert.equal(isReadOnlyShell("git status --short"), true);
    assert.equal(isReadOnlyShell("git add src/retry.mjs"), false);
    assert.equal(isReadOnlyShell("git status $(touch src/retry.mjs)"), false);
    assert.equal(isReadOnlyShell("git status & touch src/retry.mjs"), false);
    assert.equal(isReadOnlyShell("git status\ntouch src/retry.mjs"), false);
  } finally { value.cleanup(); }
});

test("ambiguous or failed host envelopes never become successful receipts", () => {
  assert.deepEqual(manualToolResultStatus({}), { status: "missing", exit_code: null });
  assert.deepEqual(manualToolResultStatus({ structuredContent: { status: "failed" } }), { status: "failed", exit_code: null });
  assert.deepEqual(manualToolResultStatus({ content: [{ type: "text", text: "Process exited with code 1" }] }), { status: "failed", exit_code: 1 });
  assert.deepEqual(manualToolResultStatus({ status: "completed", content: [{ type: "text", text: "Process exited with code 1" }] }), { status: "failed", exit_code: 1 });
  assert.deepEqual(manualToolResultStatus({ status: "completed" }), { status: "passed", exit_code: null });
  assert.deepEqual(manualToolResultStatus({ exit_code: 0 }), { status: "passed", exit_code: 0 });
});

test("host receipts override caller-owned proof fields and keep equivalent host envelopes deterministic", () => {
  const value = fixture();
  const alternateOptions = { baseRoot: join(value.temporary, "alternate-proof") };
  try {
    const first = completeManualCheckReceipt({
      candidate: begin(value.repository),
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { exit_code: 0, output: "ok\n" },
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    const second = completeManualCheckReceipt({
      candidate: begin(value.repository),
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { content: [{ type: "text", text: "ok\n" }], exitCode: 0 },
      now: () => fixedNow,
      options: alternateOptions,
    });
    assert.equal(first.status, "recorded");
    assert.equal(first.receipt_hash, second.receipt_hash);

    const receipts = loadManualCheckReceipts({
      rootPlanText: leanRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: value.repository,
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    const built = evidence(receipts);
    const check = built.fields.check_evidence[0];
    assert.equal(check.grade, "verified");
    assert.equal(check.surface, MANUAL_CHECK_RECEIPT_SURFACE);
    assert.equal(check.method, plannedCommand);
    assert.equal(check.repetitions, 1);
    assert.deepEqual(check.artifact_hashes, [first.receipt_hash]);
    assert.equal(built.constraint_summary.receipt_coverage.attested, 1);
    assert.equal(built.human_attention.required, false);

    const proofRoot = join(sharedArtifactStateRoot(captureRepositorySnapshot(value.repository).repository_root, value.receiptOptions), "manual-check-receipts", rootContentHash(leanRoot), "CHECK-1");
    const persisted = readdirSync(proofRoot).map((name) => readFileSync(join(proofRoot, name), "utf8")).join("\n");
    assert.doesNotMatch(persisted, /ok\\n|Focused tests passed/);
  } finally {
    value.cleanup();
  }
});

test("missing, expired, failed, and repository-mutating checks cannot verify", () => {
  const value = fixture();
  try {
    const missing = evidence([]);
    assert.equal(missing.fields.check_evidence[0].grade, "supported");
    assert.match(missing.fields.check_evidence[0].limitations.join("\n"), /HOST-RECEIPT-MISSING.*CHECK-1.*node --test/);
    assert.deepEqual(missing.constraint_summary.evidence_gap_checks, ["CHECK-1"]);
    assert.equal(missing.human_attention.required, true);

    const failed = completeManualCheckReceipt({
      candidate: begin(value.repository),
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { exit_code: 1, output: "not ok" },
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    assert.equal(failed.status, "failed");
    let receipts = loadManualCheckReceipts({
      rootPlanText: leanRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: value.repository,
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    assert.equal(evidence(receipts).fields.check_evidence[0].grade, "failed");

    invalidateManualCheckReceipts({ rootPlanText: leanRoot, workspaceRoot: value.repository, options: value.receiptOptions });
    const candidate = begin(value.repository);
    writeFileSync(join(value.repository, "src/retry.mjs"), "export const retries = 2;\n");
    const mutated = completeManualCheckReceipt({
      candidate,
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { exit_code: 0, output: "ok" },
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    assert.equal(mutated.status, "repository-mutated");
    receipts = loadManualCheckReceipts({
      rootPlanText: leanRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: value.repository,
      now: () => fixedNow,
      options: value.receiptOptions,
    });
    assert.deepEqual(receipts, []);

    const current = captureRepositorySnapshot(value.repository);
    const syntheticCandidate = {
      ...begin(value.repository),
      snapshot_fingerprint: "f".repeat(64),
      repository_root: current.repository_root,
    };
    assert.equal(completeManualCheckReceipt({
      candidate: syntheticCandidate,
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { exit_code: 0 },
      options: value.receiptOptions,
    }).status, "repository-mutated");

    invalidateManualCheckReceipts({ rootPlanText: leanRoot, workspaceRoot: value.repository, options: value.receiptOptions });
    const indexCandidate = begin(value.repository);
    git(value.repository, ["add", "src/retry.mjs"]);
    assert.equal(completeManualCheckReceipt({
      candidate: indexCandidate,
      rootPlanText: leanRoot,
      workspaceRoot: value.repository,
      toolResponse: { exit_code: 0 },
      options: value.receiptOptions,
    }).status, "repository-mutated");
  } finally { value.cleanup(); }
});

test("receipt repetitions are host-counted and active proof expires after 24 hours", () => {
  const value = fixture();
  try {
    for (const output of ["first", "second"]) {
      completeManualCheckReceipt({
        candidate: begin(value.repository),
        rootPlanText: leanRoot,
        workspaceRoot: value.repository,
        toolResponse: { exit_code: 0, output },
        now: () => fixedNow,
        options: value.receiptOptions,
      });
    }
    const receipts = loadManualCheckReceipts({
      rootPlanText: leanRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: value.repository,
      now: () => new Date(fixedNow.getTime() + 23 * 60 * 60 * 1000),
      options: value.receiptOptions,
    });
    assert.deepEqual(receipts.map((entry) => entry.repetition_ordinal), [1, 2]);
    assert.equal(evidence(receipts).fields.check_evidence[0].repetitions, 2);
    assert.deepEqual(loadManualCheckReceipts({
      rootPlanText: leanRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: value.repository,
      now: () => new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000),
      options: value.receiptOptions,
    }), []);
  } finally { value.cleanup(); }
});

test("receiptless verified legacy Evidence is an explicit gap and cannot bypass duplicate closeout calibration", () => {
  const legacy = evidence([], { enforceManualCheckReceipts: false });
  const projection = manualConstraintProjection({
    checks: [{ "Check ID": "CHECK-1", Required: "yes", "Evidence Class": "machine-verifiable" }],
    evidence: legacy.fields.check_evidence,
  });
  assert.deepEqual(projection.constraint_summary.host_attested_checks, []);
  assert.deepEqual(projection.constraint_summary.evidence_gap_checks, ["CHECK-1"]);
  assert.deepEqual(projection.constraint_summary.legacy_unattested_verified_checks, ["CHECK-1"]);
  assert.equal(projection.human_attention.required, true);
  assert.match(projection.problem_details[0].resolution, /fresh review/i);
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [{ label: legacy.fields.id, text: legacy.artifact }],
    pluginRoot: defaultRoot,
  }), /receiptless verified machine Checks.*CHECK-1/i);
});
