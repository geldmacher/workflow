import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, parseFrontmatter } from "../scripts/validate-plugin.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("manual commands preserve Cursor-native human gates", () => {
  for (const [command, skill, mode] of [["plan-work", "work-planning", "Plan"], ["review-work", "work-review", "Ask"], ["close-work", "work-closeout", "Agent"], ["correct-work", "work-execution", "Agent"], ["learn-from-work", "work-learning", "Agent"]]) {
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

test("review without a selector uses the active native Plan before controller state", () => {
  const command = read("commands/review-work.md");
  const runtime = [command, read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(command, /optional `wp-\*`.*without it.*active native Cursor Plan/is);
  assert.match(runtime, /Manual activity needs no Preparation\/Run/i);
  assert.match(runtime, /Only if no Plan resolves.*active controller Run/is);
  assert.match(runtime, /ignore unscoped `workflow_status` for Manual resolution/i);
  assert.match(runtime, /If Root resolution succeeds but Evidence is still absent.*\/close-work.*emit no review/is);
  assert.match(runtime, /schema-valid Schema-5 review.*validate when available/is);
});

test("artifact consumers resolve semantically and recognize Workflow 3/4 as history", () => {
  const protocol = read("references/artifact-protocol.md");
  assert.match(protocol, /resolve by semantic `artifact`, never filename/i);
  for (const skill of ["work-review", "work-execution", "work-learning", "work-explanation"]) assert.match(read(`skills/${skill}/SKILL.md`), /Workflow-3\/4/i);
});

test("planning uses compact semantic Root with immutable intent and adaptive strategy", () => {
  const runtime = [read("skills/work-planning/SKILL.md"), read("references/executable-contract.md"), read("references/design-contract.md"), read("references/plan-container-contract.md")].join("\n");
  assert.match(runtime, /Intent Readiness, not broad brainstorming/i);
  assert.match(runtime, /at most three related questions/i);
  assert.match(runtime, /Emit no plan or draft before the answer/i);
  assert.match(runtime, /Schema-5 Intent Root/i);
  assert.match(runtime, /prose, lists, or tables/i);
  assert.match(runtime, /rather than.*fixed tables|rather than padding.*fixed tables/i);
  assert.match(runtime, /Strategy.*revise|Strategy.*mutable/i);
  assert.match(runtime, /Implement Plan.*approval/i);
  assert.match(read("commands/plan-work.md"), /\/plan-work replan \[wp-\*\]/i);
  assert.match(runtime, /fresh `wp-\*`|fresh Root ID/i);
  assert.match(runtime, /predecessor_plan_id.*replan_source_review_id/is);
  assert.match(runtime, /source review.*next_action: replan/is);
  assert.match(runtime, /Cursor-selected primary owns \*\*Implement Plan\*\*/i);
  assert.match(runtime, /subagents.*inherit.*(?:main|its) model/is);
  assert.match(runtime, /\[workflow-model-inherit-v1\]/);
});

test("manual correction remains bounded and verification-only can avoid edits", () => {
  const runtime = [read("commands/correct-work.md"), read("skills/work-execution/SKILL.md")].join("\n");
  assert.match(runtime, /accepts no arguments/);
  assert.match(runtime, /satisfied\|pending\|partial\|conflicted/);
  assert.match(runtime, /Verification-only avoids edits/i);
  assert.match(runtime, /root, Strategy revision when required, chain, scope, reuse, risk, and approval/i);
  assert.match(runtime, /active native Cursor Plan/i);
  assert.match(runtime, /stale review tip|stale.*chain/i);
  assert.match(runtime, /may delegate bounded/i);
  assert.match(runtime, /omit Task model overrides/i);
  assert.match(runtime, /primary owns execution, integration, and closeout/i);
});

test("manual closeout is deterministic recovery and cannot mutate the repository", () => {
  const runtime = [read("commands/close-work.md"), read("skills/work-closeout/SKILL.md"), read("references/closeout-contract.md")].join("\n");
  assert.match(runtime, /workflow_closeout/);
  assert.match(runtime, /artifact byte-for-byte|artifact unchanged/i);
  assert.match(runtime, /does not authorize repository mutation/i);
  assert.match(runtime, /local, non-interactive/i);
  assert.match(runtime, /fingerprints for every tracked, visible untracked, and Check-prerequisite path/is);
  assert.match(runtime, /external byte-equivalent snapshot.*technically read-only.*non-bypassable full-tree write audit.*restored writes.*Write-deny the original repository.*await the full tree/is);
  assert.match(runtime, /recompute the complete baseline.*compare content, paths, index state, and HEAD/is);
  assert.match(runtime, /network.*production.*external effect/is);
  assert.match(runtime, /handoff cache is transport only|cache is non-authoritative transport/i);
  assert.match(runtime, /representation: full\|delta.*evidence_mode: lean\|full/is);
});

test("manual status, acceptance, explanation, and learning share fail-closed active Root selection", () => {
  const status = [read("commands/work-status.md"), read("skills/work-automation/SKILL.md"), read("references/state-contract.md")].join("\n");
  assert.match(status, /active native Cursor Plan.*before a unique active controller subject/is);
  assert.match(status, /omit `root_plan_id` only.*unique active lineage tip/is);
  const acceptance = read("commands/accept-work.md");
  assert.match(acceptance, /\[wp-id\] provisional/);
  assert.match(acceptance, /delivery-ready-provisional/);
  assert.match(acceptance, /resolved `root_plan_id`/);

  const explanation = [read("commands/explain-work.md"), read("skills/work-explanation/SKILL.md"), read("references/explanation-contract.md")].join("\n");
  assert.match(explanation, /active native Cursor Plan/i);
  assert.match(explanation, /only without a Plan.*active controller Run/is);

  const learning = [read("skills/work-learning/SKILL.md"), read("references/learning-contract.md")].join("\n");
  assert.match(learning, /active native Cursor Plan/i);
  assert.match(learning, /achieved Schema-5 Root/i);
  assert.match(learning, /never (?:fall back to|use) older completed Roots/i);
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
  assert.match(runtime, /transcripts(?: and provisional acceptance)? never publish rules automatically/i);
  assert.match(runtime, /applied\|already-covered\|skipped-unconfirmed\|needs-clarification/i);
});

test("extensions are opaque and excluded from authority and model context", () => {
  const runtime = [read("references/artifact-protocol.md"), read("skills/work-planning/SKILL.md")].join("\n");
  assert.match(runtime, /opaque audit metadata/i);
  assert.match(runtime, /never model context or authority/i);
  assert.match(runtime, /Do not invent `extensions`/i);
});

test("named post-implementation agents inherit the active model and are read-only", () => {
  for (const name of ["work-plan-auditor", "work-design-auditor", "delivery-auditor", "risk-auditor", "work-explainer"]) {
    const fields = parseFrontmatter(join(defaultRoot, "agents", `${name}.md`));
    assert.equal(fields.model, "inherit");
    assert.equal(fields.readonly, true);
    assert.doesNotMatch(read(`agents/${name}.md`), /use only supplied context plus Read\/Search|never run shell/i);
  }
  const review = read("skills/work-review/SKILL.md");
  const explanation = read("skills/work-explanation/SKILL.md");
  assert.match(review, /Use no built-in or general-purpose subagent/i);
  assert.match(`${review}\n${explanation}`, /\[workflow-readonly-review-v1\]/);
  assert.match(`${review}\n${explanation}`, /inherit(?:s)? the Cursor-selected model/i);
  assert.match(`${review}\n${explanation}`, /Workflow chooses no model/i);
  assert.doesNotMatch(`${review}\n${explanation}`, /Grok|Composer/i);
});

test("runtime surface has one bundled controller and no automatic publication", () => {
  const manifest = JSON.parse(read(".cursor-plugin/plugin.json"));
  assert.equal("rules" in manifest, false);
  assert.equal(manifest.hooks, "./hooks/hooks.json");
  assert.match(read("hooks/hooks.json"), /subagentStart/);
  assert.match(read("hooks/hooks.json"), /failClosed/);
  assert.equal(manifest.mcpServers, "mcp.json");
  assert.match(read("mcp.json"), /\$\{CURSOR_PLUGIN_ROOT\}\/dist\/workflow-mcp\.mjs/);
  assert.match(read("README.md"), /no automatic push, PR, merge, deployment/i);
});
