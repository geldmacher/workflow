import assert from "node:assert/strict";
import test from "node:test";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { leanRoot } from "./support/manual-attestation-fixtures.mjs";

function snapshot(dirtyPaths = ["src/retry.mjs"], fingerprint = "b".repeat(64)) {
  return {
    schema: 1,
    repository_root: defaultRoot,
    head: "a".repeat(40),
    dirty_paths: dirtyPaths,
    fingerprints: Object.fromEntries(dirtyPaths.map((path) => [path, `file:100644:${fingerprint}`])),
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
    repositoryBaseline: snapshot([]),
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

test("Manual Review caps otherwise verified observations when no repository baseline is available", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => snapshot(),
  });

  assert.equal(bundle.delivery_evidence.fields.overall_grade, "supported");
  assert.equal(bundle.delivery_evidence.fields.status, "provisional");
  assert.equal(bundle.delivery_evidence.fields.extensions.workflow.repository_attribution.status, "provisional");
  assert.deepEqual(bundle.repository_attribution.reason_codes, ["baseline-unavailable"]);
  assert.equal(bundle.review.fields.delivery_status, "provisional");
  assert.equal(bundle.review.fields.next_action, "accept-provisional");
});

test("Manual Review returns a bounded clarification instead of throwing on dirty paths outside Plan authority", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["README.md"]),
  });

  assert.equal(bundle.delivery_evidence.fields.check_evidence[0].grade, "supported");
  assert.equal(bundle.delivery_evidence.fields.status, "provisional");
  assert.equal(bundle.review.fields.delivery_status, "blocked");
  assert.equal(bundle.review.fields.next_action, "clarify");
  assert.match(bundle.review.artifact, /do not fit the native Plan authority/i);
});

test("Manual Review replaces stale Evidence when changed_paths diverge from the current delivery delta", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  const stale = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [{ label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact }],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot([]),
  });

  assert.equal(stale.delivery_evidence.duplicate, false);
  assert.notEqual(stale.delivery_evidence.fields.id, first.delivery_evidence.fields.id);
  assert.deepEqual(stale.delivery_evidence.fields.changed_paths, []);
  assert.deepEqual(stale.observed_dirty_paths, []);
  assert.equal(stale.review.fields.delivery_status, "blocked");
  assert.equal(stale.review.fields.next_action, "clarify");
  assert.match(stale.review.artifact, /delivery delta .* does not match Evidence .* changed_paths/i);
  assert.match(stale.chain_update, /^replace-/);
});

test("Manual Review bounds a large changed-path mismatch without losing the recovery verdict", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  const manyPaths = Array.from({ length: 120 }, (_, index) => `src/generated/retry-case-${String(index).padStart(3, "0")}.mjs`);
  const refreshed = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [{ label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact }],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(manyPaths),
  });

  assert.equal(refreshed.review.fields.delivery_status, "blocked");
  assert.equal(refreshed.review.fields.next_action, "clarify");
  assert.match(refreshed.review.artifact, /\[bounded\]|\(\+\d+ more\)/);
});

test("Manual Review may reuse Evidence when the current delivery delta still matches", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  const reused = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [{ label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact }],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });

  assert.equal(reused.delivery_evidence.duplicate, true);
  assert.equal(reused.delivery_evidence.fields.id, first.delivery_evidence.fields.id);
  assert.equal(reused.review.fields.delivery_status, "verified");
  assert.equal(reused.review.fields.next_action, "none");
});

test("a fresh retry Review replaces provisional Evidence when checks improve without repository drift", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: {
      ...achievedReview,
      assessment: "insufficient-evidence",
      recommended_action: "retry-review",
      assessment_summary: "The planned Check was temporarily unavailable.",
      snapshot_assessment: "incomplete",
      missing_evidence: ["Fresh CHECK-1 observation is unavailable."],
    },
    checkEvidence: [{
      ...verifiedCheck,
      grade: "unavailable",
      observed: "The planned verification surface was temporarily unavailable.",
      repetitions: 0,
      limitations: ["Retry the planned Check in a fresh Review."],
    }],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });
  assert.equal(first.review.fields.next_action, "retry-review");
  assert.equal(first.delivery_evidence.fields.status, "provisional");

  const second = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [
      { label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact },
      { label: first.review.fields.id, text: first.review.artifact, builder_provenance: first.review.provenance },
    ],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });

  assert.equal(second.chain_update, "replace-full-tip");
  assert.notEqual(second.delivery_evidence.fields.id, first.delivery_evidence.fields.id);
  assert.equal(second.delivery_evidence.fields.overall_grade, "verified");
  assert.equal(second.review.fields.delivery_status, "verified");
  assert.equal(second.review.fields.next_action, "none");
});

test("a refresh cannot discard an imported raw Review before provenance validation", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  });

  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    artifacts: [
      { label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact },
      { label: first.review.fields.id, text: first.review.artifact },
    ],
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  }), (error) => error?.code === "review-artifact-rejected" && /without protected builder provenance/.test(error.message));
});

test("Manual Review rejects invalid authority inputs and bounds an appended repository limitation", () => {
  const base = {
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [verifiedCheck],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
    captureSnapshot: () => snapshot(["src/retry.mjs"]),
  };
  assert.throws(() => buildManualReviewLifecycle({ ...base, rootPlanText: leanRoot.slice(0, 200) }), /exact native Schema-5 Root/);
  assert.throws(() => buildManualReviewLifecycle({ ...base, artifacts: [{ label: "broken", text: "not an artifact" }] }), /artifact broken is invalid/);

  const first = buildManualReviewLifecycle(base);
  assert.throws(() => buildManualReviewLifecycle({
    ...base,
    artifacts: [
      { label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact },
      {
        label: first.review.fields.id,
        text: first.review.artifact,
        builder_provenance: { ...first.review.provenance, artifact_hash: "0".repeat(64) },
      },
    ],
  }), (error) => error?.code === "review-artifact-rejected" && /invalid host builder provenance/.test(error.message));

  const bounded = buildManualReviewLifecycle({
    ...base,
    repositoryBaseline: null,
    reviewInput: { ...achievedReview, snapshot_summary: "x".repeat(1_880) },
  });
  assert.equal(bounded.review.fields.delivery_status, "provisional");
  assert.match(bounded.review.artifact, /\[bounded\]/);
});

test("known failed required Checks complete Review with blocked delivery", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: leanRoot,
    reviewInput: achievedReview,
    checkEvidence: [{ ...verifiedCheck, grade: "failed", observed: "The required Check failed." }],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: snapshot([]),
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
    repositoryBaseline: snapshot([]),
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
    repositoryBaseline: snapshot(["src/retry.mjs"], "a".repeat(64)),
    repositoryAttribution: { status: "attributed", boundary: "correction", reason_codes: [] },
    captureSnapshot: () => snapshot(["src/retry.mjs"], "b".repeat(64)),
  });

  assert.equal(second.delivery_evidence.fields.representation, "delta");
  assert.equal(second.delivery_evidence.fields.source_review_id, first.review.fields.id);
  assert.equal(second.delivery_evidence.fields.predecessor_evidence_id, first.delivery_evidence.fields.id);
  assert.equal(second.review.fields.latest_evidence_id, second.delivery_evidence.fields.id);
  assert.equal(second.review.fields.delivery_status, "verified");
});
