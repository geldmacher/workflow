import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  assert.equal(existsSync(join(defaultRoot, "commands", "close-work.md")), false);
  assert.equal(existsSync(join(defaultRoot, "skills", "work-closeout", "SKILL.md")), false);
});

test("review is fresh and read-only but may use Cursor inspection capabilities", () => {
  const runtime = [read("commands/review-work.md"), read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(runtime, /fresh Cursor Ask(?: context)?/i);
  assert.match(runtime, /(?:do not inherit|without) Writer assumptions|not Writer/i);
  assert.match(runtime, /read-only/i);
  assert.match(runtime, /workflow_closeout/);
  assert.match(runtime, /never upgrades? proof|cannot raise/i);
});

test("review resolves only the current native Plan and never restores Manual authority", () => {
  const command = read("commands/review-work.md");
  const runtime = [command, read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(command, /exact Schema-5 Root.*current task's native Cursor Plan/is);
  assert.match(runtime, /Never use active-root files, chain caches, handoff tips, `workflow_artifact_context`, or another task as authority/is);
  assert.match(runtime, /No Root, no substantive Review/is);
  assert.match(runtime, /restore the Plan in this task or create and approve a new native Plan/is);
  assert.match(runtime, /Delivery Evidence and Work Review together or neither/is);
  assert.doesNotMatch(runtime, /recommend.*close-work/i);
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
  assert.match(runtime, /`### Verification`.*directly inside `## Acceptance`/is);
  assert.match(runtime, /host guard validates the exact Root but grants no approval/is);
  assert.match(runtime, /native Plan as the sole plan container/is);
  assert.match(runtime, /Children match the parent or a Manual approved candidate/is);
  assert.match(runtime, /Manual approved candidate|parent-or-approved/i);
  assert.match(runtime, /add no closeout todo, `workflow_attestation`, Evidence step, or artifact-record step/is);
  assert.match(runtime, /correctness.*security.*maintainability.*performance.*efficiency.*comprehensibility/is);
  assert.match(runtime, /never a six-item checklist/i);
  assert.match(runtime, /advanced tests(?: and |\/)scanners stay optional/i);
});

test("Codex uses review-owned evidence while portable closeout remains compatible", () => {
  const codex = [
    "plan-work",
    "correct-work",
    "review-work",
    "work-status",
  ].map((name) => read(`targets/codex/skills/${name}/SKILL.md`)).join("\n");
  assert.match(codex, /Finish normally without closeout|add no closeout section/is);
  assert.match(codex, /returns Delivery Evidence and Work Review atomically or neither/is);
  assert.match(codex, /constraint_summary.*human_attention.*problem_details/is);
  assert.match(read("targets/codex/references/codex-manual.md"), /optional receipts.*add no human setup step/is);
  assert.equal(existsSync(join(defaultRoot, "targets", "codex", "skills", "close-work", "SKILL.md")), false);

  const portable = [
    read("targets/agent-plugins/skills/implement-work/SKILL.md"),
    read("targets/agent-plugins/skills/close-work/SKILL.md"),
    read("targets/agent-plugins/references/portable-manual.md"),
  ].join("\n");
  assert.match(portable, /does not standardize native (?:lifecycle )?receipt hooks/i);
  assert.match(portable, /downgrade.*fresh (?:human )?review/is);
  assert.match(portable, /never fabricate|Do not loop or fabricate/is);
  assert.match(portable, /current-delivery Problem|current-delivery limitation/is);
});

test("manual correction remains bounded and verification-only can avoid edits", () => {
  const runtime = [read("commands/correct-work.md"), read("skills/work-execution/SKILL.md"), read("references/correction-contract.md"), read("references/closeout-contract.md")].join("\n");
  assert.match(runtime, /accepts no arguments/);
  assert.match(runtime, /satisfied\|pending\|partial\|conflicted/);
  assert.match(runtime, /Verification-only avoids edits/i);
  assert.match(runtime, /root, Strategy revision when required, chain, scope, reuse, risk, and approval/i);
  assert.match(runtime, /exact native Cursor Plan/i);
  assert.match(runtime, /stale review tip|stale.*chain/i);
  assert.match(runtime, /may delegate bounded/i);
  assert.match(runtime, /omit Task model overrides/i);
  assert.match(runtime, /primary owns execution and integration/i);
  assert.match(runtime, /failed, missing, (?:explicitly )?affected, (?:fingerprint-)?stale, or ambiguous Root Checks/is);
  assert.match(runtime, /unaffected proof.*existing grade/is);
  assert.match(runtime, /Run correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks/is);
  assert.match(runtime, /unavailable or failed.*(?:explicit|exact)/i);
  assert.match(runtime, /each machine Check.*exact standalone planned command.*leading `rtk`/is);
  assert.match(runtime, /implementation observations, not Review-owned Evidence/is);
  assert.match(runtime, /Finish normally.*Do not call closeout/is);
});

test("portable closeout compatibility grants no Cursor or Codex Manual authority", () => {
  const runtime = [read("references/closeout-contract.md"), read("targets/agent-plugins/skills/close-work/SKILL.md")].join("\n");
  assert.match(runtime, /Cursor and Codex Manual do not close out implementation/is);
  assert.match(runtime, /delivery-evidence mode.*portable clients/is);
  assert.match(runtime, /do not grant Cursor or Codex Manual task authority/is);
  assert.match(runtime, /server observes the repository.*Evidence and Review atomically/is);
});

test("manual consumers share exact current-task artifact authority", () => {
  const status = [read("commands/work-status.md"), read("skills/work-automation/SKILL.md"), read("references/state-contract.md")].join("\n");
  assert.match(status, /exact Root\/Evidence\/Review bytes visible in this task/is);
  assert.match(status, /never restores host state or cache artifacts/is);
  const acceptance = read("commands/accept-work.md");
  assert.match(acceptance, /\[wp-id\] provisional/);
  assert.match(acceptance, /delivery-ready-provisional/);
  assert.match(acceptance, /resolved `root_plan_id`/);

  const explanation = [read("commands/explain-work.md"), read("skills/work-explanation/SKILL.md"), read("references/explanation-contract.md")].join("\n");
  assert.match(explanation, /current task's native Plan context/i);
  assert.match(explanation, /Only without a Manual Plan may an explicitly selected controller Run/is);

  const learning = [read("skills/work-learning/SKILL.md"), read("references/learning-contract.md")].join("\n");
  assert.match(learning, /current-task source: exact native Cursor Plan bytes/i);
  assert.match(learning, /exact current.*Schema-5.*chain/is);
  assert.match(learning, /one exact controller Run already returned in the task|otherwise one controller Run.*current task/is);
  assert.match(learning, /latest\/history\/store lookup stops|never search storage/is);
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
  assert.match(runtime, /(?:separately|directly?) authoriz\w* bounded project-guidance edits/i);
  assert.match(runtime, /transcripts(?: and provisional acceptance)? never publish rules automatically/i);
  assert.match(runtime, /workspace[-_]match|delivered paths matching/i);
  assert.match(runtime, /separate human/i);
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
  const hooks = read("hooks/hooks.json");
  const hookConfig = JSON.parse(hooks);
  assert.deepEqual(Object.values(hookConfig.hooks).map((entries) => entries.length), Array(6).fill(1));
  for (const event of ["sessionStart", "beforeSubmitPrompt", "preToolUse", "subagentStart", "subagentStop", "postToolUse"]) assert.match(hooks, new RegExp(event));
  for (const event of ["afterAgentResponse", "postToolUseFailure", '"stop"']) assert.doesNotMatch(hooks, new RegExp(event));
  assert.match(hooks, /\|Task\|/);
  assert.match(hooks, /subagent-guard\.mjs/);
  assert.match(hooks, /"matcher": "CreatePlan\|Write/);
  assert.match(hooks, /failClosed/);
  assert.equal(manifest.mcpServers, "mcp.json");
  assert.match(read("mcp.json"), /\$\{CURSOR_PLUGIN_ROOT\}\/dist\/workflow-mcp\.mjs/);
  assert.match(read("mcp.json"), /GELDMACHER_WORKFLOW_WORKSPACE_ROOT/);
  assert.match(read("mcp.json"), /\$\{workspaceFolder\}/);
  assert.match(read("README.md"), /no automatic push, PR, merge, deployment/i);
});
