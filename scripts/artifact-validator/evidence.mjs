export function leanEvidenceData(fields) {
  const objectiveStatus = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
  const outcomes = (fields.affected_objectives ?? []).map((id) => ({
    "Objective ID": id,
    Status: objectiveStatus,
    Evidence: `lean evidence ${fields.id}`,
  }));
  const checks = (fields.check_evidence ?? []).map((entry) => ({
    "Check ID": entry.check_id,
    "Observed Result": entry.observed,
    Status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "skipped",
    "Prerequisite fingerprints": "",
  }));
  return {
    results: [],
    outcomes,
    outcomeRows: new Map(outcomes.map((row) => [row["Objective ID"], row])),
    changes: (fields.changed_paths ?? []).map((path) => ({ "Path or Symbol": path, Change: "declared in lean evidence", "Objective Coverage": (fields.affected_objectives ?? []).join(", ") })),
    snapshot: null,
    checks,
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    steps: [],
  };
}

export function evidenceHasKnownFailure(fields) {
  return fields.status === "blocked"
    || fields.overall_grade === "failed"
    || (fields.check_evidence ?? []).some((entry) => entry.grade === "failed");
}
