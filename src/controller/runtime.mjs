import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { hashReleaseSurface } from "./release-surface.mjs";

export const WORKER_RUNTIME_SCHEMA = 1;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(path) {
  return sha256(readFileSync(path));
}

export function currentPlatform() {
  return `${process.platform}-${process.arch}`;
}

export function cursorPlatformPackage(platform = currentPlatform()) {
  return `@cursor/sdk-${platform}`;
}

export function defaultRuntimeRoot() {
  return join(homedir(), ".cursor", "geldmacher-workflow", "runtime");
}

export function workerRuntimeDirectory({ pluginVersion, sdkVersion, platform = currentPlatform(), runtimeRoot = defaultRuntimeRoot() }) {
  return join(resolve(runtimeRoot), pluginVersion, sdkVersion, platform);
}

function inventoryFromLock(lock) {
  return Object.entries(lock.packages ?? {})
    .filter(([path]) => path !== "")
    .map(([path, entry]) => ({ path, version: entry.version ?? null, integrity: entry.integrity ?? null, optional: entry.optional === true }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function lockInventoryHash(lockPath) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  return sha256(JSON.stringify(inventoryFromLock(lock)));
}

export function hashPluginTree(pluginRoot) {
  return hashReleaseSurface(pluginRoot);
}

export function runtimeManifestPath(runtimeDirectory) {
  return join(runtimeDirectory, "runtime-manifest.json");
}

export function loadWorkerRuntimeManifest(runtimeDirectory, expected = {}) {
  const directory = resolve(runtimeDirectory);
  const path = runtimeManifestPath(directory);
  if (!existsSync(path)) return { valid: false, reason: "runtime-manifest-missing", directory };
  try {
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    const workerPath = join(directory, "workflow-worker.mjs");
    const lockPath = join(directory, "npm-shrinkwrap.json");
    const packagePath = join(directory, "package.json");
    const platformPackagePath = join(directory, "node_modules", ...String(manifest.platform_package ?? "").split("/"), "package.json");
    const sdkPackagePath = join(directory, "node_modules", "@cursor", "sdk", "package.json");
    const reasons = [];
    if (manifest.schema !== WORKER_RUNTIME_SCHEMA) reasons.push("runtime-schema-mismatch");
    if (manifest.generated_by !== "geldmacher-workflow-runtime-provisioner") reasons.push("runtime-producer-mismatch");
    if (typeof manifest.marketplace_git_commit !== "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(manifest.marketplace_git_commit)) reasons.push("marketplace-git-commit-invalid");
    for (const [field, value] of Object.entries(expected)) if (value !== undefined && manifest[field] !== value) reasons.push(`${field}-mismatch`);
    for (const candidate of [workerPath, lockPath, packagePath, platformPackagePath, sdkPackagePath]) if (!existsSync(candidate)) reasons.push(`runtime-file-missing:${basename(candidate)}`);
    if (reasons.length === 0 && manifest.worker_hash !== sha256File(workerPath)) reasons.push("worker-hash-mismatch");
    if (reasons.length === 0 && manifest.lockfile_hash !== sha256File(lockPath)) reasons.push("lockfile-hash-mismatch");
    if (reasons.length === 0 && manifest.lock_inventory_hash !== lockInventoryHash(lockPath)) reasons.push("lock-inventory-hash-mismatch");
    if (reasons.length === 0) {
      const sdkPackage = JSON.parse(readFileSync(sdkPackagePath, "utf8"));
      const platformPackage = JSON.parse(readFileSync(platformPackagePath, "utf8"));
      if (sdkPackage.version !== manifest.sdk_version || platformPackage.version !== manifest.sdk_version) reasons.push("installed-sdk-version-mismatch");
    }
    const runtimeHash = sha256(JSON.stringify({
      schema: manifest.schema,
      generated_by: manifest.generated_by,
      plugin_version: manifest.plugin_version,
      plugin_hash: manifest.plugin_hash,
      marketplace_git_commit: manifest.marketplace_git_commit,
      sdk_version: manifest.sdk_version,
      platform: manifest.platform,
      platform_package: manifest.platform_package,
      worker_hash: manifest.worker_hash,
      lockfile_hash: manifest.lockfile_hash,
      lock_inventory_hash: manifest.lock_inventory_hash,
    }));
    if (manifest.runtime_hash !== runtimeHash) reasons.push("runtime-hash-mismatch");
    return { valid: reasons.length === 0, reasons, reason: reasons[0] ?? null, directory, manifest, workerPath };
  } catch (error) {
    return { valid: false, reason: "runtime-manifest-invalid", reasons: [error.message], directory };
  }
}

export function createRuntimeManifest({ pluginVersion, pluginHash, marketplaceGitCommit, sdkVersion, platform = currentPlatform(), workerPath, lockPath, provisionedAt = new Date().toISOString() }) {
  if (!/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(marketplaceGitCommit ?? "")) throw new Error("runtime manifest requires an exact Marketplace Git commit");
  const base = {
    schema: WORKER_RUNTIME_SCHEMA,
    generated_by: "geldmacher-workflow-runtime-provisioner",
    plugin_version: pluginVersion,
    plugin_hash: pluginHash,
    marketplace_git_commit: marketplaceGitCommit,
    sdk_version: sdkVersion,
    platform,
    platform_package: cursorPlatformPackage(platform),
    worker_hash: sha256File(workerPath),
    lockfile_hash: sha256File(lockPath),
    lock_inventory_hash: lockInventoryHash(lockPath),
  };
  return {
    ...base,
    runtime_hash: sha256(JSON.stringify(base)),
    provisioned_at: provisionedAt,
    node_version: process.version,
  };
}

export function installRuntimeFiles({ stagingDirectory, pluginRoot }) {
  mkdirSync(stagingDirectory, { recursive: true, mode: 0o700 });
  cpSync(join(pluginRoot, "package.json"), join(stagingDirectory, "package.json"));
  cpSync(join(pluginRoot, "npm-shrinkwrap.json"), join(stagingDirectory, "npm-shrinkwrap.json"));
  cpSync(join(pluginRoot, "dist", "workflow-worker.mjs"), join(stagingDirectory, "workflow-worker.mjs"));
}

export function publishStagedRuntime(stagingDirectory, targetDirectory) {
  const target = resolve(targetDirectory);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  if (existsSync(target)) throw new Error(`worker runtime already exists: ${target}`);
  renameSync(stagingDirectory, target);
  return target;
}

export function createRuntimeStagingDirectory(targetDirectory) {
  const staging = `${resolve(targetDirectory)}.${process.pid}.${randomUUID()}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true, mode: 0o700 });
  return staging;
}

export function writeRuntimeManifest(runtimeDirectory, manifest) {
  writeFileSync(runtimeManifestPath(runtimeDirectory), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
}
