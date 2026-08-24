#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText
} from "./chunk-ZDU7LLPP.mjs";
import {
  contentAddressedHandoffRoot,
  contentAddressedHandoffRootByHash,
  handoffTipDirectory,
  handoffTipPath,
  legacyHandoffTipPath,
  rootContentHash
} from "./chunk-3N55QC7G.mjs";
import {
  PLUGIN_VERSION
} from "./chunk-7NHOTGTA.mjs";

// src/controller/artifact-handoff.mjs
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
var HANDOFF_RECORD_SCHEMA = 1, HANDOFF_TIP_SCHEMA = 1;
function createContentAddressedHandoffStore(rootPlanText, pluginRoot, options = {}) {
  return new ArtifactHandoffStore(contentAddressedHandoffRoot(rootPlanText, options), pluginRoot, options.artifactSetOptions);
}
function createContentAddressedHandoffStoreByHash(rootHash, pluginRoot, options = {}) {
  return new ArtifactHandoffStore(contentAddressedHandoffRootByHash(rootHash, options), pluginRoot, options.artifactSetOptions);
}
function quarantineContentAddressedHandoffArtifact({
  rootHash,
  artifactId,
  expectedTextHash,
  pluginRoot,
  apply = !1,
  now = () => /* @__PURE__ */ new Date(),
  options = {}
}) {
  if (!/^[a-f0-9]{64}$/.test(String(rootHash ?? ""))) throw new Error("handoff quarantine requires an exact Root-content SHA-256");
  return createContentAddressedHandoffStoreByHash(rootHash, pluginRoot, options).quarantineArtifact(artifactId, { expectedTextHash, apply, now });
}
function validateTip(tip, rootPlanId) {
  if (tip?.handoff_tip_schema !== HANDOFF_TIP_SCHEMA || tip.root_plan_id !== rootPlanId || !/^[a-f0-9]{64}$/.test(String(tip.root_content_hash ?? "")) || !/^[a-f0-9]{64}$/.test(String(tip.text_hash ?? "")))
    throw new Error(`incompatible or corrupt handoff tip ${rootPlanId}`);
  return tip;
}
function readTipFile(path, rootPlanId) {
  return existsSync(path) ? validateTip(JSON.parse(readFileSync(path, "utf8")), rootPlanId) : null;
}
function listHandoffTips(rootPlanId, options = {}) {
  let tips = /* @__PURE__ */ new Map(), directory = handoffTipDirectory(rootPlanId, options);
  if (existsSync(directory))
    for (let name of readdirSync(directory, { withFileTypes: !0 })) {
      if (!name.isFile() || !name.name.endsWith(".json")) continue;
      let tip = readTipFile(join(directory, name.name), rootPlanId);
      if (!tip) continue;
      let prior = tips.get(tip.root_content_hash);
      if (prior && prior.text_hash !== tip.text_hash)
        throw new Error(`handoff tip for ${rootPlanId} has conflicting text for root content hash ${tip.root_content_hash}`);
      tips.set(tip.root_content_hash, tip);
    }
  let legacy = readTipFile(legacyHandoffTipPath(rootPlanId, options), rootPlanId);
  return legacy && !tips.has(legacy.root_content_hash) && tips.set(legacy.root_content_hash, legacy), [...tips.values()].sort((left, right) => left.root_content_hash.localeCompare(right.root_content_hash));
}
function writeHandoffTip(rootPlanText, options = {}) {
  let inspected = inspectArtifactText(rootPlanText, options.pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan")
    throw new Error(`handoff tip requires a valid work-plan Root: ${(inspected.errors.length > 0 ? inspected.errors : ["not a work-plan"]).join("; ")}`);
  let tip = {
    handoff_tip_schema: HANDOFF_TIP_SCHEMA,
    root_plan_id: inspected.artifact.fields.id,
    root_content_hash: rootContentHash(rootPlanText),
    text_hash: sha256(rootPlanText),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }, path = handoffTipPath(tip.root_plan_id, tip.root_content_hash, options);
  if (existsSync(path)) {
    let prior = readTipFile(path, tip.root_plan_id);
    if (prior.root_content_hash === tip.root_content_hash && prior.text_hash === tip.text_hash) return tip;
    throw new Error(`handoff tip for ${tip.root_plan_id} conflicts with a different Root text hash`);
  }
  return atomicJson(path, tip), tip;
}
function readHandoffTip(rootPlanId, options = {}) {
  let { rootContentHash: exactHash = null } = options;
  if (exactHash) {
    let exact = readTipFile(handoffTipPath(rootPlanId, exactHash, options), rootPlanId);
    if (exact) return exact;
    let legacy = readTipFile(legacyHandoffTipPath(rootPlanId, options), rootPlanId);
    return legacy?.root_content_hash === exactHash ? legacy : null;
  }
  let tips = listHandoffTips(rootPlanId, options);
  if (tips.length === 0) return null;
  if (tips.length === 1) return tips[0];
  throw new Error(`handoff tip for ${rootPlanId} is ambiguous across ${tips.length} distinct Root content hashes; supply exact Root text`);
}
function resolveRootPlanText(pluginRoot, { rootPlanId = null, rootPlan = null, artifacts = [] } = {}) {
  if (typeof rootPlan == "string" && rootPlan.trim()) {
    let inspected = inspectArtifactText(rootPlan, pluginRoot);
    if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan")
      throw new Error(`exact Root text is invalid: ${(inspected.errors.length > 0 ? inspected.errors : ["not a work-plan"]).join("; ")}`);
    if (rootPlanId && inspected.artifact.fields.id !== rootPlanId)
      throw new Error(`exact Root ID mismatch: expected ${rootPlanId}, received ${inspected.artifact.fields.id}`);
    return rootPlan;
  }
  for (let entry of artifacts) {
    if (!entry?.text) continue;
    let inspected = inspectArtifactText(entry.text, pluginRoot);
    if (!(inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan") && !(rootPlanId && inspected.artifact.fields.id !== rootPlanId))
      return entry.text;
  }
  if (rootPlanId) {
    let tip = readHandoffTip(rootPlanId);
    if (tip) {
      let cached = createContentAddressedHandoffStoreByHash(tip.root_content_hash, pluginRoot).records([rootPlanId])[0];
      if (cached?.text && cached.text_hash === tip.text_hash) return cached.text;
    }
  }
  throw new Error(rootPlanId ? `exact Root text for ${rootPlanId} is required for content-bound handoff transport` : "exact Root text is required for content-bound handoff transport");
}
function rememberContentAddressedRoot(rootPlanText, pluginRoot, options = {}) {
  let store = createContentAddressedHandoffStore(rootPlanText, pluginRoot, options), tip = writeHandoffTip(rootPlanText, { ...options, pluginRoot });
  return { store, tip, root_content_hash: tip.root_content_hash };
}
function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
function stableArtifactSetHash(records) {
  let projection = records.map((record) => ({ artifact_id: record.artifact_id, text_hash: record.text_hash })).sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
  return sha256(JSON.stringify(projection));
}
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: !0, mode: 448 });
  let temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}
`, { mode: 384 }), renameSync(temporary, path);
}
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return !1;
  try {
    return process.kill(pid, 0), !0;
  } catch (error) {
    return error.code === "EPERM";
  }
}
function acquireLock(path) {
  mkdirSync(dirname(path), { recursive: !0, mode: 448 });
  try {
    let descriptor = openSync(path, "wx", 384);
    return writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: (/* @__PURE__ */ new Date()).toISOString() })}
`), descriptor;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale = !1;
    try {
      stale = !processAlive(JSON.parse(readFileSync(path, "utf8")).pid);
    } catch {
      stale = !0;
    }
    if (!stale) throw new Error("concurrent handoff closeout is already in progress");
    unlinkSync(path);
    let descriptor = openSync(path, "wx", 384);
    return writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: (/* @__PURE__ */ new Date()).toISOString() })}
`), descriptor;
  }
}
function parsedArtifact(text, pluginRoot) {
  let inspected = inspectArtifactText(text, pluginRoot);
  if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id)
    throw new Error(`handoff artifact is invalid: ${(inspected.errors.length > 0 ? inspected.errors : ["missing artifact identity"]).join("; ")}`);
  if (inspected.artifact.fields.schema !== 5)
    throw new Error(`handoff accepts only Schema ${5} artifacts`);
  return inspected.artifact;
}
function normalizedBuilderProvenance(value, fields, textHash) {
  if (value == null) return null;
  if (fields.artifact !== "work-review" || value?.schema !== 1 || value?.kind !== "host-work-review-builder" || !/^[a-f0-9]{64}$/.test(String(value?.review_input_hash ?? "")) || value?.artifact_hash !== textHash || Object.keys(value).some((key) => !["schema", "kind", "review_input_hash", "artifact_hash"].includes(key)))
    throw new Error("handoff builder provenance is incompatible with the exact work-review text");
  return {
    schema: 1,
    kind: "host-work-review-builder",
    review_input_hash: value.review_input_hash,
    artifact_hash: textHash
  };
}
function recordFor(text, pluginRoot, provenance = null) {
  let fields = parsedArtifact(text, pluginRoot).fields, textHash = sha256(text);
  return {
    handoff_record_schema: HANDOFF_RECORD_SCHEMA,
    artifact_schema: 5,
    controller_protocol: 5,
    plugin_version: PLUGIN_VERSION,
    artifact_id: fields.id,
    artifact_type: fields.artifact,
    root_plan_id: fields.artifact === "work-plan" ? fields.id : fields.root_plan_id,
    text_hash: textHash,
    recorded_at: (/* @__PURE__ */ new Date()).toISOString(),
    ...provenance ? { builder_provenance: normalizedBuilderProvenance(provenance, fields, textHash) } : {},
    text
  };
}
function validateRecord(record, pluginRoot) {
  if (record?.handoff_record_schema !== HANDOFF_RECORD_SCHEMA || record?.artifact_schema !== 5 || record?.controller_protocol !== 5 || !/^(?:wp|de|wr)-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(record?.artifact_id ?? "")) || record?.text_hash !== sha256(record?.text ?? ""))
    throw new Error(`incompatible or corrupt handoff record ${record?.artifact_id ?? "unknown"}`);
  if (record.builder_provenance != null) {
    let fields = parsedArtifact(record.text, pluginRoot).fields;
    normalizedBuilderProvenance(record.builder_provenance, fields, record.text_hash);
  }
  return record;
}
function referencedIds(fields) {
  return fields.artifact === "work-plan" ? [fields.predecessor_plan_id, fields.replan_source_review_id].filter(Boolean) : fields.artifact === "delivery-evidence" ? [fields.predecessor_evidence_id, fields.source_review_id].filter(Boolean) : fields.artifact === "work-review" ? [fields.latest_evidence_id, fields.predecessor_review_id].filter(Boolean) : [];
}
var ArtifactHandoffStore = class {
  constructor(root, pluginRoot, artifactSetOptions = {}) {
    this.root = resolve(root), this.pluginRoot = resolve(pluginRoot), this.artifactSetOptions = artifactSetOptions ?? {}, this.directory = join(this.root, "handoff", "artifacts");
  }
  artifactPath(artifactId) {
    if (!/^(?:wp|de|wr)-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(artifactId))) throw new Error(`invalid handoff artifact ID ${artifactId}`);
    return join(this.directory, `${artifactId}.json`);
  }
  indexPath() {
    return join(this.root, "handoff", "index.json");
  }
  metadata(record) {
    let fields = parsedArtifact(record.text, this.pluginRoot).fields;
    return {
      artifact_id: record.artifact_id,
      artifact_type: record.artifact_type,
      root_plan_id: record.root_plan_id,
      predecessor_plan_id: fields.predecessor_plan_id ?? null,
      references: referencedIds(fields),
      text_hash: record.text_hash
    };
  }
  buildIndexInMemory() {
    return { schema: 1, entries: this.records().map((record) => this.metadata(record)) };
  }
  rebuildIndex() {
    let index = this.buildIndexInMemory();
    return atomicJson(this.indexPath(), index), index;
  }
  loadIndex({ repair = !1 } = {}) {
    try {
      let index = JSON.parse(readFileSync(this.indexPath(), "utf8")), actual = existsSync(this.directory) ? readdirSync(this.directory, { withFileTypes: !0 }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name.slice(0, -5)).sort() : [], recorded = (index.entries ?? []).map((entry) => entry.artifact_id).sort();
      if (index.schema !== 1 || actual.join(`
`) !== recorded.join(`
`)) throw new Error("handoff index mismatch");
      return index;
    } catch {
      return repair ? this.rebuildIndex() : this.buildIndexInMemory();
    }
  }
  index() {
    return this.loadIndex({ repair: !0 });
  }
  writeIndex(records, priorIndex = this.loadIndex({ repair: !0 })) {
    let entries = new Map(priorIndex.entries.map((entry) => [entry.artifact_id, entry]));
    for (let record of records) entries.set(record.artifact_id, this.metadata(record));
    atomicJson(this.indexPath(), { schema: 1, entries: [...entries.values()].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)) });
  }
  records(ids = null) {
    return existsSync(this.directory) ? (ids ? [...new Set(ids)].map((id) => this.artifactPath(id)).filter(existsSync) : readdirSync(this.directory, { withFileTypes: !0 }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => join(this.directory, entry.name))).map((path) => validateRecord(JSON.parse(readFileSync(path, "utf8")), this.pluginRoot)).sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)) : [];
  }
  record(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length < 1 || artifacts.length > 32) throw new Error("handoff record requires 1..32 artifacts");
    let candidates = artifacts.map((entry, index) => {
      if (!entry || typeof entry.label != "string" || !entry.label.trim() || typeof entry.text != "string" || !entry.text.trim())
        throw new Error(`handoff artifact ${index + 1} requires non-empty label and text`);
      return { label: entry.label, record: recordFor(entry.text, this.pluginRoot, entry.provenance ?? null) };
    });
    if (new Set(candidates.map(({ record }) => record.artifact_id)).size !== candidates.length) throw new Error("handoff record contains duplicate artifact IDs");
    let lockPath = join(this.root, "handoff", ".lock"), descriptor;
    try {
      descriptor = acquireLock(lockPath);
      let index = this.index(), byMetadata = new Map(index.entries.map((entry) => [entry.artifact_id, entry])), candidateMetadata = candidates.map(({ record }) => this.metadata(record)), selectedIds = /* @__PURE__ */ new Set(), pending = [];
      for (let metadata of candidateMetadata) {
        selectedIds.add(metadata.artifact_id), pending.push(...metadata.references);
        for (let entry of index.entries) (entry.root_plan_id === metadata.root_plan_id || entry.artifact_id === metadata.root_plan_id) && selectedIds.add(entry.artifact_id);
      }
      for (; pending.length > 0; ) {
        let id = pending.pop();
        !id || selectedIds.has(id) || (selectedIds.add(id), pending.push(...byMetadata.get(id)?.references ?? []));
      }
      for (let id of [...selectedIds]) pending.push(...byMetadata.get(id)?.references ?? []);
      for (; pending.length > 0; ) {
        let id = pending.pop();
        !id || selectedIds.has(id) || (selectedIds.add(id), pending.push(...byMetadata.get(id)?.references ?? []));
      }
      let existing = this.records([...selectedIds]), merged = new Map(existing.map((record) => [record.artifact_id, record])), recorded = [], duplicates = [];
      for (let { record } of candidates) {
        let prior = merged.get(record.artifact_id);
        if (prior && prior.text_hash !== record.text_hash) throw new Error(`handoff artifact ${record.artifact_id} conflicts with the immutable cached text`);
        prior ? duplicates.push(record.artifact_id) : (merged.set(record.artifact_id, record), recorded.push(record.artifact_id));
      }
      let inspection = inspectArtifactSet([...merged.values()].map((record) => [record.artifact_id, record.text]), this.pluginRoot, this.artifactSetOptions);
      if (inspection.errors.length > 0) throw new Error(`handoff chain is invalid: ${inspection.errors.join("; ")}`);
      for (let id of recorded) atomicJson(this.artifactPath(id), merged.get(id));
      return recorded.length > 0 && this.writeIndex(recorded.map((id) => merged.get(id)), index), {
        handoff_record_schema: HANDOFF_RECORD_SCHEMA,
        recorded,
        duplicates,
        artifact_set_hash: stableArtifactSetHash([...merged.values()])
      };
    } finally {
      if (descriptor !== void 0) {
        closeSync(descriptor);
        try {
          unlinkSync(lockPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  }
  context(rootPlanId, rootPlanText = null) {
    if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("handoff context requires a valid wp-* root_plan_id");
    let index = this.loadIndex({ repair: !1 }), metadata = new Map(index.entries.map((entry) => [entry.artifact_id, entry])), lineage = /* @__PURE__ */ new Set(), planCursor = rootPlanId;
    for (; planCursor && !lineage.has(planCursor); )
      lineage.add(planCursor), planCursor = metadata.get(planCursor)?.predecessor_plan_id ?? null;
    let selectedIds = new Set(index.entries.filter((entry) => lineage.has(entry.artifact_id) || lineage.has(entry.root_plan_id)).map((entry) => entry.artifact_id)), pendingReferences = [...selectedIds].flatMap((id) => metadata.get(id)?.references ?? []);
    for (; pendingReferences.length > 0; ) {
      let id = pendingReferences.pop();
      !id || selectedIds.has(id) || !metadata.has(id) || (selectedIds.add(id), pendingReferences.push(...metadata.get(id).references));
    }
    let records = this.records([...selectedIds]), byId = new Map(records.map((record) => [record.artifact_id, record]));
    if (rootPlanText) {
      let supplied = recordFor(rootPlanText, this.pluginRoot);
      if (supplied.artifact_id !== rootPlanId || supplied.artifact_type !== "work-plan") throw new Error("supplied active Plan does not match root_plan_id");
      let cached = byId.get(rootPlanId);
      if (cached && cached.text_hash !== supplied.text_hash) throw new Error("active Plan conflicts with the immutable handoff Root");
      byId.set(rootPlanId, cached ?? supplied);
    }
    if (!byId.get(rootPlanId)) throw new Error(`no handoff Root ${rootPlanId}`);
    let parsed = new Map([...byId.values()].map((record) => [record.artifact_id, parsedArtifact(record.text, this.pluginRoot)]));
    lineage.clear();
    let cursor = rootPlanId;
    for (; cursor && !lineage.has(cursor); )
      lineage.add(cursor), cursor = parsed.get(cursor)?.fields.predecessor_plan_id ?? null;
    let selected = /* @__PURE__ */ new Map();
    for (let [id, artifact] of parsed) {
      let fields = artifact.fields;
      (fields.artifact === "work-plan" ? lineage.has(fields.id) : lineage.has(fields.root_plan_id)) && selected.set(id, byId.get(id));
    }
    let pending = [...selected.keys()];
    for (; pending.length > 0; ) {
      let id = pending.pop();
      for (let reference of referencedIds(parsed.get(id)?.fields ?? {}))
        selected.has(reference) || !byId.has(reference) || (selected.set(reference, byId.get(reference)), pending.push(reference));
    }
    let ordered = [...selected.values()].sort((left, right) => {
      let rank = { "work-plan": 0, "delivery-evidence": 1, "work-review": 2 };
      return rank[left.artifact_type] - rank[right.artifact_type] || left.recorded_at.localeCompare(right.recorded_at) || left.artifact_id.localeCompare(right.artifact_id);
    }), inspection = inspectArtifactSet(ordered.map((record) => [record.artifact_id, record.text]), this.pluginRoot, this.artifactSetOptions);
    if (inspection.errors.length > 0) throw new Error(`cached handoff chain is invalid: ${inspection.errors.join("; ")}`);
    let tips = effectiveCliSummary(inspection);
    return {
      handoff_record_schema: HANDOFF_RECORD_SCHEMA,
      root_plan_id: rootPlanId,
      artifact_set_hash: stableArtifactSetHash(ordered),
      evidence_tip: tips.evidence_tips[rootPlanId] ?? null,
      review_tip: tips.review_tips[rootPlanId] ?? null,
      artifacts: ordered.map((record) => ({
        label: record.artifact_id,
        text: record.text,
        text_hash: record.text_hash,
        ...record.builder_provenance ? { builder_provenance: record.builder_provenance } : {},
        ...record.artifact_type === "work-review" && !record.builder_provenance ? { legacy_review_recorded: !0 } : {}
      }))
    };
  }
  quarantineArtifact(artifactId, { expectedTextHash, apply = !1, now = () => /* @__PURE__ */ new Date() } = {}) {
    if (!/^(?:wr|de)-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(artifactId ?? "")))
      throw new Error("handoff quarantine accepts only an exactly identified wr-* or de-* transport record");
    if (!/^[a-f0-9]{64}$/.test(String(expectedTextHash ?? "")))
      throw new Error("handoff quarantine requires --expected-text-hash with the exact cached artifact hash");
    let record = this.records([artifactId])[0];
    if (!record) throw new Error(`handoff quarantine cannot find ${artifactId}`);
    if (!["work-review", "delivery-evidence"].includes(record.artifact_type))
      throw new Error(`handoff quarantine refuses unsupported artifact ${artifactId}`);
    if (record.text_hash !== expectedTextHash)
      throw new Error(`handoff quarantine expected ${expectedTextHash} but ${artifactId} has ${record.text_hash}`);
    let dependents = this.loadIndex({ repair: !1 }).entries.filter((entry) => (entry.references ?? []).includes(artifactId)).map((entry) => entry.artifact_id).sort(), timestamp = now().toISOString().replace(/[:.]/g, "-"), quarantineDirectory = join(this.root, "handoff", "quarantine", `${timestamp}-${artifactId}-${expectedTextHash.slice(0, 12)}`), source = this.artifactPath(artifactId), target = join(quarantineDirectory, "artifact-record.json"), report = {
      command: "quarantine-handoff",
      namespace_root: this.root,
      artifact_id: artifactId,
      artifact_type: record.artifact_type,
      text_hash: record.text_hash,
      record_hash: createHash("sha256").update(readFileSync(source)).digest("hex"),
      source,
      quarantine_directory: quarantineDirectory,
      target,
      dependents,
      applicable: dependents.length === 0,
      applied: !1
    };
    if (!apply) return report;
    if (dependents.length > 0)
      throw new Error(`handoff quarantine refuses ${artifactId} because active artifacts depend on it: ${dependents.join(", ")}`);
    if (existsSync(quarantineDirectory)) throw new Error(`handoff quarantine target already exists: ${quarantineDirectory}`);
    let lockPath = join(this.root, "handoff", ".lock"), descriptor;
    try {
      descriptor = acquireLock(lockPath);
      let current = this.records([artifactId])[0];
      if (!current || current.text_hash !== expectedTextHash) throw new Error(`handoff quarantine target ${artifactId} changed before apply`);
      let currentIndex = this.loadIndex({ repair: !1 }), currentDependents = currentIndex.entries.filter((entry) => (entry.references ?? []).includes(artifactId)).map((entry) => entry.artifact_id).sort();
      if (currentDependents.length > 0)
        throw new Error(`handoff quarantine refuses ${artifactId} because active artifacts depend on it: ${currentDependents.join(", ")}`);
      mkdirSync(quarantineDirectory, { recursive: !0, mode: 448 });
      let indexPath = this.indexPath();
      existsSync(indexPath) && writeFileSync(join(quarantineDirectory, "index-before.json"), readFileSync(indexPath), { mode: 384, flag: "wx" }), renameSync(source, target);
      try {
        let rebuilt = this.rebuildIndex();
        atomicJson(join(quarantineDirectory, "quarantine-manifest.json"), {
          quarantine_manifest_schema: 1,
          ...report,
          applied: !0,
          quarantined_at: now().toISOString(),
          rebuilt_index_entries: rebuilt.entries.length
        });
      } catch (error) {
        throw renameSync(target, source), atomicJson(this.indexPath(), currentIndex), error;
      }
      return { ...report, applied: !0 };
    } finally {
      if (descriptor !== void 0) {
        closeSync(descriptor);
        try {
          unlinkSync(lockPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  }
};

export {
  createContentAddressedHandoffStore,
  quarantineContentAddressedHandoffArtifact,
  resolveRootPlanText,
  rememberContentAddressedRoot,
  ArtifactHandoffStore
};
