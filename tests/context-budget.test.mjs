import assert from "node:assert/strict";
import test from "node:test";
import { budgetDiagnostics, budgetFailures, defaultRoot, economicTargets, limits, measureContext } from "../scripts/measure-context.mjs";

test("context budgets are diagnostic rather than release blocking", () => {
  assert.deepEqual(budgetFailures(measureContext(defaultRoot)), []);
});

test("workflow has no always-on context", () => {
  assert.equal(measureContext(defaultRoot).alwaysOnTokens, 0);
});

test("discoverability includes public commands as well as skills and agents", () => {
  const measurement = measureContext(defaultRoot);
  assert.ok(measurement.discoverabilityTokensByType.commands > 0);
  assert.ok(measurement.discoverabilityTokensByType.skills > 0);
  assert.ok(measurement.discoverabilityTokensByType.agents > 0);
  assert.ok(measurement.discoverabilityTokens >= measurement.discoverabilityTokensByType.commands);
});

test("reviewer budgets include their self-contained audit instructions", () => {
  const reviewers = measureContext(defaultRoot).reviewerTokens;
  assert.ok(reviewers["work-plan-auditor"] > 0);
  assert.ok(reviewers["delivery-auditor"] > 0);
  assert.ok(reviewers["risk-auditor"] > 0);
});

test("economic and former hard targets always diagnose without blocking", () => {
  assert.equal(limits.flowTokens, 2200);
  assert.deepEqual(economicTargets, { plan: 2000, correction: 2000, review: 2000 });
  const measurement = structuredClone(measureContext(defaultRoot));
  measurement.flows.plan = 2100;
  assert.deepEqual(budgetFailures(measurement), []);
  assert.ok(budgetDiagnostics(measurement).includes("plan economic target: 2100 > 2000"));
  measurement.flows.plan = 2201;
  assert.deepEqual(budgetFailures(measurement), []);
  assert.ok(budgetDiagnostics(measurement).includes("plan: 2201 > 2200"));
});
