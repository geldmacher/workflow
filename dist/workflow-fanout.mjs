#!/usr/bin/env node
#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  buildSandboxProfile
} from "./chunks/chunk-PKEO6PA3.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// src/controller/read-fanout-runner.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
var sandboxExecutable = "/usr/bin/sandbox-exec";
function runTask(task, index) {
  return new Promise((resolveTask) => {
    if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) return resolveTask({ ok: false, status: "error", error: { message: "hard sandbox unavailable" } });
    const runRoot = task.writablePaths[0] ?? dirname(resolve(task.entrypoint));
    mkdirSync(runRoot, { recursive: true, mode: 448 });
    const profilePath = join(runRoot, `fanout-${process.pid}-${index}.sb`);
    writeFileSync(profilePath, buildSandboxProfile(task), { mode: 384 });
    const child = spawn(sandboxExecutable, ["-f", profilePath, process.execPath, resolve(task.entrypoint)], {
      stdio: ["pipe", "pipe", "pipe"],
      env: task.environment
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => {
      stdout += value;
    });
    child.stderr.on("data", (value) => {
      stderr += value;
    });
    const timeout = setTimeout(() => child.kill("SIGTERM"), task.timeoutMs ?? 3e5);
    child.on("error", (error) => {
      clearTimeout(timeout);
      rmSync(profilePath, { force: true });
      resolveTask({ ok: false, status: "error", error: { message: error.message } });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      rmSync(profilePath, { force: true });
      const marker = stdout.split("\n").findLast((line) => line.startsWith("WORKFLOW_RESULT="));
      if (marker) {
        try {
          return resolveTask(JSON.parse(marker.slice("WORKFLOW_RESULT=".length)));
        } catch (error) {
          return resolveTask({ ok: false, status: "error", error: { message: error.message } });
        }
      }
      resolveTask({ ok: false, status: signal ? "interrupted" : "error", error: { message: `fanout worker failed (${signal ?? code}): ${stderr.trim() || stdout.trim()}` } });
    });
    child.stdin.end(`${JSON.stringify(task.payload)}
`);
  });
}
var input = JSON.parse(readFileSync(0, "utf8"));
var results = await Promise.all(input.tasks.map(runTask));
process.stdout.write(`WORKFLOW_FANOUT=${JSON.stringify(results)}
`);
