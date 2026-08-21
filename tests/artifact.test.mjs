import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createManualBoundaryReceipt, verifyManualBoundaryReceipt } from "../src/core/manual-boundary-receipts.mjs";
import {
  authoritativeArtifactProjectionFromText,
  defaultRoot,
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  opaqueExtensionsFromArtifactText,
  replaceOpaqueExtensions,
  validateArtifactText,
} from "../scripts/validate-artifact.source.mjs";

const fixtureRoot = join(defaultRoot, "tests", "fixtures", "artifacts");
const read = (name) => readFileSync(join(fixtureRoot, name), "utf8");
const plan = read("work-plan.valid.md");
const evidence = read("delivery-evidence.valid.md");
const review = read("work-review.valid.md");
const manualPlan = plan.replace("profile_max: supervised", "profile_max: manual").replace("contract_level: controlled", "contract_level: lean");
const manualIntentHash = authoritativeArtifactProjectionFromText(manualPlan).projection_hash;
const humanDetails = `### Outcome and approach

- Outcome: Retry handling is deterministic without changing the public contract.
- Approach and rationale: Update retry implementation and focused tests while preserving the public API.

### Scope and boundaries

- In scope: Repository changes under src and tests.
- Non-goals: No deployment or external service change.
- Constraints: Preserve the public API and repository-only delivery.

### Verification, risks, and recovery

- Acceptance and verification: Run retry verification twice and confirm the public API remains stable.
- Risks and trade-offs: The main risk is a public-contract regression; prefer the smallest deterministic change.
- Unknowns and recovery: Replan if scope, acceptance, or risk must change.`;

function nativePlan(todos) {
  const match = plan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const wrapperTodos = todos.map((todo) => {
    const lines = [
      `  - id: ${todo.id}`,
      `    content: ${JSON.stringify(todo.content)}`,
      "    status: pending",
    ];
    if (todo.workflow_attestation) {
      lines.push(`    workflow_attestation: ${JSON.stringify(todo.workflow_attestation)}`);
    }
    return lines.join("\n");
  }).join("\n");
  return [
    "---",
    "name: Adaptive retry",
    "overview: Implement and verify deterministic retry handling.",
    "todos:",
    wrapperTodos,
    "isProject: true",
    "---",
    "",
    "# Adaptive retry",
    "",
    "## Quick decision",
    "",
    "Implement deterministic retry handling after approval.",
    "",
    "### Next step",
    "",
    "Human: approve Implement Plan.",
    "",
    "## Details",
    "",
    ...humanDetails.split("\n"),
    "",
    "## Agent and machine contract (authoritative)",
    "",
    "The sections above are human projections. The exact Root below is the only implementation authority.",
    "",
    "### Completion handoff",
    "",
    "After **Implement Plan**, reply in this order: `Quick decision` with result, Check summary, optional blocker, and one action (`Human: start fresh /review-work or $review-work`); complete human `Details` covering outcome, approach, scope/non-goals, verification/limits, risks/unknowns/recovery; then authoritative `Agent and machine contract` with exact changed paths, Check commands/directories/observations, failures/uncertainty, and continuation. Do not claim Evidence, Review, or Learning.",
    "",
    "```yaml artifact-envelope",
    match[1],
    "```",
    match[2],
  ].join("\n");
}

function replanReview({ rootId = "wp-adaptive-retry", evidenceId = "de-adaptive-retry", reviewId = "wr-adaptive-replan", predecessorReviewId = null } = {}) {
  return review
    .replace("id: wr-adaptive-retry", `id: ${reviewId}`)
    .replace("root_plan_id: wp-adaptive-retry", `root_plan_id: ${rootId}`)
    .replace("latest_evidence_id: de-adaptive-retry", `latest_evidence_id: ${evidenceId}`)
    .replace("assessment: achieved", "assessment: not-achieved")
    .replace("delivery_status: verified", "delivery_status: blocked")
    .replace("next_action: none", "next_action: replan")
    .replace("predecessor_review_id: null", `predecessor_review_id: ${predecessorReviewId ?? "null"}`)
    .replace("Achieved. The required evidence is verified and no finding remains.", "Not-achieved. Changed intent requires a replacement Root.")
    .replace("## Next action\n\nNone.", "## Next action\n\nreplan: create a newly approved Root.");
}

function replanRoot({ id = "wp-adaptive-retry-v2", predecessorId = "wp-adaptive-retry", sourceReviewId = "wr-adaptive-replan" } = {}) {
  return plan
    .replace("id: wp-adaptive-retry", `id: ${id}\npredecessor_plan_id: ${predecessorId}\nreplan_source_review_id: ${sourceReviewId}`);
}

function boundaryReview({
  rootText = plan,
  reviewId = "wr-adaptive-boundary",
  predecessorReviewId = null,
  reasonCodes = ["out-of-authority-changes"],
  observedPaths = ["unexpected/outside.txt"],
} = {}) {
  const rootHash = createHash("sha256").update(rootText).digest("hex");
  return `---
artifact: work-review
schema: 5
id: ${reviewId}
status: complete
root_plan_id: wp-adaptive-retry
latest_evidence_id: null
review_basis: root-boundary
boundary_receipt:
  receipt_id: br-${"c".repeat(64)}
  observed_at: 2026-08-12T10:00:00.000Z
  recovery_error_code: authority-violation
  reason_codes: [${reasonCodes.join(", ")}]
  root_content_hash: ${rootHash}
  repository_snapshot_hash: ${"b".repeat(64)}
  observed_paths: [${observedPaths.join(", ")}]
assessment: insufficient-evidence
delivery_status: blocked
review_route: inline
next_action: replan
correction_id: null
predecessor_review_id: ${predecessorReviewId ?? "null"}
inspected_objectives: []
reused_objectives: []
inspected_checks: []
reused_checks: []
auditors_run: [inline]
---

## Assessment

Insufficient-evidence. The exact Root cannot produce valid Delivery Evidence for the observed repository boundary.

## Next action

replan: create a separately approved replacement Root.
`;
}

function evidenceFor(rootId, evidenceId) {
  return evidence
    .replace("id: de-adaptive-retry", `id: ${evidenceId}`)
    .replaceAll("wp-adaptive-retry", rootId);
}

function leanEvidence({ status = "complete", grade = "verified", path = "src/retry.mjs", includeStrategy = false, omit = null } = {}) {
  const fields = [
    "artifact: delivery-evidence",
    "schema: 5",
    "id: de-lean-retry",
    `status: ${status}`,
    "root_plan_id: wp-adaptive-retry",
    "subject_id: wp-adaptive-retry",
    "source_review_id: null",
    "predecessor_evidence_id: null",
    "representation: full",
    `intent_hash: ${manualIntentHash}`,
    ...(includeStrategy ? ["strategy_revision: 0"] : []),
    "evidence_mode: lean",
    `overall_grade: ${grade}`,
    "changed_paths:",
    `  - ${path}`,
    "affected_objectives: [OBJ-1]",
    "reused_objectives: []",
    "executed_checks: [CHECK-1]",
    "reused_checks: []",
    "check_evidence:",
    "  - check_id: CHECK-1",
    `    grade: ${grade}`,
    ...(omit === "surface" || !["verified"].includes(grade) ? [] : ["    surface: repository-test"]),
    ...(omit === "method" || grade === "unavailable" ? [] : ["    method: deterministic command"]),
    ...(omit === "expected" || grade === "unavailable" ? [] : ["    expected: Retry handling is deterministic"]),
    "    observed: Current repository result recorded",
    ...(omit === "repetitions" || grade !== "verified" ? [] : ["    repetitions: 1"]),
    ...(grade === "unavailable" ? ["    limitations:", "      - Verification surface was unavailable"] : ["    limitations: []"]),
  ];
  return `---\n${fields.join("\n")}\n---\n\n## Summary\n\nLean evidence records the changed path and check result without redundant tables.\n`;
}

function autonomousRoot() {
  return plan
    .replace("profile_max: supervised", "profile_max: autonomous")
    .replace("contract_level: controlled", "contract_level: certified")
    .replace("---\n\n## Intent", [
      "certification:",
      "  verification_profile_id: verify-repository",
      `  verification_profile_hash: ${"c".repeat(64)}`,
      "  task_recipe: bugfix",
      "  certified_region: src",
      `  route_pool_hash: ${"d".repeat(64)}`,
      "---",
      "",
      "## Intent",
    ].join("\n"));
}

test("lean, controlled, and certified roots accept their matching semantic contracts", () => {
  assert.deepEqual(validateArtifactText(manualPlan), []);
  assert.deepEqual(validateArtifactText(plan), []);
  assert.deepEqual(validateArtifactText(autonomousRoot()), []);
});

test("native Schema-5 plans require implementation work but no closeout ceremony", () => {
  const valid = nativePlan([
    { id: "step-1", content: "STEP-1 implement deterministic retry handling and verify CHECK-1" },
  ]);
  assert.deepEqual(validateArtifactText(valid), []);
  assert.match(valid, /### Completion handoff/);
  assert.match(validateArtifactText(valid.replace("- Non-goals: No deployment or external service change.", "- Non-goals:")).join("\n"), /Details coverage/);
  assert.match(validateArtifactText(valid.replace("### Completion handoff", "### Completion notes")).join("\n"), /Completion handoff/);
  assert.match(validateArtifactText(valid.replace("Human: start fresh /review-work or $review-work", "Agent: optionally review later")).join("\n"), /Completion handoff/);
  assert.match(validateArtifactText(nativePlan([])).join("\n"), /at least one implementation todo/);
  assert.doesNotMatch(JSON.stringify(valid), /workflow_attestation|plan-closeout|workflow_closeout/);
  assert.deepEqual(validateArtifactText(plan), []);
});

test("schema 5 rejects missing semantic core and mismatched contract levels", () => {
  assert.match(validateArtifactText(plan.replace(/^goal:.*\n/m, "")).join("\n"), /goal/);
  assert.match(validateArtifactText(plan.replace("contract_level: controlled", "contract_level: lean")).join("\n"), /contract_level must be controlled/);
  assert.match(validateArtifactText(autonomousRoot().replace(/^certification:[\s\S]*?^---$/m, "---")).join("\n"), /certification/);
});

test("semantic validation tolerates prose while keeping the authority envelope closed", () => {
  assert.deepEqual(validateArtifactText(plan.replace("Make retry handling deterministic on the current repository surface.", "Use any readable prose or list here.")), []);
  assert.match(validateArtifactText(plan.replace("  delivery: repository-only", "  delivery: repository-only\n  silent_push: true")).join("\n"), /additional property silent_push/);
  assert.match(validateArtifactText(plan.replace("  external_effects: none", "  external_effects: deployment")).join("\n"), /external_effects/);
});

test("verified delivery and review materialize a complete root", () => {
  const result = inspectArtifactSet([["plan", plan], ["evidence", evidence], ["review", review]]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.effective.get("de-adaptive-retry").effective.reviewReady, true);
  assert.equal(result.effective.get("wr-adaptive-retry").effective.plannedAssurance, "standard");
  const staleIntent = evidence.replace(/^intent_hash:.*$/m, `intent_hash: ${"a".repeat(64)}`);
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", staleIntent]]).errors.join("\n"), /intent_hash does not match authoritative Root projection/);
});

test("Schema 5 replan lineage is authoritative, linear, and bound to the current replan review", () => {
  const sourceReview = replanReview();
  const replacement = replanRoot();
  assert.deepEqual(validateArtifactText(replacement), []);
  const projection = authoritativeArtifactProjectionFromText(replacement).projection_text;
  assert.match(projection, /predecessor_plan_id/);
  assert.match(projection, /replan_source_review_id/);
  const valid = inspectArtifactSet([["plan", plan], ["evidence", evidence], ["review", sourceReview], ["replacement", replacement]]);
  assert.deepEqual(valid.errors, []);
  assert.equal(effectiveCliSummary(valid).active_root_id, "wp-adaptive-retry-v2");
  assert.deepEqual(effectiveCliSummary(valid).root_tips, ["wp-adaptive-retry-v2"]);

  assert.match(validateArtifactText(replacement.replace(/^replan_source_review_id:.*\n/m, "")).join("\n"), /replan_source_review_id/);
  assert.match(inspectArtifactSet([["replacement", replacement]]).errors.join("\n"), /missing predecessor plan|missing replan source review/);
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", evidence], ["review", review], ["replacement", replanRoot({ sourceReviewId: "wr-adaptive-retry" })]]).errors.join("\n"), /next_action replan/);
  const foreignPlan = plan.replace("id: wp-adaptive-retry", "id: wp-foreign");
  const foreignEvidence = evidenceFor("wp-foreign", "de-foreign");
  const foreignReview = replanReview({ rootId: "wp-foreign", evidenceId: "de-foreign", reviewId: "wr-foreign" });
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", evidence], ["foreign-plan", foreignPlan], ["foreign-evidence", foreignEvidence], ["foreign-review", foreignReview], ["replacement", replanRoot({ sourceReviewId: "wr-foreign" })]]).errors.join("\n"), /source review must belong to predecessor plan/);
  const laterReview = review
    .replace("id: wr-adaptive-retry", "id: wr-adaptive-later")
    .replace("predecessor_review_id: null", "predecessor_review_id: wr-adaptive-replan");
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", evidence], ["source-review", sourceReview], ["later-review", laterReview], ["replacement", replacement]]).errors.join("\n"), /source review must be the unique current predecessor review tip/);
  assert.match(inspectArtifactSet([["self", replanRoot({ predecessorId: "wp-adaptive-retry-v2" })]]).errors.join("\n"), /cannot reference itself/);
  const branch = replanRoot({ id: "wp-adaptive-retry-v3" });
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", evidence], ["review", sourceReview], ["replacement", replacement], ["branch", branch]]).errors.join("\n"), /lineage branches/);

  const rootA = replanRoot({ id: "wp-cycle-a", predecessorId: "wp-cycle-b", sourceReviewId: "wr-cycle-b" });
  const rootB = replanRoot({ id: "wp-cycle-b", predecessorId: "wp-cycle-a", sourceReviewId: "wr-cycle-a" });
  const evidenceA = evidenceFor("wp-cycle-a", "de-cycle-a");
  const evidenceB = evidenceFor("wp-cycle-b", "de-cycle-b");
  const reviewA = replanReview({ rootId: "wp-cycle-a", evidenceId: "de-cycle-a", reviewId: "wr-cycle-a" });
  const reviewB = replanReview({ rootId: "wp-cycle-b", evidenceId: "de-cycle-b", reviewId: "wr-cycle-b" });
  assert.match(inspectArtifactSet([["root-a", rootA], ["root-b", rootB], ["evidence-a", evidenceA], ["evidence-b", evidenceB], ["review-a", reviewA], ["review-b", reviewB]]).errors.join("\n"), /lineage is cyclic/);
});

test("root-boundary review unlocks only a lineage-preserving replan without fabricating Evidence", () => {
  const boundary = boundaryReview();
  const replacement = replanRoot({ sourceReviewId: "wr-adaptive-boundary" });
  assert.deepEqual(validateArtifactText(boundary), []);
  const trusted = { boundaryReceiptVerifier: () => ({ ok: true }) };
  assert.match(inspectArtifactSet([["plan", plan], ["boundary", boundary], ["replacement", replacement]]).errors.join("\n"), /protected host receipt/);
  assert.match(inspectArtifactSet([["plan", plan], ["boundary", boundary]], defaultRoot, { boundaryReceiptVerifier: () => ({ ok: false, reason: "stale snapshot" }) }).errors.join("\n"), /stale snapshot/);
  const valid = inspectArtifactSet([["plan", plan], ["boundary", boundary], ["replacement", replacement]], defaultRoot, trusted);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.effective.get("wr-adaptive-boundary").effective.boundaryReview, true);
  assert.equal(effectiveCliSummary(valid).active_root_id, "wp-adaptive-retry-v2");

  assert.match(validateArtifactText(boundary.replace("review_basis: root-boundary\n", "")).join("\n"), /latest_evidence_id|must be string/);
  assert.match(validateArtifactText(boundary.replace("next_action: replan", "next_action: correct")).join("\n"), /next_action|correction_id|learning_candidates/);
  assert.match(validateArtifactText(boundary.replace("auditors_run: [inline]", "auditors_run: [inline]\nlearning_candidates: [LRN-invalid]")).join("\n"), /learning_candidates/);
  assert.match(validateArtifactText(boundaryReview({ observedPaths: [] })).join("\n"), /observed_paths/);
  assert.match(inspectArtifactSet([["plan", plan], ["boundary", boundary.replace(/^  root_content_hash:.*$/m, `  root_content_hash: ${"a".repeat(64)}`)]]).errors.join("\n"), /root_content_hash/);
  assert.match(inspectArtifactSet([["plan", plan], ["boundary", boundaryReview({ observedPaths: ["/absolute.txt"] })]]).errors.join("\n"), /repository-relative/);
});

test("root-boundary host receipts are protected, current-snapshot-bound, and reject temporary recovery errors", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-boundary-receipt-"));
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
  const stateOptions = { baseRoot: join(directory, "state") };
  try {
    assert.throws(() => createManualBoundaryReceipt({
      rootPlanText: plan,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      recoveryErrorCode: "transport-timeout",
      captureSnapshot: () => snapshot,
      options: stateOptions,
    }), /rejects recoverable or unknown error/);
    const receipt = createManualBoundaryReceipt({
      rootPlanText: plan,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      recoveryErrorCode: "authority-violation",
      captureSnapshot: () => snapshot,
      now: () => new Date("2026-08-12T10:00:00.000Z"),
      options: stateOptions,
    });
    assert.equal(verifyManualBoundaryReceipt({
      receipt,
      rootPlanText: plan,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      captureSnapshot: () => snapshot,
      now: () => new Date("2026-08-12T10:01:00.000Z"),
      options: stateOptions,
    }).ok, true);
    assert.match(verifyManualBoundaryReceipt({
      receipt,
      rootPlanText: plan,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      captureSnapshot: () => ({ ...snapshot, status_fingerprint: "4".repeat(64) }),
      now: () => new Date("2026-08-12T10:01:00.000Z"),
      options: stateOptions,
    }).reason, /snapshot is stale/);
    assert.match(verifyManualBoundaryReceipt({
      receipt,
      rootPlanText: plan,
      pluginRoot: defaultRoot,
      workspaceRoot: workspace,
      captureSnapshot: () => snapshot,
      now: () => new Date("2026-08-12T10:16:00.000Z"),
      options: stateOptions,
    }).reason, /expired/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("effective mutation tips are restricted to the unique active Root", () => {
  const activePlan = { fields: { artifact: "work-plan", id: "wp-active" } };
  const correctionReview = {
    fields: { artifact: "work-review", id: "wr-correction", root_plan_id: "wp-active", predecessor_review_id: null, next_action: "correct", correction_id: "cp-active", latest_evidence_id: "de-initial" },
    correction: { learnings: [{ "Learning ID": "LRN-active" }] },
  };
  const achievedReview = { fields: { artifact: "work-review", id: "wr-achieved", root_plan_id: "wp-active", predecessor_review_id: "wr-correction", next_action: "none", assessment: "achieved", delivery_status: "verified" } };
  const correctionEvidence = { fields: { artifact: "delivery-evidence", id: "de-correction", root_plan_id: "wp-active", predecessor_evidence_id: "de-initial", subject_id: "cp-active", status: "complete" } };
  const initialEvidence = { fields: { artifact: "delivery-evidence", id: "de-initial", root_plan_id: "wp-active", predecessor_evidence_id: null, subject_id: "wp-active", status: "complete" } };
  const effective = new Map([["wp-active", activePlan], ["wr-correction", correctionReview], ["wr-achieved", achievedReview], ["de-initial", initialEvidence], ["de-correction", correctionEvidence]]);
  const summary = effectiveCliSummary({ effective, root_tips: ["wp-active"] });
  assert.deepEqual(summary.actionable_reviews, []);
  assert.equal(summary.learning_candidates.length, 1);
  assert.equal(summary.learning_candidates[0].evidence_confirmed, true);
  assert.deepEqual(effectiveCliSummary({ effective, root_tips: ["wp-active", "wp-other"] }).learning_candidates, []);
});

test("provisional evidence is allowed only for an evidence gap", () => {
  const provisional = evidence
    .replace("status: complete", "status: provisional")
    .replace("    grade: verified", "    grade: unavailable")
    .replace("overall_grade: verified", "overall_grade: unavailable")
    .replace("observed: Passed twice", "observed: Verification environment unavailable")
    .replace("repetitions: 2", "repetitions: 0")
    .replace("    limitations: []", "    limitations:\n      - Live surface unavailable");
  assert.deepEqual(validateArtifactText(provisional), []);
  const failed = provisional.replaceAll("unavailable", "failed");
  assert.match(validateArtifactText(failed).join("\n"), /failed check evidence must be blocked|provisional evidence requires/);
});

test("a known failed check can be blocked but can never be complete or provisional", () => {
  const failed = evidence
    .replace("status: complete", "status: blocked")
    .replace("    grade: verified", "    grade: failed")
    .replace("overall_grade: verified", "overall_grade: failed")
    .replace("| CHECK-1 | passed twice | passed |", "| CHECK-1 | assertion failed | failed |")
    .replace("The authorized repository change is complete and verified.", "BLOCKER: the required repository check failed.");
  assert.deepEqual(validateArtifactText(failed), []);
  assert.match(validateArtifactText(failed.replace("status: blocked", "status: provisional")).join("\n"), /failed check evidence must be blocked/);
  const provisionalReview = review
    .replace("assessment: achieved", "assessment: provisional")
    .replace("delivery_status: verified", "delivery_status: provisional")
    .replace("next_action: none", "next_action: accept-provisional")
    .replace("Achieved. The required evidence is verified and no finding remains.", "Provisional. Evidence remains incomplete.")
    .replace("## Next action\n\nNone.", "## Next action\n\naccept-provisional: explicit human acknowledgement required.");
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", failed], ["review", provisionalReview]]).errors.join("\n"), /known failed or blocked evidence/);
});

test("lean Manual evidence is risk-calibrated and materializes implicit defaults", () => {
  const lean = leanEvidence();
  const inspected = inspectArtifactText(lean);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.effective.strategyRevision, 0);
  assert.equal(inspected.effective.checkEvidence[0].baseline_or_patched, "patched");
  assert.deepEqual(inspectArtifactSet([["plan", manualPlan], ["evidence", lean]]).errors, []);
  assert.match(inspectArtifactSet([["plan", plan], ["evidence", lean]]).errors.join("\n"), /requires evidence_mode full/);
  assert.match(inspectArtifactSet([["plan", manualPlan.replace("risk: medium", "risk: high")], ["evidence", lean]]).errors.join("\n"), /requires evidence_mode full|intent_hash does not match/);
  assert.match(inspectArtifactSet([["plan", manualPlan.replace("hard_triggers: []", "hard_triggers: [material-uncertainty]")], ["evidence", lean]]).errors.join("\n"), /requires evidence_mode full|intent_hash does not match/);
});

test("lean checks enforce grade-specific evidence and repository authority", () => {
  for (const omitted of ["surface", "method", "expected", "repetitions"]) {
    assert.match(validateArtifactText(leanEvidence({ omit: omitted })).join("\n"), new RegExp(omitted));
  }
  assert.deepEqual(validateArtifactText(leanEvidence({ status: "provisional", grade: "unavailable" })), []);
  assert.match(validateArtifactText(leanEvidence({ status: "provisional", grade: "unavailable" }).replace("    limitations:\n      - Verification surface was unavailable", "    limitations: []")).join("\n"), /limitations/);
  assert.match(inspectArtifactSet([["plan", manualPlan], ["evidence", leanEvidence({ path: "README.md" })]]).errors.join("\n"), /outside root scope/);
  assert.match(validateArtifactText(leanEvidence({ status: "provisional", grade: "failed" })).join("\n"), /must be blocked|provisional evidence requires/);
});

test("opaque extensions remain hashable but outside the authoritative projection", () => {
  const withExtensions = plan.replace("constraints:\n  - Preserve the public API.", "constraints:\n  - Preserve the public API.\nextensions:\n  ticket: WF-4");
  assert.deepEqual(validateArtifactText(withExtensions), []);
  assert.deepEqual(opaqueExtensionsFromArtifactText(withExtensions).value, { ticket: "WF-4" });
  assert.doesNotMatch(authoritativeArtifactProjectionFromText(withExtensions).projection_text, /WF-4/);
  const replaced = replaceOpaqueExtensions(withExtensions, { present: true, value: { ticket: "WF-5" } });
  assert.match(replaced, /WF-5/);
});

test("execution contract separates immutable root projection from initial strategy", () => {
  const contract = executionContractFromArtifactText(plan);
  assert.equal(contract.fields.id, "wp-adaptive-retry");
  assert.equal(contract.fields.authority.delivery, "repository-only");
  assert.equal(contract.strategy.task_class, null);
  assert.equal(contract.strategy.revision, 0);
  assert.equal(contract.checks[0]["Check ID"], "CHECK-1");
  assert.equal(contract.checks[0]["Command or Inspection"], "npm test");
  assert.equal(contract.checks[0]["Evidence Class"], "machine-verifiable");
});

test("Workflow 3 and Workflow 4 artifacts are rejected by the mutable Schema 5 validator", () => {
  const old = plan.replace("schema: 5", "schema: 3");
  assert.match(inspectArtifactText(old).errors.join("\n"), /must be equal to constant/);
  assert.match(inspectArtifactText(plan.replace("schema: 5", "schema: 4")).errors.join("\n"), /must be equal to constant/);
});
