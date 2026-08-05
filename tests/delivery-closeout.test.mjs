import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../src/controller/delivery-closeout.mjs";
import { defaultRoot, inspectArtifactSet, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const controlledRoot = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
const leanRoot = controlledRoot
  .replace("profile_max: supervised", "profile_max: manual")
  .replace("contract_level: controlled", "contract_level: lean");

const verified = [{
  check_id: "CHECK-1",
  grade: "verified",
  surface: "repository-test",
  method: "deterministic command",
  expected: "Retry verification passes twice",
  observed: "Passed twice",
  repetitions: 2,
  artifact_hashes: ["b".repeat(64)],
  limitations: [],
}];

function correctionReview(evidenceId) {
  return `---
artifact: work-review
schema: 5
id: wr-closeout-correction
status: complete
root_plan_id: wp-adaptive-retry
latest_evidence_id: ${evidenceId}
assessment: mostly-achieved
delivery_status: blocked
review_route: targeted
next_action: correct
correction_id: cp-closeout-fix
predecessor_review_id: null
auditors_run: [inline, delivery-auditor]
inspected_objectives: [OBJ-1]
reused_objectives: []
inspected_checks: [CHECK-1]
reused_checks: []
learning_candidates: [LRN-closeout-regression]
---

## Assessment

Mostly-achieved: the root result needs one focused regression assertion.

## Evidence coverage

| Kind | Inspected | Reused | Result | Evidence |
|---|---|---|---|---|
| Objectives | OBJ-1 | none | gap | current Evidence |
| Checks | CHECK-1 | none | passed | current Evidence |
| Auditors | inline, delivery-auditor | none | complete | reviewer receipts |

## Findings

| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |
|---|---|---|---|---|---|
| missing-regression-case | medium | OBJ-1 | CHECK-1 | tests need one explicit assertion | The acceptance boundary is not directly asserted. |

## Next action

Correct the focused regression gap.

## Correction plan

### cp-closeout-fix

| Correction ID | Root Plan | Source Review | Base Evidence | Predecessor Correction | Risk |
|---|---|---|---|---|---|
| cp-closeout-fix | wp-adaptive-retry | wr-closeout-correction | ${evidenceId} | none | medium |

| FIX ID | Finding keys | Root Objectives | Root Checks | Required outcome | Evidence |
|---|---|---|---|---|---|
| FIX-1 | missing-regression-case | OBJ-1 | CHECK-1 | Add the focused regression assertion. | Reviewer finding. |

| Step ID | FIX IDs | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action |
|---|---|---|---|---|---|---|---|
| STEP-1 | FIX-1 | tests/retry.test.mjs | Add only the focused assertion. | Use the existing test style. | PROBE-1: the assertion exists and passes. | CHECK-101 | Stop on scope expansion. |

| Check ID | FIX IDs | Working Directory | Command or Inspection | Expected Result | Required | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|
| CHECK-101 | FIX-1 | repository root | npm test | The focused assertion and suite pass. | yes | standard | tests/retry.test.mjs, package.json |

| Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence |
|---|---|---|---|---|
| LRN-closeout-regression | missing-regression-case | Add direct regression assertions for acceptance boundaries. | project test guidance | Correction Evidence verifies CHECK-101. |
`;
}

function followupReview(evidenceId) {
  return `---
artifact: work-review
schema: 5
id: wr-closeout-followup
status: complete
root_plan_id: wp-adaptive-retry
latest_evidence_id: ${evidenceId}
assessment: achieved
delivery_status: verified
review_route: targeted
next_action: none
correction_id: null
predecessor_review_id: wr-closeout-correction
auditors_run: [inline, delivery-auditor]
inspected_objectives: [OBJ-1]
reused_objectives: []
inspected_checks: [CHECK-1]
reused_checks: []
---

## Assessment

Achieved. The correction closes the finding and retained root proof remains valid.

## Evidence coverage

| Kind | Inspected | Reused | Result | Evidence |
|---|---|---|---|---|
| Objectives | OBJ-1 | none | achieved | Correction Evidence |
| Checks | CHECK-1 | none | passed | Correction and prior Evidence |
| Auditors | inline, delivery-auditor | none | complete | reviewer receipts |
| Snapshot | current | none | consistent | correction repository snapshot |

## Findings

None.

## Next action

None.
`;
}

function replanReview(evidenceId) {
  return `---
artifact: work-review
schema: 5
id: wr-closeout-replan
status: complete
root_plan_id: wp-adaptive-retry
latest_evidence_id: ${evidenceId}
assessment: partially-achieved
delivery_status: blocked
review_route: targeted
next_action: replan
correction_id: null
predecessor_review_id: null
auditors_run: [inline, delivery-auditor]
inspected_objectives: [OBJ-1]
reused_objectives: []
inspected_checks: [CHECK-1]
reused_checks: []
---

## Assessment

Partially-achieved: the requested scope now changes immutable intent.

## Evidence coverage

| Kind | Inspected | Reused | Result | Evidence |
|---|---|---|---|---|
| Objectives | OBJ-1 | none | changed intent | current Evidence |
| Checks | CHECK-1 | none | passed | current Evidence |
| Auditors | inline, delivery-auditor | none | complete | reviewer receipts |
| Snapshot | current | none | consistent | current repository snapshot |

## Findings

| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |
|---|---|---|---|---|---|
| intent-scope-changed | medium | OBJ-1 | CHECK-1 | human requested a broader outcome | The existing Root cannot authorize the new outcome. |

## Next action

Replan the changed intent in a fresh Root.
`;
}

test("closeout deterministically builds full controlled evidence", () => {
  const first = buildDeliveryEvidence({
    rootPlanText: controlledRoot,
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    strategyRevision: 2,
    effectiveProfile: "supervised",
    repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "none", known_failures: "none" },
    pluginRoot: defaultRoot,
  });
  const second = buildDeliveryEvidence({
    rootPlanText: controlledRoot,
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    strategyRevision: 2,
    effectiveProfile: "supervised",
    repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "none", known_failures: "none" },
    pluginRoot: defaultRoot,
  });
  assert.equal(first.artifact, second.artifact);
  assert.equal(first.fields.evidence_mode, "full");
  assert.equal(first.fields.status, "complete");
  assert.equal(first.fields.intent_hash.length, 64);
  assert.deepEqual(inspectArtifactText(first.artifact, defaultRoot).errors, []);
});

test("closeout chooses lean evidence and calibrates provisional or blocked status", () => {
  const provisional = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: [{ ...verified[0], grade: "unavailable", observed: "UI unavailable", repetitions: 0, limitations: ["interactive UI unavailable"] }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  });
  assert.equal(provisional.fields.evidence_mode, "lean");
  assert.equal(provisional.fields.status, "provisional");
  assert.equal(provisional.fields.overall_grade, "unavailable");
  assert.doesNotMatch(provisional.artifact, /strategy_revision:/);

  const leanStable = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: [{ ...verified[0], grade: "unavailable", observed: "UI unavailable", repetitions: 0, limitations: ["interactive UI unavailable"] }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    strategyRevision: 99,
    repositorySnapshot: { head: "ignored-for-lean", relevant_fingerprints: "ignored-for-lean" },
    pluginRoot: defaultRoot,
  });
  assert.equal(leanStable.artifact, provisional.artifact);

  const blocked = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: [{ ...verified[0], grade: "failed", observed: "assertion failed", repetitions: 1, limitations: [] }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  });
  assert.equal(blocked.fields.status, "blocked");
  assert.match(blocked.artifact, /BLOCKER:/);
});

test("manual high risk and Hard Trigger roots require full evidence", () => {
  const highRisk = leanRoot.replace("risk: medium", "risk: high");
  const hardTrigger = leanRoot.replace("hard_triggers: []", "hard_triggers:\n  - breaking-external-contract");
  for (const rootPlanText of [highRisk, hardTrigger]) {
    const result = buildDeliveryEvidence({
      rootPlanText,
      checkEvidence: verified,
      changedPaths: ["src/retry.mjs"],
      effectiveProfile: "manual",
      repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "root and Checks", known_failures: "none" },
      pluginRoot: defaultRoot,
    });
    assert.equal(result.fields.evidence_mode, "full");
    assert.match(result.artifact, /## Repository snapshot/);
  }
  const controlledCannotBeDowngraded = buildDeliveryEvidence({
    rootPlanText: controlledRoot,
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "root and Checks", known_failures: "none" },
    pluginRoot: defaultRoot,
  });
  assert.equal(controlledCannotBeDowngraded.fields.evidence_mode, "full");
});

test("closeout rejects incomplete Checks and paths outside Root authority", () => {
  assert.throws(() => buildDeliveryEvidence({ rootPlanText: leanRoot, checkEvidence: [], pluginRoot: defaultRoot }), /structured Check evidence/);
  assert.throws(() => buildDeliveryEvidence({ rootPlanText: controlledRoot, checkEvidence: verified, changedPaths: ["src/retry.mjs"], effectiveProfile: "supervised", pluginRoot: defaultRoot }), /requires repository snapshot/);
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: verified,
    changedPaths: ["docs/outside.md"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  }), /outside root scope/);
  const valid = buildDeliveryEvidence({ rootPlanText: leanRoot, checkEvidence: verified, changedPaths: ["src/retry.mjs"], effectiveProfile: "manual", pluginRoot: defaultRoot });
  const wrongHash = valid.artifact.replace(/intent_hash: [a-f0-9]{64}/, `intent_hash: ${"0".repeat(64)}`);
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [{ label: "wrong-hash", text: wrongHash }],
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  }), /intent_hash|intent hash|invalid/i);
});

test("handoff store is append-only, restart-safe, and root-bound", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-handoff-"));
  try {
    const store = new ArtifactHandoffStore(directory, defaultRoot);
    const recordedRoot = store.record([{ label: "root", text: leanRoot }]);
    assert.deepEqual(recordedRoot.recorded, ["wp-adaptive-retry"]);
    assert.equal(statSync(join(directory, "handoff", "artifacts", "wp-adaptive-retry.json")).mode & 0o777, 0o600);
    assert.equal(readdirSync(join(directory, "handoff", "artifacts")).some((name) => name.endsWith(".tmp")), false);
    const evidence = buildDeliveryEvidence({
      rootPlanText: leanRoot,
      checkEvidence: verified,
      changedPaths: ["src/retry.mjs"],
      effectiveProfile: "manual",
      pluginRoot: defaultRoot,
    });
    const recordedEvidence = store.record([{ label: evidence.fields.id, text: evidence.artifact }]);
    assert.deepEqual(recordedEvidence.recorded, [evidence.fields.id]);
    assert.deepEqual(store.record([{ label: evidence.fields.id, text: evidence.artifact }]).duplicates, [evidence.fields.id]);

    const restarted = new ArtifactHandoffStore(directory, defaultRoot);
    const context = restarted.context("wp-adaptive-retry", leanRoot);
    assert.equal(context.evidence_tip, evidence.fields.id);
    assert.equal(context.artifacts.length, 2);
    assert.throws(() => restarted.record([{ label: evidence.fields.id, text: evidence.artifact.replace("Passed twice", "Passed once") }]), /conflicts/);
    assert.throws(() => restarted.context("wp-adaptive-retry", leanRoot.replace("risk: medium", "risk: low")), /conflicts/);
    writeFileSync(join(directory, "handoff", ".lock"), `${JSON.stringify({ pid: process.pid })}\n`, { mode: 0o600 });
    assert.throws(() => restarted.record([{ label: "duplicate", text: leanRoot }]), /concurrent/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("separated contexts preserve Root, initial Evidence, review, correction Evidence, and follow-up review", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-handoff-e2e-"));
  try {
    new ArtifactHandoffStore(directory, defaultRoot).record([{ label: "root", text: leanRoot }]);
    const firstContext = new ArtifactHandoffStore(directory, defaultRoot);
    const initial = buildDeliveryEvidence({
      rootPlanText: leanRoot,
      checkEvidence: verified,
      changedPaths: ["src/retry.mjs"],
      effectiveProfile: "manual",
      pluginRoot: defaultRoot,
    });
    firstContext.record([{ label: initial.fields.id, text: initial.artifact }]);

    const reviewText = correctionReview(initial.fields.id);
    assert.deepEqual(inspectArtifactText(reviewText, defaultRoot).errors, []);
    new ArtifactHandoffStore(directory, defaultRoot).record([{ label: "review", text: reviewText }]);
    const correction = buildDeliveryEvidence({
      rootPlanText: leanRoot,
      artifacts: new ArtifactHandoffStore(directory, defaultRoot).context("wp-adaptive-retry").artifacts,
      checkEvidence: [{ ...verified[0], check_id: "CHECK-101", observed: "Focused assertion and suite passed" }],
      changedPaths: ["tests/retry.test.mjs"],
      effectiveProfile: "manual",
      pluginRoot: defaultRoot,
    });
    assert.equal(correction.fields.representation, "delta");
    assert.equal(correction.fields.source_review_id, "wr-closeout-correction");
    assert.equal(correction.fields.predecessor_evidence_id, initial.fields.id);
    new ArtifactHandoffStore(directory, defaultRoot).record([{ label: correction.fields.id, text: correction.artifact }]);

    const followup = followupReview(correction.fields.id);
    const completeSet = [
      ["root", leanRoot],
      ["initial", initial.artifact],
      ["review", reviewText],
      ["correction", correction.artifact],
      ["followup", followup],
    ];
    assert.deepEqual(inspectArtifactSet(completeSet, defaultRoot).errors, []);
    new ArtifactHandoffStore(directory, defaultRoot).record([{ label: "followup", text: followup }]);
    const fresh = new ArtifactHandoffStore(directory, defaultRoot).context("wp-adaptive-retry", leanRoot);
    assert.equal(fresh.evidence_tip, correction.fields.id);
    assert.equal(fresh.review_tip, "wr-closeout-followup");
    assert.equal(fresh.artifacts.length, 5);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("current tips are idempotent but changed closeout inputs are stale", () => {
  const initial = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  });
  const same = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [{ label: initial.fields.id, text: initial.artifact }],
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  });
  assert.equal(same.duplicate, true);
  assert.equal(same.artifact, initial.artifact);
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: leanRoot,
    artifacts: [{ label: initial.fields.id, text: initial.artifact }],
    checkEvidence: [{ ...verified[0], observed: "different result" }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  }), /stale or competing closeout/);
});

test("cache-only failure returns valid Evidence while semantic conflicts remain fatal", () => {
  const closeout = buildDeliveryEvidence({
    rootPlanText: leanRoot,
    checkEvidence: verified,
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "manual",
    pluginRoot: defaultRoot,
  });
  const unavailableStore = { pluginRoot: defaultRoot, record: () => { const error = new Error("permission denied"); error.code = "EACCES"; throw error; } };
  const fallback = persistCloseout({ handoffStore: unavailableStore, rootPlanText: leanRoot, closeout });
  assert.equal(fallback.handoff_persisted, false);
  assert.equal(fallback.artifact, closeout.artifact);
  assert.match(fallback.warning, /attach the returned artifact explicitly/);
  const conflictStore = { pluginRoot: defaultRoot, record: () => { throw new Error("handoff artifact conflicts with immutable text"); } };
  assert.throws(() => persistCloseout({ handoffStore: conflictStore, rootPlanText: leanRoot, closeout }), /conflicts/);
});

test("handoff isolates multiple Roots and rejects legacy Schema-3/4 artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-handoff-roots-"));
  try {
    const secondRoot = leanRoot.replaceAll("wp-adaptive-retry", "wp-adaptive-retry-two");
    const store = new ArtifactHandoffStore(directory, defaultRoot);
    store.record([{ label: "one", text: leanRoot }, { label: "two", text: secondRoot }]);
    assert.equal(store.context("wp-adaptive-retry").artifacts.length, 1);
    assert.equal(store.context("wp-adaptive-retry-two").artifacts.length, 1);
    for (const schema of [3, 4]) {
      const legacy = leanRoot.replace("schema: 5", `schema: ${schema}`);
      assert.throws(() => store.record([{ label: `legacy-${schema}`, text: legacy }]), /invalid|Schema 5/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("handoff context retains replan lineage and its source review", () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-handoff-replan-"));
  try {
    const initial = buildDeliveryEvidence({
      rootPlanText: leanRoot,
      checkEvidence: verified,
      changedPaths: ["src/retry.mjs"],
      effectiveProfile: "manual",
      pluginRoot: defaultRoot,
    });
    const review = replanReview(initial.fields.id);
    const replacement = leanRoot
      .replace("id: wp-adaptive-retry", "id: wp-adaptive-retry-replanned\npredecessor_plan_id: wp-adaptive-retry\nreplan_source_review_id: wr-closeout-replan")
      .replace("Make retry handling deterministic without changing the public contract.", "Make retry handling deterministic under the newly approved contract boundary.");
    assert.throws(() => buildDeliveryEvidence({
      rootPlanText: replacement,
      checkEvidence: verified,
      changedPaths: ["src/retry.mjs"],
      effectiveProfile: "manual",
      pluginRoot: defaultRoot,
    }), /predecessor|source review|lineage/i);
    const chain = [["root", leanRoot], ["evidence", initial.artifact], ["review", review], ["replacement", replacement]];
    assert.deepEqual(inspectArtifactSet(chain, defaultRoot).errors, []);
    const store = new ArtifactHandoffStore(directory, defaultRoot);
    store.record(chain.map(([label, text]) => ({ label, text })));
    const context = new ArtifactHandoffStore(directory, defaultRoot).context("wp-adaptive-retry-replanned", replacement);
    assert.deepEqual(context.artifacts.map((entry) => entry.label).sort(), ["wp-adaptive-retry", initial.fields.id, "wr-closeout-replan", "wp-adaptive-retry-replanned"].sort());
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
