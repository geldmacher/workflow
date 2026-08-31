import assert from "node:assert/strict";
import test from "node:test";
import { deriveManualLearningProjection, deriveManualWorkflowSnapshot, resolveManualRootPlanId } from "../src/controller/manual-status.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { buildWorkReview } from "../src/controller/work-review-builder.mjs";
import { achievedReviewInput, rootPlan, supportedCheck } from "./support/workflow-fixtures.mjs";

function rootEntry(text = rootPlan()) {
  return { label: "root", text };
}

function reviewed(outcome = "achieved") {
  const root = rootPlan();
  const evidence = buildDeliveryEvidence({
    rootPlanText: root,
    artifacts: [],
    checkEvidence: [supportedCheck()],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    workspaceBinding: "workspace",
    workspaceSnapshotHash: "2".repeat(64),
  });
  const reviewInput = outcome === "achieved" ? achievedReviewInput() : {
    ...achievedReviewInput(),
    outcome: "open-points",
    assessment_summary: "One concrete environment limit remains.",
    open_points: [{
      key: "environment-limit",
      type: "environment",
      summary: "The integrated environment is unavailable.",
      evidence: "The environment returned an explicit unavailable result.",
      impact: "The integrated environment outcome is not known.",
      question: "Should this environment limit remain open for this delivery?",
    }],
  };
  const review = buildWorkReview({
    rootPlanText: root,
    artifacts: [{ label: evidence.fields.id, text: evidence.artifact }],
    reviewInput,
  });
  return {
    root,
    evidence,
    review,
    entries: [rootEntry(root), { label: evidence.fields.id, text: evidence.artifact }, { label: review.fields.id, text: review.artifact }],
  };
}

test("Root-only Manual status is Root ready with Implement Plan", () => {
  const root = rootPlan();
  const status = deriveManualWorkflowSnapshot({ artifacts: [rootEntry(root)] });
  assert.equal(status.snapshot.state, "root-ready");
  assert.equal(status.snapshot.next_action, "implement-plan");
  assert.equal(resolveManualRootPlanId({ artifacts: [rootEntry(root)] }), "wp-adaptive-retry");
});

test("supported and verified proof share the same Achieved status", () => {
  const chain = reviewed("achieved");
  const status = deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: chain.entries });
  assert.equal(status.snapshot.state, "achieved");
  assert.equal(status.snapshot.next_action, "none");
  assert.equal(status.snapshot.evidence_grade, "supported");
});

test("Open Points preserve their natural human assessment action", () => {
  const chain = reviewed("open-points");
  const status = deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: chain.entries });
  assert.equal(status.snapshot.state, "open-points");
  assert.equal(status.snapshot.next_action, "human-assessment");
  assert.deepEqual(status.artifact_summary.finding_ids, []);
});

test("missing or invalid exact bytes derive Shadow Review without a compatibility state", () => {
  const incomplete = deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: [] });
  assert.equal(incomplete.snapshot.state, "shadow-review");
  assert.equal(incomplete.snapshot.next_action, "human-assessment");

  const invalid = deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: [rootEntry(rootPlan().replace("authority_hash:", "authority_hash: broken-"))] });
  assert.equal(invalid.snapshot.state, "shadow-review");
});

test("learning remains a separate gate only after Achieved and supported proof", () => {
  const achieved = reviewed("achieved");
  const status = deriveManualWorkflowSnapshot({ artifacts: achieved.entries });
  assert.equal(deriveManualLearningProjection(status).eligible, true);
  const open = reviewed("open-points");
  assert.equal(deriveManualLearningProjection(deriveManualWorkflowSnapshot({ artifacts: open.entries })).eligible, false);
});

test("ambiguous Root tips and invalid selectors fail explicitly", () => {
  const first = rootPlan();
  const second = rootPlan("manual", { id: "wp-second" });
  assert.throws(() => resolveManualRootPlanId({ artifacts: [rootEntry(first), { label: "second", text: second }] }), /ambiguous/);
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId: "invalid", artifacts: [rootEntry(first)] }), /valid wp/);
});
