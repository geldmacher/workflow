import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, executionContractFromArtifactText, inspectArtifactSet } from "../scripts/validate-artifact.source.mjs";
import { buildManualReviewLifecycle } from "../src/controller/manual-review-lifecycle.mjs";
import {
  HARNESS_CHECK_ATTESTATION_SCHEMA,
  harnessContractHash,
  verificationIntentHash,
} from "../src/core/harness-attestations.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");
const current = {
  schema: 1,
  repository_root: defaultRoot,
  head: "a".repeat(40),
  dirty_paths: ["src/retry.mjs"],
  fingerprints: { "src/retry.mjs": "file:" + "b".repeat(64) },
  index_fingerprint: "c".repeat(64),
  status_fingerprint: "d".repeat(64),
  working_tree: "modified",
  captured_at: "2026-08-25T00:00:00.000Z",
};
const workspaceBinding = harnessContractHash({ workspace_root: defaultRoot });
const harnessSnapshot = "e".repeat(64);

const cleanBaseline = {
  ...current,
  dirty_paths: [],
  fingerprints: {},
  working_tree: "unchanged",
};

function signed(value, field) {
  return { ...value, [field]: harnessContractHash(value) };
}

function reviewInput(verified = false) {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "achieved",
    assessment_summary: verified ? "The protected evidence satisfies the Root." : "The supported repository evidence satisfies the Root.",
    snapshot_summary: "The repository snapshot is consistent.",
    findings: [],
    open_points: [],
  };
}

const supportedEvidence = [{
  check_id: "CHECK-1",
  grade: "supported",
  observed: "The required retry outcome passed on the exact repository snapshot.",
  evidence_hashes: ["9".repeat(64)],
  limitations: ["The observation is repository-supported but not protected."],
}];

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
    workspace_snapshot_hash: harnessSnapshot,
    status: "passed",
    observed: "The verification intent was satisfied.",
    evidence_hashes: ["f".repeat(64)],
    issued_at: "2026-08-25T00:00:00.000Z",
  }, "content_hash");
  return {
    status: "completed",
    harness_id: "project-harness",
    workspace_snapshot_before: harnessSnapshot,
    workspace_snapshot_after: harnessSnapshot,
    changed_paths: [],
    check_attestations: [attestation],
  };
}

function protectedArtifacts(bundle) {
  return [
    { label: bundle.delivery_evidence.fields.id, text: bundle.delivery_evidence.artifact },
    {
      label: bundle.review.fields.id,
      text: bundle.review.artifact,
      builder_provenance: bundle.review.provenance,
    },
  ];
}

function correctionInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One bounded retry outcome remains incomplete.",
    snapshot_summary: "The repository state is consistent with the finding.",
    findings: [{
      key: "retry-gap",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The required retry outcome is incomplete.",
      reasoning: "Acceptance is not yet fully established.",
      resolution: "correct",
    }],
    open_points: [],
    correction: {
      fixes: [{ key: "close-gap", finding_keys: ["retry-gap"], required_outcome: "Complete retry behavior.", evidence: "The gap is Root-bounded." }],
      steps: [{
        key: "apply-gap",
        fix_keys: ["close-gap"],
        targets: ["src"],
        required_outcome: "Complete retry behavior.",
        implementation_latitude: "The project harness chooses execution.",
        completion_probe: "The required outcome is observable.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point if Root authority changes.",
      }],
    },
  };
}

test("supported repository evidence achieves the Root without a provisional delivery gate", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  assert.equal(bundle.root_plan_id, "wp-adaptive-retry");
  assert.equal(bundle.delivery_evidence.fields.status, "provisional");
  assert.equal(bundle.delivery_evidence.fields.overall_grade, "supported");
  assert.equal(bundle.review.fields.outcome, "achieved");
  assert.equal(bundle.review.fields.next_action, "none");
  assert.match(bundle.delivery_evidence.fields.check_evidence[0].limitations.join("\n"), /not protected/i);
});

test("protected harness evidence enables verified Review independent of execution choice", () => {
  const bundle = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(true),
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => current,
    harnessPhaseResult: phaseResult(),
    harnessProtectionHash: "1".repeat(64),
    workspaceBinding,
  });
  assert.equal(bundle.delivery_evidence.fields.overall_grade, "verified");
  assert.equal(bundle.review.fields.outcome, "achieved");
  assert.equal(bundle.review.fields.next_action, "none");
});

test("protected sealing appends one verified pair after an exact unprotected provisional pair", () => {
  const local = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  const localArtifacts = [
    { label: local.delivery_evidence.fields.id, text: local.delivery_evidence.artifact },
    { label: local.review.fields.id, text: local.review.artifact },
  ];
  const sealed = buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: localArtifacts,
    reviewInput: reviewInput(true),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "protected-seal", reason_codes: [] },
    harnessPhaseResult: { ...phaseResult(), changed_paths: ["src/retry.mjs"] },
    harnessProtectionHash: "1".repeat(64),
    workspaceBinding,
    seal: true,
    captureSnapshot: () => current,
  });
  assert.equal(sealed.chain_update, "append-seal");
  assert.equal(sealed.delivery_evidence.fields.representation, "seal");
  assert.equal(sealed.delivery_evidence.fields.predecessor_evidence_id, local.delivery_evidence.fields.id);
  assert.equal(sealed.delivery_evidence.fields.source_review_id, local.review.fields.id);
  assert.equal(sealed.delivery_evidence.fields.status, "complete");
  assert.equal(sealed.delivery_evidence.fields.overall_grade, "verified");
  assert.equal(sealed.review.fields.predecessor_review_id, local.review.fields.id);
  assert.equal(sealed.review.fields.outcome, "achieved");
  assert.equal(sealed.review.fields.next_action, "none");
  assert.equal(localArtifacts[0].text, local.delivery_evidence.artifact);
  assert.equal(localArtifacts[1].text, local.review.artifact);
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: localArtifacts,
    reviewInput: reviewInput(true),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "protected-seal", reason_codes: [] },
    harnessPhaseResult: { ...phaseResult(), changed_paths: ["README.md", "src/retry.mjs"] },
    harnessProtectionHash: "1".repeat(64),
    workspaceBinding,
    seal: true,
    captureSnapshot: () => current,
  }), (error) => error?.code === "protected-seal-authority-violation");
  const exactChain = [
    ["root", root],
    [localArtifacts[0].label, localArtifacts[0].text],
    [localArtifacts[1].label, localArtifacts[1].text],
    [sealed.delivery_evidence.fields.id, sealed.delivery_evidence.artifact],
    [sealed.review.fields.id, sealed.review.artifact],
  ];
  assert.deepEqual(inspectArtifactSet(exactChain, defaultRoot).errors, []);
  const rejectSeal = (text) => {
    const inspected = inspectArtifactSet(exactChain.map(([label, source]) => [
      label,
      label === sealed.delivery_evidence.fields.id ? text : source,
    ]), defaultRoot);
    assert.ok(inspected.errors.length > 0);
  };
  rejectSeal(sealed.delivery_evidence.artifact.replace("representation: seal", "representation: delta"));
  rejectSeal(sealed.delivery_evidence.artifact.replace(`source_review_id: ${local.review.fields.id}`, "source_review_id: wr-foreign-review"));
  rejectSeal(sealed.delivery_evidence.artifact.replace("reused_checks: []", "reused_checks:\n  - CHECK-1"));
  const branchedEvidence = sealed.delivery_evidence.artifact.replace(
    `id: ${sealed.delivery_evidence.fields.id}`,
    "id: de-adaptive-retry-branch",
  );
  assert.ok(inspectArtifactSet([...exactChain, ["de-adaptive-retry-branch", branchedEvidence]], defaultRoot).errors.length > 0);

  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: localArtifacts,
    reviewInput: reviewInput(true),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "protected-seal", reason_codes: [] },
    seal: true,
    captureSnapshot: () => current,
  }), (error) => error?.code === "protected-seal-not-verified");
});

test("manual Review rejects invalid Roots, missing inputs, and unprotected Review bytes", () => {
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => current,
  }), /review_input/);
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(false),
    pluginRoot: defaultRoot,
    captureSnapshot: () => current,
  }), /repository root/);
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root.replace("schema: 6", "schema: 7"),
    reviewInput: reviewInput(false),
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => current,
  }), /Schema-6 Root/);
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: [{ label: "broken", text: "not an artifact" }],
    reviewInput: reviewInput(false),
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    captureSnapshot: () => current,
  }), /artifact broken is invalid/);

  const first = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  const evidence = { label: first.delivery_evidence.fields.id, text: first.delivery_evidence.artifact };
  const rawReview = { label: first.review.fields.id, text: first.review.artifact };
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: [evidence, rawReview],
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    captureSnapshot: () => current,
  }), (error) => error?.code === "review-artifact-rejected");
  assert.throws(() => buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: [evidence, { ...rawReview, builder_provenance: { ...first.review.provenance, artifact_hash: "0".repeat(64) } }],
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    captureSnapshot: () => current,
  }), (error) => error?.code === "review-artifact-rejected");
});

test("repository attribution reports ordinary subject scope drift as an Authority Open Point", () => {
  const unsupported = {
    ...current,
    dirty_paths: ["README.md", "src/retry.mjs"],
    fingerprints: {
      "README.md": "file:" + "1".repeat(64),
      "src/retry.mjs": "file:" + "2".repeat(64),
    },
  };
  const bundle = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(true),
    checkEvidence: [{ check_id: "CHECK-1", grade: "verified", observed: "Caller observation without protected harness attestation." }],
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "provisional", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => unsupported,
  });
  assert.equal(bundle.review.fields.outcome, "open-points");
  assert.equal(bundle.review.fields.next_action, "human-assessment");
  assert.deepEqual(bundle.changed_paths, ["README.md", "src/retry.mjs"]);
  assert.match(bundle.review.artifact, /README\.md|outside.*authority/i);
  assert.match(bundle.delivery_evidence.fields.check_evidence[0].limitations.join("\n"), /attribution.*provisional/i);
});

test("an unchanged protected chain is reused and repository drift replaces only its tip", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  const artifacts = protectedArtifacts(first);
  const same = buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  assert.equal(same.chain_update, "reuse");
  assert.equal(same.delivery_evidence.duplicate, true);

  const drifted = {
    ...current,
    dirty_paths: ["tests/retry.test.mjs"],
    fingerprints: { "tests/retry.test.mjs": "file:" + "f".repeat(64) },
    status_fingerprint: "9".repeat(64),
  };
  const replaced = buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts,
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => drifted,
  });
  assert.match(replaced.chain_update, /^replace-/);
  assert.deepEqual(replaced.changed_paths, ["tests/retry.test.mjs"]);
  assert.match(replaced.review.artifact, /does not match Evidence|tests\/retry\.test\.mjs/);
});

test("a correction Review creates a fresh intent-based Evidence suffix", () => {
  const first = buildManualReviewLifecycle({
    rootPlanText: root,
    reviewInput: correctionInput(),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: cleanBaseline,
    repositoryAttribution: { status: "attributed", boundary: "create-plan", reason_codes: [] },
    captureSnapshot: () => current,
  });
  assert.equal(first.review.fields.next_action, "correct");
  const corrected = buildManualReviewLifecycle({
    rootPlanText: root,
    artifacts: protectedArtifacts(first),
    reviewInput: reviewInput(false),
    checkEvidence: supportedEvidence,
    workspaceRoot: defaultRoot,
    pluginRoot: defaultRoot,
    repositoryBaseline: current,
    repositoryAttribution: { status: "attributed", boundary: "correction", reason_codes: [] },
    captureSnapshot: () => current,
  });
  assert.equal(corrected.chain_update, "append");
  assert.equal(corrected.delivery_evidence.fields.representation, "delta");
  assert.match(first.review.artifact, /Verification Intent/);
  assert.doesNotMatch(first.review.artifact, /Working Directory|Command or Inspection/);
});
