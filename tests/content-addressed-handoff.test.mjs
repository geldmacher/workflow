import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText,
} from "../src/controller/artifact-handoff.mjs";
import { migrateCursorHandoff } from "../src/core/handoff-migration.mjs";
import { rootContentHash } from "../src/core/state-paths.mjs";

const fixture = (name) => readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", name), "utf8");

test("content-addressed handoff isolates identical artifact IDs with different Root text", () => {
  const previousHome = process.env.GELDMACHER_WORKFLOW_HOME;
  const home = mkdtempSync(join(tmpdir(), "workflow-content-handoff-"));
  process.env.GELDMACHER_WORKFLOW_HOME = home;
  try {
    const rootA = fixture("work-plan.valid.md");
    const rootB = rootA.replace("Make retry handling deterministic", "Make retry handling observable");
    assert.notEqual(rootContentHash(rootA), rootContentHash(rootB));
    const storeA = createContentAddressedHandoffStore(rootA, defaultRoot);
    const storeB = createContentAddressedHandoffStore(rootB, defaultRoot);
    storeA.record([{ label: "root", text: rootA }]);
    storeB.record([{ label: "root", text: rootB }]);
    assert.equal(storeA.context("wp-adaptive-retry", rootA).artifacts[0].text, rootA);
    assert.equal(storeB.context("wp-adaptive-retry", rootB).artifacts[0].text, rootB);
    assert.throws(() => storeA.context("wp-adaptive-retry", rootB), /conflicts with the immutable handoff Root/);
    rememberContentAddressedRoot(rootA, defaultRoot);
    assert.throws(() => rememberContentAddressedRoot(rootB, defaultRoot), /conflicts with a different Root text hash/);
    assert.equal(resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry" }), rootA);
  } finally {
    if (previousHome === undefined) delete process.env.GELDMACHER_WORKFLOW_HOME;
    else process.env.GELDMACHER_WORKFLOW_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("content-addressed migration partitions legacy repository-key chains without deleting source", () => {
  const previousHome = process.env.GELDMACHER_WORKFLOW_HOME;
  const home = mkdtempSync(join(tmpdir(), "workflow-content-migrate-"));
  process.env.GELDMACHER_WORKFLOW_HOME = home;
  try {
    const sourceRoot = join(home, "legacy-source");
    const source = new ArtifactHandoffStore(sourceRoot, defaultRoot);
    const chain = ["work-plan.valid.md", "delivery-evidence.valid.md", "work-review.valid.md"].map((name) => ({
      label: name,
      text: fixture(name),
    }));
    source.record(chain);
    const first = migrateCursorHandoff({ sourceRoot, pluginRoot: defaultRoot, contentAddressed: true });
    assert.equal(first.duplicate_import, false);
    assert.equal(first.namespaces.length, 1);
    assert.equal(first.namespaces[0].root_plan_id, "wp-adaptive-retry");
    const repeat = migrateCursorHandoff({ sourceRoot, pluginRoot: defaultRoot, contentAddressed: true });
    assert.equal(repeat.duplicate_import, true);
    assert.equal(source.context("wp-adaptive-retry").artifacts.length, 3);
    const resolved = resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry" });
    assert.equal(resolved, chain[0].text);
  } finally {
    if (previousHome === undefined) delete process.env.GELDMACHER_WORKFLOW_HOME;
    else process.env.GELDMACHER_WORKFLOW_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
});
