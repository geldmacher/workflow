import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");
const sources = [
  "README.md",
  "docs/overview.md",
  "docs/profiles.md",
  "docs/manual-workflow.md",
  "docs/configuration.md",
  "references/artifact-protocol.md",
  "references/manual-workflow-contract.md",
  "references/automation-contract.md",
].map(read);

test("public documentation shares the Workflow-6 ownership boundary", () => {
  const joined = sources.join("\n");
  assert.match(joined, /Schema 6|Schema-6/);
  assert.match(joined, /project harness/i);
  assert.match(joined, /commands, tools, models|command, tool, model/i);
  assert.match(joined, /Plan → Implement →.*Review/i);
  assert.match(joined, /repository-only/i);
  assert.match(joined, /Shadow Mode/i);
});

test("authoritative protocol is intent-only and Schema-6-only", () => {
  const protocol = read("references/artifact-protocol.md");
  assert.match(protocol, /Verification Intent/);
  assert.match(protocol, /Expected Evidence/);
  assert.match(protocol, /only supported Workflow contract/i);
  assert.match(protocol, /Every other artifact schema is rejected/i);
  assert.doesNotMatch(protocol, /Working Directory|Command or Inspection|host_commands|route pool|task recipe|repetition count/i);
});

test("Manual Review preserves human gates and honest evidence", () => {
  const manual = `${read("docs/manual-workflow.md")}\n${read("references/manual-workflow-contract.md")}\n${read("references/review-contract.md")}`;
  assert.match(manual, /repository-read-only|read-only repository/i);
  assert.match(manual, /Root/i);
  assert.match(manual, /canonical workspace|workspace binding/i);
  assert.match(manual, /missing attestation|without.*attestation/i);
  assert.match(manual, /provisional/i);
  assert.match(manual, /explicit human/i);
});

test("Plan and Review skills close the native Root transport before inspection", () => {
  for (const path of ["skills/work-planning/SKILL.md", "targets/codex/skills/plan-work/SKILL.md"]) {
    const plan = read(path);
    assert.match(plan, /End `Quick decision` with exactly one `### Next step` block/i, path);
    assert.match(plan, /`Now`, `How`, and `Why` bullets in that order/i, path);
    assert.doesNotMatch(plan, /End with `### Next step`/i, path);
  }
  for (const path of [
    "skills/work-review/SKILL.md",
    "targets/codex/skills/review-work/SKILL.md",
    "targets/agent-plugins/skills/review-work/SKILL.md",
  ]) {
    const review = read(path);
    const validation = review.indexOf("validate-plan");
    const inspection = review.indexOf("repository inspection");
    assert.ok(validation >= 0 && inspection >= 0, `${path} must name validation and repository inspection`);
    assert.match(review, /Before (?:any )?repository inspection/i, path);
    assert.match(review, /single embedded Root/i, path);
  }
});

test("removed execution-engine surfaces stay absent from current guidance", () => {
  const current = sources.join("\n");
  for (const removed of ["/work-models", "/work-verification", "/work-watch", "/work-control"]) {
    const mentions = current.split(removed).length - 1;
    assert.ok(mentions <= 2, `${removed} may appear only in removal notices`);
  }
  assert.doesNotMatch(current, /Workflow (?:runs|selects|allowlists|classifies) (?:the )?(?:command|tool|model)/i);
});
