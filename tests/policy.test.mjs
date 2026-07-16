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
    "commands/plan-work.md", "commands/review-work.md", "commands/correct-work.md",
    "skills/work-planning/SKILL.md", "skills/work-review/SKILL.md", "skills/work-execution/SKILL.md",
    "references/artifact-protocol.md", "references/executable-contract.md", "references/delivery-evidence-contract.md",
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
