/**
 * Host-neutral Manual closeout attestation.
 * Typed plan/delivery reports and MCP structuredContent are authoritative.
 * Free-form marker prose and prose de-* scanning are not accepted.
 */

import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";

export const PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "delivery-closeout",
});

export const LEGACY_PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "workflow_closeout",
});

export const CLOSEOUT_INPUT_KIND = "closeout-input";
export const CLOSEOUT_INPUT_PHASES = Object.freeze([
  "implementation",
  "correction",
  "review-recovery",
]);

export const DELIVERY_REPORT_KIND = "delivery-report";
export const WORKFLOW_ATTESTATION_FENCE = "yaml workflow-attestation";

const EVIDENCE_ID = /^de-[A-Za-z0-9][A-Za-z0-9-]*$/;
const ROOT_ID = /^wp-[A-Za-z0-9][A-Za-z0-9-]*$/;
const CORRECTION_ID = /^cp-[A-Za-z0-9][A-Za-z0-9-]*$/;
const REVIEW_ID = /^wr-[A-Za-z0-9][A-Za-z0-9-]*$/;
const FINAL_STEP_HEADING = /^##\s+Final implementation step\s*$/im;
const ATTESTATION_FENCE_OPEN = /^```yaml workflow-attestation\s*$/;
const ATTESTATION_FENCE_CLOSE = /^```\s*$/;
const BACKTICK_FENCE_OPEN = /^```(?:ya?ml|markdown|md)?\s*$/i;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sha256RawUtf8(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

export function isPlanCloseoutAttestation(value) {
  const object = asObject(value);
  if (!object) return false;
  return object.schema === PLAN_CLOSEOUT_ATTESTATION.schema
    && object.kind === PLAN_CLOSEOUT_ATTESTATION.kind
    && [PLAN_CLOSEOUT_ATTESTATION.action, LEGACY_PLAN_CLOSEOUT_ATTESTATION.action].includes(object.action)
    && Object.keys(object).length === 3;
}

const CLOSEOUT_INPUT_FIELDS = Object.freeze([
  "schema",
  "kind",
  "phase",
  "root_plan_id",
  "strategy_revision",
  "changed_paths",
  "check_evidence",
  "summary",
]);

const CHECK_EVIDENCE_FIELDS = Object.freeze([
  "check_id",
  "feature_id",
  "grade",
  "surface",
  "method",
  "expected",
  "observed",
  "repetitions",
  "limitations",
]);

const CHECK_ID = /^CHECK-[1-9][0-9]*$/;
const EVIDENCE_GRADES = new Set(["verified", "supported", "partial", "unavailable", "failed"]);

function exactKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function isSafeRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function validateCloseoutCheckEvidence(entries, issues) {
  if (!Array.isArray(entries) || entries.length === 0) {
    issues.push("closeout-input check_evidence must be a non-empty array");
    return;
  }
  if (entries.length > 128) issues.push("closeout-input check_evidence must contain at most 128 entries");
  const ids = new Set();
  for (const [index, entry] of entries.entries()) {
    const object = asObject(entry);
    if (!object) {
      issues.push(`closeout-input check_evidence[${index}] must be an object`);
      continue;
    }
    const unknown = exactKeys(object, CHECK_EVIDENCE_FIELDS);
    if (unknown.length > 0) issues.push(`closeout-input check_evidence[${index}] has unknown fields: ${unknown.join(", ")}`);
    if (!CHECK_ID.test(String(object.check_id ?? ""))) {
      issues.push(`closeout-input check_evidence[${index}] requires a valid CHECK-* check_id`);
    } else if (ids.has(object.check_id)) {
      issues.push(`closeout-input check_evidence contains duplicate ${object.check_id}`);
    } else {
      ids.add(object.check_id);
    }
    if (!EVIDENCE_GRADES.has(object.grade)) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} has an invalid grade`);
    }
    if (typeof object.observed !== "string" || object.observed.trim().length === 0 || object.observed.length > 10_000) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} requires a non-empty observed result`);
    }
    if (!Number.isInteger(object.repetitions) || object.repetitions < 0) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} requires non-negative integer repetitions`);
    }
    for (const field of ["feature_id", "surface", "method", "expected"]) {
      if (Object.prototype.hasOwnProperty.call(object, field) && object[field] !== null && typeof object[field] !== "string") {
        issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} ${field} must be a string or null`);
      }
    }
    if (["feature_id", "surface", "method", "expected"].some((field) => typeof object[field] === "string" && object[field].length > 10_000)) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} string fields must not exceed 10000 characters`);
    }
    for (const field of ["limitations"]) {
      if (Object.prototype.hasOwnProperty.call(object, field) && !Array.isArray(object[field])) {
        issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} ${field} must be an array`);
      }
    }
    if (Array.isArray(object.limitations) && object.limitations.some((item) => typeof item !== "string" || !item.trim())) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} limitations must contain non-empty strings`);
    }
    if (Array.isArray(object.limitations) && (object.limitations.length > 64 || object.limitations.some((item) => item.length > 2_000))) {
      issues.push(`closeout-input ${object.check_id ?? `check_evidence[${index}]`} limitations exceed the bounded report size`);
    }
  }
}

export function validateCloseoutInput(value) {
  const report = asObject(value);
  const issues = [];
  if (!report) return { ok: false, issues: ["closeout-input must be an object"], report: null };
  const unknown = exactKeys(report, CLOSEOUT_INPUT_FIELDS);
  if (unknown.length > 0) issues.push(`closeout-input has unknown fields: ${unknown.join(", ")}`);
  if (report.schema !== 1) issues.push("closeout-input schema must be 1");
  if (report.kind !== CLOSEOUT_INPUT_KIND) issues.push("closeout-input kind must be closeout-input");
  if (!CLOSEOUT_INPUT_PHASES.includes(report.phase)) issues.push("closeout-input phase must be implementation, correction, or review-recovery");
  if (!ROOT_ID.test(String(report.root_plan_id ?? ""))) issues.push("closeout-input root_plan_id must be a valid wp-* ID");
  if (!Number.isInteger(report.strategy_revision) || report.strategy_revision < 0) {
    issues.push("closeout-input strategy_revision must be a non-negative integer");
  }
  if (Object.prototype.hasOwnProperty.call(report, "changed_paths") && !Array.isArray(report.changed_paths)) {
    issues.push("closeout-input changed_paths must be an array when supplied as a non-authoritative hint");
  } else if (Array.isArray(report.changed_paths)) {
    if (report.changed_paths.length > 1_000) issues.push("closeout-input changed_paths must contain at most 1000 entries");
    if (new Set(report.changed_paths).size !== report.changed_paths.length) issues.push("closeout-input changed_paths must be unique");
    if (report.changed_paths.some((path) => !isSafeRepositoryPath(path) || path.length > 1_000)) {
      issues.push("closeout-input changed_paths must contain normalized repository-relative paths");
    }
    if ([...report.changed_paths].sort().some((path, index) => path !== report.changed_paths[index])) {
      issues.push("closeout-input changed_paths must be sorted exactly");
    }
  }
  validateCloseoutCheckEvidence(report.check_evidence, issues);
  if (typeof report.summary !== "string" || report.summary.trim().length === 0 || report.summary.length > 2_000) {
    issues.push("closeout-input summary must be a concise non-empty string of at most 2000 characters");
  }
  if (issues.length > 0) return { ok: false, issues, report: null };
  return { ok: true, issues: [], report: structuredClone(report) };
}

export function parseCloseoutInput(text, { expectedPhase = null } = {}) {
  const source = normalizeNewlines(text);
  const attestations = extractWorkflowAttestations(source);
  const candidates = attestations.filter((entry) => entry.value?.kind === CLOSEOUT_INPUT_KIND);
  const issues = [];
  if (candidates.length !== 1) {
    issues.push("response must contain exactly one unindented yaml workflow-attestation closeout-input block");
  }
  const allOperative = attestations.filter((entry) => entry.value?.schema === 1);
  if (allOperative.length !== 1) {
    issues.push("response must not contain another operative Schema-1 workflow-attestation block");
  }
  let remainder = source;
  for (const entry of [...attestations].reverse()) {
    const lines = remainder.split("\n");
    remainder = [...lines.slice(0, entry.startLine), ...lines.slice(entry.endLine + 1)].join("\n");
  }
  if (
    /\b(?:do\s+not|don't|ignore|negate|skip)\b[\s\S]{0,120}\b(?:closeout-input|workflow-attestation)\b/i.test(remainder)
    || /\b(?:closeout-input|workflow-attestation)\b[\s\S]{0,120}\b(?:do\s+not|don't|ignore|negate|skip)\b/i.test(remainder)
    || /<!--[\s\S]*(?:closeout-input|workflow-attestation)[\s\S]*-->/i.test(source)
    || /~~[\s\S]*(?:closeout-input|workflow-attestation)[\s\S]*~~/i.test(source)
  ) {
    issues.push("response must not negate, comment out, or strike through the closeout-input attestation");
  }
  if (candidates.length === 1) {
    const validated = validateCloseoutInput(candidates[0].value);
    issues.push(...validated.issues);
    if (validated.ok && expectedPhase && validated.report.phase !== expectedPhase) {
      issues.push(`closeout-input phase must be ${expectedPhase}`);
    }
    if (issues.length === 0) return { ok: true, issues: [], report: validated.report };
  }
  return { ok: false, issues: [...new Set(issues)], report: null };
}

export function extractFinalImplementationStep(text) {
  const value = normalizeNewlines(text);
  const match = value.match(FINAL_STEP_HEADING);
  if (!match || match.index == null) return null;
  const start = match.index + match[0].length;
  const rest = value.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).replace(/^\n+/, "").replace(/\n+$/, "");
}

function countFinalImplementationSections(text) {
  return [...normalizeNewlines(text).matchAll(/^##\s+Final implementation step\s*$/gim)].length;
}

/**
 * Extract typed ```yaml workflow-attestation fences.
 * Only unindented opening fences are operative; tilde fences, indented code,
 * and attestation fences nested inside other backtick fences are ignored.
 */
export function extractWorkflowAttestations(text) {
  const lines = normalizeNewlines(text).split("\n");
  const attestations = [];
  let inForeignFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inForeignFence) {
      if (ATTESTATION_FENCE_CLOSE.test(line)) inForeignFence = false;
      continue;
    }
    if (/^```(?!yaml workflow-attestation\s*$)/.test(line)) {
      inForeignFence = true;
      continue;
    }
    if (!ATTESTATION_FENCE_OPEN.test(line)) continue;
    const body = [];
    let cursor = index + 1;
    let closed = false;
    while (cursor < lines.length) {
      if (ATTESTATION_FENCE_CLOSE.test(lines[cursor])) {
        closed = true;
        break;
      }
      body.push(lines[cursor]);
      cursor += 1;
    }
    if (!closed) continue;
    try {
      const parsed = parseYaml(body.join("\n"));
      if (asObject(parsed)) {
        attestations.push({
          value: parsed,
          startLine: index,
          endLine: cursor,
          raw: `${lines[index]}\n${body.join("\n")}\n${lines[cursor]}`,
        });
      }
    } catch {
      /* ignore malformed fences */
    }
    index = cursor;
  }
  return attestations;
}

export function parsePlanCloseoutAttestationFromText(text, { requireFinalStepSection = false, role = "instruction" } = {}) {
  let value = normalizeNewlines(text);
  if (requireFinalStepSection) {
    const sectionCount = countFinalImplementationSections(value);
    if (sectionCount === 0) {
      return { ok: false, issues: [`${role} must appear as an explicit ## Final implementation step section`] };
    }
    if (sectionCount > 1) {
      return { ok: false, issues: [`${role} must include exactly one ## Final implementation step section`] };
    }
    value = extractFinalImplementationStep(value) ?? "";
  }

  const attestations = extractWorkflowAttestations(value);
  const planCloseouts = attestations.filter((entry) => isPlanCloseoutAttestation(entry.value));
  const issues = [];
  if (planCloseouts.length === 0) {
    issues.push(`${role} must include exactly one unindented \`\`\`yaml workflow-attestation plan-closeout block`);
  } else if (planCloseouts.length > 1) {
    issues.push(`${role} must include exactly one plan-closeout attestation`);
  }

  // Reject leftover closeout marker/prose ceremony outside typed attestations.
  let remainder = value;
  for (const entry of [...attestations].reverse()) {
    const lines = remainder.split("\n");
    remainder = [...lines.slice(0, entry.startLine), ...lines.slice(entry.endLine + 1)].join("\n");
  }
  if (
    /\[workflow-closeout-v\d+\]/i.test(remainder)
    || /\bworkflow_closeout\b/.test(remainder)
    || /\bexact Root\/chain\b/i.test(remainder)
  ) {
    issues.push(`${role} must not include free-form closeout marker or workflow_closeout prose outside typed attestation`);
  }
  if (
    /\b(?:do\s+not|don't|does\s+not|shouldn'?t|ignore)\b[\s\S]{0,120}\b(?:attestation|closeout|workflow_closeout)\b/i.test(remainder)
    || /\b(?:attestation|closeout|workflow_closeout)\b[\s\S]{0,120}\b(?:do\s+not|don't|ignore)\b/i.test(remainder)
    || /<!--[\s\S]*workflow-attestation[\s\S]*-->/i.test(value)
    || /~~[\s\S]*workflow-attestation[\s\S]*~~/i.test(value)
  ) {
    issues.push(`${role} must not negate or comment out the typed plan-closeout attestation`);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, issues: [], attestation: planCloseouts[0]?.value ?? null };
}

export function todoPlanCloseoutIssues(todo, { role = "final native todo" } = {}) {
  const issues = [];
  if (!todo || typeof todo !== "object" || Array.isArray(todo)) {
    return [`${role} must be a structured native todo with typed workflow_attestation`];
  }
  const content = String(todo.content ?? "");
  if (!content.startsWith("[workflow-model-inherit-v1]")) {
    issues.push(`${role} must start with [workflow-model-inherit-v1]`);
  }
  if (!/verify|check|evidence|snapshot|close\s*out/i.test(content)) {
    issues.push(`${role} must verify or evidence the implemented result`);
  }
  if (/\[workflow-closeout-v\d+\]/i.test(content) || /\bworkflow_closeout\b/.test(content)) {
    issues.push(`${role} must keep closeout ceremony in workflow_attestation metadata, not todo prose`);
  }
  if (!isPlanCloseoutAttestation(todo.workflow_attestation)) {
    issues.push(`${role} requires workflow_attestation: { schema: 1, kind: plan-closeout, action: delivery-closeout }; legacy workflow_closeout remains accepted`);
  }
  return issues;
}

/** Compatibility helper used by CreatePlan validation and Codex planning Stop. */
export function planCloseoutAttestationIssues(source, options = {}) {
  const { role = "instruction", requireFinalStepSection = false } = options;
  if (asObject(source) && Object.prototype.hasOwnProperty.call(source, "workflow_attestation")) {
    return todoPlanCloseoutIssues(source, { role });
  }
  return parsePlanCloseoutAttestationFromText(String(source ?? ""), { role, requireFinalStepSection }).issues;
}

/**
 * Collect native structuredContent candidates only.
 * Top-level delivery fields, content[].text JSON, and tool_output strings never grant authority;
 * host adapters must unwrap transport before calling the kernel.
 */
export function collectCloseoutStructuredCandidates(response) {
  const candidates = [];
  if (asObject(response?.structuredContent)) candidates.push(response.structuredContent);
  if (Array.isArray(response?.content)) {
    for (const entry of response.content) {
      if (asObject(entry?.structuredContent)) candidates.push(entry.structuredContent);
    }
  }
  return candidates;
}

export function closeoutStructuredContent(response) {
  const candidates = collectCloseoutStructuredCandidates(response);
  if (candidates.length === 0) return null;
  const first = JSON.stringify(candidates[0]);
  if (candidates.some((entry) => JSON.stringify(entry) !== first)) return null;
  return candidates[0];
}

export function expectedLineageFromArtifacts(artifacts = [], rootPlanId = null, options = {}) {
  const inspect = options.inspectArtifactText;
  if (typeof inspect !== "function") {
    throw new Error("expectedLineageFromArtifacts requires options.inspectArtifactText");
  }
  let expectedSubject = rootPlanId;
  let sourceReviewId = null;
  let predecessorEvidenceId = null;
  const entries = Array.isArray(artifacts) ? artifacts : [];
  for (const entry of entries) {
    const text = typeof entry === "string" ? entry : entry?.text;
    if (typeof text !== "string") continue;
    const inspected = inspect(text, options.pluginRoot);
    const fields = inspected.artifact?.fields;
    // Tip discovery binds identity fields even when body validation reports non-identity issues.
    if (!fields) continue;
    if (fields.artifact === "work-review" && fields.next_action === "correct" && typeof fields.correction_id === "string") {
      expectedSubject = fields.correction_id;
      sourceReviewId = fields.id;
      if (typeof fields.latest_evidence_id === "string") predecessorEvidenceId = fields.latest_evidence_id;
    }
    if (fields.artifact === "delivery-evidence" && typeof fields.id === "string") {
      predecessorEvidenceId = fields.id;
    }
  }
  // Full-root topology when no correction tip is present: subject equals Root and lineage tips are null.
  if (!sourceReviewId) {
    return {
      root_plan_id: rootPlanId,
      subject_id: rootPlanId,
      source_review_id: null,
      predecessor_evidence_id: null,
    };
  }
  return {
    root_plan_id: rootPlanId,
    subject_id: expectedSubject,
    source_review_id: sourceReviewId,
    predecessor_evidence_id: predecessorEvidenceId,
  };
}

/**
 * Fail-closed closeout identity from structuredContent only.
 */
export function readCloseoutRecord(response, options = {}) {
  const candidates = collectCloseoutStructuredCandidates(response);
  if (candidates.length === 0) return { ok: false, reason: "missing-structured-content", record: null };
  const first = JSON.stringify(candidates[0]);
  if (candidates.some((entry) => JSON.stringify(entry) !== first)) {
    return { ok: false, reason: "conflicting-structured-content", record: null };
  }
  const structured = candidates[0];

  const id = typeof structured.delivery_evidence_id === "string" ? structured.delivery_evidence_id : "";
  if (!EVIDENCE_ID.test(id)) return { ok: false, reason: "invalid-delivery-evidence-id", record: null };

  const rawArtifact = typeof structured.artifact === "string" && structured.artifact.length > 0
    ? structured.artifact
    : null;
  if (!rawArtifact) return { ok: false, reason: "missing-artifact", record: null };

  if (typeof structured.artifact_hash !== "string" || !/^[a-f0-9]{64}$/.test(structured.artifact_hash)) {
    return { ok: false, reason: "missing-artifact-hash", record: null };
  }
  if (typeof structured.root_plan_id !== "string" || !ROOT_ID.test(structured.root_plan_id)) {
    return { ok: false, reason: "missing-root-plan-id", record: null };
  }
  if (typeof structured.status !== "string") {
    return { ok: false, reason: "missing-status", record: null };
  }
  if (typeof structured.handoff_persisted !== "boolean") {
    return { ok: false, reason: "missing-handoff-persisted", record: null };
  }

  const inspect = options.inspectArtifactText;
  if (typeof inspect !== "function") {
    return { ok: false, reason: "inspect-unavailable", record: null };
  }
  const inspected = inspect(rawArtifact, options.pluginRoot);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || !fields) return { ok: false, reason: "invalid-artifact", record: null };
  if ((inspected.normalizations ?? []).length > 0) return { ok: false, reason: "normalized-artifact", record: null };
  if (fields.artifact !== "delivery-evidence" || fields.schema !== 5) {
    return { ok: false, reason: "not-schema5-delivery-evidence", record: null };
  }
  if (fields.id !== id) return { ok: false, reason: "artifact-id-mismatch", record: null };
  if (!["complete", "provisional", "blocked"].includes(fields.status)) {
    return { ok: false, reason: "invalid-status", record: null };
  }
  if (fields.status !== structured.status) return { ok: false, reason: "status-mismatch", record: null };
  if (fields.root_plan_id !== structured.root_plan_id) {
    return { ok: false, reason: "root-plan-id-mismatch", record: null };
  }
  if ((fields.subject_id ?? null) !== (structured.subject_id ?? null)) {
    return { ok: false, reason: "structured-subject-mismatch", record: null };
  }
  if ((fields.source_review_id ?? null) !== (structured.source_review_id ?? null)) {
    return { ok: false, reason: "structured-source-review-mismatch", record: null };
  }
  if ((fields.predecessor_evidence_id ?? null) !== (structured.predecessor_evidence_id ?? null)) {
    return { ok: false, reason: "structured-predecessor-mismatch", record: null };
  }

  const activeRoot = options.activeRootPlanId ?? null;
  const closeoutRoot = options.closeoutRootPlanId ?? null;
  if (activeRoot && fields.root_plan_id !== activeRoot) {
    return { ok: false, reason: "active-root-mismatch", record: null };
  }
  if (closeoutRoot && fields.root_plan_id !== closeoutRoot) {
    return { ok: false, reason: "closeout-root-mismatch", record: null };
  }

  const derivedHash = sha256RawUtf8(rawArtifact);
  if (structured.artifact_hash !== derivedHash) {
    return { ok: false, reason: "artifact-hash-mismatch", record: null };
  }

  const expected = options.expectedLineage;
  if (expected == null || typeof expected !== "object" || Array.isArray(expected)) {
    return { ok: false, reason: "missing-expected-lineage", record: null };
  }
  if (expected.root_plan_id && fields.root_plan_id !== expected.root_plan_id) {
    return { ok: false, reason: "lineage-root-mismatch", record: null };
  }
  if ((fields.subject_id ?? null) !== (expected.subject_id ?? null)) {
    return { ok: false, reason: "lineage-subject-mismatch", record: null };
  }
  if ((fields.source_review_id ?? null) !== (expected.source_review_id ?? null)) {
    return { ok: false, reason: "lineage-source-review-mismatch", record: null };
  }
  if (
    Object.prototype.hasOwnProperty.call(expected, "predecessor_evidence_id")
    && (fields.predecessor_evidence_id ?? null) !== (expected.predecessor_evidence_id ?? null)
  ) {
    return { ok: false, reason: "lineage-predecessor-mismatch", record: null };
  }

  const structuredRootHash = typeof structured.root_content_hash === "string" ? structured.root_content_hash : null;
  if (!structuredRootHash || !/^[a-f0-9]{64}$/.test(structuredRootHash)) {
    return { ok: false, reason: "missing-root-content-hash", record: null };
  }
  const activeRootHash = typeof options.activeRootContentHash === "string" ? options.activeRootContentHash : null;
  if (!activeRootHash || !/^[a-f0-9]{64}$/.test(activeRootHash)) {
    return { ok: false, reason: "missing-active-root-content-hash", record: null };
  }
  if (structuredRootHash !== activeRootHash) {
    return { ok: false, reason: "root-content-hash-mismatch", record: null };
  }

  return {
    ok: true,
    reason: null,
    record: {
      id,
      artifact: rawArtifact,
      hash: derivedHash,
      handoff_persisted: structured.handoff_persisted,
      root_plan_id: fields.root_plan_id,
      subject_id: fields.subject_id ?? null,
      source_review_id: fields.source_review_id ?? null,
      predecessor_evidence_id: fields.predecessor_evidence_id ?? null,
      status: fields.status,
      root_content_hash: structuredRootHash,
      artifact_set_hash: typeof structured.artifact_set_hash === "string" ? structured.artifact_set_hash : null,
    },
  };
}

function lineBoundedArtifactIndexes(message, exactArtifact) {
  const prose = String(message ?? "");
  const exact = String(exactArtifact ?? "");
  if (!exact) return [];
  const indexes = [];
  let searchFrom = 0;
  while (searchFrom <= prose.length) {
    const index = prose.indexOf(exact, searchFrom);
    if (index < 0) break;
    const beforeOk = index === 0 || prose[index - 1] === "\n";
    const afterIndex = index + exact.length;
    const afterOk = afterIndex === prose.length || prose[afterIndex] === "\n";
    if (beforeOk && afterOk) indexes.push(index);
    searchFrom = index + 1;
  }
  return indexes;
}

/**
 * Count exact raw-byte Evidence attachments that are standalone fenced or line-bounded.
 * Embedded PREFIX/SUFFIX and tilde fences do not count.
 */
export function boundedEvidenceAttachmentCount(message, expectedArtifact) {
  if (!expectedArtifact) return 0;
  const exact = String(expectedArtifact);
  if (!exact) return 0;
  // Keep raw message bytes so CRLF Evidence attachments remain exact.
  const raw = String(message ?? "");
  const lines = raw.split(/\r?\n/);
  let count = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!BACKTICK_FENCE_OPEN.test(lines[index])) continue;
    const body = [];
    let cursor = index + 1;
    let closed = false;
    while (cursor < lines.length) {
      if (/^```\s*$/.test(lines[cursor])) {
        closed = true;
        break;
      }
      body.push(lines[cursor]);
      cursor += 1;
    }
    if (!closed) continue;
    // Reconstruct fence body using the same newline style as the expected artifact when possible.
    const joiner = exact.includes("\r\n") ? "\r\n" : "\n";
    const inner = `${body.join(joiner)}${body.length > 0 ? joiner : ""}`;
    if (inner === exact || inner === exact.replace(/\r?\n$/, "") || `${inner}${joiner}` === exact || `${inner}\n` === exact) {
      count += 1;
    }
    index = cursor;
  }
  return count + lineBoundedArtifactIndexes(raw, exact).length;
}

export function parseDeliveryReport(text) {
  const attestations = extractWorkflowAttestations(text)
    .map((entry) => entry.value)
    .filter((value) => asObject(value) && value.schema === 1 && value.kind === DELIVERY_REPORT_KIND);
  if (attestations.length !== 1) {
    return { ok: false, reason: "delivery-report-count", report: null };
  }
  const report = attestations[0];
  const id = typeof report.delivery_evidence_id === "string" ? report.delivery_evidence_id : "";
  if (!EVIDENCE_ID.test(id)) return { ok: false, reason: "invalid-delivery-evidence-id", report: null };
  const keys = Object.keys(report).sort();
  const allowed = ["delivery_evidence_id", "kind", "schema"];
  if (keys.some((key) => !allowed.includes(key))) {
    return { ok: false, reason: "unexpected-delivery-report-fields", report: null };
  }
  return { ok: true, reason: null, report: { delivery_evidence_id: id } };
}

/**
 * Validate a completion message against a previously recorded closeout turn.
 */
function rawArtifactOccurrenceCount(message, expectedArtifact) {
  const prose = String(message ?? "");
  const exact = String(expectedArtifact ?? "");
  if (!exact) return 0;
  let count = 0;
  let searchFrom = 0;
  while (searchFrom <= prose.length) {
    const index = prose.indexOf(exact, searchFrom);
    if (index < 0) break;
    count += 1;
    searchFrom = index + exact.length;
  }
  return count;
}

export function evaluateDeliveryCompletion(message, turn) {
  if (!turn?.closeout_recorded || !turn.delivery_evidence_id || !turn.delivery_evidence_artifact || typeof turn.handoff_persisted !== "boolean") {
    return { ok: false, reason: "closeout-not-recorded" };
  }
  if (turn.active_root_plan_id && turn.delivery_evidence_root_plan_id && turn.active_root_plan_id !== turn.delivery_evidence_root_plan_id) {
    return { ok: false, reason: "active-root-mismatch" };
  }

  const report = parseDeliveryReport(message);
  if (!report.ok) return { ok: false, reason: report.reason };
  if (report.report.delivery_evidence_id !== turn.delivery_evidence_id) {
    return { ok: false, reason: "delivery-report-id-mismatch" };
  }

  const attachmentCount = boundedEvidenceAttachmentCount(message, turn.delivery_evidence_artifact);
  const occurrenceCount = rawArtifactOccurrenceCount(message, turn.delivery_evidence_artifact);
  if (turn.handoff_persisted === false) {
    // Task-local lifecycle state already retains the exact Evidence bytes. A single bounded
    // attachment remains compatible for an intentional cross-task export, but it is not a
    // prerequisite for continuing and reviewing inside the current task.
    const containsDifferentEvidence = attachmentCount === 0 && /\bartifact\s*:\s*delivery-evidence\b/i.test(String(message ?? ""));
    if (attachmentCount > 1 || occurrenceCount !== attachmentCount || containsDifferentEvidence) {
      return { ok: false, reason: "unpersisted-attachment-invalid" };
    }
  } else if (attachmentCount !== 0 || occurrenceCount !== 0) {
    // Persisted closeout must not dump the retained artifact.
    return { ok: false, reason: "persisted-attachment-invalid" };
  }

  return { ok: true, reason: null, delivery_evidence_id: turn.delivery_evidence_id };
}

export function formatPlanCloseoutAttestationFence() {
  return [
    "```yaml workflow-attestation",
    "schema: 1",
    "kind: plan-closeout",
    "action: delivery-closeout",
    "```",
  ].join("\n");
}

export function formatDeliveryReportFence(deliveryEvidenceId) {
  return [
    "```yaml workflow-attestation",
    "schema: 1",
    "kind: delivery-report",
    `delivery_evidence_id: ${deliveryEvidenceId}`,
    "```",
  ].join("\n");
}

export function isEvidenceId(value) {
  return typeof value === "string" && EVIDENCE_ID.test(value);
}

export function isRootId(value) {
  return typeof value === "string" && ROOT_ID.test(value);
}

export function isCorrectionId(value) {
  return typeof value === "string" && CORRECTION_ID.test(value);
}

export function isReviewId(value) {
  return typeof value === "string" && REVIEW_ID.test(value);
}
