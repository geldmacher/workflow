import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PreparationStore, RunStore } from "./store.mjs";
import { WorkflowEngine } from "./engine.mjs";
import { PlanningEngine } from "./planning.mjs";
import { assertCompatiblePreparation, assertCompatibleRun } from "./protocol.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

const action = argument("action");
const runId = argument("run-id");
const preparationId = argument("preparation-id");
const workspace = argument("workspace");
const stateRoot = argument("state-root");
const pluginRoot = resolve(argument("plugin-root") ?? dirname(dirname(fileURLToPath(import.meta.url))));

if (!action || Boolean(runId) === Boolean(preparationId) || !workspace || !stateRoot) throw new Error("runner requires action, exactly one run-id or preparation-id, workspace, and state-root");

const store = new RunStore(stateRoot);
const preparationStore = new PreparationStore(stateRoot);
const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });

function recordInterruption(signal) {
  try {
    if (runId) {
      const run = store.get(runId);
      if (!["achieved", "stopped", "failed"].includes(run.lifecycle)) store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", blockers: [`runner-${signal.toLowerCase()}`], runner_pid: null }), "runner-interrupted");
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
      store.update(runId, run.revision, null, (draft) => ({ ...draft, lifecycle: "waiting-human", runner_pid: null, blockers: [...new Set([...(draft.blockers ?? []), error.message])], next_action: "inspect-failure" }), "runner-failed");
    } else {
      const preparation = preparationStore.get(preparationId);
      preparationStore.update(preparationId, preparation.revision, null, (draft) => ({ ...draft, status: "failed", runner_pid: null, root_plan_text: null, root_plan_hash: null, blockers: [...new Set([...(draft.blockers ?? []), error.message])] }), "planner-runner-failed");
    }
  } catch {
    // The originating error is reported below when no run can be updated.
  }
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
