import assert from "node:assert/strict";
import test from "node:test";
import { inspectArtifactText, validateArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { buildWorkReview } from "../src/controller/work-review-builder.mjs";
import { achievedReviewInput, rootPlan, supportedCheck } from "./support/workflow-fixtures.mjs";

function evidence(options = {}) {
  return buildDeliveryEvidence({
    rootPlanText: rootPlan(),
    artifacts: [],
    checkEvidence: [supportedCheck()],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    workspaceBinding: "workspace",
    workspaceSnapshotHash: "1".repeat(64),
    ...options,
  });
}

function build(reviewInput, delivery = evidence()) {
  return buildWorkReview({
    rootPlanText: rootPlan(),
    artifacts: [{ label: delivery.fields.id, text: delivery.artifact }],
    reviewInput,
  });
}

function correctionInput({ openPoints = [] } = {}) {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One approved outcome still needs a bounded repository correction.",
    snapshot_summary: "The exact snapshot was inspected read-only.",
    findings: [{
      key: "retry-backoff",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The retry path does not back off on the current snapshot.",
      reasoning: "This is correctable inside src and the approved Root.",
      resolution: "correct",
    }],
    open_points: openPoints,
    correction: {
      fixes: [{
        key: "fix-retry-backoff",
        finding_keys: ["retry-backoff"],
        required_outcome: "Retry behavior backs off without changing public authority.",
        evidence: "The Finding identifies the current missing behavior.",
      }],
      steps: [{
        key: "update-retry",
        fix_keys: ["fix-retry-backoff"],
        targets: ["src"],
        required_outcome: "The retry path satisfies the original acceptance outcome.",
        implementation_latitude: "Choose the smallest project-appropriate implementation.",
        completion_probe: "Inspect the changed behavior before handing off to fresh Review.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report a concrete Open Point instead of expanding authority.",
      }],
    },
  };
}

test("finding-free supported Review is Achieved while proof remains supported", () => {
  const delivery = evidence();
  const first = build(achievedReviewInput(), delivery);
  const second = build(achievedReviewInput(), delivery);
  assert.equal(first.artifact, second.artifact);
  assert.equal(first.fields.outcome, "achieved");
  assert.equal(first.fields.next_action, "none");
  assert.equal(delivery.fields.overall_grade, "supported");
  assert.ok(!Object.hasOwn(first.fields, "delivery_status"));
  assert.deepEqual(validateArtifactText(first.artifact), []);
});

test("Open Points carry exact reason, evidence, impact, and natural question", () => {
  const review = build({
    ...achievedReviewInput(),
    outcome: "open-points",
    assessment_summary: "An unrelated integrated gate is red.",
    open_points: [{
      key: "unrelated-gate",
      type: "environment",
      summary: "An integrated gate outside the delivered behavior is red.",
      evidence: "The gate reports an exact unrelated fixture failure.",
      impact: "The current delivery cannot claim the integrated environment is fully healthy.",
      question: "Should this unrelated environment failure end this delivery as an accepted open point?",
    }],
  });
  assert.equal(review.fields.outcome, "open-points");
  assert.equal(review.fields.next_action, "human-assessment");
  assert.equal(review.fields.open_points[0].key, "unrelated-gate");
});

test("correctable Findings take precedence and bundle remaining limits into one Correction", () => {
  const review = build(correctionInput({
    openPoints: [{
      key: "proof-limit",
      type: "evidence",
      summary: "Protected proof is unavailable.",
      evidence: "Only supported repository evidence exists.",
      impact: "Proof remains supported rather than verified.",
      question: "Is supported proof sufficient for the human assessment?",
    }],
  }));
  assert.equal(review.fields.outcome, "correction-needed");
  assert.equal(review.fields.next_action, "correct");
  assert.match(review.artifact, /FIX-1/);
  assert.match(review.artifact, /CHECK-1/);
  assert.doesNotMatch(review.artifact, /CORR-CHECK|FIX-CHECK/);
  const inspected = inspectArtifactText(review.artifact).artifact;
  assert.deepEqual(inspected.correction.checks.map((row) => row["Check ID"]), ["CHECK-1"]);
});

test("Correction requires complete Finding coverage and in-Root targets", () => {
  const missingCoverage = correctionInput();
  missingCoverage.correction.fixes[0].finding_keys = ["unknown"];
  assert.throws(() => build(missingCoverage), /unknown|non-correctable/);
  const outside = correctionInput();
  outside.correction.steps[0].targets = ["README.md"];
  assert.throws(() => build(outside), /outside correction authority/);
});

test("reviewer wording cannot upgrade Evidence or add old Review fields", () => {
  assert.throws(() => build({ ...achievedReviewInput(), delivery_status: "verified" }), /unsupported field delivery_status/);
  const review = build(achievedReviewInput({ assessment_summary: "Verified delivery." }));
  assert.equal(inspectArtifactText(review.artifact).artifact.fields.outcome, "achieved");
  assert.ok(!review.artifact.includes("delivery_status"));
});
