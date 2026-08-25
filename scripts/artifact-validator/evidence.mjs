export function schema6EvidenceData(fields) {
  const objectiveStatus = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
  return {
    objectiveStates: new Map((fields.affected_objectives ?? []).map((id) => [id, {
      status: objectiveStatus,
      evidence: `Schema-6 Evidence ${fields.id}`,
    }])),
    checkStates: new Map((fields.check_evidence ?? []).map((entry) => [entry.check_id, {
      status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "unavailable",
      observed: entry.observed,
      evidence_hashes: entry.evidence_hashes ?? [],
    }])),
    changedPaths: [...(fields.changed_paths ?? [])],
    workspaceSnapshotHash: fields.workspace_snapshot_hash ?? null,
  };
}

export function evidenceHasKnownFailure(fields) {
  return fields.status === "blocked"
    || fields.overall_grade === "failed"
    || (fields.check_evidence ?? []).some((entry) => entry.grade === "failed");
}
