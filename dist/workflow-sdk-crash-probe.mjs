#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  loadWorkflowConfig,
  repositoryBaseline,
  resolveRouteProfile
} from "./chunks/chunk-BFZJ6DLB.mjs";
import {
  CursorWorkerAdapter,
  resolveWorkerRuntime,
  sdkVersion
} from "./chunks/chunk-FBG57FMP.mjs";
import {
  buildSandboxProfile
} from "./chunks/chunk-PKEO6PA3.mjs";
import {
  RunStore
} from "./chunks/chunk-TT447BBI.mjs";
import "./chunks/chunk-XFYK5I23.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// scripts/sdk-crash-probe.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
var pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
var sandboxExecutable = "/usr/bin/sandbox-exec";
function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}
function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
function minimalEnvironment(home) {
  return Object.fromEntries(Object.entries({
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    TMPDIR: process.env.TMPDIR,
    HOME: home,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY
  }).filter(([, value]) => typeof value === "string" && value !== ""));
}
async function crashAfterAgentCreate({ runtime: runtime2, runDirectory, workspace: workspace2, acceptedModel }) {
  const home = join(runDirectory, "worker-home");
  const storePath = join(home, "cursor-store");
  mkdirSync(storePath, { recursive: true, mode: 448 });
  const profilePath = join(runDirectory, "crash-probe.sb");
  writeFileSync(profilePath, buildSandboxProfile({ writablePaths: [home], deniedPaths: [workspace2], network: true }), { mode: 384 });
  const job = {
    operation: "run-phase",
    role: "explainer",
    model: acceptedModel,
    prompt: "This prompt must never be sent before the intentional crash.",
    cwd: workspace2,
    mode: "agent",
    agent_id: null,
    force: false,
    store_path: storePath,
    sdk_version: sdkVersion,
    pause_after_create_ms: 3e4
  };
  const child = spawn(sandboxExecutable, ["-f", profilePath, process.execPath, runtime2.entrypoint], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: minimalEnvironment(home)
  });
  child.stdin.end(`${JSON.stringify(job)}
`);
  const progress = await new Promise((resolveProgress, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`crash probe Agent creation timed out: ${stderr}`)), 6e4);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const line = stdout.split("\n").find((candidate) => candidate.startsWith("WORKFLOW_PROGRESS="));
      if (line) {
        clearTimeout(timer);
        resolveProgress(JSON.parse(line.slice("WORKFLOW_PROGRESS=".length)));
      }
    });
    child.once("exit", (code, signal) => {
      if (!stdout.includes("WORKFLOW_PROGRESS=")) {
        clearTimeout(timer);
        reject(new Error(`crash probe Worker exited before Agent creation (${signal ?? code}): ${stderr}`));
      }
    });
  });
  const state = new RunStore(join(runDirectory, "controller-state"));
  const run = state.create({ requested_profile: "supervised", lifecycle: "running", runner_pid: child.pid });
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
  }
  await new Promise((resolveExit) => child.once("exit", resolveExit));
  rmSync(profilePath, { force: true });
  const interrupted = state.get(run.run_id);
  return { agent_id: progress.agent_id, interrupted_state: interrupted.lifecycle, store_path: storePath, store_hash: hash(readFileSync(join(storePath, "agents.ndjson"), "utf8")) };
}
if (!process.env.CURSOR_API_KEY) throw new Error("CURSOR_API_KEY is required in the environment");
if (!existsSync(sandboxExecutable)) throw new Error("hard sandbox is unavailable");
var workspace = resolve(argument("workspace") ?? pluginRoot);
var outputPath = argument("output") ? resolve(argument("output")) : null;
if (!outputPath) throw new Error("--output is required");
var maxCost = Number(argument("max-cost-usd"));
if (!Number.isFinite(maxCost) || maxCost <= 0) throw new Error("--max-cost-usd must be positive");
var config = loadWorkflowConfig(workspace);
if (config.errors.length > 0) throw new Error(config.errors.join("; "));
var profile = resolveRouteProfile(config, argument("route-profile") ?? "certification-v1");
var runtime = resolveWorkerRuntime({ pluginRoot });
if (!runtime.automation_eligible) throw new Error(`crash probe requires the provisioned hash-bound Worker: ${runtime.reason ?? runtime.source}`);
var validation = new CursorWorkerAdapter({ runDirectory: mkdtempSync(join(tmpdir(), "workflow-crash-validation-")), pluginRoot }).validateProfile(profile);
if (!validation.verified) throw new Error(validation.errors.join("; "));
var before = repositoryBaseline(workspace);
var repetitions = [];
var spent = 0;
for (let index = 0; index < 3; index += 1) {
  if (spent >= maxCost) throw new Error("crash probe cost budget exhausted before next repetition");
  const runDirectory = mkdtempSync(join(tmpdir(), `workflow-crash-probe-${index}-`));
  const crashed = await crashAfterAgentCreate({ runtime, runDirectory, workspace, acceptedModel: validation.routes.explainer.model });
  const adapter = new CursorWorkerAdapter({ runDirectory, pluginRoot });
  const resumed = adapter.runPhase({
    role: "explainer",
    route: profile.explainer,
    acceptedModel: validation.routes.explainer.model,
    cwd: workspace,
    agentId: crashed.agent_id,
    prompt: "Read package.json and return only its package name. Do not modify files or perform external effects."
  });
  if (!Number.isFinite(resumed.receipt.cost_usd)) throw new Error("resumed crash probe returned no attestable usage or price");
  spent += resumed.receipt.cost_usd;
  if (spent > maxCost) throw new Error("crash probe cost budget exceeded");
  repetitions.push({
    initial_agent_id: crashed.agent_id,
    resumed_agent_id: resumed.receipt.agent_id,
    crash_state: crashed.interrupted_state,
    explicit_resume: true,
    resumed_status: resumed.receipt.status,
    request_id: resumed.receipt.request_id,
    worker_run_id: resumed.receipt.worker_run_id,
    model_attested: resumed.receipt.model_attested,
    store_hash: crashed.store_hash,
    cost_usd: resumed.receipt.cost_usd
  });
}
var after = repositoryBaseline(workspace);
var report = {
  schema: 1,
  generated_by: "geldmacher-workflow-sdk-crash-probe",
  plugin_hash: runtime.manifest.plugin_hash,
  worker_hash: runtime.manifest.worker_hash,
  runtime_hash: runtime.manifest.runtime_hash,
  route_profile: argument("route-profile") ?? "certification-v1",
  spent_usd: spent,
  max_cost_usd: maxCost,
  repetitions,
  repository_unchanged: before.head === after.head && before.status === after.status
};
report.verified = report.repository_unchanged && repetitions.length === 3 && repetitions.every((item) => item.crash_state === "interrupted" && item.initial_agent_id === item.resumed_agent_id && item.explicit_resume && item.resumed_status === "finished" && item.model_attested && item.request_id && item.worker_run_id && /^[a-f0-9]{64}$/.test(item.store_hash));
mkdirSync(dirname(outputPath), { recursive: true, mode: 448 });
var temporary = `${outputPath}.${process.pid}.tmp`;
writeFileSync(temporary, `${JSON.stringify(report, null, 2)}
`, { mode: 384 });
renameSync(temporary, outputPath);
console.log(JSON.stringify({ output: outputPath, verified: report.verified, repetitions: repetitions.length, spent_usd: spent }, null, 2));
if (!report.verified) process.exitCode = 1;
