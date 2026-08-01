import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
import { approveVerificationProfile, auditVerificationProfile, draftVerificationProfile, inspectVerificationProfile, recordVerificationProof } from "../controller/verification-profile.mjs";
import { awaitCooperativeExit, clearWorkerControl, writeWorkerControl } from "../controller/control.mjs";
import { deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { ArtifactHandoffStore } from "../controller/artifact-handoff.mjs";
import { buildDeliveryEvidence, persistCloseout } from "../controller/delivery-closeout.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
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

function proofArtifacts(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`verification proof artifact may not be a symlink: ${path}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        if (lstatSync(path).size > 10 * 1024 * 1024) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
        files.push({ path, hash: createHash("sha256").update(readFileSync(path)).digest("hex") });
      }
    }
  };
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function proofResult(text) {
  const source = String(text ?? "");
  const fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const value = JSON.parse(fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("verification proof returned no object");
  return value;
}

function context(workspaceRoot) {
  const workspace = realpathSync(resolve(workspaceRoot));
  const stateRoot = defaultStateRoot(workspace);
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  const handoffStore = new ArtifactHandoffStore(stateRoot, pluginRoot);
  const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
  const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
  return { workspace, stateRoot, store, preparationStore, handoffStore, engine, planningEngine };
}

function handoffContext(workspaceRoot) {
  const workspace = realpathSync(resolve(workspaceRoot));
  const stateRoot = defaultStateRoot(workspace);
  return { workspace, stateRoot, handoffStore: new ArtifactHandoffStore(stateRoot, pluginRoot) };
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
  description: "Run the configured planner pool in a read-only pre-run phase and produce either one approvable schema-5 intent root or manual intent questions.",
  inputSchema: {
    workspace_root: z.string().min(1),
    goal: z.string().min(1).optional(),
    root_plan: z.string().min(1).optional(),
    root_artifacts: z.array(z.object({
      label: z.string().min(1).max(200),
      text: z.string().min(1).max(250_000),
    })).min(1).max(32).optional(),
    requested_profile: z.enum(["supervised", "autonomous"]),
    route_profile: z.string().min(1).default("default"),
    expected_revision: z.literal(0),
    idempotency_key: z.string().min(8),
  },
}, async (input) => {
  try {
    if (Boolean(input.goal) === Boolean(input.root_plan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (input.root_artifacts && !input.root_plan) throw new Error("workflow_prepare root_artifacts require root_plan");
    if ((input.root_artifacts ?? []).reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
    const { workspace, stateRoot, preparationStore, planningEngine } = context(input.workspace_root);
    const created = planningEngine.prepare({
      goal: input.goal,
      rootPlan: input.root_plan,
      rootArtifacts: input.root_artifacts,
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

const artifactInput = z.object({
  label: z.string().min(1).max(200),
  text: z.string().min(1).max(250_000),
});

const checkEvidenceInput = z.object({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  feature_id: z.string().min(1).nullable().optional(),
  grade: z.enum(["verified", "supported", "partial", "unavailable", "failed"]),
  surface: z.string().min(1).optional(),
  method: z.string().min(1).optional(),
  expected: z.string().min(1).optional(),
  observed: z.string().min(1),
  repetitions: z.number().int().min(0).optional(),
  artifact_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(64).optional(),
  limitations: z.array(z.string().min(1)).max(64).optional(),
});

server.registerTool("workflow_artifact_record", {
  description: "Validate and atomically cache exact Schema-5 work-plan or work-review artifacts as non-authoritative cross-context handoff data.",
  inputSchema: {
    workspace_root: z.string().min(1),
    artifacts: z.array(artifactInput).min(1).max(32),
  },
}, async (input) => {
  try {
    if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("handoff artifact bundle exceeds 1000000 characters");
    for (const entry of input.artifacts) {
      const inspected = inspectArtifactText(entry.text, pluginRoot);
      if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || !["work-plan", "work-review"].includes(inspected.artifact?.fields?.artifact)) {
        throw new Error("workflow_artifact_record accepts only valid Schema-5 work-plan and work-review artifacts");
      }
    }
    const { workspace, handoffStore } = handoffContext(input.workspace_root);
    return result({ workspace_root: workspace, ...handoffStore.record(input.artifacts), handoff_authoritative: false });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_artifact_context", {
  description: "Return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root, optionally hash-bound to the supplied active native Plan.",
  inputSchema: {
    workspace_root: z.string().min(1),
    root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
    root_plan: z.string().min(1).max(250_000).optional(),
  },
}, async (input) => {
  try {
    const { workspace, handoffStore } = handoffContext(input.workspace_root);
    return result({ workspace_root: workspace, handoff_authoritative: false, ...handoffStore.context(input.root_plan_id, input.root_plan ?? null) });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_closeout", {
  description: "Deterministically build, validate, and cache one Schema-5 delivery-evidence artifact from observed Checks without accepting caller-supplied identity, hashes, grade, status, or topology.",
  inputSchema: {
    workspace_root: z.string().min(1),
    root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
    root_plan: z.string().min(1).max(250_000).optional(),
    artifacts: z.array(artifactInput).min(1).max(32).optional(),
    effective_profile: z.enum(["manual", "supervised", "autonomous"]).default("manual"),
    strategy_revision: z.number().int().min(0).default(0),
    changed_paths: z.array(z.string().min(1).max(1000)).max(1000).default([]),
    check_evidence: z.array(checkEvidenceInput).max(128).default([]),
    repository_snapshot: z.object({
      head: z.string().min(1).optional(),
      working_tree: z.string().min(1).optional(),
      relevant_fingerprints: z.string().min(1).optional(),
      known_failures: z.string().min(1).optional(),
    }).optional(),
  },
}, async (input) => {
  try {
    if ((input.artifacts ?? []).reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("closeout artifact bundle exceeds 1000000 characters");
    const { workspace, handoffStore } = handoffContext(input.workspace_root);
    let cached = [];
    try { cached = handoffStore.context(input.root_plan_id, input.root_plan ?? null).artifacts.map(({ label, text }) => ({ label, text })); }
    catch (error) {
      if (!input.root_plan || !/no handoff Root/.test(error.message)) throw error;
    }
    const merged = new Map();
    for (const entry of [...cached, ...(input.artifacts ?? [])]) {
      const prior = merged.get(entry.label);
      if (prior && prior !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, entry.text);
    }
    const rootPlan = input.root_plan ?? [...merged.values()].find((text) => {
      const inspected = inspectArtifactText(text, pluginRoot);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    });
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    const closeout = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged].map(([label, text]) => ({ label, text })),
      checkEvidence: input.check_evidence,
      changedPaths: input.changed_paths,
      strategyRevision: input.strategy_revision,
      effectiveProfile: input.effective_profile,
      repositorySnapshot: input.repository_snapshot ?? null,
      pluginRoot,
    });
    if (!closeout.artifact) throw new Error("closeout resolved an evidence tip without its exact artifact text");
    const artifactId = closeout.fields.id;
    const persisted = persistCloseout({
      handoffStore,
      rootPlanText: rootPlan,
      artifacts: [...merged].map(([label, text]) => ({ label, text })),
      closeout,
    });
    return result({
      workspace_root: workspace,
      root_plan_id: input.root_plan_id,
      delivery_evidence_id: artifactId,
      artifact: persisted.artifact,
      artifact_hash: persisted.artifact_hash ?? createHash("sha256").update(persisted.artifact).digest("hex"),
      evidence_mode: persisted.fields.evidence_mode,
      overall_grade: persisted.fields.overall_grade,
      status: persisted.fields.status,
      duplicate: persisted.duplicate,
      handoff_persisted: persisted.handoff_persisted,
      handoff_authoritative: false,
      ...(persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {}),
      ...(persisted.warning ? { warning: persisted.warning } : {}),
    });
  } catch (error) { return result({ error: error.message }, true); }
});

server.registerTool("workflow_status", {
  description: "Return current status for one preparation, adaptive run, or explicit/uniquely active stateless manual schema-5 artifact chain; Workflow-3/4 subjects remain read-only.",
  inputSchema: {
    workspace_root: z.string().min(1),
    run_id: z.string().min(1).optional(),
    preparation_id: z.string().min(1).optional(),
    root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
    manual_acceptance: z.enum(["provisional"]).optional(),
    artifacts: z.array(z.object({
      label: z.string().min(1).max(200),
      text: z.string().min(1).max(250_000),
    })).min(1).max(32).optional(),
  },
}, async (input) => {
  try {
    const subjectCount = [input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length;
    if (subjectCount > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.artifacts && (input.run_id || input.preparation_id)) throw new Error("workflow_status artifacts cannot be combined with a controller subject");
    if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
    if (input.artifacts) {
      if (input.artifacts.reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      const workspace = realpathSync(resolve(input.workspace_root));
      const manual = deriveManualWorkflowSnapshot({ rootPlanId: input.root_plan_id, artifacts: input.artifacts, pluginRoot, manualAcceptance: input.manual_acceptance ?? null });
      return result({ subject_kind: "artifact-chain", run: null, ...manual, workspace_root: workspace });
    }
    if (input.manual_acceptance) throw new Error("workflow_status manual_acceptance requires current-task artifacts");
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
  description: "Stop a preparation, or pause, resume, stop, or accept one Run delivery using optimistic revision and idempotency.",
  inputSchema: {
    workspace_root: z.string().min(1), run_id: z.string().min(1).optional(), preparation_id: z.string().min(1).optional(),
    action: z.enum(["pause", "resume", "stop", "accept"]),
    acceptance: z.enum(["verified", "provisional"]).optional(),
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
      if (input.action === "accept") {
        if (!["accept-verified", "accept-provisional"].includes(before.next_action)) throw new Error("delivery is not awaiting acceptance");
        if (!input.acceptance) throw new Error("delivery acceptance requires verified or provisional");
        engine.acceptDelivery(input.run_id, input.acceptance);
      } else if (input.action === "pause") {
        controlledRunnerPid = before.runner_pid;
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "paused", next_action: "resume" }), "run-paused");
      } else if (input.action === "resume") {
        if (!["paused", "interrupted"].includes(before.lifecycle)) throw new Error(`cannot resume lifecycle ${before.lifecycle}`);
        if (!before.plan) throw new Error("cannot resume without a complete schema-5 intent root");
        clearWorkerControl(store.runDirectory(input.run_id));
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "execute-strategy" }), "run-resumed");
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
  description: "Validate ordered pools of concrete approved model candidates against the live Cursor catalog.",
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

server.registerTool("workflow_verification_profile", {
  description: "Draft, inspect, prove, approve, or audit one hash-bound project verification profile.",
  inputSchema: {
    workspace_root: z.string().min(1),
    action: z.enum(["draft", "inspect", "prove", "approve", "audit"]),
    manifest_path: z.string().min(1).default(".cursor/workflow-verification.yaml"),
    surface: z.string().min(1).optional(),
    route_profile: z.string().min(1).default("default"),
    approved_hash: z.string().length(64).optional(),
  },
}, async (input) => {
  try {
    const { workspace, stateRoot } = context(input.workspace_root);
    if (input.action === "draft") {
      if (!input.surface) throw new Error("draft requires surface");
      return result(draftVerificationProfile(workspace, input.surface, pluginRoot, input.manifest_path));
    }
    const inspection = inspectVerificationProfile(workspace, input.manifest_path, pluginRoot);
    if (input.action === "inspect") return result(inspection, !inspection.valid);
    if (input.action === "audit") return result(auditVerificationProfile(workspace, input.manifest_path, pluginRoot, stateRoot));
    if (input.action === "prove") {
      if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
      const config = loadWorkflowConfig(workspace);
      if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
      const route = resolveRouteProfile(config, input.route_profile);
      const proofRoot = join(stateRoot, "verification-proof-artifacts", inspection.profile_hash, randomUUID());
      mkdirSync(proofRoot, { recursive: true, mode: 0o700 });
      const adapter = new CursorWorkerAdapter({ runDirectory: join(stateRoot, "verification-proof-runs", inspection.profile_hash), pluginRoot });
      const validation = adapter.validateProfile(route);
      const verifier = validation.routes?.verifier;
      if (!validation.verified || !verifier?.selected_candidate || !verifier.model) throw new Error(`verifier route unavailable: ${(validation.errors ?? []).join("; ")}`);
      const prompt = [
        "Execute the referenced project Verification Profile now. Repository files are read-only.",
        "Perform launch, doctor, one representative feature drive, observe, evidence capture, reset, and cleanup in that order.",
        "Write every screenshot, trace, log, and receipt only to the external artifact directory. Do not claim a capability without actually performing it.",
        "Return JSON with capabilities containing boolean launch, doctor, drive, observe, evidence, reset, cleanup plus observations and limitations.",
        `PROFILE HASH\n${inspection.profile_hash}`,
        `EXTERNAL ARTIFACT DIRECTORY\n${proofRoot}`,
        ...inspection.sources.map(({ path, content }) => `SOURCE ${path}\n${content}`),
      ].join("\n\n");
      const phase = adapter.runPhase({
        role: "verifier", route: verifier.selected_candidate, routePoolHash: verifier.pool_hash,
        selectionReason: verifier.selection_reason, acceptedModel: verifier.model, prompt, cwd: workspace,
        verifierArtifactPaths: [proofRoot], configurationHash: verifier.pool_hash, artifactProjectionHash: inspection.profile_hash,
      });
      if (!phase.response.ok || !phase.receipt.model_attested) throw new Error(phase.response.error?.message ?? "verification proof model was not attested");
      const reported = proofResult(phase.response.result);
      const artifacts = proofArtifacts(proofRoot);
      if (artifacts.length === 0) throw new Error("verification proof produced no external artifacts");
      return result(recordVerificationProof(stateRoot, inspection, {
        capabilities: reported.capabilities,
        observations: reported.observations ?? null,
        limitations: reported.limitations ?? [],
        evidence_hashes: artifacts.map((artifact) => artifact.hash),
        artifacts,
        actor_receipt: phase.receipt,
      }));
    }
    if (!input.approved_hash) throw new Error("approve requires approved_hash");
    if (!inspection.valid || inspection.profile_hash !== input.approved_hash) throw new Error("current verification profile does not match approved_hash");
    return result(approveVerificationProfile(stateRoot, inspection.manifest.profile_id, input.approved_hash));
  } catch (error) { return result({ error: error.message }, true); }
});

const transport = new StdioServerTransport();
await server.connect(transport);
