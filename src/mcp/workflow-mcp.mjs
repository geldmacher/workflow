import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { PreparationStore, RunStore, defaultStateRoot } from "../controller/store.mjs";
import { WorkflowEngine } from "../controller/engine.mjs";
import { deriveControllerLearningContext, derivePreparationLearningContext } from "../controller/learning-context.mjs";
import { createLearningSourceReceiptAuthority } from "../controller/learning-source-receipt.mjs";
import { PlanningEngine } from "../controller/planning.mjs";
import { loadWorkflowConfig, resolveRouteProfile } from "../controller/config.mjs";
import { CursorWorkerAdapter } from "../controller/worker-adapter.mjs";
import { resolveCapabilities } from "../controller/capabilities.mjs";
import { approveVerificationProfile, auditVerificationProfile, draftVerificationProfile, inspectVerificationProfile, recordVerificationProof } from "../controller/verification-profile.mjs";
import { awaitCooperativeExit, clearWorkerControl, writeWorkerControl } from "../controller/control.mjs";
import { sharedArtifactStateRoot } from "../core/state-paths.mjs";
import { registerManualWorkflowTools } from "./manual-tools.mjs";
import { WorkspaceRootAuthority, WorkspaceRootError } from "./workspace-roots.mjs";
import { proofArtifacts } from "./proof-artifacts.mjs";
import { toolContract } from "./tool-contracts.mjs";
import { modelInheritanceSummary } from "../../hooks/model-inheritance-state.mjs";
import {
  PLUGIN_VERSION,
  assertCompatibleRun,
  preparationView,
  runView,
} from "../controller/protocol.mjs";

const pluginRoot = resolve(process.env.CURSOR_PLUGIN_ROOT ?? dirname(dirname(fileURLToPath(import.meta.url))));
const server = new McpServer({ name: "workflow", version: PLUGIN_VERSION });
const workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots());
const learningSourceReceipts = createLearningSourceReceiptAuthority();
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());

function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}

function failure(error) {
  return result({
    error: error.message,
    ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}),
  }, true);
}

function proofResult(text) {
  const source = String(text ?? "");
  const fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const value = JSON.parse(fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("verification proof returned no object");
  return value;
}

async function context(workspaceRoot) {
  const workspace = await workspaceAuthority.resolve(workspaceRoot);
  const stateRoot = defaultStateRoot(workspace);
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
  const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
  return { workspace, stateRoot, store, preparationStore, engine, planningEngine };
}

const manualTools = registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot: defaultStateRoot,
  handoffStateRoot: sharedArtifactStateRoot,
  result,
  failure,
  includeStatus: false,
  contract: toolContract,
});

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

server.registerTool("workflow_prepare", toolContract("workflow_prepare"), async (input) => {
  try {
    if (Boolean(input.goal) === Boolean(input.root_plan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (input.root_artifacts && !input.root_plan) throw new Error("workflow_prepare root_artifacts require root_plan");
    if ((input.root_artifacts ?? []).reduce((total, artifact) => total + artifact.text.length, 0) > 1_000_000) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
    const { workspace, stateRoot, preparationStore, planningEngine } = await context(input.workspace_root);
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
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_start", toolContract("workflow_start"), async (input) => {
  try {
    const { workspace, engine, store, stateRoot } = await context(input.workspace_root);
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
    return result({
      run: runView(run),
      snapshot: engine.snapshot(run),
      preparation: preparationView(started.preparation),
      learning_source_receipt: learningSourceReceipts.issue(run),
      duplicate: started.duplicate,
    });
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_status", toolContract("workflow_status"), async (input) => {
  try {
    const subjectCount = [input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length;
    if (subjectCount > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.artifacts && (input.run_id || input.preparation_id)) throw new Error("workflow_status artifacts cannot be combined with a controller subject");
    if (input.artifacts && input.learning_source_receipt) throw new Error("manual workflow_status does not accept a controller learning source receipt");
    if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
    if (input.artifacts) return manualTools.status(input);
    if (input.manual_acceptance) throw new Error("workflow_status manual_acceptance requires current-task artifacts");
    const { workspace, stateRoot, store, preparationStore, engine } = await context(input.workspace_root);
    const model_inheritance = modelInheritanceSummary(stateRoot);
    if (input.run_id) {
      const run = store.get(input.run_id);
      const sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, run);
      return result({
        subject_kind: "run",
        run: runView(run),
        snapshot: engine.snapshot(run),
        learning: deriveControllerLearningContext({ run, events: store.events(run.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance,
      });
    }
    if (input.preparation_id) {
      const preparation = preparationStore.get(input.preparation_id);
      return result({ subject_kind: "preparation", preparation: preparationView(preparation), learning: derivePreparationLearningContext(preparation), model_inheritance });
    }
    const active = [
      ...store.active().map((run) => ({ kind: "run", value: run })),
      ...preparationStore.active().map((preparation) => ({ kind: "preparation", value: preparation })),
    ];
    if (active.length === 0) throw new Error("no active Workflow Preparation or Run");
    if (active.length > 1) throw new Error("multiple active Workflow subjects require an explicit ID");
    if (active[0].kind === "run") {
      const sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, active[0].value);
      return result({
        subject_kind: "run",
        run: runView(active[0].value),
        snapshot: engine.snapshot(active[0].value),
        learning: deriveControllerLearningContext({ run: active[0].value, events: store.events(active[0].value.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance,
      });
    }
    return result({ subject_kind: "preparation", preparation: preparationView(active[0].value), learning: derivePreparationLearningContext(active[0].value), model_inheritance });
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_watch", toolContract("workflow_watch"), async (input) => {
  try {
    requireOneSubject(input);
    const { store, preparationStore, engine } = await context(input.workspace_root);
    if (input.run_id) {
      const events = await watchEvents((after) => store.events(input.run_id, after), input.after_event, input.timeout_ms);
      const run = store.get(input.run_id);
      return result({ subject_kind: "run", events, next_event: input.after_event + events.length, run: runView(run), snapshot: engine.snapshot(run) });
    }
    const events = await watchEvents((after) => preparationStore.events(input.preparation_id, after), input.after_event, input.timeout_ms);
    const preparation = preparationStore.get(input.preparation_id);
    return result({ subject_kind: "preparation", events, next_event: input.after_event + events.length, preparation: preparationView(preparation) });
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_control", toolContract("workflow_control"), async (input) => {
  try {
    requireOneSubject(input);
    const { workspace, store, preparationStore, engine, stateRoot } = await context(input.workspace_root);
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
    return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), learning_source_receipt: learningSourceReceipts.issue(run), duplicate: mutation.duplicate });
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_answer", toolContract("workflow_answer"), async (input) => {
  try {
    const { store, engine } = await context(input.workspace_root);
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (before.lifecycle !== "waiting-human") throw new Error("run is not waiting for a human answer");
      engine.update(input.run_id, (draft) => ({ ...draft, answers: [...(draft.answers ?? []), { at: new Date().toISOString(), answer: input.answer }], blockers: [], next_action: "replan" }), "answer-recorded");
    });
    return result({ run: runView(mutation.value), snapshot: engine.snapshot(mutation.value), learning_source_receipt: learningSourceReceipts.issue(mutation.value), duplicate: mutation.duplicate });
  } catch (error) { return failure(error); }
});

server.registerTool("workflow_validate_models", toolContract("workflow_validate_models"), async ({ workspace_root, route_profile }) => {
  try {
    const { workspace, stateRoot } = await context(workspace_root);
    const config = loadWorkflowConfig(workspace);
    if (config.errors.length > 0) return result({ verified: false, errors: config.errors, capabilities: resolveCapabilities(stateRoot, {}, { pluginRoot }) });
    const profile = resolveRouteProfile(config, route_profile);
    const validation = new CursorWorkerAdapter({ runDirectory: resolve(stateRoot, "model-validation"), pluginRoot }).validateProfile(profile);
    return result({ ...validation, capabilities: resolveCapabilities(stateRoot, { model_catalog_verified: validation.verified }, { pluginRoot }) });
  } catch (error) {
    return result({
      verified: false,
      errors: [error.message],
      ...(error instanceof WorkspaceRootError ? { error_code: error.code } : {}),
    }, true);
  }
});

server.registerTool("workflow_verification_profile", toolContract("workflow_verification_profile"), async (input) => {
  let ownedProofRoot = null;
  let retainProof = false;
  try {
    const { workspace, stateRoot } = await context(input.workspace_root);
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
      ownedProofRoot = proofRoot;
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
      const recorded = recordVerificationProof(stateRoot, inspection, {
        capabilities: reported.capabilities,
        observations: reported.observations ?? null,
        limitations: reported.limitations ?? [],
        evidence_hashes: artifacts.map((artifact) => artifact.hash),
        artifacts,
        actor_receipt: phase.receipt,
      });
      retainProof = true;
      return result(recorded);
    }
    if (!input.approved_hash) throw new Error("approve requires approved_hash");
    if (!inspection.valid || inspection.profile_hash !== input.approved_hash) throw new Error("current verification profile does not match approved_hash");
    return result(approveVerificationProfile(stateRoot, inspection.manifest.profile_id, input.approved_hash));
  } catch (error) { return failure(error); }
  finally { if (ownedProofRoot && !retainProof) rmSync(ownedProofRoot, { recursive: true, force: true }); }
});

const transport = new StdioServerTransport();
await server.connect(transport);
