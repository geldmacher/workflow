import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
import {
  handoffTipPath,
  legacyHandoffTipPath,
  rootContentHash,
} from "../src/core/state-paths.mjs";

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
    rememberContentAddressedRoot(rootB, defaultRoot);
    assert.equal(existsSync(handoffTipPath("wp-adaptive-retry", rootContentHash(rootA))), true);
    assert.equal(existsSync(handoffTipPath("wp-adaptive-retry", rootContentHash(rootB))), true);
    assert.throws(() => resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry" }), /ambiguous/);
    assert.equal(resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry", rootPlan: rootA }), rootA);
    assert.equal(resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry", rootPlan: rootB }), rootB);
  } finally {
    if (previousHome === undefined) delete process.env.GELDMACHER_WORKFLOW_HOME;
    else process.env.GELDMACHER_WORKFLOW_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test("unique Multi-Tip and legacy single-tip remain readable for ID-only lookup", () => {
  const previousHome = process.env.GELDMACHER_WORKFLOW_HOME;
  const homes = [];
  try {
    const root = fixture("work-plan.valid.md");
    const uniqueHome = mkdtempSync(join(tmpdir(), "workflow-content-tip-"));
    homes.push(uniqueHome);
    process.env.GELDMACHER_WORKFLOW_HOME = uniqueHome;
    const uniqueStore = createContentAddressedHandoffStore(root, defaultRoot);
    uniqueStore.record([{ label: "root", text: root }]);
    rememberContentAddressedRoot(root, defaultRoot);
    assert.equal(resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry" }), root);

    const legacyHome = mkdtempSync(join(tmpdir(), "workflow-legacy-tip-"));
    homes.push(legacyHome);
    process.env.GELDMACHER_WORKFLOW_HOME = legacyHome;
    const store = createContentAddressedHandoffStore(root, defaultRoot);
    store.record([{ label: "root", text: root }]);
    mkdirSync(join(legacyHome, "handoff", "tips"), { recursive: true, mode: 0o700 });
    writeFileSync(legacyHandoffTipPath("wp-adaptive-retry"), `${JSON.stringify({
      handoff_tip_schema: 1,
      root_plan_id: "wp-adaptive-retry",
      root_content_hash: rootContentHash(root),
      text_hash: createHash("sha256").update(root).digest("hex"),
      updated_at: "2026-08-01T00:00:00.000Z",
    }, null, 2)}\n`);
    assert.equal(resolveRootPlanText(defaultRoot, { rootPlanId: "wp-adaptive-retry" }), root);
    assert.equal(existsSync(legacyHandoffTipPath("wp-adaptive-retry")), true);
  } finally {
    if (previousHome === undefined) delete process.env.GELDMACHER_WORKFLOW_HOME;
    else process.env.GELDMACHER_WORKFLOW_HOME = previousHome;
    for (const home of homes) rmSync(home, { recursive: true, force: true });
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

test("handoff context never mutates a missing or corrupt index", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-handoff-readonly-"));
  try {
    const store = new ArtifactHandoffStore(state, defaultRoot);
    const root = fixture("work-plan.valid.md");
    store.record([{ label: "root", text: root }]);
    const indexPath = store.indexPath();
    rmSync(indexPath, { force: true });
    assert.equal(existsSync(indexPath), false);
    const context = store.context("wp-adaptive-retry", root);
    assert.equal(context.artifacts.length, 1);
    assert.equal(existsSync(indexPath), false);

    writeFileSync(indexPath, "{ corrupt\n");
    const before = statSync(indexPath);
    const again = store.context("wp-adaptive-retry", root);
    assert.equal(again.artifacts.length, 1);
    const after = statSync(indexPath);
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(readFileSync(indexPath, "utf8"), "{ corrupt\n");

    store.record([{ label: "root-again", text: root }]);
    assert.equal(existsSync(indexPath), true);
    assert.deepEqual(JSON.parse(readFileSync(indexPath, "utf8")).entries.map((entry) => entry.artifact_id), ["wp-adaptive-retry"]);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});
