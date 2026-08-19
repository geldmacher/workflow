import assert from "node:assert/strict";
import test from "node:test";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { leanRoot } from "./support/manual-attestation-fixtures.mjs";

function snapshot(dirtyPaths = ["src/retry.mjs"]) {
  return {
    schema: 1,
    repository_root: defaultRoot,
    head: "a".repeat(40),
    dirty_paths: dirtyPaths,
    fingerprints: Object.fromEntries(dirtyPaths.map((path) => [path, `file:100644:${"b".repeat(64)}`])),
    index_fingerprint: "c".repeat(64),
    status_fingerprint: "d".repeat(64),
    working_tree: dirtyPaths.length > 0 ? "modified" : "unchanged",
    captured_at: "2026-08-17T00:00:00.000Z",
  };
}

const verifiedCheck = {
  check_id: "CHECK-1",
  grade: "verified",
  surface: "repository",
  method: "node --test tests/codex-hook-policy.test.mjs",
  expected: "Focused Codex hook policy tests pass.",
  observed: "The exact planned command passed in this fresh Review.",
  repetitions: 1,
  artifact_hashes: [],
  limitations: [],
};

const achievedReview = {
  schema: 1,
  kind: "review-input",
  assessment: "achieved",
  recommended_action: "none",
  assessment_summary: "The native Plan acceptance is achieved.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The current repository matches the reviewed delivery.",
  findings: [],
  missing_evidence: [],
  auditor_reports: [],
};

const correctionReview = {
  schema: 1,
  kind: "review-input",
  assessment: "mostly-achieved",
  recommended_action: "correct",
  assessment_summary: "One bounded retry correction remains.",
  snapshot_assessment: "consistent",
  snapshot_summary: "The current repository matches the reviewed delivery.",
  findings: [{
    key: "retry-gap",
    severity: "medium",
    objective_ids: ["OBJ-1"],
    check_ids: ["CHECK-1"],
    evidence: "The retry boundary is incomplete.",
    reasoning: "The Root remains incomplete until this bounded gap is corrected.",
    resolution: "correct",
  }],
  missing_evidence: [],
  auditor_reports: [],
  correction: {
    fixes: [{ key: "complete-retry", finding_keys: ["retry-gap"], required_outcome: "Complete the retry boundary.", evidence: "The finding is bounded." }],
    checks: [{ key: "verify-correction", fix_keys: ["complete-retry"], working_directory: "repository root", command_or_inspection: "node --test tests/codex-hook-policy.test.mjs", expected_result: "Focused correction tests pass.", required: true, cost_class: "standard", prerequisites: ["src", "tests"] }],
    steps: [{ key: "apply-correction", fix_keys: ["complete-retry"], targets: ["src/retry.mjs"], required_outcome: "Apply the bounded correction.", implementation_latitude: "Use the smallest in-scope change.", completion_probe: "Focused correction tests pass.", check_keys: ["verify-correction"], deviation_action: "Replan if authority changes." }],
    learning_candidates: [{ key: "retry-guidance", finding_keys: ["retry-gap"], reusable_guidance: "Keep retry boundaries covered.", candidate_targets: ["tests"], confirmation_evidence: "Focused tests pass." }],
  },
};

test("Manual Review atomically creates missing Evidence and Review from fresh observations", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(),
  });

  assert.equal(bundle.delivery_evidence.fields.root_plan_id, "wp-retry");
  assert.equal(bundle.delivery_evidence.fields.overall_grade, "verified");
  assert.equal(bundle.delivery_evidence.fields.check_evidence[0].grade, "verified");
  assert.equal(bundle.review.fields.latest_evidence_id, bundle.delivery_evidence.fields.id);
  assert.equal(bundle.review.fields.assessment, "achieved");
  assert.equal(bundle.review.fields.delivery_status, "verified");
  assert.equal(bundle.review.fields.next_action, "none");
});

test("Manual Review returns a bounded clarification instead of throwing on dirty paths outside Plan authority", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(["README.md"]),
  });

  assert.equal(bundle.delivery_evidence.fields.check_evidence[0].grade, "supported");
  assert.equal(bundle.delivery_evidence.fields.status, "provisional");
  assert.equal(bundle.review.fields.delivery_status, "blocked");
  assert.equal(bundle.review.fields.next_action, "clarify");
  assert.match(bundle.review.artifact, /do not fit the native Plan authority/i);
});

test("Manual Review blocks reused Evidence whose changed_paths diverge from the current dirty inventory", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  const stale = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [{ label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact }],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot([]),
  });

  assert.equal(stale.delivery_evidence.duplicate, true);
  assert.equal(stale.delivery_evidence.fields.id, first.delivery_evidence.fields.id);
  assert.deepEqual(stale.observed_dirty_paths, []);
  assert.equal(stale.review.fields.delivery_status, "blocked");
  assert.equal(stale.review.fields.next_action, "clarify");
  assert.match(stale.review.artifact, /does not match Evidence .* changed_paths/i);
});

test("Manual Review may reuse Evidence when the current dirty inventory still matches", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  const reused = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [{ label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact }],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });

  assert.equal(reused.delivery_evidence.duplicate, true);
  assert.equal(reused.delivery_evidence.fields.id, first.delivery_evidence.fields.id);
  assert.equal(reused.review.fields.delivery_status, "verified");
  assert.equal(reused.review.fields.next_action, "none");
});

test("known failed required Checks complete Review with blocked delivery", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [{ ...verifiedCheck, grade: "failed", observed: "The required Check failed." }],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(),
  });

  assert.equal(bundle.delivery_evidence.fields.status, "blocked");
  assert.equal(bundle.review.fields.delivery_status, "blocked");
  assert.notEqual(bundle.review.fields.assessment, "achieved");
  assert.notEqual(bundle.review.fields.next_action, "none");
});

test("fresh Review after correction creates delta Evidence against the exact current-task chain", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: correctionReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(),
  });
  const correctionCheck = {
    ...verifiedCheck,
    check_id: "CHECK-2",
    expected: "Focused correction tests pass.",
    observed: "The bounded correction passed in this fresh Review.",
  };
  const second = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [
      { label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact },
      { label: first.review.fields.id, text: first.review.artifact, builder_provenance: first.review.provenance },
    ],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck, correctionCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(),
  });

  assert.equal(second.delivery_evidence.fields.representation, "delta");
  assert.equal(second.delivery_evidence.fields.source_review_id, first.review.fields.id);
  assert.equal(second.delivery_evidence.fields.predecessor_evidence_id, first.delivery_evidence.fields.id);
  assert.equal(second.review.fields.latest_evidence_id, second.delivery_evidence.fields.id);
  assert.equal(second.review.fields.delivery_status, "verified");
});
