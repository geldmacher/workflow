import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, executionContractFromArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import {
  deriveManualLearningProjection,
  deriveManualWorkflowSnapshot,
  resolveManualRootPlanId,
} from "../src/controller/manual-status.mjs";
import {
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  harnessContractHash,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
const snapshotHash = "a".repeat(64);
const repositorySnapshot = {
  schema: 1,
  repository_root: defaultRoot,
  head: "b".repeat(40),
  dirty_paths: [],
  fingerprints: {},
  index_fingerprint: "c".repeat(64),
  status_fingerprint: "d".repeat(64),
  working_tree: "unchanged",
  captured_at: "2026-08-25T00:00:00.000Z",
};

function reviewInput(verified = false) {
  return {
    schema: 1,
    kind: "review-input",
    assessment: verified ? "achieved" : "provisional",
    recommended_action: verified ? "none" : "accept-provisional",
    assessment_summary: verified ? "Protected evidence satisfies the Root." : "Protected harness evidence is unavailable.",
    snapshot_assessment: "consistent",
    snapshot_summary: "The repository snapshot is consistent.",
    findings: [],
    missing_evidence: [],
  };
}

function signed(value, field) {
  return { ...value, [field]: harnessContractHash(value) };
}

function phaseResult() {
  const check = executionContractFromArtifactText(root, defaultRoot).checks[0];
  const attestation = signed({
    schema: HARNESS_CHECK_ATTESTATION_SCHEMA,
    kind: "harness-check-attestation",
    harness_id: "project-harness",
    check_id: "CHECK-1",
    root_hash: createHash("sha256").update(root).digest("hex"),
    verification_intent_hash: verificationIntentHash(check),
    workspace_binding: workspaceBinding,
    workspace_snapshot_hash: snapshotHash,
    status: "passed",
    observed: "The verification intent was satisfied.",
    evidence_hashes: ["e".repeat(64)],
    issued_at: "2026-08-25T00:00:00.000Z",
  }, "content_hash");
  return {
    status: "completed",
    harness_id: "project-harness",
    workspace_snapshot_before: snapshotHash,
    workspace_snapshot_after: snapshotHash,
    changed_paths: [],
    check_attestations: [attestation],
  };
}

function chain(verified = false) {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(verified),
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => repositorySnapshot,
    ...(verified ? { harnessPhaseResult: phaseResult(), harnessProtectionHash: "f".repeat(64), workspaceBinding } : {}),
  });
  return [
    { label: "root", text: root },
    { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact },
    { label: bundle.review.fields.id, text: bundle.review.artifact },
  ];
}

test("Schema-6 Root status is ready for human implementation selection", () => {
  const status = deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "root", text: root }],
    pluginRoot: defaultRoot,
  });
  assert.equal(status.snapshot.state, "root-plan-review");
  assert.equal(status.snapshot.next_action, "implement-plan");
  assert.equal(status.snapshot.requested_profile, "manual");
});

test("unsupported artifact schemas are rejected without a compatibility state", () => {
  const unsupported = root.replace("schema: 6", "schema: 7");
  const status = deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "root", text: unsupported }],
    pluginRoot: defaultRoot,
  });
  assert.equal(status.snapshot.state, "replan");
  assert.match(status.snapshot.blockers.join("\n"), /only Schema 6 is supported/);
  assert.throws(() => deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "root", text: unsupported }],
    manualAcceptance: "provisional",
    pluginRoot: defaultRoot,
  }), /invalid artifact chain|unsupported/);
});

test("provisional and verified Schema-6 chains preserve distinct human gates", () => {
  const provisionalArtifacts = chain(false);
  assert.equal(resolveManualRootPlanId({ artifacts: provisionalArtifacts, pluginRoot: defaultRoot }), "wp-adaptive-retry");
  const provisional = deriveManualWorkflowSnapshot({ artifacts: provisionalArtifacts, pluginRoot: defaultRoot });
  assert.equal(provisional.snapshot.state, "delivery-ready-provisional");
  assert.equal(provisional.snapshot.delivery_status, "provisional");
  assert.equal(provisional.snapshot.next_action, "accept-provisional");
  assert.equal(provisional.artifact_summary.evidence_tip.startsWith("de-"), true);

  const accepted = deriveManualWorkflowSnapshot({
    artifacts: provisionalArtifacts,
    manualAcceptance: "provisional",
    pluginRoot: defaultRoot,
  });
  assert.equal(accepted.snapshot.state, "accepted-provisional");

  const verified = deriveManualWorkflowSnapshot({ artifacts: chain(true), pluginRoot: defaultRoot });
  assert.equal(verified.snapshot.state, "achieved");
  assert.equal(verified.snapshot.delivery_status, "verified");
  const learning = deriveManualLearningProjection(verified);
  assert.equal(learning.eligible, true);
  assert.deepEqual(learning.blockers, []);
});

test("learning projection keeps incomplete or provisional delivery ineligible", () => {
  const projection = deriveManualLearningProjection({
    snapshot: { state: "delivery-ready-provisional", delivery_status: "provisional", root_plan_id: "wp-adaptive-retry" },
    artifact_summary: { root_plan_id: "wp-adaptive-retry", learning_candidates: [{ key: "candidate" }] },
  });
  assert.equal(projection.eligible, false);
  assert.deepEqual(projection.blockers, ["learning-source-not-achieved", "learning-source-not-verified"]);
  assert.deepEqual(projection.candidates, [{ key: "candidate" }]);
});

test("status counter-probes distinguish incomplete, invalid, ambiguous, and unsupported input", () => {
  const incomplete = deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: [], pluginRoot: defaultRoot });
  assert.equal(incomplete.snapshot.state, "waiting-human");
  assert.match(incomplete.snapshot.blockers.join("\n"), /artifact-context-missing/);
  assert.throws(() => deriveManualWorkflowSnapshot({ artifacts: [], pluginRoot: defaultRoot }), /current-task artifacts/);
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: [], manualAcceptance: "provisional", pluginRoot: defaultRoot }), /complete current Schema-6 artifact chain/);
  assert.throws(() => deriveManualWorkflowSnapshot({ rootPlanId: "wp-adaptive-retry", artifacts: [], manualAcceptance: "accepted", pluginRoot: defaultRoot }), /must be provisional/);
  assert.throws(() => resolveManualRootPlanId({ artifacts: [{ label: "", text: root }], pluginRoot: defaultRoot }), /non-empty label and text/);
  assert.throws(() => resolveManualRootPlanId({ artifacts: [{ label: "one", text: root }, { label: "one", text: root }], pluginRoot: defaultRoot }), /labels must be unique/);

  const invalid = deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "broken", text: "not an artifact" }],
    pluginRoot: defaultRoot,
  });
  assert.equal(invalid.snapshot.state, "replan");
  assert.ok(invalid.snapshot.blockers.length > 0);
  assert.throws(() => deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "broken", text: "not an artifact" }],
    manualAcceptance: "provisional",
    pluginRoot: defaultRoot,
  }), /parseable current Schema-6 artifact chain/);

  const secondRoot = root.replace("wp-adaptive-retry", "wp-second-root");
  assert.throws(() => resolveManualRootPlanId({
    artifacts: [{ label: "one", text: root }, { label: "two", text: secondRoot }],
    pluginRoot: defaultRoot,
  }), /ambiguous/);
  assert.throws(() => deriveManualWorkflowSnapshot({
    rootPlanId: "invalid",
    artifacts: [{ label: "root", text: root }],
    pluginRoot: defaultRoot,
  }), /valid wp-\* root_plan_id/);
});
