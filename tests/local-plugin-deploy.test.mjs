import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  contentHash,
  deployPreparedTargets,
  deploymentPaths,
  deploymentStatus,
  deploymentReceipt,
  isInside,
  localVersion,
  openCodeSkillsPath,
  uninstallOpenCodeDeployment,
  updateMarketplaceDocument,
  updateOpenCodeDocument,
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
  for (const host of ["cursor", "codex", "opencode"]) {
    const bundle = join(repository, ".build", "plugins", host, plugin);
    const manifestDir = host === "cursor" ? ".cursor-plugin" : host === "codex" ? ".codex-plugin" : ".opencode-plugin";
    json(join(bundle, manifestDir, "plugin.json"), { name: plugin, version: baseVersion });
    writeFileSync(join(bundle, "payload.txt"), "first\n");
    mkdirSync(join(bundle, "references"));
    writeFileSync(join(bundle, "references", `${host}.md`), `${host} instructions\n`);
    if (host === "opencode") {
      mkdirSync(join(bundle, "commands"));
      writeFileSync(join(bundle, "commands", "plan-work.md"), "---\ndescription: \"Plan\"\n---\n\nLoad the `plan-work` skill and apply it to the current request.\n\n$ARGUMENTS\n");
    }
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
    env: {},
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
    assert.equal(existsSync(paths.opencode), false);
    assert.equal(existsSync(paths.opencodeConfig), false);
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
    assert.equal(existsSync(paths.opencode), false);
    assert.equal(readFileSync(join(paths.codex, ".codex-plugin", "plugin.json"), "utf8").includes("+local.codex."), true);
    const marketplace = JSON.parse(readFileSync(paths.marketplace, "utf8"));
    assert.equal(marketplace.name, "geldmacher-personal");
    assert.equal(marketplace.plugins[0].source.path, `./.codex/plugins/${plugin}`);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("fixture deployments ignore inherited OpenCode and XDG config paths", () => {
  const parent = mkdtempSync(join(tmpdir(), "workflow-deploy-environment-"));
  try {
    const opencode = join(parent, "host-opencode");
    const xdg = join(parent, "host-xdg");
    const env = { ...process.env, OPENCODE_CONFIG_DIR: opencode, XDG_CONFIG_HOME: xdg };
    // The subprocess needs its own runner, not the parent's internal child protocol.
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--test",
      "--test-reporter=tap",
      "--test-name-pattern=^first install is physical and a second identical deploy is a no-op$",
      join(defaultRoot, "tests/local-plugin-deploy.test.mjs"),
    ], {
      cwd: parent,
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^# pass 1$/m);
    assert.equal(existsSync(opencode), false);
    assert.equal(existsSync(xdg), false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
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
    assert.deepEqual(Object.keys(first.targets).sort(), ["codex", "cursor", "opencode"]);
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

test("OpenCode-only install registers skills and commands without touching Cursor or Codex", () => {
  const item = fixture();
  try {
    const result = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      codexStateReader: () => { throw new Error("OpenCode-only deploy must not inspect Codex"); },
      codexInstaller: () => { throw new Error("OpenCode-only deploy must not install Codex"); },
    });
    const paths = deploymentPaths(item.home, plugin);
    assert.equal(result.opencode.config_change, true);
    assert.equal(result.opencode.command_change, true);
    assert.equal(existsSync(paths.cursor), false);
    assert.equal(existsSync(paths.codex), false);
    const config = JSON.parse(readFileSync(paths.opencodeConfig, "utf8"));
    assert.deepEqual(config.skills, [result.opencode.skills]);
    assert.equal(readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8"), readFileSync(join(paths.opencode, "commands", "plan-work.md"), "utf8"));
    const second = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      deployedAt: "2026-08-11T12:00:00.000Z",
    });
    assert.equal(second.no_op, true);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("OpenCode install preserves JSONC and refuses an unrelated command", () => {
  const item = fixture();
  try {
    const paths = deploymentPaths(item.home, plugin);
    mkdirSync(paths.opencodeCommands, { recursive: true });
    const jsonc = "{\n  // keep this comment\n  \"skills\": [\"./team\"]\n}\n";
    writeFileSync(paths.opencodeConfigComments, jsonc);
    writeFileSync(join(paths.opencodeCommands, "plan-work.md"), "user command\n");
    assert.throws(() => deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
    }), /not a Workflow command/);
    assert.equal(readFileSync(paths.opencodeConfigComments, "utf8"), jsonc);
    assert.equal(existsSync(paths.opencodeConfig), false);
    assert.equal(existsSync(paths.opencode), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("OpenCode registration uses exact active skills entries in JSONC", async () => {
  const parent = mkdtempSync(join(tmpdir(), "workflow-opencode-registration-"));
  try {
    const built = buildPluginTargets(join(parent, ".build/plugins"));
    const product = "geldmacher-workflow";
    const skillPath = `~/.config/opencode/${product}/skills`;
    const scenarios = [
      { name: "commented", text: `{\n // "skills": ["${skillPath}"]\n "skills": []\n}\n`, registered: false },
      { name: "different-path", text: JSON.stringify({ skills: [`${skillPath}-backup`] }), registered: false },
      { name: "unrelated-value", text: JSON.stringify({ instructions: [skillPath], skills: [] }), registered: false },
      { name: "active", text: `{\n // retain this comment\n "skills": ["${skillPath}",],\n}\n`, registered: true },
      { name: "escaped", text: JSON.stringify({ skills: [skillPath] }).replace("/skills", "/\\u0073kills"), registered: true },
    ];
    for (const scenario of scenarios) {
      const home = join(parent, scenario.name);
      const paths = deploymentPaths(home, product);
      mkdirSync(join(home, ".config/opencode"), { recursive: true });
      writeFileSync(paths.opencodeConfigComments, scenario.text);
      const options = { root: defaultRoot, targetsRoot: parent, plugin: product, baseVersion: built.version, home, gitHead, gitDirty: true, hosts: ["opencode"], env: {} };
      const before = await deploymentStatus(options);
      assert.equal(before.opencode.registered, scenario.registered, scenario.name);
      const deployed = deployPreparedTargets(options);
      assert.equal(deployed.opencode.config_change, !scenario.registered, scenario.name);
      assert.equal(existsSync(paths.opencodeConfig), !scenario.registered, scenario.name);
      if (!scenario.registered) {
        assert.deepEqual(JSON.parse(readFileSync(paths.opencodeConfig, "utf8")).skills, [deployed.opencode.skills]);
      }
      assert.equal(readFileSync(paths.opencodeConfigComments, "utf8"), scenario.text, scenario.name);
      assert.equal((await deploymentStatus(options)).current, true, scenario.name);
      assert.equal(deployPreparedTargets(options).no_op, true, scenario.name);
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test("OpenCode malformed JSONC stops deployment and status before installation", async () => {
  const item = fixture();
  try {
    const paths = deploymentPaths(item.home, plugin);
    mkdirSync(join(item.home, ".config/opencode"), { recursive: true });
    const malformed = `{ "skills": ["~/.config/opencode/${plugin}/skills", }`;
    writeFileSync(paths.opencodeConfigComments, malformed);
    const options = { ...metadata(item.repository), home: item.home, hosts: ["opencode"], env: {} };
    assert.throws(() => deployPreparedTargets(options), /invalid OpenCode JSONC/);
    await assert.rejects(deploymentStatus({ ...options, root: defaultRoot }), /invalid OpenCode JSONC/);
    assert.equal(readFileSync(paths.opencodeConfigComments, "utf8"), malformed);
    assert.equal(existsSync(paths.opencodeConfig), false);
    assert.equal(existsSync(paths.opencode), false);
    assert.equal(existsSync(paths.opencodeCommands), false);
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("OpenCode custom config directories stop deploy, preview and status without writes", async () => {
  const item = fixture();
  try {
    const paths = deploymentPaths(item.home, plugin);
    for (const variable of ["OPENCODE_CONFIG_DIR", "XDG_CONFIG_HOME"]) {
      const custom = join(item.home, variable);
      const env = { [variable]: custom };
      const options = { ...metadata(item.repository), home: item.home, hosts: ["opencode"], env };
      const diagnostic = /unsupported OpenCode configuration directory/;
      for (const dryRun of [true, false]) assert.throws(() => deployPreparedTargets({ ...options, dryRun }), diagnostic, variable);
      await assert.rejects(deploymentStatus(options), diagnostic, variable);
      assert.equal(existsSync(custom), false, variable);
      assert.equal(existsSync(paths.opencode), false, variable);
      assert.equal(existsSync(paths.opencodeConfig), false, variable);
      assert.equal(existsSync(paths.opencodeCommands), false, variable);
      // OpenCode settings must not block a separately selected host.
      assert.deepEqual(deployPreparedTargets({ ...options, hosts: ["cursor"], dryRun: true }).selected_hosts, ["cursor"]);
    }
    const standard = join(item.home, ".config/opencode");
    for (const env of [
      { OPENCODE_CONFIG_DIR: standard },
      { XDG_CONFIG_HOME: join(item.home, ".config") },
      { OPENCODE_CONFIG_DIR: standard, XDG_CONFIG_HOME: join(item.home, "ignored") },
    ]) {
      const options = { ...metadata(item.repository), home: item.home, hosts: ["opencode"], env };
      assert.deepEqual(deployPreparedTargets({ ...options, dryRun: true }).selected_hosts, ["opencode"]);
      assert.equal((await deploymentStatus({ ...options, root: defaultRoot })).opencode.registered, false);
    }
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("OpenCode config directory diagnostics reach physical and aliased CLIs", () => {
  const parent = mkdtempSync(join(tmpdir(), "workflow-opencode-cli-"));
  try {
    const script = join(defaultRoot, "scripts/local-plugin-deploy.mjs");
    const alias = join(parent, "deploy.mjs");
    symlinkSync(script, alias);
    const home = join(parent, "home");
    for (const variable of ["OPENCODE_CONFIG_DIR", "XDG_CONFIG_HOME"]) {
      const env = { ...process.env, LOCAL_PLUGIN_HOME: home };
      delete env.OPENCODE_CONFIG_DIR;
      delete env.XDG_CONFIG_HOME;
      env[variable] = join(home, "custom-config");
      for (const path of [script, alias]) {
        for (const args of [["deploy", "--dry-run", "--opencode-only"], ["status", "--opencode-only"]]) {
          const result = spawnSync(process.execPath, [path, ...args], { env, encoding: "utf8" });
          assert.equal(result.status, 1, result.stderr);
          assert.match(result.stderr, /unsupported OpenCode configuration directory/);
          assert.match(result.stderr, new RegExp(variable));
          assert.equal(result.stdout, "");
          assert.equal(existsSync(home), false);
        }
      }
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

function isolatedOpenCodeEnv(home) {
  return { XDG_CONFIG_HOME: join(home, ".config") };
}

function backupDirectories(root) {
  return readdirSync(root).filter((name) => !name.startsWith(".")).sort();
}

test("OpenCode deploy merges a shared config under an isolated XDG_CONFIG_HOME, backs it up, and uninstalls only its entries", () => {
  const item = fixture();
  try {
    const env = isolatedOpenCodeEnv(item.home);
    const paths = deploymentPaths(item.home, plugin);
    const skillsPath = openCodeSkillsPath(item.home, plugin);
    const leaked = join(homedir(), ".config", "opencode", ".local-deploy-backups", plugin);
    assert.equal(existsSync(leaked), false);
    const foreignSkills = ["./efficiency/skills", "~/.config/opencode/design/skills"];
    const originalDocument = { model: "keep-me", plugin: ["efficiency"], skills: [...foreignSkills] };
    const mergedOnce = updateOpenCodeDocument(originalDocument, skillsPath, item.home);
    const mergedTwice = updateOpenCodeDocument(mergedOnce, skillsPath, item.home);
    assert.deepEqual(originalDocument.skills, foreignSkills);
    assert.equal(mergedOnce.model, "keep-me");
    assert.deepEqual(mergedOnce.plugin, ["efficiency"]);
    assert.deepEqual(mergedOnce.skills, [...foreignSkills, skillsPath]);
    assert.deepEqual(mergedTwice, mergedOnce);
    const tilde = `~/.config/opencode/${plugin}/skills`;
    assert.deepEqual(updateOpenCodeDocument({ theme: "dark", skills: [tilde, tilde] }, skillsPath, item.home), { theme: "dark", skills: [tilde, tilde] });

    mkdirSync(paths.opencodeCommands, { recursive: true });
    const foreignCommand = "efficiency command\n";
    writeFileSync(join(paths.opencodeCommands, "efficiency.md"), foreignCommand);
    const original = `${JSON.stringify(originalDocument, null, 2)}\n`;
    writeFileSync(paths.opencodeConfig, original);
    const jsonc = "{\n  // other plugin\n  \"skills\": [\"./design/skills\"]\n}\n";
    writeFileSync(paths.opencodeConfigComments, jsonc);

    const first = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      env,
      deployedAt: "2026-08-10T12:00:00.000Z",
    });
    const installed = JSON.parse(readFileSync(paths.opencodeConfig, "utf8"));
    assert.equal(first.no_op, false);
    assert.equal(first.opencode.config_change, true);
    assert.equal(installed.model, "keep-me");
    assert.deepEqual(installed.plugin, ["efficiency"]);
    assert.deepEqual(installed.skills, [...foreignSkills, skillsPath]);
    assert.equal(readFileSync(join(paths.opencodeCommands, "efficiency.md"), "utf8"), foreignCommand);
    assert.match(readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8"), /Load the `plan-work` skill/);
    assert.equal(readFileSync(paths.opencodeConfigComments, "utf8"), jsonc);
    const backups = backupDirectories(paths.opencodeBackups);
    assert.equal(backups.length, 1);
    assert.equal(isInside(item.home, join(paths.opencodeBackups, backups[0])), true);
    const deployBackup = JSON.parse(readFileSync(join(paths.opencodeBackups, backups[0], "manifest.json"), "utf8"));
    assert.equal(deployBackup.plugin, plugin);
    assert.equal(deployBackup.reason, "deploy");
    assert.equal(readFileSync(join(paths.opencodeBackups, backups[0], "opencode.json"), "utf8"), original);
    assert.equal(first.opencode.backup, join(paths.opencodeBackups, backups[0]));

    const installedBytes = readFileSync(paths.opencodeConfig);
    const second = deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      env,
      deployedAt: "2026-08-10T12:05:00.000Z",
    });
    assert.equal(second.no_op, true);
    assert.equal(second.opencode.backup, null);
    assert.ok(readFileSync(paths.opencodeConfig).equals(installedBytes));
    assert.deepEqual(backupDirectories(paths.opencodeBackups), backups);
    assert.equal(readFileSync(join(paths.opencodeCommands, "efficiency.md"), "utf8"), foreignCommand);

    installed.skills.push(skillsPath);
    installed.skills.push("~/.config/opencode/later/skills");
    installed.theme = "dark";
    writeFileSync(paths.opencodeConfig, `${JSON.stringify(installed, null, 2)}\n`);
    const removed = uninstallOpenCodeDeployment({
      plugin,
      home: item.home,
      env,
      deployedAt: "2026-08-10T13:00:00.000Z",
    });
    assert.equal(removed.no_op, false);
    assert.deepEqual(removed.opencode.skills_removed, [skillsPath, skillsPath]);
    assert.deepEqual(removed.opencode.commands_removed, ["plan-work.md"]);
    assert.equal(removed.opencode.package_removed, true);
    const after = JSON.parse(readFileSync(paths.opencodeConfig, "utf8"));
    assert.equal(after.model, "keep-me");
    assert.equal(after.theme, "dark");
    assert.deepEqual(after.plugin, ["efficiency"]);
    assert.deepEqual(after.skills, [...foreignSkills, "~/.config/opencode/later/skills"]);
    assert.equal(existsSync(join(paths.opencodeCommands, "plan-work.md")), false);
    assert.equal(readFileSync(join(paths.opencodeCommands, "efficiency.md"), "utf8"), foreignCommand);
    assert.equal(existsSync(paths.opencode), false);
    assert.equal(readFileSync(paths.opencodeConfigComments, "utf8"), jsonc);
    const afterBackups = backupDirectories(paths.opencodeBackups);
    assert.equal(afterBackups.length, 2);
    const uninstallBackup = afterBackups.find((name) => name !== backups[0]);
    const uninstallManifest = JSON.parse(readFileSync(join(paths.opencodeBackups, uninstallBackup, "manifest.json"), "utf8"));
    assert.equal(uninstallManifest.reason, "uninstall");
    assert.ok(JSON.parse(readFileSync(join(paths.opencodeBackups, uninstallBackup, "opencode.json"), "utf8")).skills.includes(skillsPath));
    const afterBytes = readFileSync(paths.opencodeConfig);
    const again = uninstallOpenCodeDeployment({ plugin, home: item.home, env, deployedAt: "2026-08-10T14:00:00.000Z" });
    assert.equal(again.no_op, true);
    assert.equal(again.backup, null);
    assert.ok(readFileSync(paths.opencodeConfig).equals(afterBytes));
    assert.deepEqual(backupDirectories(paths.opencodeBackups), afterBackups);
    assert.equal(existsSync(leaked), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("failed OpenCode deploy restores the shared config from its persistent backup", () => {
  const item = fixture();
  try {
    const env = isolatedOpenCodeEnv(item.home);
    const paths = deploymentPaths(item.home, plugin);
    mkdirSync(paths.opencodeCommands, { recursive: true });
    const foreignCommand = "efficiency command\n";
    const previousCommand = "Load the `plan-work` skill and apply it to the current request.\nprevious\n";
    writeFileSync(join(paths.opencodeCommands, "efficiency.md"), foreignCommand);
    writeFileSync(join(paths.opencodeCommands, "plan-work.md"), previousCommand);
    const original = `${JSON.stringify({ model: "keep", skills: ["./efficiency/skills"] }, null, 2)}\n`;
    writeFileSync(paths.opencodeConfig, original);
    assert.throws(() => deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      env,
      deployedAt: "2026-08-10T12:00:00.000Z",
      simulateFailure: "after-opencode-commands",
    }), /deployment rolled back/);
    assert.equal(readFileSync(paths.opencodeConfig, "utf8"), original);
    assert.equal(readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8"), previousCommand);
    assert.equal(readFileSync(join(paths.opencodeCommands, "efficiency.md"), "utf8"), foreignCommand);
    assert.equal(existsSync(paths.opencode), false);
    const backups = backupDirectories(paths.opencodeBackups);
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(join(paths.opencodeBackups, backups[0], "opencode.json"), "utf8"), original);
    const manifest = JSON.parse(readFileSync(join(paths.opencodeBackups, backups[0], "manifest.json"), "utf8"));
    assert.equal(manifest.files.find((file) => file.kind === "opencode-command" && file.path.endsWith("plan-work.md")).existed, true);
    assert.equal(readFileSync(join(paths.opencodeBackups, backups[0], "commands", "plan-work.md"), "utf8"), previousCommand);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("OpenCode uninstall CLI removes only this plugin under an isolated XDG_CONFIG_HOME", () => {
  const parent = mkdtempSync(join(tmpdir(), "workflow-opencode-uninstall-cli-"));
  try {
    const script = join(defaultRoot, "scripts/local-plugin-deploy.mjs");
    const alias = join(parent, "deploy.mjs");
    symlinkSync(script, alias);
    const home = join(parent, "home");
    const pluginName = JSON.parse(readFileSync(join(defaultRoot, ".cursor-plugin/plugin.json"), "utf8")).name;
    const paths = deploymentPaths(home, pluginName);
    const skills = openCodeSkillsPath(home, pluginName);
    const leaked = join(homedir(), ".config", "opencode", ".local-deploy-backups", pluginName);
    const leakedBefore = existsSync(leaked);
    mkdirSync(join(paths.opencode, "commands"), { recursive: true });
    mkdirSync(join(paths.opencode, ".opencode-plugin"), { recursive: true });
    writeFileSync(join(paths.opencode, ".opencode-plugin/plugin.json"), `${JSON.stringify({ name: pluginName, version: "1.0.0" })}\n`);
    const command = "Load the `plan-work` skill and apply it to the current request.\n";
    writeFileSync(join(paths.opencode, "commands", "plan-work.md"), command);
    mkdirSync(paths.opencodeCommands, { recursive: true });
    writeFileSync(join(paths.opencodeCommands, "plan-work.md"), command);
    writeFileSync(join(paths.opencodeCommands, "efficiency.md"), "leave me\n");
    writeFileSync(join(paths.opencodeCommands, "review-work.md"), "Load the `review-work` skill and apply it to the current request.\n");
    writeFileSync(paths.opencodeConfig, `${JSON.stringify({ model: "keep", skills: ["./efficiency/skills", skills] }, null, 2)}\n`);
    const env = { ...process.env, LOCAL_PLUGIN_HOME: home, XDG_CONFIG_HOME: join(home, ".config") };
    delete env.OPENCODE_CONFIG_DIR;
    for (const path of [script, alias]) {
      const invalid = spawnSync(process.execPath, [path, "uninstall", "--cursor-only"], { env, encoding: "utf8" });
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /use --opencode-only/);
      assert.equal(invalid.stdout, "");
    }
    const removed = spawnSync(process.execPath, [script, "uninstall", "--opencode-only"], { env, encoding: "utf8" });
    assert.equal(removed.status, 0, removed.stderr);
    const payload = JSON.parse(removed.stdout);
    assert.equal(payload.no_op, false);
    assert.deepEqual(JSON.parse(readFileSync(paths.opencodeConfig, "utf8")).skills, ["./efficiency/skills"]);
    assert.equal(JSON.parse(readFileSync(paths.opencodeConfig, "utf8")).model, "keep");
    assert.equal(existsSync(join(paths.opencodeCommands, "plan-work.md")), false);
    assert.equal(readFileSync(join(paths.opencodeCommands, "efficiency.md"), "utf8"), "leave me\n");
    assert.match(readFileSync(join(paths.opencodeCommands, "review-work.md"), "utf8"), /Load the `review-work` skill/);
    assert.equal(existsSync(paths.opencode), false);
    assert.equal(backupDirectories(paths.opencodeBackups).length, 1);
    const again = spawnSync(process.execPath, [alias, "uninstall"], { env, encoding: "utf8" });
    assert.equal(again.status, 0, again.stderr);
    assert.equal(JSON.parse(again.stdout).no_op, true);
    assert.equal(backupDirectories(paths.opencodeBackups).length, 1);
    assert.equal(existsSync(leaked), leakedBefore);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("rollback reports every failed restore instead of stopping at the first", () => {
  const item = fixture();
  try {
    const env = isolatedOpenCodeEnv(item.home);
    const options = {
      ...metadata(item.repository),
      home: item.home,
      env,
      codexStateReader: neverCurrent,
      codexInstaller: successfulInstaller,
    };
    deployPreparedTargets({ ...options, deployedAt: "2026-08-10T12:00:00.000Z" });
    const paths = deploymentPaths(item.home, plugin);
    const previousCommand = readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8");
    writeFileSync(join(item.repository, ".build", "plugins", "cursor", plugin, "payload.txt"), "cursor-second\n");
    writeFileSync(join(item.repository, ".build", "plugins", "codex", plugin, "payload.txt"), "codex-second\n");
    writeFileSync(join(item.repository, ".build", "plugins", "opencode", plugin, "commands", "plan-work.md"), `${previousCommand}changed\n`);
    assert.throws(() => deployPreparedTargets({
      ...options,
      deployedAt: "2026-08-10T12:02:00.000Z",
      simulateFailure: "after-opencode-commands",
      simulateRollbackFailures: ["cursor", "codex"],
    }), (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.message, /rollback was incomplete/);
      assert.match(error.message, /simulated failure after OpenCode command update/);
      assert.match(error.message, /cursor restore failed: simulated cursor restore failure/);
      assert.match(error.message, /codex restore failed: simulated codex restore failure/);
      assert.equal(error.errors.length, 3);
      return true;
    });
    assert.equal(readFileSync(join(paths.cursor, "payload.txt"), "utf8"), "cursor-second\n");
    assert.equal(readFileSync(join(paths.codex, "payload.txt"), "utf8"), "codex-second\n");
    assert.equal(readFileSync(join(paths.opencode, "payload.txt"), "utf8"), "first\n");
    assert.equal(readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8"), previousCommand);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("an interrupted atomic write removes its temporary file and stale leftovers", () => {
  const item = fixture();
  try {
    const env = isolatedOpenCodeEnv(item.home);
    const paths = deploymentPaths(item.home, plugin);
    mkdirSync(dirname(paths.opencodeConfig), { recursive: true });
    const original = `${JSON.stringify({ model: "keep", skills: ["./efficiency/skills"] }, null, 2)}\n`;
    writeFileSync(paths.opencodeConfig, original);
    const directory = dirname(paths.opencodeConfig);
    const stale = join(directory, `.opencode.json.999999999.${randomUUID()}.tmp`);
    const live = join(directory, `.opencode.json.${process.pid}.${randomUUID()}.tmp`);
    writeFileSync(stale, "stale");
    writeFileSync(live, "live");
    assert.throws(() => deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      env,
      deployedAt: "2026-08-10T12:00:00.000Z",
      simulateFailure: "during-atomic-write",
    }), /deployment rolled back: simulated atomic write failure/);
    assert.equal(existsSync(stale), false);
    assert.equal(readFileSync(live, "utf8"), "live");
    assert.deepEqual(readdirSync(directory).filter((name) => name.endsWith(".tmp")), [basename(live)]);
    assert.equal(readFileSync(paths.opencodeConfig, "utf8"), original);
    assert.equal(existsSync(paths.opencode), false);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("OpenCode config and command writes roll back with the package", () => {
  const item = fixture();
  try {
    const paths = deploymentPaths(item.home, plugin);
    mkdirSync(join(paths.opencodeConfig, ".."), { recursive: true });
    const original = `${JSON.stringify({ model: "keep", skills: ["./team"] }, null, 2)}\n`;
    writeFileSync(paths.opencodeConfig, original);
    deployPreparedTargets({ ...metadata(item.repository), home: item.home, hosts: ["opencode"] });
    const installed = readFileSync(paths.opencodeConfig, "utf8");
    assert.notEqual(installed, original);
    assert.deepEqual(updateOpenCodeDocument(JSON.parse(original), JSON.parse(installed).skills.at(-1)).skills, JSON.parse(installed).skills);
    writeFileSync(join(item.repository, ".build", "plugins", "opencode", plugin, "payload.txt"), "second\n");
    assert.throws(() => deployPreparedTargets({
      ...metadata(item.repository),
      home: item.home,
      hosts: ["opencode"],
      deployedAt: "2026-08-10T12:02:00.000Z",
      simulateFailure: "after-opencode-commands",
    }), /rolled back/);
    assert.equal(readFileSync(paths.opencodeConfig, "utf8"), installed);
    assert.equal(readFileSync(join(paths.opencode, "payload.txt"), "utf8"), "first\n");
    assert.match(readFileSync(join(paths.opencodeCommands, "plan-work.md"), "utf8"), /Load the `plan-work` skill/);
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
