import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, parseFrontmatter } from "../scripts/validate-plugin.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("commands declare their intended Cursor mode without capability gates", () => {
  for (const [command, skill, mode] of [
    ["plan-work", "work-planning", "Plan"],
    ["review-work", "work-review", "Ask"],
    ["correct-work", "work-execution", "Agent"],
    ["learn-from-work", "work-learning", "Agent"],
  ]) {
    const text = read(`commands/${command}.md`);
    assert.match(text, new RegExp(`designed for Cursor ${mode} Mode`, "i"));
    assert.match(text, new RegExp(`read and follow \\[${skill}\\].*completely`, "i"));
    assert.doesNotMatch(text, /MODE (?:GATE|PREREQUISITE)|MODE REQUIRED:|edit\+terminal|native Plan creation exists/i);
  }
});

test("review permits Cursor-provided inspection capabilities including MCP", () => {
  const runtime = [read("commands/review-work.md"), read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(runtime, /MCP/);
  assert.match(runtime, /browser|documentation/i);
  assert.match(runtime, /subagents/i);
  assert.doesNotMatch(runtime, /use only Read\/Search|never shell|never.*Git|tool allowlist/i);
  assert.match(runtime, /Cursor.*capabilit/i);
});

test("planning preserves intent, assurance, and native human approval", () => {
  const runtime = [read("commands/plan-work.md"), read("skills/work-planning/SKILL.md"), read("references/executable-contract.md"), read("references/plan-container-contract.md")].join("\n");
  assert.match(runtime, /Intent Readiness, not broad brainstorming/);
  assert.match(runtime, /use the ask question tool/i);
  assert.match(runtime, /at most three related decision questions/i);
  assert.match(runtime, /wait for the (?:human )?answer/i);
  assert.match(runtime, /no plan or plan draft/i);
  assert.match(runtime, /clear (?:goal|intent).*without an (?:unnecessary )?interview/i);
  assert.match(runtime, /blocking prose fallback/i);
  assert.match(runtime, /human answer.*source.*DEC-/i);
  assert.match(runtime, /do not load detailed planning contracts, schemas, fixtures, example plans, or assurance boilerplate/i);
  assert.match(runtime, /never search repository\/plugin text.*discover the tool/i);
  assert.match(runtime, /only when Cursor does not expose the tool or rejects its invocation/i);
  assert.match(runtime, /Before calling `CreatePlan`, self-check all eight Root Planning areas/i);
  for (const area of ["Intent and decisions", "Objectives", "Evidence and baseline", "Scope and targets", "Execution steps", "Verification", "Operational readiness", "Risk and closeout"]) {
    assert.match(runtime, new RegExp(area, "i"));
  }
  assert.match(runtime, /yaml artifact-envelope/i);
  assert.match(runtime, /canonical semantic tables even for Lean work/i);
  assert.match(runtime, /do not replace them with bullets or reduced ID\/description tables/i);
  assert.match(runtime, /exact, unnumbered H2 names/i);
  assert.match(runtime, /Readiness item \| Resolution \| Evidence/i);
  assert.match(runtime, /Step ID \| Objectives \| Targets \| Required outcome/i);
  assert.match(runtime, /Verification: `Check ID \| Objectives \| Working Directory/i);
  assert.match(runtime, /Every OBJ maps to a STEP\/PROBE and required CHECK/);
  assert.match(runtime, /hard triggers and human-only lowering/);
  assert.match(runtime, /Implement Plan.*approves initial execution/i);
  assert.match(runtime, /Publishing, production access/);
  assert.doesNotMatch(runtime, /probe (?:for|whether).*ask question|require only the ask question tool|disable.*capabilit/i);
});

test("correction uses available Agent capabilities and keeps semantic preflight", () => {
  const runtime = [read("commands/correct-work.md"), read("skills/work-execution/SKILL.md")].join("\n");
  assert.match(runtime, /accepts no arguments/);
  assert.match(runtime, /satisfied\|pending\|partial\|conflicted/);
  assert.match(runtime, /verification-only/i);
  assert.match(runtime, /validator when readily available/i);
  assert.match(runtime, /check root, chain, scope, reuse, risk, approval/i);
  assert.doesNotMatch(runtime, /Require Agent Mode with edit\+terminal|unique OS-temp|Evidence is chat-only/i);
});

test("learning closeout directly persists only confirmed project guidance", () => {
  const runtime = [
    read("commands/learn-from-work.md"),
    read("skills/work-learning/SKILL.md"),
    read("references/learning-contract.md"),
    read("skills/work-review/SKILL.md"),
    read("skills/work-execution/SKILL.md"),
  ].join("\n");
  assert.match(runtime, /entire trailing command text.*one supplemental/i);
  assert.match(runtime, /exactly one (?:valid )?root/i);
  assert.match(runtime, /complete .*evidence.*subject_id/i);
  assert.match(runtime, /current repository inspection/i);
  assert.match(runtime, /smallest (?:direct change|update|type-specific component)/i);
  assert.match(runtime, /docs\/workflow-learnings\.md/i);
  assert.match(runtime, /applied\|already-covered\|skipped-unconfirmed\|needs-clarification/i);
  assert.match(runtime, /do not (?:change|materialize).*product source/i);
  assert.match(runtime, /do not materialize correction learning candidates/i);
  assert.match(runtime, /Every new correction includes at least one root-unique `LRN-\*` candidate/i);
});

test("learning closeout follows the fixed target-routing order", () => {
  const runtime = [read("skills/work-learning/SKILL.md"), read("references/learning-contract.md")].join("\n");
  const ordered = [
    /1\. Leave equal or stronger existing guidance unchanged/i,
    /2\. Extend the closest suitable existing document or component in place/i,
    /3\. If reusable behavior has a clear trigger or bounded role, create the smallest type-specific component/i,
    /4\. Only otherwise use the documentation fallback/i,
  ];
  let cursor = -1;
  for (const pattern of ordered) {
    const next = runtime.search(pattern);
    assert.ok(next > cursor, `${pattern} must follow the previous routing decision`);
    cursor = next;
  }
  assert.match(runtime, /another Cursor-supported project path/i);
  assert.match(runtime, /docs structure is suitable only when project-discoverable and reachable from existing navigation/i);
  assert.match(runtime, /a `docs\/` directory alone is insufficient/i);
  assert.match(runtime, /Prefer a component (?:over|despite).*docs.*trigger.*reus.*delegat/i);
  assert.match(runtime, /do not duplicate (?:the component body|it|its body) in docs/i);
});

test("learning closeout defines type-correct Cursor component targets", () => {
  const contract = read("references/learning-contract.md");
  assert.match(contract, /normative behavior.*`\.cursor\/rules\/<name>\.mdc`.*`description`.*`globs`.*`alwaysApply`/is);
  assert.match(contract, /`true` only when (?:genuinely )?universal/i);
  assert.match(contract, /prefer a scoped Rule for new guidance/i);
  assert.match(contract, /conditional multi-step procedure.*`\.agents\/skills\/<name>\/SKILL\.md`.*only `name` and trigger-rich `description` frontmatter/i);
  assert.match(contract, /folder and `name` (?:must )?match/i);
  assert.match(contract, /specialist research\/review\/audit role.*`\.cursor\/agents\/<name>\.md`.*`name`, `description`, `model: inherit`/i);
  assert.match(contract, /body defines task, inputs, boundaries, output/i);
  assert.match(contract, /human-started workflow.*`\.cursor\/commands\/<name>\.md`.*plain Markdown unless the project has a valid command-frontmatter convention/i);
  assert.match(contract, /collision-safe kebab-case (?:names|components)/i);
  assert.match(contract, /Validate (?:every )?new components? structurally/i);
});

test("learning docs fallback is last-resort, linked, and migratable", () => {
  const contract = read("references/learning-contract.md");
  assert.match(contract, /Use `docs\/workflow-learnings\.md` only when no suitable guidance exists, no clear component trigger\/independent workflow exists, and a durable general note still helps/i);
  assert.match(contract, /Link it from existing README, contributor, or agent navigation/i);
  assert.match(contract, /remove a fallback entry later superseded by a component/i);
  assert.match(contract, /Repeated closeout with identical effective inputs produces no diff/i);
});

test("auditors inherit Cursor mode and model without capability declarations", () => {
  for (const name of ["work-plan-auditor", "delivery-auditor", "risk-auditor"]) {
    const fields = parseFrontmatter(join(defaultRoot, "agents", `${name}.md`));
    assert.equal(fields.model, "inherit");
    assert.equal("readonly" in fields, false);
    const text = read(`agents/${name}.md`);
    assert.doesNotMatch(text, /use only supplied context plus Read\/Search|never run shell|\.\.\/references\//i);
  }
  assert.doesNotMatch(read("agents/work-plan-auditor.md"), /\.plan\.md path|temporary non-repository candidate/i);
});

test("runtime surface contains no retired protocol or branding", () => {
  const paths = [
    "README.md",
    "commands/plan-work.md", "commands/review-work.md", "commands/correct-work.md", "commands/learn-from-work.md",
    "skills/work-planning/SKILL.md", "skills/work-review/SKILL.md", "skills/work-execution/SKILL.md", "skills/work-learning/SKILL.md",
    "references/artifact-protocol.md", "references/executable-contract.md", "references/delivery-evidence-contract.md",
    "references/learning-contract.md",
  ];
  const removed = /session-state|operational-constraints|constraint_ids|review_ready|compile-handoff|execute-handoff|review-delivery|work-delta|\/run-work/i;
  for (const path of paths) assert.doesNotMatch(read(path), removed, path);
});

test("runtime surface ships no rules, hooks, or MCP server configuration", () => {
  const manifest = JSON.parse(read(".cursor-plugin/plugin.json"));
  assert.equal("rules" in manifest, false);
  assert.equal("hooks" in manifest, false);
  assert.equal("mcpServers" in manifest, false);
});

test("local .tests scratch space remains available without becoming the Cursor harness", () => {
  assert.match(read(".gitignore"), /^\/\.tests\/$/m);
  assert.match(read("README.md"), /ignored `\.tests\/` directory for local development and scratch tests/i);
  assert.match(read("docs/release-checklist.md"), /Use only `\/private\/tmp\/cursor-plugin-harness` for functional Cursor tests/i);
});
