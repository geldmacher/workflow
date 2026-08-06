#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  WorkflowEngine
} from "./chunks/chunk-ZSZRA4WQ.mjs";
import {
  PlanningEngine
} from "./chunks/chunk-OM7QZLXO.mjs";
import "./chunks/chunk-YAMXLYBL.mjs";
import "./chunks/chunk-MICWNJTT.mjs";
import "./chunks/chunk-PKEO6PA3.mjs";
import "./chunks/chunk-URWS3WPX.mjs";
import "./chunks/chunk-GYZMJGQG.mjs";
import {
  PreparationStore,
  RunStore
} from "./chunks/chunk-MV4DSQKJ.mjs";
import {
  assertCompatiblePreparation,
  assertCompatibleRun
} from "./chunks/chunk-VL4DQUSD.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// src/controller/runner.mjs
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}
var action = argument("action");
var runId = argument("run-id");
var preparationId = argument("preparation-id");
var workspace = argument("workspace");
var stateRoot = argument("state-root");
var pluginRoot = resolve(argument("plugin-root") ?? dirname(dirname(fileURLToPath(import.meta.url))));
if (!action || Boolean(runId) === Boolean(preparationId) || !workspace || !stateRoot) throw new Error("runner requires action, exactly one run-id or preparation-id, workspace, and state-root");
var store = new RunStore(stateRoot);
var preparationStore = new PreparationStore(stateRoot);
var engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
var planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
function recordInterruption(signal) {
  try {
    if (runId) {
      const run = store.get(runId);
      if (!["achieved", "accepted-provisional", "blocked", "stopped", "failed"].includes(run.lifecycle)) store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: [`runner-${signal.toLowerCase()}`], runner_pid: null }), "runner-interrupted");
    } else {
      const preparation = preparationStore.get(preparationId);
      if (preparation.status === "planning") preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, status: "interrupted", blockers: [`planner-${signal.toLowerCase()}`], runner_pid: null }), "planner-interrupted");
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
    assertCompatibleRun(run);
    run = store.update(runId, run.revision, null, (draft) => ({ ...draft, runner_pid: process.pid }), "runner-started");
    if (action === "execute") engine.execute(runId);
    else throw new Error(`unsupported run action ${action}`);
    run = store.get(runId);
    if (run.runner_pid === process.pid) store.update(runId, run.revision, null, (draft) => ({ ...draft, runner_pid: null }), "runner-finished");
  } else {
    let preparation = preparationStore.get(preparationId);
    assertCompatiblePreparation(preparation);
    preparation = preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, runner_pid: process.pid }), "planner-runner-started");
    if (action === "prepare") planningEngine.execute(preparationId);
    else throw new Error(`unsupported preparation action ${action}`);
    preparation = preparationStore.get(preparationId);
    if (preparation.runner_pid === process.pid) preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, runner_pid: null }), "planner-runner-finished");
  }
} catch (error) {
  try {
    if (runId) {
      const run = store.get(runId);
      store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "waiting-human", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], error.message])], next_action: "inspect-failure" }), "runner-failed");
    } else {
      const preparation = preparationStore.get(preparationId);
      preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, status: "failed", runner_pid: null, root_plan_text: null, root_plan_hash: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], error.message])] }), "planner-runner-failed");
    }
  } catch {
  }
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
