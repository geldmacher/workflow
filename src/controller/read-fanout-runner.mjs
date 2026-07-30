#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { buildSandboxProfile } from "./sandbox.mjs";

const sandboxExecutable = "/usr/bin/sandbox-exec";

function runTask(task, index) {
  return new Promise((resolveTask) => {
    if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) return resolveTask({ ok: false, status: "error", error: { message: "hard sandbox unavailable" } });
    const runRoot = task.writablePaths[0] ?? dirname(resolve(task.entrypoint));
    mkdirSync(runRoot, { recursive: true, mode: 0o700 });
    const profilePath = join(runRoot, `fanout-${process.pid}-${index}.sb`);
    writeFileSync(profilePath, buildSandboxProfile(task), { mode: 0o600 });
    const child = spawn(sandboxExecutable, ["-f", profilePath, process.execPath, resolve(task.entrypoint)], {
      stdio: ["pipe", "pipe", "pipe"], env: task.environment,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => { stdout += value; });
    child.stderr.on("data", (value) => { stderr += value; });
    const timeout = setTimeout(() => child.kill("SIGTERM"), task.timeoutMs ?? 300_000);
    child.on("error", (error) => {
      clearTimeout(timeout); rmSync(profilePath, { force: true });
      resolveTask({ ok: false, status: "error", error: { message: error.message } });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout); rmSync(profilePath, { force: true });
      const marker = stdout.split("\n").findLast((line) => line.startsWith("WORKFLOW_RESULT="));
      if (marker) {
        try { return resolveTask(JSON.parse(marker.slice("WORKFLOW_RESULT=".length))); }
        catch (error) { return resolveTask({ ok: false, status: "error", error: { message: error.message } }); }
      }
      resolveTask({ ok: false, status: signal ? "interrupted" : "error", error: { message: `fanout worker failed (${signal ?? code}): ${stderr.trim() || stdout.trim()}` } });
    });
    child.stdin.end(`${JSON.stringify(task.payload)}\n`);
  });
}

const input = JSON.parse(readFileSync(0, "utf8"));
const results = await Promise.all(input.tasks.map(runTask));
process.stdout.write(`WORKFLOW_FANOUT=${JSON.stringify(results)}\n`);
