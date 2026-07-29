import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  assertCompatiblePreparation,
  assertCompatibleRun,
  classifyPreparationCompatibility,
  classifyRunCompatibility,
  preparationProtocolFields,
  protocolFields,
} from "./protocol.mjs";

export function repositoryKey(workspaceRoot) {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 20);
}

export function defaultStateRoot(workspaceRoot) {
  return join(homedir(), ".cursor", "geldmacher-workflow", "state", repositoryKey(workspaceRoot));
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

function acquireLock(path) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    const descriptor = openSync(path, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`);
    return descriptor;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale = false;
    try { stale = !processAlive(JSON.parse(readFileSync(path, "utf8")).pid); } catch { stale = true; }
    if (!stale) throw new Error(`state lock is held: ${path}`);
    unlinkSync(path);
    const descriptor = openSync(path, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`);
    return descriptor;
  }
}

function releaseLock(path, descriptor) {
  closeSync(descriptor);
  try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

export class RunStore {
  constructor(root) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  runDirectory(runId) { return join(this.root, "runs", runId); }
  runPath(runId) { return join(this.runDirectory(runId), "run.json"); }
  eventPath(runId) { return join(this.runDirectory(runId), "events.jsonl"); }

  create(input) {
    const lockPath = join(this.root, ".create.lock");
    const descriptor = acquireLock(lockPath);
    try {
      const active = this.active();
      if (active.length > 0) throw new Error(`repository already has active run ${active[0].run_id}`);
      const runId = input.run_id ?? `run-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
      if (existsSync(this.runPath(runId))) throw new Error(`run already exists: ${runId}`);
      const run = {
        ...structuredClone(input),
        ...protocolFields(),
        run_id: runId,
        revision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        controller_pid: process.pid,
        idempotency: {},
        receipts: [],
      };
      atomicJson(this.runPath(runId), run);
      this.appendEvent(runId, "run-created", { requested_profile: run.requested_profile });
      return run;
    } finally { releaseLock(lockPath, descriptor); }
  }

  createFromPreparation(preparationStore, options, input) {
    const lockPath = join(this.root, ".create.lock");
    const descriptor = acquireLock(lockPath);
    try {
      const existing = this.list().find((run) => classifyRunCompatibility(run).compatible
        && (run.preparation_id === options.preparationId || run.start_idempotency_key === options.idempotencyKey));
      if (existing) {
        if (existing.preparation_id !== options.preparationId) throw new Error("start idempotency key belongs to another preparation");
        if (existing.start_idempotency_key !== options.idempotencyKey) throw new Error(`preparation already consumed by run ${existing.run_id}`);
        if (existing.root_plan_hash !== options.approvedRootHash) throw new Error("approved-root-hash-mismatch");
        const preparation = preparationStore.get(options.preparationId);
        if (preparation.status !== "consumed") preparationStore.consume(preparation.preparation_id, preparation.revision, existing.run_id, options.idempotencyKey);
        return { run: existing, preparation: preparationStore.get(options.preparationId), duplicate: true };
      }

      const preparation = preparationStore.get(options.preparationId);
      assertCompatiblePreparation(preparation);
      if (preparation.revision !== options.expectedPreparationRevision) throw new Error(`preparation revision conflict: expected ${options.expectedPreparationRevision}, current ${preparation.revision}`);
      if (preparation.status !== "root-ready") throw new Error(`preparation is not root-ready: ${preparation.status}`);
      if (Date.parse(preparation.expires_at) <= Date.now()) throw new Error("preparation-expired");
      if (preparation.root_plan_hash !== options.approvedRootHash) throw new Error("approved-root-hash-mismatch");
      if (this.active().length > 0) throw new Error(`repository already has active run ${this.active()[0].run_id}`);

      const runId = input.run_id ?? `run-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
      const run = {
        ...structuredClone(input),
        ...protocolFields(),
        run_id: runId,
        preparation_id: preparation.preparation_id,
        start_idempotency_key: options.idempotencyKey,
        revision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        controller_pid: process.pid,
        idempotency: { [options.idempotencyKey]: "created" },
        receipts: input.receipts ?? [],
      };
      atomicJson(this.runPath(runId), run);
      this.appendEvent(runId, "run-created-from-preparation", { requested_profile: run.requested_profile, preparation_id: preparation.preparation_id });
      const consumed = preparationStore.consume(preparation.preparation_id, preparation.revision, runId, options.idempotencyKey);
      return { run, preparation: consumed, duplicate: false };
    } finally { releaseLock(lockPath, descriptor); }
  }

  get(runId) {
    if (!existsSync(this.runPath(runId))) throw new Error(`unknown run ${runId}`);
    const run = JSON.parse(readFileSync(this.runPath(runId), "utf8"));
    if (run.lifecycle === "running" && !processAlive(run.runner_pid ?? run.controller_pid)) return { ...run, lifecycle: "interrupted", interrupted_from_pid: run.runner_pid ?? run.controller_pid };
    return run;
  }

  update(runId, expectedRevision, idempotencyKey, mutator, eventType = "run-updated") {
    const lockPath = join(this.runDirectory(runId), ".lock");
    const descriptor = acquireLock(lockPath);
    try {
      const run = this.get(runId);
      assertCompatibleRun(run);
      if (idempotencyKey && run.idempotency?.[idempotencyKey]) return run;
      if (expectedRevision !== undefined && expectedRevision !== run.revision) throw new Error(`revision conflict: expected ${expectedRevision}, current ${run.revision}`);
      const updated = mutator(structuredClone(run)) ?? run;
      updated.revision = run.revision + 1;
      updated.updated_at = new Date().toISOString();
      updated.controller_pid = process.pid;
      updated.idempotency = { ...(run.idempotency ?? {}) };
      if (idempotencyKey) updated.idempotency[idempotencyKey] = updated.revision;
      atomicJson(this.runPath(runId), updated);
      this.appendEvent(runId, eventType, { revision: updated.revision });
      return updated;
    } finally { releaseLock(lockPath, descriptor); }
  }

  appendEvent(runId, type, payload = {}) {
    mkdirSync(this.runDirectory(runId), { recursive: true, mode: 0o700 });
    appendFileSync(this.eventPath(runId), `${JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), type, payload })}\n`, { mode: 0o600 });
  }

  events(runId, after = 0) {
    if (!existsSync(this.eventPath(runId))) return [];
    return readFileSync(this.eventPath(runId), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).slice(after);
  }

  list() {
    const root = join(this.root, "runs");
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(this.runPath(entry.name)))
      .map((entry) => this.get(entry.name));
  }

  active() {
    return this.list().filter((run) => classifyRunCompatibility(run).compatible
      && !["achieved", "stopped", "failed"].includes(run.lifecycle));
  }

  qualifyingHistory() {
    return this.list().filter((run) => classifyRunCompatibility(run).compatible
      && run.lifecycle === "achieved"
      && run.effective_profile === "auto-gated"
      && run.root_review_complete === true
      && run.review?.assessment === "achieved"
      && (run.blockers ?? []).length === 0
      && run.delivery_accepted === true).length;
  }
}

export class PreparationStore {
  constructor(root) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  preparationDirectory(preparationId) { return join(this.root, "preparations", preparationId); }
  preparationPath(preparationId) { return join(this.preparationDirectory(preparationId), "preparation.json"); }
  eventPath(preparationId) { return join(this.preparationDirectory(preparationId), "events.jsonl"); }

  create(input) {
    const lockPath = join(this.root, ".prepare.lock");
    const descriptor = acquireLock(lockPath);
    try {
      const active = this.active();
      if (active.length > 0) throw new Error(`repository already has active preparation ${active[0].preparation_id}`);
      const preparationId = input.preparation_id ?? `prep-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
      if (existsSync(this.preparationPath(preparationId))) throw new Error(`preparation already exists: ${preparationId}`);
      const preparation = {
        ...structuredClone(input),
        ...preparationProtocolFields(),
        preparation_id: preparationId,
        revision: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        controller_pid: process.pid,
        idempotency: {},
        planner_receipts: input.planner_receipts ?? [],
      };
      atomicJson(this.preparationPath(preparationId), preparation);
      this.appendEvent(preparationId, "preparation-created", { source_kind: preparation.source_kind, requested_profile: preparation.requested_profile });
      return preparation;
    } finally { releaseLock(lockPath, descriptor); }
  }

  get(preparationId) {
    if (!existsSync(this.preparationPath(preparationId))) throw new Error(`unknown preparation ${preparationId}`);
    const preparation = JSON.parse(readFileSync(this.preparationPath(preparationId), "utf8"));
    if (preparation.status === "planning" && preparation.runner_pid && !processAlive(preparation.runner_pid)) return { ...preparation, status: "interrupted", blockers: [...new Set([...(preparation.blockers ?? []), "planner-runner-interrupted"])] };
    if (preparation.status === "root-ready" && Date.parse(preparation.expires_at) <= Date.now()) return { ...preparation, status: "expired", blockers: [...new Set([...(preparation.blockers ?? []), "preparation-expired"])] };
    return preparation;
  }

  update(preparationId, expectedRevision, idempotencyKey, mutator, eventType = "preparation-updated") {
    const lockPath = join(this.preparationDirectory(preparationId), ".lock");
    const descriptor = acquireLock(lockPath);
    try {
      const preparation = this.get(preparationId);
      assertCompatiblePreparation(preparation);
      if (idempotencyKey && preparation.idempotency?.[idempotencyKey]) return preparation;
      if (expectedRevision !== undefined && expectedRevision !== preparation.revision) throw new Error(`preparation revision conflict: expected ${expectedRevision}, current ${preparation.revision}`);
      const updated = mutator(structuredClone(preparation)) ?? preparation;
      updated.revision = preparation.revision + 1;
      updated.updated_at = new Date().toISOString();
      updated.controller_pid = process.pid;
      updated.idempotency = { ...(preparation.idempotency ?? {}) };
      if (idempotencyKey) updated.idempotency[idempotencyKey] = updated.revision;
      atomicJson(this.preparationPath(preparationId), updated);
      this.appendEvent(preparationId, eventType, { revision: updated.revision });
      return updated;
    } finally { releaseLock(lockPath, descriptor); }
  }

  consume(preparationId, expectedRevision, runId, idempotencyKey) {
    return this.update(preparationId, expectedRevision, idempotencyKey, (draft) => ({
      ...draft,
      status: "consumed",
      consumed_by_run_id: runId,
      consumed_at: new Date().toISOString(),
      runner_pid: null,
    }), "preparation-consumed");
  }

  controlUpdate(preparationId, expectedRevision, idempotencyKey, mutator, eventType = "preparation-controlled") {
    const repositoryLockPath = join(this.root, ".create.lock");
    const descriptor = acquireLock(repositoryLockPath);
    try {
      const before = this.get(preparationId);
      assertCompatiblePreparation(before);
      if (before.idempotency?.[idempotencyKey]) return { preparation: before, duplicate: true };
      if (before.revision !== expectedRevision) throw new Error(`preparation revision conflict: expected ${expectedRevision}, current ${before.revision}`);
      return {
        preparation: this.update(preparationId, before.revision, idempotencyKey, mutator, eventType),
        duplicate: false,
      };
    } finally { releaseLock(repositoryLockPath, descriptor); }
  }

  appendEvent(preparationId, type, payload = {}) {
    mkdirSync(this.preparationDirectory(preparationId), { recursive: true, mode: 0o700 });
    appendFileSync(this.eventPath(preparationId), `${JSON.stringify({ id: randomUUID(), at: new Date().toISOString(), type, payload })}\n`, { mode: 0o600 });
  }

  events(preparationId, after = 0) {
    if (!existsSync(this.eventPath(preparationId))) return [];
    return readFileSync(this.eventPath(preparationId), "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).slice(after);
  }

  list() {
    const root = join(this.root, "preparations");
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(this.preparationPath(entry.name)))
      .map((entry) => this.get(entry.name));
  }

  active() {
    return this.list().filter((preparation) => classifyPreparationCompatibility(preparation).compatible && preparation.status === "planning");
  }
}
