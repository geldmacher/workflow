import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  MANUAL_EVIDENCE_HELP,
  MANUAL_GUIDE_LABEL,
  MANUAL_GUIDE_URL,
  MANUAL_HELP_TOPICS,
  MANUAL_STATE_HELP,
} from "../src/mcp/manual-presentation.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(join(root, path), "utf8");
const guide = read("docs/manual-workflow.md");

function markdownAnchors(markdown) {
  const anchors = new Set();
  for (const line of markdown.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    anchors.add(match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-"));
  }
  return anchors;
}

test("Manual guide describes the stable native Plan, implementation, Review flow", () => {
  for (const value of [
    "native Plan -> Implement Plan -> fresh Review",
    "sole Manual plan authority",
    "finish normally",
    "atomically",
    "resolved",
    "unavailable",
    "ambiguous",
    "High-risk",
    "accepted-provisional",
    "legacy runtime files",
  ]) assert.match(guide, new RegExp(value, "i"));
  assert.doesNotMatch(guide, /\/(?:close-work)\b|\$(?:close-work)\b/);
  assert.match(guide, /restore the Plan in this task or create and approve a new native Plan/i);
  assert.match(guide, /correctness.*security.*maintainability.*performance.*efficiency.*comprehensibility/is);
  assert.match(guide, /do not require all six/i);
});

test("every help topic uses the stable public guide contract and a real anchor", () => {
  const anchors = markdownAnchors(guide);
  const topics = new Set();
  for (const entry of [
    ...Object.values(MANUAL_HELP_TOPICS),
    ...Object.values(MANUAL_STATE_HELP),
    ...Object.values(MANUAL_EVIDENCE_HELP),
  ]) {
    assert.equal(entry.label, MANUAL_GUIDE_LABEL);
    assert.ok(entry.meaning.length > 0 && entry.meaning.length <= 220);
    assert.match(entry.meaning, /\.$/);
    assert.ok(entry.url.startsWith(`${MANUAL_GUIDE_URL}#`));
    assert.ok(anchors.has(entry.url.split("#")[1]), `${entry.topic} anchor must exist`);
    assert.equal(topics.has(entry.topic), false, `duplicate help topic ${entry.topic}`);
    topics.add(entry.topic);
  }
});

test("repository entry points and native Manual contracts reference the canonical guide", () => {
  for (const path of ["README.md", "docs/overview.md", "docs/usage-example.md", "targets/codex/README.md"]) {
    assert.match(read(path), /manual-workflow\.md/);
  }
  for (const path of [
    "references/manual-workflow-contract.md",
    "references/state-contract.md",
    "references/review-contract.md",
    "references/work-review-input-contract.md",
    "references/delivery-evidence-output-contract.md",
    "references/learning-contract.md",
  ]) assert.ok(read(path).includes(MANUAL_GUIDE_URL), `${path} must use the public guide URL`);
});

test("skills preserve fresh observation, human authority, and read-only Review", () => {
  assert.match(read("skills/work-planning/SKILL.md"), /native Plan as the sole plan container/is);
  assert.match(read("skills/work-execution/SKILL.md"), /Finish normally.*Do not call closeout/is);
  assert.match(read("skills/work-review/SKILL.md"), /directly observed.*exactly once.*Evidence and Work Review together or neither/is);
  assert.match(read("references/manual-workflow-contract.md"), /failed required Check.*completed blocked Review/is);
});
