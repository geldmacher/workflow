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
  const counts = new Map();
  const anchors = new Set();
  for (const line of markdown.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const base = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

test("Manual guide covers the complete user-visible vocabulary", () => {
  const expectedStates = [
    "accepted-provisional",
    "achieved",
    "blocked",
    "delivery-ready-provisional",
    "failed",
    "intent-clarification",
    "replan",
    "root-plan-review",
    "root-review",
    "stopped",
    "waiting-human",
  ];
  assert.deepEqual(Object.keys(MANUAL_STATE_HELP).sort(), expectedStates);

  const evidenceSchema = JSON.parse(read("schemas/artifacts/delivery-evidence.schema.json"));
  const reviewSchema = JSON.parse(read("schemas/artifacts/work-review.schema.json"));
  const vocabulary = [
    ...expectedStates,
    ...evidenceSchema.properties.overall_grade.enum,
    ...evidenceSchema.properties.status.enum,
    ...reviewSchema.properties.assessment.enum,
    ...reviewSchema.properties.delivery_status.enum,
    ...reviewSchema.properties.review_route.enum,
    ...reviewSchema.properties.next_action.enum,
    ...reviewSchema.properties.review_basis.enum,
    "work-plan",
    "delivery-evidence",
    "work-review",
    "correction",
    "plan-work",
    "close-work",
    "review-work",
    "correct-work",
    "accept-work",
    "work-status",
    "explain-work",
    "learn-from-work",
  ];
  for (const value of new Set(vocabulary)) {
    assert.ok(guide.includes(value), `Manual guide must explain ${value}`);
  }
});

test("every help topic uses the stable public guide contract and a real anchor", () => {
  const anchors = markdownAnchors(guide);
  const entries = [
    ...Object.values(MANUAL_HELP_TOPICS),
    ...Object.values(MANUAL_STATE_HELP),
    ...Object.values(MANUAL_EVIDENCE_HELP),
  ];
  const topics = new Set();
  for (const entry of entries) {
    assert.equal(entry.label, MANUAL_GUIDE_LABEL);
    assert.ok(entry.topic.length > 0);
    assert.ok(entry.meaning.length > 0);
    assert.ok(entry.meaning.length <= 220, `${entry.topic} meaning must stay concise`);
    assert.match(entry.meaning, /\.$/);
    assert.ok(entry.url.startsWith(`${MANUAL_GUIDE_URL}#`));
    const anchor = entry.url.slice(entry.url.indexOf("#") + 1);
    assert.ok(anchors.has(anchor), `${entry.topic} must resolve to #${anchor}`);
    assert.equal(topics.has(entry.topic), false, `duplicate help topic ${entry.topic}`);
    topics.add(entry.topic);
  }
});

test("repository entry points and Manual contracts reference the canonical guide", () => {
  for (const path of ["README.md", "docs/overview.md", "docs/usage-example.md", "targets/codex/README.md"]) {
    assert.match(read(path), /manual-workflow\.md/, `${path} must link the Manual guide`);
  }
  for (const path of [
    "references/manual-workflow-contract.md",
    "references/manual-mcp-output-contract.md",
    "references/state-contract.md",
    "references/review-contract.md",
    "references/delivery-evidence-output-contract.md",
    "references/learning-contract.md",
  ]) {
    assert.ok(read(path).includes(MANUAL_GUIDE_URL), `${path} must use the public guide URL`);
  }
  assert.match(read("references/manual-mcp-output-contract.md"), /help: \{ topic, meaning, label, url \}/);
});

test("Manual guidance explains invisible host receipts, human recovery, and proportional quality signals", () => {
  for (const token of [
    "Constraint loop and host receipts",
    "Preflight",
    "Mutation gate",
    "In-loop feedback",
    "Delivery boundary",
    "What happened",
    "Human attention",
    "Problems",
    "24 hours",
    "raw command output",
  ]) assert.match(guide, new RegExp(token, "i"));
  assert.match(guide, /does not enter a hash.*copy terminal output.*another Workflow command/is);
  assert.match(guide, /correctness.*security.*maintainability.*performance.*efficiency.*comprehensibility/is);
  assert.match(guide, /does not require all six/is);
  assert.match(read("skills/work-execution/SKILL.md"), /exact standalone planned command\/directory.*leading `rtk`/is);
  assert.match(read("skills/work-review/SKILL.md"), /constraint_summary.*human_attention.*problem_details/is);
  assert.match(read("skills/work-review/SKILL.md"), /root-boundary.*latest_evidence_id: null.*insufficient-evidence\/blocked\/replan/is);
  assert.match(read("references/manual-mcp-output-contract.md"), /journey_state.*primary_action.*technical_traceability/is);
  assert.match(read("references/manual-workflow-contract.md"), /fresh host receipt bound to exact Root.*repository snapshot/is);
});
