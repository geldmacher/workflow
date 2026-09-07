#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPluginTargets } from "./build-plugin-targets.mjs";
import { validateTarget } from "./validate-plugin.mjs";

export function validateAgentPlugin(root, version) { return validateTarget(root, "agent-plugins", version); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const temp = mkdtempSync(join(tmpdir(), "workflow-portable-check-"));
  try {
    const built = buildPluginTargets(temp);
    const failures = validateAgentPlugin(built["agent-plugins"].path, built.version);
    if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
    else console.log("Portable skills package validation passed.");
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
