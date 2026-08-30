#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceHasKnownFailure, schema6EvidenceData } from "./artifact-validator/evidence.mjs";
import { linearChain, lineageTips } from "./artifact-validator/lineage.mjs";
import {
  extractEmbeddedWorkPlanText,
  opaqueExtensionsFromArtifactText,
  parseArtifact,
  replaceOpaqueExtensions,
} from "./artifact-validator/parser.mjs";
import { schemaFor, validateArtifactSchema } from "./artifact-validator/schema.mjs";
import { normalizeAuthorityPattern, pathMatchesAuthorityPattern } from "../src/core/manual-path-authority.mjs";
export { rootContentHash } from "../src/core/state-paths.mjs";

export { extractEmbeddedWorkPlanText, opaqueExtensionsFromArtifactText, parseArtifact, replaceOpaqueExtensions };

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = dirname(scriptDirectory);

const knownArtifacts = new Set([
  "work-plan",
  "delivery-evidence",
  "work-review",
]);
const riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });
const hardTriggers = new Set([
  "security-secrets",
  "destructive-data",
  "regulated-or-monetary",
  "breaking-external-contract",
  "irreversible-external-effect",
  "no-recovery-path",
  "broad-runtime-impact",
  "material-uncertainty",
]);
const objectivePattern = /\bOBJ-[1-9][0-9]*\b/g;
const fixPattern = /\bFIX-[1-9][0-9]*\b/g;
const checkPattern = /\bCHECK-[1-9][0-9]*\b/g;
const learningPattern = /\bLRN-[A-Za-z0-9][A-Za-z0-9-]*\b/g;

const sectionAliases = Object.freeze({
  Intent: ["intent", "goal", "intent contract"],
  Acceptance: ["acceptance", "acceptance outcomes", "success criteria"],
  Boundaries: ["boundaries", "authority", "authority envelope"],
  Risks: ["risks", "risk summary"],
  Verification: ["verification", "root checks", "planned checks"],
  Summary: ["summary", "delivery summary"],
  Assessment: ["assessment", "result", "review result"],
  "Evidence coverage": ["coverage", "evidence coverage"],
  Findings: ["findings", "issues"],
  "Next action": ["next action", "recommendation"],
  "Correction plan": ["correction", "correction plan"],
});

const headerAliases = Object.freeze({
  "objective id": ["objective", "objective id"],
  "check id": ["check", "check id"],
  "step id": ["step", "step id"],
  "observed result": ["observed", "observed result", "actual result"],
  "expected result": ["expected", "expected result", "pass condition"],
  "cost class": ["cost", "cost class"],
  "evidence class": ["evidence class", "verification owner", "evidence owner"],
  prerequisites: ["prerequisite", "prerequisites", "dependencies"],
  "finding key": ["finding", "finding key"],
  "learning id": ["learning", "learning id", "candidate", "candidate id"],
});
const optionalTableCells = new Set();

const tables = Object.freeze({
  verificationIntent: ["Check ID", "Objectives", "Verification Intent", "Expected Evidence", "Required", "Evidence Class", "Cost Class", "Prerequisites"],
  coverage: ["Kind", "Inspected", "Reused", "Result", "Evidence"],
  findings: ["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning"],
  correctionMeta: ["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"],
  fixes: ["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"],
  correctionSteps: ["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"],
  correctionIntentChecks: ["Check ID", "FIX IDs", "Verification Intent", "Expected Evidence", "Required", "Evidence Class", "Cost Class", "Prerequisites"],
  learningCandidates: ["Learning ID", "Finding keys", "Reusable guidance", "Candidate targets", "Confirmation evidence"],
});

const costRank = Object.freeze({ cheap: 1, standard: 2, expensive: 3 });

function unique(values) {
  return [...new Set(values)];
}

function ids(value, pattern) {
  return unique(String(value ?? "").match(pattern) ?? []);
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function maskFences(text) {
  let fence = null;
  return String(text).split(/(?<=\n)/).map((line) => {
    if (!fence) {
      const marker = line.match(/^[ \t]*(`{3,}|~{3,})/);
      if (!marker) return line;
      fence = { char: marker[1][0], size: marker[1].length };
      return line.replace(/[^\r\n]/g, " ");
    }
    const masked = line.replace(/[^\r\n]/g, " ");
    if (new RegExp(`^[ \\t]*${fence.char}{${fence.size},}[ \\t]*(?:\\r?\\n)?$`).test(line)) fence = null;
    return masked;
  }).join("");
}

function sectionMap(body, required, failures, normalizations = []) {
  const structural = maskFences(body);
  const matches = [...structural.matchAll(/^## ([^\r\n]+)$/gm)];
  const actual = matches.map((match) => match[1].trim());
  const sections = new Map();
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    const content = body.slice(start, end).trim();
    const actualName = match[1].trim();
    const normalizedActual = normalizedHeader(actualName);
    const canonical = Object.entries(sectionAliases).find(([name, aliases]) =>
      normalizedHeader(name) === normalizedActual || aliases.some((alias) => normalizedHeader(alias) === normalizedActual),
    )?.[0] ?? actualName;
    if (canonical !== actualName) normalizations.push(`normalized section ${actualName} to ${canonical}`);
    if (sections.has(canonical)) failures.push(`${canonical}: duplicate section`);
    sections.set(canonical, content);
  });
  for (const name of required) if (!sections.has(name)) failures.push(`missing required section ${name}`);
  const requiredInOutput = actual.filter((name) => required.some((candidate) => candidate.toLowerCase() === name.toLowerCase()));
  if (requiredInOutput.map((name) => name.toLowerCase()).join("\n") !== required.filter((name) => sections.has(name)).map((name) => name.toLowerCase()).join("\n")) normalizations.push("normalized Markdown section order");
  return sections;
}

function trimTrailingNotes(body, required, normalizations) {
  const structural = maskFences(body);
  const separators = [...structural.matchAll(/^---[ \t]*$/gm)];
  for (const separator of separators.toReversed()) {
    const prefix = body.slice(0, separator.index);
    const headings = new Set([...maskFences(prefix).matchAll(/^## ([^\r\n]+)$/gm)].map((match) => match[1].trim().toLowerCase()));
    if (required.every((name) => headings.has(name.toLowerCase()))) {
      normalizations.push("ignored trailing explanation after workflow artifact");
      return prefix.trimEnd();
    }
  }
  return body;
}

function cells(line) {
  const parsed = [];
  let current = "";
  let escaped = false;
  for (const char of String(line).trim()) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "|") { parsed.push(current.trim()); current = ""; continue; }
    current += char;
  }
  parsed.push(current.trim());
  if (parsed[0] === "") parsed.shift();
  if (parsed.at(-1) === "") parsed.pop();
  return parsed;
}

function markdownTables(content) {
  const lines = maskFences(content).split(/\r?\n/);
  const found = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = cells(lines[index]);
    const separator = cells(lines[index + 1]);
    if (headers.length < 2 || separator.length !== headers.length || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const rows = [];
    index += 2;
    while (index < lines.length && lines[index].includes("|")) {
      const row = cells(lines[index]);
      if (row.length !== headers.length) break;
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex]])));
      index += 1;
    }
    index -= 1;
    found.push({ headers, rows });
  }
  return found;
}

function normalizedHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tableMatching(content, headers) {
  const resolveHeader = (candidate, expected) => {
    const normalizedCandidate = normalizedHeader(candidate);
    const normalizedExpected = normalizedHeader(expected);
    return normalizedCandidate === normalizedExpected || (headerAliases[normalizedExpected] ?? []).some((alias) => normalizedHeader(alias) === normalizedCandidate);
  };
  return markdownTables(content).flatMap((candidate) => {
    const mapping = new Map();
    for (const expected of headers) {
      const matches = candidate.headers.filter((actual) => resolveHeader(actual, expected));
      if (matches.length !== 1) return [];
      mapping.set(expected, matches[0]);
    }
    return [{
      headers,
      rows: candidate.rows.map((row) => Object.fromEntries(headers.map((expected) => [expected, row[mapping.get(expected)]]))),
      normalized: candidate.headers.length !== headers.length || candidate.headers.some((header, index) => header !== headers[index]),
    }];
  });
}

function tableRows(content, headers) {
  return tableMatching(content, headers)[0]?.rows ?? [];
}

function subsection(content, name) {
  const structural = maskFences(content);
  const matches = [...structural.matchAll(/^### ([^\r\n]+)$/gm)];
  const index = matches.findIndex((match) => normalizedHeader(match[1]) === normalizedHeader(name));
  if (index < 0) return "";
  const start = matches[index].index + matches[index][0].length;
  const end = matches[index + 1]?.index ?? content.length;
  return content.slice(start, end).trim();
}

function verificationSectionContent(artifact) {
  const sections = artifact?.sections instanceof Map ? artifact.sections : new Map();
  const topLevel = sections.get("Verification") ?? "";
  if (tableRows(topLevel, tables.verificationIntent).length > 0) return topLevel;
  const nested = subsection(sections.get("Acceptance") ?? "", "Verification");
  return nested.trim() ? nested : "";
}

function noneLike(value) {
  return /^(?:none\.?|no (?:findings|changes|deviations|candidates|correction|open decisions)\.?)$/i.test(String(value).trim());
}

function hasStandaloneNone(content) {
  return String(content).split(/\r?\n/).some((line) => /^(?:\*\*[^*\r\n]+:\*\*\s*)?None\.?$/i.test(line.trim()));
}

function requireTable(sections, sectionName, headers, failures, { allowNone = false, optional = false, normalizations = [] } = {}) {
  const content = sections.get(sectionName) ?? "";
  if (allowNone && noneLike(content)) {
    if (content.trim() !== "None.") normalizations.push(`${sectionName}: normalized empty marker`);
    return { headers, rows: [], none: true };
  }
  if (optional && !content.trim()) return { headers, rows: [], none: true };
  const matches = tableMatching(content, headers);
  if (allowNone && matches.length === 0 && hasStandaloneNone(content)) {
    normalizations.push(`${sectionName}: materialized embedded empty marker`);
    return { headers, rows: [], none: true };
  }
  if (matches.length !== 1) {
    failures.push(`${sectionName}: requires exactly one table [${headers.join(", ")}]`);
    return { headers, rows: [] };
  }
  if (matches[0].normalized) normalizations.push(`${sectionName}: normalized table column order or casing`);
  if (matches[0].rows.length === 0) failures.push(`${sectionName}: required table must contain a row`);
  matches[0].rows.forEach((row, index) => {
    for (const header of headers) if (!row[header] && !optionalTableCells.has(normalizedHeader(header))) failures.push(`${sectionName}: row ${index + 1} has empty ${header}`);
  });
  return matches[0];
}

function placeholder(value) {
  // Explicit unfinished-content tokens only. Ordinary title-case words such as
  // "Todo" must not fail closed; match TBD/TODO/UNKNOWN in that exact uppercase form.
  return /<(?:placeholder|replace[-_ ]?me|insert[-_ ][^>\r\n]+|[^>\r\n]*\.{3}[^>\r\n]*)>/i.test(String(value))
    || /\b(?:TBD|TODO|UNKNOWN)\b/.test(String(value));
}

function rejectPlaceholders(parsed, schema, sections, failures) {
  if (!["ready", "complete", "current", "active"].includes(parsed.fields.status)) return;
  for (const field of schema.required ?? []) if (placeholder(parsed.fields[field])) failures.push(`frontmatter ${field} contains a placeholder`);
  for (const [name, content] of sections) if (placeholder(content)) failures.push(`${name}: contains a placeholder`);
}

function exactIdSet(rows, column, pattern, label, failures) {
  const values = rows.map((row) => row[column]);
  for (const value of values) if (!new RegExp(`^(?:${pattern.source})$`).test(value)) failures.push(`${label}: invalid ID ${value}`);
  if (new Set(values).size !== values.length) failures.push(`${label}: IDs must be unique`);
  return new Set(values);
}

function targetTokens(value) {
  const inline = [...String(value).matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return (inline.length ? inline : String(value).split(",")).map((entry) => entry.trim().replace(/^\.\//, "")).filter(Boolean);
}

function targetMatches(value, scope) {
  const target = value.replace(/^\.\//, "");
  const candidate = scope.replace(/^\.\//, "");
  if (/^all other (?:files|paths|targets)$/i.test(candidate)) return true;
  const repositoryTarget = target.replace(/[#:].*$/, "");
  try {
    return pathMatchesAuthorityPattern(repositoryTarget, candidate);
  } catch {
    return false;
  }
}

function authorityTargetState(target, authority = {}) {
  const allowed = (authority.allowed_roots ?? []).some((scope) => targetMatches(target, scope));
  const protectedTarget = (authority.protected_paths ?? []).some((scope) => targetMatches(target, scope));
  const approvalRequired = (authority.approval_required_paths ?? []).some((scope) => targetMatches(target, scope));
  return { allowed, protected: protectedTarget, approval_required: approvalRequired };
}

function acceptanceChangeTargets(parsed) {
  const sources = [
    ...(parsed.fields.acceptance ?? []),
    parsed.sections?.get("Acceptance") ?? "",
  ];
  const pathLike = (value) => !/^(?:https?:|[A-Za-z][A-Za-z0-9+.-]*:)/.test(value)
    && !value.startsWith("/")
    && value !== ".."
    && !value.startsWith("../")
    && !/\s/.test(value)
    && (value.includes("/") || /^\.[A-Za-z0-9_-]/.test(value) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+$/.test(value));
  const targets = [];
  for (const source of sources) {
    for (const match of String(source).matchAll(/`([^`]+)`/g)) {
      const target = match[1].trim().replace(/^\.\//, "");
      if (pathLike(target)) targets.push(target);
    }
  }
  return unique(targets);
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function validateCostOrder(rows, column, label, parsed) {
  let previous = 0;
  for (const row of rows) {
    const current = costRank[row[column]] ?? 99;
    if (current < previous) {
      parsed.normalizations.push(`${label}: normalized economic check order cheap, standard, expensive`);
      return;
    }
    previous = current;
  }
}

function planData(artifact) {
  const objectives = artifact.fields.acceptance.map((outcome, index) => ({
    "Objective ID": `OBJ-${index + 1}`,
    "Observable outcome": outcome,
    "Acceptance evidence": outcome,
  }));
  const checks = tableRows(verificationSectionContent(artifact), tables.verificationIntent);
  const objectiveIds = objectives.map((row) => row["Objective ID"]);
  return {
    objectives: new Set(objectiveIds),
    checks: new Set(checks.map((row) => row["Check ID"])),
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    evidenceClasses: new Map(checks.map((row) => [row["Check ID"], row["Evidence Class"]])),
    slices: [{
      "Slice ID": "SLICE-1",
      Objectives: objectiveIds.join(", "),
      Dependencies: "None.",
      Targets: artifact.fields.authority.allowed_roots.join(", "),
      "Observable outcome": artifact.fields.goal,
      "Check IDs": checks.map((row) => row["Check ID"]).join(", "),
      "Human review": "no",
    }],
    steps: new Set(["STEP-1"]),
    requiredChecks: new Set(checks.filter((row) => row.Required === "yes").map((row) => row["Check ID"])),
    allowedTargets: [...artifact.fields.authority.allowed_roots],
    prohibitedTargets: [...artifact.fields.authority.protected_paths, ...artifact.fields.authority.approval_required_paths],
  };
}

function validatePlan6(parsed, sections, failures) {
  for (const section of ["Intent", "Acceptance", "Boundaries", "Risks"]) {
    if (!(sections.get(section) ?? "").trim()) failures.push(`${section}: section must not be empty`);
  }
  const expectedLevel = { manual: "lean", supervised: "controlled", autonomous: "certified" }[parsed.fields.profile_max];
  if (parsed.fields.contract_level !== expectedLevel) failures.push(`contract_level must be ${expectedLevel} for ${parsed.fields.profile_max}`);
  if (parsed.fields.status === "ready" && parsed.fields.intent_ready !== true) failures.push("ready work-plan requires intent_ready true");
  if (parsed.fields.profile_max === "autonomous" && (parsed.fields.hard_triggers ?? []).length > 0) failures.push("hard-trigger work cannot be autonomous");
  const authority = parsed.fields.authority ?? {};
  for (const path of [...(authority.allowed_roots ?? []), ...(authority.protected_paths ?? []), ...(authority.approval_required_paths ?? [])]) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`authority path must remain repository-relative: ${path}`);
  }
  if (["controlled", "certified"].includes(parsed.fields.contract_level)) {
    for (const field of ["max_active_minutes", "max_total_tokens", "max_cost_usd"]) if (!Number.isFinite(authority[field]) || authority[field] <= 0) failures.push(`controlled authority requires ${field}`);
  }
  const data = planData(parsed);
  const verification = tableRows(
    verificationSectionContent(parsed),
    tables.verificationIntent,
  );
  for (const row of verification) {
    if (!/^CHECK-[1-9][0-9]*$/.test(row["Check ID"])) failures.push(`Verification: invalid Check ID ${row["Check ID"]}`);
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`);
    const evidenceClass = /^(?:harness-verifiable|reviewer-observable|human-decision-required)$/;
    if (!evidenceClass.test(row["Evidence Class"])) failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  if (verification.length === 0) parsed.normalizations.push("synthesized strategy checks from acceptance outcomes");
  if (data.objectives.size !== parsed.fields.acceptance.length) failures.push("acceptance outcomes must map one-to-one to objectives");
  if (parsed.wrapper) {
    const todos = parsed.wrapper.todos ?? [];
    if (todos.length === 0) failures.push("native Plan must include at least one implementation todo");
  }
}

function evidenceData(artifact) {
  return schema6EvidenceData(artifact.fields);
}

function reviewData(artifact) {
  const coverage = tableRows(artifact.sections.get("Evidence coverage") ?? "", tables.coverage);
  const findings = tableRows(artifact.sections.get("Findings") ?? "", tables.findings);
  return { coverage, findings };
}

function validateEvidenceGrades(parsed, failures) {
  const entries = parsed.fields.check_evidence ?? [];
  const grades = entries.map((entry) => entry.grade);
  if (grades.includes("failed") && parsed.fields.overall_grade !== "failed") failures.push("failed check evidence requires overall_grade failed");
  if (parsed.fields.status === "complete" && parsed.fields.overall_grade !== "verified") failures.push("complete evidence requires overall_grade verified");
  if (parsed.fields.status === "complete" && entries.some((entry) => entry.grade !== "verified")) failures.push("complete evidence requires every Check grade verified");
  if (parsed.fields.status === "provisional" && !["supported", "partial", "unavailable"].includes(parsed.fields.overall_grade)) failures.push("provisional evidence requires supported, partial, or unavailable grade");
  if (parsed.fields.status !== "blocked" && grades.includes("failed")) failures.push("failed check evidence must be blocked");
}

function validateLeanEvidence(parsed, sections, failures) {
  if (!(sections.get("Summary") ?? "").trim()) failures.push("Summary: section must not be empty");
  const affected = new Set(parsed.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (const id of affected) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both affected and reused`);
  const executed = new Set(parsed.fields.executed_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of executed) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both executed and reused`);
  const checkIds = (parsed.fields.check_evidence ?? []).map((entry) => entry.check_id);
  if (new Set(checkIds).size !== checkIds.length) failures.push("check_evidence Check IDs must be unique");
  if (!sameSet(new Set(checkIds), executed)) failures.push("check_evidence must exactly match executed_checks");
  for (const path of parsed.fields.changed_paths ?? []) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`changed path must remain repository-relative: ${path}`);
  }
  const subjectPaths = new Set(parsed.fields.changed_paths ?? []);
  for (const path of parsed.fields.ambient_paths ?? []) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`ambient path must remain repository-relative: ${path}`);
    if (subjectPaths.has(path)) failures.push(`path cannot be both subject and ambient: ${path}`);
  }
  validateEvidenceGrades(parsed, failures);
  parsed.effective = {
    checkEvidence: (parsed.fields.check_evidence ?? []).map((entry) => ({ ...entry })),
  };
}

function validateEvidence(parsed, sections, failures) {
  validateLeanEvidence(parsed, sections, failures);
}

function parseCorrection(parsed, sections, failures) {
  const content = sections.get("Correction plan") ?? "";
  if (parsed.fields.next_action !== "correct") {
    if (content.trim() && !noneLike(content)) failures.push("Correction plan is allowed only when next_action is correct");
    return null;
  }
  const headings = [...maskFences(content).matchAll(/^### (cp-[^\r\n]+)$/gm)].map((match) => match[1]);
  if (headings.length !== 1) failures.push("correct review must embed exactly one cp-* correction as an H3");
  if (headings.length === 1) {
    if (parsed.fields.correction_id !== headings[0]) failures.push("embedded correction ID conflicts with frontmatter");
  }
  const pseudo = new Map([["Correction plan", content]]);
  const metadata = requireTable(pseudo, "Correction plan", tables.correctionMeta, failures, { normalizations: parsed.normalizations });
  const fixes = { rows: tableRows(content, tables.fixes) };
  const steps = { rows: tableRows(content, tables.correctionSteps) };
  const checks = { rows: tableRows(content, tables.correctionIntentChecks) };
  if (fixes.rows.length === 0) failures.push("Correction plan requires a FIX table");
  if (steps.rows.length === 0) failures.push("Correction plan requires a step table");
  if (checks.rows.length === 0) failures.push("Correction plan requires a Check table");

  const declaredLearnings = Array.isArray(parsed.fields.learning_candidates) ? parsed.fields.learning_candidates : [];
  const pseudoLearning = new Map([["Correction plan", content]]);
  const learnings = requireTable(pseudoLearning, "Correction plan", tables.learningCandidates, failures, { normalizations: parsed.normalizations });
  const learningIds = exactIdSet(learnings.rows, "Learning ID", learningPattern, "Correction learning", failures);
  for (const learningId of learningIds) {
    if (!declaredLearnings.includes(learningId)) failures.push(`Correction learning ${learningId} must be declared in learning_candidates`);
  }
  for (const row of learnings.rows) {
    const keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    if (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) failures.push(`Learning ${row["Learning ID"]} needs valid source Finding keys`);
  }

  const fixIds = exactIdSet(fixes.rows, "FIX ID", /FIX-[1-9][0-9]*/, "Correction FIX", failures);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Correction steps", failures);
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Correction checks", failures);
  for (const row of fixes.rows) {
    const keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    if (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) failures.push(`Correction ${row["FIX ID"]} needs valid source Finding keys`);
    if (ids(row["Root Objectives"], objectivePattern).length === 0) failures.push(`Correction ${row["FIX ID"]} needs root objectives`);
    if (ids(row["Root Checks"], checkPattern).length === 0) failures.push(`Correction ${row["FIX ID"]} needs root Checks`);
  }
  const coveredFixes = new Set();
  for (const row of steps.rows) {
    ids(row["FIX IDs"], fixPattern).forEach((id) => coveredFixes.add(id));
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Correction ${row["Step ID"]} needs a PROBE-N completion probe`);
    ids(row["Check IDs"], checkPattern).forEach((id) => { if (!checkIds.has(id)) failures.push(`Correction step references unknown ${id}`); });
  }
  for (const fix of fixIds) if (!coveredFixes.has(fix)) failures.push(`Correction steps do not cover ${fix}`);
  for (const row of checks.rows) {
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Correction check ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) failures.push(`Correction check ${row["Check ID"]} invalid Cost Class`);
    if (!/^(?:harness-verifiable|reviewer-observable|human-decision-required)$/.test(row["Evidence Class"])) failures.push(`Correction check ${row["Check ID"]} invalid Evidence Class`);
    if (targetTokens(row.Prerequisites).length === 0) failures.push(`Correction check ${row["Check ID"]} needs concrete Prerequisites`);
    ids(row["FIX IDs"], fixPattern).forEach((id) => { if (!fixIds.has(id)) failures.push(`Correction check references unknown ${id}`); });
  }
  validateCostOrder(checks.rows, "Cost Class", "Correction checks", parsed);
  return { id: headings[0], metadata: metadata.rows[0], fixes: fixes.rows, steps: steps.rows, checks: checks.rows, learnings: learnings.rows };
}

function validateCompactReview(parsed, sections, failures) {
  const options = { normalizations: parsed.normalizations };
  const assessment = sections.get("Assessment") ?? "";
  if (!assessment.toLowerCase().includes(String(parsed.fields.assessment).toLowerCase())) failures.push("Assessment section must state frontmatter assessment");

  const coverage = requireTable(sections, "Evidence coverage", tables.coverage, failures, { optional: true, normalizations: parsed.normalizations });
  const coverageByKind = new Map();
  for (const row of coverage.rows) {
    const kind = normalizedHeader(row.Kind);
    const rows = coverageByKind.get(kind) ?? [];
    rows.push(row);
    coverageByKind.set(kind, rows);
  }
  const inspectedObjectives = new Set(parsed.fields.inspected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  const inspectedChecks = new Set(parsed.fields.inspected_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of inspectedObjectives) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both inspected and reused`);
  for (const id of inspectedChecks) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both inspected and reused`);
  const coverageLists = [
    ["Objectives", "Inspected", inspectedObjectives, objectivePattern],
    ["Objectives", "Reused", reusedObjectives, objectivePattern],
    ["Checks", "Inspected", inspectedChecks, checkPattern],
    ["Checks", "Reused", reusedChecks, checkPattern],
  ];
  for (const [kind, column, expected, pattern] of coverageLists) {
    const row = coverageByKind.get(normalizedHeader(kind))?.[0];
    const visible = new Set(ids(row?.[column], pattern));
    if (!sameSet(visible, expected)) parsed.normalizations.push(`Evidence coverage: ${kind} ${column.toLowerCase()} summary derived from frontmatter`);
  }

  const findingContent = sections.get("Findings") ?? "";
  let findings = { rows: [], none: true };
  if (findingContent.trim()) findings = requireTable(sections, "Findings", tables.findings, failures, { allowNone: true, normalizations: parsed.normalizations });
  const keys = new Set();
  for (const row of findings.rows) {
    const key = row["Finding key"];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) failures.push(`Findings: invalid Finding key ${key}`);
    if (keys.has(key)) failures.push(`Findings: duplicate Finding key ${key}`);
    keys.add(key);
    if (!/^(?:low|medium|high|critical)$/.test(row.Severity)) failures.push(`Findings: ${key} has invalid Severity`);
    if (ids(row.Objectives, objectivePattern).length === 0) failures.push(`Findings: ${key} needs root Objectives`);
    if (ids(row.Checks, checkPattern).length === 0) failures.push(`Findings: ${key} needs root Checks`);
  }
  const boundaryReview = parsed.fields.review_basis === "root-boundary";
  if (boundaryReview && findings.rows.length > 0) failures.push("root-boundary review cannot contain delivery findings");
  parsed.findings = findings.rows;
  const next = sections.get("Next action") ?? "";
  if (!next.toLowerCase().includes(String(parsed.fields.next_action).toLowerCase())) failures.push("Next action section must state frontmatter next_action");
  if (parsed.fields.assessment === "achieved") {
    if (parsed.fields.next_action !== "none") failures.push("achieved review requires next_action none");
    if (findings.rows.length > 0) failures.push("achieved review cannot contain findings");
    const snapshotRow = coverageByKind.get(normalizedHeader("Snapshot"))?.[0];
    if (coverage.rows.length > 0 && (normalizedHeader(snapshotRow?.Result) !== "consistent" || noneLike(snapshotRow?.Inspected))) failures.push("achieved review coverage contradicts current snapshot consistency");
  }
  if (parsed.fields.next_action === "none" && parsed.fields.assessment !== "achieved") failures.push("next_action none requires assessment achieved");
  if (parsed.fields.delivery_status === "verified" && parsed.fields.assessment !== "achieved") failures.push("verified delivery requires achieved assessment");
  if (parsed.fields.delivery_status === "provisional"
    && !["accept-provisional", "none"].includes(parsed.fields.next_action)) failures.push("provisional delivery requires accept-provisional or a terminal achieved Review");
  if (parsed.fields.delivery_status === "provisional"
    && parsed.fields.next_action === "none"
    && parsed.fields.assessment !== "achieved") failures.push("terminal provisional delivery requires achieved assessment");
  if (parsed.fields.next_action === "accept-provisional" && parsed.fields.delivery_status !== "provisional") failures.push("accept-provisional requires provisional delivery");
  if (parsed.fields.next_action === "correct" && findings.rows.length === 0) failures.push("correct review requires findings");
  if (!["correct", "none"].includes(parsed.fields.next_action) && Array.isArray(parsed.fields.learning_candidates)) failures.push("learning_candidates are allowed only for correction or terminal achieved Review");
  if (parsed.fields.next_action === "retry-review" && parsed.fields.assessment !== "insufficient-evidence") failures.push("retry-review requires assessment insufficient-evidence");

  const correction = parseCorrection(parsed, sections, failures);
  if (correction) {
    for (const fix of correction.fixes) {
      const referenced = String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (const key of referenced) if (!keys.has(key)) failures.push(`Correction ${fix["FIX ID"]} references unknown Finding key ${key}`);
    }
    for (const learning of correction.learnings) {
      const referenced = String(learning["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (const key of referenced) if (!keys.has(key)) failures.push(`Learning ${learning["Learning ID"]} references unknown Finding key ${key}`);
    }
  }
  parsed.effective = {
    inspectedObjectives: [...inspectedObjectives],
    reusedObjectives: [...reusedObjectives],
    inspectedChecks: [...inspectedChecks],
    reusedChecks: [...reusedChecks],
    findings: findings.rows,
  };
  return correction;
}

function buildArtifact(text, root, options = {}) {
  const failures = [];
  const diagnostics = [];
  const normalizations = [];
  const parsed = parseArtifact(text, failures, normalizations);
  if (!parsed) return { failures, diagnostics, normalizations, parsed: null };
  parsed.normalizations = normalizations;
  const schema = validateArtifactSchema(root, parsed, failures);
  if (!schema) return { failures, diagnostics, normalizations, parsed };
  const requiredSections = schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? [];
  const sections = sectionMap(trimTrailingNotes(parsed.body, requiredSections, normalizations), requiredSections, failures, normalizations);
  parsed.sections = sections;
  if (sections.size > 0) {
    rejectPlaceholders(parsed, schema, sections, failures);
    if (parsed.fields.artifact === "work-plan") {
      validatePlan6(parsed, sections, failures);
    }
    if (parsed.fields.artifact === "delivery-evidence") validateEvidence(parsed, sections, failures);
    if (parsed.fields.artifact === "work-review") parsed.correction = validateCompactReview(parsed, sections, failures);
  }
  return { failures: unique(failures), diagnostics: unique(diagnostics), normalizations: unique(normalizations), parsed };
}

export function validateArtifactText(text, root = defaultRoot, options = {}) {
  return buildArtifact(text, root, options).failures;
}

export function inspectArtifactText(text, root = defaultRoot, options = {}) {
  const built = buildArtifact(text, root, options);
  return {
    errors: built.failures,
    diagnostics: built.diagnostics,
    normalizations: built.normalizations,
    effective: built.parsed?.effective ?? null,
    artifact: built.parsed ?? null,
  };
}

export function preflightRootPlan(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  const parsed = inspected.artifact;
  if (inspected.errors.length > 0 || parsed?.fields?.artifact !== "work-plan" || parsed.fields.schema !== 6) {
    return {
      feasible: false,
      root_plan_id: parsed?.fields?.id ?? null,
      root_projection_hash: null,
      blocking_issues: (inspected.errors.length > 0 ? inspected.errors : ["input must be one Schema-6 work-plan"])
        .map((message) => issue("invalid-root", message)),
      advisories: [],
      required_checks: [],
      deferred_checks: [],
      cost_classes: { cheap: 0, standard: 0, expensive: 0 },
      approval_granted: false,
      mutation_performed: false,
    };
  }

  const blocking = [];
  const advisories = [];
  const authority = parsed.fields.authority ?? {};
  for (const [boundaryKind, patterns] of [
    ["allowed", authority.allowed_roots ?? []],
    ["protected", authority.protected_paths ?? []],
    ["approval-required", authority.approval_required_paths ?? []],
  ]) {
    for (const pattern of patterns) {
      try {
        normalizeAuthorityPattern(pattern);
      } catch (error) {
        blocking.push(issue("invalid-authority-pattern", String(error?.message ?? error), {
          target: pattern,
          boundary_kind: boundaryKind,
        }));
      }
    }
  }
  const denied = [
    ...(authority.protected_paths ?? []).map((path) => ({ kind: "protected", path })),
    ...(authority.approval_required_paths ?? []).map((path) => ({ kind: "approval-required", path })),
  ];
  for (const allowed of authority.allowed_roots ?? []) {
    const shadow = denied.find((entry) => targetMatches(allowed, entry.path));
    if (shadow) advisories.push(issue(
      "shadowed-allowed-root",
      `allowed root ${allowed} is fully shadowed by ${shadow.kind} path ${shadow.path}`,
      { target: allowed, boundary: shadow.path, boundary_kind: shadow.kind },
    ));
  }
  for (const target of acceptanceChangeTargets(parsed)) {
    const state = authorityTargetState(target, authority);
    if (state.protected || state.approval_required) blocking.push(issue(
      "acceptance-path-outside-authority",
      `Acceptance requires changing ${target}, but the current Root does not authorize that target`,
      { target, ...state },
    ));
    else if (!state.allowed) advisories.push(issue(
      "acceptance-path-outside-allowed-roots",
      `Acceptance mentions ${target} outside allowed_roots; Manual Review will expose this as provisional scope drift`,
      { target, ...state },
    ));
  }

  const rows = tableRows(verificationSectionContent(parsed), tables.verificationIntent);
  const objectiveIds = new Set((parsed.fields.acceptance ?? []).map((_, index) => `OBJ-${index + 1}`));
  const requiredChecks = [];
  const deferredChecks = [];
  const costs = { cheap: 0, standard: 0, expensive: 0 };
  if (rows.length === 0) {
    blocking.push(issue("explicit-verification-required", "new Schema-6 roots require an explicit intent-only Verification table for Pareto check selection"));
  } else {
    const seenIds = new Set();
    const signatures = new Map();
    const requiredObjectives = new Set();
    const classifiedChecks = [];
    for (const row of rows) {
      const checkId = row["Check ID"];
      if (!/^CHECK-[1-9][0-9]*$/.test(checkId)) blocking.push(issue("invalid-check-id", `Verification has invalid Check ID ${checkId || "<missing>"}`));
      else if (seenIds.has(checkId)) blocking.push(issue("duplicate-check-id", `Verification repeats ${checkId}`, { check_id: checkId }));
      else seenIds.add(checkId);
      const boundObjectives = ids(row.Objectives, objectivePattern);
      if (boundObjectives.length === 0 || boundObjectives.some((id) => !objectiveIds.has(id))) blocking.push(issue(
        "invalid-check-objectives",
        `${checkId || "Verification Check"} must reference only current Acceptance objectives`,
        { check_id: checkId || null, objectives: boundObjectives },
      ));
      if (!/^(?:yes|no)$/.test(row.Required)) blocking.push(issue("invalid-required-value", `${checkId || "Verification Check"} Required must be yes or no`, { check_id: checkId || null }));
      if (!/^(?:harness-verifiable|reviewer-observable|human-decision-required)$/.test(row["Evidence Class"])) blocking.push(issue("invalid-evidence-class", `${checkId || "Verification Check"} has an invalid Evidence Class`, { check_id: checkId || null }));
      if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) blocking.push(issue("invalid-cost-class", `${checkId || "Verification Check"} has an invalid Cost Class`, { check_id: checkId || null }));
      else costs[row["Cost Class"]] += 1;
      if (row.Required === "yes") {
        requiredChecks.push(checkId);
        boundObjectives.forEach((id) => requiredObjectives.add(id));
        const signature = [boundObjectives.sort().join(","), row["Verification Intent"], row["Expected Evidence"], targetTokens(row.Prerequisites).sort().join(",")]
          .map((value) => normalizedHeader(value)).join("|");
        classifiedChecks.push({ check_id: checkId, required: true, cost: row["Cost Class"], signature });
        const prior = signatures.get(signature);
        if (prior) blocking.push(issue("duplicate-required-check", `${checkId} duplicates required Check ${prior}`, { check_id: checkId, duplicate_of: prior }));
        else signatures.set(signature, checkId);
        if (row["Cost Class"] === "expensive" && parsed.fields.risk !== "high" && (parsed.fields.hard_triggers ?? []).length === 0) advisories.push(issue(
          "expensive-required-check",
          `${checkId} is expensive and required; retain it only when no cheaper equivalent proves the same essential outcome`,
          { check_id: checkId },
        ));
      } else if (row.Required === "no") {
        deferredChecks.push(checkId);
        classifiedChecks.push({
          check_id: checkId,
          required: false,
          cost: row["Cost Class"],
          signature: [boundObjectives.sort().join(","), row["Verification Intent"], row["Expected Evidence"], targetTokens(row.Prerequisites).sort().join(",")]
            .map((value) => normalizedHeader(value)).join("|"),
        });
      }
    }
    for (const check of classifiedChecks.filter((entry) => entry.required && entry.cost === "expensive")) {
      const cheaper = classifiedChecks.find((entry) => entry.check_id !== check.check_id && entry.signature === check.signature && entry.cost !== "expensive");
      if (cheaper) blocking.push(issue(
        "expensive-required-equivalent",
        `${check.check_id} is required despite cheaper equivalent ${cheaper.check_id}`,
        { check_id: check.check_id, cheaper_check_id: cheaper.check_id },
      ));
    }
    for (const objective of objectiveIds) if (!requiredObjectives.has(objective)) blocking.push(issue(
      "missing-required-check",
      `${objective} needs at least one required falsifiable Check`,
      { objective_id: objective },
    ));
  }

  const projection = authoritativeArtifactProjectionFromText(text, root);
  return {
    feasible: blocking.length === 0,
    root_plan_id: parsed.fields.id,
    root_projection_hash: projection.projection_hash ?? null,
    blocking_issues: blocking,
    advisories,
    required_checks: requiredChecks.filter(Boolean),
    deferred_checks: deferredChecks.filter(Boolean),
    cost_classes: costs,
    approval_granted: false,
    mutation_performed: false,
  };
}

function authoritativeArtifactProjection(artifact, root) {
  const schema = JSON.parse(readFileSync(schemaFor(root, artifact.fields.artifact, artifact.fields.schema), "utf8"));
  const fields = Object.fromEntries(Object.keys(schema.properties ?? {})
    .filter((key) => key !== "extensions" && Object.hasOwn(artifact.fields, key))
    .map((key) => [key, structuredClone(artifact.fields[key])]));
  const sections = (schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? [])
    .map((name) => ({ name, content: artifact.sections.get(name) ?? "" }));
  const projection = stableValue({ fields, sections });
  const projectionText = JSON.stringify(projection, null, 2);
  return {
    errors: [],
    projection,
    projection_text: projectionText,
    projection_hash: sha256(projectionText),
  };
}

export function authoritativeArtifactProjectionFromText(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  if (inspected.errors.length > 0 || !inspected.artifact?.fields?.artifact) {
    return { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a Workflow artifact"] };
  }
  return authoritativeArtifactProjection(inspected.artifact, root);
}

export function executionContractFromArtifactText(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  if (inspected.errors.length > 0 || inspected.artifact?.fields.artifact !== "work-plan") {
    return { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a work-plan"] };
  }
  const artifact = inspected.artifact;
  const data = planData(artifact);
  const authoritative = authoritativeArtifactProjectionFromText(text, root);
  return {
    errors: [],
    fields: structuredClone(authoritative.projection.fields),
    objectives: [...data.objectives],
    checks: [...data.checkRows.values()].map((row) => ({ ...row, "Evidence Class": data.evidenceClasses.get(row["Check ID"]) })),
    allowedTargets: [...data.allowedTargets],
    prohibitedTargets: [...data.prohibitedTargets],
    authoritative_projection: authoritative.projection,
    authoritative_projection_text: authoritative.projection_text,
    authoritative_projection_hash: authoritative.projection_hash,
  };
}

function setUnion(left, right) {
  return new Set([...(left ?? []), ...(right ?? [])]);
}

function disjointCoverage(left, right, expected, label, failures) {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  for (const value of a) if (b.has(value)) failures.push(`${label}: ${value} appears in both fresh and reused coverage`);
  if (!sameSet(setUnion(a, b), new Set(expected))) failures.push(`${label}: fresh and reused coverage must exactly partition the root set`);
}

function correctionForId(artifacts, id) {
  return [...artifacts.values()].find((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.correction_id === id)?.correction ?? null;
}

function materializeEvidence(artifact, artifacts, cache, failures, rootDirectory, active = new Set()) {
  if (cache.has(artifact.fields.id)) return cache.get(artifact.fields.id);
  if (active.has(artifact.fields.id)) {
    failures.push(`${artifact.label}: cyclic evidence chain`);
    return null;
  }
  active.add(artifact.fields.id);
  const root = artifacts.get(artifact.fields.root_plan_id);
  if (!root || root.fields.artifact !== "work-plan") {
    failures.push(`${artifact.label}: missing root plan ${artifact.fields.root_plan_id}`);
    return null;
  }
  const authoritativeRoot = authoritativeArtifactProjection(root, rootDirectory);
  if (artifact.fields.intent_hash !== authoritativeRoot.projection_hash) failures.push(`${artifact.label}: intent_hash does not match authoritative Root projection`);
  const plan = planData(root);
  const data = evidenceData(artifact);
  const fullRequired = root.fields.profile_max !== "manual" || root.fields.risk === "high" || (root.fields.hard_triggers ?? []).length > 0;
  if (fullRequired && artifact.fields.evidence_mode === "lean") failures.push(`${artifact.label}: ${root.fields.profile_max} ${root.fields.risk}-risk root requires evidence_mode full`);
  const predecessor = artifact.fields.predecessor_evidence_id ? artifacts.get(artifact.fields.predecessor_evidence_id) : null;
  const predecessorEffective = predecessor?.fields.artifact === "delivery-evidence" ? materializeEvidence(predecessor, artifacts, cache, failures, rootDirectory, active) : null;
  if (artifact.fields.predecessor_evidence_id && !predecessorEffective) failures.push(`${artifact.label}: missing predecessor evidence ${artifact.fields.predecessor_evidence_id}`);
  if (predecessor && predecessor.fields.root_plan_id !== artifact.fields.root_plan_id) failures.push(`${artifact.label}: predecessor evidence must use the same root plan`);

  const affected = new Set(artifact.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(artifact.fields.reused_objectives ?? []);
  const executed = new Set(artifact.fields.executed_checks ?? []);
  const reusedChecks = new Set(artifact.fields.reused_checks ?? []);
  disjointCoverage(affected, reusedObjectives, plan.objectives, `${artifact.label}: objective`, failures);
  disjointCoverage([...executed].filter((id) => plan.requiredChecks.has(id)), reusedChecks, plan.requiredChecks, `${artifact.label}: root Check`, failures);

  const initial = artifact.fields.representation === "full";
  const seal = artifact.fields.representation === "seal";
  const correction = artifact.fields.representation === "delta";
  if (initial && artifact.fields.subject_id !== root.fields.id) failures.push(`${artifact.label}: initial full evidence must use the Root as subject`);
  if (seal && artifact.fields.subject_id !== root.fields.id) failures.push(`${artifact.label}: seal evidence must use the Root as subject`);
  if (correction && !String(artifact.fields.subject_id).startsWith("cp-")) failures.push(`${artifact.label}: delta evidence must use a correction subject`);
  if (!initial && !predecessorEffective) failures.push(`${artifact.label}: ${seal ? "seal" : "correction"} evidence requires direct predecessor evidence`);
  if (["full", "seal"].includes(artifact.fields.representation) && (reusedObjectives.size > 0 || reusedChecks.size > 0)) failures.push(`${artifact.label}: ${artifact.fields.representation} representation cannot declare reused root state`);

  const objectives = new Map();
  for (const objective of affected) {
    const state = data.objectiveStates.get(objective);
    if (!state) failures.push(`${artifact.label}: affected ${objective} lacks Schema-6 objective evidence`);
    else objectives.set(objective, { ...state, source: artifact.fields.id });
  }
  for (const objective of reusedObjectives) {
    const previous = predecessorEffective?.objectives.get(objective);
    if (!previous) failures.push(`${artifact.label}: reused ${objective} is absent from direct predecessor evidence`);
    else {
      objectives.set(objective, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }

  const checks = new Map();
  for (const id of executed) {
    const state = data.checkStates.get(id);
    if (!state) {
      failures.push(`${artifact.label}: executed ${id} lacks Schema-6 Check evidence`);
      continue;
    }
    const planned = plan.checkRows.get(id) ?? correctionForId(artifacts, artifact.fields.subject_id)?.checks.find((candidate) => candidate["Check ID"] === id);
    if (!planned) failures.push(`${artifact.label}: executed unknown ${id}`);
    checks.set(id, { ...state, source: artifact.fields.id });
  }
  for (const id of reusedChecks) {
    const previous = predecessorEffective?.checks.get(id);
    const planned = plan.checkRows.get(id);
    if (!previous || !planned) failures.push(`${artifact.label}: reused ${id} is absent from direct predecessor root evidence`);
    else {
      checks.set(id, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }

  for (const target of data.changedPaths) {
    const authority = authorityTargetState(target, root.fields.authority);
    const manualUnverified = root.fields.profile_max === "manual"
      && artifact.fields.overall_grade !== "verified"
      && artifact.fields.representation !== "seal";
    if (authority.protected || authority.approval_required) {
      if (!manualUnverified || artifact.fields.status !== "blocked") {
        failures.push(`${artifact.label}: changed target ${target} crosses a hard root boundary`);
      }
    } else if (!authority.allowed && (!manualUnverified || artifact.fields.status === "complete")) {
      failures.push(`${artifact.label}: changed target ${target} is outside root scope`);
    }
  }

  if (initial) {
    const delivered = new Set(data.objectiveStates.keys());
    if (!sameSet(delivered, plan.objectives)) failures.push(`${artifact.label}: initial evidence must cover every root objective`);
    if (artifact.fields.source_review_id || artifact.fields.predecessor_evidence_id) failures.push(`${artifact.label}: initial evidence cannot reference review or predecessor evidence`);
  } else if (seal) {
    const sourceReview = artifacts.get(artifact.fields.source_review_id);
    if (!sourceReview || sourceReview.fields.artifact !== "work-review") failures.push(`${artifact.label}: seal evidence requires its exact source Review`);
    else {
      if (sourceReview.fields.root_plan_id !== root.fields.id
        || sourceReview.fields.latest_evidence_id !== artifact.fields.predecessor_evidence_id) failures.push(`${artifact.label}: seal source Review must bind the direct predecessor Evidence`);
      const sealableDecision = sourceReview.fields.delivery_status === "provisional"
        && ((sourceReview.fields.assessment === "achieved" && sourceReview.fields.next_action === "none")
          || (sourceReview.fields.assessment === "provisional" && sourceReview.fields.next_action === "accept-provisional"));
      if (!sealableDecision
        || sourceReview.fields.correction_id
        || reviewData(sourceReview).findings.length > 0) failures.push(`${artifact.label}: seal source Review must be a finding-free provisional tip`);
    }
    if (artifact.fields.status !== "complete"
      || artifact.fields.overall_grade !== "verified"
      || (artifact.fields.check_evidence ?? []).some((entry) => entry.grade !== "verified")) failures.push(`${artifact.label}: seal evidence requires fresh verified coverage for every required Check`);
  } else {
    const sourceReview = artifacts.get(artifact.fields.source_review_id);
    const correction = correctionForId(artifacts, artifact.fields.subject_id);
    if (!sourceReview || sourceReview.fields.correction_id !== artifact.fields.subject_id || !correction) failures.push(`${artifact.label}: correction evidence does not resolve its source review and correction`);
    else {
      for (const check of correction.checks.filter((row) => row.Required === "yes")) if (!executed.has(check["Check ID"])) failures.push(`${artifact.label}: missing executed correction Check ${check["Check ID"]}`);
    }
  }

  const reviewReady = ["complete", "provisional"].includes(artifact.fields.status)
    && ["verified", "supported"].includes(artifact.fields.overall_grade)
    && [...plan.requiredChecks].every((id) => checks.get(id)?.status === "passed");
  const effective = {
    root,
    plan,
    objectives,
    checks,
    workspaceSnapshotHash: data.workspaceSnapshotHash,
    reviewReady,
    predecessor: predecessorEffective,
  };
  artifact.effective = effective;
  cache.set(artifact.fields.id, effective);
  active.delete(artifact.fields.id);
  return effective;
}

function validateCompactCorrection(review, root, evidence, artifacts, failures) {
  const correction = review.correction;
  if (!correction) return;
  const metadata = correction.metadata ?? {};
  if (metadata["Correction ID"] !== review.fields.correction_id) failures.push(`${review.label}: correction metadata ID mismatch`);
  if (metadata["Root Plan"] !== root.fields.id) failures.push(`${review.label}: correction root mismatch`);
  if (metadata["Source Review"] !== review.fields.id) failures.push(`${review.label}: correction source review mismatch`);
  if (metadata["Base Evidence"] !== evidence.fields.id) failures.push(`${review.label}: correction base evidence mismatch`);
  if ((riskRank[metadata.Risk] ?? 99) > (riskRank[root.fields.risk] ?? 0)) failures.push(`${review.label}: correction raises root risk and requires replan`);
  const plan = planData(root);
  const findingKeys = new Set(reviewData(review).findings.map((row) => row["Finding key"]));
  for (const fix of correction.fixes) {
    for (const key of String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean)) if (!findingKeys.has(key)) failures.push(`${review.label}: correction references unknown Finding key ${key}`);
    for (const objective of ids(fix["Root Objectives"], objectivePattern)) if (!plan.objectives.has(objective)) failures.push(`${review.label}: correction references unknown root ${objective}`);
    for (const check of ids(fix["Root Checks"], checkPattern)) if (!plan.checks.has(check)) failures.push(`${review.label}: correction references unknown root ${check}`);
  }
  for (const step of correction.steps) for (const target of targetTokens(step.Targets)) {
    const authority = authorityTargetState(target, root.fields.authority);
    if (authority.protected || authority.approval_required) failures.push(`${review.label}: correction target ${target} crosses a hard root boundary`);
  }
}

function progressState(review, artifacts) {
  const evidence = artifacts.get(review.fields.latest_evidence_id);
  const effective = evidence?.effective;
  const findings = reviewData(review).findings;
  return new Map(findings.map((finding) => {
    const objectives = ids(finding.Objectives, objectivePattern);
    const checks = ids(finding.Checks, checkPattern);
    const objectiveRank = objectives.reduce((sum, id) => sum + ({ blocked: 0, "not-achieved": 1, "partially-achieved": 2, achieved: 3 }[effective?.objectives.get(id)?.status] ?? 0), 0);
    const passedChecks = checks.filter((id) => effective?.checks.get(id)?.status === "passed").length;
    const snapshotSignature = effective?.workspaceSnapshotHash ?? "missing";
    return [finding["Finding key"], { severity: ({ critical: 4, high: 3, medium: 2, low: 1 }[finding.Severity] ?? 9), objectiveRank, passedChecks, snapshotSignature }];
  }));
}

function measurableProgress(previous, current) {
  if (!previous || !current) return false;
  return current.severity < previous.severity || current.objectiveRank > previous.objectiveRank || current.passedChecks > previous.passedChecks || current.snapshotSignature !== previous.snapshotSignature;
}

function validatePlanLineage(artifacts, failures) {
  const plans = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-plan");
  const plansById = new Map(plans.map((plan) => [plan.fields.id, plan]));
  const successors = new Map();
  for (const plan of plans) {
    const predecessorId = plan.fields.predecessor_plan_id;
    const sourceReviewId = plan.fields.replan_source_review_id;
    if (!predecessorId && !sourceReviewId) continue;
    if (!predecessorId || !sourceReviewId) continue;
    if (predecessorId === plan.fields.id) failures.push(`${plan.label}: replan root cannot reference itself`);
    const predecessor = plansById.get(predecessorId);
    if (!predecessor) failures.push(`${plan.label}: missing predecessor plan ${predecessorId}`);
    const sourceReview = artifacts.get(sourceReviewId);
    if (!sourceReview || sourceReview.fields.artifact !== "work-review") failures.push(`${plan.label}: missing replan source review ${sourceReviewId}`);
    else {
      if (sourceReview.fields.root_plan_id !== predecessorId) failures.push(`${plan.label}: replan source review must belong to predecessor plan ${predecessorId}`);
      if (sourceReview.fields.next_action !== "replan") failures.push(`${plan.label}: replan source review must require next_action replan`);
      const predecessorReviews = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === predecessorId);
      const referencedReviews = new Set(predecessorReviews.map((review) => review.fields.predecessor_review_id).filter(Boolean));
      const reviewTips = predecessorReviews.filter((review) => !referencedReviews.has(review.fields.id));
      if (reviewTips.length !== 1 || reviewTips[0].fields.id !== sourceReviewId) failures.push(`${plan.label}: replan source review must be the unique current predecessor review tip`);
    }
    const list = successors.get(predecessorId) ?? [];
    list.push(plan);
    successors.set(predecessorId, list);
  }
  for (const [predecessorId, list] of successors) if (list.length > 1) failures.push(`work-plan lineage branches after ${predecessorId}`);

  const visiting = new Set();
  const visited = new Set();
  const visit = (plan) => {
    if (visited.has(plan.fields.id)) return;
    if (visiting.has(plan.fields.id)) {
      failures.push(`work-plan lineage is cyclic at ${plan.fields.id}`);
      return;
    }
    visiting.add(plan.fields.id);
    const predecessor = plansById.get(plan.fields.predecessor_plan_id);
    if (predecessor) visit(predecessor);
    visiting.delete(plan.fields.id);
    visited.add(plan.fields.id);
  };
  plans.forEach(visit);

  const referencedPlans = new Set(plans.map((plan) => plan.fields.predecessor_plan_id).filter(Boolean));
  return plans.filter((plan) => !referencedPlans.has(plan.fields.id)).map((plan) => plan.fields.id).sort();
}

function inspectCompactArtifactSet(entries, root = defaultRoot, options = {}) {
  const errors = [];
  const diagnostics = [];
  const normalizations = [];
  const artifacts = new Map();
  for (const [label, text] of entries) {
    const probeErrors = [];
    const probe = parseArtifact(text, probeErrors, []);
    const type = probe?.fields.artifact;
    if (type && !knownArtifacts.has(type) && !existsSync(schemaFor(root, type))) {
      const workflowShaped = /^(?:work|delivery)-/.test(type) || /^(?:wp|de|wr|cp|rs)-/.test(String(probe?.fields.id ?? ""));
      if (workflowShaped) errors.push(`${label}: unsupported workflow artifact type`);
      continue;
    }
    const built = buildArtifact(text, root, { deferReferences: true });
    built.failures.forEach((failure) => errors.push(`${label}: ${failure}`));
    built.diagnostics.forEach((item) => diagnostics.push(`${label}: ${item}`));
    built.normalizations.forEach((item) => normalizations.push(`${label}: ${item}`));
    if (built.failures.length > 0 || !built.parsed?.fields.id) continue;
    if (artifacts.has(built.parsed.fields.id)) errors.push(`${label}: duplicate artifact ID ${built.parsed.fields.id}`);
    artifacts.set(built.parsed.fields.id, { label, text, ...built.parsed });
  }

  const rootTips = validatePlanLineage(artifacts, errors);
  const evidenceCache = new Map();
  const evidenceByRoot = new Map();
  const orderedEvidenceByRoot = new Map();
  const reviewsByRoot = new Map();
  for (const artifact of artifacts.values()) {
    if (artifact.fields.artifact === "delivery-evidence") {
      materializeEvidence(artifact, artifacts, evidenceCache, errors, root);
      const list = evidenceByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact);
      evidenceByRoot.set(artifact.fields.root_plan_id, list);
    }
    if (artifact.fields.artifact === "work-review") {
      const list = reviewsByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact);
      reviewsByRoot.set(artifact.fields.root_plan_id, list);
    }
  }

  for (const [rootId, evidence] of evidenceByRoot) {
    if (evidence.filter((item) => item.fields.representation === "full").length !== 1) errors.push(`${rootId}: evidence chain requires exactly one initial root delivery`);
    orderedEvidenceByRoot.set(rootId, linearChain(evidence, "predecessor_evidence_id", `${rootId}: evidence`, errors));
  }

  for (const [rootId, reviews] of reviewsByRoot) {
    const rootPlan = artifacts.get(rootId);
    if (!rootPlan || rootPlan.fields.artifact !== "work-plan") {
      errors.push(`${rootId}: reviews require a root plan`);
      continue;
    }
    const plan = planData(rootPlan);
    const ordered = linearChain(reviews, "predecessor_review_id", `${rootId}: review`, errors);
    const learningOwners = new Map();
    for (const review of ordered) for (const learning of review.correction?.learnings ?? []) {
      const id = learning["Learning ID"];
      if (learningOwners.has(id)) errors.push(`${review.label}: learning candidate ${id} duplicates ${learningOwners.get(id).label} within root ${rootId}`);
      else learningOwners.set(id, review);
    }
    const reviewIndex = new Map(ordered.map((review, index) => [review.fields.id, index]));
    const rootEvidence = orderedEvidenceByRoot.get(rootId) ?? [];
    for (let index = 0; index < ordered.length; index += 1) {
      const review = ordered[index];
      for (const learningId of review.fields.learning_candidates ?? []) {
        const owner = learningOwners.get(learningId);
        if (!owner) errors.push(`${review.label}: learning candidate ${learningId} has no correction source in root ${rootId}`);
        else if ((reviewIndex.get(owner.fields.id) ?? Number.POSITIVE_INFINITY) > index) errors.push(`${review.label}: learning candidate ${learningId} is declared before its correction source`);
      }
      const boundaryReview = review.fields.review_basis === "root-boundary";
      if (boundaryReview) {
        const receipt = review.fields.boundary_receipt ?? {};
        if (receipt.root_content_hash !== sha256(rootPlan.text)) errors.push(`${review.label}: boundary receipt root_content_hash does not match exact Root bytes`);
        for (const path of receipt.observed_paths ?? []) {
          if (path.startsWith("/") || path === ".." || path.startsWith("../") || path.includes("\\")) {
            errors.push(`${review.label}: boundary receipt path must remain normalized and repository-relative: ${path}`);
          }
        }
        if (typeof options.boundaryReceiptVerifier !== "function") {
          errors.push(`${review.label}: root-boundary review requires a fresh protected host receipt; portable or rootless validation fails closed`);
        } else {
          try {
            const trusted = options.boundaryReceiptVerifier({ receipt, rootPlanText: rootPlan.text, reviewFields: review.fields });
            if (trusted?.ok !== true) errors.push(`${review.label}: boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
          } catch (error) {
            errors.push(`${review.label}: boundary receipt host verification failed: ${String(error?.message ?? error)}`);
          }
        }
        review.effective = {
          ...review.effective,
          contractLevel: rootPlan.fields.contract_level,
          workspaceSnapshotHash: receipt.repository_snapshot_hash ?? null,
          correctionRound: rootEvidence.length > 0 ? rootEvidence.length - 1 : 0,
          reviewReady: false,
          loopState: "blocked",
          boundaryReview: true,
          coverage: {
            objectivesInspected: 0,
            objectivesReused: 0,
            checksExecuted: 0,
            checksReused: 0,
          },
        };
        continue;
      }
      const evidence = artifacts.get(review.fields.latest_evidence_id);
      if (!evidence || evidence.fields.artifact !== "delivery-evidence") {
        errors.push(`${review.label}: missing latest evidence ${review.fields.latest_evidence_id}`);
        continue;
      }
      const effective = evidence.effective;
      if (evidence.fields.root_plan_id !== rootId) errors.push(`${review.label}: latest evidence belongs to another root`);
      if (evidence.fields.representation === "seal") {
        if (review.fields.predecessor_review_id !== evidence.fields.source_review_id) errors.push(`${review.label}: sealed Review must directly follow its source provisional Review`);
        if (review.fields.assessment !== "achieved" || review.fields.delivery_status !== "verified" || review.fields.next_action !== "none") errors.push(`${review.label}: sealed Review must be achieved, verified, and terminal`);
      }
      const knownFailedEvidence = evidenceHasKnownFailure(evidence.fields);
      if (knownFailedEvidence && review.fields.delivery_status !== "blocked") errors.push(`${review.label}: known failed or blocked evidence requires blocked delivery_status`);
      if (knownFailedEvidence && ["accept-provisional", "none"].includes(review.fields.next_action)) errors.push(`${review.label}: known failed or blocked evidence cannot be accepted or achieved`);
      const candidates = rootEvidence.filter((item) => item.fields.source_review_id === null || (reviewIndex.get(item.fields.source_review_id) ?? Number.POSITIVE_INFINITY) < index);
      if (candidates.at(-1)?.fields.id !== review.fields.latest_evidence_id) errors.push(`${review.label}: latest_evidence_id is not the evidence tip at review time`);

      disjointCoverage(review.fields.inspected_objectives, review.fields.reused_objectives, plan.objectives, `${review.label}: objective review`, errors);
      disjointCoverage(review.fields.inspected_checks, review.fields.reused_checks, plan.requiredChecks, `${review.label}: Check review`, errors);
      if (index === 0 && ((review.fields.reused_objectives ?? []).length > 0 || (review.fields.reused_checks ?? []).length > 0)) errors.push(`${review.label}: first review must inspect all root evidence`);
      for (const objective of review.fields.reused_objectives ?? []) {
        if (!evidence.fields.reused_objectives.includes(objective)) errors.push(`${review.label}: reused review objective ${objective} lacks delta-evidence reuse`);
        const previousEvidence = index > 0 ? artifacts.get(ordered[index - 1].fields.latest_evidence_id)?.effective : null;
        if (previousEvidence?.objectives.get(objective)?.status !== "achieved") errors.push(`${review.label}: reused objective ${objective} requires achieved predecessor status`);
        if (reviewData(review).findings.some((finding) => ids(finding.Objectives, objectivePattern).includes(objective))) errors.push(`${review.label}: reused objective ${objective} has a current finding`);
      }
      for (const check of review.fields.reused_checks ?? []) if (!evidence.fields.reused_checks.includes(check) || effective?.checks.get(check)?.status !== "passed") errors.push(`${review.label}: reused Check ${check} lacks valid passed delta evidence`);

      if (review.fields.assessment === "achieved") {
        if (!effective?.reviewReady) errors.push(`${review.label}: achieved requires complete effective root-check evidence`);
        if ([...plan.objectives].some((id) => effective?.objectives.get(id)?.status !== "achieved")) errors.push(`${review.label}: achieved requires every effective root objective achieved`);
        if (reviewData(review).findings.length > 0) errors.push(`${review.label}: achieved cannot contain findings`);
      }
      review.effective = {
        ...review.effective,
        contractLevel: rootPlan.fields.contract_level,
        workspaceSnapshotHash: evidence.fields.workspace_snapshot_hash ?? null,
        correctionRound: candidates.length - 1,
        reviewReady: effective?.reviewReady ?? false,
        loopState: reviewData(review).findings.length > 0 ? "degraded" : "healthy",
        coverage: {
          objectivesInspected: review.fields.inspected_objectives.length,
          objectivesReused: review.fields.reused_objectives.length,
          checksExecuted: review.fields.inspected_checks.length,
          checksReused: review.fields.reused_checks.length,
        },
      };
      validateCompactCorrection(review, rootPlan, evidence, artifacts, errors);
    }

    for (let index = 2; index < ordered.length; index += 1) {
      const window = ordered.slice(index - 2, index + 1);
      if (window.some((review) => review.fields.review_basis === "root-boundary")) continue;
      const priorCorrectionsExecuted = window.slice(0, 2).every((review) => review.fields.correction_id && [...artifacts.values()].some((candidate) => candidate.fields.artifact === "delivery-evidence" && candidate.fields.subject_id === review.fields.correction_id));
      if (!priorCorrectionsExecuted) continue;
      const states = window.map((review) => progressState(review, artifacts));
      for (const key of states[2].keys()) {
        if (!states[0].has(key) || !states[1].has(key)) continue;
        const progressed = measurableProgress(states[0].get(key), states[1].get(key)) || measurableProgress(states[1].get(key), states[2].get(key));
        if (!progressed) {
          const current = window[2];
          current.effective.loopState = "stalled";
          diagnostics.push(`${current.label}: Finding key ${key} survived two corrections without measurable progress; clarify or replan is recommended`);
          if (!["clarify", "replan"].includes(current.fields.next_action)) {
            errors.push(`${current.label}: two correction rounds without measurable progress require next_action clarify or replan`);
          }
        }
      }
      if (!window[2].effective.loopState) window[2].effective.loopState = reviewData(window[2]).findings.length > 0 ? "degraded" : "healthy";
    }
  }

  return { errors: unique(errors), diagnostics: unique(diagnostics), normalizations: unique(normalizations), effective: artifacts, root_tips: rootTips };
}

export function inspectArtifactSet(entries, root = defaultRoot, options = {}) {
  return inspectCompactArtifactSet(entries, root, options);
}

export function validateArtifactSet(entries, root = defaultRoot, options = {}) {
  return inspectCompactArtifactSet(entries, root, options).errors;
}

export function effectiveCliSummary(inspection) {
  if (!(inspection.effective instanceof Map)) return { active_root_id: null, root_tips: [], evidence_tips: {}, review_tips: {}, actionable_reviews: [], learning_candidates: [] };
  const artifacts = [...inspection.effective.values()];
  const tips = (type, predecessorField) => {
    const items = artifacts.filter((artifact) => artifact.fields.artifact === type);
    return Object.fromEntries(lineageTips(items, predecessorField).map((artifact) => [artifact.fields.root_plan_id, artifact.fields.id]));
  };
  const rootTips = inspection.root_tips ?? validatePlanLineage(inspection.effective, []);
  const activeRootId = rootTips.length === 1 ? rootTips[0] : null;
  const evidenceTips = tips("delivery-evidence", "predecessor_evidence_id");
  const reviewTips = tips("work-review", "predecessor_review_id");
  const activeReview = activeRootId && reviewTips[activeRootId] ? inspection.effective.get(reviewTips[activeRootId]) : null;
  const activeEvidence = activeRootId && evidenceTips[activeRootId] ? inspection.effective.get(evidenceTips[activeRootId]) : null;
  const activeLearningIds = new Set(activeReview?.fields.learning_candidates ?? []);
  const learningEligible = activeReview?.fields.assessment === "achieved"
    && activeReview?.fields.next_action === "none"
    && ["verified", "supported"].includes(activeEvidence?.fields.overall_grade);
  const learningCandidates = artifacts
    .filter((artifact) => artifact.fields.artifact === "work-review"
      && artifact.fields.root_plan_id === activeRootId
      && learningEligible
      && artifact.correction?.learnings?.length > 0)
    .flatMap((artifact) => artifact.correction.learnings
      .filter((learning) => activeLearningIds.has(learning["Learning ID"]))
      .map((learning) => {
      const evidence = artifacts.find((candidate) => candidate.fields.artifact === "delivery-evidence"
        && candidate.fields.subject_id === artifact.fields.correction_id
        && candidate.fields.status !== "blocked"
        && ["verified", "supported"].includes(candidate.fields.overall_grade));
      return {
        source_kind: "manual-correction",
        root_plan_id: artifact.fields.root_plan_id,
        review_id: artifact.fields.id,
        correction_id: artifact.fields.correction_id,
        learning_id: learning["Learning ID"],
        finding_keys: String(learning["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean),
        reusable_guidance: learning["Reusable guidance"],
        candidate_targets: targetTokens(learning["Candidate targets"]),
        confirmation_evidence: learning["Confirmation evidence"],
        correction_evidence_id: evidence?.fields.id ?? null,
        evidence_confirmed: Boolean(evidence),
      };
    }))
    .toSorted((left, right) => left.review_id.localeCompare(right.review_id) || left.learning_id.localeCompare(right.learning_id));
  return {
    active_root_id: activeRootId,
    root_tips: rootTips,
    evidence_tips: evidenceTips,
    review_tips: reviewTips,
    actionable_reviews: artifacts
      .filter((artifact) => artifact.fields.artifact === "work-review"
        && artifact.fields.root_plan_id === activeRootId
        && artifact.fields.id === reviewTips[activeRootId]
        && artifact.fields.next_action === "correct")
      .map((artifact) => ({ root_plan_id: artifact.fields.root_plan_id, review_id: artifact.fields.id, correction_id: artifact.fields.correction_id, base_evidence_id: artifact.fields.latest_evidence_id })),
    learning_candidates: learningCandidates,
  };
}

function runCli() {
  const diagnosticsRequested = process.argv.includes("--diagnostics");
  const effectiveRequested = process.argv.includes("--effective");
  const paths = process.argv.slice(2).filter((value) => !["--diagnostics", "--effective"].includes(value));
  if (paths.length === 0) {
    console.error("Usage: validate-artifact.mjs [--diagnostics] [--effective] <artifact.md> [related-artifact.md ...]");
    process.exitCode = 2;
    return;
  }
  const entries = paths.map((path) => [path, readFileSync(resolve(path), "utf8")]);
  const inspection = entries.length === 1 ? inspectArtifactText(entries[0][1]) : inspectArtifactSet(entries);
  if (inspection.errors.length > 0) {
    console.error("Artifact validation failed:");
    inspection.errors.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  if (effectiveRequested) {
    console.log(JSON.stringify({ status: "passed", ...effectiveCliSummary(inspection), normalizations: diagnosticsRequested ? inspection.normalizations : undefined, diagnostics: diagnosticsRequested ? inspection.diagnostics : undefined }, null, 2));
    return;
  }
  console.log(entries.length === 1 ? "Artifact validation passed." : "Artifact chain validation passed.");
  if (diagnosticsRequested) {
    inspection.normalizations.forEach((item) => console.log(`NORMALIZED: ${item}`));
    inspection.diagnostics.forEach((item) => console.log(`DIAGNOSTIC: ${item}`));
  }
}

if (process.argv[1]
  && ["validate-artifact.source.mjs", "validate-artifact.mjs"].includes(basename(process.argv[1]))
  && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) runCli();
