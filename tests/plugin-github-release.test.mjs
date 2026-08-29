import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { parseDocument } from "yaml";
import { buildPluginTargets } from "../scripts/build-plugin-targets.mjs";
import {
  PLUGIN_NAME,
  canonicalJson,
  defaultRunner,
  inspectReleaseTarget,
  prepareRelease,
  publishRelease,
  releaseNotesFromChangelog,
  releaseStatus,
  verifyPreparedRelease,
} from "../scripts/plugin-github-release.mjs";

const version = "1.2.3";

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function repositoryFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "workflow-github-release-test-"));
  const repository = join(fixtureRoot, "repository");
  mkdirSync(repository);
  writeJson(join(repository, "package.json"), { name: "fixture", version, private: true });
  const common = { name: PLUGIN_NAME, version, repository: "https://github.com/geldmacher/workflow" };
  writeJson(join(repository, ".cursor-plugin", "plugin.json"), common);
  writeJson(join(repository, "targets", "codex", ".codex-plugin", "plugin.json"), common);
  writeJson(join(repository, "targets", "agent-plugins", "plugin.json"), common);
  writeFileSync(join(repository, "CHANGELOG.md"), `# Changelog\n\n## Unreleased\n\n## ${version}\n\n- Added deterministic release fixtures.\n`);
  writeFileSync(join(repository, ".gitignore"), ".build/\n");
  git(repository, "init", "--quiet");
  git(repository, "remote", "add", "origin", "git@github.com:geldmacher/workflow.git");
  git(repository, "add", ".");
  execFileSync("git", [
    "-c", "user.name=Workflow Release Test",
    "-c", "user.email=workflow-release@invalid.local",
    "commit", "--quiet", "-m", "fixture",
  ], { cwd: repository });
  return { fixtureRoot, repository };
}

function productionSnapshotFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "workflow-production-release-test-"));
  const source = resolve(import.meta.dirname, "..");
  const repository = join(fixtureRoot, "repository");
  const excluded = new Set([".build", ".git", "node_modules"]);
  cpSync(source, repository, {
    recursive: true,
    filter(path) {
      const item = relative(source, path);
      return item === "" || !excluded.has(item.split(sep, 1)[0]);
    },
  });
  const packageJson = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
  const marker = `immutable-source-${basename(fixtureRoot)}`;
  const installationPath = join(repository, "docs", "installation.md");
  writeFileSync(installationPath, `${readFileSync(installationPath, "utf8")}\n<!-- ${marker} -->\n`);
  const changelogPath = join(repository, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8").replace(
    /(^## Unreleased\s*$)[\s\S]*?(?=^##\s+)/m,
    "$1\n\n",
  );
  releaseNotesFromChangelog(changelog, packageJson.version);
  writeFileSync(changelogPath, changelog);
  git(repository, "init", "--quiet");
  git(repository, "remote", "add", "origin", "git@github.com:geldmacher/workflow.git");
  git(repository, "add", ".");
  execFileSync("git", [
    "-c", "user.name=Workflow Release Test",
    "-c", "user.email=workflow-release@invalid.local",
    "commit", "--quiet", "-m", "release-ready production snapshot",
  ], { cwd: repository });
  return { fixtureRoot, marker, repository, version: packageJson.version };
}

function targetBuilder(outputRoot) {
  const result = { version };
  for (const host of ["cursor", "codex"]) {
    const directory = join(outputRoot, host, PLUGIN_NAME);
    const manifest = host === "cursor" ? ".cursor-plugin" : ".codex-plugin";
    writeJson(join(directory, manifest, "plugin.json"), { name: PLUGIN_NAME, version });
    mkdirSync(join(directory, "docs"));
    writeFileSync(join(directory, "README.md"), `# ${host}\n\n[Install](docs/installation.md)\n`);
    writeFileSync(join(directory, "docs", "installation.md"), "# Install\n");
    mkdirSync(join(directory, "scripts"));
    writeFileSync(join(directory, "scripts", "validate-artifact.mjs"), "#!/usr/bin/env node\n");
    chmodSync(join(directory, "scripts", "validate-artifact.mjs"), 0o755);
    result[host] = { path: directory };
  }
  return result;
}

function prepareFixture(item, releaseRoot = join(item.fixtureRoot, "releases")) {
  return prepareRelease({
    root: item.repository,
    releaseRoot,
    targetBuilder,
    releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
  });
}

function zipEntries(path) {
  const bytes = readFileSync(path);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  assert.notEqual(eocd, -1, "ZIP end-of-central-directory record is missing");
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, "ZIP central directory entry is invalid");
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    entries.push({
      name: bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
      mode: (bytes.readUInt32LE(offset + 38) >>> 16) & 0xffff,
      method: bytes.readUInt16LE(offset + 10),
      compressedSize: bytes.readUInt32LE(offset + 20),
      localOffset: bytes.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function zipEntryText(path, name) {
  const bytes = readFileSync(path);
  const entry = zipEntries(path).find((candidate) => candidate.name === name);
  assert.ok(entry, `ZIP entry is missing: ${name}`);
  assert.equal(bytes.readUInt32LE(entry.localOffset), 0x04034b50, "ZIP local entry is invalid");
  const nameLength = bytes.readUInt16LE(entry.localOffset + 26);
  const extraLength = bytes.readUInt16LE(entry.localOffset + 28);
  const contentOffset = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(contentOffset, contentOffset + entry.compressedSize);
  if (entry.method === 0) return compressed.toString("utf8");
  assert.equal(entry.method, 8, "ZIP entry uses an unsupported compression method");
  return inflateRawSync(compressed).toString("utf8");
}

function exactView(prepared) {
  const provenance = prepared.provenance;
  return {
    tagName: provenance.tag,
    isDraft: false,
    isPrerelease: false,
    name: `Workflow ${provenance.version}`,
    body: readFileSync(join(prepared.directory, "RELEASE_NOTES.md"), "utf8"),
    assets: provenance.published_assets.map((name) => ({ name })),
    url: `https://github.com/geldmacher/workflow/releases/tag/${provenance.tag}`,
  };
}

function publicationRunner(prepared, {
  authenticated = true,
  tagCommit,
  tagCommits,
  views = [],
  createStatus = 0,
  corruptDownload = false,
  onDownload = null,
} = {}) {
  const calls = [];
  const queuedViews = [...views];
  const queuedTagCommits = tagCommits ? [...tagCommits] : null;
  const runner = (command, args, options = {}) => {
    calls.push([command, [...args]]);
    if (command === "git" && args[0] === "ls-remote") {
      const commit = queuedTagCommits?.length ? queuedTagCommits.shift() : tagCommit;
      return { status: 0, stdout: commit ? `${commit}\trefs/tags/${prepared.provenance.tag}\n` : "", stderr: "" };
    }
    if (command !== "gh") return defaultRunner(command, args, options);
    if (args[0] === "auth") return authenticated
      ? { status: 0, stdout: "authenticated\n", stderr: "" }
      : { status: 1, stdout: "", stderr: "authentication failed" };
    if (args[0] === "release" && args[1] === "view") {
      const value = queuedViews.shift();
      return value == null
        ? { status: 1, stdout: "", stderr: "release not found" }
        : { status: 0, stdout: JSON.stringify(value), stderr: "" };
    }
    if (args[0] === "release" && args[1] === "create") {
      return createStatus === 0
        ? { status: 0, stdout: exactView(prepared).url, stderr: "" }
        : { status: createStatus, stdout: "", stderr: "create failed" };
    }
    if (args[0] === "release" && args[1] === "download") {
      const destination = args[args.indexOf("--dir") + 1];
      mkdirSync(destination, { recursive: true });
      for (const name of prepared.provenance.published_assets) {
        copyFileSync(join(prepared.directory, name), join(destination, name));
      }
      if (corruptDownload) writeFileSync(join(destination, prepared.provenance.targets.cursor.archive), "corrupt\n");
      onDownload?.();
      return { status: 0, stdout: "", stderr: "" };
    }
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  };
  return { runner, calls };
}

test("release Skill is explicit-only and stays in parity with the Cursor command and package scripts", () => {
  const root = join(import.meta.dirname, "..");
  const skill = readFileSync(join(root, ".agents", "skills", "release-plugin", "SKILL.md"), "utf8");
  const metadata = readFileSync(join(root, ".agents", "skills", "release-plugin", "agents", "openai.yaml"), "utf8");
  const command = readFileSync(join(root, ".cursor", "commands", "release-plugin.md"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  assert.equal(parseDocument(frontmatter[1], { uniqueKeys: true }).errors.length, 0);
  assert.equal(parseDocument(metadata, { uniqueKeys: true }).errors.length, 0);
  assert.match(skill, /^name: release-plugin$/m);
  assert.match(skill, /only when the user explicitly invokes \$release-plugin/i);
  assert.match(metadata, /allow_implicit_invocation:\s*false/);
  for (const invocation of [
    "npm run release:status",
    "npm run release:prepare",
    "npm run release:publish -- <receipt-sha256>",
  ]) {
    assert.match(skill, new RegExp(invocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(command, new RegExp(invocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(packageJson.scripts["release:status"], "node scripts/plugin-github-release.mjs status");
  assert.equal(packageJson.scripts["release:prepare"], "node scripts/plugin-github-release.mjs prepare");
  assert.equal(packageJson.scripts["release:publish"], "node scripts/plugin-github-release.mjs publish");
  for (const source of [skill, command]) {
    assert.match(source, /must not commit|Never infer publication|Never infer publication authority/i);
    assert.match(source, /--clobber/);
    assert.match(source, /delete/i);
  }
});

test("release notes require an empty Unreleased section and an exact non-empty version section", () => {
  assert.equal(
    releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n## ${version}\n\n- Ready.\n`, version),
    `# Workflow ${version}\n\n- Ready.\n`,
  );
  assert.throws(() => releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n- Pending.\n\n## ${version}\n\n- Ready.\n`, version), /Unreleased must be empty/);
  assert.throws(() => releaseNotesFromChangelog("# Changelog\n\n## Unreleased\n", version), /no non-empty/);
});

test("status is read-only, defaults preparation readiness correctly, and includes remote tag readiness", () => {
  const item = repositoryFixture();
  try {
    const unauthenticated = (command, args, options) => command === "gh"
      ? { status: 1, stdout: "", stderr: "authentication failed" }
      : defaultRunner(command, args, options);
    const initial = releaseStatus({ root: item.repository, releaseRoot: join(item.fixtureRoot, "releases"), runner: unauthenticated });
    assert.equal(initial.action, "status");
    assert.equal(initial.ready_to_prepare, true);
    assert.equal(initial.ready_to_publish, false);
    assert.equal(initial.prepared, null);
    assert.equal(initial.github_authenticated, false);

    const prepared = prepareFixture(item);
    const stub = publicationRunner(prepared, { tagCommit: prepared.provenance.source.commit_sha });
    const ready = releaseStatus({ root: item.repository, releaseRoot: join(item.fixtureRoot, "releases"), runner: stub.runner });
    assert.equal(ready.ready_to_prepare, true);
    assert.equal(ready.ready_to_publish, true);
    assert.equal(ready.prepared.receipt, prepared.receipt);
    assert.equal(ready.remote_tag.matches_source, true);
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && args.includes("create")), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("status marks a valid prepared set stale after a same-version source commit", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    writeFileSync(join(item.repository, "same-version-change.txt"), "new source snapshot\n");
    git(item.repository, "add", "same-version-change.txt");
    execFileSync("git", [
      "-c", "user.name=Workflow Release Test",
      "-c", "user.email=workflow-release@invalid.local",
      "commit", "--quiet", "-m", "same-version source change",
    ], { cwd: item.repository });
    const currentCommit = git(item.repository, "rev-parse", "HEAD");
    const stub = publicationRunner(prepared, { tagCommit: currentCommit });
    const status = releaseStatus({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    });
    assert.equal(status.prepared.valid, true);
    assert.equal(status.prepared.current, false);
    assert.equal(status.prepared.stale, true);
    assert.match(status.prepared.error, /commit differs|Git tree differs/);
    assert.equal(status.ready_to_prepare, false);
    assert.equal(status.ready_to_publish, false);
    assert.ok(status.prepare_blockers.some((blocker) => /prepared release is stale/.test(blocker)));
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("prepare rejects dirty state, manifest version drift, and a failed release gate", () => {
  const item = repositoryFixture();
  try {
    writeFileSync(join(item.repository, "dirty.txt"), "dirty\n");
    assert.throws(() => prepareFixture(item), /repository must be clean/);
    rmSync(join(item.repository, "dirty.txt"));

    writeJson(join(item.repository, "targets", "codex", ".codex-plugin", "plugin.json"), {
      name: PLUGIN_NAME,
      version: "9.9.9",
      repository: "https://github.com/geldmacher/workflow",
    });
    assert.throws(() => prepareFixture(item), /codex manifest version .* differs/);
    writeJson(join(item.repository, "targets", "codex", ".codex-plugin", "plugin.json"), {
      name: PLUGIN_NAME,
      version,
      repository: "https://github.com/geldmacher/workflow",
    });

    assert.throws(() => prepareRelease({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      targetBuilder,
      releaseGate: () => { throw new Error("release gate failed"); },
    }), /release gate failed/);
    assert.equal(existsSync(join(item.fixtureRoot, "releases", `v${version}`)), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("prepare uses an immutable HEAD materialization and rejects live source drift during the build", () => {
  const item = repositoryFixture();
  try {
    const changelogPath = join(item.repository, "CHANGELOG.md");
    const committedChangelog = readFileSync(changelogPath, "utf8");
    let observedSnapshot = null;
    const driftingBuilder = (outputRoot, sourceRoot) => {
      observedSnapshot = sourceRoot;
      assert.notEqual(resolve(sourceRoot), resolve(item.repository));
      assert.equal(readFileSync(join(sourceRoot, "CHANGELOG.md"), "utf8"), committedChangelog);
      writeFileSync(changelogPath, `${committedChangelog}\n<!-- live build drift -->\n`);
      return targetBuilder(outputRoot, sourceRoot);
    };
    assert.throws(() => prepareRelease({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      targetBuilder: driftingBuilder,
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    }), /repository must be clean|repository drifted while building release assets/);
    assert.ok(observedSnapshot);
    assert.equal(existsSync(observedSnapshot), false, "temporary immutable source must be removed");
    assert.equal(existsSync(join(item.fixtureRoot, "releases", `v${version}`)), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("independent preparations produce byte-identical closed Cursor and Codex release sets", () => {
  const item = repositoryFixture();
  try {
    const first = prepareFixture(item, join(item.fixtureRoot, "first"));
    const second = prepareFixture(item, join(item.fixtureRoot, "second"));
    assert.equal(first.status, "prepared");
    assert.equal(second.status, "prepared");
    assert.equal(first.receipt, second.receipt);
    assert.deepEqual(readdirSync(first.directory).sort(), [
      "RELEASE_NOTES.md",
      "SHA256SUMS",
      `geldmacher-workflow-codex-v${version}.zip`,
      `geldmacher-workflow-cursor-v${version}.zip`,
      "provenance.json",
    ]);
    for (const name of readdirSync(first.directory)) {
      assert.deepEqual(readFileSync(join(first.directory, name)), readFileSync(join(second.directory, name)), name);
    }
    const verified = verifyPreparedRelease(first.directory, first.receipt);
    assert.equal(verified.provenance.source.commit_sha, git(item.repository, "rev-parse", "HEAD"));
    assert.equal(verified.provenance.source.tree_sha, git(item.repository, "rev-parse", "HEAD^{tree}"));
    assert.equal(verified.provenance.release_gate.result, "passed");
    for (const host of ["cursor", "codex"]) {
      const entries = zipEntries(join(first.directory, first.provenance.targets[host].archive));
      assert.ok(entries.every((entry) => entry.name === `${PLUGIN_NAME}/` || entry.name.startsWith(`${PLUGIN_NAME}/`)));
      assert.equal(entries.some((entry) => entry.name.includes(`/${PLUGIN_NAME}/`)), false, "archive must not be double nested");
      assert.ok(entries.some((entry) => entry.name === `${PLUGIN_NAME}/${host === "cursor" ? ".cursor-plugin" : ".codex-plugin"}/plugin.json`));
      assert.ok(entries.some((entry) => entry.name === `${PLUGIN_NAME}/docs/installation.md`));
      const executable = entries.find((entry) => entry.name === `${PLUGIN_NAME}/scripts/validate-artifact.mjs`);
      assert.equal(executable.mode & 0o111, 0o111, "executable mode must survive the archive");
      assert.ok(entries.every((entry) => !/[\\/](?:\.agents|\.build|\.cursor|\.git|node_modules|tests?)(?:[\\/]|$)/.test(entry.name)));
      assert.ok(entries.every((entry) => (entry.mode & 0o170000) !== 0o120000), "archive must not contain symlinks");
    }
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("two production-target preparations from one clean release-cut snapshot are byte-identical", () => {
  const item = productionSnapshotFixture();
  const prepare = (releaseRoot) => prepareRelease({
    root: item.repository,
    ...(releaseRoot ? { releaseRoot } : {}),
    targetBuilder: buildPluginTargets,
    releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
  });
  try {
    const first = prepare();
    const second = prepare(join(item.fixtureRoot, "second"));
    assert.equal(first.directory, join(item.repository, ".build", "releases", `v${item.version}`));
    assert.equal(first.receipt, second.receipt);
    assert.equal(first.provenance.version, item.version);
    assert.ok(first.provenance.targets.cursor.file_count > 50);
    assert.ok(first.provenance.targets.codex.file_count > 30);
    for (const name of first.provenance.published_assets) {
      assert.deepEqual(readFileSync(join(first.directory, name)), readFileSync(join(second.directory, name)), name);
    }
    for (const host of ["cursor", "codex"]) {
      const archivePath = join(first.directory, first.provenance.targets[host].archive);
      const entries = zipEntries(archivePath);
      assert.ok(entries.some((entry) => entry.name === `${PLUGIN_NAME}/docs/installation.md`));
      assert.ok(entries.every((entry) => !entry.name.startsWith(`${PLUGIN_NAME}/.agents/`)));
      assert.ok(entries.every((entry) => !entry.name.startsWith(`${PLUGIN_NAME}/.cursor/`)));
      assert.match(zipEntryText(archivePath, `${PLUGIN_NAME}/docs/installation.md`), new RegExp(item.marker));
    }
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("preparation is idempotent for identical bytes and refuses a conflicting derived set", () => {
  const item = repositoryFixture();
  try {
    const first = prepareFixture(item);
    const second = prepareFixture(item);
    assert.equal(first.status, "prepared");
    assert.equal(second.status, "current");
    writeFileSync(join(first.directory, "RELEASE_NOTES.md"), "drift\n");
    assert.throws(() => prepareFixture(item), /already exists with different bytes/);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("prepared provenance is closed, canonical, and cannot redirect an asset path", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const path = join(prepared.directory, "provenance.json");
    const provenance = JSON.parse(readFileSync(path, "utf8"));
    provenance.targets.cursor.archive = "../escape.zip";
    writeFileSync(path, canonicalJson(provenance));
    assert.throws(() => verifyPreparedRelease(prepared.directory), /cursor provenance archive identity is invalid/);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("target inspection rejects development paths, symlinks, and recognizable secrets", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-release-target-test-"));
  try {
    const built = targetBuilder(join(root, "targets"));
    const cursor = built.cursor.path;
    mkdirSync(join(cursor, "tests"));
    writeFileSync(join(cursor, "tests", "fixture.txt"), "development\n");
    assert.throws(() => inspectReleaseTarget(cursor, "cursor", version), /development path/);
    rmSync(join(cursor, "tests"), { recursive: true });
    symlinkSync("README.md", join(cursor, "readme-link"));
    assert.throws(() => inspectReleaseTarget(cursor, "cursor", version), /symlink/);
    rmSync(join(cursor, "readme-link"));
    writeFileSync(join(cursor, "secret.txt"), `${"ghp_"}${"abcdefghijklmnopqrstuvwxyz123456"}\n`);
    assert.throws(() => inspectReleaseTarget(cursor, "cursor", version), /recognizable secret material/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("publish fails closed before GitHub mutation on dirty state, receipt drift, auth failure, and tag mismatch", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const commit = prepared.provenance.source.commit_sha;

    const receiptStub = publicationRunner(prepared, { tagCommit: commit });
    const driftedReceipt = `${prepared.receipt.slice(0, -1)}${prepared.receipt.endsWith("0") ? "1" : "0"}`;
    assert.throws(() => publishRelease(driftedReceipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: receiptStub.runner,
    }), /receipt/);
    assert.equal(receiptStub.calls.some(([command]) => command === "gh"), false);

    writeFileSync(join(item.repository, "dirty.txt"), "dirty\n");
    const dirtyStub = publicationRunner(prepared, { tagCommit: commit });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: dirtyStub.runner,
    }), /repository must be clean/);
    assert.equal(dirtyStub.calls.some(([command]) => command === "gh"), false);
    rmSync(join(item.repository, "dirty.txt"));

    const authStub = publicationRunner(prepared, { authenticated: false, tagCommit: commit });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: authStub.runner,
    }), /GitHub authentication/);
    assert.equal(authStub.calls.some(([command, args]) => command === "gh" && args[1] === "create"), false);

    const tagStub = publicationRunner(prepared, { tagCommit: "f".repeat(40) });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: tagStub.runner,
    }), /remote tag .* points to/);
    assert.equal(tagStub.calls.some(([command, args]) => command === "gh" && args[1] === "create"), false);

    const missingTagStub = publicationRunner(prepared, { tagCommit: "" });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: missingTagStub.runner,
    }), /remote tag .* does not exist/);
    assert.equal(missingTagStub.calls.some(([command, args]) => command === "gh" && args[1] === "create"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("publish refuses all conflicting release metadata without overwrite, deletion, or repair", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const view = exactView(prepared);
    for (const [conflict, message] of [
      [{ ...view, isDraft: true }, /draft/],
      [{ ...view, isPrerelease: true }, /prerelease flag/],
      [{ ...view, name: "Wrong title" }, /title differs/],
      [{ ...view, body: "Wrong notes\n" }, /notes differ/],
      [{ ...view, assets: view.assets.slice(0, -1) }, /assets differ/],
    ]) {
      const stub = publicationRunner(prepared, { tagCommit: prepared.provenance.source.commit_sha, views: [conflict] });
      assert.throws(() => publishRelease(prepared.receipt, {
        root: item.repository,
        releaseRoot: join(item.fixtureRoot, "releases"),
        runner: stub.runner,
      }), message);
      const flattened = stub.calls.flatMap(([, args]) => args);
      assert.equal(flattened.includes("create"), false);
      assert.equal(flattened.includes("delete"), false);
      assert.equal(flattened.includes("--clobber"), false);
    }
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("an existing release with correct asset names but wrong bytes is rejected without repair", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const view = exactView(prepared);
    const stub = publicationRunner(prepared, {
      tagCommit: prepared.provenance.source.commit_sha,
      views: [view, view],
      corruptDownload: true,
    });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    }), /downloaded GitHub asset differs/);
    const flattened = stub.calls.flatMap(([, args]) => args);
    assert.equal(flattened.includes("create"), false);
    assert.equal(flattened.includes("delete"), false);
    assert.equal(flattened.includes("--clobber"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("final read-back rejects remote tag drift before reporting an existing release current", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const commit = prepared.provenance.source.commit_sha;
    const view = exactView(prepared);
    const stub = publicationRunner(prepared, {
      tagCommits: [commit, "f".repeat(40)],
      views: [view, view],
    });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    }), /remote tag .* changed during final GitHub read-back/);
    const flattened = stub.calls.flatMap(([, args]) => args);
    assert.equal(flattened.includes("create"), false);
    assert.equal(flattened.includes("delete"), false);
    assert.equal(flattened.includes("--clobber"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("final read-back rejects live source drift before reporting an existing release current", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const view = exactView(prepared);
    const stub = publicationRunner(prepared, {
      tagCommit: prepared.provenance.source.commit_sha,
      views: [view, view],
      onDownload: () => writeFileSync(join(item.repository, "readback-drift.txt"), "drift\n"),
    });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    }), /repository must be clean|repository source differs during final GitHub read-back/);
    const flattened = stub.calls.flatMap(([, args]) => args);
    assert.equal(flattened.includes("create"), false);
    assert.equal(flattened.includes("delete"), false);
    assert.equal(flattened.includes("--clobber"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("an exact existing release is idempotently verified from downloaded assets", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const view = exactView(prepared);
    const stub = publicationRunner(prepared, {
      tagCommit: prepared.provenance.source.commit_sha,
      views: [view, view],
    });
    const result = publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    });
    assert.equal(result.status, "current");
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && args[1] === "create"), false);
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && args[1] === "download"), true);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("a new release uploads only the closed prepared set and verifies downloaded bytes", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const view = exactView(prepared);
    const stub = publicationRunner(prepared, {
      tagCommit: prepared.provenance.source.commit_sha,
      views: [null, view],
    });
    const result = publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    });
    assert.equal(result.status, "published");
    const create = stub.calls.find(([command, args]) => command === "gh" && args[1] === "create");
    assert.ok(create);
    const argumentsList = create[1];
    const uploadedNames = argumentsList.slice(3, argumentsList.indexOf("--repo")).map((value) => value.split("/").at(-1));
    assert.deepEqual(uploadedNames.sort(), [...prepared.provenance.published_assets].sort());
    for (const forbidden of ["--clobber", "delete", "upload", "tag", "push"]) assert.equal(argumentsList.includes(forbidden), false);
    assert.equal(stub.calls.some(([command, args]) => command === "git" && ["tag", "push", "commit"].includes(args[0])), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("post-create read-back mismatch fails without deleting or overwriting the release", () => {
  const item = repositoryFixture();
  try {
    const prepared = prepareFixture(item);
    const stub = publicationRunner(prepared, {
      tagCommit: prepared.provenance.source.commit_sha,
      views: [null, exactView(prepared)],
      corruptDownload: true,
    });
    assert.throws(() => publishRelease(prepared.receipt, {
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
    }), /created but read-back verification failed.*downloaded GitHub asset differs/);
    const flattened = stub.calls.flatMap(([, args]) => args);
    assert.equal(flattened.includes("delete"), false);
    assert.equal(flattened.includes("--clobber"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});
