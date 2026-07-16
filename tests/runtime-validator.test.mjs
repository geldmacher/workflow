import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("the shipped artifact validator runs in a clean plugin cache without node_modules", () => {
  const cache = mkdtempSync(join(tmpdir(), "workflow-plugin-cache-"));
  try {
    mkdirSync(join(cache, "scripts"));
    cpSync(join(root, "scripts", "validate-artifact.mjs"), join(cache, "scripts", "validate-artifact.mjs"));
    cpSync(join(root, "schemas"), join(cache, "schemas"), { recursive: true });
    cpSync(join(root, "tests", "fixtures", "artifacts", "work-plan.valid.md"), join(cache, "work-plan.md"));
    cpSync(join(root, "tests", "fixtures", "artifacts", "delivery-evidence.valid.md"), join(cache, "evidence.md"));

    const result = spawnSync(process.execPath, [join(cache, "scripts", "validate-artifact.mjs"), join(cache, "work-plan.md")], {
      cwd: cache,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Artifact validation passed/);

    const chain = spawnSync(process.execPath, [
      join(cache, "scripts", "validate-artifact.mjs"),
      join(cache, "work-plan.md"),
      join(cache, "evidence.md"),
    ], {
      cwd: cache,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    });
    assert.equal(chain.status, 0, `${chain.stdout}\n${chain.stderr}`);
    assert.match(chain.stdout, /Artifact chain validation passed/);

    const effective = spawnSync(process.execPath, [
      join(cache, "scripts", "validate-artifact.mjs"),
      "--effective",
      join(cache, "work-plan.md"),
      join(cache, "evidence.md"),
    ], {
      cwd: cache,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    });
    assert.equal(effective.status, 0, `${effective.stdout}\n${effective.stderr}`);
    const state = JSON.parse(effective.stdout);
    assert.equal(state.status, "passed");
    assert.equal(state.evidence_tips["wp-20260712T150503Z-configurable-retry-multiplier"], "de-20260712T150505Z-initial-retry-delivery");
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});
