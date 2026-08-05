import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { ArtifactHandoffStore } from "../src/controller/artifact-handoff.mjs";

const artifact = (name) => ({ label: name, text: readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", name), "utf8") });

test("Cursor and Codex read and extend the same immutable Schema-5 chain", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-interoperability-"));
  try {
    const cursor = new ArtifactHandoffStore(state, defaultRoot);
    const codex = new ArtifactHandoffStore(state, defaultRoot);
    cursor.record([artifact("work-plan.valid.md"), artifact("delivery-evidence.valid.md"), artifact("work-review.valid.md")]);
    assert.equal(codex.context("wp-adaptive-retry").review_tip, "wr-adaptive-retry");
    const codexReview = artifact("work-review.valid.md");
    codexReview.label = "codex-review";
    codexReview.text = codexReview.text
      .replace("id: wr-adaptive-retry", "id: wr-adaptive-retry-codex")
      .replace("predecessor_review_id: null", "predecessor_review_id: wr-adaptive-retry");
    codex.record([codexReview]);
    const returned = cursor.context("wp-adaptive-retry");
    assert.equal(returned.evidence_tip, "de-adaptive-retry");
    assert.equal(returned.review_tip, "wr-adaptive-retry-codex");
  } finally { rmSync(state, { recursive: true, force: true }); }
});
