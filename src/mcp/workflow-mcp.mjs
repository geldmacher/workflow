import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { PreparationStore, RunStore, defaultStateRoot } from "../controller/store.mjs";
import { WorkflowEngine } from "../controller/engine.mjs";
import { PlanningEngine } from "../controller/planning.mjs";
import { loadWorkflowConfig, resolveRouteProfile } from "../controller/config.mjs";
import { CursorWorkerAdapter } from "../controller/worker-adapter.mjs";
import { resolveCapabilities } from "../controller/capabilities.mjs";
import { awaitCooperativeExit, clearWorkerControl, writeWorkerControl } from "../controller/control.mjs";
import { deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import {
  PLUGIN_VERSION,
  assertCompatibleRun,
  preparationView,
  runView,
} from "../controller/protocol.mjs";

const pluginRoot = resolve(process.env.CURSOR_PLUGIN_ROOT ?? dirname(dirname(fileURLToPath(import.meta.url))));
const server = new McpServer({ name: "geldmacher-workflow", version: PLUGIN_VERSION });

function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}

function context(workspaceRoot) {
  const workspace = realpathSync(resolve(workspaceRoot));
  const stateRoot = defaultStateRoot(workspace);
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
  const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
  return { workspace, stateRoot, store, preparationStore, engine, planningEngine };
}

function runnerPath() {
  return resolve(process.env.GELDMACHER_WORKFLOW_RUNNER ?? fileURLToPath(new URL("./workflow-runner.mjs", import.meta.url)));
}

function launchRunner({ action, workspace, stateRoot, runId = null, preparationId = null }) {
  const subjectArgs = runId ? ["--run-id", runId] : ["--preparation-id", preparationId];
  const child = spawn(process.execPath, [runnerPath(), "--action", action, ...subjectArgs, "--workspace", workspace, "--state-root", stateRoot, "--plugin-root", pluginRoot], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return child.pid;
}

function requireOneSubject(input) {
  if (Boolean(input.run_id) === Boolean(input.preparation_id)) throw new Error("exactly one of run_id or preparation_id is required");
}

function idempotentRunMutation(store, runId, expectedRevision, idempotencyKey, operation) {
  const before = store.get(runId);
  assertCompatibleRun(before);
  if (before.idempotency?.[idempotencyKey]) return { value: before, duplicate: true };
  if (before.revision !== expectedRevision) throw new Error(`revision conflict: expected ${expectedRevision}, current ${before.revision}`);
  operation(before);
  const after = store.get(runId);
  const recorded = store.update(runId, after.revision, idempotencyKey, (draft) => draft, "idempotency-recorded");
  return { value: recorded, duplicate: false };
}

async function watchEvents(readEvents, afterEvent, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const events = readEvents(afterEvent);
    if (events.length > 0 || Date.now() >= deadline) return events;
    await new Promise((resolveWait) => setTimeout(resolveWait, Math.min(250, Math.max(0, deadline - Date.now()))));
  }
}

server.registerTool("workflow_prepare", {
  description: "Run the exact configured planner route in a read-only pre-run phase and produce either one approvable schema-3 root or manual intent questions.",
  inputSchema: {
    workspace_root: z.string().min(1),
    goal: z.string().min(1).optional(),
    root_plan: z.string().min(1).optional(),
    requested_profile: z.enum(["auto-gated", "unattended-eligible"]),
    route_profile: z.string().min(1).default("default"),
    expected_revision: z.literal(0),
    idempotency_key: z.string().min(8),
  },
}, async (input) => {
  try {
    if (Boolean(input.goal) === Boolean(input.root_plan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    const { workspace, stateRoot, preparationStore, planningEngine } = context(input.workspace_root);
    const created = planningEngine.prepare({
      goal: input.goal,
      rootPlan: input.root_plan,
      requestedProfile: input.requested_profile,
      routeProfile: input.route_profile,
      idempotencyKey: input.idempotency_key,
    });
    let preparation = created.preparation;
    if (!created.duplicate && preparation.status === "planning") {
      const pid = launchRunner({ action: "prepare", workspace, stateRoot, preparationId: preparation.preparation_id });
      preparation = preparationStore.update(preparation.preparation_id, preparation.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "planner-runner-launched");
    }
    return result({ preparation: preparationView(preparation), duplicate: created.duplicate });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_start", {
  description: "Atomically consume one displayed root-ready preparation after explicit root-hash approval and create exactly one approved run.",
  inputSchema: {
    workspace_root: z.string().min(1),
    preparation_id: z.string().min(1),
    approved_root_hash: z.string().length(64),
    expected_preparation_revision: z.number().int().min(0),
    idempotency_key: z.string().min(8),
  },
}, async (input) => {
  try {
    const { workspace, engine, store, stateRoot } = context(input.workspace_root);
    const started = engine.start({
      preparationId: input.preparation_id,
      approvedRootHash: input.approved_root_hash,
      expectedPreparationRevision: input.expected_preparation_revision,
      idempotencyKey: input.idempotency_key,
    });
    let run = started.run;
    if (!started.duplicate && run.lifecycle === "queued") {
      const pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return result({ run: runView(run), snapshot: engine.snapshot(run), preparation: preparationView(started.preparation), duplicate: started.duplicate });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_status", {
  description: "Return current status for one planning preparation, run, or stateless manual schema-3 artifact chain.",
  inputSchema: {
    workspace_root: z.string().min(1),
    run_id: z.string().min(1).optional(),
    preparation_id: z.string().min(1).optional(),
    root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
    artifacts: z.array(z.object({
      label: z.string().min(1).max(200),
      text: z.string().min(1).max(250_000),
    })).min(1).max(32).optional(),
  },
}, async (input) => {
  try {
    const subjectCount = [input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length;
    if (subjectCount > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.root_plan_id) {
      if (!input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
      if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      const workspace = realpathSync(resolve(input.workspace_root));
      const manual = deriveManualWorkflowSnapshot({ rootPlanId: input.root_plan_id, artifacts: input.artifacts, pluginRoot });
      return result({ subject_kind: "artifact-chain", run: null, ...manual, workspace_root: workspace });
    }
    if (input.artifacts) throw new Error("workflow_status artifacts require root_plan_id");
    const { store, preparationStore, engine } = context(input.workspace_root);
    if (input.run_id) {
      const run = store.get(input.run_id);
      return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run) });
    }
    if (input.preparation_id) return result({ subject_kind: "preparation", preparation: preparationView(preparationStore.get(input.preparation_id)) });
    const active = [
      ...store.active().map((run) => ({ kind: "run", value: run })),
      ...preparationStore.active().map((preparation) => ({ kind: "preparation", value: preparation })),
    ];
    if (active.length === 0) throw new Error("no active Workflow Preparation or Run");
    if (active.length > 1) throw new Error("multiple active Workflow subjects require an explicit ID");
    if (active[0].kind === "run") return result({ subject_kind: "run", run: runView(active[0].value), snapshot: engine.snapshot(active[0].value) });
    return result({ subject_kind: "preparation", preparation: preparationView(active[0].value) });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_watch", {
  description: "Return events after a cursor for exactly one planning preparation or run without mutation.",
  inputSchema: {
    workspace_root: z.string().min(1), run_id: z.string().min(1).optional(), preparation_id: z.string().min(1).optional(),
    after_event: z.number().int().min(0).default(0), timeout_ms: z.number().int().min(0).max(30_000).default(0),
  },
}, async (input) => {
  try {
    requireOneSubject(input);
    const { store, preparationStore, engine } = context(input.workspace_root);
    if (input.run_id) {
      const events = await watchEvents((after) => store.events(input.run_id, after), input.after_event, input.timeout_ms);
      const run = store.get(input.run_id);
      return result({ subject_kind: "run", events, next_event: input.after_event + events.length, run: runView(run), snapshot: engine.snapshot(run) });
    }
    const events = await watchEvents((after) => preparationStore.events(input.preparation_id, after), input.after_event, input.timeout_ms);
    const preparation = preparationStore.get(input.preparation_id);
    return result({ subject_kind: "preparation", events, next_event: input.after_event + events.length, preparation: preparationView(preparation) });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_control", {
  description: "Stop a preparation, or approve a run exception/gate, pause, resume, stop, or accept local delivery using optimistic revision and idempotency.",
  inputSchema: {
    workspace_root: z.string().min(1), run_id: z.string().min(1).optional(), preparation_id: z.string().min(1).optional(),
    action: z.enum(["approve", "pause", "resume", "stop", "accept"]),
    expected_revision: z.number().int().min(0), idempotency_key: z.string().min(8),
  },
}, async (input) => {
  try {
    requireOneSubject(input);
    const { workspace, store, preparationStore, engine, stateRoot } = context(input.workspace_root);
    if (input.preparation_id) {
      if (input.action !== "stop") throw new Error("preparations accept only stop");
      let runnerPid = null;
      const mutation = preparationStore.controlUpdate(input.preparation_id, input.expected_revision, input.idempotency_key, (before) => {
        if (["consumed", "expired", "stopped"].includes(before.status)) throw new Error(`cannot stop preparation status ${before.status}`);
        runnerPid = before.runner_pid;
        return { ...before, status: "stopped", runner_pid: null, blockers: [...new Set([...(before.blockers ?? []), "stopped-by-user"])] };
      }, "preparation-stopped");
      if (!mutation.duplicate && runnerPid) {
        writeWorkerControl(preparationStore.preparationDirectory(input.preparation_id), "stop", { reason: "user-stop" });
        const cooperative = await awaitCooperativeExit(runnerPid);
        if (cooperative.hard_kill_required) {
          try { process.kill(-runnerPid, "SIGTERM"); } catch { /* planner already exited */ }
          preparationStore.appendEvent(input.preparation_id, "planner-hard-cancelled", cooperative);
          const latest = preparationStore.get(input.preparation_id);
          preparationStore.update(input.preparation_id, latest.revision, null, (draft) => ({ ...draft, status: "interrupted", runner_pid: null, blockers: [...new Set([...(draft.blockers ?? []), "cooperative-cancel-grace-exceeded"])] }), "planner-cancel-interrupted");
        } else preparationStore.appendEvent(input.preparation_id, "planner-cooperatively-cancelled", cooperative);
      }
      return result({ subject_kind: "preparation", preparation: preparationView(mutation.preparation), duplicate: mutation.duplicate });
    }

    let controlledRunnerPid = null;
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (input.action === "approve") {
        if (before.next_action === "approve-slice") engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "implement-slice" }), "slice-approved");
        else if (before.next_action === "approve-downgrade") engine.approve(input.run_id, { acceptDowngrade: true });
        else throw new Error("run is not awaiting a slice or downgrade approval");
      } else if (input.action === "accept") {
        if (before.next_action !== "accept-delivery") throw new Error("delivery is not awaiting acceptance");
        engine.acceptDelivery(input.run_id);
      } else if (input.action === "pause") {
        controlledRunnerPid = before.runner_pid;
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "paused", next_action: "resume" }), "run-paused");
      } else if (input.action === "resume") {
        if (!["paused", "interrupted"].includes(before.lifecycle)) throw new Error(`cannot resume lifecycle ${before.lifecycle}`);
        if (!before.plan) throw new Error("cannot resume without a complete schema-3 root plan");
        clearWorkerControl(store.runDirectory(input.run_id));
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "implement-slice" }), "run-resumed");
      } else if (input.action === "stop") {
        controlledRunnerPid = before.runner_pid;
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "stopped", next_action: "none" }), "run-stopped");
      }
    });
    let run = mutation.value;
    if (!mutation.duplicate && ["pause", "stop"].includes(input.action) && controlledRunnerPid) {
      writeWorkerControl(store.runDirectory(input.run_id), input.action, { reason: `user-${input.action}` });
      const cooperative = await awaitCooperativeExit(controlledRunnerPid);
      if (cooperative.hard_kill_required) {
        try { process.kill(-controlledRunnerPid, "SIGTERM"); } catch { /* runner already exited */ }
        store.appendEvent(input.run_id, "runner-hard-cancelled", cooperative);
        const latest = store.get(input.run_id);
        run = store.update(input.run_id, latest.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", runner_pid: null, blockers: [...new Set([...(draft.blockers ?? []), "cooperative-cancel-grace-exceeded"])] }), "runner-cancel-interrupted");
      } else store.appendEvent(input.run_id, "runner-cooperatively-cancelled", cooperative);
    }
    if (!mutation.duplicate && run.lifecycle === "queued") {
      const pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), duplicate: mutation.duplicate });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_answer", {
  description: "Record a human answer for a waiting run; planning preparations intentionally have no answer loop.",
  inputSchema: {
    workspace_root: z.string().min(1), run_id: z.string().min(1), answer: z.string().min(1),
    expected_revision: z.number().int().min(0), idempotency_key: z.string().min(8),
  },
}, async (input) => {
  try {
    const { store, engine } = context(input.workspace_root);
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (before.lifecycle !== "waiting-human") throw new Error("run is not waiting for a human answer");
      engine.update(input.run_id, (draft) => ({ ...draft, answers: [...(draft.answers ?? []), { at: new Date().toISOString(), answer: input.answer }], blockers: [], next_action: "replan" }), "answer-recorded");
    });
    return result({ run: runView(mutation.value), snapshot: engine.snapshot(mutation.value), duplicate: mutation.duplicate });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_validate_models", {
  description: "Validate concrete model IDs, reasoning effort, options and fallback-deny routes against the live Cursor catalog.",
  inputSchema: { workspace_root: z.string().min(1), route_profile: z.string().min(1).default("default") },
}, async ({ workspace_root, route_profile }) => {
  try {
    const { workspace, stateRoot } = context(workspace_root);
    const config = loadWorkflowConfig(workspace);
    if (config.errors.length > 0) return result({ verified: false, errors: config.errors, capabilities: resolveCapabilities(stateRoot, {}, { pluginRoot }) });
    const profile = resolveRouteProfile(config, route_profile);
    const validation = new CursorWorkerAdapter({ runDirectory: resolve(stateRoot, "model-validation"), pluginRoot }).validateProfile(profile);
    return result({ ...validation, capabilities: resolveCapabilities(stateRoot, { model_catalog_verified: validation.verified }, { pluginRoot }) });
  } catch (error) { return result({ verified: false, errors: [error.message] }, true); }
});

const transport = new StdioServerTransport();
await server.connect(transport);
