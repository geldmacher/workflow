import { createHash } from "node:crypto";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * Resolve only native, current-task plan candidates. Callers must describe the
 * native sources they actually inspected; caches and cross-task handoffs are
 * deliberately outside this contract.
 */
export function resolveNativePlan({ candidates = [], attemptedSources = [], pluginRoot } = {}) {
  const attempted = [...new Set([
    ...attemptedSources,
    ...candidates.map((entry) => entry?.source).filter(Boolean),
  ])];
  const valid = [];
  for (const candidate of candidates) {
    if (typeof candidate?.root_text !== "string" || !candidate.root_text.trim()) continue;
    const inspected = inspectArtifactText(candidate.root_text, pluginRoot);
    const fields = inspected.artifact?.fields;
    if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields?.schema !== 5) continue;
    valid.push({
      root_text: candidate.root_text,
      root_id: fields.id,
      root_hash: sha256(candidate.root_text),
      source: candidate.source ?? "native-task-plan",
    });
  }
  const unique = [...new Map(valid.map((entry) => [entry.root_hash, entry])).values()];
  if (unique.length === 0) {
    return {
      status: "unavailable",
      attempted_sources: attempted,
      resolution: "Restore the Schema-5 native Plan in this same task or create and approve a new native Plan, then repeat Review.",
    };
  }
  if (unique.length > 1) {
    return {
      status: "ambiguous",
      candidate_ids: [...new Set(unique.map((entry) => entry.root_id))].sort(),
      attempted_sources: attempted,
      resolution: "Keep exactly one Schema-5 native Plan in the current task context, then repeat Review.",
    };
  }
  return { status: "resolved", ...unique[0] };
}
