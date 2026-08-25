import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { loadProtectedProjectHarness } from "../src/harness/module-adapter.mjs";

const roots = [];
test.after(() => roots.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function externalAdapter() {
  const root = mkdtempSync(join(tmpdir(), "workflow-host-adapter-"));
  roots.push(root);
  const path = join(root, "adapter.mjs");
  writeFileSync(path, `
    const hashes = { v1: "${"1".repeat(64)}", v2: "${"2".repeat(64)}" };
    export function createWorkflowHostAdapter() {
      return {
        bindProjectHarness({ harness_locator }) {
          return {
            harnessId: "external-project-harness",
            deploymentBindingHash: hashes[harness_locator] ?? hashes.v1,
            async protectedCapability() {},
            async stagePhase() {},
            async recoverPhase() {},
            async commitPhase() {},
          };
        },
      };
    }
  `, { mode: 0o600 });
  return { root, path: realpathSync(path) };
}

function adapterModule(source) {
  const root = mkdtempSync(join(tmpdir(), "workflow-host-adapter-case-"));
  roots.push(root);
  const path = join(root, "adapter.mjs");
  writeFileSync(path, source, { mode: 0o600 });
  return realpathSync(path);
}

test("no external Host Adapter means no protected Harness binding", async () => {
  assert.equal(await loadProtectedProjectHarness({
    adapterSpecifier: null,
    harnessLocator: "/project/harness.mjs",
    workspaceRoot: defaultRoot,
  }), null);
});

test("Host Adapter loader requires an absolute canonical non-symlink path outside the workspace", async () => {
  const adapter = externalAdapter();
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: "adapter.mjs", workspaceRoot: defaultRoot }), /absolute file path/);
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: join(defaultRoot, "src/harness/module-adapter.mjs"), workspaceRoot: defaultRoot }), /outside the project workspace/);
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: adapter.path, workspaceRoot: adapter.path }), /outside the project workspace/);
  // Parent-dir symlink keeps lstat on the leaf file green while realpath differs from resolve.
  const aliasRoot = mkdtempSync(join(tmpdir(), "workflow-host-adapter-alias-"));
  roots.push(aliasRoot);
  const aliasedDir = join(aliasRoot, "via-link");
  symlinkSync(adapter.root, aliasedDir);
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: join(aliasedDir, "adapter.mjs"), workspaceRoot: defaultRoot }), /may not be redirected/);
  const link = join(adapter.root, "adapter-link.mjs");
  symlinkSync(adapter.path, link);
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: link, workspaceRoot: defaultRoot }), /non-symlink/);
  const directory = join(adapter.root, "directory-adapter");
  mkdirSync(directory);
  await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: realpathSync(directory), workspaceRoot: defaultRoot }), /regular non-symlink/);
});

test("the external adapter, not a module path, supplies deployment identity", async () => {
  const adapter = externalAdapter();
  const common = { adapterSpecifier: adapter.path, workspaceRoot: defaultRoot };
  const first = await loadProtectedProjectHarness({ ...common, harnessLocator: "v1" });
  const changed = await loadProtectedProjectHarness({ ...common, harnessLocator: "v2" });
  assert.equal(first.harnessId, changed.harnessId);
  assert.notEqual(first.deploymentBindingHash, changed.deploymentBindingHash);
});

test("a test Host Adapter binds deployment identity to Harness bytes and host policy at the same path", async () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-host-deployment-binding-"));
  roots.push(root);
  const harnessPath = join(root, "project-harness.mjs");
  const policyPath = join(root, "host-policy.json");
  writeFileSync(harnessPath, "export const deployment = 'v1';\n", { mode: 0o600 });
  writeFileSync(policyPath, "{\"policy\":\"v1\"}\n", { mode: 0o600 });
  const adapterPath = adapterModule(`
    import { createHash } from "node:crypto";
    import { readFileSync } from "node:fs";
    const policyPath = ${JSON.stringify(policyPath)};
    const hash = (values) => createHash("sha256").update(values.join("\\0")).digest("hex");
    export function createWorkflowHostAdapter() {
      return { bindProjectHarness({ harness_locator }) {
        return {
          harnessId: "content-bound-harness",
          deploymentBindingHash: hash([readFileSync(harness_locator), readFileSync(policyPath)]),
          protectedCapability() {}, stagePhase() {}, recoverPhase() {}, commitPhase() {},
        };
      } };
    }
  `);
  const common = { adapterSpecifier: adapterPath, harnessLocator: harnessPath, workspaceRoot: defaultRoot };
  const first = await loadProtectedProjectHarness(common);
  const same = await loadProtectedProjectHarness(common);
  assert.equal(first.deploymentBindingHash, same.deploymentBindingHash);
  writeFileSync(harnessPath, "export const deployment = 'v2';\n", { mode: 0o600 });
  const changedHarness = await loadProtectedProjectHarness(common);
  assert.notEqual(changedHarness.deploymentBindingHash, first.deploymentBindingHash);
  writeFileSync(policyPath, "{\"policy\":\"v2\"}\n", { mode: 0o600 });
  const changedPolicy = await loadProtectedProjectHarness(common);
  assert.notEqual(changedPolicy.deploymentBindingHash, changedHarness.deploymentBindingHash);
});

test("file URLs and default adapter factories preserve opaque host arguments", async () => {
  const path = adapterModule(`
    export default { createWorkflowHostAdapter(options) {
      return { bindProjectHarness(input) {
        if (options.workspaceBinding !== "${"3".repeat(64)}" || input.harness_locator !== null) throw new Error("arguments drifted");
        return {
          harnessId: "default-adapter",
          deploymentBindingHash: "${"4".repeat(64)}",
          protectedCapability() {}, stagePhase() {}, recoverPhase() {}, commitPhase() {},
        };
      } };
    } };
  `);
  const binding = await loadProtectedProjectHarness({
    adapterSpecifier: pathToFileURL(path).href,
    workspaceBinding: "3".repeat(64),
  });
  assert.equal(binding.harnessId, "default-adapter");
});

test("malformed external adapters and bindings fail before use", async () => {
  const cases = [
    [`export const value = 1;`, /must export createWorkflowHostAdapter/],
    [`export function createWorkflowHostAdapter() { return null; }`, /must implement bindProjectHarness/],
    [`export function createWorkflowHostAdapter() { return {}; }`, /must implement bindProjectHarness/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return null; } }; }`, /returned no Harness binding/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return []; } }; }`, /returned no Harness binding/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return {}; } }; }`, /requires harnessId/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "" }; } }; }`, /requires harnessId/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "x", deploymentBindingHash: "bad" }; } }; }`, /requires deploymentBindingHash/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "x", deploymentBindingHash: "${"5".repeat(64)}" }; } }; }`, /requires protectedCapability/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "x", deploymentBindingHash: "${"5".repeat(64)}", protectedCapability() {} }; } }; }`, /requires stagePhase/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "x", deploymentBindingHash: "${"5".repeat(64)}", protectedCapability() {}, stagePhase() {} }; } }; }`, /requires recoverPhase/],
    [`export function createWorkflowHostAdapter() { return { bindProjectHarness() { return { harnessId: "x", deploymentBindingHash: "${"5".repeat(64)}", protectedCapability() {}, stagePhase() {}, recoverPhase() {} }; } }; }`, /requires commitPhase/],
  ];
  for (const [source, pattern] of cases) {
    await assert.rejects(() => loadProtectedProjectHarness({ adapterSpecifier: adapterModule(source) }), pattern);
  }
});
