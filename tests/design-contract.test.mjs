import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const canonical = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

test("Schema 6 validates intent semantics instead of execution tables", () => {
  const prose = canonical.replace(/### Verification[\s\S]*?(?=\n## Boundaries)/, "Acceptance may be verified by an equivalent repository-local check.\n");
  assert.deepEqual(inspectArtifactText(prose).errors, []);
});

test("root sections may use registered prose aliases", () => {
  const aliased = canonical
    .replace("## Intent", "## Goal")
    .replace("## Acceptance", "## Success criteria")
    .replace("## Boundaries", "## Authority envelope")
    .replace("## Risks", "## Risk summary");
  assert.deepEqual(inspectArtifactText(aliased).errors, []);
});

test("hard triggers prohibit autonomous execution", () => {
  const autonomous = canonical
    .replace("profile_max: manual", "profile_max: autonomous")
    .replace("contract_level: lean", "contract_level: certified")
    .replace("hard_triggers: []", "hard_triggers: [security-secrets]")
    .replace("  external_effects: none", `  external_effects: none\n  max_active_minutes: 30\n  max_total_tokens: 10000\n  max_cost_usd: 5`)
    .replace("---\n\n## Intent", `certification:\n  qualification_key: qk-repository\n  harness_capability_receipt_hash: ${"a".repeat(64)}\n  verification_intent_hash: ${"b".repeat(64)}\n  certified_region: src\n---\n\n## Intent`);
  assert.match(inspectArtifactText(autonomous).errors.join("\n"), /hard-trigger work cannot be autonomous/);
});

test("authority paths stay repository relative", () => {
  assert.match(inspectArtifactText(canonical.replace("    - src", "    - /tmp/outside")).errors.join("\n"), /repository-relative/);
});
