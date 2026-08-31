import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  readHandoffTip,
  rememberContentAddressedRoot,
  resolveRootPlanText,
} from "../src/controller/artifact-handoff.mjs";
import {
  handoffTipPath,
  rootContentHash,
} from "../src/core/state-paths.mjs";
import { nativePlan } from "./support/workflow-fixtures.mjs";

const fixture = (name) => readFileSync(join(defaultRoot, "tests", "fixtures", "artifacts", name), "utf8");

test("content-addressed handoff isolates identical artifact IDs with different Root text", () => {
  const previousHome = process.env.GELDMACHER_WORKFLOW_HOME;
  const home = mkdtempSync(join(tmpdir(), "workflow-content-handoff-"));
  process.env.GELDMACHER_WORKFLOW_HOME = home;
  try {
    const rootA = fixture("work-plan.valid.md");
    const rootB = nativePlan("manual", { goal: "Implement adaptive retry handling with a separately bound alternate intent." });
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

test("handoff transport counter-probes require exact valid Root identity", () => {
  const previousHome = process.env.GELDMACHER_WORKFLOW_HOME;
  const home = mkdtempSync(join(tmpdir(), "workflow-content-counter-"));
  process.env.GELDMACHER_WORKFLOW_HOME = home;
  try {
    const root = fixture("work-plan.valid.md");
    assert.equal(resolveRootPlanText(defaultRoot, { artifacts: [{ label: "root", text: root }] }), root);
    assert.throws(() => resolveRootPlanText(defaultRoot, { rootPlan: "not a Root" }), /exact Root text is invalid/);
    assert.throws(() => resolveRootPlanText(defaultRoot, { rootPlanId: "wp-other", rootPlan: root }), /Root ID mismatch/);
    assert.throws(() => resolveRootPlanText(defaultRoot, {}), /exact Root text is required/);

    const store = new ArtifactHandoffStore(join(home, "store"), defaultRoot);
    assert.deepEqual(store.records(), []);
    assert.throws(() => store.artifactPath("invalid"), /invalid handoff artifact ID/);
    assert.throws(() => store.record([]), /1\.\.32 artifacts/);
    assert.throws(() => store.record([{ label: "", text: root }]), /non-empty label and text/);
    assert.throws(() => store.record([{ label: "one", text: root }, { label: "two", text: root }]), /duplicate artifact IDs/);
    assert.throws(() => store.context("invalid"), /valid wp-\* root_plan_id/);
    assert.throws(() => store.context("wp-missing"), /no handoff Root/);

    rememberContentAddressedRoot(root, defaultRoot);
    const tipPath = handoffTipPath("wp-adaptive-retry", rootContentHash(root));
    writeFileSync(tipPath, `${JSON.stringify({ handoff_tip_schema: 0 })}\n`);
    assert.throws(() => readHandoffTip("wp-adaptive-retry", { rootContentHash: rootContentHash(root) }), /corrupt handoff tip/);
  } finally {
    if (previousHome === undefined) delete process.env.GELDMACHER_WORKFLOW_HOME;
    else process.env.GELDMACHER_WORKFLOW_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
});
