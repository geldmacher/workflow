import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");
const agents = read("AGENTS.md");
const readme = read("README.md");
const manual = read("docs/manual-workflow.md");
const manualContract = read("references/manual-workflow-contract.md");
const correctionContract = read("references/correction-contract.md");
const planContract = read("references/plan-container-contract.md");
const planningSkill = read("skills/work-planning/SKILL.md");
const workControl = read("commands/work-control.md");

test("Manual lifecycle documentation has one correction and Review invariant", () => {
  assert.match(agents, /Plan → Implement Plan → fresh read-only Review \(atomic Evidence \+ Review\)/);
  assert.match(readme, /correction[\s\S]{0,300}finish(?:es)? normally[\s\S]{0,300}fresh Review/i);
  assert.match(manual, /correction finish(?:es)? normally[\s\S]{0,300}fresh Review/i);
  assert.match(correctionContract, /finishes normally without Evidence[\s\S]{0,300}next fresh Review/i);
  for (const source of [agents, readme, manual, manualContract, correctionContract]) {
    assert.doesNotMatch(source, /correction (?:closes out|closeout runs) automatically/i);
  }
});

test("Manual host trust and provisional acceptance boundaries stay explicit", () => {
  assert.match(manual, /Implement Plan[\s\S]{0,500}host-owned-unattested/i);
  assert.match(manual, /In Cursor[\s\S]{0,500}opaque single-use receipt/i);
  assert.match(manual, /In Codex and portable clients[^.]*exact Root and predecessor bytes/i);
  assert.doesNotMatch(manual, /Implement Plan choice binds the exact approved Root/i);
  assert.doesNotMatch(manual, /^\s*- `unapproved`:/m);

  const acceptance = `${manual}\n${manualContract}`;
  assert.match(acceptance, /accept-work provisional[\s\S]{0,500}(?:ephemeral|not persisted|not saved)/i);
  assert.match(acceptance, /provisional[\s\S]{0,500}(?:no|not)[^.]{0,120}(?:Qualification|Learning)/i);
});

test("native Plans are human-first without duplicating or overstating authority", () => {
  for (const source of [planContract, planningSkill]) {
    assert.match(source, /Quick decision[\s\S]*Details[\s\S]*Agent and machine contract \(authoritative\)/);
    assert.match(source, /(?:sole|one exact)[\s\S]{0,160}(?:Root|artifact-envelope)/i);
    assert.match(source, /(?:host-owned|host-native)[\s\S]{0,180}(?:unattested|does not claim|does not attest)/i);
  }
});

test("host availability and upgrade recovery are documented honestly", () => {
  assert.match(manual, /fail-open[\s\S]{0,500}(?:crash|timeout|missing runtime dependency|corrupt state)[\s\S]{0,300}cannot block/i);
  assert.match(manual, /Write, Shell, Task[\s\S]{0,180}(?:remain|stay)[^.]{0,80}(?:available|usable)|cannot block Write, Shell, Task/i);
  assert.match(manual, /enforcement[^.]{0,120}unavailable[\s\S]{0,220}(?:must not|cannot)[^.]{0,100}verified delivery/i);
  assert.match(manual, /5\.5\.1[\s\S]{0,500}(?:fresh|new) (?:Plan|Review)/i);
});

test("work-control documents complete copyable invocation forms", () => {
  assert.match(workControl, /<id> pause\|resume\|stop/);
  assert.match(workControl, /<id> answer <text>/);
  assert.match(workControl, /<id> accept verified\|provisional/);
});
