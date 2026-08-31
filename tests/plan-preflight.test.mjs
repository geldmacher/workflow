import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRoot,
  executionContractFromArtifactText,
  preflightRootPlan,
} from "../scripts/validate-artifact.source.mjs";
import { authorityCore, nativePlan } from "./support/workflow-fixtures.mjs";

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
    assert.match(value.blocking_issues.map((issue) => issue.message).join("\n"), /additional propert|unknown|unsupported|Schema/i);
  }
});

test("duplicate Check IDs and invalid objective coverage fail closed", () => {
  const base = authorityCore().verification[0];
  assert.throws(() => nativePlan("manual", { verification: [base, { ...base }] }), /duplicate CHECK-1/);

  assert.throws(
    () => nativePlan("manual", { verification: [{ ...base, objectives: ["OBJ-99"] }] }),
    /references unknown OBJ-99/,
  );
});

test("expensive intent remains an advisory, never a Workflow command decision", () => {
  const base = authorityCore().verification[0];
  const expensive = nativePlan("manual", { verification: [{ ...base, cost_class: "expensive" }] });
  const value = preflightRootPlan(expensive, defaultRoot);
  assert.equal(value.feasible, true);
  assert.equal(value.cost_classes.expensive, 1);
  assert.match(value.advisories.map((issue) => issue.message).join("\n"), /expensive/i);
  assert.doesNotMatch(JSON.stringify(value), /npm|ddev|shell|program/);
});
