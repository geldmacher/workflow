import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("engineering-work is one confirmed non-authoritative Gateway", () => {
  const skill = read("skills/engineering-work/SKILL.md");
  assert.match(skill, /\$engineering-work suggest.*read-only/is);
  assert.match(skill, /recommend exactly one playbook/i);
  assert.match(skill, /\$engineering-work use <playbook-id>.*human confirmation/is);
  assert.match(skill, /If no invocation verb is supplied, perform `suggest` only/i);
  assert.match(skill, /never enter Root, Evidence, Review, PhaseRequest, PhaseResult/i);
  assert.match(skill, /mutating playbook requires an exact approved Schema-6 Root/i);
  assert.doesNotMatch(skill, /gpt-|claude|grok|model pool|command allowlist/i);
});

test("plan-work facades require one fresh inline playbook decision", () => {
  const facades = [
    "skills/work-planning/SKILL.md",
    "targets/codex/skills/plan-work/SKILL.md",
    "targets/agent-plugins/skills/plan-work/SKILL.md",
  ].map(read);
  for (const facade of facades) {
    assert.match(facade, /recommend exactly one closest playbook/i);
    assert.match(facade, /ID, fit, intended phase, and authority need/i);
    assert.match(facade, /ask and wait for (?:an|one) explicit inline confirm or decline/i);
    assert.match(facade, /explicit inline confirm or decline/i);
    assert.match(facade, /Decline continues without a playbook/i);
    assert.match(facade, /material intent change.*fresh suggestion/i);
    assert.match(facade, /human trace.*outside/i);
  }
});

test("inline confirmation stays optional, pending, and non-sticky", () => {
  const gateways = [
    "skills/engineering-work/SKILL.md",
    "targets/codex/skills/engineering-work/SKILL.md",
    "targets/agent-plugins/skills/engineering-work/SKILL.md",
  ].map(read);
  for (const gateway of gateways) {
    assert.match(gateway, /plan-work.*explicit confirmation or decline inline/is);
    assert.match(gateway, /needs no second `use`/i);
    assert.match(gateway, /pending methodology until the exact Root is approved/i);
    assert.match(gateway, /material intent change or missing human trace.*fresh suggestion/i);
  }
  assert.match(read("references/plan-container-contract.md"), /exact Root alone carries no playbook choice/i);
  assert.match(read("references/engineering-playbooks.md"), /waits for an explicit inline confirm or decline before the final Root/i);
});

test("engineering-work exposes exactly the curated Workflow-adapted catalog", () => {
  const catalog = read("references/engineering-playbooks.md");
  const ids = [...catalog.matchAll(/^\| `([a-z][a-z-]+)` \|/gm)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "investigation",
    "runtime-forensics",
    "trace-forensics",
    "bug-fix",
    "feature",
    "refactoring",
    "performance",
    "hillclimb",
    "prototype",
    "visual-parity",
    "skill-authoring",
    "evaluation",
    "session-pickup",
    "pause-safely",
  ]);
  for (const excluded of ["babysit", "shipping", "autopilot-full", "autopilot-stack", "worktree-cleanup"]) {
    assert.equal(ids.includes(excluded), false);
  }
  assert.match(catalog, /commit `bdf7aa355337897f167153e05069aca505dae17c`/);
});

test("playbook leaf contracts preserve delivery, authority, and continuity boundaries", () => {
  const diagnostic = read("references/engineering-diagnostic-playbooks.md");
  const delivery = read("references/engineering-delivery-playbooks.md");
  const continuity = read("references/engineering-continuity-playbooks.md");
  assert.match(diagnostic, /repository-read-only/);
  assert.match(delivery, /requires an approved Schema-6 Root and implementation authority/);
  assert.match(delivery, /prototype.*never delivery/is);
  assert.match(delivery, /hillclimb.*budget.*stop predicate/is);
  assert.match(delivery, /evaluation.*hidden from the judge/is);
  assert.match(continuity, /transcripts and notes as context only/i);
  assert.match(continuity, /Do not commit, push, publish, open a PR/i);
  assert.doesNotMatch(`${diagnostic}\n${delivery}\n${continuity}`, /gpt-|claude|grok|npm run|git add/i);
});

test("authoritative Schema-6 and harness contracts contain no playbook policy", () => {
  const authoritative = [
    "schemas/artifacts/work-plan-6.schema.json",
    "schemas/artifacts/delivery-evidence-6.schema.json",
    "schemas/artifacts/work-review-6.schema.json",
    "schemas/harness-phase-request.schema.json",
    "schemas/harness-phase-result.schema.json",
  ].map(read).join("\n");
  assert.doesNotMatch(authoritative, /playbook|engineering-work|engineering_work/i);
});

test("pstack methodology provenance ships with the plugin notice", () => {
  const notice = read("THIRD_PARTY_NOTICES.md");
  assert.match(notice, /pstack engineering playbooks/i);
  assert.match(notice, /bdf7aa355337897f167153e05069aca505dae17c/);
  assert.match(notice, /create-verification-skill/);
  assert.match(notice, /maintain-verification-skill/);
  assert.match(notice, /93b00b89ef425a9c1bac0d0b317dfc49c930ac99/);
  assert.match(notice, /Copyright \(c\) 2026 Lauren Tan/);
});
