import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { evaluateExecutionState } from "../scripts/evaluate-execution-state.mjs";
import { defaultRoot } from "../scripts/validate-plugin.mjs";

const scenarios = JSON.parse(readFileSync(join(defaultRoot, "tests", "fixtures", "execution-policy.scenarios.json"), "utf8"));

for (const scenario of scenarios) {
  test(`execution policy: ${scenario.name}`, () => {
    assert.deepEqual(evaluateExecutionState(scenario.state), scenario.expected);
  });
}
