#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultStateRoot } from "../src/controller/store.mjs";
import { sharedArtifactStateRoot } from "../src/core/state-paths.mjs";
import { migrateCursorHandoff } from "../src/core/handoff-migration.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const workspace = option("--workspace");
const contentAddressed = process.argv.includes("--content-addressed") || !option("--target-root");
if (!workspace && !option("--source-root")) {
  throw new Error("usage: migrate-handoff-state.mjs --workspace <path> [--source-root <path>] [--target-root <path>] [--content-addressed]");
}
const pluginRoot = resolve(option("--plugin-root") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const sourceRoot = resolve(option("--source-root") ?? defaultStateRoot(workspace));
const targetRoot = option("--target-root") ? resolve(option("--target-root")) : null;

process.stdout.write(`${JSON.stringify(migrateCursorHandoff({
  sourceRoot,
  targetRoot: contentAddressed ? null : (targetRoot ?? sharedArtifactStateRoot(workspace)),
  pluginRoot,
  contentAddressed,
}), null, 2)}\n`);
