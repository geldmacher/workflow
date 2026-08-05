import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ArtifactHandoffStore } from "../controller/artifact-handoff.mjs";
import { inspectArtifactSet } from "../../scripts/validate-artifact.source.mjs";

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function sourceProjection(records) {
  return records
    .map((record) => ({ artifact_id: record.artifact_id, text_hash: record.text_hash }))
    .sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
}

export function migrateCursorHandoff({ sourceRoot, targetRoot, pluginRoot, observedAt = new Date().toISOString() }) {
  const source = new ArtifactHandoffStore(resolve(sourceRoot), resolve(pluginRoot));
  const target = new ArtifactHandoffStore(resolve(targetRoot), resolve(pluginRoot));
  const records = source.records();
  const projection = sourceProjection(records);
  const sourceHash = sha256(JSON.stringify(projection));
  const receiptPath = join(resolve(targetRoot), "handoff", "migrations", "cursor-v1.json");
  let receipt = { migration_receipt_schema: 1, source_host: "cursor", target_store: "shared-handoff", imports: [] };
  if (existsSync(receiptPath)) receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  if (receipt.migration_receipt_schema !== 1 || receipt.source_host !== "cursor" || !Array.isArray(receipt.imports)) {
    throw new Error("incompatible Cursor handoff migration receipt");
  }
  const prior = receipt.imports.find((entry) => entry.source_hash === sourceHash);
  if (prior) return { ...prior, duplicate_import: true, receipt_path: receiptPath };

  if (records.length > 0) {
    const inspection = inspectArtifactSet(records.map((record) => [record.artifact_id, record.text]), pluginRoot);
    if (inspection.errors.length > 0) throw new Error(`Cursor handoff import rejected an incomplete or corrupt chain: ${inspection.errors.join("; ")}`);
  }
  const targetRecords = target.records();
  const targetById = new Map(targetRecords.map((record) => [record.artifact_id, record]));
  for (const record of records) {
    const existing = targetById.get(record.artifact_id);
    if (existing && existing.text_hash !== record.text_hash) throw new Error(`handoff artifact ${record.artifact_id} conflicts with the immutable cached text`);
  }
  if (records.length > 0 || targetRecords.length > 0) {
    const merged = new Map(targetRecords.map((record) => [record.artifact_id, record.text]));
    for (const record of records) merged.set(record.artifact_id, record.text);
    const inspection = inspectArtifactSet([...merged], pluginRoot);
    if (inspection.errors.length > 0) throw new Error(`Cursor handoff import conflicts with the target chain: ${inspection.errors.join("; ")}`);
  }

  const sourceById = new Map(records.map((record) => [record.artifact_id, record]));
  const importedIds = new Set(targetRecords.map((record) => record.artifact_id));
  const pending = new Map(records.map((record) => [record.artifact_id, record]));
  const recorded = [];
  const duplicates = [];
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((record) => {
      const metadata = source.metadata(record);
      const dependencies = [
        ...(record.artifact_type === "work-plan" ? [] : [record.root_plan_id]),
        ...metadata.references,
      ].filter((id) => sourceById.has(id));
      return dependencies.every((id) => importedIds.has(id));
    }).sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
    if (ready.length === 0) throw new Error("Cursor handoff import dependency order is cyclic or incomplete");
    for (const record of ready) {
      const result = target.record([{ label: record.artifact_id, text: record.text }]);
      recorded.push(...result.recorded);
      duplicates.push(...result.duplicates);
      importedIds.add(record.artifact_id);
      pending.delete(record.artifact_id);
    }
  }
  const targetProjection = sourceProjection(target.records());
  const imported = {
    recorded: [...new Set(recorded)].sort(),
    duplicates: [...new Set(duplicates)].sort(),
    artifact_set_hash: sha256(JSON.stringify(targetProjection)),
  };
  const entry = {
    source_hash: sourceHash,
    observed_at: observedAt,
    record_count: records.length,
    artifacts: projection,
    recorded: imported.recorded,
    duplicates: imported.duplicates,
    target_artifact_set_hash: imported.artifact_set_hash,
  };
  atomicJson(receiptPath, { ...receipt, imports: [...receipt.imports, entry] });
  return { ...entry, duplicate_import: false, receipt_path: receiptPath };
}
