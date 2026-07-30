import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, parseFrontmatter } from "../scripts/validate-plugin.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("manual commands preserve Cursor-native human gates", () => {
  for (const [command, skill, mode] of [["plan-work", "work-planning", "Plan"], ["review-work", "work-review", "Ask"], ["correct-work", "work-execution", "Agent"], ["learn-from-work", "work-learning", "Agent"]]) {
    const text = read(`commands/${command}.md`);
    assert.match(text, new RegExp(`designed for Cursor ${mode} Mode`, "i"));
    assert.match(text, new RegExp(`\\[${skill}\\]\\([^)]*SKILL\\.md\\).*completely`, "i"));
    assert.doesNotMatch(text, /MODE (?:GATE|PREREQUISITE)|MODE REQUIRED:|tool allowlist/i);
  }
});

test("review is fresh and read-only but may use Cursor inspection capabilities", () => {
  const runtime = [read("commands/review-work.md"), read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(runtime, /fresh Cursor Ask context/i);
  assert.match(runtime, /do not inherit Writer assumptions/i);
  assert.match(runtime, /read-only/i);
  assert.match(runtime, /MCP/);
  assert.match(runtime, /cannot (?:upgrade|raise)/i);
});

test("artifact consumers resolve semantically and recognize Workflow 3 as history", () => {
  const protocol = read("references/artifact-protocol.md");
  assert.match(protocol, /resolve by semantic `artifact`, never filename/i);
  for (const skill of ["work-review", "work-execution", "work-learning", "work-explanation"]) assert.match(read(`skills/${skill}/SKILL.md`), /Workflow-3/i);
});

test("planning uses compact semantic Root with immutable intent and adaptive strategy", () => {
  const runtime = [read("skills/work-planning/SKILL.md"), read("references/executable-contract.md"), read("references/design-contract.md"), read("references/plan-container-contract.md")].join("\n");
  assert.match(runtime, /Intent Readiness, not broad brainstorming/i);
  assert.match(runtime, /at most three related questions/i);
  assert.match(runtime, /Emit no plan or draft before the answer/i);
  assert.match(runtime, /Schema-4 Intent Root/i);
  assert.match(runtime, /prose, lists, or tables/i);
  assert.match(runtime, /rather than.*fixed tables|rather than padding.*fixed tables/i);
  assert.match(runtime, /Strategy.*revise|Strategy.*mutable/i);
  assert.match(runtime, /Implement Plan.*approval/i);
});

test("manual correction remains bounded and verification-only can avoid edits", () => {
  const runtime = [read("commands/correct-work.md"), read("skills/work-execution/SKILL.md")].join("\n");
  assert.match(runtime, /accepts no arguments/);
  assert.match(runtime, /satisfied\|pending\|partial\|conflicted/);
  assert.match(runtime, /Verification-only avoids edits/i);
  assert.match(runtime, /root, Strategy revision, chain, scope, reuse, risk, and approval/i);
});

test("automation documents ordered Pools, writer affinity, and automatic downgrade", () => {
  const runtime = [read("skills/work-automation/SKILL.md"), read("references/automation-contract.md"), read("references/model-routing-contract.md")].join("\n");
  assert.match(runtime, /approved-pool/i);
  assert.match(runtime, /Writer affinity persists/i);
  assert.match(runtime, /downgrade.*supervised/i);
  assert.match(runtime, /exact Qualification Key/i);
  assert.match(runtime, /never push, PR, merge, deploy/i);
});

test("verification profile is hash bound and drift invalidates activation", () => {
  const runtime = [read("commands/work-verification.md"), read("references/verification-profile-contract.md")].join("\n");
  for (const capability of ["launch", "doctor", "drive", "observe", "evidence", "reset", "cleanup"]) assert.match(runtime, new RegExp(capability));
  assert.match(runtime, /external directory/i);
  assert.match(runtime, /drift invalidates activation/i);
  assert.match(runtime, /never fabricate/i);
});

test("learning stays human invoked and does not publish transcript rules", () => {
  const runtime = [read("commands/learn-from-work.md"), read("skills/work-learning/SKILL.md"), read("references/learning-contract.md"), read("references/automation-contract.md")].join("\n");
  assert.match(runtime, /human authorization for bounded project-guidance edits/i);
  assert.match(runtime, /transcripts never publish rules automatically/i);
  assert.match(runtime, /applied\|already-covered\|skipped-unconfirmed\|needs-clarification/i);
});

test("extensions are opaque and excluded from authority and model context", () => {
  const runtime = [read("references/artifact-protocol.md"), read("skills/work-planning/SKILL.md")].join("\n");
  assert.match(runtime, /opaque audit metadata/i);
  assert.match(runtime, /never model context or authority/i);
  assert.match(runtime, /Do not invent `extensions`/i);
});

test("auditors inherit the active model and declare no tool gates", () => {
  for (const name of ["work-plan-auditor", "delivery-auditor", "risk-auditor"]) {
    const fields = parseFrontmatter(join(defaultRoot, "agents", `${name}.md`));
    assert.equal(fields.model, "inherit");
    assert.equal("readonly" in fields, false);
    assert.doesNotMatch(read(`agents/${name}.md`), /use only supplied context plus Read\/Search|never run shell/i);
  }
});

test("runtime surface has one bundled controller and no automatic publication", () => {
  const manifest = JSON.parse(read(".cursor-plugin/plugin.json"));
  assert.equal("rules" in manifest, false);
  assert.equal("hooks" in manifest, false);
  assert.equal(manifest.mcpServers, "mcp.json");
  assert.match(read("mcp.json"), /\$\{CURSOR_PLUGIN_ROOT\}\/dist\/workflow-mcp\.mjs/);
  assert.match(read("README.md"), /no automatic push, PR, merge, deployment/i);
});
