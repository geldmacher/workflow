import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("profile guide explains the shared core, differences, and prerequisites", () => {
  const guide = read("docs/profiles.md");
  for (const profile of ["manual", "supervised", "autonomous"]) assert.match(guide, new RegExp(`## ${profile}`, "i"));
  assert.match(guide, /same approved Intent Root.*repository boundary.*evidence rules.*fresh review/is);
  assert.match(guide, /Manual.*No automation configuration or certification/is);
  assert.match(guide, /Supervised.*A human accepts verified or explicitly provisional delivery/is);
  assert.match(guide, /Autonomous.*Complete verified evidence may reach `achieved`/is);
  assert.match(guide, /human-started fresh review completes.*achieved\/verified\/none/is);
  assert.match(guide, /Best for novel, interactive, or uncertified work/is);
  assert.match(guide, /Removes execution babysitting.*human accountability/is);
  assert.match(guide, /repeatability.*supervised proof.*earned/is);
  assert.match(guide, /Cursor exposes all three profiles.*Codex exposes the complete Manual path only/is);
  assert.match(guide, /Codex can hard-stop.*Cursor issues one bounded recovery follow-up/is);
  assert.match(guide, /Capability Receipt/i);
  assert.match(guide, /Verification Profile/i);
  assert.match(guide, /fully verified, human-accepted supervised Runs/i);
  assert.match(guide, /downgrades.*supervised/is);
  assert.match(guide, /failed Check blocks/is);
  assert.match(guide, /Shadow Mode/i);
});

test("profile guidance is linked from user entry points", () => {
  for (const path of ["README.md", "docs/overview.md", "docs/usage-example.md", "docs/configuration.md", "docs/certification-runbook.md", "docs/capability-spike.md"]) {
    assert.match(read(path), /\]\(profiles\.md\)|\]\(docs\/profiles\.md\)/, `${path} should link the profile guide`);
  }
});

test("controller commands explain requested and effective profile behavior", () => {
  const autoWork = read("commands/auto-work.md");
  const status = read("commands/work-status.md");
  assert.match(autoWork, /manual.*does not use this command/is);
  assert.match(autoWork, /supervised.*human accepts delivery/is);
  assert.match(autoWork, /autonomous.*complete verified evidence.*downgrades to `supervised`/is);
  assert.match(status, /requested_profile.*user's choice/is);
  assert.match(status, /effective_profile.*actually run/is);
  assert.match(read("commands/work-models.md"), /Manual model choice stays in Cursor.*autonomous.*Capability Receipt/is);
  assert.match(read("commands/work-verification.md"), /Manual needs no Verification Profile.*Autonomous requires/is);
  assert.match(read("commands/work-control.md"), /Supervised delivery always needs human `accept`.*autonomous.*`achieved` directly/is);
});

test("profile guide assigns human-first and agent-facing explanations across all reviewed states", () => {
  const guide = read("docs/profiles.md");
  for (const state of ["Manual `achieved`", "Manual provisional or blocked", "Supervised awaiting acceptance", "Autonomous `achieved`"]) {
    assert.match(guide, new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(guide, /first three sections tell a person.*Technical traceability.*maintainer or agent/is);
  assert.match(guide, /Supervised awaiting acceptance.*Preliminary explanation.*verified acceptance.*final/is);
  assert.match(guide, /Autonomous `achieved`.*Final repository explanation/is);
  assert.match(guide, /No row invokes.*`explainer` Pool.*separate model call/is);
  assert.match(guide, /Codex supports the two Manual rows only.*Cursor supports all four/is);
});
