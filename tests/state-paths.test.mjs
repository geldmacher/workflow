import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { codexOperationalStateRoot, repositoryKey, sharedArtifactStateRoot } from "../src/core/state-paths.mjs";
import { defaultStateRoot } from "../src/controller/store.mjs";

test("host state roots share only the repository key", () => {
  const workspace = "/tmp/workflow-state-path-test";
  const key = repositoryKey(workspace);
  assert.equal(sharedArtifactStateRoot(workspace, { baseRoot: "/tmp/shared" }), join("/tmp/shared", key));
  assert.equal(codexOperationalStateRoot(workspace, { pluginData: "/tmp/plugin-data" }), join("/tmp/plugin-data", "state", key));
  assert.match(defaultStateRoot(workspace), new RegExp(`\\.cursor/geldmacher-workflow/state/${key}$`));
  assert.notEqual(sharedArtifactStateRoot(workspace, { baseRoot: "/tmp/shared" }), codexOperationalStateRoot(workspace, { pluginData: "/tmp/plugin-data" }));
});
