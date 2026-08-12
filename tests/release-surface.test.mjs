import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import { enumerateReleaseSurface, hashReleaseSurface, loadReleaseSurface, validateReleaseSurfaceClosure } from "../src/controller/release-surface.mjs";

function minimalSurface(manifest = null) {
  const root = mkdtempSync(join(tmpdir(), "workflow-release-contract-"));
  writeFileSync(join(root, "runtime.mjs"), "export {};\n");
  writeFileSync(join(root, "release-surface.json"), `${JSON.stringify(manifest ?? {
    schema: 1,
    runtime_paths: ["release-surface.json", "runtime.mjs"],
    package_extras: [],
  }, null, 2)}\n`);
  return root;
}

test("release surface ignores development files and binds runtime files", () => {
  const copy = mkdtempSync(join(tmpdir(), "workflow-release-surface-"));
  try {
    for (const entry of enumerateReleaseSurface(defaultRoot, "package_paths")) {
      const target = join(copy, entry.relative_path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(entry.path, target, { force: true });
    }
    const baseline = hashReleaseSurface(copy);
    writeFileSync(join(copy, "untracked-development-note.txt"), "ignored\n");
    mkdirSync(join(copy, "tests"));
    writeFileSync(join(copy, "tests", "changed.test.mjs"), "development only\n");
    writeFileSync(join(copy, "README.md"), `${readFileSync(join(copy, "README.md"), "utf8")}\ndocumentation-only change\n`);
    assert.equal(hashReleaseSurface(copy), baseline);
    const command = join(copy, "commands", "plan-work.md");
    writeFileSync(command, `${readFileSync(command, "utf8")}\nchanged\n`);
    assert.notEqual(hashReleaseSurface(copy), baseline);
  } finally { rmSync(copy, { recursive: true, force: true }); }
});

test("release surface keeps the native file budget separate from portable validation schemas", () => {
  const paths = enumerateReleaseSurface(defaultRoot, "package_paths").map((entry) => entry.relative_path);
  const portableSchemas = paths.filter((path) => path.startsWith("schemas/agent-plugins/"));
  assert.deepEqual(portableSchemas, [
    "schemas/agent-plugins/1.0.0/mcp.schema.json",
    "schemas/agent-plugins/1.0.0/plugin.schema.json",
  ]);
  assert.ok(paths.length - portableSchemas.length <= 110);
});

test("release surface rejects malformed inventories, traversal, and symlinks", () => {
  const valid = minimalSurface();
  try {
    assert.equal(loadReleaseSurface(valid).schema, 1);
    assert.throws(() => enumerateReleaseSurface(valid, "unknown"), /unsupported release surface field/);
    symlinkSync(join(valid, "runtime.mjs"), join(valid, "linked.mjs"));
    const linked = { schema: 1, runtime_paths: ["linked.mjs", "release-surface.json"], package_extras: [] };
    writeFileSync(join(valid, "release-surface.json"), `${JSON.stringify(linked)}\n`);
    assert.throws(() => enumerateReleaseSurface(valid), /may not contain symlinks/);
  } finally { rmSync(valid, { recursive: true, force: true }); }

  for (const [manifest, pattern] of [
    [{ schema: 2, runtime_paths: ["release-surface.json"], package_extras: [] }, /schema mismatch/],
    [{ schema: 1, extra: true, runtime_paths: ["release-surface.json"], package_extras: [] }, /unsupported fields/],
    [{ schema: 1, runtime_paths: [], package_extras: [] }, /non-empty runtime surface/],
    [{ schema: 1, runtime_paths: ["runtime.mjs", "release-surface.json"], package_extras: [] }, /must be sorted/],
    [{ schema: 1, runtime_paths: ["../outside", "release-surface.json"], package_extras: [] }, /invalid release surface path/],
    [{ schema: 1, runtime_paths: ["missing", "release-surface.json"], package_extras: [] }, /missing or escapes/],
    [{ schema: 1, runtime_paths: ["runtime.mjs"], package_extras: [] }, /attest its own manifest/],
  ]) {
    const root = minimalSurface(manifest);
    try { assert.throws(() => loadReleaseSurface(root), pattern); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("release surface requires every local import to remain inside the package inventory", () => {
  const root = minimalSurface({
    schema: 1,
    runtime_paths: ["release-surface.json", "runtime.mjs"],
    package_extras: [],
  });
  try {
    writeFileSync(join(root, "hidden.mjs"), "export const hidden = true;\n");
    writeFileSync(join(root, "runtime.mjs"), "export { hidden } from './hidden.mjs';\n");
    assert.throws(() => validateReleaseSurfaceClosure(root), /outside package_paths/);
    writeFileSync(join(root, "runtime.mjs"), "export { missing } from './missing.mjs';\n");
    assert.throws(() => validateReleaseSurfaceClosure(root), /missing or escapes/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
