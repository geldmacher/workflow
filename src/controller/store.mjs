import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { repositoryKey } from "../core/state-paths.mjs";
import {
  assertCompatiblePreparation,
  assertCompatibleRun,
  classifyPreparationCompatibility,
  classifyRunCompatibility,
  preparationProtocolFields,
  protocolFields,
  runEventSubject,
} from "./protocol.mjs";

export { repositoryKey } from "../core/state-paths.mjs";

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

const EVENT_CHECKPOINT_INTERVAL = 128;

function eventDigest(event, source = null) {
  return event?.event_hash ?? createHash("sha256").update(source ?? JSON.stringify(event)).digest("hex");
}

function rebuildEventHead(eventPath, headPath) {
  const head = { schema: 1, count: 0, bytes: 0, last_hash: null, checkpoints: [] };
  if (existsSync(eventPath)) {
    const source = readFileSync(eventPath, "utf8");
    let offset = 0;
    for (const line of source.split(/(?<=\n)/)) {
      if (!line.trim()) { offset += Buffer.byteLength(line); continue; }
      if (head.count % EVENT_CHECKPOINT_INTERVAL === 0) head.checkpoints.push({ event: head.count, offset });
      const text = line.trimEnd();
      const event = JSON.parse(text);
      head.last_hash = eventDigest(event, text);
      head.count += 1;
      offset += Buffer.byteLength(line);
    }
    head.bytes = Buffer.byteLength(source);
  }
  atomicJson(headPath, head);
  return head;
}

function loadEventHead(eventPath, headPath) {
  if (!existsSync(headPath)) return rebuildEventHead(eventPath, headPath);
  try {
    const head = JSON.parse(readFileSync(headPath, "utf8"));
    const size = existsSync(eventPath) ? statSync(eventPath).size : 0;
    if (head.schema !== 1 || !Number.isInteger(head.count) || head.count < 0 || head.bytes !== size || !Array.isArray(head.checkpoints)) throw new Error("invalid event head");
    return head;
  } catch { return rebuildEventHead(eventPath, headPath); }
}

function appendIndexedEvent(directory, eventPath, headPath, type, payload, subject = null) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const head = loadEventHead(eventPath, headPath);
  const event = {
    id: randomUUID(),
    at: new Date().toISOString(),
    type,
    payload,
    ...(subject ? { subject } : {}),
    previous_hash: head.last_hash,
  };
  event.event_hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const line = `${JSON.stringify(event)}\n`;
  const checkpoints = [...head.checkpoints];
  if (head.count % EVENT_CHECKPOINT_INTERVAL === 0) checkpoints.push({ event: head.count, offset: head.bytes });
  appendFileSync(eventPath, line, { mode: 0o600 });
  atomicJson(headPath, {
    schema: 1,
    count: head.count + 1,
    bytes: head.bytes + Buffer.byteLength(line),
    last_hash: event.event_hash,
    checkpoints,
  });
}

function readIndexedEvents(eventPath, headPath, after = 0) {
  if (!existsSync(eventPath)) return [];
  const head = loadEventHead(eventPath, headPath);
  const cursor = Math.min(Math.max(0, after), head.count);
  const checkpoint = [...head.checkpoints].reverse().find((entry) => entry.event <= cursor) ?? { event: 0, offset: 0 };
  const length = head.bytes - checkpoint.offset;
  if (length <= 0) return [];
  const descriptor = openSync(eventPath, "r");
  try {
    const buffer = Buffer.alloc(length);
    let read = 0;
    while (read < length) {
      const chunk = readSync(descriptor, buffer, read, length - read, checkpoint.offset + read);
      if (chunk === 0) throw new Error(`event log ended before indexed byte ${head.bytes}`);
      read += chunk;
    }
    return buffer.toString("utf8", 0, read).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).slice(cursor - checkpoint.event);
  } finally { closeSync(descriptor); }
}

function subjectDirectories(root, subjectPath) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(subjectPath(entry.name)))
    .map((entry) => entry.name)
    .sort();
}

export class RunStore {
  constructor(root) {
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  runDirectory(runId) { return join(this.root, "runs", runId); }
  runPath(runId) { return join(this.runDirectory(runId), "run.json"); }
  eventPath(runId) { return join(this.runDirectory(runId), "events.jsonl"); }
  eventHeadPath(runId) { return join(this.runDirectory(runId), "events-head.json"); }
  indexPath() { return join(this.root, "runs", "index.json"); }

  summary(run) {
    return {
      run_id: run.run_id,
      run_record_schema: run.run_record_schema,
      artifact_schema: run.artifact_schema,
      controller_protocol: run.controller_protocol,
      plugin_version: run.plugin_version,
      lifecycle: run.lifecycle,
      updated_at: run.updated_at,
      preparation_id: run.preparation_id ?? null,
      start_idempotency_key: run.start_idempotency_key ?? null,
      effective_profile: run.effective_profile ?? null,
      root_review_complete: run.root_review_complete === true,
      review_assessment: run.review?.assessment ?? null,
      blocker_count: (run.blockers ?? []).length,
      delivery_accepted: run.delivery_accepted === true,
      evidence_grade: run.evidence_grade ?? null,
      qualification_key: run.qualification_key ?? null,
    };
  }

  rebuildIndex() {
    const directory = join(this.root, "runs");
    const subjects = subjectDirectories(directory, (id) => this.runPath(id)).map((id) => this.summary(JSON.parse(readFileSync(this.runPath(id), "utf8"))));
    const index = { schema: 1, subjects };
    atomicJson(this.indexPath(), index);
    return index;
  }

  index() {
    try {
      const index = JSON.parse(readFileSync(this.indexPath(), "utf8"));
      const actual = subjectDirectories(join(this.root, "runs"), (id) => this.runPath(id));
      const recorded = (index.subjects ?? []).map((subject) => subject.run_id).sort();
      if (index.schema !== 1 || actual.join("\n") !== recorded.join("\n")) throw new Error("run index mismatch");
      return index;
    } catch { return this.rebuildIndex(); }
  }

  indexRecord(run) {
    const subjects = new Map(this.index().subjects.map((subject) => [subject.run_id, subject]));
    subjects.set(run.run_id, this.summary(run));
    atomicJson(this.indexPath(), { schema: 1, subjects: [...subjects.values()].sort((left, right) => left.run_id.localeCompare(right.run_id)) });
  }

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
      this.indexRecord(run);
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
      this.indexRecord(run);
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
      this.indexRecord(updated);
      this.appendEvent(runId, eventType, { revision: updated.revision });
      return updated;
    } finally { releaseLock(lockPath, descriptor); }
  }

  appendEvent(runId, type, payload = {}) {
    const run = this.get(runId);
    appendIndexedEvent(this.runDirectory(runId), this.eventPath(runId), this.eventHeadPath(runId), type, payload, runEventSubject(run));
  }

  appendDecision(runId, {
    phase,
    actor_receipt = null,
    actor_receipts = [],
    decision,
    reason,
    input_hashes = [],
    strategy_revision = null,
    evidence_refs = [],
    result = null,
    supersedes = null,
    correction_id = null,
    learning_candidate_ids = [],
    learning_candidate_refs = [],
    delivery_evidence_hash = null,
    delivery_commit = null,
    delivered_paths_hash = null,
  }) {
    this.appendEvent(runId, "decision", {
      phase,
      actor_receipt,
      actor_receipts,
      decision,
      reason,
      input_hashes,
      strategy_revision,
      evidence_refs,
      result,
      supersedes,
      correction_id,
      learning_candidate_ids,
      learning_candidate_refs,
      delivery_evidence_hash,
      delivery_commit,
      delivered_paths_hash,
    });
  }

  events(runId, after = 0) {
    return readIndexedEvents(this.eventPath(runId), this.eventHeadPath(runId), after);
  }

  list() {
    return this.index().subjects.map((subject) => this.get(subject.run_id));
  }

  active() {
    return this.index().subjects.filter((run) => classifyRunCompatibility(run).compatible
      && !["achieved", "accepted-provisional", "blocked", "stopped", "failed"].includes(run.lifecycle))
      .map((run) => this.get(run.run_id));
  }

  qualifyingHistory(qualificationKey = null) {
    return this.index().subjects.filter((run) => classifyRunCompatibility(run).compatible
      && run.lifecycle === "achieved"
      && run.effective_profile === "supervised"
      && run.root_review_complete === true
      && run.review_assessment === "achieved"
      && run.blocker_count === 0
      && run.delivery_accepted === true
      && run.evidence_grade === "verified"
      && (!qualificationKey || run.qualification_key === qualificationKey)).length;
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
  eventHeadPath(preparationId) { return join(this.preparationDirectory(preparationId), "events-head.json"); }
  indexPath() { return join(this.root, "preparations", "index.json"); }

  summary(preparation) {
    return {
      preparation_id: preparation.preparation_id,
      preparation_record_schema: preparation.preparation_record_schema,
      artifact_schema: preparation.artifact_schema,
      controller_protocol: preparation.controller_protocol,
      plugin_version: preparation.plugin_version,
      status: preparation.status,
      updated_at: preparation.updated_at,
      expires_at: preparation.expires_at ?? null,
    };
  }

  rebuildIndex() {
    const directory = join(this.root, "preparations");
    const subjects = subjectDirectories(directory, (id) => this.preparationPath(id)).map((id) => this.summary(JSON.parse(readFileSync(this.preparationPath(id), "utf8"))));
    const index = { schema: 1, subjects };
    atomicJson(this.indexPath(), index);
    return index;
  }

  index() {
    try {
      const index = JSON.parse(readFileSync(this.indexPath(), "utf8"));
      const actual = subjectDirectories(join(this.root, "preparations"), (id) => this.preparationPath(id));
      const recorded = (index.subjects ?? []).map((subject) => subject.preparation_id).sort();
      if (index.schema !== 1 || actual.join("\n") !== recorded.join("\n")) throw new Error("preparation index mismatch");
      return index;
    } catch { return this.rebuildIndex(); }
  }

  indexRecord(preparation) {
    const subjects = new Map(this.index().subjects.map((subject) => [subject.preparation_id, subject]));
    subjects.set(preparation.preparation_id, this.summary(preparation));
    atomicJson(this.indexPath(), { schema: 1, subjects: [...subjects.values()].sort((left, right) => left.preparation_id.localeCompare(right.preparation_id)) });
  }

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
      this.indexRecord(preparation);
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
      this.indexRecord(updated);
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
    appendIndexedEvent(this.preparationDirectory(preparationId), this.eventPath(preparationId), this.eventHeadPath(preparationId), type, payload);
  }

  events(preparationId, after = 0) {
    return readIndexedEvents(this.eventPath(preparationId), this.eventHeadPath(preparationId), after);
  }

  list() {
    return this.index().subjects.map((subject) => this.get(subject.preparation_id));
  }

  active() {
    return this.index().subjects.filter((preparation) => classifyPreparationCompatibility(preparation).compatible
      && ["planning", "root-ready", "interrupted"].includes(preparation.status))
      .map((preparation) => this.get(preparation.preparation_id))
      .filter((preparation) => ["planning", "root-ready", "interrupted"].includes(preparation.status));
  }
}
