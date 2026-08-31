import { createHash } from "node:crypto";
import { stringify } from "yaml";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { classifyChangedPathAuthority } from "../core/manual-path-authority.mjs";
import { rootContentHash } from "../core/state-paths.mjs";

const OUTCOMES = new Set(["achieved", "correction-needed", "open-points"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const RESOLUTIONS = new Set(["correct", "open"]);
const OPEN_POINT_TYPES = new Set(["evidence", "authority", "intent", "environment", "formal-binding", "no-progress"]);
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function compareCanonical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function codedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort(compareCanonical).map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function closed(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported field ${unknown[0]}`);
}

function line(value, label, max = 2_000) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return normalized;
}

function list(value, label, { max = 64, required = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (required && value.length === 0) throw new Error(`${label} must not be empty`);
  if (value.length > max) throw new Error(`${label} exceeds ${max} items`);
  return value;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareCanonical);
}

function semanticKey(value, label) {
  const normalized = line(value, label, 80);
  if (!KEY.test(normalized)) throw new Error(`${label} must be a lowercase semantic key`);
  return normalized;
}

function enumValue(value, allowed, label) {
  const normalized = String(value ?? "").trim();
  if (!allowed.has(normalized)) throw new Error(`${label} has invalid value ${normalized || "<missing>"}`);
  return normalized;
}

function ids(value, pattern, allowed, label) {
  const normalized = uniqueSorted(list(value, label, { required: true }).map((entry) => line(entry, label, 80)));
  for (const id of normalized) if (!pattern.test(id) || !allowed.has(id)) throw new Error(`${label} contains unknown ${id}`);
  return normalized;
}

function normalizeFindings(value, contract) {
  const objectiveIds = new Set(contract.objectives);
  const checkIds = new Set(contract.checks.map((check) => check["Check ID"]));
  const findings = list(value, "review_input.findings", { max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.findings[${index}]`);
    closed(item, ["key", "severity", "objective_ids", "check_ids", "evidence", "reasoning", "resolution"], `review_input.findings[${index}]`);
    return {
      key: semanticKey(item.key, `review_input.findings[${index}].key`),
      severity: enumValue(item.severity, SEVERITIES, `review_input.findings[${index}].severity`),
      objective_ids: ids(item.objective_ids, /^OBJ-[1-9][0-9]*$/, objectiveIds, `review_input.findings[${index}].objective_ids`),
      check_ids: ids(item.check_ids, /^CHECK-[1-9][0-9]*$/, checkIds, `review_input.findings[${index}].check_ids`),
      evidence: line(item.evidence, `review_input.findings[${index}].evidence`, 4_000),
      reasoning: line(item.reasoning, `review_input.findings[${index}].reasoning`, 4_000),
      resolution: enumValue(item.resolution, RESOLUTIONS, `review_input.findings[${index}].resolution`),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(findings.map((finding) => finding.key)).size !== findings.length) throw new Error("review_input.findings keys must be unique");
  return findings;
}

function normalizeOpenPoints(value) {
  const points = list(value, "review_input.open_points", { max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.open_points[${index}]`);
    closed(item, ["key", "type", "summary", "evidence", "impact", "question"], `review_input.open_points[${index}]`);
    return {
      key: semanticKey(item.key, `review_input.open_points[${index}].key`),
      type: enumValue(item.type, OPEN_POINT_TYPES, `review_input.open_points[${index}].type`),
      summary: line(item.summary, `review_input.open_points[${index}].summary`),
      evidence: line(item.evidence, `review_input.open_points[${index}].evidence`, 4_000),
      impact: line(item.impact, `review_input.open_points[${index}].impact`),
      question: line(item.question, `review_input.open_points[${index}].question`),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(points.map((point) => point.key)).size !== points.length) throw new Error("review_input.open_points keys must be unique");
  return points;
}

function normalizeCorrection(value, findings, contract) {
  if (value == null) return null;
  const correction = object(value, "review_input.correction");
  closed(correction, ["fixes", "steps"], "review_input.correction");
  const correctable = new Set(findings.filter((finding) => finding.resolution === "correct").map((finding) => finding.key));
  const fixes = list(correction.fixes, "review_input.correction.fixes", { required: true, max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.correction.fixes[${index}]`);
    closed(item, ["key", "finding_keys", "required_outcome", "evidence"], `review_input.correction.fixes[${index}]`);
    const findingKeys = uniqueSorted(list(item.finding_keys, `review_input.correction.fixes[${index}].finding_keys`, { required: true, max: 32 })
      .map((key) => semanticKey(key, `review_input.correction.fixes[${index}].finding_keys`)));
    if (findingKeys.some((key) => !correctable.has(key))) throw new Error(`review_input.correction.fixes[${index}] references a non-correctable or unknown finding`);
    return {
      key: semanticKey(item.key, `review_input.correction.fixes[${index}].key`),
      finding_keys: findingKeys,
      required_outcome: line(item.required_outcome, `review_input.correction.fixes[${index}].required_outcome`),
      evidence: line(item.evidence, `review_input.correction.fixes[${index}].evidence`),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  const fixKeys = new Set(fixes.map((fix) => fix.key));
  if (fixKeys.size !== fixes.length) throw new Error("review_input.correction.fixes keys must be unique");
  for (const finding of correctable) if (!fixes.some((fix) => fix.finding_keys.includes(finding))) throw new Error(`review_input.correction.fixes do not cover finding ${finding}`);

  const rootChecks = new Set(contract.checks.map((check) => check["Check ID"]));
  const steps = list(correction.steps, "review_input.correction.steps", { required: true, max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.correction.steps[${index}]`);
    closed(item, ["key", "fix_keys", "targets", "required_outcome", "implementation_latitude", "completion_probe", "root_check_ids", "deviation_action"], `review_input.correction.steps[${index}]`);
    const referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.steps[${index}].fix_keys`, { required: true, max: 32 })
      .map((key) => semanticKey(key, `review_input.correction.steps[${index}].fix_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown fix`);
    const targets = uniqueSorted(list(item.targets, `review_input.correction.steps[${index}].targets`, { required: true, max: 64 })
      .map((target) => line(target, `review_input.correction.steps[${index}].targets`, 1_000)));
    const authority = classifyChangedPathAuthority(contract.fields, targets, null, []);
    if (authority.status !== "within-authority") {
      throw codedError("correction-authority-invalid", `review_input.correction.steps[${index}] targets outside correction authority: ${[
        ...authority.outside_allowed_paths,
        ...authority.approval_required_paths,
        ...authority.protected_paths,
      ].join(", ")}`);
    }
    return {
      key: semanticKey(item.key, `review_input.correction.steps[${index}].key`),
      fix_keys: referencedFixes,
      targets,
      required_outcome: line(item.required_outcome, `review_input.correction.steps[${index}].required_outcome`),
      implementation_latitude: line(item.implementation_latitude, `review_input.correction.steps[${index}].implementation_latitude`),
      completion_probe: line(item.completion_probe, `review_input.correction.steps[${index}].completion_probe`),
      root_check_ids: ids(item.root_check_ids, /^CHECK-[1-9][0-9]*$/, rootChecks, `review_input.correction.steps[${index}].root_check_ids`),
      deviation_action: line(item.deviation_action, `review_input.correction.steps[${index}].deviation_action`),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(steps.map((step) => step.key)).size !== steps.length) throw new Error("review_input.correction.steps keys must be unique");
  for (const fix of fixKeys) if (!steps.some((step) => step.fix_keys.includes(fix))) throw new Error(`review_input.correction.steps do not cover ${fix}`);
  return { fixes, steps };
}

export function normalizeReviewInput(input, contract) {
  const value = object(input, "review_input");
  closed(value, ["schema", "kind", "outcome", "assessment_summary", "snapshot_summary", "findings", "open_points", "correction"], "review_input");
  if (value.schema !== 1 || value.kind !== "review-input") throw new Error("review_input must declare schema 1 and kind review-input");
  const findings = normalizeFindings(value.findings, contract);
  const openPoints = normalizeOpenPoints(value.open_points);
  const outcome = enumValue(value.outcome, OUTCOMES, "review_input.outcome");
  const correction = normalizeCorrection(value.correction, findings, contract);
  const correctable = findings.filter((finding) => finding.resolution === "correct");
  if (outcome === "achieved" && (findings.length > 0 || openPoints.length > 0 || correction)) throw new Error("review_input achieved requires no findings, open points, or correction");
  if (outcome === "correction-needed" && (correctable.length === 0 || !correction)) throw new Error("review_input correction-needed requires correctable findings and one complete correction");
  if (outcome === "open-points" && (openPoints.length === 0 || correctable.length > 0 || correction)) throw new Error("review_input open-points requires open points and no pending correctable finding");
  return {
    schema: 1,
    kind: "review-input",
    outcome,
    assessment_summary: line(value.assessment_summary, "review_input.assessment_summary"),
    snapshot_summary: line(value.snapshot_summary, "review_input.snapshot_summary"),
    findings,
    open_points: openPoints,
    correction,
  };
}

export function parseReviewInputFromText(source) {
  const matches = [...String(source ?? "").matchAll(/```json[ \t]+workflow-review-input[ \t]*\r?\n([\s\S]*?)```/gi)];
  if (matches.length !== 1) return { ok: false, input: null, issues: [matches.length === 0 ? "exactly one json workflow-review-input block is required" : "multiple workflow-review-input blocks are not allowed"] };
  try {
    return { ok: true, input: JSON.parse(matches[0][1]), issues: [] };
  } catch (error) {
    return { ok: false, input: null, issues: [`workflow-review-input JSON is invalid: ${error.message}`] };
  }
}

function mergeChain(rootPlanText, artifacts, pluginRoot, { allowUnprovenancedReviews = false } = {}) {
  const rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan" || rootInspection.artifact.fields.schema !== 6) {
    throw new Error(`review builder requires an exact valid Schema-6 Root: ${rootInspection.errors.join("; ") || "not a work-plan"}`);
  }
  const byId = new Map([[rootInspection.artifact.fields.id, { label: rootInspection.artifact.fields.id, text: rootPlanText }]]);
  for (const [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) throw new Error(`review builder artifact ${index + 1} requires exact text`);
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`review builder artifact ${entry.label ?? index + 1} is invalid: ${inspected.errors.join(";")}`);
    const id = inspected.artifact.fields.id;
    const provenance = entry.builder_provenance ?? entry.provenance ?? null;
    if (inspected.artifact.fields.artifact === "work-review") {
      const valid = provenance?.schema === 1
        && provenance?.kind === "host-work-review-builder"
        && /^[a-f0-9]{64}$/.test(String(provenance.review_input_hash ?? ""))
        && provenance.artifact_hash === sha256(entry.text)
        && Object.keys(provenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
      if (provenance && !valid) throw codedError("review-artifact-rejected", `review builder artifact ${id} has invalid host builder provenance`);
      if (!valid && !allowUnprovenancedReviews) throw codedError("review-artifact-rejected", `review builder rejects imported work-review ${id} without protected builder provenance`);
    }
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`review builder artifact ${id} has conflicting immutable bytes`);
    byId.set(id, { label: id, text: entry.text, ...(provenance ? { builder_provenance: provenance } : {}) });
  }
  return { rootFields: rootInspection.artifact.fields, entries: [...byId.values()] };
}

function outcomeFor(input, evidence, requiredChecks) {
  const byId = new Map((evidence.fields.check_evidence ?? []).map((entry) => [entry.check_id, entry]));
  const insufficient = requiredChecks.filter((checkId) => !["verified", "supported"].includes(byId.get(checkId)?.grade));
  if (input.outcome === "correction-needed") return { outcome: "correction-needed", next_action: "correct" };
  if (input.outcome === "open-points") return { outcome: "open-points", next_action: "human-assessment" };
  if (insufficient.length > 0 || evidence.fields.status === "blocked") {
    throw codedError("review-open-points-required", `Achieved requires every required Check to be at least supported; open points are required for ${insufficient.join(", ") || "the blocked delivery evidence"}`, { check_ids: insufficient });
  }
  return { outcome: "achieved", next_action: "none" };
}

function cell(value) {
  return String(value ?? "none").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim() || "none";
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell(row[header])).join(" | ")} |`),
  ].join("\n");
}

function correctionProjection({ normalized, seed, rootFields, evidenceId, reviewId, predecessorReview, contract }) {
  if (!normalized.correction) return null;
  const correctionId = `cp-${rootFields.id.replace(/^wp-/, "")}-${seed.slice(0, 12)}`;
  const fixIds = new Map(normalized.correction.fixes.map((fix, index) => [fix.key, `FIX-${index + 1}`]));
  const stepIds = new Map(normalized.correction.steps.map((step, index) => [step.key, `STEP-${index + 1}`]));
  const findings = new Map(normalized.findings.map((finding) => [finding.key, finding]));
  const fixes = normalized.correction.fixes.map((fix) => {
    const related = fix.finding_keys.map((key) => findings.get(key));
    return {
      "FIX ID": fixIds.get(fix.key),
      "Finding keys": fix.finding_keys.join(", "),
      "Root Objectives": uniqueSorted(related.flatMap((finding) => finding.objective_ids)).join(", "),
      "Root Checks": uniqueSorted(related.flatMap((finding) => finding.check_ids)).join(", "),
      "Required outcome": fix.required_outcome,
      Evidence: fix.evidence,
    };
  });
  const steps = normalized.correction.steps.map((step, index) => ({
    "Step ID": stepIds.get(step.key),
    "FIX IDs": step.fix_keys.map((key) => fixIds.get(key)).join(", "),
    Targets: step.targets.join(", "),
    "Required outcome": step.required_outcome,
    "Implementation latitude": step.implementation_latitude,
    "Completion probe": `PROBE-${index + 1}: ${step.completion_probe}`,
    "Check IDs": step.root_check_ids.join(", "),
    "Deviation action": step.deviation_action,
  }));
  const usedChecks = uniqueSorted(normalized.correction.steps.flatMap((step) => step.root_check_ids));
  const checksById = new Map(contract.checks.map((check) => [check["Check ID"], check]));
  const checks = usedChecks.map((checkId) => checksById.get(checkId));
  const body = [
    `## Correction plan\n\n### ${correctionId}`,
    table(["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"], [{
      "Correction ID": correctionId,
      "Root Plan": rootFields.id,
      "Source Review": reviewId,
      "Base Evidence": evidenceId,
      "Predecessor Correction": predecessorReview?.fields?.correction_id ?? "None.",
      Risk: rootFields.risk,
    }]),
    table(["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"], fixes),
    table(["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"], steps),
    table(["Check ID", "Objectives", "Verification Intent", "Expected Evidence", "Required", "Evidence Class", "Cost Class", "Prerequisites"], checks),
  ].join("\n\n");
  return { correction_id: correctionId, body };
}

function findingsTable(findings) {
  return findings.length === 0 ? "None." : table(
    ["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning", "Resolution"],
    findings.map((finding) => ({
      "Finding key": finding.key,
      Severity: finding.severity,
      Objectives: finding.objective_ids.join(", "),
      Checks: finding.check_ids.join(", "),
      Evidence: finding.evidence,
      Reasoning: finding.reasoning,
      Resolution: finding.resolution,
    })),
  );
}

function openPointsTable(points) {
  return points.length === 0 ? "None." : table(
    ["Open point", "Type", "Summary", "Evidence", "Impact", "Human question"],
    points.map((point) => ({
      "Open point": point.key,
      Type: point.type,
      Summary: point.summary,
      Evidence: point.evidence,
      Impact: point.impact,
      "Human question": point.question,
    })),
  );
}

function reviewBody({ normalized, outcome, coverage, evidenceId, correction }) {
  return [
    `## Outcome\n\n${outcome.outcome}: ${normalized.assessment_summary}`,
    `## Evidence coverage\n\n${table(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: coverage.inspectedObjectives.join(", ") || "none", Reused: coverage.reusedObjectives.join(", ") || "none", Result: outcome.outcome, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Checks", Inspected: coverage.inspectedChecks.join(", ") || "none", Reused: coverage.reusedChecks.join(", ") || "none", Result: outcome.outcome, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Snapshot", Inspected: evidenceId, Reused: "none", Result: outcome.outcome, Evidence: normalized.snapshot_summary },
    ])}`,
    `## Findings\n\n${findingsTable(normalized.findings)}`,
    `## Open points\n\n${openPointsTable(normalized.open_points)}`,
    `## Next action\n\n${outcome.next_action}: ${outcome.next_action === "none" ? "No further Workflow action is required." : outcome.next_action === "correct" ? "Use the separately human-authorized Correct Work action." : "Ask the human to assess the named open points."}`,
    ...(correction ? [correction.body] : []),
  ].join("\n\n");
}

function boundaryReview({ merged, predecessorReviewId, boundaryReceipt, rootPlanText, contract }) {
  const seed = {
    schema: 1,
    root_content_hash: rootContentHash(rootPlanText),
    root_projection_hash: contract.authoritative_projection_hash,
    predecessor_review_id: predecessorReviewId,
    boundary_receipt: boundaryReceipt,
  };
  const inputHash = sha256(stableJson(seed));
  const id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${inputHash.slice(0, 12)}`;
  const openPoint = {
    key: "root-boundary",
    type: "formal-binding",
    summary: "The exact repository boundary cannot be reconstructed.",
    evidence: boundaryReceipt.recovery_error_code,
    impact: "Workflow cannot issue an authoritative delivery judgment for this snapshot.",
    question: "Should the human provide a newly bound plan or end this delivery with the stated limitation?",
  };
  const fields = {
    artifact: "work-review", schema: 6, id, status: "complete", root_plan_id: merged.rootFields.id,
    latest_evidence_id: null, review_basis: "root-boundary", boundary_receipt: boundaryReceipt,
    outcome: "open-points", next_action: "human-assessment", correction_id: null, predecessor_review_id: predecessorReviewId,
    inspected_objectives: [], reused_objectives: [], inspected_checks: [], reused_checks: [], findings: [], open_points: [openPoint],
  };
  const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${reviewBody({ normalized: { assessment_summary: openPoint.summary, snapshot_summary: openPoint.evidence, findings: [], open_points: [openPoint] }, outcome: fields, coverage: { inspectedObjectives: [], reusedObjectives: [], inspectedChecks: [], reusedChecks: [] }, evidenceId: "none", correction: null })}\n`;
  return { id, fields, artifact, inputHash };
}

export function buildWorkReview({
  rootPlanText,
  artifacts = [],
  reviewInput = null,
  boundaryReceipt = null,
  boundaryReceiptVerifier = null,
  allowUnprovenancedReviews = false,
  pluginRoot,
}) {
  const merged = mergeChain(rootPlanText, artifacts, pluginRoot, { allowUnprovenancedReviews });
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 6) throw new Error(`review builder Root is invalid: ${contract.errors.join(";")}`);
  const options = boundaryReceipt && typeof boundaryReceiptVerifier === "function" ? { boundaryReceiptVerifier } : {};
  const prior = inspectArtifactSet(merged.entries.map((entry) => [entry.label, entry.text]), pluginRoot, options);
  if (prior.errors.length > 0) throw new Error(`review builder input chain is invalid: ${prior.errors.join(";")}`);
  const tips = effectiveCliSummary(prior);
  const predecessorReviewId = tips.review_tips[merged.rootFields.id] ?? null;
  const predecessorReview = predecessorReviewId ? prior.effective.get(predecessorReviewId) : null;
  const predecessorReviewText = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId)?.text ?? "" : "";

  if (boundaryReceipt) {
    if (typeof boundaryReceiptVerifier !== "function") throw new Error("root-boundary review requires a protected host verifier");
    const trusted = boundaryReceiptVerifier({ receipt: boundaryReceipt, rootPlanText, reviewFields: null });
    if (trusted?.ok !== true) throw new Error(`root-boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
    const built = boundaryReview({ merged, predecessorReviewId, boundaryReceipt, rootPlanText, contract });
    const finalEntries = [...merged.entries, { label: built.id, text: built.artifact }];
    const validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot, { boundaryReceiptVerifier });
    if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join(";")}`);
    const artifactHash = sha256(built.artifact);
    return { duplicate: false, artifact: built.artifact, artifact_hash: artifactHash, review_input_hash: built.inputHash, fields: built.fields, provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: built.inputHash, artifact_hash: artifactHash } };
  }

  const evidenceId = tips.evidence_tips[merged.rootFields.id] ?? null;
  if (!evidenceId) throw new Error("review builder requires the exact current Evidence tip");
  const evidence = prior.effective.get(evidenceId);
  const evidenceText = merged.entries.find((entry) => entry.label === evidenceId)?.text;
  if (!evidence || !evidenceText) throw new Error(`review builder cannot resolve exact Evidence ${evidenceId}`);
  let normalized;
  try {
    normalized = normalizeReviewInput(reviewInput, contract);
  } catch (error) {
    if (error?.code) throw error;
    throw codedError("review-input-invalid", error.message);
  }
  const rootChecks = contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]);
  const outcome = outcomeFor(normalized, evidence, rootChecks);
  const reusedObjectives = predecessorReviewId ? (evidence.fields.reused_objectives ?? []).filter((id) => contract.objectives.includes(id)).sort(compareCanonical) : [];
  const reusedChecks = predecessorReviewId ? (evidence.fields.reused_checks ?? []).filter((id) => rootChecks.includes(id)).sort(compareCanonical) : [];
  const coverage = {
    reusedObjectives,
    inspectedObjectives: contract.objectives.filter((id) => !reusedObjectives.includes(id)),
    reusedChecks,
    inspectedChecks: rootChecks.filter((id) => !reusedChecks.includes(id)),
  };
  const seedInput = {
    schema: 1,
    root_content_hash: rootContentHash(rootPlanText),
    root_projection_hash: contract.authoritative_projection_hash,
    evidence_id: evidenceId,
    evidence_hash: sha256(evidenceText),
    predecessor_review_id: predecessorReviewId,
    predecessor_review_hash: predecessorReviewText ? sha256(predecessorReviewText) : null,
    review_input: normalized,
  };
  const reviewInputHash = sha256(stableJson(seedInput));
  const id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash.slice(0, 12)}`;
  const correction = correctionProjection({ normalized, seed: reviewInputHash, rootFields: merged.rootFields, evidenceId, reviewId: id, predecessorReview, contract });
  const fields = {
    artifact: "work-review", schema: 6, id, status: "complete", root_plan_id: merged.rootFields.id,
    latest_evidence_id: evidenceId, outcome: outcome.outcome, next_action: outcome.next_action,
    correction_id: correction?.correction_id ?? null, predecessor_review_id: predecessorReviewId,
    inspected_objectives: coverage.inspectedObjectives, reused_objectives: coverage.reusedObjectives,
    inspected_checks: coverage.inspectedChecks, reused_checks: coverage.reusedChecks,
    findings: normalized.findings, open_points: normalized.open_points,
  };
  const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${reviewBody({ normalized, outcome, coverage, evidenceId, correction })}\n`;
  const duplicate = merged.entries.find((entry) => entry.label === id);
  if (duplicate && duplicate.text !== artifact) throw new Error(`review builder generated conflicting immutable bytes for ${id}`);
  const finalEntries = duplicate ? merged.entries : [...merged.entries, { label: id, text: artifact }];
  const validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join(";")}`);
  const artifactHash = sha256(artifact);
  return {
    duplicate: Boolean(duplicate), artifact, artifact_hash: artifactHash, review_input_hash: reviewInputHash, fields,
    normalized_review_input: normalized, outcome, provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: reviewInputHash, artifact_hash: artifactHash },
  };
}

export function persistWorkReview({ handoffStore, rootPlanText, artifacts = [], review }) {
  if (!review?.artifact || !review?.fields?.id || !review?.provenance) throw new Error("persistWorkReview requires one generated work-review");
  try {
    const byId = new Map();
    for (const entry of [{ label: review.fields.root_plan_id, text: rootPlanText }, ...artifacts, { label: review.fields.id, text: review.artifact, provenance: review.provenance }]) {
      const inspected = inspectArtifactText(entry.text, handoffStore.pluginRoot);
      const id = inspected.artifact?.fields?.id ?? entry.label;
      const prior = byId.get(id);
      if (prior && prior.text !== entry.text) throw new Error(`work-review persistence found conflicting immutable bytes for ${id}`);
      byId.set(id, { label: id, text: entry.text, ...(entry.provenance || entry.builder_provenance ? { provenance: entry.provenance ?? entry.builder_provenance } : prior?.provenance ? { provenance: prior.provenance } : {}) });
    }
    const persisted = handoffStore.record([...byId.values()]);
    return { ...review, handoff_persisted: true, handoff_authoritative: false, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return { ...review, handoff_persisted: false, handoff_authoritative: false, handoff_error_code: "handoff-persist-failed", warning: `optional cross-task review handoff unavailable: ${error.message}; task-local Review remains valid` };
  }
}
