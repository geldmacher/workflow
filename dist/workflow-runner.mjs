#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  WorkflowEngine
} from "./chunks/chunk-2WPDU2XE.mjs";
import {
  PlanningEngine
} from "./chunks/chunk-M7ERKP7Q.mjs";
import "./chunks/chunk-QB5KAHPL.mjs";
import "./chunks/chunk-7SYGAAH5.mjs";
import "./chunks/chunk-FTS4RQ3D.mjs";
import "./chunks/chunk-TQFRRM3Y.mjs";
import "./chunks/chunk-3CKZRPWU.mjs";
import {
  PreparationStore,
  RunStore
} from "./chunks/chunk-7JUFD6FK.mjs";
import {
  assertCompatiblePreparation,
  assertCompatibleRun
} from "./chunks/chunk-7NHOTGTA.mjs";
import "./chunks/chunk-WU6JOB3C.mjs";

// src/controller/runner.mjs
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function argument(name) {
  let index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}
var action = argument("action"), runId = argument("run-id"), preparationId = argument("preparation-id"), workspace = argument("workspace"), stateRoot = argument("state-root"), pluginRoot = resolve(argument("plugin-root") ?? dirname(dirname(fileURLToPath(import.meta.url))));
if (!action || !!runId == !!preparationId || !workspace || !stateRoot) throw new Error("runner requires action, exactly one run-id or preparation-id, workspace, and state-root");
var store = new RunStore(stateRoot), preparationStore = new PreparationStore(stateRoot), engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot }), planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
function recordInterruption(signal) {
  try {
    if (runId) {
      let run = store.get(runId);
      ["achieved", "accepted-provisional", "blocked", "stopped", "failed"].includes(run.lifecycle) || store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: [`runner-${signal.toLowerCase()}`], runner_pid: null }), "runner-interrupted");
    } else {
      let preparation = preparationStore.get(preparationId);
      preparation.status === "planning" && preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, status: "interrupted", blockers: [`planner-${signal.toLowerCase()}`], runner_pid: null }), "planner-interrupted");
    }
  } finally {
    process.exit(128);
  }
}
process.once("SIGTERM", () => recordInterruption("SIGTERM"));
process.once("SIGINT", () => recordInterruption("SIGINT"));
try {
  if (runId) {
    let run = store.get(runId);
    if (assertCompatibleRun(run), run = store.update(runId, run.revision, null, (draft) => ({ ...draft, runner_pid: process.pid }), "runner-started"), action === "execute") engine.execute(runId);
    else throw new Error(`unsupported run action ${action}`);
    run = store.get(runId), run.runner_pid === process.pid && store.update(runId, run.revision, null, (draft) => ({ ...draft, runner_pid: null }), "runner-finished");
  } else {
    let preparation = preparationStore.get(preparationId);
    if (assertCompatiblePreparation(preparation), preparation = preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, runner_pid: process.pid }), "planner-runner-started"), action === "prepare") planningEngine.execute(preparationId);
    else throw new Error(`unsupported preparation action ${action}`);
    preparation = preparationStore.get(preparationId), preparation.runner_pid === process.pid && preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, runner_pid: null }), "planner-runner-finished");
  }
} catch (error) {
  try {
    if (runId) {
      let run = store.get(runId);
      store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "waiting-human", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], error.message])], next_action: "inspect-failure" }), "runner-failed");
    } else {
      let preparation = preparationStore.get(preparationId);
      preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, status: "failed", runner_pid: null, root_plan_text: null, root_plan_hash: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], error.message])] }), "planner-runner-failed");
    }
  } catch {
  }
  console.error(error.stack ?? error.message), process.exitCode = 1;
}
