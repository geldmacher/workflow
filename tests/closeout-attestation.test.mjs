import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  boundedEvidenceAttachmentCount,
  evaluateDeliveryCompletion,
  parseCloseoutInput,
  parseDeliveryReport,
  planCloseoutAttestationIssues,
  readCloseoutRecord,
  todoPlanCloseoutIssues,
  validateCloseoutInput,
} from "../src/core/manual-attestation.mjs";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { createContentAddressedHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { performNativeCloseout } from "../src/controller/native-closeout.mjs";
import { captureRepositorySnapshot, deriveRepositoryDelta } from "../src/core/manual-repository-snapshot.mjs";
import {
  beginManualCheckReceipt,
  completeManualCheckReceipt,
  loadManualCheckReceipts,
} from "../src/core/manual-check-receipts.mjs";
import { rootContentHash, rootPlanFingerprint } from "../src/core/root-plan-attestation.mjs";
import {
  PLAN_CLOSEOUT_REJECT_CASES,
  SHARED_LIFECYCLE_CASE_IDS,
  TEST_ROOT_CONTENT_HASH,
  TEST_ROOT_CONTENT_HASH_CRLF,
  closeoutStructured,
  correctionReviewArtifact as correctionReviewFixture,
  deliveryReportMessage,
  evidenceHash,
  finalCloseoutTodo,
  leanRoot,
  leanRootCrlf,
  makeEvidence,
  planCloseoutFence,
  sharedLifecycleCasesFor,
} from "./support/manual-attestation-fixtures.mjs";
import { validateArtifactText } from "../scripts/validate-artifact.source.mjs";

const inspect = {
  inspectArtifactText,
};

function fullRootLineage(rootPlanId = "wp-retry") {
  return {
    root_plan_id: rootPlanId,
    subject_id: rootPlanId,
    source_review_id: null,
    predecessor_evidence_id: null,
  };
}

function withLineage(extra = {}) {
  return {
    ...inspect,
    expectedLineage: fullRootLineage(),
    activeRootContentHash: TEST_ROOT_CONTENT_HASH,
    ...extra,
  };
}

test("typed plan-closeout accepts the shared fence and rejects adversarial final steps", () => {
  assert.deepEqual(planCloseoutAttestationIssues(leanRoot, { requireFinalStepSection: true }), []);
  for (const entry of PLAN_CLOSEOUT_REJECT_CASES) {
    const issues = planCloseoutAttestationIssues(entry.text, {
      requireFinalStepSection: entry.requireFinalStepSection,
    });
    assert.notEqual(issues.length, 0, entry.id);
  }
});

test("native todo plan-closeout requires typed metadata without ceremony prose", () => {
  assert.deepEqual(todoPlanCloseoutIssues(finalCloseoutTodo), []);
  assert.match(todoPlanCloseoutIssues(null).join("\n"), /structured native todo/);
  assert.match(todoPlanCloseoutIssues([]).join("\n"), /structured native todo/);
  assert.match(todoPlanCloseoutIssues({}).join("\n"), /must start.*must verify.*requires workflow_attestation/is);
  assert.deepEqual(planCloseoutAttestationIssues(finalCloseoutTodo), []);
  assert.match(
    todoPlanCloseoutIssues({
      ...finalCloseoutTodo,
      content: "[workflow-model-inherit-v1] Call workflow_closeout now.",
    }).join("\n"),
    /workflow_attestation metadata|workflow_closeout/,
  );
  assert.match(
    todoPlanCloseoutIssues({
      content: finalCloseoutTodo.content,
    }).join("\n"),
    /workflow_attestation|plan-closeout/,
  );
});

test("repository attribution excludes unchanged pre-existing paths and degrades on HEAD drift", () => {
  const baseline = {
    schema: 1,
    repository_root: defaultRoot,
    head: "a".repeat(40),
    dirty_paths: ["src/pre-existing.mjs"],
    fingerprints: { "src/pre-existing.mjs": `file:100644:${"1".repeat(64)}` },
    index_fingerprint: "2".repeat(64),
    status_fingerprint: "3".repeat(64),
    working_tree: "modified",
    captured_at: "2026-08-23T00:00:00.000Z",
  };
  const current = {
    ...baseline,
    dirty_paths: ["src/pre-existing.mjs", "src/retry.mjs"],
    fingerprints: {
      ...baseline.fingerprints,
      "src/retry.mjs": `file:100644:${"4".repeat(64)}`,
    },
    index_fingerprint: "5".repeat(64),
    status_fingerprint: "6".repeat(64),
  };
  const attributed = deriveRepositoryDelta(baseline, current);
  assert.deepEqual(attributed.changed_paths, ["src/retry.mjs"]);
  assert.deepEqual(attributed.pre_existing_paths, ["src/pre-existing.mjs"]);
  assert.equal(attributed.attribution_status, "attributed");

  const drifted = deriveRepositoryDelta(baseline, { ...current, head: "b".repeat(40) });
  assert.equal(drifted.attribution_status, "provisional");
  assert.equal(drifted.baseline_available, false);
  assert.deepEqual(drifted.attribution_reason_codes, ["head-drift"]);
  assert.deepEqual(drifted.changed_paths, current.dirty_paths);
});

const validCloseoutInput = Object.freeze({
  schema: 1,
  kind: "closeout-input",
  phase: "implementation",
  root_plan_id: "wp-retry",
  strategy_revision: 0,
  changed_paths: ["src/retry.mjs"],
  check_evidence: [{
    check_id: "CHECK-1",
    grade: "verified",
    surface: "repository",
    method: "node --test tests/codex-hook-policy.test.mjs",
    expected: "Focused tests pass.",
    observed: "Focused tests passed.",
    repetitions: 1,
    limitations: [],
  }],
  summary: "Implemented the authorized retry behavior and verified the required Check.",
});

function closeoutInputFence(value = validCloseoutInput) {
  const lines = [
    "```yaml workflow-attestation",
    `schema: ${value.schema}`,
    `kind: ${value.kind}`,
    `phase: ${value.phase}`,
    `root_plan_id: ${value.root_plan_id}`,
    `strategy_revision: ${value.strategy_revision}`,
    "changed_paths:",
    ...value.changed_paths.map((path) => `  - ${path}`),
    "check_evidence:",
    ...value.check_evidence.flatMap((entry) => [
      `  - check_id: ${entry.check_id}`,
      `    grade: ${entry.grade}`,
      `    surface: ${entry.surface}`,
      `    method: ${entry.method}`,
      `    expected: ${entry.expected}`,
      `    observed: ${entry.observed}`,
      `    repetitions: ${entry.repetitions}`,
      "    limitations: []",
    ]),
    `summary: ${value.summary}`,
    "```",
  ];
  return lines.join("\n");
}

test("closeout-input parser accepts one strict observation report and rejects authority injection", () => {
  const parsed = parseCloseoutInput(closeoutInputFence(), { expectedPhase: "implementation" });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.report, validCloseoutInput);
  const withoutPathHint = structuredClone(validCloseoutInput);
  delete withoutPathHint.changed_paths;
  assert.equal(validateCloseoutInput(withoutPathHint).ok, true);

  for (const injected of [
    { delivery_evidence_id: "de-invented" },
    { root_content_hash: "0".repeat(64) },
    { artifact_hash: "0".repeat(64) },
    { overall_grade: "verified" },
    { status: "complete" },
    { subject_id: "wp-retry" },
    { predecessor_evidence_id: null },
    { mode: "manual" },
  ]) {
    const result = validateCloseoutInput({ ...validCloseoutInput, ...injected });
    assert.equal(result.ok, false, Object.keys(injected)[0]);
    assert.match(result.issues.join("\n"), /unknown fields/);
  }
});

test("closeout-input parser rejects malformed, duplicate, indented, negated, commented, and path-drift reports", () => {
  const fence = closeoutInputFence();
  for (const candidate of [
    `${fence}\n\n${fence}`,
    fence.replace("schema: 1", "schema: ["),
    fence.split("\n").map((line) => `  ${line}`).join("\n"),
    `Do not use this closeout-input.\n\n${fence}`,
    `<!--\n${fence}\n-->`,
    fence.replace("changed_paths:\n  - src/retry.mjs", "changed_paths:\n  - ../outside"),
    fence.replace("summary:", "status: complete\nsummary:"),
  ]) {
    assert.equal(parseCloseoutInput(candidate).ok, false, candidate.slice(0, 60));
  }
});

function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function attestRootCheck(repository, receiptOptions) {
  const candidate = beginManualCheckReceipt({
    rootPlanText: leanRoot,
    pluginRoot: defaultRoot,
    workspaceRoot: repository,
    toolName: "Shell",
    toolInput: { command: "node --test tests/codex-hook-policy.test.mjs" },
  });
  assert.ok(candidate);
  const completed = completeManualCheckReceipt({
    candidate,
    rootPlanText: leanRoot,
    workspaceRoot: repository,
    toolResponse: { exit_code: 0, output: "Focused Codex hook policy tests pass.\n" },
    options: receiptOptions,
  });
  assert.equal(completed.status, "recorded");
  return loadManualCheckReceipts({
    rootPlanText: leanRoot,
    pluginRoot: defaultRoot,
    workspaceRoot: repository,
    options: receiptOptions,
  });
}

test("repository attribution detects staged changes hidden behind an unchanged worktree file", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-index-attribution-"));
  const repository = join(temporary, "repository");
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    git(repository, ["init", "--quiet"]);
    git(repository, ["add", "src/retry.mjs"]);
    git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);

    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 2;\n");
    const baseline = captureRepositorySnapshot(repository);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    git(repository, ["add", "src/retry.mjs"]);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 2;\n");

    const delta = deriveRepositoryDelta(baseline, captureRepositorySnapshot(repository));
    assert.deepEqual(delta.changed_paths, ["src/retry.mjs"]);
    assert.deepEqual(delta.pre_existing_paths, []);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("native closeout derives paths host-side and is byte-identical and idempotent with the deterministic builder", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-native-closeout-"));
  const repository = join(temporary, "repository");
  const handoffRoot = join(temporary, "handoff");
  const receiptOptions = { baseRoot: join(temporary, "receipts") };
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    git(repository, ["init", "--quiet"]);
    git(repository, ["add", "src/retry.mjs"]);
    git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    const baseline = captureRepositorySnapshot(repository);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const current = captureRepositorySnapshot(repository);
    const delta = deriveRepositoryDelta(baseline, current);
    assert.deepEqual(delta.changed_paths, ["src/retry.mjs"]);

    const report = structuredClone(validCloseoutInput);
    report.changed_paths = [];
    const receipts = attestRootCheck(repository, receiptOptions);
    const native = performNativeCloseout({
      attestation: report,
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    });
    const direct = buildDeliveryEvidence({
      rootPlanText: leanRoot,
      checkEvidence: report.check_evidence,
      changedPaths: delta.changed_paths,
      strategyRevision: report.strategy_revision,
      effectiveProfile: "manual",
      repositorySnapshot: delta.repository_snapshot,
      repositoryAttribution: {
        status: delta.attribution_status,
        boundary: delta.attribution_boundary,
        baseline_hash: delta.baseline_hash,
        reason_codes: delta.attribution_reason_codes,
      },
      summary: report.summary,
      manualCheckReceipts: receipts,
      pluginRoot: defaultRoot,
    });
    assert.equal(native.artifact, direct.artifact);
    assert.equal(native.artifact_hash, direct.artifact_hash);
    assert.equal(native.handoff_persisted, true);
    assert.deepEqual(native.fields.changed_paths, ["src/retry.mjs"]);

    const duplicate = performNativeCloseout({
      attestation: report,
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.artifact, native.artifact);

    assert.throws(() => performNativeCloseout({
      attestation: { ...report, phase: "review-recovery" },
      expectedPhase: "review-recovery",
      rootPlanText: leanRoot,
      repositoryDelta: deriveRepositoryDelta(null, current),
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    }), /stale|competing|conflict/i);

    const unusableHandoff = join(temporary, "handoff-is-a-file");
    writeFileSync(unusableHandoff, "not a directory\n");
    attestRootCheck(repository, receiptOptions);
    const taskLocal = performNativeCloseout({
      attestation: report,
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: unusableHandoff },
      receiptOptions,
    });
    assert.equal(taskLocal.handoff_persisted, false);
    assert.equal(taskLocal.artifact, native.artifact);
    assert.match(taskLocal.warning, /task-local continuation remains valid/);

    assert.throws(() => performNativeCloseout({
      attestation: {
        ...report,
        check_evidence: [{ ...report.check_evidence[0], observed: "A competing observation." }],
      },
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    }), /stale|competing|conflict/i);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("baseline-less review recovery is provisional, preserves failures, and blocks implementation or authority drift", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-review-recovery-"));
  const repository = join(temporary, "repository");
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    git(repository, ["init", "--quiet"]);
    git(repository, ["add", "src/retry.mjs"]);
    git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const current = captureRepositorySnapshot(repository);
    const delta = deriveRepositoryDelta(null, current);
    const report = {
      ...structuredClone(validCloseoutInput),
      phase: "review-recovery",
    };
    const provisional = performNativeCloseout({
      attestation: report,
      expectedPhase: "review-recovery",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: join(temporary, "provisional-handoff") },
    });
    assert.equal(provisional.fields.status, "provisional");
    assert.equal(provisional.fields.overall_grade, "supported");
    assert.match(provisional.artifact, /No pre-mutation repository baseline/);

    const failed = performNativeCloseout({
      attestation: {
        ...report,
        check_evidence: [{ ...report.check_evidence[0], grade: "failed", observed: "Focused tests failed." }],
      },
      expectedPhase: "review-recovery",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: join(temporary, "failed-handoff") },
    });
    assert.equal(failed.fields.status, "blocked");
    assert.equal(failed.fields.overall_grade, "failed");

    assert.throws(() => performNativeCloseout({
      attestation: { ...report, phase: "implementation" },
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: delta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: join(temporary, "implementation-handoff") },
    }), /pre-mutation repository baseline/);

    writeFileSync(join(repository, "outside.txt"), "outside\n");
    const drift = deriveRepositoryDelta(null, captureRepositorySnapshot(repository));
    assert.throws(() => performNativeCloseout({
      attestation: {
        ...report,
        changed_paths: [],
      },
      expectedPhase: "review-recovery",
      rootPlanText: leanRoot,
      repositoryDelta: drift,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: join(temporary, "authority-handoff") },
    }), /outside Root authority/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("native correction resolves the current linear review tip and emits delta Evidence", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-native-correction-"));
  const repository = join(temporary, "repository");
  const handoffRoot = join(temporary, "handoff");
  const receiptOptions = { baseRoot: join(temporary, "receipts") };
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    git(repository, ["init", "--quiet"]);
    git(repository, ["add", "src/retry.mjs"]);
    git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    const initialBaseline = captureRepositorySnapshot(repository);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 2;\n");
    const initialDelta = deriveRepositoryDelta(initialBaseline, captureRepositorySnapshot(repository));
    attestRootCheck(repository, receiptOptions);
    const initial = performNativeCloseout({
      attestation: structuredClone(validCloseoutInput),
      expectedPhase: "implementation",
      rootPlanText: leanRoot,
      repositoryDelta: initialDelta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    });
    const review = correctionReviewFixture({ latestEvidenceId: initial.fields.id });
    const store = createContentAddressedHandoffStore(leanRoot, defaultRoot, { baseRoot: handoffRoot });
    store.record([{ label: "review", text: review }]);

    const correctionBaseline = captureRepositorySnapshot(repository);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const correctionDelta = deriveRepositoryDelta(correctionBaseline, captureRepositorySnapshot(repository));
    attestRootCheck(repository, receiptOptions);
    const correction = performNativeCloseout({
      attestation: {
        schema: 1,
        kind: "closeout-input",
        phase: "correction",
        root_plan_id: "wp-retry",
        strategy_revision: 1,
        changed_paths: ["src/retry.mjs"],
        check_evidence: [
          {
            check_id: "CHECK-101",
            grade: "verified",
            surface: "repository",
            method: "node --test",
            expected: "pass",
            observed: "Correction Check passed.",
            repetitions: 1,
            limitations: [],
          },
          {
            check_id: "CHECK-1",
            grade: "verified",
            surface: "repository",
            method: "node --test tests/codex-hook-policy.test.mjs",
            expected: "Focused Codex hook policy tests pass.",
            observed: "Affected Root Check passed on the corrected state.",
            repetitions: 1,
            limitations: [],
          },
        ],
        summary: "Applied and verified the authorized correction.",
      },
      expectedPhase: "correction",
      rootPlanText: leanRoot,
      repositoryDelta: correctionDelta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    });
    assert.equal(correction.fields.representation, "delta");
    assert.equal(correction.fields.subject_id, "cp-retry");
    assert.equal(correction.fields.source_review_id, "wr-retry");
    assert.equal(correction.fields.predecessor_evidence_id, initial.fields.id);
    assert.deepEqual(correction.fields.executed_checks, ["CHECK-101", "CHECK-1"]);
    assert.deepEqual(correction.fields.reused_checks, []);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("native correction requires and refreshes inherited non-passed Root Checks", () => {
  const temporary = mkdtempSync(join(tmpdir(), "workflow-native-root-refresh-"));
  const repository = join(temporary, "repository");
  const handoffRoot = join(temporary, "handoff");
  const receiptOptions = { baseRoot: join(temporary, "receipts") };
  try {
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 1;\n");
    git(repository, ["init", "--quiet"]);
    git(repository, ["add", "src/retry.mjs"]);
    git(repository, ["-c", "user.name=Workflow Test", "-c", "user.email=workflow@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 2;\n");
    const initialCurrent = captureRepositorySnapshot(repository);
    const initial = performNativeCloseout({
      attestation: { ...structuredClone(validCloseoutInput), phase: "review-recovery" },
      expectedPhase: "review-recovery",
      rootPlanText: leanRoot,
      repositoryDelta: deriveRepositoryDelta(null, initialCurrent),
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
    });
    assert.equal(initial.fields.overall_grade, "supported");
    const store = createContentAddressedHandoffStore(leanRoot, defaultRoot, { baseRoot: handoffRoot });
    store.record([{ label: "review", text: correctionReviewFixture({ latestEvidenceId: initial.fields.id }) }]);

    const correctionBaseline = captureRepositorySnapshot(repository);
    writeFileSync(join(repository, "src/retry.mjs"), "export const retries = 3;\n");
    const correctionDelta = deriveRepositoryDelta(correctionBaseline, captureRepositorySnapshot(repository));
    const sharedObservation = {
      grade: "verified",
      surface: "repository",
      method: "one current equivalent probe",
      expected: "pass",
      observed: "The shared correction and Root probe passed.",
      repetitions: 1,
      limitations: [],
    };
    const correctionInput = {
      schema: 1,
      kind: "closeout-input",
      phase: "correction",
      root_plan_id: "wp-retry",
      strategy_revision: 1,
      changed_paths: ["src/retry.mjs"],
      check_evidence: [{ check_id: "CHECK-101", ...sharedObservation }],
      summary: "Applied the correction and observed the current verification probe.",
    };
    assert.throws(() => performNativeCloseout({
      attestation: correctionInput,
      expectedPhase: "correction",
      rootPlanText: leanRoot,
      repositoryDelta: correctionDelta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    }), /fresh evidence for affected, failed, missing, stale, or ambiguous Root Checks: CHECK-1/);

    attestRootCheck(repository, receiptOptions);
    const correction = performNativeCloseout({
      attestation: {
        ...correctionInput,
        check_evidence: [
          ...correctionInput.check_evidence,
          { check_id: "CHECK-1", ...sharedObservation },
        ],
      },
      expectedPhase: "correction",
      rootPlanText: leanRoot,
      repositoryDelta: correctionDelta,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: handoffRoot },
      receiptOptions,
    });
    assert.equal(correction.fields.status, "complete");
    assert.deepEqual(correction.fields.executed_checks, ["CHECK-101", "CHECK-1"]);
    assert.deepEqual(correction.fields.reused_checks, []);
    assert.equal(new Set(correction.fields.check_evidence.map((entry) => entry.observed)).size, 1);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("readCloseoutRecord requires the full structured identity envelope and raw digest", () => {
  const artifact = makeEvidence({ id: "de-attest", subjectId: "wp-retry" });
  const ok = readCloseoutRecord({ structuredContent: closeoutStructured(artifact) }, withLineage());
  assert.equal(ok.ok, true);
  assert.equal(ok.record.id, "de-attest");

  const missingRoot = readCloseoutRecord({
    structuredContent: {
      delivery_evidence_id: "de-attest",
      artifact,
      artifact_hash: evidenceHash(artifact),
      status: "complete",
      handoff_persisted: true,
    },
  }, withLineage());
  assert.equal(missingRoot.ok, false);

  const badHash = readCloseoutRecord({
    structuredContent: closeoutStructured(artifact, {
      artifact_hash: evidenceHash("other"),
    }),
  }, withLineage());
  assert.equal(badHash.ok, false);
  assert.equal(badHash.reason, "artifact-hash-mismatch");

  const provisionalArtifact = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: [{
      check_id: "CHECK-1",
      grade: "supported",
      observed: "Static evidence supports the change, but runtime proof is limited.",
      repetitions: 0,
      limitations: ["Runtime proof unavailable."],
    }],
    changedPaths: ["src/retry.mjs"],
    strategyRevision: 0,
    effectiveProfile: "manual",
    summary: "Delivery remains provisional.",
    pluginRoot: defaultRoot,
  }).artifact;
  const provisional = readCloseoutRecord(
    { structuredContent: closeoutStructured(provisionalArtifact) },
    withLineage({
      inspectArtifactText: (text, root) => {
        const inspected = inspectArtifactText(text, root);
        return {
          ...inspected,
          normalizations: (inspected.normalizations ?? []).filter((entry) => !/^lean evidence: interpreted /.test(entry)),
        };
      },
    }),
  );
  assert.equal(provisional.ok, true);
  assert.equal(provisional.record.status, "provisional");
});

test("readCloseoutRecord always binds full-root or correction lineage", () => {
  const correction = makeEvidence({
    id: "de-fix",
    subjectId: "cp-retry",
    sourceReviewId: "wr-retry",
    predecessorEvidenceId: "de-prior",
    representation: "delta",
  });
  const omitted = readCloseoutRecord(
    { structuredContent: closeoutStructured(correction) },
    inspect,
  );
  assert.equal(omitted.ok, false);
  assert.equal(omitted.reason, "missing-expected-lineage");

  const foreignWithoutTip = readCloseoutRecord(
    { structuredContent: closeoutStructured(correction) },
    withLineage(),
  );
  assert.equal(foreignWithoutTip.ok, false);
  assert.equal(foreignWithoutTip.reason, "lineage-subject-mismatch");

  const fullRoot = makeEvidence({ id: "de-root", subjectId: "wp-retry" });
  const fullOk = readCloseoutRecord(
    { structuredContent: closeoutStructured(fullRoot) },
    withLineage(),
  );
  assert.equal(fullOk.ok, true);

  const missingHash = readCloseoutRecord(
    { structuredContent: closeoutStructured(fullRoot, { root_content_hash: undefined }) },
    withLineage(),
  );
  assert.equal(missingHash.ok, false);
  assert.equal(missingHash.reason, "missing-root-content-hash");

  const hashMismatch = readCloseoutRecord(
    { structuredContent: closeoutStructured(fullRoot, { root_content_hash: "0".repeat(64) }) },
    withLineage({ activeRootContentHash: "1".repeat(64) }),
  );
  assert.equal(hashMismatch.ok, false);
  assert.equal(hashMismatch.reason, "root-content-hash-mismatch");

  const correctionOk = readCloseoutRecord(
    { structuredContent: closeoutStructured(correction) },
    withLineage({
      expectedLineage: {
        root_plan_id: "wp-retry",
        subject_id: "cp-retry",
        source_review_id: "wr-retry",
        predecessor_evidence_id: "de-prior",
      },
    }),
  );
  assert.equal(correctionOk.ok, true);

  const withTip = readCloseoutRecord(
    { structuredContent: closeoutStructured(correction) },
    withLineage({
      expectedLineage: {
        root_plan_id: "wp-retry",
        subject_id: "cp-other",
        source_review_id: "wr-retry",
        predecessor_evidence_id: "de-prior",
      },
    }),
  );
  assert.equal(withTip.ok, false);
  assert.equal(withTip.reason, "lineage-subject-mismatch");
});

test("readCloseoutRecord rejects text transport and conflicting structuredContent", () => {
  const artifact = makeEvidence({ id: "de-text" });
  const structured = closeoutStructured(artifact);
  assert.equal(readCloseoutRecord({ delivery_evidence_id: "de-text", artifact, artifact_hash: evidenceHash(artifact), root_plan_id: "wp-retry", status: "complete", handoff_persisted: true }, withLineage()).ok, false);
  assert.equal(readCloseoutRecord({
    content: [{ text: JSON.stringify({ structuredContent: structured }) }],
  }, withLineage()).ok, false);
  assert.equal(readCloseoutRecord({
    content: [
      { structuredContent: structured },
      { structuredContent: { ...structured, delivery_evidence_id: "de-other" } },
    ],
  }, withLineage()).ok, false);
  assert.equal(readCloseoutRecord({ structuredContent: structured }, withLineage()).ok, true);
  assert.equal(readCloseoutRecord({ structuredContent: structured }, inspect).reason, "missing-expected-lineage");
});

test("delivery-report attestation and bounded attachments enforce persistence rules", () => {
  const artifact = makeEvidence({ id: "de-report" });
  const turn = {
    closeout_recorded: true,
    delivery_evidence_id: "de-report",
    delivery_evidence_artifact: artifact,
    handoff_persisted: true,
    active_root_plan_id: "wp-retry",
    delivery_evidence_root_plan_id: "wp-retry",
  };
  assert.equal(evaluateDeliveryCompletion(deliveryReportMessage("de-report"), turn).ok, true);
  assert.equal(evaluateDeliveryCompletion(deliveryReportMessage("de-other"), turn).ok, false);
  assert.equal(parseDeliveryReport("Closeout: de-report").ok, false);
  assert.equal(
    evaluateDeliveryCompletion(deliveryReportMessage("de-report", { artifact }), turn).ok,
    false,
  );

  const unpersisted = { ...turn, handoff_persisted: false };
  assert.equal(evaluateDeliveryCompletion(deliveryReportMessage("de-report"), unpersisted).ok, true);
  assert.equal(
    evaluateDeliveryCompletion(deliveryReportMessage("de-report", { artifact }), unpersisted).ok,
    true,
  );
  assert.equal(
    evaluateDeliveryCompletion(
      `${deliveryReportMessage("de-report", { artifact })}\nPREFIX${artifact}SUFFIX\n`,
      unpersisted,
    ).ok,
    false,
  );
  assert.equal(
    evaluateDeliveryCompletion(
      `${deliveryReportMessage("de-report")}\nPREFIX${artifact}SUFFIX\n`,
      { ...turn, handoff_persisted: true },
    ).ok,
    false,
  );
  assert.equal(boundedEvidenceAttachmentCount(`\`\`\`yaml\n${artifact}\`\`\`\n`, artifact), 1);
  assert.equal(boundedEvidenceAttachmentCount(`PREFIX${artifact}SUFFIX`, artifact), 0);
  assert.match(planCloseoutFence, /yaml workflow-attestation/);
});

test("ordinary planning prose Todo is not an unfinished-content token", () => {
  const withTodo = leanRoot.replace(
    "Add retries for transient MCP tool failures.",
    "Add retries for transient MCP tool failures using native Todo metadata.",
  );
  assert.deepEqual(validateArtifactText(withTodo), []);
  assert.ok(SHARED_LIFECYCLE_CASE_IDS.includes("foreign-full-root-lineage"));
});

test("raw Root identity differs for CRLF while semantic fingerprint may alias", () => {
  assert.notEqual(TEST_ROOT_CONTENT_HASH, TEST_ROOT_CONTENT_HASH_CRLF);
  assert.equal(rootContentHash(leanRoot), TEST_ROOT_CONTENT_HASH);
  assert.equal(rootContentHash(leanRootCrlf), TEST_ROOT_CONTENT_HASH_CRLF);
  assert.equal(rootPlanFingerprint(leanRoot), rootPlanFingerprint(leanRootCrlf));
});

test("shared lifecycle matrix executes on the kernel surface", () => {
  const executed = [];
  for (const entry of sharedLifecycleCasesFor("kernel")) {
    executed.push(entry.id);
    if (entry.id === "same-id-root-hash-mismatch") {
      const artifact = makeEvidence({ id: "de-hash", subjectId: "wp-retry" });
      const mismatch = readCloseoutRecord(
        { structuredContent: closeoutStructured(artifact, { root_content_hash: "0".repeat(64) }) },
        withLineage({ activeRootContentHash: "1".repeat(64) }),
      );
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.reason, "root-content-hash-mismatch");
      continue;
    }
    if (entry.id === "crlf-active-root-hash-mismatch") {
      const artifact = makeEvidence({ id: "de-crlf", subjectId: "wp-retry" });
      const mismatch = readCloseoutRecord(
        { structuredContent: closeoutStructured(artifact, { root_content_hash: TEST_ROOT_CONTENT_HASH }) },
        withLineage({ activeRootContentHash: TEST_ROOT_CONTENT_HASH_CRLF }),
      );
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.reason, "root-content-hash-mismatch");
      continue;
    }
    if (entry.id === "foreign-full-root-lineage") {
      const correction = makeEvidence({
        id: "de-fix",
        subjectId: "cp-retry",
        sourceReviewId: "wr-retry",
        predecessorEvidenceId: "de-prior",
        representation: "delta",
      });
      const foreign = readCloseoutRecord(
        { structuredContent: closeoutStructured(correction) },
        withLineage(),
      );
      assert.equal(foreign.ok, false);
      assert.equal(foreign.reason, "lineage-subject-mismatch");
      continue;
    }
    if (entry.id === "text-transport-authority") {
      const artifact = makeEvidence({ id: "de-text" });
      assert.equal(readCloseoutRecord({
        content: [{ text: JSON.stringify({ structuredContent: closeoutStructured(artifact) }) }],
      }, withLineage()).ok, false);
      continue;
    }
    if (entry.id === "conflicting-structured-content") {
      const artifact = makeEvidence({ id: "de-conflict" });
      const structured = closeoutStructured(artifact);
      assert.equal(readCloseoutRecord({
        content: [
          { structuredContent: structured },
          { structuredContent: { ...structured, delivery_evidence_id: "de-other" } },
        ],
      }, withLineage()).ok, false);
      continue;
    }
    if (entry.id === "persisted-artifact-dump") {
      const artifact = makeEvidence({ id: "de-dump" });
      const turn = {
        closeout_recorded: true,
        delivery_evidence_id: "de-dump",
        delivery_evidence_artifact: artifact,
        handoff_persisted: true,
        active_root_plan_id: "wp-retry",
      };
      assert.equal(evaluateDeliveryCompletion(deliveryReportMessage("de-dump", { artifact }), turn).ok, false);
      continue;
    }
    if (entry.id === "unpersisted-duplicate-occurrence") {
      const artifact = makeEvidence({ id: "de-dup" });
      const turn = {
        closeout_recorded: true,
        delivery_evidence_id: "de-dup",
        delivery_evidence_artifact: artifact,
        handoff_persisted: false,
        active_root_plan_id: "wp-retry",
      };
      const message = `${deliveryReportMessage("de-dup")}\n\`\`\`yaml\n${artifact}\`\`\`\n\`\`\`yaml\n${artifact}\`\`\`\n`;
      assert.equal(evaluateDeliveryCompletion(message, turn).ok, false);
      continue;
    }
    if (entry.id === "missing-active-root") {
      const artifact = makeEvidence({ id: "de-missing-active" });
      const missing = readCloseoutRecord(
        { structuredContent: closeoutStructured(artifact) },
        { ...inspect, expectedLineage: fullRootLineage() },
      );
      assert.equal(missing.ok, false);
      assert.equal(missing.reason, "missing-active-root-content-hash");
      continue;
    }
    if (entry.id === "foreign-active-root") {
      const artifact = makeEvidence({ id: "de-foreign-active", rootPlanId: "wp-other", subjectId: "wp-other" });
      const foreign = readCloseoutRecord(
        { structuredContent: closeoutStructured(artifact) },
        withLineage({
          activeRootPlanId: "wp-retry",
          activeRootContentHash: TEST_ROOT_CONTENT_HASH,
          closeoutRootPlanId: "wp-other",
          expectedLineage: fullRootLineage("wp-other"),
        }),
      );
      assert.equal(foreign.ok, false);
      assert.equal(foreign.reason, "active-root-mismatch");
      continue;
    }
    assert.fail(`unhandled shared lifecycle case: ${entry.id}`);
  }
  assert.deepEqual(executed, sharedLifecycleCasesFor("kernel").map((entry) => entry.id));
  assert.ok(SHARED_LIFECYCLE_CASE_IDS.includes("mutate-after-closeout"));
});
