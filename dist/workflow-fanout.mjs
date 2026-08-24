#!/usr/bin/env node
#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  buildSandboxProfile
} from "./chunks/chunk-FTS4RQ3D.mjs";
import "./chunks/chunk-WU6JOB3C.mjs";

// src/controller/read-fanout-runner.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
var sandboxExecutable = "/usr/bin/sandbox-exec";
function runTask(task, index) {
  return new Promise((resolveTask) => {
    if (process.platform !== "darwin" || !existsSync(sandboxExecutable)) return resolveTask({ ok: !1, status: "error", error: { message: "hard sandbox unavailable" } });
    let runRoot = task.writablePaths[0] ?? dirname(resolve(task.entrypoint));
    mkdirSync(runRoot, { recursive: !0, mode: 448 });
    let profilePath = join(runRoot, `fanout-${process.pid}-${index}.sb`);
    writeFileSync(profilePath, buildSandboxProfile(task), { mode: 384 });
    let child = spawn(sandboxExecutable, ["-f", profilePath, process.execPath, resolve(task.entrypoint)], {
      stdio: ["pipe", "pipe", "pipe"],
      env: task.environment
    }), stdout = "", stderr = "";
    child.stdout.setEncoding("utf8"), child.stderr.setEncoding("utf8"), child.stdout.on("data", (value) => {
      stdout += value;
    }), child.stderr.on("data", (value) => {
      stderr += value;
    });
    let timeout = setTimeout(() => child.kill("SIGTERM"), task.timeoutMs ?? 3e5);
    child.on("error", (error) => {
      clearTimeout(timeout), rmSync(profilePath, { force: !0 }), resolveTask({ ok: !1, status: "error", error: { message: error.message } });
    }), child.on("close", (code, signal) => {
      clearTimeout(timeout), rmSync(profilePath, { force: !0 });
      let marker = stdout.split(`
`).findLast((line) => line.startsWith("WORKFLOW_RESULT="));
      if (marker)
        try {
          return resolveTask(JSON.parse(marker.slice(16)));
        } catch (error) {
          return resolveTask({ ok: !1, status: "error", error: { message: error.message } });
        }
      resolveTask({ ok: !1, status: signal ? "interrupted" : "error", error: { message: `fanout worker failed (${signal ?? code}): ${stderr.trim() || stdout.trim()}` } });
    }), child.stdin.end(`${JSON.stringify(task.payload)}
`);
  });
}
var input = JSON.parse(readFileSync(0, "utf8")), results = await Promise.all(input.tasks.map(runTask));
process.stdout.write(`WORKFLOW_FANOUT=${JSON.stringify(results)}
`);
