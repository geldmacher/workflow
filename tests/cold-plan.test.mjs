import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/build-plugin-targets.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("implementation reports an architectural mismatch instead of patching the plan", () => {
  const requirements = read("references/implementation-work.md");
  assert.match(requirements, /`any`, a forced cast, the same workaround in several places, or unplanned parameters or state/);
  assert.match(requirements, /report that deviation instead of patching it in/);
  assert.match(requirements, /usually a wrong architecture/);
  const implement = read("skills/implement-work/SKILL.md");
  assert.match(implement, /architectural stop/);
  assert.match(implement, /human-approved plan/);
  assert.match(read("skills/review-work/SKILL.md"), /`any` or a forced cast, the same workaround in several places, or parameters or state the plan did not anticipate/);
});

test("a changed interface gets a caller sketch, and an experiment replaces a risk list", () => {
  const plan = read("skills/plan-work/SKILL.md");
  assert.match(plan, /short throwaway experiment can settle an open technical question/);
  assert.match(plan, /propose it instead of a longer risk list/);
  assert.match(plan, /caller-side usage example and the key signatures/);
  assert.match(plan, /concrete target for plan-only implementation and review/);
});

test("a recurring verifier flow prefers a small control script", () => {
  const create = read("skills/verification-work/references/create.md");
  assert.match(create, /prefer a small project-specific control script to another prose recipe/);
  assert.match(create, /recipe that script's invocation/);
  assert.match(create, /`doctor` subcommand, JSON output, `--help`, `--dry-run`/);
  assert.match(create, /proportional/);
  assert.match(create, /Do not add a generic verification framework/);
});
