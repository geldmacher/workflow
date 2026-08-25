import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRoot,
  executionContractFromArtifactText,
  preflightRootPlan,
} from "../scripts/validate-artifact.source.mjs";

const root = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

test("Schema-6 preflight validates intent feasibility without selecting execution", () => {
  const preflight = preflightRootPlan(root, defaultRoot);
  assert.equal(preflight.feasible, true);
  assert.deepEqual(preflight.required_checks, ["CHECK-1"]);
  assert.equal(preflight.approval_granted, false);
  assert.equal(preflight.mutation_performed, false);

  const contract = executionContractFromArtifactText(root, defaultRoot);
  assert.deepEqual(contract.errors, []);
  assert.deepEqual(Object.keys(contract.checks[0]), [
    "Check ID", "Objectives", "Verification Intent", "Expected Evidence",
    "Required", "Evidence Class", "Cost Class", "Prerequisites",
  ]);
  assert.equal("strategy" in contract, false);
  assert.equal("slices" in contract, false);
  assert.doesNotMatch(JSON.stringify(contract), /Working Directory|Command or Inspection|host_commands|route_pool|task_recipe/);
});

test("closed Schema-6 fields reject concrete execution policy", () => {
  for (const field of [
    "host_commands: [npm test]",
    "working_directory: repository root",
    "model_pool: [reviewer]",
    "retry_count: 3",
  ]) {
    const value = preflightRootPlan(root.replace("status: ready", `status: ready\n${field}`), defaultRoot);
    assert.equal(value.feasible, false, field);
    assert.match(value.blocking_issues.map((issue) => issue.message).join("\n"), /additional propert|unknown|Schema/i);
  }
});

test("duplicate Check IDs and invalid objective coverage fail closed", () => {
  const row = "| CHECK-1 | OBJ-1 | Prove retry behavior and repository consistency with project-appropriate verification. | Protected evidence showing the acceptance outcome on the current repository snapshot. | yes | harness-verifiable | standard | Relevant implementation and test surfaces are available. |";
  const duplicate = preflightRootPlan(root.replace(row, `${row}\n${row}`), defaultRoot);
  assert.equal(duplicate.feasible, false);
  assert.match(duplicate.blocking_issues.map((issue) => issue.message).join("\n"), /duplicate/i);

  const missing = preflightRootPlan(root.replace("| OBJ-1 | Prove retry", "| OBJ-99 | Prove retry"), defaultRoot);
  assert.equal(missing.feasible, false);
  assert.match(missing.blocking_issues.map((issue) => issue.message).join("\n"), /unknown objective|coverage|current Acceptance objectives/i);
});

test("expensive intent remains an advisory, never a Workflow command decision", () => {
  const expensive = root.replace("| harness-verifiable | standard |", "| harness-verifiable | expensive |");
  const value = preflightRootPlan(expensive, defaultRoot);
  assert.equal(value.feasible, true);
  assert.equal(value.cost_classes.expensive, 1);
  assert.match(value.advisories.map((issue) => issue.message).join("\n"), /expensive/i);
  assert.doesNotMatch(JSON.stringify(value), /npm|ddev|shell|program/);
});
