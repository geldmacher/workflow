#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { enumerateReleaseSurface, hashReleaseSurface, loadReleaseSurface, validateReleaseSurfaceClosure } from "../src/controller/release-surface.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cache = mkdtempSync(join(tmpdir(), "workflow-npm-cache-"));
try {
  const expected = enumerateReleaseSurface(root, "package_paths").map((entry) => entry.relative_path);
  validateReleaseSurfaceClosure(root, "package_paths");
  const command = process.env.npm_execpath ? process.execPath : "npm";
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, "pack", "--dry-run", "--json", "--ignore-scripts", "--cache", cache]
    : ["pack", "--dry-run", "--json", "--ignore-scripts", "--cache", cache];
  const packed = spawnSync(command, args, { cwd: root, encoding: "utf8", env: { ...process.env, npm_config_update_notifier: "false" } });
  if (packed.status !== 0) throw new Error(packed.stderr.trim() || packed.stdout.trim() || "npm pack dry run failed");
  const report = JSON.parse(packed.stdout)[0];
  const actual = report.files.map((entry) => entry.path).sort();
  const missing = expected.filter((path) => !actual.includes(path));
  const unexpected = actual.filter((path) => !expected.includes(path));
  if (missing.length > 0 || unexpected.length > 0) throw new Error(`release package differs from release-surface.json; missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`);
  const portableSchemas = actual.filter((path) => path.startsWith("schemas/agent-plugins/"));
  const expectedPortableSchemas = [
    "schemas/agent-plugins/1.0.0/mcp.schema.json",
    "schemas/agent-plugins/1.0.0/plugin.schema.json",
  ];
  if (portableSchemas.join("\n") !== expectedPortableSchemas.join("\n")) {
    throw new Error(`release package has unexpected Agent Plugins schemas: [${portableSchemas.join(", ")}]`);
  }
  const nativeBudgetFiles = report.entryCount - portableSchemas.length;
  if (nativeBudgetFiles > 110) throw new Error(`release package has ${nativeBudgetFiles} native-budget files; maximum is 110`);
  if (report.unpackedSize > 3_217_436) throw new Error(`release package has ${report.unpackedSize} unpacked bytes; maximum is 3217436`);
  console.log(JSON.stringify({
    schema: loadReleaseSurface(root).schema,
    plugin_hash: hashReleaseSurface(root),
    files: report.entryCount,
    native_budget_files: nativeBudgetFiles,
    portable_schema_files: portableSchemas.length,
    unpacked_bytes: report.unpackedSize,
    package_name: report.name,
    package_version: report.version,
  }, null, 2));
} finally { rmSync(cache, { recursive: true, force: true }); }
