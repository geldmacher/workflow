import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { parseFrontmatter } from "../scripts/validate-plugin.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("explain-work is an anytime manual Ask command with a fresh inherited-model explainer", () => {
  const command = read("commands/explain-work.md");
  const skill = read("skills/work-explanation/SKILL.md");
  const runtime = `${command}\n${skill}`;
  const agent = parseFrontmatter(resolve(root, "agents/work-explainer.md"));
  assert.match(command, /Cursor Ask Mode/i);
  assert.match(command, /optional `wp-\*`|unique root/i);
  assert.match(runtime, /fresh `work-explainer`/i);
  assert.equal(agent.model, "inherit");
});

test("explanations handle missing, running, correctable, and achieved roots without becoming proof", () => {
  const runtime = [read("skills/work-explanation/SKILL.md"), read("references/explanation-contract.md"), read("agents/work-explainer.md")].join("\n");
  assert.match(runtime, /no unique root.*exact Root bytes/i);
  assert.match(runtime, /current task's native Plan context/i);
  assert.match(runtime, /not `achieved`.*preliminary/i);
  assert.match(runtime, /blockers|open/i);
  assert.match(runtime, /next safe action/i);
  for (const subject of ["intent", "architecture", "control", "data flow", "change map", "decisions", "invariants", "verification", "risks", "future changes"]) assert.match(runtime, new RegExp(subject, "i"));
  assert.match(runtime, /chat-only/i);
  assert.match(runtime, /never success evidence|never.*review result|not.*gate/i);
  assert.match(runtime, /do not.*modify|read-only/i);
  assert.match(runtime, /extensions.*opaque audit metadata/i);
  assert.match(runtime, /(?:never|do not) interpret, quote, summarize, explain, use, or pass/i);
  assert.match(runtime, /excluded from explanations and explainer handoffs/i);
});

test("review and controller handoffs explain in two layers without another model call", () => {
  const cursorReview = [read("skills/work-review/SKILL.md"), read("references/review-contract.md")].join("\n");
  const review = [cursorReview, read("targets/codex/skills/review-work/SKILL.md")].join("\n");
  const automation = read("skills/work-automation/SKILL.md");
  const explainer = read("agents/work-explainer.md");
  for (const heading of ["What was achieved", "What this means", "Verification and limits", "Technical traceability"]) {
    assert.match(`${review}\n${automation}`, new RegExp(heading, "i"));
  }
  assert.match(review, /reviewer.*not `?work-explainer`?|no `work-explainer` call/is);
  assert.match(cursorReview, /first three.*stand alone.*without.*implementation history.*code knowledge/is);
  assert.match(cursorReview, /separates executor claims from independently inspected evidence/is);
  assert.match(automation, /outer agent.*(?:never|no).*extra.*(?:phase|model call)/is);
  assert.match(automation, /Only `achieved`.*Final repository explanation/is);
  assert.match(automation, /every other state.*Preliminary explanation/is);
  assert.match(explainer, /Schema-5 Root\/Evidence\/Review chain/i);
  assert.match(explainer, /Workflow-3\/4 is read-only history/i);
  assert.doesNotMatch(explainer, /schema-3 root/i);
});
