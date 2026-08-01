import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CursorWorkerAdapter,
  configurationsMatch,
  resolveWorkerRuntime,
  sdkVersion,
  validatePoolAgainstCatalog,
  validateRouteAgainstCatalog,
} from "../src/controller/worker-adapter.mjs";

const route = {
  model_id: "model-1",
  reasoning_effort: "high",
  model_options: { temperature: "0" },
  pricing_usd_per_million: { input: 1, output: 2 },
};
const catalog = [{
  id: "model-1",
  parameters: [
    { id: "reasoning_effort", values: [{ value: "low" }, { value: "high" }] },
    { id: "temperature", values: [{ value: "0" }, { value: "1" }] },
  ],
}];
const acceptedModel = { id: "model-1", params: [{ id: "reasoning_effort", value: "high" }, { id: "temperature", value: "0" }] };

test("worker route and ordered-pool validation is exact and fail-closed", () => {
  assert.equal(validateRouteAgainstCatalog(route, catalog).valid, true);
  assert.match(validateRouteAgainstCatalog({ ...route, model_id: "missing" }, catalog).errors[0], /model unavailable/);
  assert.match(validateRouteAgainstCatalog({ ...route, reasoning_effort: "max" }, catalog).errors[0], /unsupported reasoning_effort/);
  assert.match(validateRouteAgainstCatalog({ ...route, model_options: { unknown: true } }, catalog).errors[0], /unknown model option/);
  assert.match(validateRouteAgainstCatalog({ ...route, model_options: { reasoning_effort: "low" } }, catalog).errors[0], /configured through reasoning_effort/);
  assert.match(validateRouteAgainstCatalog(route, [{ id: "model-1", parameters: [] }]).errors[0], /no attestable reasoning-effort/);

  const pool = { candidates: [{ ...route, model_id: "missing" }, route] };
  const selected = validatePoolAgainstCatalog(pool, catalog);
  assert.equal(selected.valid, true);
  assert.equal(selected.selected_index, 1);
  assert.equal(selected.selection_reason, "approved-pool-fallback");
  const denied = validatePoolAgainstCatalog({ candidates: [{ ...route, model_id: "missing" }] }, catalog);
  assert.equal(denied.valid, false);
  assert.equal(denied.selection_reason, "no-approved-candidate-available");

  assert.equal(configurationsMatch(acceptedModel, { id: "model-1", params: [...acceptedModel.params].reverse() }), true);
  assert.equal(configurationsMatch(acceptedModel, { id: "other", params: [] }), false);
  assert.equal(configurationsMatch(null, acceptedModel), false);
});

test("worker runtime selection distinguishes explicit, environment, and bundled development paths", () => {
  assert.equal(resolveWorkerRuntime({ workerEntrypoint: "/tmp/worker.mjs" }).source, "explicit-development");
  const before = process.env.GELDMACHER_WORKFLOW_WORKER;
  process.env.GELDMACHER_WORKFLOW_WORKER = "/tmp/environment-worker.mjs";
  try { assert.equal(resolveWorkerRuntime().source, "environment-override"); }
  finally {
    if (before === undefined) delete process.env.GELDMACHER_WORKFLOW_WORKER;
    else process.env.GELDMACHER_WORKFLOW_WORKER = before;
  }
  const development = resolveWorkerRuntime({ runtimeRoot: mkdtempSync(join(tmpdir(), "workflow-worker-runtime-")) });
  assert.equal(development.source, "development");
  assert.equal(development.automation_eligible, false);
  assert.match(development.reason, /runtime-manifest-missing/);
});

test("worker adapter constrains model discovery and phase-specific write surfaces", () => {
  const calls = [];
  const sandbox = (request) => {
    calls.push(request);
    if (request.payload.operation === "list-models") return { ok: true, models: catalog };
    return {
      ok: true,
      status: "finished",
      observed_model: acceptedModel,
      request_id: "request-1",
      agent_id: "agent-1",
      run_id: "worker-run-1",
      duration_ms: 5,
      usage: { input_tokens: 10, output_tokens: 5 },
      planning_output: { name: "plan" },
    };
  };
  const runDirectory = mkdtempSync(join(tmpdir(), "workflow-worker-adapter-"));
  const adapter = new CursorWorkerAdapter({ runDirectory, workerEntrypoint: "/tmp/worker.mjs", sandbox });
  assert.equal(adapter.runtimeProvenance().source, "explicit-development");
  assert.match(adapter.controlPath(), /worker-control\.json$/);
  assert.equal(adapter.controllerStatePaths().length, 4);
  assert.equal(adapter.listModels().ok, true);
  assert.equal(calls.at(-1).inheritEnvironment, false);

  const profile = { planner: { candidates: [route] }, writer: { candidates: [route] } };
  const validation = adapter.validateProfile(profile);
  assert.equal(validation.verified, true);
  assert.equal(validation.sdk_version, sdkVersion);
  assert.match(validation.catalog_hash, /^[a-f0-9]{64}$/);

  const failed = new CursorWorkerAdapter({ runDirectory: join(runDirectory, "failed"), workerEntrypoint: "/tmp/worker.mjs", sandbox: () => ({ ok: false, error: { message: "catalog denied" } }) });
  assert.deepEqual(failed.validateProfile(profile).errors, ["catalog denied"]);

  const writer = adapter.runPhase({ role: "writer", route, acceptedModel, prompt: "write", cwd: runDirectory, writerWritablePaths: [join(runDirectory, "allowed")], writerDeniedPaths: [join(runDirectory, "denied")] });
  assert.equal(writer.receipt.model_attested, true);
  assert.equal(writer.receipt.worker_provenance.automation_eligible, false);
  assert.ok(calls.at(-1).writablePaths.some((path) => path.endsWith("allowed")));
  assert.ok(calls.at(-1).deniedPaths.some((path) => path.endsWith("denied")));

  adapter.runPhase({ role: "verifier", route, acceptedModel, prompt: "verify", cwd: runDirectory, verifierArtifactPaths: [join(runDirectory, "proof")] });
  assert.ok(calls.at(-1).writablePaths.some((path) => path.endsWith("proof")));
  const planning = adapter.runPlanningPhase({ route, acceptedModel, prompt: "plan", cwd: runDirectory, harnessHash: "a".repeat(64), deniedReadPaths: [join(runDirectory, "secret")] });
  assert.deepEqual(planning.planningOutput, { name: "plan" });
  assert.deepEqual(calls.at(-1).deniedPaths, [runDirectory]);
  assert.ok(calls.at(-1).deniedReadPaths.some((path) => path.endsWith("secret")));

  const probe = { network_canary_url: "https://invalid.test", allowed_write_path: "a", protected_write_path: "b", foreign_write_path: "c", secret_hash: "d".repeat(64) };
  assert.equal(adapter.runCapabilityProbe({ route, acceptedModel, cwd: runDirectory, probe, writerWritablePaths: [runDirectory], writerDeniedPaths: [], timeoutMs: 2_000 }).ok, true);
  assert.equal(calls.at(-1).payload.operation, "run-capability-probe");
});

test("read-only fanout validates roles and converts isolated responses to receipts", () => {
  const runDirectory = mkdtempSync(join(tmpdir(), "workflow-worker-fanout-"));
  let captured;
  const fanout = (_command, _args, options) => {
    captured = JSON.parse(options.input);
    const responses = captured.tasks.map(() => ({ ok: true, status: "finished", observed_model: acceptedModel, usage: { input_tokens: 1, output_tokens: 1 } }));
    return { stdout: `noise\nWORKFLOW_FANOUT=${JSON.stringify(responses)}\n`, stderr: "" };
  };
  const adapter = new CursorWorkerAdapter({ runDirectory, workerEntrypoint: "/tmp/worker.mjs", sandbox: () => ({}), fanout });
  assert.throws(() => adapter.runReadOnlyFanout([]), /one or two phases/);
  assert.throws(() => adapter.runReadOnlyFanout([{ role: "writer" }]), /cannot contain a writer/);

  const phase = { role: "reviewer", route, routePoolHash: "pool", selectionReason: "primary-available", acceptedModel, prompt: "review", cwd: runDirectory, configurationHash: "config" };
  const results = adapter.runReadOnlyFanout([phase, { ...phase, role: "verifier", verifierArtifactPaths: [join(runDirectory, "proof")] }]);
  assert.equal(results.length, 2);
  assert.equal(results[0].receipt.model_attested, true);
  assert.equal(captured.tasks[0].payload.operation, "run-phase");
  assert.ok(captured.tasks[1].writablePaths.some((path) => path.endsWith("proof")));

  const childError = new CursorWorkerAdapter({ runDirectory: join(runDirectory, "error"), workerEntrypoint: "/tmp/worker.mjs", sandbox: () => ({}), fanout: () => ({ error: new Error("spawn failed") }) });
  assert.throws(() => childError.runReadOnlyFanout([phase]), /spawn failed/);
  const noMarker = new CursorWorkerAdapter({ runDirectory: join(runDirectory, "missing"), workerEntrypoint: "/tmp/worker.mjs", sandbox: () => ({}), fanout: () => ({ stdout: "", stderr: "missing" }) });
  assert.throws(() => noMarker.runReadOnlyFanout([phase]), /returned no result: missing/);
});
