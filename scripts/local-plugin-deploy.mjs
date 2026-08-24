#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  constants as fsConstants,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RECEIPT_NAME = ".local-deploy.json";
export const HOSTS = ["cursor", "codex"];
const DEVELOPMENT_ROOTS = new Set([".agents", ".build", ".cursor", ".git", "node_modules", "test", "tests"]);
const PREVIEW_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(scriptPath));

function slash(path) {
  return path.split(sep).join("/");
}

export function isInside(base, candidate) {
  const item = relative(resolve(base), resolve(candidate));
  return item === "" || (item !== ".." && !item.startsWith(`..${sep}`) && !item.startsWith(sep));
}

function manifestRelative(host) {
  if (host === "cursor") return ".cursor-plugin/plugin.json";
  if (host === "codex") return ".codex-plugin/plugin.json";
  throw new Error(`unsupported plugin host: ${host}`);
}

function repositoryCodexManifestPath(root) {
  const direct = join(root, ".codex-plugin", "plugin.json");
  return existsSync(direct) ? direct : join(root, "targets", "codex", ".codex-plugin", "plugin.json");
}

function walk(directory, base = directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    const relativePath = slash(relative(base, path));
    if (entry.isSymbolicLink()) throw new Error(`plugin bundle contains a symlink: ${relativePath}`);
    if (entry.isDirectory()) result.push(...walk(path, base));
    else if (entry.isFile()) result.push({ path, relativePath });
    else throw new Error(`plugin bundle contains a non-regular entry: ${relativePath}`);
  }
  return result;
}

function stableManifestBytes(path, baseVersion) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.version = baseVersion;
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
}

export function contentHash(directory, { host, baseVersion }) {
  const root = resolve(directory);
  const manifestPath = manifestRelative(host);
  const digest = createHash("sha256");
  for (const entry of walk(root)) {
    if (entry.relativePath === RECEIPT_NAME) continue;
    const bytes = entry.relativePath === manifestPath
      ? stableManifestBytes(entry.path, baseVersion)
      : readFileSync(entry.path);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    digest.update(`${entry.relativePath}\0${fileHash}\n`);
  }
  return digest.digest("hex");
}

export function localVersion(baseVersion, host, hash) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(baseVersion)) throw new Error(`product version is not supported: ${baseVersion}`);
  if (!HOSTS.includes(host)) throw new Error(`unsupported plugin host: ${host}`);
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("content hash must be a SHA-256 digest");
  return `${baseVersion}+local.${host}.${hash.slice(0, 12)}`;
}

export function deploymentReceipt({ plugin, host, baseVersion, hash, gitHead, gitDirty, sourceRoot, deployedAt }) {
  return {
    schema: 1,
    plugin,
    host,
    product_version: baseVersion,
    local_version: localVersion(baseVersion, host, hash),
    content_sha256: hash,
    git_head: gitHead,
    git_dirty: Boolean(gitDirty),
    source_path: resolve(sourceRoot),
    deployed_at: deployedAt,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function copyTree(source, destination) {
  const sourceRoot = resolve(source);
  mkdirSync(destination, { recursive: true });
  for (const entry of walk(sourceRoot)) {
    const output = resolve(destination, entry.relativePath);
    if (!isInside(destination, output)) throw new Error(`copy destination escapes bundle root: ${entry.relativePath}`);
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(entry.path, output);
    chmodSync(output, statSync(entry.path).mode & 0o777);
  }
}

export function validateBundle(directory, { plugin, host, allowedVersions }) {
  const root = resolve(directory);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`plugin bundle must be a physical directory: ${root}`);
  for (const name of readdirSync(root)) {
    if (DEVELOPMENT_ROOTS.has(name)) throw new Error(`development surface is not deployable: ${name}`);
  }
  walk(root);
  const manifestPath = join(root, manifestRelative(host));
  if (!existsSync(manifestPath)) throw new Error(`${host} target is missing ${manifestRelative(host)}`);
  const manifest = readJson(manifestPath);
  if (manifest.name !== plugin) throw new Error(`unexpected ${host} plugin manifest: ${manifest.name || "<missing>"}`);
  if (allowedVersions && !allowedVersions.includes(manifest.version)) {
    throw new Error(`unexpected ${host} plugin version: ${manifest.version || "<missing>"}`);
  }
  return manifest;
}

function patchStagedBundle(directory, metadata) {
  const manifestPath = join(directory, manifestRelative(metadata.host));
  const manifest = readJson(manifestPath);
  manifest.version = metadata.localVersion;
  writeJson(manifestPath, manifest);
  writeJson(join(directory, RECEIPT_NAME), metadata.receipt);
  validateBundle(directory, {
    plugin: metadata.plugin,
    host: metadata.host,
    allowedVersions: [metadata.localVersion],
  });
  const verifiedHash = contentHash(directory, { host: metadata.host, baseVersion: metadata.baseVersion });
  if (verifiedHash !== metadata.hash) throw new Error(`${metadata.host} staged content hash changed during versioning`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function runJson(command, args, options = {}) {
  const stdout = run(command, args, options);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${command} ${args.join(" ")} did not return JSON: ${error.message}`);
  }
}

function nulSeparated(value) {
  return value.split("\0").filter(Boolean);
}

function gitVisibleFiles(root) {
  const tracked = nulSeparated(run("git", ["ls-files", "--cached", "-z"], { cwd: root }));
  const untracked = nulSeparated(run("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root }));
  return { tracked, untracked };
}

function copyPreviewFile(sourceRoot, snapshotRoot, item, { inspectSecrets }) {
  if (item === ".git" || item.startsWith(".git/") || item === "node_modules" || item.startsWith("node_modules/")) {
    throw new Error(`preview source contains a reserved path: ${item}`);
  }
  const source = resolve(sourceRoot, item);
  const destination = resolve(snapshotRoot, item);
  if (!isInside(sourceRoot, source) || !isInside(snapshotRoot, destination)) {
    throw new Error(`preview source path escapes the repository: ${item}`);
  }
  if (!lstatExists(source)) return;
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`preview source contains a symlink: ${item}`);
  if (!stat.isFile()) throw new Error(`preview source contains a non-regular entry: ${item}`);
  const bytes = readFileSync(source);
  if (inspectSecrets) {
    const text = bytes.toString("utf8");
    if (PREVIEW_SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
      throw new Error(`preview untracked source contains recognizable secret material: ${item}`);
    }
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  chmodSync(destination, stat.mode & 0o777);
}

function initializePreviewRepository(snapshotRoot) {
  run("git", ["init", "--quiet"], { cwd: snapshotRoot });
  run("git", ["config", "--local", "user.name", "Workflow Deployment Preview"], { cwd: snapshotRoot });
  run("git", ["config", "--local", "user.email", "workflow-preview@invalid.local"], { cwd: snapshotRoot });
  writeFileSync(join(snapshotRoot, ".git", "info", "exclude"), ".build/\nnode_modules/\n");
  run("git", ["add", "--all", "--force"], { cwd: snapshotRoot });
  const commitEnv = {
    ...process.env,
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
  };
  run("git", ["commit", "--quiet", "--no-gpg-sign", "-m", "Workflow deployment preview snapshot"], {
    cwd: snapshotRoot,
    env: commitEnv,
  });
}

function createDeploymentPreviewSnapshot(root) {
  const sourceRoot = resolve(root);
  const dependencyRoot = join(sourceRoot, "node_modules");
  if (!lstatExists(dependencyRoot)) throw new Error(`preview requires the existing repository node_modules: ${dependencyRoot}`);
  const dependencyStat = lstatSync(dependencyRoot);
  if (!dependencyStat.isDirectory() || dependencyStat.isSymbolicLink()) {
    throw new Error(`preview node_modules must be a physical directory: ${dependencyRoot}`);
  }
  const physicalDependencyRoot = realpathSync(dependencyRoot);
  const tempRoot = mkdtempSync(join(tmpdir(), `${basename(sourceRoot)}-deploy-preview-`));
  const snapshotRoot = join(tempRoot, "repository");
  try {
    mkdirSync(snapshotRoot, { recursive: true });
    const { tracked, untracked } = gitVisibleFiles(sourceRoot);
    const copied = new Set();
    for (const item of tracked) {
      copyPreviewFile(sourceRoot, snapshotRoot, item, { inspectSecrets: false });
      copied.add(item);
    }
    for (const item of untracked) {
      if (copied.has(item)) continue;
      copyPreviewFile(sourceRoot, snapshotRoot, item, { inspectSecrets: true });
    }
    initializePreviewRepository(snapshotRoot);
    cpSync(physicalDependencyRoot, join(snapshotRoot, "node_modules"), {
      recursive: true,
      dereference: false,
      verbatimSymlinks: true,
      mode: fsConstants.COPYFILE_FICLONE,
    });
    return { root: snapshotRoot, tempRoot };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

export function withPreparedDeploymentRoot({ root, dryRun, full = false, npmRunner = npmScript }, callback) {
  if (!dryRun) {
    npmRunner("deploy:prepare", root);
    if (full) npmRunner("release-check", root);
    return callback(resolve(root));
  }
  const snapshot = createDeploymentPreviewSnapshot(root);
  try {
    npmRunner("deploy:prepare", snapshot.root);
    if (full) npmRunner("release-check", snapshot.root);
    return callback(snapshot.root);
  } finally {
    rmSync(snapshot.tempRoot, { recursive: true, force: true });
  }
}

export function repositoryState(root = repositoryRoot) {
  const gitHead = run("git", ["rev-parse", "HEAD"], { cwd: root }).trim();
  const gitDirty = run("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root }).trim().length > 0;
  return { gitHead, gitDirty };
}

export function deploymentPaths(home, plugin) {
  const resolvedHome = resolve(home);
  return {
    home: resolvedHome,
    cursor: join(resolvedHome, ".cursor", "plugins", "local", plugin),
    codex: join(resolvedHome, ".codex", "plugins", plugin),
    codexHome: join(resolvedHome, ".codex"),
    marketplace: join(resolvedHome, ".agents", "plugins", "marketplace.json"),
    marketplaceSource: `./.codex/plugins/${plugin}`,
  };
}

function assertDestination(path, expected, home) {
  if (resolve(path) !== resolve(expected)) throw new Error(`deployment target differs from the canonical path: ${path}`);
  const root = resolve(home);
  if (!isInside(root, path)) throw new Error(`deployment target is outside the selected home: ${path}`);
  let cursor = root;
  for (const part of relative(root, dirname(path)).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!lstatExists(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`deployment parent escaped through a symlink: ${cursor}`);
  }
}

function existingBundle(path, identity) {
  if (!existsSync(path) && !lstatExists(path)) return null;
  const stat = lstatSync(path);
  let target = path;
  if (stat.isSymbolicLink()) {
    target = realpathSync(path);
    if (!lstatSync(target).isDirectory()) throw new Error(`existing plugin symlink is not a directory: ${path}`);
  } else if (!stat.isDirectory()) {
    throw new Error(`existing plugin target is not a directory: ${path}`);
  }
  const manifest = validateExistingBundle(target, identity);
  return { path, target, manifest, symbolicLink: stat.isSymbolicLink(), link: stat.isSymbolicLink() ? readlinkSync(path) : null };
}

function lstatExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function validateExistingBundle(directory, { plugin, host }) {
  const manifestPath = join(directory, manifestRelative(host));
  if (!existsSync(manifestPath)) throw new Error(`existing ${host} target has no plugin manifest: ${directory}`);
  const manifest = readJson(manifestPath);
  if (manifest.name !== plugin) throw new Error(`existing ${host} target belongs to ${manifest.name || "<unknown>"}`);
  return manifest;
}

export function updateMarketplaceDocument(document, plugin, sourcePath) {
  if (document === null) {
    document = {
      name: "personal",
      interface: { displayName: "Personal" },
      plugins: [],
    };
  }
  if (document?.name !== "personal" || !Array.isArray(document.plugins)) {
    throw new Error("personal Marketplace must be named personal and expose a plugins array");
  }
  const matches = document.plugins.filter((entry) => entry?.name === plugin);
  if (matches.length > 1) throw new Error(`personal Marketplace contains duplicate ${plugin} entries`);
  if (matches.length === 0) {
    document.plugins.push({
      name: plugin,
      source: { source: "local", path: sourcePath },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    });
    return document;
  }
  const entry = matches[0];
  if (entry.source?.source !== "local") throw new Error(`${plugin} Marketplace entry is not a local source`);
  entry.source.path = sourcePath;
  return document;
}

function atomicWrite(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  writeFileSync(temp, bytes);
  renameSync(temp, path);
}

function readReceipt(path) {
  try {
    return readJson(join(path, RECEIPT_NAME));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function currentTarget(path, expected) {
  const existing = existingBundle(path, expected);
  if (!existing || existing.symbolicLink) return { current: false, receipt: null, manifest: existing?.manifest || null };
  const receipt = readReceipt(path);
  if (!receipt) return { current: false, receipt: null, manifest: existing.manifest };
  let hash;
  try {
    hash = contentHash(path, { host: expected.host, baseVersion: expected.baseVersion });
  } catch {
    return { current: false, receipt, manifest: existing.manifest };
  }
  const current = receipt.plugin === expected.plugin
    && receipt.host === expected.host
    && receipt.product_version === expected.baseVersion
    && receipt.local_version === expected.localVersion
    && receipt.content_sha256 === expected.hash
    && existing.manifest.version === expected.localVersion
    && hash === expected.hash;
  return { current, receipt, manifest: existing.manifest };
}

function hookHash(path) {
  const hooks = join(path, "hooks");
  if (!existsSync(hooks)) return null;
  const digest = createHash("sha256");
  for (const entry of walk(hooks)) digest.update(`${entry.relativePath}\0${createHash("sha256").update(readFileSync(entry.path)).digest("hex")}\n`);
  return digest.digest("hex");
}

function stageTarget(source, destination, metadata) {
  mkdirSync(dirname(destination), { recursive: true });
  const stageRoot = mkdtempSync(join(dirname(destination), `.${metadata.plugin}.${metadata.host}.deploy-`));
  const payload = join(stageRoot, "payload");
  copyTree(source, payload);
  patchStagedBundle(payload, metadata);
  return { stageRoot, payload };
}

function backupPath(destination) {
  return join(dirname(destination), `.${basename(destination)}.backup-${process.pid}-${randomUUID()}`);
}

function cachePath(codexHome, plugin, version) {
  return join(codexHome, "plugins", "cache", "personal", plugin, version);
}

export function codexInstallationState({ home, plugin, version, codexBinary = "codex", env = process.env }) {
  let list;
  try {
    list = runJson(codexBinary, ["plugin", "list", "--json"], { env: { ...env, HOME: home } });
  } catch (error) {
    return { current: false, error: error.message, installed: null, cachePath: null };
  }
  const installed = list.installed?.find((entry) => entry.pluginId === `${plugin}@personal`) || null;
  const codexHome = resolve(env.CODEX_HOME || join(home, ".codex"));
  const expectedCache = cachePath(codexHome, plugin, version);
  let cacheManifest = null;
  try {
    cacheManifest = readJson(join(expectedCache, ".codex-plugin", "plugin.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const expectedSource = join(resolve(home), ".codex", "plugins", plugin);
  const current = installed?.version === version
    && resolve(installed?.source?.path || "/") === expectedSource
    && cacheManifest?.name === plugin
    && cacheManifest?.version === version;
  return { current, installed, cachePath: expectedCache, cacheManifest };
}

function installCodexDefault({ home, plugin, version, codexBinary, env }) {
  run(codexBinary, ["plugin", "add", `${plugin}@personal`, "--json"], { env: { ...env, HOME: home } });
  const state = codexInstallationState({ home, plugin, version, codexBinary, env });
  if (!state.current) throw new Error(`Codex did not activate ${plugin} ${version} from its canonical source/cache`);
  return state;
}

export function prepareMetadata({ root, targetsRoot = root, plugin, baseVersion, gitHead, gitDirty, deployedAt = new Date().toISOString() }) {
  const targets = {};
  for (const host of HOSTS) {
    const path = join(targetsRoot, ".build", "plugins", host, plugin);
    validateBundle(path, { plugin, host, allowedVersions: [baseVersion] });
    const hash = contentHash(path, { host, baseVersion });
    const version = localVersion(baseVersion, host, hash);
    targets[host] = {
      plugin,
      host,
      path,
      baseVersion,
      hash,
      localVersion: version,
      receipt: deploymentReceipt({
        plugin,
        host,
        baseVersion,
        hash,
        gitHead,
        gitDirty,
        sourceRoot: root,
        deployedAt,
      }),
    };
  }
  return targets;
}

export function deployPreparedTargets({
  root,
  targetsRoot = root,
  plugin,
  baseVersion,
  home,
  gitHead,
  gitDirty,
  dryRun = false,
  deployedAt,
  codexBinary = "codex",
  env = process.env,
  codexInstaller = installCodexDefault,
  codexStateReader = codexInstallationState,
  hosts = HOSTS,
  simulateFailure,
}) {
  const selectedHosts = [...new Set(hosts)];
  if (selectedHosts.length === 0 || selectedHosts.some((host) => !HOSTS.includes(host))) {
    throw new Error(`deployment hosts must be one or more of: ${HOSTS.join(", ")}`);
  }
  const paths = deploymentPaths(home, plugin);
  for (const host of selectedHosts) assertDestination(paths[host], paths[host], paths.home);
  const metadata = prepareMetadata({ root, targetsRoot, plugin, baseVersion, gitHead, gitDirty, deployedAt });
  const existing = Object.fromEntries(selectedHosts.map((host) => [host, currentTarget(paths[host], metadata[host])]));
  let marketplaceOriginal = null;
  let marketplaceBytes = null;
  let marketplaceChanged = false;
  let codexBefore = { current: true, skipped: true };
  if (selectedHosts.includes("codex")) {
    marketplaceOriginal = lstatExists(paths.marketplace) ? readFileSync(paths.marketplace) : null;
    const marketplace = updateMarketplaceDocument(marketplaceOriginal ? JSON.parse(marketplaceOriginal) : null, plugin, paths.marketplaceSource);
    marketplaceBytes = Buffer.from(`${JSON.stringify(marketplace, null, 2)}\n`);
    marketplaceChanged = marketplaceOriginal === null || !marketplaceOriginal.equals(marketplaceBytes);
    codexBefore = codexStateReader({ home, plugin, version: metadata.codex.localVersion, codexBinary, env });
  }
  const changedHosts = selectedHosts.filter((host) => !existing[host].current);
  const hooksChanged = Object.fromEntries(selectedHosts.map((host) => {
    const oldBundle = existingBundle(paths[host], { plugin, host });
    const oldHash = oldBundle ? hookHash(oldBundle.target) : null;
    return [host, oldHash !== hookHash(metadata[host].path)];
  }));
  const plan = {
    plugin,
    source_path: resolve(root),
    product_version: baseVersion,
    git_head: gitHead,
    git_dirty: Boolean(gitDirty),
    dry_run: Boolean(dryRun),
    selected_hosts: selectedHosts,
    targets: Object.fromEntries(selectedHosts.map((host) => [host, {
      destination: paths[host],
      local_version: metadata[host].localVersion,
      content_sha256: metadata[host].hash,
      change: changedHosts.includes(host),
      hooks_changed: hooksChanged[host],
    }])),
    marketplace: selectedHosts.includes("codex")
      ? { path: paths.marketplace, source: paths.marketplaceSource, change: marketplaceChanged }
      : null,
    codex: selectedHosts.includes("codex")
      ? { change: !codexBefore.current, cache_path: cachePath(resolve(env.CODEX_HOME || paths.codexHome), plugin, metadata.codex.localVersion) }
      : null,
  };
  if (dryRun) return plan;
  const codexCurrent = !selectedHosts.includes("codex") || (!marketplaceChanged && codexBefore.current);
  if (changedHosts.length === 0 && codexCurrent) return { ...plan, no_op: true };

  const staged = {};
  const swapped = [];
  let marketplaceWritten = false;
  try {
    for (const host of changedHosts) staged[host] = stageTarget(metadata[host].path, paths[host], metadata[host]);
    if (simulateFailure === "after-stage") throw new Error("simulated failure after stage");
    for (const host of changedHosts) {
      const destination = paths[host];
      const previous = existingBundle(destination, { plugin, host });
      const backup = previous ? backupPath(destination) : null;
      if (backup) renameSync(destination, backup);
      try {
        renameSync(staged[host].payload, destination);
      } catch (error) {
        if (backup && !lstatExists(destination)) renameSync(backup, destination);
        throw error;
      }
      swapped.push({ host, destination, backup });
      if (simulateFailure === `after-${host}-swap`) throw new Error(`simulated failure after ${host} swap`);
    }
    if (selectedHosts.includes("codex") && marketplaceChanged) {
      atomicWrite(paths.marketplace, marketplaceBytes);
      marketplaceWritten = true;
    }
    if (simulateFailure === "after-marketplace") throw new Error("simulated failure after Marketplace update");
    const codex = selectedHosts.includes("codex")
      ? codexInstaller({
        home,
        plugin,
        version: metadata.codex.localVersion,
        codexBinary,
        env,
        source: paths.codex,
        cache: cachePath(resolve(env.CODEX_HOME || paths.codexHome), plugin, metadata.codex.localVersion),
      })
      : null;
    if (simulateFailure === "after-codex-add") throw new Error("simulated failure after Codex add");
    for (const item of swapped) {
      const state = currentTarget(item.destination, metadata[item.host]);
      if (!state.current) throw new Error(`${item.host} target failed post-swap verification`);
    }
    for (const item of swapped) if (item.backup) rmSync(item.backup, { recursive: true, force: true });
    return { ...plan, no_op: false, codex };
  } catch (error) {
    for (const item of [...swapped].reverse()) {
      if (lstatExists(item.destination)) rmSync(item.destination, { recursive: true, force: true });
      if (item.backup && lstatExists(item.backup)) renameSync(item.backup, item.destination);
    }
    if (marketplaceWritten) {
      if (marketplaceOriginal === null) rmSync(paths.marketplace, { force: true });
      else atomicWrite(paths.marketplace, marketplaceOriginal);
    }
    throw new Error(`local plugin deployment rolled back: ${error.message}`, { cause: error });
  } finally {
    for (const stage of Object.values(staged)) if (lstatExists(stage.stageRoot)) rmSync(stage.stageRoot, { recursive: true, force: true });
  }
}

async function expectedTargetMetadata(root, plugin, baseVersion) {
  const temp = mkdtempSync(join(tmpdir(), `${plugin}-deploy-status-`));
  try {
    const module = await import(`${pathToFileURL(join(root, "scripts", "build-plugin-targets.mjs")).href}?status=${Date.now()}`);
    if (typeof module.buildPluginTargets !== "function") throw new Error("target builder does not export buildPluginTargets");
    const result = module.buildPluginTargets(temp);
    return Object.fromEntries(HOSTS.map((host) => {
      const path = result[host]?.path || join(temp, host, plugin);
      validateBundle(path, { plugin, host, allowedVersions: [baseVersion] });
      const hash = contentHash(path, { host, baseVersion });
      return [host, { hash, localVersion: localVersion(baseVersion, host, hash) }];
    }));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export async function deploymentStatus({ root = repositoryRoot, home = process.env.LOCAL_PLUGIN_HOME || homedir(), codexBinary = process.env.CODEX_BIN || "codex", env = process.env, hosts = HOSTS } = {}) {
  const selectedHosts = [...new Set(hosts)];
  if (selectedHosts.length === 0 || selectedHosts.some((host) => !HOSTS.includes(host))) {
    throw new Error(`status hosts must be one or more of: ${HOSTS.join(", ")}`);
  }
  const packageManifest = readJson(join(root, "package.json"));
  const cursorManifest = readJson(join(root, ".cursor-plugin", "plugin.json"));
  const plugin = cursorManifest.name;
  const baseVersion = packageManifest.version;
  const expected = await expectedTargetMetadata(root, plugin, baseVersion);
  const paths = deploymentPaths(home, plugin);
  const targets = {};
  for (const host of selectedHosts) {
    const current = currentTarget(paths[host], { plugin, host, baseVersion, ...expected[host] });
    targets[host] = {
      destination: paths[host],
      expected_version: expected[host].localVersion,
      installed_version: current.manifest?.version || null,
      current: current.current,
      receipt: current.receipt,
    };
  }
  let marketplaceCurrent = true;
  let codex = null;
  if (selectedHosts.includes("codex")) {
    const marketplace = lstatExists(paths.marketplace) ? readJson(paths.marketplace) : null;
    const entries = marketplace?.plugins?.filter((entry) => entry?.name === plugin) || [];
    marketplaceCurrent = entries.length === 1 && entries[0].source?.source === "local" && entries[0].source.path === paths.marketplaceSource;
    codex = codexInstallationState({ home, plugin, version: expected.codex.localVersion, codexBinary, env });
  }
  return {
    plugin,
    source_path: resolve(root),
    product_version: baseVersion,
    git: repositoryState(root),
    selected_hosts: selectedHosts,
    targets,
    marketplace: selectedHosts.includes("codex")
      ? { path: paths.marketplace, expected_source: paths.marketplaceSource, current: marketplaceCurrent }
      : null,
    codex,
    current: selectedHosts.every((host) => targets[host].current)
      && (!selectedHosts.includes("codex") || (marketplaceCurrent && codex.current)),
  };
}

function npmScript(name, root) {
  run("npm", ["run", name], { cwd: root, inherit: true });
}

function selectedHostsFromArguments(args) {
  const cursorOnly = args.includes("--cursor-only");
  const codexOnly = args.includes("--codex-only");
  if (cursorOnly && codexOnly) throw new Error("--cursor-only and --codex-only are mutually exclusive");
  if (cursorOnly) return ["cursor"];
  if (codexOnly) return ["codex"];
  return HOSTS;
}

function parseDeployArguments(args) {
  const supported = new Set(["--dry-run", "--full", "--cursor-only", "--codex-only"]);
  for (const arg of args) if (!supported.has(arg)) throw new Error(`unsupported deploy argument: ${arg}`);
  return { dryRun: args.includes("--dry-run"), full: args.includes("--full"), hosts: selectedHostsFromArguments(args) };
}

function parseStatusArguments(args) {
  const supported = new Set(["--cursor-only", "--codex-only"]);
  for (const arg of args) if (!supported.has(arg)) throw new Error(`unsupported status argument: ${arg}`);
  return selectedHostsFromArguments(args);
}

async function main() {
  const [command = "deploy", ...args] = process.argv.slice(2);
  const home = process.env.LOCAL_PLUGIN_HOME || homedir();
  const codexBinary = process.env.CODEX_BIN || "codex";
  if (command === "status") {
    const hosts = parseStatusArguments(args);
    process.stdout.write(`${JSON.stringify(await deploymentStatus({ root: repositoryRoot, home, codexBinary, hosts }), null, 2)}\n`);
    return;
  }
  if (command !== "deploy") throw new Error(`unsupported command: ${command}`);
  const { dryRun, full, hosts } = parseDeployArguments(args);
  const packageManifest = readJson(join(repositoryRoot, "package.json"));
  const cursorManifest = readJson(join(repositoryRoot, ".cursor-plugin", "plugin.json"));
  const codexManifest = readJson(repositoryCodexManifestPath(repositoryRoot));
  if (cursorManifest.name !== codexManifest.name) throw new Error("Cursor and Codex plugin names differ");
  if (cursorManifest.version !== packageManifest.version || codexManifest.version !== packageManifest.version) {
    throw new Error("repository manifests must keep the regular package product version");
  }
  const result = withPreparedDeploymentRoot({ root: repositoryRoot, dryRun, full }, (targetsRoot) => {
    const git = repositoryState(repositoryRoot);
    return deployPreparedTargets({
      root: repositoryRoot,
      targetsRoot,
      plugin: cursorManifest.name,
      baseVersion: packageManifest.version,
      home,
      gitHead: git.gitHead,
      gitDirty: git.gitDirty,
      dryRun,
      codexBinary,
      hosts,
    });
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!dryRun) {
    const changedHooks = Object.keys(result.targets).filter((host) => result.targets[host].hooks_changed);
    if (changedHooks.length) process.stderr.write(`Manual hook trust review required for: ${changedHooks.join(", ")}\n`);
    const nextSteps = [];
    if (hosts.includes("cursor")) nextSteps.push("reload Cursor");
    if (hosts.includes("codex")) nextSteps.push("start a new Codex task");
    process.stderr.write(`${nextSteps.join(" and ")}; hosts were not restarted automatically.\n`);
  }
}

const direct = process.argv[1] && resolve(process.argv[1]) === scriptPath;
if (direct) main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
