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
    assert.match(text, new RegExp(`\\[${skill}\\]\\([^)]*SKILL\\.md\\).*completely`, "i"));
    assert.doesNotMatch(text, /MODE (?:GATE|PREREQUISITE)|MODE REQUIRED:|edit\+terminal|native Plan creation exists/i);
  }
});

test("review permits Cursor-provided inspection capabilities including MCP", () => {
  const runtime = [read("commands/review-work.md"), read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  assert.match(runtime, /fresh Cursor Ask context/i);
  assert.match(runtime, /do not inherit Writer assumptions/i);
  assert.match(runtime, /MCP/);
  assert.match(runtime, /browser|documentation/i);
  assert.match(runtime, /subagents/i);
  assert.doesNotMatch(runtime, /use only Read\/Search|never shell|never.*Git|tool allowlist/i);
  assert.match(runtime, /Cursor.*capabilit/i);
});

test("manual artifact consumers resolve semantically rather than by filename", () => {
  const protocolConsumers = {
    review: ["skills/work-review/SKILL.md", "references/artifact-protocol.md"],
    correction: ["skills/work-execution/SKILL.md", "references/artifact-protocol.md"],
    learning: ["skills/work-learning/SKILL.md", "references/artifact-protocol.md"],
    explanation: ["skills/work-explanation/SKILL.md", "references/explanation-contract.md"],
  };
  for (const [name, paths] of Object.entries(protocolConsumers)) {
    const runtime = paths.map(read).join("\n");
    assert.match(runtime, /(?:Artifacts )?resolve by `artifact`, never filename/i, name);
  }
});

test("planning preserves intent, assurance, and native human approval", () => {
  const runtime = [read("commands/plan-work.md"), read("skills/work-planning/SKILL.md"), read("references/executable-contract.md"), read("references/plan-container-contract.md")].join("\n");
  assert.match(runtime, /Intent Readiness, not broad brainstorming/);
  assert.match(runtime, /(?:use|invoke) the ask question tool/i);
  assert.match(runtime, /at most three related (?:decision )?questions/i);
  assert.match(runtime, /wait for the (?:human )?answer/i);
  assert.match(runtime, /no plan or (?:plan )?draft/i);
  assert.match(runtime, /clear (?:goal|intent).*without an (?:unnecessary )?interview/i);
  assert.match(runtime, /blocking prose fallback/i);
  assert.match(runtime, /human answer.*(?:source.*DEC-|DEC-.*source)/i);
  assert.match(runtime, /do not load detailed planning contracts, schemas, fixtures, example plans, or assurance boilerplate/i);
  assert.match(runtime, /never search repository\/plugin text.*discover(?: or probe)? (?:the|that) tool/i);
  assert.match(runtime, /(?:only )?(?:when|if) Cursor does not expose the tool or rejects (?:it|its invocation)/i);
  assert.match(runtime, /Before (?:calling )?`CreatePlan`, self-check all eight Root Planning areas/i);
  for (const area of ["Intent and decisions", "Objectives", "Evidence and baseline", "Scope and targets", "Execution steps", "Verification", "Operational readiness", "Risk and closeout"]) {
    assert.match(runtime, new RegExp(area, "i"));
  }
  assert.match(runtime, /yaml artifact-envelope/i);
  assert.match(runtime, /canonical (?:H2 and table form|envelope and tables)/i);
  assert.match(runtime, /exact, unnumbered H2 names/i);
  assert.match(runtime, /Readiness item \| Resolution \| Evidence/i);
  assert.match(runtime, /Step ID \| Objectives \| Targets \| Required outcome/i);
  assert.match(runtime, /Verification: `Check ID \| Objectives \| Working Directory/i);
  assert.match(runtime, /Each Objective maps to at least one outcome-oriented step, Completion Probe, and required Root Check/i);
  assert.match(runtime, /hard trigger forces deep/i);
  assert.match(runtime, /Lowering still requires an explicit human DEC/i);
  assert.match(runtime, /Implement Plan.*(?:approves|approval for) initial (?:manual )?execution/i);
  assert.match(runtime, /Push, PR, merge, deploy, production access/i);
  assert.doesNotMatch(runtime, /probe (?:for|whether).*ask question|require only the ask question tool|disable.*capabilit/i);
});

test("correction uses available Agent capabilities and keeps semantic preflight", () => {
  const runtime = [read("commands/correct-work.md"), read("skills/work-execution/SKILL.md")].join("\n");
  assert.match(runtime, /accepts no arguments/);
  assert.match(runtime, /satisfied\|pending\|partial\|conflicted/);
  assert.match(runtime, /verification-only/i);
  assert.match(runtime, /validator when (?:readily )?available/i);
  assert.match(runtime, /check root, chain, scope, reuse, risk, and approval/i);
  assert.doesNotMatch(runtime, /Require Agent Mode with edit\+terminal|unique OS-temp|Evidence is chat-only/i);
});

test("effective manual phases retain schema, authorization, and repository boundaries", () => {
  const phases = {
    plan: ["commands/plan-work.md", "skills/work-planning/SKILL.md", "references/executable-contract.md", "references/plan-container-contract.md"],
    review: ["commands/review-work.md", "skills/work-review/SKILL.md", "references/artifact-protocol.md", "references/delivery-evidence-contract.md", "references/review-contract.md"],
    correction: ["commands/correct-work.md", "skills/work-execution/SKILL.md", "references/artifact-protocol.md", "references/correction-contract.md", "references/delivery-evidence-contract.md", "references/delivery-evidence-output-contract.md"],
    learning: ["commands/learn-from-work.md", "skills/work-learning/SKILL.md", "references/artifact-protocol.md", "references/learning-contract.md"],
  };
  for (const [name, paths] of Object.entries(phases)) {
    const runtime = paths.map(read).join("\n");
    assert.match(runtime, /schema[- ]3/i, name);
    assert.match(runtime, /schema-2|mixed/i, name);
    assert.match(runtime, /scope|project-guidance/i, name);
    assert.match(runtime, /risk|bounded project-guidance/i, name);
    assert.match(runtime, /push, PR, merge, deploy/i, name);
  }
  assert.match(phases.plan.map(read).join("\n"), /Implement Plan.*(?:approval|approves)/i);
  assert.match(phases.review.map(read).join("\n"), /never authorizes correction execution/i);
  assert.match(phases.correction.map(read).join("\n"), /Invocation approves only the newest unique actionable correction/i);
  assert.match(phases.learning.map(read).join("\n"), /human authorization for bounded project-guidance edits/i);
});

test("automation keeps exact routing fail-closed", () => {
  const runtime = [
    read("skills/work-automation/SKILL.md"),
    read("references/automation-contract.md"),
    read("references/automation-preparation-contract.md"),
    read("references/model-routing-contract.md"),
  ].join("\n");
  assert.match(runtime, /fallback: deny/i);
  assert.match(runtime, /waiting-human/i);
  assert.match(runtime, /exact.*model|model.*exact/i);
});

test("learning closeout directly persists only confirmed project guidance", () => {
  const runtime = [
    read("commands/learn-from-work.md"),
    read("skills/work-learning/SKILL.md"),
    read("references/learning-contract.md"),
    read("skills/work-review/SKILL.md"),
    read("skills/work-execution/SKILL.md"),
  ].join("\n");
  assert.match(runtime, /(?:all|entire) trailing (?:command )?text.*one supplemental/i);
  assert.match(runtime, /exactly one (?:valid )?root/i);
  assert.match(runtime, /complete .*evidence.*subject_id/i);
  assert.match(runtime, /current repository inspection/i);
  assert.match(runtime, /smallest (?:direct change|update|type-specific component)/i);
  assert.match(runtime, /docs\/workflow-learnings\.md/i);
  assert.match(runtime, /applied\|already-covered\|skipped-unconfirmed\|needs-clarification/i);
  assert.match(runtime, /(?:do not|never) (?:change|modify|materialize).*product source/i);
  assert.match(runtime, /(?:do not|never) materialize (?:correction )?learning candidates(?: during correction)?/i);
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
  assert.match(runtime, /Prefer a component.*docs.*triggered.*reusable.*delegable/i);
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

test("manual components treat artifact extensions as opaque and non-authoritative", () => {
  const protocol = read("references/artifact-protocol.md");
  const planner = read("skills/work-planning/SKILL.md");
  const consumers = [
    "skills/work-review/SKILL.md",
    "skills/work-execution/SKILL.md",
    "skills/work-learning/SKILL.md",
    "agents/work-plan-auditor.md",
    "agents/work-design-auditor.md",
    "agents/delivery-auditor.md",
    "agents/risk-auditor.md",
  ].map(read).join("\n");
  assert.match(protocol, /opaque audit metadata/i);
  assert.match(protocol, /never interpret, quote, summarize, explain, use for a decision, or pass its contents to a subagent/i);
  assert.match(planner, /Do not invent `extensions`/i);
  assert.match(planner, /preserve existing values as opaque audit metadata/i);
  assert.match(planner, /without interpreting, quoting, summarizing, explaining, or passing their contents/i);
  assert.match(consumers, /artifact-protocol\.md/i);
  for (const phrase of ["Ignore `extensions` completely", "Ignore artifact `extensions` completely"]) {
    assert.match(consumers, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("runtime surface contains no retired protocol or branding", () => {
  const paths = [
    "README.md",
    "commands/plan-work.md", "commands/review-work.md", "commands/correct-work.md", "commands/learn-from-work.md",
    "skills/work-planning/SKILL.md", "skills/work-review/SKILL.md", "skills/work-execution/SKILL.md", "skills/work-learning/SKILL.md",
    "references/artifact-protocol.md", "references/executable-contract.md", "references/delivery-evidence-contract.md",
    "references/learning-contract.md",
  ];
  const removed = /operational-constraints|constraint_ids|review_ready|compile-handoff|execute-handoff|review-delivery|work-delta|\/run-work/i;
  for (const path of paths) assert.doesNotMatch(read(path), removed, path);
  assert.match(read("README.md"), /no repository `session-state` artifact/i);
});

test("runtime surface ships no rules or hooks and uses only the bundled MCP controller", () => {
  const manifest = JSON.parse(read(".cursor-plugin/plugin.json"));
  assert.equal("rules" in manifest, false);
  assert.equal("hooks" in manifest, false);
  assert.equal(manifest.mcpServers, "mcp.json");
  const mcp = read("mcp.json");
  assert.match(mcp, /\$\{CURSOR_PLUGIN_ROOT\}\/dist\/workflow-mcp\.mjs/);
  assert.doesNotMatch(mcp, /npx|latest/i);
});

test("local .tests scratch space remains available without becoming the Cursor harness", () => {
  assert.match(read(".gitignore"), /^\/\.tests\/$/m);
  assert.match(read("README.md"), /ignored `\.tests\/` directory for local development and scratch tests/i);
  assert.match(read("docs/release-checklist.md"), /Use only `\/private\/tmp\/cursor-plugin-harness` for functional Cursor tests/i);
});
