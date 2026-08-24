#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);

// src/controller/sandbox.mjs
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
var sandboxExecutable = "/usr/bin/sandbox-exec";
function escapeProfilePath(path) {
  return resolve(path).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
function buildSandboxProfile({ writablePaths = [], deniedPaths = [], deniedReadPaths = [], network = !1 }) {
  let writable = [...new Set(writablePaths.map((path) => resolve(path)))], denied = [...new Set(deniedPaths.map((path) => resolve(path)))], deniedRead = [...new Set(deniedReadPaths.map((path) => resolve(path)))], clauses = [
    "(version 1)",
    "(deny default)",
    "(allow process*)",
    "(allow signal)",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow ipc-posix*)",
    "(allow file-read*)"
  ];
  for (let path of writable) clauses.push(`(allow file-write* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  for (let path of denied) clauses.push(`(deny file-write* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  for (let path of deniedRead) clauses.push(`(deny file-read* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  return network && clauses.push("(allow network*)"), `${clauses.join(`
`)}
`;
}
function probeSandboxBoundary() {
  if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) return {
    available: !1,
    verified: !1,
    reason: "sandbox-exec-unavailable"
  };
  let root = mkdtempSync(join(tmpdir(), "workflow-sandbox-probe-")), allowed = join(root, "allowed"), denied = join(root, "denied");
  mkdirSync(allowed), mkdirSync(denied);
  let profile = join(root, "profile.sb");
  writeFileSync(profile, buildSandboxProfile({ writablePaths: [allowed] }), { mode: 384 });
  let script = [
    "const fs=require('node:fs');",
    "let allowed=false, denied=false;",
    "try{fs.writeFileSync(process.argv[1],'ok');allowed=true}catch{}",
    "try{fs.writeFileSync(process.argv[2],'bad');denied=true}catch{}",
    "process.stdout.write(JSON.stringify({allowed,denied}));"
  ].join(""), result = spawnSync(sandboxExecutable, ["-f", profile, process.execPath, "-e", script, join(allowed, "ok"), join(denied, "bad")], {
    encoding: "utf8",
    timeout: 1e4
  }), observation = null;
  try {
    observation = JSON.parse(result.stdout);
  } catch {
    observation = null;
  }
  let verified = result.status === 0 && observation?.allowed === !0 && observation?.denied === !1;
  return rmSync(root, { recursive: !0, force: !0 }), {
    available: !0,
    verified,
    reason: verified ? null : "sandbox-boundary-probe-failed",
    observation,
    stderr: result.stderr?.trim() || null
  };
}
function runSandboxedProcess({ entrypoint, payload, writablePaths = [], deniedPaths = [], deniedReadPaths = [], network = !1, timeoutMs = 3e5, environment = {}, inheritEnvironment = !0 }) {
  if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) throw new Error("hard sandbox unavailable; worker execution denied");
  let runRoot = writablePaths[0] ?? dirname(resolve(entrypoint));
  mkdirSync(runRoot, { recursive: !0, mode: 448 });
  let profilePath = join(runRoot, `sandbox-${process.pid}-${Date.now()}.sb`);
  writeFileSync(profilePath, buildSandboxProfile({ writablePaths, deniedPaths, deniedReadPaths, network }), { mode: 384 });
  let result = spawnSync(sandboxExecutable, ["-f", profilePath, process.execPath, resolve(entrypoint)], {
    input: `${JSON.stringify(payload)}
`,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: inheritEnvironment ? { ...process.env, ...environment } : environment
  });
  if (rmSync(profilePath, { force: !0 }), result.error?.code === "ETIMEDOUT") return {
    ok: !1,
    status: "interrupted",
    hard_cancel: !0,
    error: { name: result.error.name, message: "sandboxed worker exceeded its cooperative-cancel deadline and was terminated", code: result.error.code }
  };
  if (result.error) throw result.error;
  let marker = result.stdout.split(`
`).findLast((line) => line.startsWith("WORKFLOW_RESULT="));
  if (marker) return JSON.parse(marker.slice(16));
  throw result.signal || result.status !== 0 ? new Error(`sandboxed worker failed (${result.signal ?? result.status}): ${result.stderr?.trim() || result.stdout?.trim()}`) : new Error(`sandboxed worker returned no receipt: ${result.stderr?.trim() || result.stdout?.trim()}`);
}

export {
  buildSandboxProfile,
  probeSandboxBoundary,
  runSandboxedProcess
};
