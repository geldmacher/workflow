import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  baselineFromMeasurement,
  budgetDiagnostics,
  budgetFailures,
  defaultRoot,
  economicTargets,
  evaluateRatchet,
  flowMatrix,
  headroomTargets,
  limits,
  measureContext,
  measurementVersion,
  targetFailures,
  validateFlowMatrix,
} from "../scripts/measure-context.mjs";

test("context targets and the checked baseline both pass", () => {
  const measurement = measureContext(defaultRoot);
  assert.deepEqual(targetFailures(measurement), []);
  assert.deepEqual(budgetFailures(measurement), []);
  assert.equal(measurement.ratchet_status.status, "passed");
});

test("workflow has no always-on context and bounded discoverability", () => {
  const measurement = measureContext(defaultRoot);
  assert.equal(measurement.alwaysOnTokens, 0);
  assert.ok(measurement.discoverabilityTokens <= limits.discoverabilityTokens);
  assert.deepEqual(Object.keys(measurement.discoverabilityTokensByType), ["commands", "skills", "agents"]);
  assert.ok(Object.values(measurement.discoverabilityTokensByType).every((tokens) => tokens > 0));
});

test("manual phase flows model progressive contract loading", () => {
  const measurement = measureContext(defaultRoot);
  assert.equal(measurement.measurement_version, measurementVersion);
  assert.deepEqual(Object.keys(measurement.phase_flows), Object.keys(flowMatrix.phase_flows));
  assert.ok(!Object.hasOwn(measurement.flow_breakdown.plan_oneshot, "references/design-contract.md"));
  assert.ok(Object.hasOwn(measurement.flow_breakdown.plan_compact_full, "references/design-contract.md"));
  assert.ok(!Object.hasOwn(measurement.flow_breakdown.review_base, "references/learning-contract.md"));
  assert.ok(!Object.hasOwn(measurement.flow_breakdown.plan_compact_full, "references/closeout-contract.md"));
  assert.ok(!Object.hasOwn(measurement.flow_breakdown.correction, "references/closeout-contract.md"));
  assert.ok(!Object.hasOwn(measurement.phase_flows, "closeout"));
  assert.ok(Object.hasOwn(measurement.flow_breakdown.learning, "references/learning-contract.md"));
  for (const name of Object.keys(flowMatrix.phase_flows).filter((name) => name !== "plan_intake")) {
    assert.ok(Object.hasOwn(measurement.flow_breakdown[name], "references/human-output-runtime-contract.md"), `${name} misses runtime output`);
  }
  for (const name of Object.keys(flowMatrix.automation_flows)) {
    assert.ok(Object.hasOwn(measurement.flow_breakdown[name], "references/human-output-runtime-contract.md"), `${name} misses runtime output`);
  }
  const runtimeOutput = readFileSync(new URL("../references/human-output-runtime-contract.md", import.meta.url), "utf8");
  assert.match(runtimeOutput, /Quick decision.*actionable.*one actor\/action.*terminal.*Done.*Accepted provisionally.*no action/is);
  assert.match(runtimeOutput, /Details.*scope\/non-goals.*acceptance\/verification.*risks\/trade-offs.*unknowns\/limits\/recovery/is);
  assert.match(runtimeOutput, /Agent and machine contract.*standalone for a weaker agent/is);
  assert.match(runtimeOutput, /complete `structuredContent`.*visible index is non-authoritative/is);
});

test("load graph matches direct Command and Skill contract links", () => {
  assert.deepEqual(validateFlowMatrix(defaultRoot), []);

  const removedContract = structuredClone(flowMatrix);
  removedContract.phase_flows.plan_compact_full = removedContract.phase_flows.plan_compact_full.filter((file) => file !== "references/design-contract.md");
  assert.match(validateFlowMatrix(defaultRoot, removedContract).join("\n"), /design-contract\.md is not measured in a flow containing the Skill/);

  const phantomContract = structuredClone(flowMatrix);
  phantomContract.phase_flows.review_base.push("references/learning-contract.md");
  assert.match(validateFlowMatrix(defaultRoot, phantomContract).join("\n"), /review_base: references\/learning-contract\.md is not linked from skills\/work-review\/SKILL\.md/);

  const duplicateFile = structuredClone(flowMatrix);
  duplicateFile.automation_flows.status.push("references/state-contract.md");
  assert.match(validateFlowMatrix(defaultRoot, duplicateFile).join("\n"), /automation_flows\.status: duplicate file entry/);

  const missingFile = structuredClone(flowMatrix);
  missingFile.phase_flows.plan_oneshot.push("references/missing-contract.md");
  assert.match(validateFlowMatrix(defaultRoot, missingFile).join("\n"), /plan_oneshot: missing file references\/missing-contract\.md/);
});

test("every measured flow has a unique actionable file breakdown", () => {
  const measurement = measureContext(defaultRoot);
  for (const [name, files] of Object.entries(measurement.flow_breakdown)) {
    assert.equal(new Set(Object.keys(files)).size, Object.keys(files).length, name);
    const expected = measurement.phase_flows[name] ?? measurement.automationFlows[name];
    assert.equal(Object.values(files).reduce((sum, tokens) => sum + tokens, 0), expected, name);
  }
});

test("manual, expanded, automation, and auditor targets are explicit", () => {
  const measurement = measureContext(defaultRoot);
  for (const [name, maximum] of Object.entries(limits.phaseFlows)) assert.ok(measurement.phase_flows[name] <= maximum, name);
  for (const [name, maximum] of Object.entries(limits.automationFlows)) assert.ok(measurement.automationFlows[name] <= maximum, name);
  for (const [name, tokens] of Object.entries(measurement.reviewerTokens)) assert.ok(tokens <= limits.reviewerTokens, name);
  assert.deepEqual(economicTargets, { plan: 1800, correction: 1800, review: 1950, learning: 1800, explanation: 1080, automation: 1350 });
  for (const [name, maximum] of Object.entries(headroomTargets.phaseFlows)) assert.ok(measurement.phase_flows[name] <= maximum, `${name} headroom`);
  for (const [name, maximum] of Object.entries(headroomTargets.automationFlows)) assert.ok(measurement.automationFlows[name] <= maximum, `${name} headroom`);
  assert.deepEqual(budgetDiagnostics(measurement), []);
});

test("ratchet rejects growth but accepts reductions", () => {
  const measurement = measureContext(defaultRoot);
  const baseline = baselineFromMeasurement(measurement);
  const grown = structuredClone(measurement);
  grown.phase_flows.review_base += 1;
  assert.equal(evaluateRatchet(grown, baseline).status, "regressed");
  assert.match(evaluateRatchet(grown, baseline).regressions.join("\n"), /phase_flows\.review_base/);
  const reduced = structuredClone(measurement);
  reduced.phase_flows.review_base -= 1;
  assert.equal(evaluateRatchet(reduced, baseline).status, "passed");
});

test("ratchet rejects measurement or load-graph drift", () => {
  const measurement = measureContext(defaultRoot);
  const baseline = baselineFromMeasurement(measurement);
  assert.equal(evaluateRatchet(measurement, { ...baseline, measurement_version: measurementVersion - 1 }).status, "regressed");
  assert.equal(evaluateRatchet(measurement, { ...baseline, flow_matrix_hash: "changed" }).status, "regressed");
});

test("automation measures the worst real phase-specific path", () => {
  const measurement = measureContext(defaultRoot);
  assert.deepEqual(Object.keys(measurement.automationFlows), Object.keys(flowMatrix.automation_flows));
  assert.equal(measurement.flows.automation, Math.max(...Object.values(measurement.automationFlows)));
});
