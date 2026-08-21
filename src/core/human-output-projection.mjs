import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";

const asList = (value) => Array.isArray(value)
  ? value.map(String).map((item) => item.trim()).filter(Boolean)
  : value === null || value === undefined || String(value).trim() === ""
    ? []
    : [String(value).trim()];

const unique = (values) => [...new Set(values.flatMap(asList))];

function sectionValues(artifact, names) {
  if (!(artifact?.sections instanceof Map)) return [];
  return unique(names.map((name) => artifact.sections.get(name)));
}

function proseSectionValues(artifact, names) {
  return sectionValues(artifact, names).map((value) => value
    .split(/\n(?=###\s|\|)/, 1)[0]
    .trim())
    .filter(Boolean);
}

function tableRows(markdown) {
  const lines = String(markdown ?? "").split("\n");
  const rows = [];
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (!/^\|.*\|$/.test(lines[index]) || !/^\|(?:[\s:|-]+\|)+$/.test(lines[index + 1])) continue;
    const cells = (line) => line.slice(1, -1).split("|").map((cell) => cell.trim());
    const headers = cells(lines[index]);
    index += 2;
    while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
      const values = cells(lines[index]);
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] ?? ""])));
      index += 1;
    }
    index -= 1;
  }
  return rows;
}

function plannedCheckSummary(root) {
  return sectionValues(root, ["Acceptance"]).flatMap(tableRows)
    .filter((row) => row["Check ID"])
    .map((row) => `${row["Check ID"]}: ${row["Command or Inspection"]} in ${row["Working Directory"]}; expected ${row["Expected Result"]}; ${row.Required === "yes" ? "required" : "optional"}; evidence class ${row["Evidence Class"]}.`);
}

function observedCheckSummary(evidence) {
  return (evidence?.fields?.check_evidence ?? []).map((entry) => unique([
    `${entry.check_id}: ${entry.grade}`,
    entry.expected ? `expected ${entry.expected}` : null,
    entry.observed ? `observed ${entry.observed}` : null,
    Number.isInteger(entry.repetitions) ? `repetitions ${entry.repetitions}` : null,
    entry.limitations?.length ? `limitations ${entry.limitations.join(", ")}` : null,
  ]).join("; ") + ".");
}

function inspectedArtifacts(rootPlanText, artifacts, pluginRoot) {
  const values = [];
  for (const text of [rootPlanText, ...(artifacts ?? []).map((entry) => typeof entry === "string" ? entry : entry?.text)]) {
    if (typeof text !== "string" || !text.trim()) continue;
    const inspected = inspectArtifactText(text, pluginRoot);
    if (inspected.errors.length === 0 && inspected.artifact?.fields?.artifact) values.push(inspected.artifact);
  }
  return values;
}

function exactOrLast(artifacts, kind, id) {
  const matching = artifacts.filter((artifact) => artifact.fields.artifact === kind);
  return (id ? matching.find((artifact) => artifact.fields.id === id) : null) ?? matching.at(-1) ?? null;
}

function authorityConstraints(fields) {
  const authority = fields?.authority ?? {};
  return unique([
    ...(authority.protected_paths?.length ? [`Protected paths: ${authority.protected_paths.join(", ")}.`] : []),
    ...(authority.approval_required_paths?.length ? [`Approval-required paths: ${authority.approval_required_paths.join(", ")}.`] : []),
    authority.dependencies ? `Dependency authority: ${authority.dependencies}.` : null,
    authority.external_effects ? `External effects: ${authority.external_effects}.` : null,
    authority.delivery ? `Delivery boundary: ${authority.delivery}.` : null,
  ]);
}

export function humanWorkflowProjection({
  rootPlanText = null,
  artifacts = [],
  pluginRoot,
  rootPlanId = null,
  evidenceId = null,
  reviewId = null,
} = {}) {
  const inspected = inspectedArtifacts(rootPlanText, artifacts, pluginRoot);
  const root = exactOrLast(inspected, "work-plan", rootPlanId);
  if (!root) return null;
  const evidence = exactOrLast(inspected, "delivery-evidence", evidenceId);
  const review = exactOrLast(inspected, "work-review", reviewId);
  const fields = root.fields;
  const authority = fields.authority ?? {};
  const approach = unique([
    ...proseSectionValues(root, ["Intent", "Intent and decisions", "Execution steps", "Program design", "System impact", "Slices"]),
    ...proseSectionValues(evidence, ["Summary"]),
    ...(evidence?.fields?.changed_paths?.length ? [`Current Evidence changed paths: ${evidence.fields.changed_paths.join(", ")}.`] : []),
  ]);
  const verification = unique([
    ...asList(fields.acceptance),
    ...proseSectionValues(root, ["Acceptance"]),
    ...plannedCheckSummary(root),
    ...observedCheckSummary(evidence),
    ...proseSectionValues(review, ["Assessment"]),
  ]);
  const risks = unique([
    `Declared risk: ${fields.risk ?? "not declared"}.`,
    ...(fields.hard_triggers?.length ? [`Hard triggers: ${fields.hard_triggers.join(", ")}.`] : []),
    ...proseSectionValues(root, ["Risks", "Risk and closeout", "Operational readiness"]),
    ...proseSectionValues(evidence, ["Deviations", "Residual risks"]).map((value) => `Evidence risk/deviation: ${value}`),
  ]);
  const unknowns = unique([
    ...proseSectionValues(review, ["Findings"]).map((value) => `Review findings: ${value}`),
    ...proseSectionValues(review, ["Next action"]).map((value) => `Review next action: ${value}`),
    ...(!review ? ["No fresh Review verdict is present yet; the current Workflow action remains the recovery boundary."] : []),
  ]);
  return {
    schema: 1,
    outcome: String(fields.goal ?? sectionValues(root, ["Intent"])[0] ?? "Current Root outcome is not available."),
    approach_and_rationale: approach.length > 0 ? approach : ["The current Root contains no separate approach and rationale explanation."],
    in_scope: unique([
      ...(authority.allowed_roots?.length ? [`Allowed repository roots: ${authority.allowed_roots.join(", ")}.`] : []),
      ...proseSectionValues(root, ["Boundaries", "Scope and targets"]),
    ]),
    non_goals: asList(fields.non_goals),
    constraints: unique([...asList(fields.constraints), ...authorityConstraints(fields)]),
    acceptance_and_verification: verification,
    risks_and_tradeoffs: risks,
    unknowns_and_recovery: unknowns,
  };
}
