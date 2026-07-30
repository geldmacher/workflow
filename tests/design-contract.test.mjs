import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const canonical = readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");

test("Schema 4 validates semantics instead of eight mandatory tables", () => {
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
    .replace("profile_max: supervised", "profile_max: autonomous")
    .replace("contract_level: controlled", "contract_level: certified")
    .replace("hard_triggers: []", "hard_triggers: [security-secrets]")
    .replace("---\n\n## Intent", `certification:\n  verification_profile_id: verify-repository\n  verification_profile_hash: ${"a".repeat(64)}\n  task_recipe: bugfix\n  certified_region: src\n  route_pool_hash: ${"b".repeat(64)}\n---\n\n## Intent`);
  assert.match(inspectArtifactText(autonomous).errors.join("\n"), /hard-trigger work cannot be autonomous/);
});

test("authority paths stay repository relative", () => {
  assert.match(inspectArtifactText(canonical.replace("    - src", "    - /tmp/outside")).errors.join("\n"), /repository-relative/);
});
