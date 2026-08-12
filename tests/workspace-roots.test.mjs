import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { HOST_WORKSPACE_ENV, WorkspaceRootAuthority } from "../src/mcp/workspace-roots.mjs";

function roots(...paths) {
  return { roots: paths.map((path) => ({ uri: pathToFileURL(path).href })) };
}

test("workspace authority resolves one implicit root and exact advertised selectors", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-roots-"));
  const first = join(directory, "first");
  const second = join(directory, "second");
  mkdirSync(first);
  mkdirSync(second);
  try {
    const single = new WorkspaceRootAuthority(async () => roots(first), { env: {} });
    assert.equal(await single.resolve(), realpathSync(first));
    assert.equal(await single.resolve(first), realpathSync(first));

    const multiple = new WorkspaceRootAuthority(async () => roots(first, second), { env: {} });
    await assert.rejects(() => multiple.resolve(), /multiple MCP workspace roots/);
    assert.equal(await multiple.resolve(second), realpathSync(second));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority prefers host-configured workspace when roots are unavailable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-host-root-"));
  try {
    const authority = new WorkspaceRootAuthority(async () => { throw new Error("client does not support roots/list"); }, {
      env: { [HOST_WORKSPACE_ENV]: directory },
    });
    assert.equal(await authority.resolve(), realpathSync(directory));
    assert.equal(await authority.resolve(directory), realpathSync(directory));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority cross-checks host-configured workspace against advertised roots", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-host-cross-"));
  const allowed = join(directory, "allowed");
  const foreign = join(directory, "foreign");
  mkdirSync(allowed);
  mkdirSync(foreign);
  try {
    const authority = new WorkspaceRootAuthority(async () => roots(allowed), {
      env: { [HOST_WORKSPACE_ENV]: foreign },
    });
    await assert.rejects(() => authority.resolve(), (error) => error.code === "root-foreign");
    const matched = new WorkspaceRootAuthority(async () => roots(allowed), {
      env: { [HOST_WORKSPACE_ENV]: allowed },
    });
    assert.equal(await matched.resolve(), realpathSync(allowed));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority fails closed for missing, foreign, and symlink aliases", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-roots-negative-"));
  const allowed = join(directory, "allowed");
  const foreign = join(directory, "foreign");
  const alias = join(directory, "alias");
  mkdirSync(allowed);
  mkdirSync(foreign);
  symlinkSync(allowed, alias);
  try {
    await assert.rejects(() => new WorkspaceRootAuthority(async () => ({ roots: [] }), { env: {} }).resolve(), (error) => error.code === "roots-empty" && /empty/.test(error.message));
    await assert.rejects(() => new WorkspaceRootAuthority(async () => roots(alias), { env: {} }).resolve(), (error) => error.code === "root-symlink" && /symlink redirected/.test(error.message));
    const authority = new WorkspaceRootAuthority(async () => roots(allowed), { env: {} });
    await assert.rejects(() => authority.resolve(foreign), (error) => error.code === "root-foreign" && /not an advertised MCP root/.test(error.message));
    await assert.rejects(() => authority.resolve(alias), (error) => error.code === "root-foreign" && /not an advertised MCP root/.test(error.message));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority preserves roots request failure details without weakening the boundary", async () => {
  const authority = new WorkspaceRootAuthority(async () => { throw new Error("client does not support roots/list"); }, { env: {} });
  await assert.rejects(() => authority.resolve(), (error) => error.code === "roots-request-failed" && /client does not support roots\/list/.test(error.message));
});

test("workspace authority negative-caches unsupported roots responses for the session", async () => {
  let calls = 0;
  const authority = new WorkspaceRootAuthority(async () => {
    calls += 1;
    throw new Error("client does not support roots/list");
  }, { env: {} });
  await assert.rejects(() => authority.resolve(), /roots\/list/);
  await assert.rejects(() => authority.resolve(), /roots\/list/);
  assert.equal(calls, 1);
  authority.invalidate();
  await assert.rejects(() => authority.resolve(), /roots\/list/);
  assert.equal(calls, 2);
});

test("workspace authority distinguishes root drift after discovery", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-roots-drift-"));
  const advertised = join(directory, "advertised");
  const original = join(directory, "original");
  const replacement = join(directory, "replacement");
  mkdirSync(advertised);
  mkdirSync(replacement);
  try {
    const authority = new WorkspaceRootAuthority(async () => roots(advertised), { env: {} });
    await authority.roots();
    renameSync(advertised, original);
    symlinkSync(replacement, advertised);
    await assert.rejects(() => authority.resolve(advertised), (error) => error.code === "root-drift" && /changed after MCP root discovery/.test(error.message));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority caches roots and refreshes only after invalidation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-roots-cache-"));
  let calls = 0;
  try {
    const authority = new WorkspaceRootAuthority(async () => { calls += 1; return roots(directory); }, { env: {} });
    await authority.resolve();
    await authority.resolve();
    assert.equal(calls, 1);
    authority.invalidate();
    await authority.resolve();
    assert.equal(calls, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("workspace authority ignores unresolved host env placeholders", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-roots-placeholder-"));
  try {
    const authority = new WorkspaceRootAuthority(async () => roots(directory), {
      env: { [HOST_WORKSPACE_ENV]: "${workspaceFolder}" },
    });
    assert.equal(await authority.resolve(), realpathSync(directory));
    assert.equal(await authority.resolve(directory), realpathSync(directory));

    const unavailableRoots = new WorkspaceRootAuthority(async () => {
      throw new Error("client does not support roots/list");
    }, {
      env: { [HOST_WORKSPACE_ENV]: "/Users/example/${workspaceFolder}" },
    });
    await assert.rejects(() => unavailableRoots.resolve(), (error) => error.code === "roots-request-failed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
