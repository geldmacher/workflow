import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultRoot,
  executionContractFromArtifactText,
  extractEmbeddedWorkPlanText,
  inspectArtifactText,
  preflightRootPlan,
} from "../scripts/validate-artifact.source.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");

function nativePlan(rootText = root, { nextStepAtEnd = false } = {}) {
  const parts = rootText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const nextStep = [
    "### Next step",
    "",
    "- Now: Implement Plan",
    "- How: Select the host-native implementation action.",
    "- Why: The Root has closed intent and authority.",
    "",
  ];
  return [
    "---",
    "name: Retry delivery",
    "todos:",
    "  - id: retry",
    "    content: Deliver the retry behavior",
    "    status: completed",
    "isProject: false",
    "---",
    "",
    "# Retry delivery",
    "",
    "## Quick decision",
    "",
    "The Schema-6 Root is ready.",
    "",
    ...(!nextStepAtEnd ? nextStep : []),
    "## Details",
    "",
    "The project harness chooses execution.",
    "",
    "## Agent and machine contract (authoritative)",
    "",
    "```yaml artifact-envelope",
    parts[1],
    "```",
    parts[2],
    ...(nextStepAtEnd ? ["", ...nextStep] : []),
  ].join("\n");
}

test("Schema-6 plan accepts arbitrary verification intent without execution policy", () => {
  const inspected = inspectArtifactText(root, defaultRoot);
  assert.deepEqual(inspected.errors, []);
  assert.equal(inspected.artifact.fields.schema, 6);
  const contract = executionContractFromArtifactText(root, defaultRoot);
  assert.deepEqual(contract.checks[0], {
    "Check ID": "CHECK-1",
    Objectives: "OBJ-1",
    "Verification Intent": "Prove retry behavior and repository consistency with project-appropriate verification.",
    "Expected Evidence": "Protected evidence showing the acceptance outcome on the current repository snapshot.",
    Required: "yes",
    "Evidence Class": "harness-verifiable",
    "Cost Class": "standard",
    Prerequisites: "Relevant implementation and test surfaces are available.",
  });
  assert.equal(preflightRootPlan(root, defaultRoot).feasible, true);
});

test("native Plan extraction ignores mutable host presentation and preserves the exact Root", () => {
  assert.equal(extractEmbeddedWorkPlanText(nativePlan()), root);
  assert.equal(extractEmbeddedWorkPlanText(root), null);
  assert.equal(extractEmbeddedWorkPlanText(nativePlan(root, { nextStepAtEnd: true })), null);
  assert.equal(extractEmbeddedWorkPlanText(`${nativePlan()}\n\n\`\`\`yaml artifact-envelope\nartifact: work-review\n\`\`\``), null);
  assert.equal(extractEmbeddedWorkPlanText(`${root}\n\n${nativePlan()}`), null);
});

test("Schema-6 rejects authoritative execution fields as unknown", () => {
  for (const field of [
    "working_directory: repository root",
    "command_or_inspection: ddev exec test",
    "host_commands: [npm test]",
    "route_pools: [default]",
    "task_recipes: [feature]",
    "repetitions: 2",
  ]) {
    const invalid = root.replace("status: ready", "status: ready\n" + field);
    const inspected = inspectArtifactText(invalid, defaultRoot);
    assert.match(inspected.errors.join("\n"), /additional propert|must NOT have additional properties|unknown/i, field);
  }
});

test("every non-6 artifact schema is rejected generically", () => {
  const unsupported = root.replace("schema: 6", "schema: 7");
  const inspected = inspectArtifactText(unsupported, defaultRoot);
  assert.deepEqual(inspected.errors, ["unsupported Workflow artifact schema; only Schema 6 is supported"]);
  const preflight = preflightRootPlan(unsupported, defaultRoot);
  assert.equal(preflight.feasible, false);
  assert.match(preflight.blocking_issues.map((entry) => entry.message).join("\n"), /Schema-6|schema 6/i);
});

test("Schema-6 Root has only one opaque extension escape hatch", () => {
  const withExtension = root.replace("status: ready", "status: ready\nextensions:\n  private_trace_hash: " + "a".repeat(64));
  assert.deepEqual(inspectArtifactText(withExtension, defaultRoot).errors, []);
  const contract = executionContractFromArtifactText(withExtension, defaultRoot);
  assert.equal(JSON.stringify(contract.authoritative_projection).includes("private_trace_hash"), false);
});
