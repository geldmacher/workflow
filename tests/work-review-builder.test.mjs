import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { buildWorkReview } from "../src/controller/work-review-builder.mjs";
import { harnessContractHash } from "../src/core/harness-attestations.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const workspace = harnessContractHash({ workspace: defaultRoot });
const snapshot = "a".repeat(64);

function provisionalEvidence() {
  return buildDeliveryEvidence({
    rootPlanText: root,
    checkEvidence: [],
    effectiveProfile: "manual",
    workspaceBinding: workspace,
    workspaceSnapshotHash: snapshot,
    pluginRoot: defaultRoot,
  });
}

const provisionalInput = {
  schema: 1,
  kind: "review-input",
  assessment: "provisional",
  recommended_action: "accept-provisional",
  assessment_summary: "The Root is intact but protected harness evidence is unavailable.",
  snapshot_assessment: "consistent",
  snapshot_summary: "No repository contradiction was observed.",
  findings: [],
  missing_evidence: [],
};

test("host builder creates deterministic Schema-6 provisional review", () => {
  const evidence = provisionalEvidence();
  const artifacts = [{ label: evidence.fields.id, text: evidence.artifact }];
  const first = buildWorkReview({ rootPlanText: root, artifacts, reviewInput: provisionalInput, pluginRoot: defaultRoot });
  const second = buildWorkReview({ rootPlanText: root, artifacts, reviewInput: provisionalInput, pluginRoot: defaultRoot });
  assert.equal(first.artifact, second.artifact);
  assert.equal(first.fields.schema, 6);
  assert.equal(first.fields.delivery_status, "provisional");
  assert.equal(first.fields.next_action, "accept-provisional");
  assert.doesNotMatch(first.artifact, /Working Directory|Command or Inspection|host_commands|model routing/i);
});

test("reviewer cannot upgrade provisional Evidence by wording", () => {
  const evidence = provisionalEvidence();
  const claimed = { ...provisionalInput, assessment: "achieved", recommended_action: "none" };
  const review = buildWorkReview({
    rootPlanText: root,
    artifacts: [{ label: evidence.fields.id, text: evidence.artifact }],
    reviewInput: claimed,
    pluginRoot: defaultRoot,
  });
  assert.equal(review.fields.delivery_status, "provisional");
  assert.equal(review.fields.assessment, "provisional");
});

test("correction proposal stays outcome- and intent-based", () => {
  const evidence = provisionalEvidence();
  const input = {
    schema: 1,
    kind: "review-input",
    assessment: "mostly-achieved",
    recommended_action: "correct",
    assessment_summary: "One bounded outcome remains.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The repository is consistent with the finding.",
    findings: [{
      key: "retry-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The retry outcome is incomplete.",
      reasoning: "The acceptance outcome is not fully established.",
      resolution: "correct",
    }],
    missing_evidence: [],
    correction: {
      fixes: [{
        key: "close-gap",
        finding_keys: ["retry-gap"],
        required_outcome: "Complete the retry outcome.",
        evidence: "The finding is bounded to OBJ-1.",
      }],
      checks: [{
        key: "prove-gap",
        fix_keys: ["close-gap"],
        verification_intent: "Prove the corrected retry outcome.",
        expected_evidence: "Protected evidence for the current snapshot.",
        evidence_class: "harness-verifiable",
        required: true,
        cost_class: "standard",
        prerequisites: ["The correction is implemented."],
      }],
      steps: [{
        key: "apply-gap",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Complete the retry outcome.",
        implementation_latitude: "The harness chooses the implementation.",
        completion_probe: "The required outcome is observable.",
        check_keys: ["prove-gap"],
        deviation_action: "Replan if Root authority must change.",
      }],
      learning_candidates: [{
        key: "keep-boundary",
        finding_keys: ["retry-gap"],
        reusable_guidance: "Keep verification intent separate from execution.",
        candidate_targets: ["project guidance"],
        confirmation_evidence: "Verified corrected delivery.",
      }],
    },
  };
  const review = buildWorkReview({
    rootPlanText: root,
    artifacts: [{ label: evidence.fields.id, text: evidence.artifact }],
    reviewInput: input,
    pluginRoot: defaultRoot,
  });
  assert.equal(review.fields.next_action, "correct");
  assert.match(review.artifact, /Verification Intent/);
  assert.doesNotMatch(review.artifact, /Working Directory|Command or Inspection/);
});

test("new raw Review bytes cannot establish authority", () => {
  const evidence = provisionalEvidence();
  const review = buildWorkReview({
    rootPlanText: root,
    artifacts: [{ label: evidence.fields.id, text: evidence.artifact }],
    reviewInput: provisionalInput,
    pluginRoot: defaultRoot,
  });
  assert.throws(() => buildWorkReview({
    rootPlanText: root,
    artifacts: [
      { label: evidence.fields.id, text: evidence.artifact },
      { label: review.fields.id, text: review.artifact },
    ],
    reviewInput: provisionalInput,
    pluginRoot: defaultRoot,
  }), /without protected builder provenance/);
});
