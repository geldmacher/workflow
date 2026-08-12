import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRoot,
  executionContractFromArtifactText,
  inspectArtifactText,
  preflightRootPlan,
  validateArtifactText,
} from "../scripts/validate-artifact.source.mjs";
import { deriveManualWorkflowSnapshot } from "../src/controller/manual-status.mjs";

const plan = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

test("Schema-5 plan preflight accepts a feasible Pareto root", () => {
  const preflight = preflightRootPlan(plan);
  assert.equal(preflight.feasible, true);
  assert.equal(preflight.root_plan_id, "wp-adaptive-retry");
  assert.equal(preflight.root_projection_hash.length, 64);
  assert.deepEqual(preflight.required_checks, ["CHECK-1"]);
  assert.deepEqual(preflight.deferred_checks, []);
  assert.deepEqual(preflight.blocking_issues, []);
  assert.equal(preflight.approval_granted, false);
  assert.equal(preflight.mutation_performed, false);
});

test("preflight rejects child allowance shadowed by a parent approval boundary", () => {
  const shadowed = plan
    .replace("    - tests\n  protected_paths:", "    - tests\n    - .ddev/support-knowledge\n  protected_paths:")
    .replace("  approval_required_paths: []", "  approval_required_paths:\n    - .ddev");
  const preflight = preflightRootPlan(shadowed);
  assert.equal(preflight.feasible, false);
  assert.equal(preflight.blocking_issues.some((entry) => entry.code === "shadowed-allowed-root" && entry.target === ".ddev/support-knowledge"), true);
});

test("preflight rejects an explicit acceptance change outside Root authority", () => {
  const outside = plan.replace(
    "  - Retry handling passes its repository verification path twice.",
    "  - The path `.ddev/config.yaml` exists with deterministic retry configuration.",
  );
  const preflight = preflightRootPlan(outside);
  assert.equal(preflight.feasible, false);
  assert.equal(preflight.blocking_issues.some((entry) => entry.code === "acceptance-path-outside-authority" && entry.target === ".ddev/config.yaml"), true);
});

test("preflight rejects duplicate required Checks and missing objective coverage", () => {
  const duplicateRow = "| CHECK-2 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | standard | src, tests |";
  const duplicate = plan.replace(
    "| CHECK-1 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | standard | src, tests |",
    `| CHECK-1 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | standard | src, tests |\n${duplicateRow}`,
  );
  assert.equal(preflightRootPlan(duplicate).blocking_issues.some((entry) => entry.code === "duplicate-required-check"), true);

  const uncovered = plan.replace(
    "  - Retry handling passes its repository verification path twice.",
    "  - Retry handling passes its repository verification path twice.\n  - Public retry behavior remains compatible.",
  );
  assert.equal(preflightRootPlan(uncovered).blocking_issues.some((entry) => entry.code === "missing-required-check" && entry.objective_id === "OBJ-2"), true);
});

test("preflight advises on non-high expensive required Checks", () => {
  const expensive = plan.replace("| machine-verifiable | standard |", "| machine-verifiable | expensive |");
  const preflight = preflightRootPlan(expensive);
  assert.equal(preflight.feasible, true);
  assert.equal(preflight.advisories.some((entry) => entry.code === "expensive-required-check"), true);
  assert.equal(preflight.cost_classes.expensive, 1);
});

test("preflight rejects an expensive required Check when a cheaper equivalent is already planned", () => {
  const cheapEquivalent = "| CHECK-2 | OBJ-1 | repository root | npm test | Retry verification passes twice | no | machine-verifiable | cheap | tests, src |";
  const redundant = plan
    .replace("| machine-verifiable | standard |", "| machine-verifiable | expensive |")
    .replace(
      "| CHECK-1 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | expensive | src, tests |",
      `| CHECK-1 | OBJ-1 | repository root | npm test | Retry verification passes twice | yes | machine-verifiable | expensive | src, tests |\n${cheapEquivalent}`,
    );
  assert.equal(preflightRootPlan(redundant).blocking_issues.some((entry) => entry.code === "expensive-required-equivalent" && entry.cheaper_check_id === "CHECK-2"), true);
});

test("historical bare Schema-5 roots remain parseable without explicit Verification", () => {
  const historical = plan.replace(/\n### Verification[\s\S]*?(?=\n## Boundaries)/, "");
  assert.deepEqual(validateArtifactText(historical), []);
  const preflight = preflightRootPlan(historical);
  assert.equal(preflight.feasible, false);
  assert.equal(preflight.blocking_issues.some((entry) => entry.code === "explicit-verification-required"), true);
  const contract = executionContractFromArtifactText(historical);
  assert.equal(contract.checks[0]["Command or Inspection"], "verification-profile");
  assert.equal(inspectArtifactText(historical).artifact.normalizations.includes("synthesized strategy checks from acceptance outcomes"), true);
  const snapshot = deriveManualWorkflowSnapshot({
    rootPlanId: "wp-adaptive-retry",
    artifacts: [{ label: "historical-root", text: historical }],
    pluginRoot: defaultRoot,
  });
  assert.equal(snapshot.snapshot.root_plan_id, "wp-adaptive-retry");
  assert.equal(snapshot.snapshot.state, "root-plan-review");
});

test("execution contract uses the same explicit nested Verification checks as preflight", () => {
  const preflight = preflightRootPlan(plan);
  const contract = executionContractFromArtifactText(plan);
  assert.deepEqual(
    contract.checks.filter((row) => row.Required === "yes").map((row) => row["Check ID"]),
    preflight.required_checks,
  );
  assert.equal(contract.checks[0]["Command or Inspection"], "npm test");
  assert.equal(contract.checks[0]["Expected Result"], "Retry verification passes twice");
  assert.notEqual(contract.checks[0]["Command or Inspection"], "verification-profile");
  assert.equal(contract.checks[0]["Evidence Class"], "machine-verifiable");
});

test("top-level Verification takes precedence over nested Acceptance Verification", () => {
  const dual = plan
    .replace(
      "## Risks\n\nThe main risk is an accidental public-contract regression; preserve and verify that contract.\n",
      "## Verification\n\n| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |\n|---|---|---|---|---|---|---|---|---|\n| CHECK-1 | OBJ-1 | repository root | npm run top-level | Top-level verification wins | yes | machine-verifiable | standard | src, tests |\n\n## Risks\n\nThe main risk is an accidental public-contract regression; preserve and verify that contract.\n",
    );
  const contract = executionContractFromArtifactText(dual);
  assert.equal(contract.checks[0]["Command or Inspection"], "npm run top-level");
  assert.equal(contract.checks[0]["Expected Result"], "Top-level verification wins");
});
