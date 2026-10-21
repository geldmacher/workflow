import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/build-plugin-targets.mjs";

const read = (path) => readFileSync(join(defaultRoot, path), "utf8");

test("implementation reports an architectural mismatch instead of patching the plan", () => {
  const requirements = read("references/implementation-work.md");
  assert.match(requirements, /`any` or a forced cast, repeating the same workaround in several places/);
  assert.match(requirements, /parameters or state the plan did not anticipate/);
  assert.match(requirements, /report that as a deviation from the plan instead of patching it in/);
  assert.match(requirements, /those signs usually mean the architecture is wrong/);
  assert.match(requirements, /Before the first edit/);
  assert.match(requirements, /without requesting another phase assignment/);
  const implement = read("skills/implement-work/SKILL.md");
  assert.match(implement, /`any` or a forced cast, the same workaround in several places/);
  assert.match(implement, /report that deviation from the plan instead of patching it in/);
  assert.match(implement, /human-approved plan/);
  assert.match(implement, /separately commissioned Review/);
  assert.match(implement, /Auto-Work sequence/);
  assert.match(read("skills/review-work/SKILL.md"), /`any` or a forced cast, the same workaround in several places, or parameters or state the plan did not anticipate/);
  assert.match(read("skills/review-work/SKILL.md"), /recommendation for the human/);
});

test("a changed interface gets a caller sketch, and an experiment replaces a risk list", () => {
  const plan = read("skills/plan-work/SKILL.md");
  assert.match(plan, /short throwaway experiment can settle an open technical question/);
  assert.match(plan, /propose that experiment instead of lengthening the plan with a risk list/);
  assert.match(plan, /usage example from the caller's side and the key signatures/);
  assert.match(plan, /later implementation that has only the plan has a concrete target/);
  assert.match(plan, /A small change may need only a few paragraphs/);
  assert.match(plan, /descriptively titled plan/);
  assert.match(plan, /advance design of routine details/);
  assert.match(plan, /does not start a separate planning phase/);
});

test("a recurring verifier flow prefers a small control script", () => {
  const create = read("skills/verification-work/references/create.md");
  assert.match(create, /control script covers the flow, the recipe is its invocation/);
  assert.match(create, /usually a better lever than another prose recipe/);
  assert.match(create, /`doctor` subcommand, JSON output, `--help`, `--dry-run`/);
  assert.match(create, /proportional to the surface/);
  assert.match(create, /Headings can follow the product's conventions/);
  assert.match(create, /concrete driving recipe/);
  assert.match(create, /Do not add a generic verification framework/);
});
