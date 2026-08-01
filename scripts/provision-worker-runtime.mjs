import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PLUGIN_VERSION } from "../src/controller/protocol.mjs";
import { sdkVersion } from "../src/controller/worker-adapter.mjs";
import {
  createRuntimeManifest,
  createRuntimeStagingDirectory,
  currentPlatform,
  installRuntimeFiles,
  hashPluginTree,
  loadWorkerRuntimeManifest,
  publishStagedRuntime,
  workerRuntimeDirectory,
  writeRuntimeManifest,
} from "../src/controller/runtime.mjs";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const runtimeRoot = argument("runtime-root") ? resolve(argument("runtime-root")) : undefined;
const pluginHash = hashPluginTree(pluginRoot);
function gitCommit() {
  const explicit = argument("marketplace-git-commit") ?? process.env.CURSOR_PLUGIN_GIT_COMMIT;
  if (explicit) {
    if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(explicit)) throw new Error("marketplace Git commit must be an exact 40- or 64-character object ID");
    return explicit;
  }
  const result = spawnSync("git", ["-C", pluginRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
  const value = result.status === 0 ? result.stdout.trim() : "";
  if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(value)) throw new Error("cannot attest Marketplace Git commit; pass --marketplace-git-commit explicitly");
  return value;
}
const marketplaceGitCommit = gitCommit();
const target = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion, platform: currentPlatform(), runtimeRoot });
const existing = loadWorkerRuntimeManifest(target, { plugin_version: PLUGIN_VERSION, plugin_hash: pluginHash, marketplace_git_commit: marketplaceGitCommit, sdk_version: sdkVersion, platform: currentPlatform() });
if (existing.valid) {
  console.log(JSON.stringify({ provisioned: false, reused: true, target, manifest: existing.manifest }, null, 2));
  process.exit(0);
}
if (existing.reason !== "runtime-manifest-missing") throw new Error(`existing worker runtime is invalid and will not be overwritten: ${existing.reasons?.join(", ") ?? existing.reason}`);

const staging = createRuntimeStagingDirectory(target);
try {
  installRuntimeFiles({ stagingDirectory: staging, pluginRoot });
  const install = spawnSync(process.env.npm_execpath ? process.execPath : "npm", process.env.npm_execpath
    ? [process.env.npm_execpath, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"]
    : ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: staging,
    encoding: "utf8",
    env: { ...process.env, npm_config_update_notifier: "false" },
  });
  if (install.status !== 0) throw new Error(install.stderr.trim() || install.stdout.trim() || "npm ci failed");
  const manifest = createRuntimeManifest({
    pluginVersion: PLUGIN_VERSION,
    pluginHash,
    marketplaceGitCommit,
    sdkVersion,
    workerPath: join(staging, "workflow-worker.mjs"),
    lockPath: join(staging, "npm-shrinkwrap.json"),
  });
  writeRuntimeManifest(staging, manifest);
  publishStagedRuntime(staging, target);
  const validation = loadWorkerRuntimeManifest(target, { plugin_version: PLUGIN_VERSION, plugin_hash: pluginHash, marketplace_git_commit: marketplaceGitCommit, sdk_version: sdkVersion, platform: currentPlatform() });
  if (!validation.valid) throw new Error(`provisioned worker runtime failed validation: ${validation.reasons.join(", ")}`);
  console.log(JSON.stringify({ provisioned: true, reused: false, target, manifest: validation.manifest }, null, 2));
} catch (error) {
  rmSync(staging, { recursive: true, force: true });
  throw error;
}
