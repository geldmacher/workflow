import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRoot,
  inspectArtifactSet,
  inspectArtifactText,
  validateArtifactSet,
  validateArtifactText,
} from "../scripts/validate-artifact.source.mjs";

const fixtureRoot = join(defaultRoot, "tests", "fixtures", "artifacts");
const read = (name) => readFileSync(join(fixtureRoot, name), "utf8");
const artifacts = {
  plan: read("work-plan.valid.md"),
  initialEvidence: read("delivery-evidence.valid.md"),
  correctionReview: read("work-review-correction.valid.md"),
  correctionEvidence: read("delivery-evidence-correction.valid.md"),
  secondCorrectionReview: read("work-review-correction-2.valid.md"),
  secondCorrectionEvidence: read("delivery-evidence-correction-2.valid.md"),
  achievedReview: read("work-review.valid.md"),
};

const fullChain = () => Object.entries(artifacts);

test("materializes two delta corrections into complete root state", () => {
  const inspected = inspectArtifactSet(fullChain());
  assert.deepEqual(inspected.errors, []);
  const evidence = inspected.effective.get("de-20260712T150510Z-rollback-correction").effective;
  assert.equal(evidence.objectives.size, 2);
  assert.equal(evidence.checks.get("CHECK-2").reusedFrom, "de-20260712T150508Z-whitespace-correction");
  assert.equal(evidence.reviewReady, true);
  const review = inspected.effective.get("wr-20260712T150511Z-retry-root-achieved").effective;
  assert.equal(review.snapshotId, "rs-20260712T150510Z-rollback-correction");
  assert.equal(review.correctionRound, 2);
});

test("uses predecessor topology and infers an unambiguous review predecessor", () => {
  const inspected = inspectArtifactSet(fullChain());
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.effective.get("wr-20260712T150511Z-retry-root-achieved").fields.predecessor_review_id, "wr-20260712T150509Z-rollback-gap-review");
  assert.ok(inspected.normalizations.some((item) => /predecessor_review_id inferred/.test(item)));
});

test("extracts one artifact through Cursor text and rejects competing artifacts", () => {
  const inspected = inspectArtifactText(`Inspecting current sources.\n${artifacts.achievedReview}\nReview complete.`);
  assert.deepEqual(inspected.errors, []);
  assert.ok(inspected.normalizations.some((item) => /preamble/.test(item)));
  assert.match(validateArtifactText(`${artifacts.initialEvidence}\n${artifacts.achievedReview}`).join("\n"), /multiple workflow artifact candidates/);
});

test("accepts flexible IDs, optional timestamps, additional metadata, and heading aliases", () => {
  const flexible = artifacts.plan
    .replaceAll("wp-20260712T150503Z-configurable-retry-multiplier", "wp-retry-root")
    .replace("status: ready", "status: ready\nmodel_note: useful but non-authoritative")
    .replace("## Intent and decisions", "## Intent readiness")
    .replace("## Scope and targets", "## Scope")
    .replace("## Execution steps", "## Steps")
    .replace("## Risk and closeout", "## Assurance");
  const inspected = inspectArtifactText(flexible);
  assert.deepEqual(inspected.errors, []);
  assert.ok(inspected.diagnostics.some((item) => /model_note/.test(item)));
  assert.ok(inspected.normalizations.some((item) => /normalized section/.test(item)));
  assert.equal("created_at" in inspected.artifact.fields, false);
});

test("accepts Cursor's current native plan wrapper and numeric comparisons", () => {
  const currentWrapper = artifacts.plan
    .replace("name: Configurable retry multiplier\noverview: Add a bounded retry multiplier while preserving existing retry behavior and repository-only delivery.\n", "")
    .replace("invalid values use the default without regressions.", "invalid values below <1 or above >10 use the default without regressions.");
  assert.deepEqual(validateArtifactText(currentWrapper), []);
});

test("accepts explicit embedded None markers for optional Lean tables", () => {
  const lean = artifacts.plan
    .replace(/\| Decision ID \| Choice \| Rationale \| Rejected alternative \| Source \|\n\|---\|---\|---\|---\|---\|\n(?:\|.*\n)+?(?=## Objectives)/, "None.\n")
    .replace(/\| Control ID \| Control \| Objective or failure mode \| Expected benefit \| Cost class \| Decision \| Rationale \|\n\|---\|---\|---\|---\|---\|---\|---\|\n(?:\|.*\n)+?(?=### Approval gates)/, "None.\n");
  const inspected = inspectArtifactText(lean);
  assert.deepEqual(inspected.errors, []);
  assert.ok(inspected.normalizations.filter((item) => /embedded empty marker/.test(item)).length >= 2);
});

test("accepts reordered and aliased table columns", () => {
  const columns = artifacts.initialEvidence.replace(
    "| Objective ID | Status | Evidence |\n|---|---|---|\n| OBJ-1 | achieved | Focused multiplier behavior passed. |\n| OBJ-2 | achieved | Regression behavior passed. |",
    "| Status | Evidence | Objective |\n|---|---|---|\n| achieved | Focused multiplier behavior passed. | OBJ-1 |\n| achieved | Regression behavior passed. | OBJ-2 |",
  );
  const inspected = inspectArtifactText(columns);
  assert.deepEqual(inspected.errors, []);
  assert.ok(inspected.normalizations.some((item) => /Objective outcomes: normalized table column/.test(item)));
});

test("accepts adaptive evidence and review sections", () => {
  const compactEvidence = artifacts.initialEvidence
    .replace(/## Subject results[\s\S]*?(?=## Objective outcomes)/, "")
    .replace(/## Changes[\s\S]*?(?=## Repository snapshot)/, "")
    .replace(/## Idempotency and resume[\s\S]*?(?=## Deviations)/, "")
    .replace(/## Deviations[\s\S]*?(?=## Operational evidence)/, "")
    .replace(/## Residual risks[\s\S]*$/, "");
  assert.deepEqual(validateArtifactText(compactEvidence), []);

  const compactReview = artifacts.achievedReview.replace(/## Evidence coverage[\s\S]*?(?=## Next action)/, "");
  assert.deepEqual(validateArtifactText(compactReview), []);
});

test("computes assurance while preserving risk and human-lowering invariants", () => {
  const inspected = inspectArtifactText(artifacts.plan);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.artifact.fields.assurance_score, 4);

  const highScore = artifacts.plan
    .replace("| Failure impact | 2 |", "| Failure impact | 3 |")
    .replace("| Irreversibility | 0 |", "| Irreversibility | 2 |")
    .replace("| Uncertainty | 1 |", "| Uncertainty | 2 |")
    .replace("| Evidence weakness | 0 |", "| Evidence weakness | 2 |");
  assert.match(validateArtifactText(highScore).join("\n"), /derived profile deep/);

  const lowered = artifacts.plan
    .replace("assurance_profile: standard", "assurance_profile: lean")
    .replace("assurance_override: none", "assurance_override: lowered")
    .replace("assurance_override_decision_id: null", "assurance_override_decision_id: DEC-1");
  assert.match(validateArtifactText(lowered).join("\n"), /human-sourced decision/);
});

test("ready plans reject open material decisions and accept resolved interview decisions", () => {
  const openDecision = artifacts.plan.replace(
    "| Material open decisions | None. | Intent Readiness completed. |",
    "| Material open decisions | Decide whether invalid values throw or fall back. | Human answer required. |",
  );
  assert.match(validateArtifactText(openDecision).join("\n"), /ready work-plan requires no material open decisions/);

  const resolvedInterview = artifacts.plan.replace(
    "| DEC-1 | Add one bounded environment-controlled multiplier. | It satisfies the requested behavior without changing unrelated retry defaults. | Redesign the retry subsystem. | Repository inspection and user intent. |",
    "| DEC-1 | Keep invalid values on the documented default. | It preserves the selected compatibility behavior. | Throw on invalid input. | Human answer via native Intent Interview. |",
  );
  assert.deepEqual(validateArtifactText(resolvedInterview), []);
});

test("keeps full effective Objective and required-Check partitions", () => {
  const missingObjective = artifacts.correctionEvidence.replace("reused_objectives: [OBJ-2]", "reused_objectives: []");
  assert.match(validateArtifactSet(fullChain().map(([label, value]) => [label, label === "correctionEvidence" ? missingObjective : value])).join("\n"), /partition the root set/);
  const missingCheck = artifacts.correctionEvidence.replace("reused_checks: [CHECK-2]", "reused_checks: []");
  assert.match(validateArtifactSet(fullChain().map(([label, value]) => [label, label === "correctionEvidence" ? missingCheck : value])).join("\n"), /root Check.*partition/);
});

test("keeps runtime operational evidence semantic", () => {
  const missing = artifacts.initialEvidence.replace(/## Operational evidence[\s\S]*?(?=## Residual risks)/, "");
  assert.match(validateArtifactSet([["plan", artifacts.plan], ["evidence", missing]]).join("\n"), /runtime operational evidence is missing Observable signal/);
  const unsatisfied = artifacts.initialEvidence.replace("| Observable signal | Invalid values use the default. | Boundary tests inspect returned values. | satisfied |", "| Observable signal | Invalid values use the default. | Boundary tests inspect returned values. | unsatisfied |");
  assert.match(validateArtifactSet([["plan", artifacts.plan], ["evidence", unsatisfied]]).join("\n"), /complete runtime evidence requires satisfied operational proof/);
});

test("rejects changed fingerprints but allows lean change-impact reuse", () => {
  const drift = artifacts.correctionEvidence.replaceAll(
    "src/retry-policy.js`=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "src/retry-policy.js`=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  );
  assert.match(validateArtifactSet(fullChain().map(([label, value]) => [label, label === "correctionEvidence" ? drift : value])).join("\n"), /changed fingerprint.*invalidates reuse/);

  const inspectedReuse = artifacts.correctionEvidence
    .replace(/`[^`]+`=[a-f0-9]{64}(?:; )?/g, "")
    .replace(/(\| rs-20260712T150508Z-whitespace-correction \| abc123 \| modified \| `src\/retry-policy\.js`, `test\/retry-policy\.test\.js` \| )[^|]+(\| None\. \|)/, "$1inspected unchanged: src/retry-policy.js, package.json$2");
  const chain = [["plan", artifacts.plan], ["initial", artifacts.initialEvidence], ["review", artifacts.correctionReview], ["correction", inspectedReuse]];
  assert.deepEqual(validateArtifactSet(chain), []);
});

test("deep reuse requires strong fingerprints or fresh checks", () => {
  const deep = artifacts.plan
    .replace("assurance_profile: standard", "assurance_profile: deep")
    .replace("| Failure impact | 2 |", "| Failure impact | 3 |")
    .replace("| Irreversibility | 0 |", "| Irreversibility | 1 |")
    .replace("| Evidence weakness | 0 |", "| Evidence weakness | 1 |");
  const inspectedReuse = artifacts.correctionEvidence
    .replace(/`[^`]+`=[a-f0-9]{64}(?:; )?/g, "")
    .replace(/(\| rs-20260712T150508Z-whitespace-correction \| abc123 \| modified \| `src\/retry-policy\.js`, `test\/retry-policy\.test\.js` \| )[^|]+(\| None\. \|)/, "$1inspected unchanged: src/retry-policy.js, package.json$2");
  const errors = validateArtifactSet([["plan", deep], ["initial", artifacts.initialEvidence], ["review", artifacts.correctionReview], ["correction", inspectedReuse]]);
  assert.match(errors.join("\n"), /strong fingerprint/);
});

test("accepts documented equivalent Check execution", () => {
  const equivalent = artifacts.initialEvidence
    .replace(
      "## Checks\n| Check ID | Observed Result | Status | Prerequisite fingerprints |\n|---|---|---|---|",
      "## Checks\n| Check | Observed Result | Status | Prerequisite fingerprints | Actual execution | Equivalence rationale |\n|---|---|---|---|---|---|",
    )
    .replace(/(\| CHECK-1 \|[^\n]+)( \|)\n/, "$1 | npm run test:equivalent | Same expected result and coverage. |\n")
    .replace(/(\| CHECK-2 \|[^\n]+)( \|)\n/, "$1 | npm run test:regression-equivalent | Same expected result and coverage. |\n");
  assert.deepEqual(validateArtifactText(equivalent), []);
});

test("named auditors are optional when achieved evidence is otherwise complete", () => {
  const noAuditorToken = artifacts.achievedReview.replace("auditors_run: [inline]", "auditors_run: []");
  assert.deepEqual(validateArtifactSet(fullChain().map(([label, value]) => [label, label === "achievedReview" ? noAuditorToken : value])), []);
});

test("corrections remain Finding-backed and inside root scope", () => {
  const unknown = artifacts.correctionReview.replace("| FIX-1 | missing-whitespace-boundary |", "| FIX-1 | unrelated-gap |");
  assert.match(validateArtifactText(unknown).join("\n"), /unknown Finding key unrelated-gap/);
  const scope = artifacts.correctionReview.replace("| STEP-1 | FIX-1 | `test/retry-policy.test.js` |", "| STEP-1 | FIX-1 | `src/unrelated.js` |");
  assert.match(validateArtifactSet([["plan", artifacts.plan], ["evidence", artifacts.initialEvidence], ["review", scope]]).join("\n"), /outside root scope/);
});

function repeatedFindingChain({ progress }) {
  const first = artifacts.correctionReview.replaceAll("missing-whitespace-boundary", "persistent-boundary-gap");
  const second = artifacts.secondCorrectionReview.replaceAll("missing-upper-bound", "persistent-boundary-gap");
  let firstEvidence = artifacts.correctionEvidence;
  let secondEvidence = artifacts.secondCorrectionEvidence;
  if (!progress) {
    firstEvidence = firstEvidence.replaceAll("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    secondEvidence = secondEvidence.replaceAll("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  }
  const third = artifacts.achievedReview
    .replace("assessment: achieved", "assessment: partially-achieved")
    .replace("next_action: none", "next_action: clarify")
    .replace("achieved: the effective", "partially-achieved: one persistent gap remains in the effective")
    .replace("## Next action", "## Findings\n| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |\n|---|---|---|---|---|---|\n| persistent-boundary-gap | medium | OBJ-1 | CHECK-1 | The same proof remains incomplete. | Further work needs human direction. |\n\n## Next action")
    .replace("none: the human may end the loop or request another review.", "clarify: choose another in-scope approach or replan.");
  return fullChain().map(([label, value]) => {
    if (label === "correctionReview") return [label, first];
    if (label === "correctionEvidence") return [label, firstEvidence];
    if (label === "secondCorrectionReview") return [label, second];
    if (label === "secondCorrectionEvidence") return [label, secondEvidence];
    if (label === "achievedReview") return [label, third];
    return [label, value];
  });
}

test("reports correction churn diagnostically without revoking human control", () => {
  const stalled = inspectArtifactSet(repeatedFindingChain({ progress: false }));
  assert.deepEqual(stalled.errors, []);
  assert.equal(stalled.effective.get("wr-20260712T150511Z-retry-root-achieved").effective.loopState, "stalled");
  assert.ok(stalled.diagnostics.some((item) => /clarify or replan is recommended/.test(item)));

  const progressing = inspectArtifactSet(repeatedFindingChain({ progress: true }));
  assert.deepEqual(progressing.errors, []);
  assert.notEqual(progressing.effective.get("wr-20260712T150511Z-retry-root-achieved").effective.loopState, "stalled");
});

test("rejects invalid schema, missing roots, branches, and non-tip evidence", () => {
  assert.match(validateArtifactText(artifacts.plan.replace("schema: 2", "schema: 1")).join("\n"), /must be equal to constant/);
  assert.match(validateArtifactSet([["evidence", artifacts.initialEvidence]]).join("\n"), /missing root plan/);
  const branch = artifacts.secondCorrectionEvidence
    .replaceAll("de-20260712T150510Z-rollback-correction", "de-rollback-branch")
    .replaceAll("rs-20260712T150510Z-rollback-correction", "rs-rollback-branch");
  assert.match(validateArtifactSet([...fullChain(), ["branch", branch]]).join("\n"), /evidence.*chain branches/);
});
