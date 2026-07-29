import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  authoritativeArtifactProjectionFromText,
  defaultRoot,
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  opaqueExtensionsFromArtifactText,
  replaceOpaqueExtensions,
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

function planAtDepth(depth) {
  let plan = artifacts.plan
    .replace("design_depth: oneshot", `design_depth: ${depth}`)
    .replace("writer_tier_required: economy", `writer_tier_required: ${depth === "full" ? "escalated" : "economy"}`);
  if (depth === "full") plan = plan.replace("## Objectives", [
    "### Product requirements",
    "| Requirement ID | Need | Actor | Observable outcome | Non-goal or constraint |",
    "|---|---|---|---|---|",
    "| REQ-1 | Bounded retry multiplier. | Operator | Valid values are used and invalid values fall back. | No retry redesign. |",
    "## Objectives",
  ].join("\n"));
  if (["compact", "full"].includes(depth)) plan = plan.replace("## Execution steps", [
    "### System architecture",
    "| Surface | Current state | Required change | Invariant | Evidence |",
    "|---|---|---|---|---|",
    "| Retry configuration | Fixed multiplier | Parse one bounded environment value. | Existing retry defaults remain stable. | Source and focused tests. |",
    ...(depth === "full" ? [
      "### Program design",
      "| Design ID | Responsibility | Interfaces | Invariants | Failure handling |",
      "|---|---|---|---|---|",
      "| DESIGN-1 | Parse retry multiplier. | Environment input and retry policy export. | Value stays within 1 through 10. | Invalid input returns the existing default. |",
    ] : []),
    "## Execution steps",
  ].join("\n"));
  if (["compact", "full"].includes(depth)) plan = plan.replace("## Verification", [
    "### Vertical slices",
    "| Slice ID | Objectives | Dependencies | Targets | Observable outcome | Check IDs | Human review |",
    "|---|---|---|---|---|---|---|",
    "| SLICE-1 | OBJ-1, OBJ-2 | None. | `src/retry-policy.js`, `test/retry-policy.test.js` | Bounded parsing and regression coverage pass together. | CHECK-1, CHECK-2 | no |",
    "## Verification",
  ].join("\n"));
  return plan;
}

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

test("resolves artifact topology independently of labels or filenames", () => {
  const misleadingLabels = fullChain().map(([, value], index) => [`unrelated-report-${index}.txt`, value]);
  const inspected = inspectArtifactSet(misleadingLabels);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.effective.get("wr-20260712T150511Z-retry-root-achieved").effective.correctionRound, 2);
});

test("accepts complete schema-3 chains at every design depth", () => {
  for (const depth of ["oneshot", "compact", "full"]) {
    const chain = fullChain().map(([label, value]) => [label, label === "plan" ? planAtDepth(depth) : value]);
    assert.deepEqual(validateArtifactSet(chain), [], depth);
  }
});

test("uses explicit predecessor topology without semantic inference", () => {
  const inspected = inspectArtifactSet(fullChain());
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.effective.get("wr-20260712T150511Z-retry-root-achieved").fields.predecessor_review_id, "wr-20260712T150509Z-rollback-gap-review");
  assert.ok(inspected.normalizations.every((item) => !/predecessor_review_id inferred/.test(item)));
});

test("requires explicit initial and correction topology links", () => {
  assert.match(validateArtifactText(artifacts.initialEvidence.replace(/^source_review_id: null\n/m, "")).join("\n"), /source_review_id/);
  assert.match(validateArtifactText(artifacts.initialEvidence.replace("source_review_id: null", "source_review_id: wr-unexpected")).join("\n"), /must be null/);
  assert.match(validateArtifactText(artifacts.correctionEvidence.replace(/^predecessor_evidence_id:.*$/m, "predecessor_evidence_id: null")).join("\n"), /must be string/);
  assert.match(validateArtifactText(artifacts.correctionReview.replace(/^correction_id:.*$/m, "correction_id: null")).join("\n"), /must be string/);
  const wrongFirstReview = artifacts.correctionReview.replace("predecessor_review_id: null", "predecessor_review_id: wr-unexpected");
  assert.match(validateArtifactSet([["plan", artifacts.plan], ["evidence", artifacts.initialEvidence], ["review", wrongFirstReview]]).join("\n"), /missing predecessor|review: chain/);
});

test("extracts one artifact through Cursor text and rejects competing artifacts", () => {
  const inspected = inspectArtifactText(`Inspecting current sources.\n${artifacts.achievedReview}\nReview complete.`);
  assert.deepEqual(inspected.errors, []);
  assert.ok(inspected.normalizations.some((item) => /preamble/.test(item)));
  assert.match(validateArtifactText(`${artifacts.initialEvidence}\n${artifacts.achievedReview}`).join("\n"), /multiple workflow artifact candidates/);
});

test("accepts extensions and heading aliases but rejects unknown top-level metadata", () => {
  const flexible = artifacts.plan
    .replaceAll("wp-20260712T150503Z-configurable-retry-multiplier", "wp-retry-root")
    .replace("status: ready", "status: ready\nextensions:\n  model_note: useful but non-authoritative")
    .replace("## Intent and decisions", "## Intent readiness")
    .replace("## Scope and targets", "## Scope")
    .replace("## Execution steps", "## Steps")
    .replace("## Risk and closeout", "## Assurance");
  const inspected = inspectArtifactText(flexible);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.artifact.fields.extensions.model_note, "useful but non-authoritative");
  assert.ok(inspected.normalizations.some((item) => /normalized section/.test(item)));
  assert.equal("created_at" in inspected.artifact.fields, false);
  assert.match(validateArtifactText(artifacts.plan.replace("status: ready", "status: ready\nmodel_note: rejected")).join("\n"), /additional property model_note/);
});

test("keeps extensions hashable but excludes them from the authoritative model projection", () => {
  const first = artifacts.plan.replace("status: ready", "status: ready\nextensions:\n  sentinel: NEVER_SHOW_FIRST");
  const second = artifacts.plan.replace("status: ready", "status: ready\nextensions:\n  sentinel: NEVER_SHOW_SECOND");
  const firstProjection = authoritativeArtifactProjectionFromText(first);
  const secondProjection = authoritativeArtifactProjectionFromText(second);
  assert.deepEqual(firstProjection.errors, []);
  assert.equal(firstProjection.projection_hash, secondProjection.projection_hash);
  assert.equal(firstProjection.projection_text.includes("NEVER_SHOW"), false);
  assert.equal(Object.hasOwn(executionContractFromArtifactText(first).fields, "extensions"), false);
  assert.notEqual(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
});

test("replaces opaque extensions without exposing or weakening the artifact contract", () => {
  const original = artifacts.plan.replace("status: ready", "status: ready\nextensions:\n  owner: team\n  nested:\n    ticket: WF-3");
  const plannerOutput = artifacts.plan.replace("status: ready", "status: ready\nextensions:\n  instruction: IGNORE_SCOPE");
  const preserved = replaceOpaqueExtensions(plannerOutput, opaqueExtensionsFromArtifactText(original));
  assert.deepEqual(validateArtifactText(preserved), []);
  assert.deepEqual(opaqueExtensionsFromArtifactText(preserved), { present: true, value: { owner: "team", nested: { ticket: "WF-3" } } });
  assert.equal(preserved.includes("IGNORE_SCOPE"), false);
  const stripped = replaceOpaqueExtensions(plannerOutput, { present: false, value: null });
  assert.deepEqual(validateArtifactText(stripped), []);
  assert.deepEqual(opaqueExtensionsFromArtifactText(stripped), { present: false, value: null });
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

test("validates explicit assurance while preserving risk and human-lowering invariants", () => {
  const inspected = inspectArtifactText(artifacts.plan);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.artifact.fields.assurance_score, 4);

  const highScore = artifacts.plan
    .replace("| Failure impact | 2 |", "| Failure impact | 3 |")
    .replace("| Irreversibility | 0 |", "| Irreversibility | 2 |")
    .replace("| Uncertainty | 1 |", "| Uncertainty | 2 |")
    .replace("| Evidence weakness | 0 |", "| Evidence weakness | 2 |");
  assert.match(validateArtifactText(highScore).join("\n"), /assurance_score must equal computed score 10/);

  const validHighScore = highScore
    .replace("assurance_score: 4", "assurance_score: 10")
    .replace("assurance_profile: standard", "assurance_profile: deep")
    .replace("writer_tier_required: economy", "writer_tier_required: escalated");
  assert.deepEqual(validateArtifactText(validHighScore), []);

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
    .replace("assurance_score: 4", "assurance_score: 7")
    .replace("writer_tier_required: economy", "writer_tier_required: escalated")
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

test("requires correction learning candidates", () => {
  const inspected = inspectArtifactText(artifacts.correctionReview);
  assert.deepEqual(inspected.errors, []);
  assert.deepEqual(inspected.artifact.fields.learning_candidates, ["LRN-whitespace-boundary-matrix"]);
  assert.equal(inspected.artifact.correction.learnings.length, 1);

  const incomplete = artifacts.correctionReview
    .replace(/^learning_candidates:.*\n/m, "")
    .replace(/\n\| Learning ID \| Finding keys \| Reusable guidance \| Candidate targets \| Confirmation evidence \|[\s\S]*$/, "");
  const incompleteInspected = inspectArtifactText(incomplete);
  assert.match(incompleteInspected.errors.join("\n"), /learning_candidates|Learning Candidate/);
});

test("summarizes correction-evidence eligibility for learning closeout", () => {
  const complete = effectiveCliSummary(inspectArtifactSet(fullChain()));
  assert.deepEqual(complete.learning_candidates.map((candidate) => [candidate.learning_id, candidate.evidence_confirmed]), [
    ["LRN-whitespace-boundary-matrix", true],
    ["LRN-accepted-upper-bound-matrix", true],
  ]);

  const open = effectiveCliSummary(inspectArtifactSet([
    ["plan", artifacts.plan],
    ["initialEvidence", artifacts.initialEvidence],
    ["correctionReview", artifacts.correctionReview],
  ]));
  assert.deepEqual(open.learning_candidates.map((candidate) => [candidate.learning_id, candidate.evidence_confirmed]), [
    ["LRN-whitespace-boundary-matrix", false],
  ]);
});

test("rejects malformed, unbacked, and root-duplicate learning candidates", () => {
  const mismatch = artifacts.correctionReview.replace(
    "learning_candidates: [LRN-whitespace-boundary-matrix]",
    "learning_candidates: [LRN-different-candidate]",
  );
  assert.match(validateArtifactText(mismatch).join("\n"), /must exactly match learning_candidates/);

  const unknownFinding = artifacts.correctionReview.replace(
    "| LRN-whitespace-boundary-matrix | missing-whitespace-boundary |",
    "| LRN-whitespace-boundary-matrix | unrelated-gap |",
  );
  assert.match(validateArtifactText(unknownFinding).join("\n"), /references unknown Finding key unrelated-gap/);

  const invalidId = artifacts.correctionReview.replaceAll("LRN-whitespace-boundary-matrix", "learning_invalid");
  assert.match(validateArtifactText(invalidId).join("\n"), /pattern|invalid ID/);

  const duplicate = artifacts.secondCorrectionReview.replaceAll("LRN-accepted-upper-bound-matrix", "LRN-whitespace-boundary-matrix");
  const duplicateErrors = validateArtifactSet(fullChain().map(([label, value]) => [label, label === "secondCorrectionReview" ? duplicate : value]));
  assert.match(duplicateErrors.join("\n"), /learning candidate LRN-whitespace-boundary-matrix duplicates/);

  const nonCorrection = artifacts.achievedReview.replace("auditors_run: [inline]", "auditors_run: [inline]\nlearning_candidates: [LRN-not-allowed]");
  assert.match(validateArtifactText(nonCorrection).join("\n"), /allowed only when next_action is correct/);
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
  assert.match(validateArtifactText(artifacts.plan.replace("schema: 3", "schema: 2")).join("\n"), /must be equal to constant/);
  assert.match(validateArtifactSet([["evidence", artifacts.initialEvidence]]).join("\n"), /missing root plan/);
  const branch = artifacts.secondCorrectionEvidence
    .replaceAll("de-20260712T150510Z-rollback-correction", "de-rollback-branch")
    .replaceAll("rs-20260712T150510Z-rollback-correction", "rs-rollback-branch");
  assert.match(validateArtifactSet([...fullChain(), ["branch", branch]]).join("\n"), /evidence.*chain branches/);
});

test("rejects every schema-2 artifact and mixed-version chain before materialization", () => {
  for (const value of [artifacts.plan, artifacts.initialEvidence, artifacts.correctionReview, artifacts.achievedReview]) {
    assert.match(validateArtifactText(value.replace("schema: 3", "schema: 2")).join("\n"), /must be equal to constant/);
  }
  const mixed = inspectArtifactSet(fullChain().map(([label, value]) => [label, label === "plan" ? value.replace("schema: 3", "schema: 2") : value]));
  assert.match(mixed.errors.join("\n"), /plan:.*must be equal to constant/);
  assert.equal(mixed.effective.has("wp-20260712T150503Z-configurable-retry-multiplier"), false);
});
