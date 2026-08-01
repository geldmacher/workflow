import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WORKFLOW_TOOL_NAMES } from "../src/mcp/tool-registry.mjs";
import { probeSandboxBoundary } from "../src/controller/sandbox.mjs";
import { PreparationStore, RunStore, defaultStateRoot } from "../src/controller/store.mjs";
import { createRunWorktree, repositoryBaseline } from "../src/controller/worktree.mjs";
import { loadWorkflowConfig, resolveRouteProfile } from "../src/controller/config.mjs";
import { CursorWorkerAdapter, sdkVersion } from "../src/controller/worker-adapter.mjs";
import { ARTIFACT_SCHEMA, CONTROLLER_PROTOCOL, PLUGIN_VERSION } from "../src/controller/protocol.mjs";
import { loadPlanningHarness } from "../src/controller/planning.mjs";
import { writeWorkerControl } from "../src/controller/control.mjs";
import { CAPABILITY_RECEIPT_SCHEMA, REQUIRED_OBSERVATIONS, receiptAutomationSafe, receiptProfileEligibility, writeCapabilityReceipt } from "../src/controller/capabilities.mjs";
import { currentPlatform, hashPluginTree, loadWorkerRuntimeManifest, sha256File, workerRuntimeDirectory } from "../src/controller/runtime.mjs";
import { estimateCost } from "../src/controller/policy.mjs";
import { auditVerificationProfile } from "../src/controller/verification-profile.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "workflow-capability-spike-"));
let paidCostLedger = null;
let paidExecutionAllowed = false;
let paidExecutionBlocker = "requires explicit --approve-sdk-cost";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim());
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function skipped(reason) {
  return { verified: false, skipped: true, reason };
}

function observation(value, repetitions = 1) {
  return { verified: value?.verified === true, repetitions: value?.verified === true ? repetitions : 0, evidence_hash: hash(value) };
}

function recordPaidCost(label, cost) {
  if (!paidCostLedger) return;
  if (!Number.isFinite(cost)) throw new Error(`paid capability phase ${label} returned no attestable usage/pricing; refusing the next paid call`);
  paidCostLedger.spent_usd += cost;
  paidCostLedger.entries.push({ label, cost_usd: cost });
  if (paidCostLedger.spent_usd > paidCostLedger.max_cost_usd) throw new Error(`paid capability cost cap exceeded after ${label}: ${paidCostLedger.spent_usd} > ${paidCostLedger.max_cost_usd}`);
}

function assertPaidBudgetRemaining(label) {
  if (paidCostLedger && paidCostLedger.spent_usd >= paidCostLedger.max_cost_usd) throw new Error(`no paid capability budget remains before ${label}`);
}

function archiveExternalEvidence(stateRoot, name, value) {
  const directory = join(stateRoot, "certification", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, name);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  return path;
}

async function startNetworkCanary() {
  const source = "const http=require('node:http');let hits=0;const server=http.createServer((q,s)=>{if(q.url==='/status'){s.writeHead(200,{'content-type':'application/json'});s.end(JSON.stringify({hits}));return}hits+=1;s.writeHead(204);s.end()});server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));";
  const child = spawn(process.execPath, ["-e", source], { stdio: ["ignore", "pipe", "pipe"] });
  const port = await new Promise((resolvePort, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("network canary startup timed out")), 5_000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const line = output.split("\n")[0];
      if (/^\d+$/.test(line)) { clearTimeout(timer); resolvePort(Number(line)); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { if (!/^\d+\n/.test(output)) { clearTimeout(timer); reject(new Error(`network canary exited ${code}`)); } });
  });
  return {
    url: `http://127.0.0.1:${port}/capability-canary`,
    async hits() { return (await (await fetch(`http://127.0.0.1:${port}/status`)).json()).hits; },
    stop: () => child.kill("SIGTERM"),
  };
}

async function mcpSmoke(pluginRoot) {
  const entrypoint = join(pluginRoot, "dist", "workflow-mcp.mjs");
  const transport = new StdioClientTransport({ command: process.execPath, args: [entrypoint], cwd: pluginRoot, env: { ...process.env, CURSOR_PLUGIN_ROOT: pluginRoot }, stderr: "pipe" });
  const client = new Client({ name: "workflow-capability-spike", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
    const expected = [...WORKFLOW_TOOL_NAMES];
    return { verified: JSON.stringify(tools) === JSON.stringify(expected), tools };
  } catch (error) { return { verified: false, error: error.message }; }
  finally { await client.close().catch(() => {}); }
}

function stateAndWorktreeSmoke() {
  const repo = join(temporary, "repo");
  const init = spawnSync("git", ["init", repo], { encoding: "utf8" });
  if (init.status !== 0) throw new Error(init.stderr.trim());
  writeFileSync(join(repo, "README.md"), "capability spike\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["-c", "user.name=Workflow Spike", "-c", "user.email=spike@local.invalid", "commit", "-m", "baseline"]);
  const stateRoot = join(temporary, "state");
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  let preparation = preparationStore.create({ status: "planning", source_kind: "goal", requested_profile: "supervised", expires_at: new Date(Date.now() + 60_000).toISOString() });
  preparation = preparationStore.update(preparation.preparation_id, preparation.revision, "spike-preparation", (draft) => ({ ...draft, status: "interrupted", runner_pid: null }), "spike-preparation-interrupted");
  let run = store.create({ requested_profile: "supervised", lifecycle: "waiting-human" });
  run = store.update(run.run_id, run.revision, "spike-update", (draft) => ({ ...draft, lifecycle: "paused" }), "spike-paused");
  const reopened = new RunStore(stateRoot).get(run.run_id);
  const worktree = createRunWorktree(repo, run.run_id, { root: join(temporary, "worktrees") });
  const reopenedPreparation = new PreparationStore(stateRoot).get(preparation.preparation_id);
  return { verified: reopened.lifecycle === "paused" && reopenedPreparation.status === "interrupted" && worktree.baseline.status === "", revision: reopened.revision, preparation_revision: reopenedPreparation.revision, branch: worktree.branch };
}

function workerRuntimeSmoke(pluginRoot) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "dist", "workflow-worker.mjs")], {
    cwd: pluginRoot,
    input: "{}\n",
    encoding: "utf8",
    env: { ...process.env, CURSOR_API_KEY: "" },
  });
  const dependencyMissing = /ERR_MODULE_NOT_FOUND|Cannot find package/.test(result.stderr);
  return {
    verified: result.stdout.includes("WORKFLOW_RESULT=") && !dependencyMissing,
    expected_fatal_without_job: !dependencyMissing,
    reason: dependencyMissing ? "pinned-sdk-runtime-missing" : undefined,
  };
}

function isolatedWorkerSmoke() {
  const isolatedRoot = join(temporary, "isolated-plugin");
  mkdirSync(join(isolatedRoot, "dist"), { recursive: true });
  cpSync(join(root, "dist", "workflow-worker.mjs"), join(isolatedRoot, "dist", "workflow-worker.mjs"));
  return workerRuntimeSmoke(isolatedRoot);
}

function provisionedWorkerRuntimeSmoke(pluginRoot) {
  const pluginHash = hashPluginTree(pluginRoot);
  const runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion });
  const runtime = loadWorkerRuntimeManifest(runtimeDirectory, {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: pluginHash,
    sdk_version: sdkVersion,
    platform: currentPlatform(),
  });
  if (!runtime.valid) return { verified: false, reason: runtime.reason, reasons: runtime.reasons ?? [] };
  const workerMatches = runtime.manifest.worker_hash === sha256File(join(pluginRoot, "dist", "workflow-worker.mjs"));
  return { verified: workerMatches, reason: workerMatches ? null : "marketplace-worker-hash-mismatch", manifest: runtime.manifest };
}

async function liveModelsSmoke(workspace) {
  if (!process.argv.includes("--live-models")) return { verified: false, skipped: true, reason: "requires --live-models" };
  if (!process.env.CURSOR_API_KEY) return { verified: false, skipped: true, reason: "CURSOR_API_KEY missing" };
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  return new CursorWorkerAdapter({ runDirectory: join(temporary, "live-models"), pluginRoot: root }).validateProfile(profile);
}

async function paidReadOnlyAgentSmoke(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return { verified: false, skipped: true, reason: "requires explicit --approve-sdk-cost" };
  if (!process.env.CURSOR_API_KEY) return { verified: false, skipped: true, reason: "CURSOR_API_KEY missing" };
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  const runDirectory = join(temporary, "live-agent");
  const firstAdapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
  const validation = firstAdapter.validateProfile(profile);
  if (!validation.verified) return { verified: false, errors: validation.errors };
  const before = repositoryBaseline(workspace);
  const acceptedModel = validation.routes.explainer.model;
  assertPaidBudgetRemaining("read-only-create");
  const first = firstAdapter.runPhase({
    role: "explainer", route: validation.routes.explainer.selected_candidate, routePoolHash: validation.routes.explainer.pool_hash,
    selectionReason: validation.routes.explainer.selection_reason, acceptedModel, cwd: workspace,
    prompt: "Read package.json and return only its package name. Do not modify any file or perform any external effect.",
  });
  recordPaidCost("read-only-create", first.receipt.cost_usd);
  const resumedAdapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
  assertPaidBudgetRemaining("read-only-resume");
  const second = resumedAdapter.runPhase({
    role: "explainer", route: validation.routes.explainer.selected_candidate, routePoolHash: validation.routes.explainer.pool_hash,
    selectionReason: validation.routes.explainer.selection_reason, acceptedModel, cwd: workspace, agentId: first.receipt.agent_id,
    prompt: "Return the same package name again. Do not modify any file or perform any external effect.",
  });
  recordPaidCost("read-only-resume", second.receipt.cost_usd);
  const after = repositoryBaseline(workspace);
  return {
    verified: first.response.ok && second.response.ok && first.receipt.model_attested && second.receipt.model_attested && before.head === after.head && before.status === after.status,
    first_receipt: first.receipt,
    resumed_receipt: second.receipt,
    repository_unchanged: before.head === after.head && before.status === after.status,
  };
}

async function paidPlanningAgentSmoke(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return { verified: false, skipped: true, reason: "requires explicit --approve-sdk-cost" };
  if (!process.env.CURSOR_API_KEY) return { verified: false, skipped: true, reason: "CURSOR_API_KEY missing" };
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  const runDirectory = join(temporary, "live-planner");
  const adapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
  const validation = adapter.validateProfile(profile);
  if (!validation.verified) return { verified: false, errors: validation.errors };
  const rootPlan = readFileSync(join(root, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8");
  const routeHash = createHash("sha256").update(JSON.stringify(profile)).digest("hex");
  const harnessHash = createHash("sha256").update("capability-spike-create-plan-capture-v1").digest("hex");
  const before = repositoryBaseline(workspace);
  assertPaidBudgetRemaining("planner-create-plan");
  const first = adapter.runPlanningPhase({
    route: validation.routes.planner.selected_candidate,
    routePoolHash: validation.routes.planner.pool_hash,
    selectionReason: validation.routes.planner.selection_reason,
    acceptedModel: validation.routes.planner.model,
    cwd: workspace,
    configurationHash: routeHash,
    harnessHash,
    deniedReadPaths: [join(workspace, ".git"), join(workspace, ".cursor", "workflow-policy.yaml")],
    prompt: `Read the repository without modifying it. Call CreatePlan exactly once with this exact complete plan and do not call report_intent_blockers.\n\n${rootPlan}`,
  });
  recordPaidCost("planner-create-plan", first.receipt.cost_usd);
  if (first.response.ok) assertPaidBudgetRemaining("planner-technical-resume");
  const second = first.response.ok ? adapter.runPlanningPhase({
    route: validation.routes.planner.selected_candidate,
    routePoolHash: validation.routes.planner.pool_hash,
    selectionReason: validation.routes.planner.selection_reason,
    acceptedModel: validation.routes.planner.model,
    cwd: workspace,
    agentId: first.receipt.agent_id,
    configurationHash: routeHash,
    harnessHash,
    deniedReadPaths: [join(workspace, ".git"), join(workspace, ".cursor", "workflow-policy.yaml")],
    prompt: `Technical capture retry: call CreatePlan exactly once again with this exact complete plan, preserve intent, and do not call report_intent_blockers.\n\n${rootPlan}`,
  }) : null;
  if (second) recordPaidCost("planner-technical-resume", second.receipt.cost_usd);
  const after = repositoryBaseline(workspace);
  const unchanged = before.head === after.head && before.branch === after.branch && before.status === after.status;
  return {
    verified: first.response.ok && second?.response.ok
      && first.planningOutput?.kind === "root" && second.planningOutput?.kind === "root"
      && first.receipt.model_attested && second.receipt.model_attested
      && first.receipt.agent_id === second.receipt.agent_id && unchanged,
    first_receipt: first.receipt,
    resumed_receipt: second?.receipt ?? null,
    create_plan_captured: first.planningOutput?.kind === "root" && second?.planningOutput?.kind === "root",
    same_agent: first.receipt.agent_id === second?.receipt.agent_id,
    repository_unchanged: unchanged,
  };
}

async function paidRemainingRouteSmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  const adapter = new CursorWorkerAdapter({ runDirectory: join(temporary, "remaining-routes"), pluginRoot: root });
  const validation = adapter.validateProfile(profile);
  if (!validation.verified) return { verified: false, errors: validation.errors };
  const before = repositoryBaseline(workspace);
  const repetitions = [];
  for (const role of ["investigator", "writer_escalated", "verifier", "reviewer"]) {
    for (let index = 0; index < 3; index += 1) {
      assertPaidBudgetRemaining(`${role}-attestation-${index}`);
      const phase = adapter.runPhase({
        role,
        route: validation.routes[role].selected_candidate,
        routePoolHash: validation.routes[role].pool_hash,
        selectionReason: validation.routes[role].selection_reason,
        acceptedModel: validation.routes[role].model,
        cwd: workspace,
        prompt: "Read package.json and return only its package name. Do not modify any file or perform any external effect.",
      });
      recordPaidCost(`${role}-attestation-${index}`, phase.receipt.cost_usd);
      repetitions.push({ role, phase });
    }
  }
  const after = repositoryBaseline(workspace);
  return {
    verified: repetitions.length === 12 && repetitions.every((item) => item.phase.response.ok && item.phase.receipt.model_attested)
      && before.head === after.head && before.status === after.status,
    repetitions,
    repository_unchanged: before.head === after.head && before.status === after.status,
  };
}

async function paidBoundarySmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  const validationAdapter = new CursorWorkerAdapter({ runDirectory: join(temporary, "boundary-validation"), pluginRoot: root });
  const validation = validationAdapter.validateProfile(profile);
  if (!validation.verified) return { verified: false, errors: validation.errors };
  const canary = await startNetworkCanary();
  const secret = `WORKFLOW_SECRET_CANARY_${createHash("sha256").update(String(Date.now())).digest("hex")}`;
  const previousSecret = process.env.WORKFLOW_CAPABILITY_SECRET_CANARY;
  process.env.WORKFLOW_CAPABILITY_SECRET_CANARY = secret;
  const repetitions = [];
  try {
    for (let index = 0; index < 3; index += 1) {
      const probeRoot = join(temporary, `boundary-${index}`);
      const allowed = join(probeRoot, "allowed");
      const protectedRoot = join(probeRoot, "protected");
      const foreignRoot = join(temporary, `foreign-${index}`);
      mkdirSync(allowed, { recursive: true });
      mkdirSync(protectedRoot, { recursive: true });
      mkdirSync(foreignRoot, { recursive: true });
      const adapter = new CursorWorkerAdapter({ runDirectory: join(probeRoot, "run"), pluginRoot: root });
      assertPaidBudgetRemaining(`boundary-probe-${index}`);
      const networkHitsBefore = await canary.hits();
      const response = adapter.runCapabilityProbe({
        route: validation.routes.writer.selected_candidate,
        acceptedModel: validation.routes.writer.model,
        cwd: probeRoot,
        writerWritablePaths: [allowed],
        writerDeniedPaths: [protectedRoot, foreignRoot],
        probe: {
          allowed_write_path: join(allowed, "canary.txt"),
          protected_write_path: join(protectedRoot, "canary.txt"),
          foreign_write_path: join(foreignRoot, "canary.txt"),
          network_canary_url: canary.url,
          secret_hash: hash(secret),
        },
      });
      const networkHitsAfter = await canary.hits();
      recordPaidCost(`boundary-probe-${index}`, estimateCost(response.usage, validation.routes.writer.selected_candidate.pricing_usd_per_million));
      const report = response.capability_probe;
      const serialized = JSON.stringify(response);
      repetitions.push({
        response,
        role: "writer",
        accepted_model: validation.routes.writer.model,
        write_verified: response.ok === true && response.capability_write_attempt_observed === true && existsSync(join(allowed, "canary.txt"))
          && !existsSync(join(protectedRoot, "canary.txt")) && !existsSync(join(foreignRoot, "canary.txt")),
        network_verified: response.ok === true && response.capability_network_attempt_observed === true && networkHitsAfter === networkHitsBefore,
        network_hits_before: networkHitsBefore,
        network_hits_after: networkHitsAfter,
        secret_verified: response.ok === true && response.capability_secret_attempt_observed === true && report?.environment_secret_present === false && !serialized.includes(secret),
        model_verified: response.ok === true && JSON.stringify(response.observed_model) === JSON.stringify(validation.routes.writer.model),
      });
    }
  } finally {
    canary.stop();
    if (previousSecret === undefined) delete process.env.WORKFLOW_CAPABILITY_SECRET_CANARY;
    else process.env.WORKFLOW_CAPABILITY_SECRET_CANARY = previousSecret;
  }
  return {
    verified: repetitions.length === 3 && repetitions.every((item) => item.write_verified && item.network_verified && item.secret_verified && item.model_verified),
    repetitions,
    write_verified: repetitions.length === 3 && repetitions.every((item) => item.write_verified),
    network_verified: repetitions.length === 3 && repetitions.every((item) => item.network_verified),
    secret_verified: repetitions.length === 3 && repetitions.every((item) => item.secret_verified),
    model_verified: repetitions.length === 3 && repetitions.every((item) => item.model_verified),
  };
}

async function paidCancelSmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  const config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: false, errors: config.errors };
  const profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  const validation = new CursorWorkerAdapter({ runDirectory: join(temporary, "cancel-validation"), pluginRoot: root }).validateProfile(profile);
  if (!validation.verified) return { verified: false, errors: validation.errors };
  const repetitions = [];
  for (let index = 0; index < 3; index += 1) {
    const runDirectory = join(temporary, `cancel-${index}`);
    mkdirSync(runDirectory, { recursive: true });
    writeWorkerControl(runDirectory, "budget", { reason: "capability-probe" });
    const adapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
    assertPaidBudgetRemaining(`cancel-probe-${index}`);
    const phase = adapter.runPhase({
      role: "explainer",
      route: validation.routes.explainer.selected_candidate,
      routePoolHash: validation.routes.explainer.pool_hash,
      selectionReason: validation.routes.explainer.selection_reason,
      acceptedModel: validation.routes.explainer.model,
      cwd: workspace,
      prompt: "Inspect package.json and produce a detailed read-only explanation. Do not modify files or perform external effects.",
      timeoutMs: 60_000,
      cancelGraceMs: 5_000,
    });
    recordPaidCost(`cancel-probe-${index}`, phase.receipt.cost_usd);
    repetitions.push(phase);
  }
  return {
    verified: repetitions.every((phase) => phase.response.status === "cancelled"
      && phase.receipt.cancel?.sdk_cancel_called === true
      && phase.receipt.cancel?.within_grace_period === true),
    repetitions,
  };
}

function dependencyAuditForReceipt() {
  if (!process.argv.includes("--issue-receipt")) return skipped("audit runs only for explicit --issue-receipt");
  const cache = join(temporary, "npm-cache");
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json", "--cache", cache], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { return { verified: false, error: result.stderr.trim() || "npm audit returned invalid JSON" }; }
  const vulnerabilities = report.metadata?.vulnerabilities ?? {};
  const riskAcceptance = argument("risk-acceptance");
  return {
    verified: (vulnerabilities.high ?? 0) === 0 && (vulnerabilities.critical ?? 0) === 0
      && ((vulnerabilities.moderate ?? 0) === 0 || Boolean(riskAcceptance && existsSync(resolve(riskAcceptance)))),
    report,
    evidence_hash: hash(report),
    production_packages: report.metadata?.dependencies?.prod ?? 0,
    high: vulnerabilities.high ?? 0,
    critical: vulnerabilities.critical ?? 0,
    moderate: vulnerabilities.moderate ?? 0,
  };
}

function verifiedExternalReport(path, label) {
  if (!path) return skipped(`no --${label}`);
  const absolute = resolve(path);
  if (!existsSync(absolute)) return { verified: false, reason: `${label}-missing` };
  try {
    const report = JSON.parse(readFileSync(absolute, "utf8"));
    return { verified: report.verified === true, report, evidence_hash: sha256File(absolute) };
  } catch (error) { return { verified: false, reason: `${label}-invalid`, error: error.message }; }
}

function verifiedCrashReport(path, pluginRoot) {
  const source = verifiedExternalReport(path, "crash-probe-report");
  if (!source.report) return source;
  const runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: hashPluginTree(pluginRoot),
    sdk_version: sdkVersion,
    platform: currentPlatform(),
  });
  const report = source.report;
  const repetitions = Array.isArray(report.repetitions) ? report.repetitions : [];
  const verified = source.verified === true
    && report.schema === 1
    && report.generated_by === "geldmacher-workflow-sdk-crash-probe"
    && runtime.valid
    && report.plugin_hash === runtime.manifest.plugin_hash
    && report.worker_hash === runtime.manifest.worker_hash
    && report.runtime_hash === runtime.manifest.runtime_hash
    && repetitions.length === 3
    && repetitions.every((item) => item.crash_state === "interrupted" && item.explicit_resume === true
      && item.initial_agent_id === item.resumed_agent_id && item.resumed_status === "finished" && item.model_attested === true
      && typeof item.request_id === "string" && typeof item.worker_run_id === "string" && /^[a-f0-9]{64}$/.test(item.store_hash));
  return { ...source, verified, repetitions: repetitions.length, reason: verified ? null : "crash-probe-contract-invalid" };
}

function verifiedCursorHarnessReport(path, pluginRoot, expectedCursorVersion) {
  const source = verifiedExternalReport(path, "cursor-harness-report");
  if (!source.report) return source;
  const runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: hashPluginTree(pluginRoot),
    sdk_version: sdkVersion,
    platform: currentPlatform(),
  });
  const report = source.report;
  const requiredCases = ["clear-plan", "ambiguous-plan", "implement-plan", "fresh-review", "approved-correction", "repeat-review", "work-status", "explain-work", "learn-from-work", "schema-2-rejection", "mixed-chain-rejection", "cli", "editor"];
  const cases = Array.isArray(report.cases) ? report.cases : [];
  const verified = source.verified === true
    && report.schema === 1
    && report.generated_by === "geldmacher-workflow-cursor-harness"
    && runtime.valid
    && report.plugin_hash === runtime.manifest.plugin_hash
    && report.marketplace_git_commit === runtime.manifest.marketplace_git_commit
    && report.cursor_version === expectedCursorVersion
    && requiredCases.every((id) => cases.some((item) => item.id === id && item.passed === true && /^[a-f0-9]{64}$/.test(item.evidence_hash)))
    && Array.isArray(report.artifact_ids) && report.artifact_ids.length > 0
    && report.file_hashes && Object.keys(report.file_hashes).length > 0 && Object.values(report.file_hashes).every((value) => /^[a-f0-9]{64}$/.test(value))
    && Array.isArray(report.model_usage) && report.model_usage.length > 0
    && /^[a-f0-9]{64}$/.test(report.git_before_hash) && /^[a-f0-9]{64}$/.test(report.git_after_hash);
  return { ...source, verified, reason: verified ? null : "cursor-harness-contract-invalid" };
}

try {
  const workspace = resolve(argument("workspace") ?? root);
  const marketplaceRootArgument = argument("marketplace-root");
  const marketplaceRoot = marketplaceRootArgument ? resolve(marketplaceRootArgument) : null;
  const crashResume = verifiedCrashReport(argument("crash-probe-report"), marketplaceRoot ?? root);
  const maxCost = Number(argument("max-cost-usd"));
  if (process.argv.includes("--approve-sdk-cost") && (!Number.isFinite(maxCost) || maxCost <= 0 || maxCost > 6)) throw new Error("--approve-sdk-cost requires --max-cost-usd greater than 0 and no more than 6 for the capability phase");
  const audit = dependencyAuditForReceipt();
  if (process.argv.includes("--issue-receipt") && audit.report) audit.archive_path = archiveExternalEvidence(defaultStateRoot(workspace), "npm-audit.json", {
    lockfile_hash: sha256File(join(root, "npm-shrinkwrap.json")),
    report: audit.report,
  });
  const paidRequested = process.argv.includes("--approve-sdk-cost");
  if (!paidRequested) paidExecutionBlocker = "requires explicit --approve-sdk-cost";
  else if (!process.env.CURSOR_API_KEY) paidExecutionBlocker = "CURSOR_API_KEY missing";
  else if (process.argv.includes("--issue-receipt") && audit.verified !== true) paidExecutionBlocker = "dependency audit gate failed before paid probes";
  else if (process.argv.includes("--issue-receipt") && !crashResume.verified) paidExecutionBlocker = "valid three-run crash report required before paid receipt probes";
  else paidExecutionAllowed = true;
  if (paidExecutionAllowed) {
    const priorCrashCost = process.argv.includes("--issue-receipt") && crashResume.verified ? crashResume.report.spent_usd : 0;
    if (!Number.isFinite(priorCrashCost) || priorCrashCost < 0 || priorCrashCost >= maxCost) throw new Error("crash-probe cost leaves no valid capability budget");
    paidCostLedger = { max_cost_usd: maxCost, spent_usd: priorCrashCost, entries: priorCrashCost > 0 ? [{ label: "prior-crash-probe", cost_usd: priorCrashCost }] : [] };
  }
  const paidAgentRuns = [];
  const paidPlannerRuns = [];
  if (paidExecutionAllowed) {
    for (let index = 0; index < 3; index += 1) paidAgentRuns.push(await paidReadOnlyAgentSmoke(workspace));
    for (let index = 0; index < 3; index += 1) paidPlannerRuns.push(await paidPlanningAgentSmoke(workspace));
  }
  const paidAgent = paidAgentRuns.length === 3
    ? { verified: paidAgentRuns.every((item) => item.verified), repetitions: paidAgentRuns }
    : skipped(paidExecutionBlocker);
  const paidPlanner = paidPlannerRuns.length === 3
    ? { verified: paidPlannerRuns.every((item) => item.verified), repetitions: paidPlannerRuns }
    : skipped(paidExecutionBlocker);
  const remainingRoutes = await paidRemainingRouteSmokes(workspace);
  const boundaries = await paidBoundarySmokes(workspace);
  const cancellation = await paidCancelSmokes(workspace);
  const cursorHarness = verifiedCursorHarnessReport(argument("cursor-harness-report"), marketplaceRoot ?? root, argument("cursor-version") ?? "");
  const workflowConfig = loadWorkflowConfig(workspace);
  const verificationAudit = workflowConfig.errors.length === 0 && workflowConfig.project.verification_profile
    ? auditVerificationProfile(
      workspace,
      workflowConfig.project.verification_profile.manifest_path,
      root,
      defaultStateRoot(workspace),
    )
    : { status: "blocked", errors: workflowConfig.errors.length > 0 ? workflowConfig.errors : ["verification profile is not configured"] };
  const costTracking = process.argv.includes("--approve-sdk-cost")
    ? paidCostLedger
      ? { verified: paidCostLedger.entries.length > 0, blocker: null, ...paidCostLedger }
      : { verified: false, blocker: paidExecutionBlocker, spent_usd: 0, max_cost_usd: maxCost, entries: [] }
    : { verified: true, spent_usd: 0, max_cost_usd: null, entries: [] };
  const observations = {
    schema: CAPABILITY_RECEIPT_SCHEMA,
    plugin_version: PLUGIN_VERSION,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    sdk_version: sdkVersion,
    platform: `${process.platform}-${process.arch}`,
    local_mcp: await mcpSmoke(root),
    marketplace_mcp: marketplaceRoot ? await mcpSmoke(marketplaceRoot) : skipped("no --marketplace-root"),
    local_worker_runtime: workerRuntimeSmoke(root),
    isolated_worker_runtime: isolatedWorkerSmoke(),
    marketplace_worker_runtime: marketplaceRoot ? provisionedWorkerRuntimeSmoke(marketplaceRoot) : skipped("no --marketplace-root"),
    outer_sandbox: probeSandboxBoundary(),
    state_worktree_restart: stateAndWorktreeSmoke(),
    model_catalog: await liveModelsSmoke(workspace),
    model_attestation: paidAgent,
    planner_submission: paidPlanner,
    remaining_route_attestation: remainingRoutes,
    boundary_probes: boundaries,
    cancel_probes: cancellation,
    crash_interrupt_resume: crashResume,
    cursor_harness: cursorHarness,
    verification_profile: verificationAudit,
    dependency_audit: audit,
    cost_tracking: costTracking,
    sdk_write_boundary_verified: boundaries.write_verified === true,
    worker_network_isolated: boundaries.network_verified === true,
    sdk_secret_isolated: boundaries.secret_verified === true,
    sdk_budget_cancel_verified: cancellation.verified === true,
    planner_submission_verified: paidPlanner.verified === true,
    restart_resume_verified: paidAgent.verified === true,
    crash_interrupt_resume_verified: crashResume.verified === true && crashResume.repetitions >= 3,
    model_configuration_exact_verified: boundaries.model_verified === true && paidAgent.verified === true && paidPlanner.verified === true && remainingRoutes.verified === true,
    cursor_harness_verified: cursorHarness.verified === true,
  };
  observations.automation_safe = observations.local_mcp.verified
    && observations.marketplace_mcp.verified
    && observations.marketplace_worker_runtime.verified
    && observations.outer_sandbox.verified
    && observations.state_worktree_restart.verified
    && observations.model_catalog.verified
    && observations.sdk_write_boundary_verified
    && observations.worker_network_isolated
    && observations.sdk_secret_isolated
    && observations.sdk_budget_cancel_verified
    && observations.planner_submission_verified
    && observations.restart_resume_verified
    && observations.crash_interrupt_resume_verified
    && observations.model_configuration_exact_verified
    && observations.cursor_harness_verified
    && verificationAudit.status === "clean"
    && audit.verified === true
    && costTracking.verified === true;
  if (process.argv.includes("--issue-receipt")) {
    const certifiedPluginRoot = marketplaceRoot ?? root;
    const runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
      plugin_version: PLUGIN_VERSION,
      plugin_hash: hashPluginTree(certifiedPluginRoot),
      sdk_version: sdkVersion,
      platform: currentPlatform(),
    });
    const planningHarness = loadPlanningHarness(certifiedPluginRoot);
    const routeProfile = argument("route-profile") ?? "default";
    const config = workflowConfig;
    const route = config.errors.length === 0 ? resolveRouteProfile(config, routeProfile) : null;
    const routeHash = route ? hash(route) : null;
    const verificationProfileHash = verificationAudit.profile_hash ?? hash("verification-profile-unapproved");
    const requestedTaskClass = argument("task-class");
    const requestedRegion = argument("certified-region");
    const qualificationBindings = requestedTaskClass && requestedRegion
      && ["bugfix", "refactor", "performance", "feature", "investigation", "verify-existing"].includes(requestedTaskClass)
      && config.project.certified_regions.includes(requestedRegion)
      && verificationAudit.status === "clean" && routeHash
      ? [{ task_class: requestedTaskClass, verification_profile_hash: verificationProfileHash, route_pool_hash: routeHash, certified_region: requestedRegion }]
      : [];
    const allPhaseReceipts = [
      ...paidAgentRuns.flatMap((item) => [item.first_receipt, item.resumed_receipt]),
      ...paidPlannerRuns.flatMap((item) => [item.first_receipt, item.resumed_receipt]),
      ...(remainingRoutes.repetitions ?? []).map((item) => item.phase.receipt),
      ...(boundaries.repetitions ?? []).map((item) => ({
        phase: item.role,
        accepted_model: item.accepted_model,
        observed_model: item.response?.observed_model,
        request_id: item.response?.request_id,
        agent_id: item.response?.agent_id,
        worker_run_id: item.response?.run_id,
      })),
    ].filter(Boolean);
    const canonicalModel = (role, model) => ({ role, id: model?.id ?? "", params: model?.params ?? [] });
    const requested = allPhaseReceipts.map((receipt) => canonicalModel(receipt.phase, receipt.accepted_model));
    const accepted = allPhaseReceipts.map((receipt) => canonicalModel(receipt.phase, receipt.accepted_model));
    const observed = allPhaseReceipts.map((receipt) => canonicalModel(receipt.phase, receipt.observed_model));
    const certifiedModels = [...new Map(accepted.map((model) => [`${model.role}:${model.id}:${JSON.stringify(model.params)}`, model])).values()];
    const receiptObservations = {
      local_mcp: observation(observations.local_mcp),
      marketplace_mcp: observation(observations.marketplace_mcp),
      marketplace_worker_runtime: observation(observations.marketplace_worker_runtime),
      sdk_write_boundary: observation({ verified: observations.sdk_write_boundary_verified, evidence: boundaries }, 3),
      worker_network_isolated: observation({ verified: observations.worker_network_isolated, evidence: boundaries }, 3),
      sdk_secret_isolated: observation({ verified: observations.sdk_secret_isolated, evidence: boundaries }, 3),
      sdk_budget_cancel: observation(cancellation, 3),
      restart_resume: observation(paidAgent, 3),
      crash_interrupt_resume: observation(crashResume, crashResume.repetitions ?? 0),
      planner_submission: observation(paidPlanner, 3),
      model_configuration_exact: observation({ verified: observations.model_configuration_exact_verified, evidence: { boundaries, paidAgent, paidPlanner, remainingRoutes } }, 3),
      cursor_harness: observation(cursorHarness),
    };
    const issuedAt = new Date();
    const receipt = {
      schema: CAPABILITY_RECEIPT_SCHEMA,
      generated_by: "geldmacher-workflow-capability-spike",
      issued_at: issuedAt.toISOString(),
      expires_at: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      plugin_version: PLUGIN_VERSION,
      artifact_schema: ARTIFACT_SCHEMA,
      controller_protocol: CONTROLLER_PROTOCOL,
      sdk_version: sdkVersion,
      platform: currentPlatform(),
      node_version: process.version,
      os_version: `${osPlatform()}-${osRelease()}`,
      cursor_version: argument("cursor-version") ?? "",
      marketplace_git_commit: runtime.manifest?.marketplace_git_commit ?? argument("marketplace-git-commit") ?? "",
      plugin_hash: hashPluginTree(certifiedPluginRoot),
      worker_hash: runtime.manifest?.worker_hash ?? "",
      runtime_hash: runtime.manifest?.runtime_hash ?? "",
      lockfile_hash: runtime.manifest?.lockfile_hash ?? sha256File(join(certifiedPluginRoot, "npm-shrinkwrap.json")),
      attested_route_pool_hash: routeHash ?? hash("route-pool-unavailable"),
      model_catalog_hash: observations.model_catalog.catalog_hash ?? "",
      planning_harness_hash: planningHarness.hash,
      cursor_harness_hash: cursorHarness.evidence_hash ?? "",
      verification_profile_hash: verificationProfileHash,
      model_attestation: {
        requested, accepted, observed,
        request_ids: allPhaseReceipts.map((item) => item.request_id).filter(Boolean),
        agent_ids: allPhaseReceipts.map((item) => item.agent_id).filter(Boolean),
        run_ids: allPhaseReceipts.map((item) => item.worker_run_id).filter(Boolean),
      },
      certified_models: certifiedModels,
      audit: {
        lockfile_hash: runtime.manifest?.lockfile_hash ?? sha256File(join(certifiedPluginRoot, "npm-shrinkwrap.json")),
        evidence_hash: audit.evidence_hash ?? "",
        production_packages: audit.production_packages ?? 0,
        high: audit.high ?? 1,
        critical: audit.critical ?? 1,
        moderate: audit.moderate ?? 0,
        risk_acceptance_hash: argument("risk-acceptance") ? sha256File(resolve(argument("risk-acceptance"))) : null,
      },
      observations: receiptObservations,
      capability_vector: {
        write_boundary: observations.sdk_write_boundary_verified,
        network_isolation: observations.worker_network_isolated,
        secret_isolation: observations.sdk_secret_isolated,
        budget_cancel: observations.sdk_budget_cancel_verified,
        planning: observations.planner_submission_verified,
        verification_profile: verificationAudit.status === "clean",
        route_pool: observations.model_configuration_exact_verified,
      },
      qualification_bindings: qualificationBindings,
      profile_eligibility: { supervised: false, autonomous: false },
      evidence_hashes: Object.fromEntries(REQUIRED_OBSERVATIONS.map((key) => [key, receiptObservations[key].evidence_hash])),
      automation_safe: false,
    };
    receipt.profile_eligibility = receiptProfileEligibility(receipt);
    receipt.automation_safe = receiptAutomationSafe(receipt);
    observations.receipt_candidate = receipt;
    if (!observations.automation_safe || !receipt.automation_safe) {
      observations.receipt_issued = false;
      observations.receipt_blocker = "capability-observations-or-dependency-gate-failed";
    } else {
      const stateRoot = defaultStateRoot(workspace);
      observations.receipt_path = writeCapabilityReceipt(stateRoot, receipt, {
        plugin_hash: receipt.plugin_hash,
        worker_hash: receipt.worker_hash,
        runtime_hash: receipt.runtime_hash,
        lockfile_hash: receipt.lockfile_hash,
        attested_route_pool_hash: receipt.attested_route_pool_hash,
        planning_harness_hash: receipt.planning_harness_hash,
      });
      observations.receipt_issued = true;
    }
  }
  console.log(JSON.stringify(observations, null, 2));
  if (process.argv.includes("--require-automation-safe") && !observations.automation_safe) process.exitCode = 1;
} finally { rmSync(temporary, { recursive: true, force: true }); }
