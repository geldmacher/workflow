import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
  completeRelease,
  createReleaseCut,
  defaultRunner,
  inspectReleaseTarget,
  prepareRelease,
  publishRelease,
  releaseFailureReport,
  releaseNotesFromChangelog,
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
  git(repository, "init", "--quiet", "-b", "main");
  git(repository, "remote", "add", "origin", "git@github.com:geldmacher/workflow.git");
  git(repository, "config", "user.name", "Workflow Release Test");
  git(repository, "config", "user.email", "workflow-release@invalid.local");
  git(repository, "add", ".");
  execFileSync("git", [
    "-c", "user.name=Workflow Release Test",
    "-c", "user.email=workflow-release@invalid.local",
    "commit", "--quiet", "-m", "fixture",
  ], { cwd: repository });
  git(repository, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(repository, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
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
  git(repository, "init", "--quiet", "-b", "main");
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

function completeReleaseRunner(item, {
  authenticated = true,
  apiReachable = true,
  commitFails = false,
  pushFails = false,
  existingRelease = null,
} = {}) {
  const calls = [];
  let remoteMain = git(item.repository, "rev-parse", "HEAD");
  let remoteTag = null;
  let releaseView = existingRelease;
  let publishedPaths = new Map();
  const state = {
    get remoteMain() { return remoteMain; },
    set remoteMain(value) { remoteMain = value; },
    get remoteTag() { return remoteTag; },
    set remoteTag(value) { remoteTag = value; },
    set pushFails(value) { pushFails = value; },
  };
  const runner = (command, args, options = {}) => {
    calls.push([command, [...args]]);
    if (command === "git" && args[0] === "fetch") return { status: 0, stdout: "", stderr: "" };
    if (command === "git" && args[0] === "commit" && commitFails) {
      return { status: 1, stdout: "", stderr: "commit hook rejected release" };
    }
    if (command === "git" && args[0] === "ls-remote" && args.includes("--heads")) {
      return { status: 0, stdout: `${remoteMain}\trefs/heads/main\n`, stderr: "" };
    }
    if (command === "git" && args[0] === "ls-remote" && args.includes("--tags")) {
      const tag = args.find((value) => value.startsWith("refs/tags/"))?.replace(/\^\{\}$/, "");
      return { status: 0, stdout: remoteTag ? `${remoteTag}\t${tag}\n` : "", stderr: "" };
    }
    if (command === "git" && args[0] === "push") {
      if (pushFails) return { status: 1, stdout: "", stderr: "atomic push rejected" };
      remoteMain = git(item.repository, "rev-parse", "HEAD");
      remoteTag = git(item.repository, "rev-parse", `refs/tags/v${version}^{commit}`);
      git(item.repository, "update-ref", "refs/remotes/origin/main", remoteMain);
      return { status: 0, stdout: "", stderr: "" };
    }
    if (command !== "gh") return defaultRunner(command, args, options);
    if (args[0] === "auth") return authenticated
      ? { status: 0, stdout: "authenticated\n", stderr: "" }
      : { status: 1, stdout: "", stderr: "authentication failed" };
    if (args[0] === "api") return apiReachable
      ? { status: 0, stdout: "", stderr: "" }
      : { status: 1, stdout: "", stderr: "error connecting to api.github.com" };
    if (args[0] === "release" && args[1] === "view") return releaseView
      ? { status: 0, stdout: JSON.stringify(releaseView), stderr: "" }
      : { status: 1, stdout: "", stderr: "release not found" };
    if (args[0] === "release" && args[1] === "create") {
      const repositoryIndex = args.indexOf("--repo");
      const paths = args.slice(3, repositoryIndex);
      publishedPaths = new Map(paths.map((path) => [basename(path), path]));
      const notesPath = args[args.indexOf("--notes-file") + 1];
      releaseView = {
        tagName: args[2],
        isDraft: false,
        isPrerelease: args.includes("--prerelease"),
        name: args[args.indexOf("--title") + 1],
        body: readFileSync(notesPath, "utf8"),
        assets: [...publishedPaths.keys()].map((name) => ({ name })),
        url: `https://github.com/geldmacher/workflow/releases/tag/${args[2]}`,
      };
      return { status: 0, stdout: releaseView.url, stderr: "" };
    }
    if (args[0] === "release" && args[1] === "download") {
      const destination = args[args.indexOf("--dir") + 1];
      mkdirSync(destination, { recursive: true });
      if ((publishedPaths.size === 0 || [...publishedPaths.values()].some((path) => !existsSync(path))) && releaseView) {
        const directory = join(item.fixtureRoot, "releases", `v${version}`);
        publishedPaths = new Map(releaseView.assets.map(({ name }) => [name, join(directory, name)]));
      }
      for (const [name, path] of publishedPaths) copyFileSync(path, join(destination, name));
      return { status: 0, stdout: "", stderr: "" };
    }
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  };
  return { calls, runner, state };
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
  for (const source of [skill, command]) assert.match(source, /npm run release:plugin/);
  assert.equal(packageJson.scripts["release:plugin"], "node scripts/plugin-github-release.mjs");
  for (const legacy of ["release:ensure", "release:status", "release:prepare", "release:publish"]) {
    assert.equal(packageJson.scripts[legacy], undefined);
    assert.doesNotMatch(skill, new RegExp(`npm run ${legacy}`));
    assert.doesNotMatch(command, new RegExp(`npm run ${legacy}`));
  }
  for (const source of [skill, command]) {
    assert.match(source, /no action, version, receipt, or other argument/i);
    assert.match(source, /atomically|atomic/i);
    assert.match(source, /--clobber/);
    assert.match(source, /delete/i);
  }
  const legacyCli = spawnSync(process.execPath, [join(root, "scripts", "plugin-github-release.mjs"), "status"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(legacyCli.status, 0);
  assert.match(legacyCli.stderr, /Usage: node scripts\/plugin-github-release\.mjs/);
});

test("complete release commits every validated non-ignored change and publishes one verified release", () => {
  const item = repositoryFixture();
  const releaseRoot = join(item.fixtureRoot, "releases");
  try {
    const originalHead = git(item.repository, "rev-parse", "HEAD");
    writeFileSync(join(item.repository, "CHANGELOG.md"), `# Changelog\n\n## Unreleased\n\n- Complete release.\n\n## ${version}\n\n- Existing note.\n`);
    writeFileSync(join(item.repository, "new-file.txt"), "included\n");
    const stub = completeReleaseRunner(item);
    let gateHead = null;
    const result = completeRelease({
      root: item.repository,
      releaseRoot,
      runner: stub.runner,
      targetBuilder,
      releaseGate: (root) => {
        gateHead = git(root, "rev-parse", "HEAD");
        return { command: "npm run release-check", result: "passed" };
      },
    });
    assert.equal(gateHead, originalHead, "release gate must run before the release commit");
    assert.equal(result.status, "published");
    assert.equal(result.commit_created, true);
    assert.equal(result.pushed_atomically, true);
    assert.equal(result.github.read_back_verified, true);
    assert.equal(git(item.repository, "show", "-s", "--format=%s", "HEAD"), `Release v${version}`);
    assert.equal(git(item.repository, "status", "--porcelain"), "");
    assert.equal(git(item.repository, "ls-files", "new-file.txt"), "new-file.txt");
    assert.equal(git(item.repository, "rev-parse", `refs/tags/v${version}^{commit}`), result.commit_sha);
    assert.equal(stub.state.remoteMain, result.commit_sha);
    assert.equal(stub.state.remoteTag, result.commit_sha);
    const push = stub.calls.find(([command, args]) => command === "git" && args[0] === "push");
    assert.deepEqual(push?.[1].slice(0, 3), ["push", "--atomic", "origin"]);
    assert.equal(push[1].includes("--force"), false);
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && args[1] === "create"), true);
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && args[1] === "download"), true);
    assert.equal(stub.calls.some(([command, args]) => command === "git" && args[0] === "reset"), false);
    assert.equal(stub.calls.some(([command, args]) => command === "gh" && ["delete", "upload"].includes(args[1])), false);
    assert.equal(stub.calls.some(([, args]) => args.includes("--clobber")), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release reuses a clean release-ready commit without creating another commit", () => {
  const item = repositoryFixture();
  try {
    const originalHead = git(item.repository, "rev-parse", "HEAD");
    const stub = completeReleaseRunner(item);
    const result = completeRelease({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
      targetBuilder,
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    });
    assert.equal(result.commit_created, false);
    assert.equal(result.commit_sha, originalHead);
    assert.equal(git(item.repository, "rev-parse", "HEAD"), originalHead);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release idempotently verifies an already exact GitHub Release", () => {
  const item = repositoryFixture();
  const releaseRoot = join(item.fixtureRoot, "releases");
  try {
    const stub = completeReleaseRunner(item);
    const options = {
      root: item.repository,
      releaseRoot,
      runner: stub.runner,
      targetBuilder,
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    };
    const first = completeRelease(options);
    const createCalls = stub.calls.filter(([command, args]) => command === "gh" && args[1] === "create").length;
    const second = completeRelease(options);
    assert.equal(first.status, "published");
    assert.equal(second.status, "current");
    assert.equal(second.commit_created, false);
    assert.equal(second.pushed_atomically, false);
    assert.equal(stub.calls.filter(([command, args]) => command === "gh" && args[1] === "create").length, createCalls);
    assert.equal(stub.calls.filter(([command, args]) => command === "gh" && args[1] === "download").length >= 2, true);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release restores its changelog cut and preserves user changes when validation fails", () => {
  const item = repositoryFixture();
  try {
    const pending = `# Changelog\n\n## Unreleased\n\n- Pending release.\n\n## ${version}\n\n- Existing.\n`;
    writeFileSync(join(item.repository, "CHANGELOG.md"), pending);
    writeFileSync(join(item.repository, "new-file.txt"), "keep me\n");
    const originalHead = git(item.repository, "rev-parse", "HEAD");
    const stub = completeReleaseRunner(item);
    assert.throws(() => completeRelease({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
      targetBuilder,
      releaseGate: () => { throw new Error("gate failed"); },
    }), /gate failed/);
    assert.equal(readFileSync(join(item.repository, "CHANGELOG.md"), "utf8"), pending);
    assert.equal(readFileSync(join(item.repository, "new-file.txt"), "utf8"), "keep me\n");
    assert.equal(git(item.repository, "rev-parse", "HEAD"), originalHead);
    assert.equal(git(item.repository, "diff", "--cached", "--name-only"), "");
    assert.equal(stub.calls.some(([command, args]) => command === "git" && args[0] === "push"), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release rejects unreachable GitHub and unsafe candidate content before mutation", () => {
  for (const scenario of ["network", "secret", "symlink", "nested"]) {
    const item = repositoryFixture();
    try {
      const originalHead = git(item.repository, "rev-parse", "HEAD");
      const stub = completeReleaseRunner(item, { apiReachable: scenario !== "network" });
      if (scenario === "secret") writeFileSync(join(item.repository, "secret.txt"), `${"ghp_"}${"abcdefghijklmnopqrstuvwxyz123456"}\n`);
      if (scenario === "symlink") symlinkSync("CHANGELOG.md", join(item.repository, "changelog-link"));
      if (scenario === "nested") {
        mkdirSync(join(item.repository, "nested"));
        git(join(item.repository, "nested"), "init", "--quiet");
        writeFileSync(join(item.repository, "nested", "file.txt"), "nested\n");
      }
      assert.throws(() => completeRelease({
        root: item.repository,
        releaseRoot: join(item.fixtureRoot, "releases"),
        runner: stub.runner,
        targetBuilder,
        releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
      }), {
        network: /unreachable/,
        secret: /recognizable secret/,
        symlink: /symlink/,
        nested: /nested repository/,
      }[scenario]);
      assert.equal(git(item.repository, "rev-parse", "HEAD"), originalHead);
      assert.equal(stub.calls.some(([command, args]) => command === "git" && ["commit", "tag", "push"].includes(args[0])), false);
    } finally {
      rmSync(item.fixtureRoot, { recursive: true, force: true });
    }
  }
});

test("complete release rejects branch, authentication, and remote-baseline conflicts before mutation", () => {
  for (const scenario of ["branch", "auth", "baseline"]) {
    const item = repositoryFixture();
    try {
      const originalHead = git(item.repository, "rev-parse", "HEAD");
      const stub = completeReleaseRunner(item, { authenticated: scenario !== "auth" });
      if (scenario === "branch") git(item.repository, "switch", "--quiet", "-c", "feature");
      if (scenario === "baseline") stub.state.remoteMain = "f".repeat(40);
      assert.throws(() => completeRelease({
        root: item.repository,
        releaseRoot: join(item.fixtureRoot, "releases"),
        runner: stub.runner,
        targetBuilder,
        releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
      }), {
        branch: /requires the main branch/,
        auth: /authentication failed/,
        baseline: /without an exact release retry state/,
      }[scenario]);
      assert.equal(git(item.repository, "rev-parse", "HEAD"), originalHead);
      assert.equal(stub.calls.some(([command, args]) => command === "git" && ["commit", "tag", "push"].includes(args[0])), false);
    } finally {
      rmSync(item.fixtureRoot, { recursive: true, force: true });
    }
  }
});

test("complete release restores the original index and changelog when commit creation fails", () => {
  const item = repositoryFixture();
  try {
    const pending = `# Changelog\n\n## Unreleased\n\n- Pending release.\n\n## ${version}\n\n- Existing.\n`;
    writeFileSync(join(item.repository, "CHANGELOG.md"), pending);
    writeFileSync(join(item.repository, "staged.txt"), "staged\n");
    writeFileSync(join(item.repository, "unstaged.txt"), "unstaged\n");
    git(item.repository, "add", "staged.txt");
    const originalHead = git(item.repository, "rev-parse", "HEAD");
    const stub = completeReleaseRunner(item, { commitFails: true });
    assert.throws(() => completeRelease({
      root: item.repository,
      releaseRoot: join(item.fixtureRoot, "releases"),
      runner: stub.runner,
      targetBuilder,
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    }), /commit hook rejected release/);
    assert.equal(readFileSync(join(item.repository, "CHANGELOG.md"), "utf8"), pending);
    assert.equal(git(item.repository, "diff", "--cached", "--name-only"), "staged.txt");
    assert.match(git(item.repository, "status", "--porcelain"), /\?\? unstaged\.txt/);
    assert.equal(git(item.repository, "rev-parse", "HEAD"), originalHead);
    assert.equal(stub.calls.some(([command, args]) => command === "git" && ["tag", "push"].includes(args[0])), false);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release resumes an exact committed state after preparation fails", () => {
  const item = repositoryFixture();
  const releaseRoot = join(item.fixtureRoot, "releases");
  try {
    writeFileSync(join(item.repository, "new-file.txt"), "prepare retry\n");
    const stub = completeReleaseRunner(item);
    let failPreparation = true;
    const options = {
      root: item.repository,
      releaseRoot,
      runner: stub.runner,
      targetBuilder(outputRoot) {
        if (failPreparation) throw new Error("target preparation failed");
        return targetBuilder(outputRoot);
      },
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    };
    assert.throws(() => completeRelease(options), /target preparation failed/);
    const releaseCommit = git(item.repository, "rev-parse", "HEAD");
    assert.equal(git(item.repository, "show", "-s", "--format=%s", "HEAD"), `Release v${version}`);
    assert.equal(stub.calls.some(([command, args]) => command === "git" && args[0] === "push"), false);
    failPreparation = false;
    const result = completeRelease(options);
    assert.equal(result.status, "published");
    assert.equal(result.commit_created, false);
    assert.equal(result.commit_sha, releaseCommit);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("complete release retains and resumes an exact local commit after an atomic push failure", () => {
  const item = repositoryFixture();
  const releaseRoot = join(item.fixtureRoot, "releases");
  try {
    writeFileSync(join(item.repository, "new-file.txt"), "retry\n");
    const stub = completeReleaseRunner(item, { pushFails: true });
    const options = {
      root: item.repository,
      releaseRoot,
      runner: stub.runner,
      targetBuilder,
      releaseGate: () => ({ command: "npm run release-check", result: "passed" }),
    };
    let failure;
    try { completeRelease(options); }
    catch (error) { failure = error; }
    assert.match(failure?.message ?? "", /atomic main and release tag push failed/);
    const releaseCommit = git(item.repository, "rev-parse", "HEAD");
    const report = releaseFailureReport(failure, options);
    assert.equal(report.status, "blocked");
    assert.equal(report.source.commit_sha, releaseCommit);
    assert.equal(report.retained_retry_state.release_commit, releaseCommit);
    assert.notEqual(releaseCommit, stub.state.remoteMain);
    assert.equal(stub.state.remoteTag, null);
    assert.equal(git(item.repository, "status", "--porcelain"), "");
    stub.state.pushFails = false;
    const result = completeRelease(options);
    assert.equal(result.status, "published");
    assert.equal(result.commit_created, false);
    assert.equal(result.commit_sha, releaseCommit);
    assert.equal(stub.state.remoteMain, releaseCommit);
    assert.equal(stub.state.remoteTag, releaseCommit);
  } finally {
    rmSync(item.fixtureRoot, { recursive: true, force: true });
  }
});

test("release notes require an empty Unreleased section and an exact non-empty version section", () => {
  assert.equal(
    releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n## ${version}\n\n- Ready.\n`, version),
    `# Workflow ${version}\n\n- Ready.\n`,
  );
  assert.throws(() => releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n- Pending.\n\n## ${version}\n\n- Ready.\n`, version), /Unreleased must be empty/);
  assert.throws(() => releaseNotesFromChangelog("# Changelog\n\n## Unreleased\n", version), /no non-empty/);
  assert.throws(() => releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n## Unreleased\n\n## ${version}\n\n- Ready.\n`, version), /exactly one Unreleased/);
  assert.throws(() => releaseNotesFromChangelog(`# Changelog\n\n## Unreleased\n\n## ${version}\n\n- Ready.\n\n## ${version}\n\n- Duplicate.\n`, version), /at most one/);
});

test("release cut deterministically creates or consolidates the current version section", () => {
  const pending = `# Changelog\n\n## Unreleased\n\n- New first.\n- New second.\n\n## ${version}\n\n- Existing.\n\n## 1.2.2\n\n- Older.\n`;
  const consolidated = createReleaseCut(pending, version);
  assert.equal(consolidated, `# Changelog\n\n## Unreleased\n\n## ${version}\n\n- New first.\n- New second.\n\n- Existing.\n\n## 1.2.2\n\n- Older.\n`);
  assert.equal(createReleaseCut(consolidated, version), consolidated);
  assert.equal(
    createReleaseCut("# Changelog\n\n## Unreleased\n\n- First release.\n\n## 1.2.2\n\n- Older.\n", version),
    `# Changelog\n\n## Unreleased\n\n## ${version}\n\n- First release.\n\n## 1.2.2\n\n- Older.\n`,
  );
  assert.throws(() => createReleaseCut(`# Changelog\n\n## Unreleased\n\n- Pending.\n\n## 1.2.2\n\n- Older.\n\n## ${version}\n\n- Existing.\n`, version), /immediately follow/);
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
