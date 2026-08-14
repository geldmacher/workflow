import { createHash } from "node:crypto";
import { stringify } from "yaml";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
} from "../../scripts/validate-artifact.source.mjs";
import { rootContentHash } from "../core/state-paths.mjs";

const ASSESSMENTS = new Set([
  "achieved",
  "provisional",
  "mostly-achieved",
  "partially-achieved",
  "not-achieved",
  "insufficient-evidence",
]);
const ASSESSMENT_RANK = Object.freeze({
  "insufficient-evidence": 0,
  "not-achieved": 1,
  "partially-achieved": 2,
  "mostly-achieved": 3,
  provisional: 4,
  achieved: 5,
});
const ACTIONS = new Set(["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const RESOLUTIONS = new Set(["correct", "clarify", "replan"]);
const SNAPSHOT_ASSESSMENTS = new Set(["consistent", "contradicted", "incomplete"]);
const AUDITOR_ROLES = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);
const COSTS = new Set(["cheap", "standard", "expensive"]);
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function compareCanonical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
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

function requiredField(value, key, label = "review_input") {
  if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${label}.${key} is required`);
  return value[key];
}

function line(value, label, { required = true, max = 2_000 } = {}) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters`);
  return normalized;
}

function enumValue(value, values, label) {
  const normalized = String(value ?? "").trim();
  if (!values.has(normalized)) throw new Error(`${label} has invalid value ${normalized || "<missing>"}`);
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

function normalizeIds(value, pattern, allowed, label) {
  const normalized = uniqueSorted(list(value, label, { required: true }).map((entry) => line(entry, label, { max: 80 })));
  for (const id of normalized) {
    if (!pattern.test(id) || !allowed.has(id)) throw new Error(`${label} contains unknown ${id}`);
  }
  return normalized;
}

function localKey(value, label) {
  const normalized = line(value, label, { max: 80 });
  if (!KEY.test(normalized)) throw new Error(`${label} must be a lowercase semantic key`);
  return normalized;
}

function normalizeFindings(value, contract) {
  const objectiveIds = new Set(contract.objectives);
  const checkIds = new Set(contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]));
  const findings = list(value, "review_input.findings", { max: 32 }).map((entry, index) => {
    const item = object(entry, `review_input.findings[${index}]`);
    closed(item, ["key", "severity", "objective_ids", "check_ids", "evidence", "reasoning", "resolution"], `review_input.findings[${index}]`);
    return {
      key: localKey(item.key, `review_input.findings[${index}].key`),
      severity: enumValue(item.severity, SEVERITIES, `review_input.findings[${index}].severity`),
      objective_ids: normalizeIds(item.objective_ids, /^OBJ-[1-9][0-9]*$/, objectiveIds, `review_input.findings[${index}].objective_ids`),
      check_ids: normalizeIds(item.check_ids, /^CHECK-[1-9][0-9]*$/, checkIds, `review_input.findings[${index}].check_ids`),
      evidence: line(item.evidence, `review_input.findings[${index}].evidence`, { max: 4_000 }),
      reasoning: line(item.reasoning, `review_input.findings[${index}].reasoning`, { max: 4_000 }),
      resolution: enumValue(item.resolution, RESOLUTIONS, `review_input.findings[${index}].resolution`),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(findings.map((finding) => finding.key)).size !== findings.length) throw new Error("review_input.findings keys must be unique");
  return findings;
}

function normalizeAuditors(value) {
  const reports = list(value, "review_input.auditor_reports", { max: 3 }).map((entry, index) => {
    const item = object(entry, `review_input.auditor_reports[${index}]`);
    closed(item, ["role", "assessment", "summary"], `review_input.auditor_reports[${index}]`);
    return {
      role: enumValue(item.role, AUDITOR_ROLES, `review_input.auditor_reports[${index}].role`),
      assessment: enumValue(item.assessment, ASSESSMENTS, `review_input.auditor_reports[${index}].assessment`),
      summary: line(item.summary, `review_input.auditor_reports[${index}].summary`, { max: 2_000 }),
    };
  }).sort((left, right) => compareCanonical(left.role, right.role));
  if (new Set(reports.map((report) => report.role)).size !== reports.length) throw new Error("review_input.auditor_reports roles must be unique");
  return reports;
}

function normalizeCorrection(value, findingKeys) {
  if (value == null) return null;
  const correction = object(value, "review_input.correction");
  closed(correction, ["fixes", "steps", "checks", "learning_candidates"], "review_input.correction");
  const fixes = list(correction.fixes, "review_input.correction.fixes", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.fixes[${index}]`);
    closed(item, ["key", "finding_keys", "required_outcome", "evidence"], `review_input.correction.fixes[${index}]`);
    const keys = uniqueSorted(list(item.finding_keys, `review_input.correction.fixes[${index}].finding_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.fixes[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.fixes[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.fixes[${index}].key`),
      finding_keys: keys,
      required_outcome: line(item.required_outcome, `review_input.correction.fixes[${index}].required_outcome`, { max: 2_000 }),
      evidence: line(item.evidence, `review_input.correction.fixes[${index}].evidence`, { max: 2_000 }),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  const fixKeys = new Set(fixes.map((fix) => fix.key));
  if (fixKeys.size !== fixes.length) throw new Error("review_input.correction.fixes keys must be unique");

  const checks = list(correction.checks, "review_input.correction.checks", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.checks[${index}]`);
    closed(item, ["key", "fix_keys", "working_directory", "command_or_inspection", "expected_result", "required", "cost_class", "prerequisites"], `review_input.correction.checks[${index}]`);
    const referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.checks[${index}].fix_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.checks[${index}].fix_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.checks[${index}] references an unknown fix`);
    const prerequisites = uniqueSorted(list(item.prerequisites, `review_input.correction.checks[${index}].prerequisites`, { required: true }).map((entryValue) => line(entryValue, `review_input.correction.checks[${index}].prerequisites`, { max: 1_000 })));
    if (typeof item.required !== "boolean") throw new Error(`review_input.correction.checks[${index}].required must be a boolean`);
    return {
      key: localKey(item.key, `review_input.correction.checks[${index}].key`),
      fix_keys: referencedFixes,
      working_directory: line(item.working_directory, `review_input.correction.checks[${index}].working_directory`, { max: 1_000 }),
      command_or_inspection: line(item.command_or_inspection, `review_input.correction.checks[${index}].command_or_inspection`, { max: 2_000 }),
      expected_result: line(item.expected_result, `review_input.correction.checks[${index}].expected_result`, { max: 2_000 }),
      required: item.required,
      cost_class: enumValue(item.cost_class, COSTS, `review_input.correction.checks[${index}].cost_class`),
      prerequisites,
    };
  }).sort((left, right) => ({ cheap: 0, standard: 1, expensive: 2 }[left.cost_class] - { cheap: 0, standard: 1, expensive: 2 }[right.cost_class]) || compareCanonical(left.key, right.key));
  const checkKeys = new Set(checks.map((check) => check.key));
  if (checkKeys.size !== checks.length) throw new Error("review_input.correction.checks keys must be unique");

  const steps = list(correction.steps, "review_input.correction.steps", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.steps[${index}]`);
    closed(item, ["key", "fix_keys", "targets", "required_outcome", "implementation_latitude", "completion_probe", "check_keys", "deviation_action"], `review_input.correction.steps[${index}]`);
    const referencedFixes = uniqueSorted(list(item.fix_keys, `review_input.correction.steps[${index}].fix_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.steps[${index}].fix_keys`)));
    const referencedChecks = uniqueSorted(list(item.check_keys, `review_input.correction.steps[${index}].check_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.steps[${index}].check_keys`)));
    if (referencedFixes.some((key) => !fixKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown fix`);
    if (referencedChecks.some((key) => !checkKeys.has(key))) throw new Error(`review_input.correction.steps[${index}] references an unknown check`);
    return {
      key: localKey(item.key, `review_input.correction.steps[${index}].key`),
      fix_keys: referencedFixes,
      targets: uniqueSorted(list(item.targets, `review_input.correction.steps[${index}].targets`, { required: true }).map((target) => line(target, `review_input.correction.steps[${index}].targets`, { max: 1_000 }))),
      required_outcome: line(item.required_outcome, `review_input.correction.steps[${index}].required_outcome`, { max: 2_000 }),
      implementation_latitude: line(item.implementation_latitude, `review_input.correction.steps[${index}].implementation_latitude`, { max: 2_000 }),
      completion_probe: line(item.completion_probe, `review_input.correction.steps[${index}].completion_probe`, { max: 2_000 }),
      check_keys: referencedChecks,
      deviation_action: line(item.deviation_action, `review_input.correction.steps[${index}].deviation_action`, { max: 2_000 }),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  const stepKeys = new Set(steps.map((step) => step.key));
  if (stepKeys.size !== steps.length) throw new Error("review_input.correction.steps keys must be unique");
  for (const fix of fixKeys) if (!steps.some((step) => step.fix_keys.includes(fix))) throw new Error(`review_input.correction.steps do not cover ${fix}`);

  const learningCandidates = list(correction.learning_candidates, "review_input.correction.learning_candidates", { max: 32, required: true }).map((entry, index) => {
    const item = object(entry, `review_input.correction.learning_candidates[${index}]`);
    closed(item, ["key", "finding_keys", "reusable_guidance", "candidate_targets", "confirmation_evidence"], `review_input.correction.learning_candidates[${index}]`);
    const keys = uniqueSorted(list(item.finding_keys, `review_input.correction.learning_candidates[${index}].finding_keys`, { required: true }).map((key) => localKey(key, `review_input.correction.learning_candidates[${index}].finding_keys`)));
    if (keys.some((key) => !findingKeys.has(key))) throw new Error(`review_input.correction.learning_candidates[${index}] references an unknown finding`);
    return {
      key: localKey(item.key, `review_input.correction.learning_candidates[${index}].key`),
      finding_keys: keys,
      reusable_guidance: line(item.reusable_guidance, `review_input.correction.learning_candidates[${index}].reusable_guidance`, { max: 2_000 }),
      candidate_targets: uniqueSorted(list(item.candidate_targets, `review_input.correction.learning_candidates[${index}].candidate_targets`, { required: true }).map((target) => line(target, `review_input.correction.learning_candidates[${index}].candidate_targets`, { max: 1_000 }))),
      confirmation_evidence: line(item.confirmation_evidence, `review_input.correction.learning_candidates[${index}].confirmation_evidence`, { max: 2_000 }),
    };
  }).sort((left, right) => compareCanonical(left.key, right.key));
  if (new Set(learningCandidates.map((candidate) => candidate.key)).size !== learningCandidates.length) throw new Error("review_input.correction.learning_candidates keys must be unique");
  return { fixes, checks, steps, learning_candidates: learningCandidates };
}

export function normalizeReviewInput(input, contract) {
  const value = object(input, "review_input");
  closed(value, ["schema", "kind", "assessment", "recommended_action", "assessment_summary", "snapshot_assessment", "snapshot_summary", "findings", "missing_evidence", "auditor_reports", "correction"], "review_input");
  if (value.schema !== 1) throw new Error("review_input.schema must be 1");
  if (value.kind !== "review-input") throw new Error("review_input.kind must be review-input");
  const findings = normalizeFindings(requiredField(value, "findings"), contract);
  const findingKeys = new Set(findings.map((finding) => finding.key));
  const normalized = {
    schema: 1,
    kind: "review-input",
    assessment: enumValue(requiredField(value, "assessment"), ASSESSMENTS, "review_input.assessment"),
    recommended_action: enumValue(requiredField(value, "recommended_action"), ACTIONS, "review_input.recommended_action"),
    assessment_summary: line(requiredField(value, "assessment_summary"), "review_input.assessment_summary", { max: 2_000 }),
    snapshot_assessment: enumValue(requiredField(value, "snapshot_assessment"), SNAPSHOT_ASSESSMENTS, "review_input.snapshot_assessment"),
    snapshot_summary: line(requiredField(value, "snapshot_summary"), "review_input.snapshot_summary", { max: 2_000 }),
    findings,
    missing_evidence: uniqueSorted(list(requiredField(value, "missing_evidence"), "review_input.missing_evidence", { max: 32 }).map((entry) => line(entry, "review_input.missing_evidence", { max: 2_000 }))),
    auditor_reports: normalizeAuditors(requiredField(value, "auditor_reports")),
    correction: normalizeCorrection(value.correction, findingKeys),
  };
  if (normalized.recommended_action === "correct") {
    if (normalized.findings.length === 0) throw new Error("review_input correct requires at least one finding");
    if (!normalized.correction) throw new Error("review_input correct requires a correction proposal");
  } else if (normalized.correction) {
    throw new Error("review_input.correction is allowed only for recommended_action correct");
  }
  return normalized;
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

function mergeChain(rootPlanText, artifacts, pluginRoot) {
  const rootInspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (rootInspection.errors.length > 0 || rootInspection.artifact?.fields?.artifact !== "work-plan" || rootInspection.artifact.fields.schema !== 5) {
    throw new Error(`review builder requires an exact valid Schema-5 Root: ${rootInspection.errors.join("; ") || "not a work-plan"}`);
  }
  const byId = new Map([[rootInspection.artifact.fields.id, { label: rootInspection.artifact.fields.id, text: rootPlanText }]]);
  for (const [index, entry] of (artifacts ?? []).entries()) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) throw new Error(`review builder artifact ${index + 1} requires exact text`);
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`review builder artifact ${entry.label ?? index + 1} is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const builderProvenance = entry.builder_provenance ?? entry.provenance ?? null;
    const protectedLegacyReview = entry.legacy_review_recorded === true;
    if (inspected.artifact.fields.artifact === "work-review") {
      const validBuilderProvenance = builderProvenance?.schema === 1
        && builderProvenance?.kind === "host-work-review-builder"
        && /^[a-f0-9]{64}$/.test(String(builderProvenance?.review_input_hash ?? ""))
        && builderProvenance?.artifact_hash === sha256(entry.text)
        && Object.keys(builderProvenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
      if (builderProvenance && !validBuilderProvenance) {
        throw codedError("review-artifact-rejected", `review builder artifact ${id} has invalid host builder provenance`);
      }
      if (!validBuilderProvenance && !protectedLegacyReview) {
        throw codedError("review-artifact-rejected", `review builder rejects newly imported work-review ${id} without protected builder provenance; Root, Evidence, and repository work remain unchanged, so repeat Review from the exact Root/Evidence chain in this task`);
      }
    }
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`review builder artifact ${id} has conflicting immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...(builderProvenance ? { builder_provenance: builderProvenance } : {}),
      ...(protectedLegacyReview ? { legacy_review_recorded: true } : {}),
    });
  }
  return { rootFields: rootInspection.artifact.fields, entries: [...byId.values()] };
}

function knownFailure(evidence) {
  return evidence?.fields?.status === "blocked" || (evidence?.fields?.check_evidence ?? []).some((entry) => entry.grade === "failed");
}

function decision(input, evidence) {
  for (const report of input.auditor_reports) {
    if (ASSESSMENT_RANK[report.assessment] < ASSESSMENT_RANK[input.assessment]) {
      throw new Error(`review_input.assessment ${input.assessment} is more positive than review_input.auditor_reports ${report.role} assessment ${report.assessment}`);
    }
  }
  const failed = knownFailure(evidence);
  const reviewReady = evidence?.effective?.reviewReady === true && evidence?.fields?.status === "complete";
  const hasFindings = input.findings.length > 0;
  const missing = input.missing_evidence.length > 0 || input.snapshot_assessment !== "consistent";
  let assessment = input.assessment;
  let nextAction = input.recommended_action;
  let deliveryStatus = "blocked";

  if (failed) {
    if (nextAction === "replan" || nextAction === "clarify") {
      assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment;
    } else if (hasFindings && input.correction) {
      nextAction = "correct";
      assessment = ["achieved", "provisional"].includes(assessment) ? "not-achieved" : assessment;
    } else {
      nextAction = "retry-review";
      assessment = "insufficient-evidence";
    }
    return { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: true };
  }
  if (nextAction === "replan" || nextAction === "clarify") {
    assessment = ["achieved", "provisional"].includes(assessment) ? "partially-achieved" : assessment;
    return { assessment, delivery_status: "blocked", next_action: nextAction, review_ready: reviewReady, known_failure: false };
  }
  if (nextAction === "correct" || hasFindings) {
    if (!input.correction || !hasFindings) throw new Error("review findings requiring correction need one complete correction proposal");
    assessment = ["achieved", "provisional"].includes(assessment) ? "mostly-achieved" : assessment;
    return { assessment, delivery_status: "blocked", next_action: "correct", review_ready: reviewReady, known_failure: false };
  }
  if (missing || nextAction === "retry-review" || assessment === "insufficient-evidence") {
    return { assessment: "insufficient-evidence", delivery_status: "blocked", next_action: "retry-review", review_ready: reviewReady, known_failure: false };
  }
  if (reviewReady && assessment === "achieved" && nextAction === "none") {
    return { assessment: "achieved", delivery_status: "verified", next_action: "none", review_ready: true, known_failure: false };
  }
  if (!["none", "accept-provisional"].includes(nextAction)) throw new Error(`review_input recommended_action ${nextAction} is inconsistent with an evidence-only provisional result`);
  if (!["achieved", "provisional"].includes(assessment)) {
    throw new Error(`review_input.assessment ${assessment} is inconsistent with review_input.recommended_action ${nextAction}; provide the missing Evidence or choose correct, clarify, replan, or retry-review`);
  }
  return { assessment: "provisional", delivery_status: "provisional", next_action: "accept-provisional", review_ready: reviewReady, known_failure: false };
}

function routeFor(rootFields, input, outcome) {
  const roles = new Set(input.auditor_reports.map((report) => report.role));
  const deterministicBlocked = outcome.delivery_status === "blocked" && (outcome.next_action === "replan" || (outcome.next_action === "correct" && outcome.known_failure));
  const fullRequired = rootFields.contract_level === "certified" || rootFields.risk === "high" || (rootFields.hard_triggers ?? []).length > 0;
  if (roles.has("risk-auditor")) {
    if (!roles.has("delivery-auditor")) throw new Error("risk-auditor review input also requires delivery-auditor input");
    return { review_route: "full", auditors_run: ["inline", "delivery-auditor", "risk-auditor", ...(roles.has("work-design-auditor") ? ["work-design-auditor"] : [])] };
  }
  if (fullRequired && !deterministicBlocked) throw new Error("certified, high-risk, or hard-trigger review requires delivery-auditor and risk-auditor reports");
  if (roles.has("delivery-auditor")) return { review_route: "targeted", auditors_run: ["inline", "delivery-auditor"] };
  if (roles.has("work-design-auditor")) return { review_route: "targeted", auditors_run: ["inline", "work-design-auditor"] };
  return { review_route: "inline", auditors_run: ["inline"] };
}

function cell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
  return text || "none";
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${headers.map((header) => cell(row[header])).join(" | ")} |`),
  ].join("\n");
}

function nextCheckNumber(entries, pluginRoot) {
  let maximum = 0;
  for (const entry of entries) {
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    const matches = entry.text.match(/\bCHECK-([1-9][0-9]*)\b/g) ?? [];
    for (const match of matches) maximum = Math.max(maximum, Number(match.slice(6)));
    if (inspected.errors.length > 0) continue;
  }
  return maximum + 1;
}

function correctionProjection({ normalized, findings, seed, rootFields, evidenceId, reviewId, predecessorReview, entries, pluginRoot }) {
  if (!normalized.correction) return null;
  const correctionId = `cp-${rootFields.id.replace(/^wp-/, "")}-${seed.slice(0, 12)}`;
  const fixIds = new Map(normalized.correction.fixes.map((fix, index) => [fix.key, `FIX-${index + 1}`]));
  const stepIds = new Map(normalized.correction.steps.map((step, index) => [step.key, `STEP-${index + 1}`]));
  const checkStart = nextCheckNumber(entries, pluginRoot);
  const checkIds = new Map(normalized.correction.checks.map((check, index) => [check.key, `CHECK-${checkStart + index}`]));
  const learningIds = new Map(normalized.correction.learning_candidates.map((candidate, index) => [candidate.key, `LRN-${seed.slice(0, 8)}-${index + 1}`]));
  const findingsByKey = new Map(findings.map((finding) => [finding.key, finding]));
  const fixes = normalized.correction.fixes.map((fix) => {
    const mapped = fix.finding_keys.map((key) => findingsByKey.get(key));
    return {
      "FIX ID": fixIds.get(fix.key),
      "Finding keys": fix.finding_keys.join(", "),
      "Root Objectives": uniqueSorted(mapped.flatMap((finding) => finding.objective_ids)).join(", "),
      "Root Checks": uniqueSorted(mapped.flatMap((finding) => finding.check_ids)).join(", "),
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
    "Check IDs": step.check_keys.map((key) => checkIds.get(key)).join(", "),
    "Deviation action": step.deviation_action,
  }));
  const checks = normalized.correction.checks.map((check) => ({
    "Check ID": checkIds.get(check.key),
    "FIX IDs": check.fix_keys.map((key) => fixIds.get(key)).join(", "),
    "Working Directory": check.working_directory,
    "Command or Inspection": check.command_or_inspection,
    "Expected Result": check.expected_result,
    Required: check.required ? "yes" : "no",
    "Cost Class": check.cost_class,
    Prerequisites: check.prerequisites.join(", "),
  }));
  const learnings = normalized.correction.learning_candidates.map((candidate) => ({
    "Learning ID": learningIds.get(candidate.key),
    "Finding keys": candidate.finding_keys.join(", "),
    "Reusable guidance": candidate.reusable_guidance,
    "Candidate targets": candidate.candidate_targets.join(", "),
    "Confirmation evidence": candidate.confirmation_evidence,
  }));
  const predecessorCorrection = predecessorReview?.fields?.correction_id ?? "None.";
  const body = [
    `## Correction plan\n\n### ${correctionId}`,
    table(["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"], [{
      "Correction ID": correctionId,
      "Root Plan": rootFields.id,
      "Source Review": reviewId,
      "Base Evidence": evidenceId,
      "Predecessor Correction": predecessorCorrection,
      Risk: rootFields.risk,
    }]),
    table(["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"], fixes),
    table(["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"], steps),
    table(["Check ID", "FIX IDs", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"], checks),
    table(["Learning ID", "Finding keys", "Reusable guidance", "Candidate targets", "Confirmation evidence"], learnings),
  ].join("\n\n");
  return { correction_id: correctionId, learning_ids: [...learningIds.values()], body };
}

function reviewBody({ normalized, outcome, route, coverage, evidenceId, correction }) {
  const sections = [
    `## Assessment\n\n${outcome.assessment}: ${normalized.assessment_summary}`,
    `## Evidence coverage\n\n${table(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: coverage.inspectedObjectives.join(", ") || "none", Reused: coverage.reusedObjectives.join(", ") || "none", Result: outcome.assessment, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Checks", Inspected: coverage.inspectedChecks.join(", ") || "none", Reused: coverage.reusedChecks.join(", ") || "none", Result: outcome.delivery_status === "verified" ? "passed" : outcome.delivery_status, Evidence: `exact Evidence ${evidenceId}` },
      { Kind: "Auditors", Inspected: route.auditors_run.join(", "), Reused: "none", Result: "complete", Evidence: "validated review input" },
      { Kind: "Snapshot", Inspected: evidenceId, Reused: "none", Result: normalized.snapshot_assessment, Evidence: normalized.snapshot_summary },
    ])}`,
    normalized.findings.length === 0
      ? "## Findings\n\nNone."
      : `## Findings\n\n${table(["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning"], normalized.findings.map((finding) => ({
        "Finding key": finding.key,
        Severity: finding.severity,
        Objectives: finding.objective_ids.join(", "),
        Checks: finding.check_ids.join(", "),
        Evidence: finding.evidence,
        Reasoning: finding.reasoning,
      })))}`,
    `## Next action\n\n${outcome.next_action}: ${outcome.next_action === "none" ? "No further Workflow action is required." : `Continue through the bounded ${outcome.next_action} route in this task.`}`,
  ];
  if (correction) sections.push(correction.body);
  return sections.join("\n\n");
}

function boundaryBody(receipt) {
  return [
    "## Assessment\n\ninsufficient-evidence: deterministic Evidence recovery is unavailable for the exact current boundary.",
    `## Evidence coverage\n\n${table(["Kind", "Inspected", "Reused", "Result", "Evidence"], [
      { Kind: "Objectives", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Checks", Inspected: "none", Reused: "none", Result: "blocked", Evidence: "protected root-boundary receipt" },
      { Kind: "Auditors", Inspected: "inline", Reused: "none", Result: "complete", Evidence: "host boundary validation" },
      { Kind: "Snapshot", Inspected: receipt.repository_snapshot_hash, Reused: "none", Result: "incomplete", Evidence: receipt.recovery_error_code },
    ])}`,
    "## Findings\n\nNone.",
    "## Next action\n\nreplan: create a fresh Root through separate human approval.",
  ].join("\n\n");
}

export function buildWorkReview({
  rootPlanText,
  artifacts = [],
  reviewInput = null,
  boundaryReceipt = null,
  boundaryReceiptVerifier = null,
  pluginRoot,
}) {
  const merged = mergeChain(rootPlanText, artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0 || contract.fields.schema !== 5) throw new Error(`review builder Root is invalid: ${contract.errors.join("; ")}`);
  const inspectionOptions = boundaryReceipt && typeof boundaryReceiptVerifier === "function" ? { boundaryReceiptVerifier } : {};
  const prior = inspectArtifactSet(merged.entries.map((entry) => [entry.label, entry.text]), pluginRoot, inspectionOptions);
  if (prior.errors.length > 0) throw new Error(`review builder input chain is invalid: ${prior.errors.join("; ")}`);
  const tips = effectiveCliSummary(prior);
  const predecessorReviewId = tips.review_tips[merged.rootFields.id] ?? null;
  const predecessorReview = predecessorReviewId ? prior.effective.get(predecessorReviewId) : null;
  const predecessorReviewText = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId)?.text ?? "" : "";

  if (boundaryReceipt) {
    if (typeof boundaryReceiptVerifier !== "function") throw new Error("root-boundary review requires a protected host verifier");
    const trusted = boundaryReceiptVerifier({ receipt: boundaryReceipt, rootPlanText, reviewFields: null });
    if (trusted?.ok !== true) throw new Error(`root-boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
    const seedInput = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      predecessor_review_id: predecessorReviewId,
      predecessor_review_hash: predecessorReviewText ? sha256(predecessorReviewText) : null,
      boundary_receipt: boundaryReceipt,
    };
    const reviewInputHash = sha256(stableJson(seedInput));
    const id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash.slice(0, 12)}`;
    const fields = {
      artifact: "work-review", schema: 5, id, status: "complete", root_plan_id: merged.rootFields.id,
      latest_evidence_id: null, review_basis: "root-boundary", boundary_receipt: boundaryReceipt,
      assessment: "insufficient-evidence", delivery_status: "blocked", review_route: "inline", next_action: "replan",
      correction_id: null, predecessor_review_id: predecessorReviewId,
      inspected_objectives: [], reused_objectives: [], inspected_checks: [], reused_checks: [], auditors_run: ["inline"],
    };
    const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${boundaryBody(boundaryReceipt)}\n`;
    const duplicate = merged.entries.find((entry) => entry.label === id);
    if (duplicate && duplicate.text !== artifact) throw new Error(`review builder generated conflicting immutable bytes for ${id}`);
    const finalEntries = duplicate ? merged.entries : [...merged.entries, { label: id, text: artifact }];
    const validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot, { boundaryReceiptVerifier });
    if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join("; ")}`);
    const artifactHash = sha256(artifact);
    return { duplicate: Boolean(duplicate), artifact, artifact_hash: artifactHash, review_input_hash: reviewInputHash, fields, provenance: { schema: 1, kind: "host-work-review-builder", review_input_hash: reviewInputHash, artifact_hash: artifactHash } };
  }

  const evidenceId = tips.evidence_tips[merged.rootFields.id] ?? null;
  if (!evidenceId) throw new Error("review builder requires the exact current Evidence tip");
  const evidence = prior.effective.get(evidenceId);
  const evidenceText = merged.entries.find((entry) => entry.label === evidenceId)?.text;
  if (!evidence || !evidenceText) throw new Error(`review builder cannot resolve exact Evidence ${evidenceId}`);
  let normalized;
  let outcome;
  let route;
  try {
    normalized = normalizeReviewInput(reviewInput, contract);
    outcome = decision(normalized, evidence);
    route = routeFor(merged.rootFields, normalized, outcome);
  } catch (error) {
    if (error?.code) throw error;
    throw codedError("review-input-invalid", error?.message ?? "review_input is invalid");
  }
  const currentReviewEntry = predecessorReviewId ? merged.entries.find((entry) => entry.label === predecessorReviewId) : null;
  const currentProvenance = currentReviewEntry?.builder_provenance;
  if (currentProvenance?.schema === 1
    && currentProvenance?.kind === "host-work-review-builder"
    && currentProvenance?.artifact_hash === sha256(currentReviewEntry.text)
    && predecessorReview?.fields?.latest_evidence_id === evidenceId) {
    const priorPredecessorId = predecessorReview.fields.predecessor_review_id ?? null;
    const priorPredecessorText = priorPredecessorId ? merged.entries.find((entry) => entry.label === priorPredecessorId)?.text ?? "" : "";
    const retrySeed = {
      schema: 1,
      root_content_hash: rootContentHash(rootPlanText),
      root_projection_hash: contract.authoritative_projection_hash,
      evidence_id: evidenceId,
      evidence_hash: sha256(evidenceText),
      predecessor_review_id: priorPredecessorId,
      predecessor_review_hash: priorPredecessorText ? sha256(priorPredecessorText) : null,
      auditors_run: route.auditors_run,
      review_input: normalized,
    };
    const retryInputHash = sha256(stableJson(retrySeed));
    if (retryInputHash === currentProvenance.review_input_hash
      && predecessorReviewId === `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${retryInputHash.slice(0, 12)}`) {
      return {
        duplicate: true,
        artifact: currentReviewEntry.text,
        artifact_hash: currentProvenance.artifact_hash,
        review_input_hash: retryInputHash,
        fields: predecessorReview.fields,
        normalized_review_input: normalized,
        outcome,
        provenance: currentProvenance,
      };
    }
  }
  const rootChecks = contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]);
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
    auditors_run: route.auditors_run,
    review_input: normalized,
  };
  const reviewInputHash = sha256(stableJson(seedInput));
  const id = `wr-${merged.rootFields.id.replace(/^wp-/, "")}-${reviewInputHash.slice(0, 12)}`;
  const correction = correctionProjection({ normalized, findings: normalized.findings, seed: reviewInputHash, rootFields: merged.rootFields, evidenceId, reviewId: id, predecessorReview, entries: merged.entries, pluginRoot });
  const fields = {
    artifact: "work-review", schema: 5, id, status: "complete", root_plan_id: merged.rootFields.id,
    latest_evidence_id: evidenceId, assessment: outcome.assessment, delivery_status: outcome.delivery_status,
    review_route: route.review_route, next_action: outcome.next_action,
    correction_id: correction?.correction_id ?? null, predecessor_review_id: predecessorReviewId,
    auditors_run: route.auditors_run,
    inspected_objectives: coverage.inspectedObjectives, reused_objectives: coverage.reusedObjectives,
    inspected_checks: coverage.inspectedChecks, reused_checks: coverage.reusedChecks,
    ...(correction ? { learning_candidates: correction.learning_ids } : {}),
  };
  const artifact = `---\n${stringify(fields, { lineWidth: 0 }).trimEnd()}\n---\n\n${reviewBody({ normalized, outcome, route, coverage, evidenceId, correction })}\n`;
  const duplicate = merged.entries.find((entry) => entry.label === id);
  if (duplicate && duplicate.text !== artifact) throw new Error(`review builder generated conflicting immutable bytes for ${id}`);
  const finalEntries = duplicate ? merged.entries : [...merged.entries, { label: id, text: artifact }];
  const validated = inspectArtifactSet(finalEntries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (validated.errors.length > 0) throw new Error(`generated work-review is invalid: ${validated.errors.join("; ")}`);
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
      byId.set(id, {
        label: id,
        text: entry.text,
        ...(entry.provenance || entry.builder_provenance ? { provenance: entry.provenance ?? entry.builder_provenance } : prior?.provenance ? { provenance: prior.provenance } : {}),
      });
    }
    const persisted = handoffStore.record([...byId.values()]);
    return { ...review, handoff_persisted: true, handoff_authoritative: false, artifact_set_hash: persisted.artifact_set_hash };
  } catch (error) {
    return {
      ...review,
      handoff_persisted: false,
      handoff_authoritative: false,
      handoff_error_code: "handoff-persist-failed",
      warning: `optional cross-task review handoff unavailable: ${error.message}; task-local Review remains valid`,
    };
  }
}
