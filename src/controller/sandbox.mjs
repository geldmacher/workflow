import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sandboxExecutable = "/usr/bin/sandbox-exec";

function escapeProfilePath(path) {
  return resolve(path).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function buildSandboxProfile({ writablePaths = [], deniedPaths = [], deniedReadPaths = [], network = false }) {
  const writable = [...new Set(writablePaths.map((path) => resolve(path)))];
  const denied = [...new Set(deniedPaths.map((path) => resolve(path)))];
  const deniedRead = [...new Set(deniedReadPaths.map((path) => resolve(path)))];
  const clauses = [
    "(version 1)",
    "(deny default)",
    "(allow process*)",
    "(allow signal)",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow ipc-posix*)",
    "(allow file-read*)",
  ];
  for (const path of writable) clauses.push(`(allow file-write* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  for (const path of denied) clauses.push(`(deny file-write* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  for (const path of deniedRead) clauses.push(`(deny file-read* (literal "${escapeProfilePath(path)}") (subpath "${escapeProfilePath(path)}"))`);
  if (network) clauses.push("(allow network*)");
  return `${clauses.join("\n")}\n`;
}

export function probeSandboxBoundary() {
  if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) return {
    available: false,
    verified: false,
    reason: "sandbox-exec-unavailable",
  };

  const root = mkdtempSync(join(tmpdir(), "workflow-sandbox-probe-"));
  const allowed = join(root, "allowed");
  const denied = join(root, "denied");
  mkdirSync(allowed);
  mkdirSync(denied);
  const profile = join(root, "profile.sb");
  writeFileSync(profile, buildSandboxProfile({ writablePaths: [allowed] }), { mode: 0o600 });
  const script = [
    "const fs=require('node:fs');",
    "let allowed=false, denied=false;",
    "try{fs.writeFileSync(process.argv[1],'ok');allowed=true}catch{}",
    "try{fs.writeFileSync(process.argv[2],'bad');denied=true}catch{}",
    "process.stdout.write(JSON.stringify({allowed,denied}));",
  ].join("");
  const result = spawnSync(sandboxExecutable, ["-f", profile, process.execPath, "-e", script, join(allowed, "ok"), join(denied, "bad")], {
    encoding: "utf8",
    timeout: 10_000,
  });
  let observation = null;
  try { observation = JSON.parse(result.stdout); } catch { observation = null; }
  const verified = result.status === 0 && observation?.allowed === true && observation?.denied === false;
  rmSync(root, { recursive: true, force: true });
  return {
    available: true,
    verified,
    reason: verified ? null : "sandbox-boundary-probe-failed",
    observation,
    stderr: result.stderr?.trim() || null,
  };
}

export function runSandboxedProcess({ entrypoint, payload, writablePaths = [], deniedPaths = [], deniedReadPaths = [], network = false, timeoutMs = 300_000, environment = {}, inheritEnvironment = true }) {
  if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) throw new Error("hard sandbox unavailable; worker execution denied");
  const runRoot = writablePaths[0] ?? dirname(resolve(entrypoint));
  mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const profilePath = join(runRoot, `sandbox-${process.pid}-${Date.now()}.sb`);
  writeFileSync(profilePath, buildSandboxProfile({ writablePaths, deniedPaths, deniedReadPaths, network }), { mode: 0o600 });
  const result = spawnSync(sandboxExecutable, ["-f", profilePath, process.execPath, resolve(entrypoint)], {
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: inheritEnvironment ? { ...process.env, ...environment } : environment,
  });
  rmSync(profilePath, { force: true });
  if (result.error?.code === "ETIMEDOUT") return {
    ok: false,
    status: "interrupted",
    hard_cancel: true,
    error: { name: result.error.name, message: "sandboxed worker exceeded its cooperative-cancel deadline and was terminated", code: result.error.code },
  };
  if (result.error) throw result.error;
  const marker = result.stdout.split("\n").findLast((line) => line.startsWith("WORKFLOW_RESULT="));
  if (marker) return JSON.parse(marker.slice("WORKFLOW_RESULT=".length));
  if (result.signal || result.status !== 0) throw new Error(`sandboxed worker failed (${result.signal ?? result.status}): ${result.stderr?.trim() || result.stdout?.trim()}`);
  throw new Error(`sandboxed worker returned no receipt: ${result.stderr?.trim() || result.stdout?.trim()}`);
}
