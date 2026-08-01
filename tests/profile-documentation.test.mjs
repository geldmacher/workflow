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
  assert.match(guide, /Supervised.*human accepts every final delivery/is);
  assert.match(guide, /Autonomous.*fully verified delivery can complete without a final human acceptance/is);
  assert.match(guide, /Capability Receipt/i);
  assert.match(guide, /Verification Profile/i);
  assert.match(guide, /accepted verified supervised history/i);
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
