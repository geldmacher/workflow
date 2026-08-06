import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import {
  codexOperationalStateRoot,
  contentAddressedHandoffRoot,
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
  assert.match(defaultStateRoot(workspace), new RegExp(`\\.cursor/geldmacher-workflow/state/${key}$`));
  assert.notEqual(sharedArtifactStateRoot(workspace, { baseRoot: "/tmp/shared" }), codexOperationalStateRoot(workspace, { pluginData: "/tmp/plugin-data" }));
});

test("content-addressed handoff namespaces use the full exact Root hash", () => {
  const rootA = "---\nartifact: work-plan\nid: wp-a\n---\nA\n";
  const rootB = "---\nartifact: work-plan\nid: wp-a\n---\nB\n";
  const hashA = rootContentHash(rootA);
  const hashB = rootContentHash(rootB);
  assert.equal(hashA.length, 64);
  assert.notEqual(hashA, hashB);
  assert.equal(contentAddressedHandoffRoot(rootA, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "by-root", hashA));
  assert.equal(contentAddressedHandoffRoot(rootB, { baseRoot: "/tmp/handoff" }), join("/tmp/handoff", "by-root", hashB));
  assert.equal(sharedHandoffBase({ baseRoot: "/tmp/handoff" }), "/tmp/handoff");
});
