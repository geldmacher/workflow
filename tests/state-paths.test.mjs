import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import {
  codexOperationalStateRoot,
  contentAddressedHandoffRoot,
  contentAddressedHandoffRootByHash,
  handoffTipDirectory,
  handoffTipPath,
  legacyHandoffTipPath,
  repositoryKey,
  rootContentHash,
  sharedArtifactStateRoot,
  sharedHandoffBase,
} from "../src/core/state-paths.mjs";
import { defaultStateRoot } from "../src/controller/store.mjs";

test("host state roots share only the repository key", () => {
  const workspace = "/tmp/workflow-state-path-test";
  const key = repositoryKey(workspace);
  assert.equal(sharedArtifactStateRoot(workspace, { baseRoot: "/tmp/shared" }), join("/tmp/shared", key));
  assert.equal(codexOperationalStateRoot(workspace, { pluginData: "/tmp/plugin-data" }), join("/tmp/plugin-data", "state", key));
  assert.equal(
    codexOperationalStateRoot(workspace, { baseRoot: "/tmp/codex-base" }),
    join("/tmp/codex-base", key),
  );
  assert.match(defaultStateRoot(workspace), new RegExp(`\\.cursor/geldmacher-workflow/state/${key}$`));
  assert.notEqual(sharedArtifactStateRoot(workspace, { baseRoot: "/tmp/shared" }), codexOperationalStateRoot(workspace, { pluginData: "/tmp/plugin-data" }));
});

test("content-addressed handoff namespaces use the full exact Root hash", () => {
  const rootA = "---\nartifact: work-plan\nid: wp-a\n---\nA\n";
  const rootB = "---\nartifact: work-plan\nid: wp-a\n---\nB\n";
  const rootCrlf = rootA.replace(/\n/g, "\r\n");
  const hashA = rootContentHash(rootA);
  const hashB = rootContentHash(rootB);
  const hashCrlf = rootContentHash(rootCrlf);
  assert.equal(hashA.length, 64);
  assert.notEqual(hashA, hashB);
  assert.notEqual(hashA, hashCrlf);
  assert.throws(() => rootContentHash(""), /exact non-empty Root text/);
  assert.throws(() => rootContentHash("   "), /exact non-empty Root text/);
  assert.throws(() => rootContentHash(null), /exact non-empty Root text/);
  assert.equal(contentAddressedHandoffRoot(rootA, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "by-root", hashA));
  assert.equal(contentAddressedHandoffRoot(rootB, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "by-root", hashB));
  assert.equal(contentAddressedHandoffRootByHash(hashA, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "by-root", hashA));
  assert.throws(() => contentAddressedHandoffRootByHash("short", { baseRoot: "/tmp/handoff" }), /full SHA-256/);
  assert.equal(sharedHandoffBase({ baseRoot: "/tmp/handoff" }), "/tmp/handoff");
  assert.equal(handoffTipDirectory("wp-a", { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "tips", "wp-a"));
  assert.throws(() => handoffTipDirectory("bad", { baseRoot: "/tmp/handoff" }), /valid wp-\*/);
  assert.equal(handoffTipPath("wp-a", hashA, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "tips", "wp-a", `${hashA}.json`));
  assert.equal(handoffTipPath("wp-a", null, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "tips", "wp-a.json"));
  assert.equal(handoffTipPath("wp-a", "", { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "tips", "wp-a.json"));
  assert.throws(() => handoffTipPath("wp-a", "not-a-hash", { baseRoot: "/tmp/handoff" }), /full SHA-256/);
  assert.throws(() => handoffTipPath("bad", hashA, { baseRoot: "/tmp/handoff" }), /valid wp-\*/);
  assert.equal(legacyHandoffTipPath("wp-a", { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "tips", "wp-a.json"));
});
