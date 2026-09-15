import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import {
  contentHash,
  deployPreparedTargets,
  deploymentPaths,
  deploymentStatus,
  deploymentReceipt,
  isInside,
  localVersion,
  updateMarketplaceDocument,
  validateBundle,
  withPreparedDeploymentRoot,
} from "../scripts/local-plugin-deploy.mjs";

import { buildPluginTargets, defaultRoot } from "../scripts/build-plugin-targets.mjs";

const plugin = "geldmacher-test";
const baseVersion = "1.2.3";
const gitHead = "0123456789abcdef0123456789abcdef01234567";

function json(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "local-plugin-deploy-test-"));
  const repository = join(root, "repository");
  const home = join(root, "home");
  for (const host of ["cursor", "codex"]) {
    const bundle = join(repository, ".build", "plugins", host, plugin);
    const manifestDir = host === "cursor" ? ".cursor-plugin" : ".codex-plugin";
    json(join(bundle, manifestDir, "plugin.json"), { name: plugin, version: baseVersion });
    writeFileSync(join(bundle, "payload.txt"), "first\n");
    mkdirSync(join(bundle, "references"));
    writeFileSync(join(bundle, "references", `${host}.md`), `${host} instructions\n`);
  }
  const portable = join(repository, ".build", "plugins", "agent-plugins", plugin);
  json(join(portable, "plugin.json"), { name: plugin, version: baseVersion });
  writeFileSync(join(portable, "payload.txt"), "portable-only\n");
  const marketplace = deploymentPaths(home, plugin).marketplace;
  json(marketplace, {
    name: "personal",
    plugins: [
      { name: "unrelated", source: { source: "local", path: "./other" } },
      { name: plugin, source: { source: "local", path: "./stale-copy" }, policy: { installation: "AVAILABLE" } },
    ],
  });
  return { root, repository, home, marketplace };
}

function metadata(root) {
  return {
    root,
    plugin,
    baseVersion,
    gitHead,
    gitDirty: true,
  };
}

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function previewFixture() {
  const root = mkdtempSync(join(tmpdir(), "local-plugin-preview-test-"));
  const repository = join(root, "repository");
  mkdirSync(repository);
  git(repository, "init", "--quiet");
  writeFileSync(join(repository, ".gitignore"), ".build/\nignored.txt\nnode_modules/\n");
  writeFileSync(join(repository, "tracked.sh"), "tracked\n");
  chmodSync(join(repository, "tracked.sh"), 0o755);
  git(repository, "add", ".gitignore", "tracked.sh");
  writeFileSync(join(repository, "tracked.sh"), "dirty tracked\n");
  writeFileSync(join(repository, "untracked.txt"), "untracked\n");
  writeFileSync(join(repository, "ignored.txt"), "ignored\n");
  mkdirSync(join(repository, ".build"));
  writeFileSync(join(repository, ".build", "stale.txt"), "stale\n");
  mkdirSync(join(repository, "node_modules"));
  writeFileSync(join(repository, "node_modules", "dependency.txt"), "dependency\n");
  writeFileSync(join(repository, ".git", "local-only.txt"), "metadata\n");
  return { root, repository };
}

const neverCurrent = () => ({ current: false, installed: null, cachePath: null });
const alwaysCurrent = () => ({ current: true, installed: { version: "current" }, cachePath: "/cache" });
const successfulInstaller = ({ version, cache }) => ({ current: true, installed: { version }, cachePath: cache });

test("local versions are host-specific and content-addressed", () => {
  const hash = "a".repeat(64);
  assert.equal(localVersion("5.3.0", "cursor", hash), "5.3.0+local.cursor.aaaaaaaaaaaa");
  assert.equal(localVersion("5.3.0", "codex", hash), "5.3.0+local.codex.aaaaaaaaaaaa");
  assert.throws(() => localVersion("5.3", "cursor", hash), /product version/);
});

test("content hashes are stable across receipts and deployed manifest versions", () => {
  const item = fixture();
  try {
    const bundle = join(item.repository, ".build", "plugins", "cursor", plugin);
    const first = contentHash(bundle, { host: "cursor", baseVersion });
    json(join(bundle, ".cursor-plugin", "plugin.json"), { name: plugin, version: localVersion(baseVersion, "cursor", first) });
    json(join(bundle, ".local-deploy.json"), { deployed_at: "tomorrow", content_sha256: first });
    assert.equal(contentHash(bundle, { host: "cursor", baseVersion }), first);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("dirty provenance is explicit in deployment receipts", () => {
  const hash = "b".repeat(64);
  const receipt = deploymentReceipt({
    plugin,
    host: "codex",
    baseVersion,
    hash,
    gitHead,
    gitDirty: true,
    sourceRoot: "/tmp/source",
    deployedAt: "2026-08-10T12:00:00.000Z",
  });
  assert.equal(receipt.git_dirty, true);
  assert.equal(receipt.git_head, gitHead);
  assert.equal(receipt.local_version, "1.2.3+local.codex.bbbbbbbbbbbb");
  assert.equal(receipt.source_path, "/tmp/source");
});

test("path boundaries, symlinks, development roots, and wrong manifests fail closed", () => {
  const item = fixture();
  try {
    const cursor = join(item.repository, ".build", "plugins", "cursor", plugin);
    assert.equal(isInside(item.repository, cursor), true);
    assert.equal(isInside(item.repository, join(item.repository, "..", "escape")), false);
    json(join(cursor, ".cursor-plugin", "plugin.json"), { name: "wrong-plugin", version: baseVersion });
    assert.throws(() => validateBundle(cursor, { plugin, host: "cursor", allowedVersions: [baseVersion] }), /unexpected cursor plugin manifest/);
    json(join(cursor, ".cursor-plugin", "plugin.json"), { name: plugin, version: baseVersion });
    mkdirSync(join(cursor, "tests"));
    assert.throws(() => validateBundle(cursor, { plugin, host: "cursor", allowedVersions: [baseVersion] }), /development surface/);
    rmSync(join(cursor, "tests"), { recursive: true });
    symlinkSync("payload.txt", join(cursor, "payload-link"));
    assert.throws(() => validateBundle(cursor, { plugin, host: "cursor", allowedVersions: [baseVersion] }), /contains a symlink/);
    assert.equal(readlinkSync(join(cursor, "payload-link")), "payload.txt");
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("Marketplace updates preserve every unrelated entry", () => {
  const document = {
    name: "personal",
    plugins: [
      { name: "alpha", source: { source: "local", path: "./alpha" } },
      { name: plugin, source: { source: "local", path: "./old" }, extra: "preserve" },
    ],
  };
  const result = updateMarketplaceDocument(document, plugin, `./.codex/plugins/${plugin}`);
  assert.equal(result.plugins[0].source.path, "./alpha");
  assert.equal(result.plugins[1].source.path, `./.codex/plugins/${plugin}`);
  assert.equal(result.plugins[1].extra, "preserve");
  const created = updateMarketplaceDocument(null, plugin, `./.codex/plugins/${plugin}`);
  assert.equal(created.name, "geldmacher-personal");
  assert.equal(created.plugins[0].name, plugin);
  assert.equal(created.plugins[0].source.path, `./.codex/plugins/${plugin}`);
  assert.equal(updateMarketplaceDocument({ name: "other", plugins: [] }, plugin, "./x").name, "other");
});

test("dry-run preparation uses a Git-visible snapshot, preserves modes, and always cleans it", () => {
  const item = previewFixture();
  let successRoot;
  let failureRoot;
  const scripts = [];
  try {
    const result = withPreparedDeploymentRoot({
      root: item.repository,
      dryRun: true,
      full: true,
      npmRunner(name, root) {
        scripts.push([name, root]);
      },
    }, (root) => {
      successRoot = root;
      assert.notEqual(root, resolve(item.repository));
      assert.equal(readFileSync(join(root, "tracked.sh"), "utf8"), "dirty tracked\n");
      assert.equal(readFileSync(join(root, "untracked.txt"), "utf8"), "untracked\n");
      assert.equal(lstatSync(join(root, "tracked.sh")).mode & 0o111, 0o111);
      assert.equal(existsSync(join(root, "ignored.txt")), false);
      assert.equal(existsSync(join(root, ".build")), false);
      assert.equal(existsSync(join(root, ".git")), true);
      assert.equal(git(root, "rev-parse", "--is-inside-work-tree").trim(), "true");
      assert.equal(git(root, "log", "-1", "--pretty=%an <%ae>").trim(), "Workflow Deployment Preview <workflow-preview@invalid.local>");
      assert.equal(git(root, "status", "--porcelain", "--untracked-files=normal").trim(), "");
      assert.equal(lstatSync(join(root, "node_modules")).isDirectory(), true);
      assert.notEqual(realpathSync(join(root, "node_modules")), realpathSync(join(item.repository, "node_modules")));
      writeFileSync(join(root, "node_modules", "dependency.txt"), "snapshot dependency\n");
      assert.equal(readFileSync(join(item.repository, "node_modules", "dependency.txt"), "utf8"), "dependency\n");
      return "prepared";
    });
    assert.equal(result, "prepared");
    assert.deepEqual(scripts.map(([name]) => name), ["release-check", "build:targets"]);
    assert.equal(scripts.every(([, root]) => root === successRoot), true);
    assert.equal(existsSync(successRoot), false);

    assert.throws(() => withPreparedDeploymentRoot({
      root: item.repository,
      dryRun: true,
      npmRunner() {},
    }, (root) => {
      failureRoot = root;
      throw new Error("callback failed");
    }), /callback failed/);
    assert.equal(existsSync(failureRoot), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("preview snapshot rejects untracked symlinks and recognizable secrets without leaking temp roots", () => {
  const item = previewFixture();
  const prefix = `${basename(item.repository)}-deploy-preview-`;
  const previewRoots = () => readdirSync(tmpdir()).filter((name) => name.startsWith(prefix)).sort();
  try {
    const before = previewRoots();
    symlinkSync("untracked.txt", join(item.repository, "untracked-link"));
    assert.throws(() => withPreparedDeploymentRoot({
      root: item.repository,
      dryRun: true,
      npmRunner() {},
    }, () => {}), /preview source contains a symlink: untracked-link/);
    assert.deepEqual(previewRoots(), before);
    rmSync(join(item.repository, "untracked-link"));

    writeFileSync(join(item.repository, "local-secret.txt"), `${"ghp_"}${"abcdefghijklmnopqrstuvwxyz123456"}\n`);
    assert.throws(() => withPreparedDeploymentRoot({
      root: item.repository,
      dryRun: true,
      npmRunner() {},
    }, () => {}), /untracked source contains recognizable secret material: local-secret\.txt/);
    assert.deepEqual(previewRoots(), before);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("real preparation stays on the canonical checkout", () => {
  const item = previewFixture();
  const calls = [];
  try {
    const result = withPreparedDeploymentRoot({
      root: item.repository,
      dryRun: false,
      full: true,
      npmRunner(name, root) {
        calls.push([name, root]);
      },
    }, (root) => root);
    assert.equal(result, resolve(item.repository));
    assert.deepEqual(calls, [
      ["release-check", item.repository],
      ["build:targets", item.repository],
    ]);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("deployment planning keeps canonical provenance while reading prepared targets elsewhere", () => {
  const item = fixture();
  const prepared = join(item.root, "prepared");
  try {
    cpSync(join(item.repository, ".build"), join(prepared, ".build"), { recursive: true });
    writeFileSync(join(prepared, ".build", "plugins", "cursor", plugin, "payload.txt"), "prepared preview\n");
    const preparedBundle = join(prepared, ".build", "plugins", "cursor", plugin);
    const canonicalBundle = join(item.repository, ".build", "plugins", "cursor", plugin);
    const result = deployPreparedTargets({
      ...metadata(item.repository),
      targetsRoot: prepared,
      home: item.home,
      hosts: ["cursor"],
      dryRun: true,
    });
    assert.equal(result.source_path, resolve(item.repository));
    assert.equal(result.targets.cursor.content_sha256, contentHash(preparedBundle, { host: "cursor", baseVersion }));
    assert.notEqual(result.targets.cursor.content_sha256, contentHash(canonicalBundle, { host: "cursor", baseVersion }));
    assert.equal(existsSync(deploymentPaths(item.home, plugin).cursor), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("Cursor-only first install needs neither Codex nor a personal Marketplace", () => {
  const item = fixture();
  try {
    rmSync(item.marketplace, { force: true });
    const result = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["cursor"],
      codexStateReader: () => { throw new Error("Cursor-only deploy must not inspect Codex"); },
      codexInstaller: () => { throw new Error("Cursor-only deploy must not install Codex"); },
    });
    const paths = deploymentPaths(item.home, plugin);
    assert.deepEqual(result.selected_hosts, ["cursor"]);
    assert.equal(result.marketplace, null);
    assert.equal(result.codex, null);
    assert.equal(readFileSync(join(paths.cursor, ".cursor-plugin", "plugin.json"), "utf8").includes("+local.cursor."), true);
    assert.equal(existsSync(paths.codex), false);
    assert.equal(existsSync(paths.marketplace), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("Codex-only first install creates its Marketplace entry without touching Cursor", () => {
  const item = fixture();
  try {
    rmSync(item.marketplace, { force: true });
    const result = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["codex"],
      codexStateReader: neverCurrent,
      codexInstaller: successfulInstaller,
    });
    const paths = deploymentPaths(item.home, plugin);
    assert.deepEqual(result.selected_hosts, ["codex"]);
    assert.equal(existsSync(paths.cursor), false);
    assert.equal(readFileSync(join(paths.codex, ".codex-plugin", "plugin.json"), "utf8").includes("+local.codex."), true);
    const marketplace = JSON.parse(readFileSync(paths.marketplace, "utf8"));
    assert.equal(marketplace.name, "geldmacher-personal");
    assert.equal(marketplace.plugins[0].source.path, `./.codex/plugins/${plugin}`);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("first install is physical and a second identical deploy is a no-op", () => {
  const item = fixture();
  try {
    const first = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      deployedAt: "2026-08-10T12:00:00.000Z",
      codexStateReader: neverCurrent,
      codexInstaller: successfulInstaller,
    });
    assert.equal(first.no_op, false);
    assert.deepEqual(Object.keys(first.targets).sort(), ["codex", "cursor"]);
    assert.equal(readFileSync(join(item.repository, ".build", "plugins", "agent-plugins", plugin, "payload.txt"), "utf8"), "portable-only\n");
    const paths = deploymentPaths(item.home, plugin);
    assert.equal(JSON.parse(readFileSync(join(paths.cursor, ".cursor-plugin", "plugin.json"))).version, first.targets.cursor.local_version);
    assert.equal(JSON.parse(readFileSync(join(paths.codex, ".codex-plugin", "plugin.json"))).version, first.targets.codex.local_version);
    assert.equal(JSON.parse(readFileSync(item.marketplace)).plugins[1].source.path, `./.codex/plugins/${plugin}`);
    const receiptBefore = readFileSync(join(paths.cursor, ".local-deploy.json"), "utf8");
    const second = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      deployedAt: "2026-08-11T12:00:00.000Z",
      codexStateReader: alwaysCurrent,
      codexInstaller: () => { throw new Error("no-op must not reinstall"); },
    });
    assert.equal(second.no_op, true);
    assert.equal(readFileSync(join(paths.cursor, ".local-deploy.json"), "utf8"), receiptBefore);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("changed bundles replace both targets", () => {
  const item = fixture();
  try {
    const options = {
      ...metadata(item.repository),
      home: item.home,
      codexStateReader: neverCurrent,
      codexInstaller: successfulInstaller,
    };
    const first = deployPreparedTargets({ ...options, deployedAt: "2026-08-10T12:00:00.000Z" });
    for (const host of ["cursor", "codex"]) {
      writeFileSync(join(item.repository, ".build", "plugins", host, plugin, "payload.txt"), "second\n");
    }
    const second = deployPreparedTargets({ ...options, deployedAt: "2026-08-10T12:01:00.000Z" });
    assert.notEqual(first.targets.cursor.content_sha256, second.targets.cursor.content_sha256);
    assert.equal(readFileSync(join(deploymentPaths(item.home, plugin).cursor, "payload.txt"), "utf8"), "second\n");
    assert.equal(readFileSync(join(deploymentPaths(item.home, plugin).codex, "payload.txt"), "utf8"), "second\n");
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("a failure after both swaps restores both targets and Marketplace", () => {
  const item = fixture();
  try {
    const options = {
      ...metadata(item.repository),
      home: item.home,
      codexStateReader: neverCurrent,
      codexInstaller: successfulInstaller,
    };
    deployPreparedTargets({ ...options, deployedAt: "2026-08-10T12:00:00.000Z" });
    const paths = deploymentPaths(item.home, plugin);
    const oldCursor = readFileSync(join(paths.cursor, ".local-deploy.json"), "utf8");
    const oldCodex = readFileSync(join(paths.codex, ".local-deploy.json"), "utf8");
    const oldMarketplace = readFileSync(item.marketplace, "utf8");
    for (const host of ["cursor", "codex"]) {
      writeFileSync(join(item.repository, ".build", "plugins", host, plugin, "payload.txt"), "rollback-candidate\n");
    }
    assert.throws(() => deployPreparedTargets({
      ...options,
      deployedAt: "2026-08-10T12:02:00.000Z",
      simulateFailure: "after-codex-add",
    }), /deployment rolled back/);
    assert.equal(readFileSync(join(paths.cursor, ".local-deploy.json"), "utf8"), oldCursor);
    assert.equal(readFileSync(join(paths.codex, ".local-deploy.json"), "utf8"), oldCodex);
    assert.equal(readFileSync(item.marketplace, "utf8"), oldMarketplace);
    assert.equal(readFileSync(join(paths.cursor, "payload.txt"), "utf8"), "first\n");
    assert.equal(readFileSync(join(paths.codex, "payload.txt"), "utf8"), "first\n");
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

for (const name of ["personal", "geldmacher-personal", "Team_tools"]) {
  test(`Codex adapter installation, no-op and status retain Marketplace ${name}`, async () => {
    const parent = mkdtempSync(join(tmpdir(), "workflow-marketplace-test-"));
    try {
      const home = join(parent, "home");
      const built = buildPluginTargets(join(parent, ".build/plugins"));
      const product = "geldmacher-workflow";
      const paths = deploymentPaths(home, product);
      const unrelated = { name: "unrelated", source: { source: "local", path: "./other" }, extra: "keep" };
      json(paths.marketplace, { name, interface: { displayName: "My tools" }, plugins: [unrelated] });
      const binary = join(parent, "codex");
      writeFileSync(binary, `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const [command, action, id] = process.argv.slice(2);
const stateFile = path.join(__dirname, 'installed.json');
if (command !== 'plugin') throw new Error('unexpected command');
if (action === 'list') {
  console.log(JSON.stringify({installed: fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : []}));
} else if (action === 'add') {
  const [plugin, marketplace] = id.split('@');
  const source = path.join(process.env.HOME, '.codex/plugins', plugin);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, '.codex-plugin/plugin.json')));
  const cache = path.join(process.env.CODEX_HOME, 'plugins/cache', marketplace, plugin, manifest.version);
  fs.cpSync(source, cache, {recursive:true});
  fs.writeFileSync(stateFile, JSON.stringify([{pluginId:id, version:manifest.version, source:{path:source}}]));
  fs.appendFileSync(path.join(__dirname, 'calls.txt'), id+'\\n');
  console.log('{}');
} else throw new Error('unexpected action');
`, { mode: 0o755 });
      const env = { ...process.env, CODEX_HOME: paths.codexHome };
      const options = { root: defaultRoot, targetsRoot: parent, plugin: product, baseVersion: built.version, home, gitHead, gitDirty: true, hosts: ["codex"], codexBinary: binary, env };
      const deployed = deployPreparedTargets(options);
      assert.equal(deployed.no_op, false);
      assert.equal(deployed.marketplace.name, name);
      assert.equal(deployed.codex.installed.pluginId, `${product}@${name}`);
      assert.equal(deployed.codex.cachePath, join(paths.codexHome, "plugins/cache", name, product, deployed.targets.codex.local_version));
      const catalog = JSON.parse(readFileSync(paths.marketplace));
      assert.equal(catalog.name, name);
      assert.deepEqual(catalog.interface, { displayName: "My tools" });
      assert.deepEqual(catalog.plugins[0], unrelated);
      assert.equal(deployPreparedTargets(options).no_op, true);
      assert.equal(readFileSync(join(parent, "calls.txt"), "utf8"), `${product}@${name}\n`);
      const status = await deploymentStatus({ root: defaultRoot, home, hosts: ["codex"], codexBinary: binary, env });
      assert.equal(status.current, true);
      assert.equal(status.marketplace.name, name);
      assert.equal(status.codex.installed.pluginId, `${product}@${name}`);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  });
}

for (const document of [
  null, [], { plugins: [] }, { name: "../escape", plugins: [] }, { name: "", plugins: [] },
  { name: "personal" }, { name: "personal", plugins: [{name: plugin}, {name: plugin}] },
]) {
  test(`invalid Marketplace stops before staging or native installation: ${JSON.stringify(document)}`, () => {
    const item = fixture();
    try {
      json(item.marketplace, document);
      const before = readFileSync(item.marketplace);
      assert.throws(() => deployPreparedTargets({ ...metadata(item.repository), home: item.home, hosts: ["codex"],
        codexStateReader: () => assert.fail("must not call Codex before catalog validation"),
        codexInstaller: () => assert.fail("must not install"),
      }), /Marketplace.*(?:valid name|duplicate)/);
      assert.deepEqual(readFileSync(item.marketplace), before);
      assert.equal(existsSync(deploymentPaths(item.home, plugin).codex), false);
    } finally { rmSync(item.root, { recursive: true, force: true }); }
  });
}

for (const name of ["geldmacher-personal", "team.tools"]) {
  test(`failed deployment restores the existing ${name} catalog`, () => {
    const item = fixture();
    try {
      const catalog = JSON.parse(readFileSync(item.marketplace));
      catalog.name = name;
      json(item.marketplace, catalog);
      const before = readFileSync(item.marketplace);
      assert.throws(() => deployPreparedTargets({ ...metadata(item.repository), home: item.home, hosts: ["codex"],
        codexStateReader: neverCurrent, codexInstaller: successfulInstaller, simulateFailure: "after-marketplace",
      }), /rolled back/);
      assert.deepEqual(readFileSync(item.marketplace), before);
      assert.equal(existsSync(deploymentPaths(item.home, plugin).codex), false);
    } finally { rmSync(item.root, { recursive: true, force: true }); }
  });
}

test("preparation selects one gate sequence and never deploys after a failed gate", () => {
  const item = previewFixture();
  try {
    for (const dryRun of [false, true]) {
      for (const full of [false, true]) {
        const expected = full ? ["release-check", "build:targets"] : ["deploy:prepare"];
        const calls = [];
        withPreparedDeploymentRoot({ root: item.repository, dryRun, full,
          npmRunner: name => calls.push(name),
        }, () => calls.push("ready"));
        assert.deepEqual(calls, [...expected, "ready"]);
        for (const failing of expected) {
          const failedCalls = [];
          let preparedRoot;
          assert.throws(() => withPreparedDeploymentRoot({ root: item.repository, dryRun, full,
            npmRunner(name, root) {
              preparedRoot = root;
              failedCalls.push(name);
              if (name === failing) throw new Error("gate failed");
            },
          }, () => assert.fail("deployment must not run")), /gate failed/);
          assert.deepEqual(failedCalls, expected.slice(0, expected.indexOf(failing) + 1));
          assert.equal(existsSync(preparedRoot), !dryRun);
        }
      }
    }
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});
