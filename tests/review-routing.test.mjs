import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { defaultRoot, inspectArtifactSet, validateArtifactText } from "../scripts/validate-artifact.source.mjs";

const fixtureRoot = join(defaultRoot, "tests", "fixtures", "artifacts");
const plan = readFileSync(join(fixtureRoot, "work-plan.valid.md"), "utf8");
const review = readFileSync(join(fixtureRoot, "work-review.valid.md"), "utf8");

function replaceAuditors(source, auditors) {
  return source
    .replace(/auditors_run:\n(?:  - .*\n)+(?=inspected_objectives:)/, `auditors_run:\n${auditors.map((name) => `  - ${name}`).join("\n")}\n`)
    .replace("| Auditors | inline, delivery-auditor |", `| Auditors | ${auditors.join(", ")} |`);
}

function highBoundaryReview() {
  const finding = [
    "| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |",
    "|---|---|---|---|---|---|",
    "| authority-conflict | high | OBJ-1 | CHECK-1 | changed path is approval-required | The immutable Root cannot authorize delivery. |",
  ].join("\n");
  return replaceAuditors(review, ["inline"])
    .replace("assessment: achieved", "assessment: partially-achieved")
    .replace("delivery_status: verified", "delivery_status: blocked")
    .replace("review_route: targeted", "review_route: inline")
    .replace("next_action: none", "next_action: replan")
    .replace("Achieved. The required evidence is verified and no finding remains.", "Partially-achieved. A deterministic Authority conflict requires a replacement Root.")
    .replace("## Findings\n\nNone.", `## Findings\n\n${finding}`)
    .replace("## Next action\n\nNone.", "## Next action\n\nreplan: replace the conflicting Root.");
}

test("a deterministic high boundary finding may short-circuit as an inline replan", () => {
  assert.deepEqual(validateArtifactText(highBoundaryReview()), []);
});

test("targeted review uses exactly one delivery or design specialist", () => {
  const design = replaceAuditors(review, ["inline", "work-design-auditor"]);
  assert.deepEqual(validateArtifactText(design), []);

  const both = replaceAuditors(review, ["inline", "delivery-auditor", "work-design-auditor"]);
  assert.match(validateArtifactText(both).join("\n"), /targeted review requires inline plus exactly one/);
});

test("full review requires delivery and risk while design remains optional", () => {
  const missingRisk = review.replace("review_route: targeted", "review_route: full");
  assert.match(validateArtifactText(missingRisk).join("\n"), /full review requires auditor risk-auditor/);

  const full = replaceAuditors(missingRisk, ["inline", "delivery-auditor", "risk-auditor"]);
  assert.deepEqual(validateArtifactText(full), []);

  const fullDesign = replaceAuditors(missingRisk, ["inline", "delivery-auditor", "risk-auditor", "work-design-auditor"]);
  assert.deepEqual(validateArtifactText(fullDesign), []);
});

test("an unresolved high finding still requires full review", () => {
  const unresolved = replaceAuditors(highBoundaryReview(), ["inline", "delivery-auditor"])
    .replace("review_route: inline", "review_route: targeted")
    .replace("assessment: partially-achieved", "assessment: insufficient-evidence")
    .replace("next_action: replan", "next_action: retry-review")
    .replace("replan: replace the conflicting Root.", "retry-review: gather the missing decisive evidence.");
  assert.match(validateArtifactText(unresolved).join("\n"), /review_route must be at least computed minimum full/);
});

test("Hard-Trigger roots require a full review with delivery and risk", () => {
  const hardRoot = plan.replace("hard_triggers: []", "hard_triggers:\n  - broad-runtime-impact");
  const evidence = buildDeliveryEvidence({
    rootPlanText: hardRoot,
    checkEvidence: [{
      check_id: "CHECK-1",
      grade: "verified",
      surface: "repository-test",
      method: "deterministic command",
      expected: "Retry verification passes twice",
      observed: "Passed twice",
      repetitions: 2,
      artifact_hashes: ["b".repeat(64)],
      limitations: [],
    }],
    changedPaths: ["src/retry.mjs"],
    effectiveProfile: "supervised",
    repositorySnapshot: { head: "abc123", working_tree: "modified", relevant_fingerprints: "none", known_failures: "none" },
    pluginRoot: defaultRoot,
  });
  const targeted = review.replaceAll("de-adaptive-retry", evidence.fields.id);
  assert.match(inspectArtifactSet([["plan", hardRoot], ["evidence", evidence.artifact], ["review", targeted]]).errors.join("\n"), /requires review_route full/);

  const full = replaceAuditors(targeted.replace("review_route: targeted", "review_route: full"), ["inline", "delivery-auditor", "risk-auditor"]);
  assert.deepEqual(inspectArtifactSet([["plan", hardRoot], ["evidence", evidence.artifact], ["review", full]]).errors, []);
});
