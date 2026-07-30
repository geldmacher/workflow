import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  authoritativeArtifactProjectionFromText,
  defaultRoot,
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
  const manual = plan.replace("profile_max: supervised", "profile_max: manual").replace("contract_level: controlled", "contract_level: lean");
  assert.deepEqual(validateArtifactText(manual), []);
  assert.deepEqual(validateArtifactText(plan), []);
  assert.deepEqual(validateArtifactText(autonomousRoot()), []);
});

test("schema 4 rejects missing semantic core and mismatched contract levels", () => {
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
});

test("Workflow 3 artifacts are rejected by the mutable Schema 4 validator", () => {
  const old = plan.replace("schema: 4", "schema: 3");
  assert.match(inspectArtifactText(old).errors.join("\n"), /must be equal to constant/);
});
