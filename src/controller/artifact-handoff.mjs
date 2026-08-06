import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import {
  contentAddressedHandoffRoot,
  contentAddressedHandoffRootByHash,
  handoffTipPath,
  rootContentHash,
} from "../core/state-paths.mjs";
import {
  ARTIFACT_SCHEMA,
  CONTROLLER_PROTOCOL,
  PLUGIN_VERSION,
} from "./protocol.mjs";

export const HANDOFF_RECORD_SCHEMA = 1;
export const HANDOFF_TIP_SCHEMA = 1;
export { rootContentHash };

export function createContentAddressedHandoffStore(rootPlanText, pluginRoot, options = {}) {
  return new ArtifactHandoffStore(contentAddressedHandoffRoot(rootPlanText, options), pluginRoot);
}

export function createContentAddressedHandoffStoreByHash(rootHash, pluginRoot, options = {}) {
  return new ArtifactHandoffStore(contentAddressedHandoffRootByHash(rootHash, options), pluginRoot);
}

function writeHandoffTip(rootPlanText, options = {}) {
  const inspected = inspectArtifactText(rootPlanText, options.pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan") {
    throw new Error(`handoff tip requires a valid work-plan Root: ${(inspected.errors.length > 0 ? inspected.errors : ["not a work-plan"]).join("; ")}`);
  }
  const tip = {
    handoff_tip_schema: HANDOFF_TIP_SCHEMA,
    root_plan_id: inspected.artifact.fields.id,
    root_content_hash: rootContentHash(rootPlanText),
    text_hash: sha256(rootPlanText),
    updated_at: new Date().toISOString(),
  };
  const path = handoffTipPath(tip.root_plan_id, options);
  if (existsSync(path)) {
    const prior = JSON.parse(readFileSync(path, "utf8"));
    if (prior?.handoff_tip_schema === HANDOFF_TIP_SCHEMA
      && prior.root_plan_id === tip.root_plan_id
      && prior.root_content_hash === tip.root_content_hash
      && prior.text_hash === tip.text_hash) {
      return tip;
    }
    if (prior?.root_plan_id === tip.root_plan_id && prior?.text_hash && prior.text_hash !== tip.text_hash) {
      throw new Error(`handoff tip for ${tip.root_plan_id} conflicts with a different Root text hash`);
    }
  }
  atomicJson(path, tip);
  return tip;
}

export function readHandoffTip(rootPlanId, options = {}) {
  const path = handoffTipPath(rootPlanId, options);
  if (!existsSync(path)) return null;
  const tip = JSON.parse(readFileSync(path, "utf8"));
  if (tip?.handoff_tip_schema !== HANDOFF_TIP_SCHEMA
    || tip.root_plan_id !== rootPlanId
    || !/^[a-f0-9]{64}$/.test(String(tip.root_content_hash ?? ""))
    || !/^[a-f0-9]{64}$/.test(String(tip.text_hash ?? ""))) {
    throw new Error(`incompatible or corrupt handoff tip ${rootPlanId}`);
  }
  return tip;
}

export function resolveRootPlanText(pluginRoot, { rootPlanId = null, rootPlan = null, artifacts = [] } = {}) {
  if (typeof rootPlan === "string" && rootPlan.trim()) {
    const inspected = inspectArtifactText(rootPlan, pluginRoot);
    if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan") {
      throw new Error(`exact Root text is invalid: ${(inspected.errors.length > 0 ? inspected.errors : ["not a work-plan"]).join("; ")}`);
    }
    if (rootPlanId && inspected.artifact.fields.id !== rootPlanId) {
      throw new Error(`exact Root ID mismatch: expected ${rootPlanId}, received ${inspected.artifact.fields.id}`);
    }
    return rootPlan;
  }
  for (const entry of artifacts) {
    if (!entry?.text) continue;
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan") continue;
    if (rootPlanId && inspected.artifact.fields.id !== rootPlanId) continue;
    return entry.text;
  }
  if (rootPlanId) {
    const tip = readHandoffTip(rootPlanId);
    if (tip) {
      const store = createContentAddressedHandoffStoreByHash(tip.root_content_hash, pluginRoot);
      const cached = store.records([rootPlanId])[0];
      if (cached?.text && cached.text_hash === tip.text_hash) return cached.text;
    }
  }
  throw new Error(rootPlanId
    ? `exact Root text for ${rootPlanId} is required for content-bound handoff transport`
    : "exact Root text is required for content-bound handoff transport");
}

export function rememberContentAddressedRoot(rootPlanText, pluginRoot, options = {}) {
  const store = createContentAddressedHandoffStore(rootPlanText, pluginRoot, options);
  const tip = writeHandoffTip(rootPlanText, { ...options, pluginRoot });
  return { store, tip, root_content_hash: tip.root_content_hash };
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableArtifactSetHash(records) {
  const projection = records
    .map((record) => ({ artifact_id: record.artifact_id, text_hash: record.text_hash }))
    .sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
  return sha256(JSON.stringify(projection));
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
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
    if (!stale) throw new Error("concurrent handoff closeout is already in progress");
    unlinkSync(path);
    const descriptor = openSync(path, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`);
    return descriptor;
  }
}

function parsedArtifact(text, pluginRoot) {
  const inspected = inspectArtifactText(text, pluginRoot);
  if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
    throw new Error(`handoff artifact is invalid: ${(inspected.errors.length > 0 ? inspected.errors : ["missing artifact identity"]).join("; ")}`);
  }
  if (inspected.artifact.fields.schema !== ARTIFACT_SCHEMA) {
    throw new Error(`handoff accepts only Schema ${ARTIFACT_SCHEMA} artifacts`);
  }
  return inspected.artifact;
}

function recordFor(text, pluginRoot) {
  const artifact = parsedArtifact(text, pluginRoot);
  const fields = artifact.fields;
  return {
    handoff_record_schema: HANDOFF_RECORD_SCHEMA,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    plugin_version: PLUGIN_VERSION,
    artifact_id: fields.id,
    artifact_type: fields.artifact,
    root_plan_id: fields.artifact === "work-plan" ? fields.id : fields.root_plan_id,
    text_hash: sha256(text),
    recorded_at: new Date().toISOString(),
    text,
  };
}

function validateRecord(record) {
  if (record?.handoff_record_schema !== HANDOFF_RECORD_SCHEMA
    || record?.artifact_schema !== ARTIFACT_SCHEMA
    || record?.controller_protocol !== CONTROLLER_PROTOCOL
    || !/^(?:wp|de|wr)-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(record?.artifact_id ?? ""))
    || record?.text_hash !== sha256(record?.text ?? "")) {
    throw new Error(`incompatible or corrupt handoff record ${record?.artifact_id ?? "unknown"}`);
  }
  return record;
}

function referencedIds(fields) {
  if (fields.artifact === "work-plan") return [fields.predecessor_plan_id, fields.replan_source_review_id].filter(Boolean);
  if (fields.artifact === "delivery-evidence") return [fields.predecessor_evidence_id, fields.source_review_id].filter(Boolean);
  if (fields.artifact === "work-review") return [fields.latest_evidence_id, fields.predecessor_review_id].filter(Boolean);
  return [];
}

export class ArtifactHandoffStore {
  constructor(root, pluginRoot) {
    this.root = resolve(root);
    this.pluginRoot = resolve(pluginRoot);
    this.directory = join(this.root, "handoff", "artifacts");
  }

  artifactPath(artifactId) {
    if (!/^(?:wp|de|wr)-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(artifactId))) throw new Error(`invalid handoff artifact ID ${artifactId}`);
    return join(this.directory, `${artifactId}.json`);
  }

  indexPath() {
    return join(this.root, "handoff", "index.json");
  }

  metadata(record) {
    const fields = parsedArtifact(record.text, this.pluginRoot).fields;
    return {
      artifact_id: record.artifact_id,
      artifact_type: record.artifact_type,
      root_plan_id: record.root_plan_id,
      predecessor_plan_id: fields.predecessor_plan_id ?? null,
      references: referencedIds(fields),
      text_hash: record.text_hash,
    };
  }

  rebuildIndex() {
    const entries = this.records().map((record) => this.metadata(record));
    const index = { schema: 1, entries };
    atomicJson(this.indexPath(), index);
    return index;
  }

  index() {
    try {
      const index = JSON.parse(readFileSync(this.indexPath(), "utf8"));
      const actual = existsSync(this.directory)
        ? readdirSync(this.directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name.slice(0, -5)).sort()
        : [];
      const recorded = (index.entries ?? []).map((entry) => entry.artifact_id).sort();
      if (index.schema !== 1 || actual.join("\n") !== recorded.join("\n")) throw new Error("handoff index mismatch");
      return index;
    } catch { return this.rebuildIndex(); }
  }

  writeIndex(records, priorIndex = this.index()) {
    const entries = new Map(priorIndex.entries.map((entry) => [entry.artifact_id, entry]));
    for (const record of records) entries.set(record.artifact_id, this.metadata(record));
    atomicJson(this.indexPath(), { schema: 1, entries: [...entries.values()].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)) });
  }

  records(ids = null) {
    if (!existsSync(this.directory)) return [];
    const files = ids
      ? [...new Set(ids)].map((id) => this.artifactPath(id)).filter(existsSync)
      : readdirSync(this.directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => join(this.directory, entry.name));
    return files
      .map((path) => validateRecord(JSON.parse(readFileSync(path, "utf8"))))
      .sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
  }

  record(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length < 1 || artifacts.length > 32) throw new Error("handoff record requires 1..32 artifacts");
    const candidates = artifacts.map((entry, index) => {
      if (!entry || typeof entry.label !== "string" || !entry.label.trim() || typeof entry.text !== "string" || !entry.text.trim()) {
        throw new Error(`handoff artifact ${index + 1} requires non-empty label and text`);
      }
      return { label: entry.label, record: recordFor(entry.text, this.pluginRoot) };
    });
    const candidateIds = new Set(candidates.map(({ record }) => record.artifact_id));
    if (candidateIds.size !== candidates.length) throw new Error("handoff record contains duplicate artifact IDs");

    const lockPath = join(this.root, "handoff", ".lock");
    let descriptor;
    try {
      descriptor = acquireLock(lockPath);
      const index = this.index();
      const byMetadata = new Map(index.entries.map((entry) => [entry.artifact_id, entry]));
      const candidateMetadata = candidates.map(({ record }) => this.metadata(record));
      const selectedIds = new Set();
      const pending = [];
      for (const metadata of candidateMetadata) {
        selectedIds.add(metadata.artifact_id);
        pending.push(...metadata.references);
        for (const entry of index.entries) if (entry.root_plan_id === metadata.root_plan_id || entry.artifact_id === metadata.root_plan_id) selectedIds.add(entry.artifact_id);
      }
      while (pending.length > 0) {
        const id = pending.pop();
        if (!id || selectedIds.has(id)) continue;
        selectedIds.add(id);
        pending.push(...(byMetadata.get(id)?.references ?? []));
      }
      for (const id of [...selectedIds]) pending.push(...(byMetadata.get(id)?.references ?? []));
      while (pending.length > 0) {
        const id = pending.pop();
        if (!id || selectedIds.has(id)) continue;
        selectedIds.add(id);
        pending.push(...(byMetadata.get(id)?.references ?? []));
      }
      const existing = this.records([...selectedIds]);
      const merged = new Map(existing.map((record) => [record.artifact_id, record]));
      const recorded = [];
      const duplicates = [];
      for (const { record } of candidates) {
        const prior = merged.get(record.artifact_id);
        if (prior && prior.text_hash !== record.text_hash) throw new Error(`handoff artifact ${record.artifact_id} conflicts with the immutable cached text`);
        if (prior) duplicates.push(record.artifact_id);
        else {
          merged.set(record.artifact_id, record);
          recorded.push(record.artifact_id);
        }
      }
      const inspection = inspectArtifactSet([...merged.values()].map((record) => [record.artifact_id, record.text]), this.pluginRoot);
      if (inspection.errors.length > 0) throw new Error(`handoff chain is invalid: ${inspection.errors.join("; ")}`);
      for (const id of recorded) atomicJson(this.artifactPath(id), merged.get(id));
      if (recorded.length > 0) this.writeIndex(recorded.map((id) => merged.get(id)), index);
      return {
        handoff_record_schema: HANDOFF_RECORD_SCHEMA,
        recorded,
        duplicates,
        artifact_set_hash: stableArtifactSetHash([...merged.values()]),
      };
    } finally {
      if (descriptor !== undefined) {
        closeSync(descriptor);
        try { unlinkSync(lockPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
  }

  context(rootPlanId, rootPlanText = null) {
    if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("handoff context requires a valid wp-* root_plan_id");
    const index = this.index();
    const metadata = new Map(index.entries.map((entry) => [entry.artifact_id, entry]));
    const lineage = new Set();
    let planCursor = rootPlanId;
    while (planCursor && !lineage.has(planCursor)) {
      lineage.add(planCursor);
      planCursor = metadata.get(planCursor)?.predecessor_plan_id ?? null;
    }
    const selectedIds = new Set(index.entries.filter((entry) => lineage.has(entry.artifact_id) || lineage.has(entry.root_plan_id)).map((entry) => entry.artifact_id));
    const pendingReferences = [...selectedIds].flatMap((id) => metadata.get(id)?.references ?? []);
    while (pendingReferences.length > 0) {
      const id = pendingReferences.pop();
      if (!id || selectedIds.has(id) || !metadata.has(id)) continue;
      selectedIds.add(id);
      pendingReferences.push(...metadata.get(id).references);
    }
    const records = this.records([...selectedIds]);
    const byId = new Map(records.map((record) => [record.artifact_id, record]));
    if (rootPlanText) {
      const supplied = recordFor(rootPlanText, this.pluginRoot);
      if (supplied.artifact_id !== rootPlanId || supplied.artifact_type !== "work-plan") throw new Error("supplied active Plan does not match root_plan_id");
      const cached = byId.get(rootPlanId);
      if (cached && cached.text_hash !== supplied.text_hash) throw new Error("active Plan conflicts with the immutable handoff Root");
      byId.set(rootPlanId, cached ?? supplied);
    }
    const root = byId.get(rootPlanId);
    if (!root) throw new Error(`no handoff Root ${rootPlanId}`);

    const parsed = new Map([...byId.values()].map((record) => [record.artifact_id, parsedArtifact(record.text, this.pluginRoot)]));
    lineage.clear();
    let cursor = rootPlanId;
    while (cursor && !lineage.has(cursor)) {
      lineage.add(cursor);
      cursor = parsed.get(cursor)?.fields.predecessor_plan_id ?? null;
    }
    const selected = new Map();
    for (const [id, artifact] of parsed) {
      const fields = artifact.fields;
      const belongs = fields.artifact === "work-plan" ? lineage.has(fields.id) : lineage.has(fields.root_plan_id);
      if (belongs) selected.set(id, byId.get(id));
    }
    const pending = [...selected.keys()];
    while (pending.length > 0) {
      const id = pending.pop();
      for (const reference of referencedIds(parsed.get(id)?.fields ?? {})) {
        if (selected.has(reference) || !byId.has(reference)) continue;
        selected.set(reference, byId.get(reference));
        pending.push(reference);
      }
    }

    const ordered = [...selected.values()].sort((left, right) => {
      const rank = { "work-plan": 0, "delivery-evidence": 1, "work-review": 2 };
      return rank[left.artifact_type] - rank[right.artifact_type] || left.recorded_at.localeCompare(right.recorded_at) || left.artifact_id.localeCompare(right.artifact_id);
    });
    const inspection = inspectArtifactSet(ordered.map((record) => [record.artifact_id, record.text]), this.pluginRoot);
    if (inspection.errors.length > 0) throw new Error(`cached handoff chain is invalid: ${inspection.errors.join("; ")}`);
    const tips = effectiveCliSummary(inspection);
    return {
      handoff_record_schema: HANDOFF_RECORD_SCHEMA,
      root_plan_id: rootPlanId,
      artifact_set_hash: stableArtifactSetHash(ordered),
      evidence_tip: tips.evidence_tips[rootPlanId] ?? null,
      review_tip: tips.review_tips[rootPlanId] ?? null,
      artifacts: ordered.map((record) => ({ label: record.artifact_id, text: record.text, text_hash: record.text_hash })),
    };
  }
}
