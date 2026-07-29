import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { executionContractFromArtifactText, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const canonical = readFileSync(new URL("./fixtures/artifacts/work-plan.valid.md", import.meta.url), "utf8");

function withEvidenceClass(text) {
  return text;
}

function designPlan(depth, { automation = false } = {}) {
  let text = canonical
    .replace("design_depth: oneshot", `design_depth: ${depth}`)
    .replace("automation_profile_max: manual", [
      `automation_profile_max: ${automation ? "auto-gated" : "manual"}`,
      ...(automation ? [
      "automation_bounds:",
      "  allowed_targets: [src/retry-policy.js, test/retry-policy.test.js]",
      "  max_risk: medium",
      "  dependencies: deny",
      "  external_effects: none",
      "  delivery: repository-only",
      "  max_active_minutes: 30",
      "  max_total_tokens: 50000",
      "  max_cost_usd: 5",
      "  max_correction_cycles: 2",
      "  max_writer_escalations: 1",
      ] : []),
    ].join("\n"))
    .replace("writer_tier_required: economy", `writer_tier_required: ${depth === "full" ? "escalated" : "economy"}`);
  if (depth === "full") text = text.replace("## Objectives", [
    "### Product requirements",
    "| Requirement ID | Need | Actor | Observable outcome | Non-goal or constraint |",
    "|---|---|---|---|---|",
    "| REQ-1 | Bounded retry multiplier. | Operator | Valid values are used and invalid values fall back. | No retry redesign. |",
    "## Objectives",
  ].join("\n"));
  if (["compact", "full"].includes(depth)) text = text.replace("## Execution steps", [
    "### System architecture",
    "| Surface | Current state | Required change | Invariant | Evidence |",
    "|---|---|---|---|---|",
    "| Retry configuration | Fixed multiplier | Parse one bounded environment value. | Existing retry defaults remain stable. | Source and focused tests. |",
    ...(depth === "full" ? [
      "### Program design",
      "| Design ID | Responsibility | Interfaces | Invariants | Failure handling |",
      "|---|---|---|---|---|",
      "| DESIGN-1 | Parse retry multiplier. | Environment input and retry policy export. | Value stays within 1 through 10. | Invalid input returns the existing default. |",
    ] : []),
    "## Execution steps",
  ].join("\n"));
  if (["compact", "full"].includes(depth)) text = text.replace("## Verification", [
    "### Vertical slices",
    "| Slice ID | Objectives | Dependencies | Targets | Observable outcome | Check IDs | Human review |",
    "|---|---|---|---|---|---|---|",
    "| SLICE-1 | OBJ-1, OBJ-2 | None. | `src/retry-policy.js`, `test/retry-policy.test.js` | Bounded parsing and regression coverage pass together. | CHECK-1, CHECK-2 | no |",
    "## Verification",
  ].join("\n"));
  return text;
}

test("schema-2 plans and missing schema-3 semantics are rejected", () => {
  assert.match(inspectArtifactText(canonical.replace("schema: 3", "schema: 2"), root).errors.join("\n"), /must be equal to constant/);
  assert.match(inspectArtifactText(canonical.replace(/^design_depth:.*\n/m, ""), root).errors.join("\n"), /design_depth/);
  assert.match(inspectArtifactText(canonical.replace(/^automation_profile_max:.*\n/m, ""), root).errors.join("\n"), /automation_profile_max/);
  assert.match(inspectArtifactText(canonical.replace(/^writer_tier_required:.*\n/m, ""), root).errors.join("\n"), /writer_tier_required/);
});

test("every schema-3 Check declares an evidence class", () => {
  assert.deepEqual(executionContractFromArtifactText(designPlan("oneshot"), root).errors, []);
  const unclassified = designPlan("oneshot")
    .replace(
      "| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |\n|---|---|---|---|---|---|---|---|---|",
      "| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Cost Class | Prerequisites |\n|---|---|---|---|---|---|---|---|",
    )
    .replaceAll(" | yes | machine-verifiable |", " | yes |");
  const errors = inspectArtifactText(unclassified, root).errors.join("\n");
  assert.match(errors, /needs Evidence Class/);
});

test("compact design requires system impact, vertical slices, and verification ownership", () => {
  const valid = executionContractFromArtifactText(designPlan("compact"), root);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.slices[0]["Slice ID"], "SLICE-1");
  assert.equal(valid.checks[0]["Evidence Class"], "machine-verifiable");
  const missing = inspectArtifactText(designPlan("oneshot").replace("design_depth: oneshot", "design_depth: compact"), root).errors.join("\n");
  assert.match(missing, /System architecture/);
  assert.match(missing, /Vertical slices/);
});

test("full design requires product, architecture, program design, and slices", () => {
  const contract = executionContractFromArtifactText(designPlan("full"), root);
  assert.deepEqual(contract.errors, []);
  const incomplete = inspectArtifactText(designPlan("compact").replace("design_depth: compact", "design_depth: full"), root).errors.join("\n");
  assert.match(incomplete, /Product requirements/);
  assert.match(incomplete, /Program design/);
  const weakWriter = designPlan("full").replace("writer_tier_required: escalated", "writer_tier_required: economy");
  assert.match(inspectArtifactText(weakWriter, root).errors.join("\n"), /writer_tier_required/);
  const raisedWriter = designPlan("compact").replace("writer_tier_required: economy", "writer_tier_required: escalated");
  assert.deepEqual(executionContractFromArtifactText(raisedWriter, root).errors, []);
});

test("auto-capable roots freeze all budgets and keep allowed targets inside root scope", () => {
  assert.deepEqual(executionContractFromArtifactText(designPlan("compact", { automation: true }), root).errors, []);
  const outside = designPlan("compact", { automation: true }).replace("allowed_targets: [src/retry-policy.js, test/retry-policy.test.js]", "allowed_targets: [outside/file.js]");
  assert.match(inspectArtifactText(outside, root).errors.join("\n"), /outside required\/permitted scope/);
  const missingBudget = designPlan("compact", { automation: true }).replace("  max_cost_usd: 5\n", "");
  assert.match(inspectArtifactText(missingBudget, root).errors.join("\n"), /max_cost_usd/);
  const missingAllowList = designPlan("compact", { automation: true }).replace("  dependencies: deny", "  dependencies: allow-listed");
  assert.match(inspectArtifactText(missingAllowList, root).errors.join("\n"), /allowed_dependencies/);
  const allowed = missingAllowList.replace("  dependencies: allow-listed", "  dependencies: allow-listed\n  allowed_dependencies: [zod]");
  assert.deepEqual(executionContractFromArtifactText(allowed, root).errors, []);
  const manualWithBounds = designPlan("compact", { automation: true }).replace("automation_profile_max: auto-gated", "automation_profile_max: manual");
  assert.match(inspectArtifactText(manualWithBounds, root).errors.join("\n"), /must NOT be valid/);
  const unknownBound = designPlan("compact", { automation: true }).replace("  max_writer_escalations: 1", "  max_writer_escalations: 1\n  unknown_limit: 1");
  assert.match(inspectArtifactText(unknownBound, root).errors.join("\n"), /additional property unknown_limit/);
});
