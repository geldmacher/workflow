import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildWorkReview,
  normalizeReviewInput,
  parseReviewInputFromText,
  persistWorkReview,
} from "../src/controller/work-review-builder.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { ArtifactHandoffStore, createContentAddressedHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { performNativeReview } from "../src/controller/native-review.mjs";
import { createManualBoundaryReceipt, verifyManualBoundaryReceipt } from "../src/core/manual-boundary-receipts.mjs";
import {
  defaultRoot,
  executionContractFromArtifactText,
  inspectArtifactSet,
} from "../scripts/validate-artifact.source.mjs";

const fixtureRoot = join(defaultRoot, "tests", "fixtures", "artifacts");
const read = (name) => readFileSync(join(fixtureRoot, name), "utf8");
const rootPlanText = read("work-plan.valid.md");
const evidenceText = read("delivery-evidence.valid.md");

function achievedInput(overrides = {}) {
  return {
    schema: 1,
    kind: "review-input",
    assessment: "achieved",
    recommended_action: "none",
    assessment_summary: "All Root outcomes are satisfied by the exact verified Evidence.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The Evidence snapshot matches the reviewed repository state.",
    findings: [],
    missing_evidence: [],
    auditor_reports: [],
    ...overrides,
  };
}

function correctionInput() {
  return achievedInput({
    assessment: "mostly-achieved",
    recommended_action: "correct",
    assessment_summary: "One bounded retry assertion is missing.",
    findings: [{
      key: "missing-retry-assertion",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The exact test surface omits the required assertion.",
      reasoning: "The Root acceptance cannot be established without it.",
      resolution: "correct",
    }],
    correction: {
      fixes: [{
        key: "add-retry-assertion",
        finding_keys: ["missing-retry-assertion"],
        required_outcome: "The retry boundary is asserted deterministically.",
        evidence: "The finding identifies one in-scope test gap.",
      }],
      checks: [{
        key: "verify-retry-assertion",
        fix_keys: ["add-retry-assertion"],
        working_directory: "repository root",
        command_or_inspection: "node --test tests/retry.test.mjs",
        expected_result: "The retry boundary test passes.",
        required: true,
        cost_class: "standard",
        prerequisites: ["src", "tests"],
      }],
      steps: [{
        key: "implement-retry-assertion",
        fix_keys: ["add-retry-assertion"],
        targets: ["tests"],
        required_outcome: "Add only the missing retry boundary assertion.",
        implementation_latitude: "Use the existing test matrix.",
        completion_probe: "The new case is present and passes.",
        check_keys: ["verify-retry-assertion"],
        deviation_action: "Stop and replan if production behavior must change.",
      }],
      learning_candidates: [{
        key: "retry-boundary-matrix",
        finding_keys: ["missing-retry-assertion"],
        reusable_guidance: "Include boundary inputs in deterministic retry tests.",
        candidate_targets: ["tests"],
        confirmation_evidence: "The focused correction check passes.",
      }],
    },
  });
}

test("host-owned review bytes, ID, and hashes are deterministic over normalized semantics", () => {
  const first = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: achievedInput(),
    pluginRoot: defaultRoot,
  });
  const reordered = buildWorkReview({
    rootPlanText,
    artifacts: [{ label: "arbitrary-transport-label", text: evidenceText }],
    reviewInput: {
      auditor_reports: [],
      findings: [],
      snapshot_summary: "The Evidence snapshot matches the reviewed repository state.",
      assessment_summary: "All Root outcomes are satisfied by the exact verified Evidence.",
      recommended_action: "none",
      kind: "review-input",
      missing_evidence: [],
      schema: 1,
      snapshot_assessment: "consistent",
      assessment: "achieved",
    },
    pluginRoot: defaultRoot,
  });

  assert.equal(first.artifact, reordered.artifact);
  assert.equal(first.fields.id, reordered.fields.id);
  assert.equal(first.artifact_hash, reordered.artifact_hash);
  assert.equal(first.review_input_hash, reordered.review_input_hash);
  assert.match(first.fields.id, /^wr-adaptive-retry-[a-f0-9]{12}$/);
  assert.equal(first.fields.delivery_status, "verified");
  assert.equal(first.fields.next_action, "none");
  assert.doesNotMatch(first.artifact, /created_at|timestamp|20\d\d-\d\d-\d\dT/);
  assert.deepEqual(inspectArtifactSet([
    ["root", rootPlanText],
    ["evidence", evidenceText],
    ["review", first.artifact],
  ], defaultRoot).errors, []);
});

test("canonical review ordering is independent from host locale collation", () => {
  const contract = executionContractFromArtifactText(rootPlanText, defaultRoot);
  const normalized = normalizeReviewInput(achievedInput({
    missing_evidence: ["ä-proof", "z-proof", "ä-proof"],
  }), contract);
  assert.deepEqual(normalized.missing_evidence, ["z-proof", "ä-proof"]);

  const first = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: achievedInput({ missing_evidence: ["ä-proof", "z-proof"] }),
    pluginRoot: defaultRoot,
  });
  const reordered = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: achievedInput({ missing_evidence: ["z-proof", "ä-proof"] }),
    pluginRoot: defaultRoot,
  });
  assert.equal(first.review_input_hash, reordered.review_input_hash);
  assert.equal(first.fields.id, reordered.fields.id);
  assert.equal(first.artifact, reordered.artifact);
});

test("changed semantic input or exact chain bytes produce a different immutable review", () => {
  const baseline = buildWorkReview({ rootPlanText, artifacts: [{ text: evidenceText }], reviewInput: achievedInput(), pluginRoot: defaultRoot });
  const changedSemantics = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: achievedInput({ assessment_summary: "The same result was assessed with materially different semantics." }),
    pluginRoot: defaultRoot,
  });
  const changedEvidence = evidenceText.replace("Passed twice", "Passed deterministically twice");
  const changedChain = buildWorkReview({ rootPlanText, artifacts: [{ text: changedEvidence }], reviewInput: achievedInput(), pluginRoot: defaultRoot });

  assert.notEqual(changedSemantics.fields.id, baseline.fields.id);
  assert.notEqual(changedSemantics.artifact_hash, baseline.artifact_hash);
  assert.notEqual(changedChain.fields.id, baseline.fields.id);
});

test("reviewer claims never upgrade incomplete Evidence", () => {
  const provisionalEvidence = evidenceText
    .replace("status: complete", "status: provisional")
    .replace("overall_grade: verified", "overall_grade: supported")
    .replace("grade: verified", "grade: supported");
  const review = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: provisionalEvidence }],
    reviewInput: achievedInput(),
    pluginRoot: defaultRoot,
  });

  assert.equal(review.fields.assessment, "provisional");
  assert.equal(review.fields.delivery_status, "provisional");
  assert.equal(review.fields.next_action, "accept-provisional");
});

test("correction identifiers are host-derived from local semantic keys", () => {
  const review = buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: correctionInput(),
    pluginRoot: defaultRoot,
  });

  assert.equal(review.fields.next_action, "correct");
  assert.match(review.fields.correction_id, /^cp-adaptive-retry-[a-f0-9]{12}$/);
  assert.match(review.artifact, /\| FIX-1 \| missing-retry-assertion \|/);
  assert.match(review.artifact, /\| STEP-1 \| FIX-1 \| tests \|/);
  assert.match(review.artifact, /\| CHECK-2 \| FIX-1 \|/);
  assert.match(review.artifact, /LRN-[a-f0-9]{8}-1/);
  assert.deepEqual(inspectArtifactSet([
    ["root", rootPlanText],
    ["evidence", evidenceText],
    ["review", review.artifact],
  ], defaultRoot).errors, []);
});

test("closed review input rejects model-owned authority and full review envelopes", () => {
  const contract = executionContractFromArtifactText(rootPlanText, defaultRoot);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), root_plan_id: "wp-adaptive-retry" }, contract), /unsupported field root_plan_id/);
  assert.throws(() => normalizeReviewInput({ schema: 1, kind: "review-input", assessment: "achieved", recommended_action: "none" }, contract), /assessment_summary is required|findings is required/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), findings: null }, contract), /review_input\.findings must be an array/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), missing_evidence: null }, contract), /review_input\.missing_evidence must be an array/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), auditor_reports: null }, contract), /review_input\.auditor_reports must be an array/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), auditor_reports: [{ role: "delivery-auditor", assessment: "looks-good", summary: "Unstructured verdict." }] }, contract), /auditor_reports\[0\]\.assessment has invalid value/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), assessment_summary: 7 }, contract), /review_input\.assessment_summary must be a string/);
  assert.throws(() => normalizeReviewInput({ ...achievedInput(), snapshot_summary: { claim: "consistent" } }, contract), /review_input\.snapshot_summary must be a string/);
  assert.deepEqual(parseReviewInputFromText(`\`\`\`json workflow-review-input\n${JSON.stringify(achievedInput())}\n\`\`\``).issues, []);
  assert.equal(parseReviewInputFromText(read("work-review.valid.md")).ok, false);
  assert.match(parseReviewInputFromText("```json workflow-review-input\n{bad}\n```").issues.join("\n"), /JSON is invalid/);
});

test("high-risk Roots require delivery and risk auditor reports", () => {
  const highRiskRoot = rootPlanText.replace("risk: medium", "risk: high");
  const highRiskEvidence = buildDeliveryEvidence({
    rootPlanText: highRiskRoot,
    checkEvidence: [{
      check_id: "CHECK-1",
      grade: "verified",
      surface: "repository-test",
      method: "deterministic command",
      expected: "Retry verification passes twice",
      observed: "Passed twice",
      repetitions: 2,
      artifact_hashes: ["b".repeat(64)],
      limitations: [],
    }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "supervised",
    repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "none", known_failures: "none" },
    pluginRoot: defaultRoot,
  });
  assert.throws(() => buildWorkReview({
    rootPlanText: highRiskRoot,
    artifacts: [{ text: highRiskEvidence.artifact }],
    reviewInput: achievedInput(),
    pluginRoot: defaultRoot,
  }), /high-risk.*delivery-auditor and risk-auditor/);

  assert.throws(() => buildWorkReview({
    rootPlanText: highRiskRoot,
    artifacts: [{ text: highRiskEvidence.artifact }],
    reviewInput: achievedInput({ auditor_reports: [
      { role: "delivery-auditor", assessment: "not-achieved", summary: "The delivery auditor rejects the result." },
      { role: "risk-auditor", assessment: "not-achieved", summary: "The risk auditor rejects the result." },
    ] }),
    pluginRoot: defaultRoot,
  }), /assessment achieved is more positive than.*delivery-auditor.*not-achieved/);

  const full = buildWorkReview({
    rootPlanText: highRiskRoot,
    artifacts: [{ text: highRiskEvidence.artifact }],
    reviewInput: achievedInput({ auditor_reports: [
      { role: "delivery-auditor", assessment: "achieved", summary: "Delivery evidence and acceptance were inspected." },
      { role: "risk-auditor", assessment: "achieved", summary: "High-risk boundaries and failure modes were inspected." },
    ] }),
    pluginRoot: defaultRoot,
  });
  assert.equal(full.fields.review_route, "full");
  assert.deepEqual(full.fields.auditors_run, ["inline", "delivery-auditor", "risk-auditor"]);
  assert.deepEqual(inspectArtifactSet([
    ["root", highRiskRoot],
    ["evidence", highRiskEvidence.artifact],
    ["review", full.artifact],
  ], defaultRoot).errors, []);
});

test("review input contradictions never upgrade a negative assessment", () => {
  assert.throws(() => buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    reviewInput: achievedInput({
      assessment: "not-achieved",
      recommended_action: "none",
      assessment_summary: "The reviewer explicitly rejects the result.",
    }),
    pluginRoot: defaultRoot,
  }), /assessment not-achieved is inconsistent with.*recommended_action none/);
});

test("new raw Reviews are rejected while protected legacy history remains readable", () => {
  const rawReview = read("work-review.valid.md");
  assert.throws(() => buildWorkReview({
    rootPlanText,
    artifacts: [{ text: evidenceText }, { text: rawReview }],
    reviewInput: achievedInput(),
    pluginRoot: defaultRoot,
  }), /rejects newly imported work-review wr-adaptive-retry without protected builder provenance/);

  const directory = mkdtempSync(join(tmpdir(), "workflow-review-builder-legacy-history-"));
  try {
    const store = new ArtifactHandoffStore(directory, defaultRoot);
    store.record([
      { label: "root", text: rootPlanText },
      { label: "evidence", text: evidenceText },
      { label: "historical-review", text: rawReview },
    ]);
    const context = store.context("wp-adaptive-retry", rootPlanText);
    const historical = context.artifacts.find((entry) => entry.label === "wr-adaptive-retry");
    assert.equal(historical.legacy_review_recorded, true);
    const rebuilt = buildWorkReview({
      rootPlanText,
      artifacts: context.artifacts,
      reviewInput: achievedInput({ assessment_summary: "The protected historical chain was freshly reviewed." }),
      pluginRoot: defaultRoot,
    });
    assert.equal(rebuilt.fields.predecessor_review_id, "wr-adaptive-retry");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("native Review counts only host-observed auditor roles", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-native-review-auditor-"));
  const reviewInput = achievedInput({
    auditor_reports: [{ role: "delivery-auditor", assessment: "achieved", summary: "The delivery auditor found no remaining gap." }],
  });
  try {
    assert.throws(() => performNativeReview({
      rootPlanText,
      artifacts: [{ text: evidenceText }],
      reviewInput,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: directory },
    }), /no host-observed native auditor completion/);
    const observed = performNativeReview({
      rootPlanText,
      artifacts: [{ text: evidenceText }],
      reviewInput,
      hostObservedAuditorRoles: ["delivery-auditor"],
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: directory },
    });
    assert.equal(observed.fields.review_route, "targeted");
    assert.deepEqual(observed.fields.auditors_run, ["inline", "delivery-auditor"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("task-local Evidence prevents optional cache from injecting a predecessor Review", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-native-review-cache-priority-"));
  try {
    const store = createContentAddressedHandoffStore(rootPlanText, defaultRoot, { baseRoot: directory });
    const prior = buildWorkReview({
      rootPlanText,
      artifacts: [{ text: evidenceText }],
      reviewInput: achievedInput({ assessment_summary: "A prior task recorded this independent assessment." }),
      pluginRoot: defaultRoot,
    });
    persistWorkReview({ handoffStore: store, rootPlanText, artifacts: [{ text: evidenceText }], review: prior });
    const currentInput = achievedInput({ assessment_summary: "The current task recorded a fresh independent assessment." });
    const taskLocal = buildWorkReview({ rootPlanText, artifacts: [{ text: evidenceText }], reviewInput: currentInput, pluginRoot: defaultRoot });
    const native = performNativeReview({
      rootPlanText,
      artifacts: [{ text: evidenceText }],
      reviewInput: currentInput,
      pluginRoot: defaultRoot,
      handoffOptions: { baseRoot: directory },
    });
    assert.equal(native.fields.predecessor_review_id, null);
    assert.equal(native.fields.id, taskLocal.fields.id);
    assert.equal(native.artifact, taskLocal.artifact);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("root-boundary reviews are built only from a protected host receipt", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-review-builder-boundary-"));
  const workspace = join(directory, "workspace");
  mkdirSync(workspace);
  const snapshot = {
    schema: 1,
    repository_root: workspace,
    head: "1".repeat(40),
    dirty_paths: ["unexpected/outside.txt"],
    fingerprints: { "unexpected/outside.txt": "file:test" },
    index_fingerprint: "2".repeat(64),
    status_fingerprint: "3".repeat(64),
  };
  const options = { baseRoot: join(directory, "state") };
  const now = () => new Date("2026-08-12T10:00:00.000Z");
  try {
    const receipt = createManualBoundaryReceipt({
      rootPlanText,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      recoveryErrorCode: "authority-violation",
      captureSnapshot: () => snapshot,
      now,
      options,
    });
    const verifier = ({ receipt: candidate, rootPlanText: candidateRoot }) => verifyManualBoundaryReceipt({
      receipt: candidate,
      rootPlanText: candidateRoot,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      captureSnapshot: () => snapshot,
      now,
      options,
    });
    const review = buildWorkReview({ rootPlanText, boundaryReceipt: receipt, boundaryReceiptVerifier: verifier, pluginRoot: defaultRoot });
    assert.equal(review.fields.latest_evidence_id, null);
    assert.equal(review.fields.delivery_status, "blocked");
    assert.equal(review.fields.next_action, "replan");
    assert.throws(() => buildWorkReview({ rootPlanText, boundaryReceipt: receipt, pluginRoot: defaultRoot }), /protected host verifier/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("optional persistence failure never invalidates the task-local review", () => {
  const review = buildWorkReview({ rootPlanText, artifacts: [{ text: evidenceText }], reviewInput: achievedInput(), pluginRoot: defaultRoot });
  const persisted = persistWorkReview({
    handoffStore: { record() { throw new Error("cache unavailable"); } },
    rootPlanText,
    artifacts: [{ text: evidenceText }],
    review,
  });
  assert.equal(persisted.handoff_persisted, false);
  assert.equal(persisted.handoff_authoritative, false);
  assert.equal(persisted.artifact, review.artifact);
  assert.match(persisted.warning, /task-local Review remains valid/);
});

test("successful handoff preserves protected builder provenance without making it authority", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-review-builder-handoff-"));
  try {
    const review = buildWorkReview({ rootPlanText, artifacts: [{ text: evidenceText }], reviewInput: achievedInput(), pluginRoot: defaultRoot });
    const persisted = persistWorkReview({
      handoffStore: new ArtifactHandoffStore(directory, defaultRoot),
      rootPlanText,
      artifacts: [{ label: "evidence", text: evidenceText }],
      review,
    });
    const context = new ArtifactHandoffStore(directory, defaultRoot).context("wp-adaptive-retry", rootPlanText);
    const stored = context.artifacts.find((entry) => entry.label === review.fields.id);
    const retry = buildWorkReview({
      rootPlanText,
      artifacts: context.artifacts,
      reviewInput: achievedInput(),
      pluginRoot: defaultRoot,
    });
    assert.equal(persisted.handoff_persisted, true);
    assert.equal(persisted.handoff_authoritative, false);
    assert.deepEqual(stored.builder_provenance, review.provenance);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.artifact, review.artifact);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
