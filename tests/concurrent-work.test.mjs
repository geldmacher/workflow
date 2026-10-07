import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, publicSkills } from "../scripts/build-plugin-targets.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("concurrent work is a shared reference, not a new skill or a mandatory worktree", () => {
  assert.ok(!publicSkills.includes("worktree-isolation"));
  assert.ok(!publicSkills.includes("reconcile-worktree"));
  const reference = read("references/concurrent-work.md");
  for (const phrase of ["Continue carefully", "**Wait.**", "**Isolate.**", "does not lock the repository", "git worktree add -b", "Reconcile or abandon", "cold-start record", "A clean idle worktree is not overlap.", "Commits that only exist on its branch do not count.", "workspace outside the current checkout", "Use the first matching rule.", "as its workspace", "first implementation step", "whether the other owner and the overlapping files are clear", "A missing clarity field is a pause"]) {
    assert.ok(reference.includes(phrase), phrase);
  }
  assert.match(read("skills/plan-work/SKILL.md"), /clean sole checkout needs no worktree/);
  assert.match(read("skills/plan-work/SKILL.md"), /clean idle worktree is not another workstream/);
  assert.match(read("skills/auto-work/references/reviewer.md"), /as its workspace/);
  for (const path of [
    "skills/plan-work/SKILL.md",
    "skills/review-work/SKILL.md",
    "skills/correct-work/SKILL.md",
    "skills/implement-work/SKILL.md",
    "skills/learn-from-work/SKILL.md",
    "skills/verification-work/SKILL.md",
    "references/implementation-work.md",
    "skills/auto-work/references/reviewer.md",
    "skills/engineering-work/references/session-pickup.md",
    "skills/engineering-work/references/pause-safely.md",
    "skills/engineering-work/references/hillclimb.md",
  ]) assert.match(read(path), /concurrent-work\.md/, path);
  assert.match(read("skills/auto-work/references/operation.md"), /continue, wait, or isolate/);
  assert.match(read("skills/work-status/SKILL.md"), /whether reconcile is still open/);
});
