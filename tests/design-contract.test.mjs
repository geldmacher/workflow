import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { nativePlan } from "./support/workflow-fixtures.mjs";

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
  assert.throws(() => nativePlan("autonomous", {
    hard_triggers: ["security-secrets"],
    certification: {
      qualification_key: "qk-repository",
      harness_capability_receipt_hash: "a".repeat(64),
      verification_intent_hash: "b".repeat(64),
      certified_region: "src",
    },
  }), /hard-trigger work cannot use autonomous profile/);
});

test("authority paths stay repository relative", () => {
  const invalid = nativePlan("manual", { authority: { allowed_roots: ["/tmp/outside"], protected_paths: [], approval_required_paths: [], dependencies: "deny", external_effects: "none", delivery: "repository-only" } });
  assert.match(inspectArtifactText(invalid).errors.join("\n"), /repository-relative/);
});
