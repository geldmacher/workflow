#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceHasKnownFailure, leanEvidenceData } from "./artifact-validator/evidence.mjs";
import { linearChain, lineageTips } from "./artifact-validator/lineage.mjs";
import { opaqueExtensionsFromArtifactText, parseArtifact, replaceOpaqueExtensions } from "./artifact-validator/parser.mjs";
import { schemaFor, validateArtifactSchema } from "./artifact-validator/schema.mjs";

export { opaqueExtensionsFromArtifactText, parseArtifact, replaceOpaqueExtensions };

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = dirname(scriptDirectory);

const knownArtifacts = new Set([
  "work-plan",
  "delivery-evidence",
  "work-review",
]);
const riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });
const assuranceRank = Object.freeze({ lean: 1, standard: 2, deep: 3 });
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
const stepPattern = /\bSTEP-[1-9][0-9]*\b/g;
const slicePattern = /\bSLICE-[1-9][0-9]*\b/g;
const learningPattern = /\bLRN-[A-Za-z0-9][A-Za-z0-9-]*\b/g;
const modelInheritMarker = "[workflow-model-inherit-v1]";
const requiredScopeCategories = ["required", "permitted", "prohibited"];
const baselineKinds = ["repository", "head", "dirty-files", "known-failures", "targets-and-prerequisites"];

const sectionAliases = Object.freeze({
  Intent: ["intent", "goal", "intent contract"],
  Acceptance: ["acceptance", "acceptance outcomes", "success criteria"],
  Boundaries: ["boundaries", "authority", "authority envelope"],
  Risks: ["risks", "risk summary"],
  "Intent and decisions": ["intent", "intent readiness", "intent and decisions"],
  Objectives: ["objectives", "goals"],
  "Evidence and baseline": ["baseline", "baseline evidence", "evidence and baseline"],
  "Scope and targets": ["scope", "targets", "scope and targets"],
  "Execution steps": ["steps", "implementation steps", "execution steps"],
  Verification: ["verification", "root checks", "planned checks"],
  "Operational readiness": ["operations", "operational readiness"],
  "Risk and closeout": ["risk", "assurance", "risk and closeout"],
  Summary: ["summary", "delivery summary"],
  "Subject results": ["subject results", "fix results"],
  "Objective outcomes": ["objective outcomes", "delivered objectives"],
  Changes: ["changes", "changed targets"],
  "Repository snapshot": ["snapshot", "repository snapshot"],
  Checks: ["checks", "check results", "verification results"],
  "Idempotency and resume": ["resume", "execution state", "idempotency and resume"],
  Deviations: ["deviations"],
  "Operational evidence": ["operational evidence", "operations evidence"],
  "Residual risks": ["residual risks", "remaining risks"],
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
  "command or inspection": ["command", "inspection", "command or inspection", "execution"],
  "working directory": ["working directory", "cwd"],
  "cost class": ["cost", "cost class"],
  "evidence class": ["evidence class", "verification owner", "evidence owner"],
  prerequisites: ["prerequisite", "prerequisites", "dependencies"],
  "prerequisite fingerprints": ["prerequisite fingerprints", "dependency fingerprints", "reuse evidence"],
  "relevant fingerprints": ["relevant fingerprints", "dependency fingerprints", "reuse evidence"],
  "finding key": ["finding", "finding key"],
  "learning id": ["learning", "learning id", "candidate", "candidate id"],
});
const optionalTableCells = new Set(["prerequisite fingerprints", "relevant fingerprints"]);

const tables = Object.freeze({
  readiness: ["Readiness item", "Resolution", "Evidence"],
  decisions: ["Decision ID", "Choice", "Rationale", "Rejected alternative", "Source"],
  objectives: ["Objective ID", "Observable outcome", "Acceptance evidence"],
  baseline: ["Evidence ID", "Kind", "Observation", "Source"],
  scope: ["Category", "Targets", "Boundary"],
  steps: ["Step ID", "Objectives", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"],
  verification: ["Check ID", "Objectives", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"],
  verificationWithClass: ["Check ID", "Objectives", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Evidence Class", "Cost Class", "Prerequisites"],
  productRequirements: ["Requirement ID", "Need", "Actor", "Observable outcome", "Non-goal or constraint"],
  systemImpact: ["Surface", "Current state", "Required change", "Invariant", "Evidence"],
  programDesign: ["Design ID", "Responsibility", "Interfaces", "Invariants", "Failure handling"],
  slices: ["Slice ID", "Objectives", "Dependencies", "Targets", "Observable outcome", "Check IDs", "Human review"],
  operational: ["Concern", "Requirement", "Repository proof"],
  assuranceFactors: ["Factor", "Score", "Evidence"],
  controls: ["Control ID", "Control", "Objective or failure mode", "Expected benefit", "Cost class", "Decision", "Rationale"],
  results: ["Objective ID", "Result", "Evidence"],
  changes: ["Path or Symbol", "Change", "Objective Coverage"],
  objectiveOutcomes: ["Objective ID", "Status", "Evidence"],
  snapshot: ["Snapshot ID", "HEAD", "Working tree", "Changed paths", "Relevant fingerprints", "Known failures"],
  checks: ["Check ID", "Observed Result", "Status", "Prerequisite fingerprints"],
  resume: ["Step ID", "State", "Completion probe", "Evidence"],
  deviations: ["Deviation ID", "Scope", "Approval", "Outcome", "Evidence"],
  operationalEvidence: ["Concern", "Plan requirement", "Repository proof", "Status"],
  coverage: ["Kind", "Inspected", "Reused", "Result", "Evidence"],
  findings: ["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning"],
  correctionMeta: ["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"],
  fixes: ["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"],
  correctionSteps: ["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"],
  correctionChecks: ["Check ID", "FIX IDs", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"],
  learningCandidates: ["Learning ID", "Finding keys", "Reusable guidance", "Candidate targets", "Confirmation evidence"],
});

const assuranceFactors = Object.freeze([
  ["Failure impact", 0, 3],
  ["Irreversibility", 0, 2],
  ["Uncertainty", 0, 2],
  ["Evidence weakness", 0, 2],
  ["Change surface", 0, 1],
]);
const costRank = Object.freeze({ cheap: 1, standard: 2, expensive: 3 });

const readinessItems = [
  "Goal",
  "Actor",
  "Outcome",
  "Non-goals",
  "Constraints",
  "Repository boundary",
  "Acceptance evidence",
  "Critical assumptions",
  "Operational impact",
  "Review risk",
  "Material open decisions",
];

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
  return /<(?:placeholder|replace[-_ ]?me|insert[-_ ][^>\r\n]+|[^>\r\n]*\.{3}[^>\r\n]*)>|\b(?:TBD|TODO|UNKNOWN)\b/i.test(String(value));
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
  if (target === candidate || target.startsWith(`${candidate}/`) || target.startsWith(`${candidate}#`) || target.startsWith(`${candidate}:`)) return true;
  if (!candidate.includes("*")) return false;
  const expression = candidate.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("**", "§§").replaceAll("*", "[^/]*").replaceAll("§§", ".*");
  return new RegExp(`^${expression}$`).test(target);
}

function fingerprintMap(value) {
  const entries = [...String(value ?? "").matchAll(/`([^`]+)`=([a-f0-9]{64})/g)];
  return new Map(entries.map((match) => [match[1].replace(/^\.\//, ""), match[2]]));
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

function derivedAssurance(score, triggers) {
  if ((triggers ?? []).length > 0) return "deep";
  if (score <= 3) return "lean";
  if (score <= 6) return "standard";
  return "deep";
}

function planData(artifact) {
  if (artifact.fields.schema >= 4) {
    const objectives = artifact.fields.acceptance.map((outcome, index) => ({
      "Objective ID": `OBJ-${index + 1}`,
      "Observable outcome": outcome,
      "Acceptance evidence": outcome,
    }));
    const declaredChecks = tableRows(artifact.sections.get("Verification") ?? "", tables.verification);
    const declaredWithClass = tableRows(artifact.sections.get("Verification") ?? "", tables.verificationWithClass);
    const checks = declaredChecks.length > 0 ? declaredChecks : objectives.map((objective, index) => ({
      "Check ID": `CHECK-${index + 1}`,
      Objectives: objective["Objective ID"],
      "Working Directory": "repository root",
      "Command or Inspection": "verification-profile",
      "Expected Result": objective["Observable outcome"],
      Required: "yes",
      "Cost Class": "standard",
      Prerequisites: artifact.fields.authority.allowed_roots.join(", "),
    }));
    const evidenceClasses = declaredWithClass.length > 0
      ? new Map(declaredWithClass.map((row) => [row["Check ID"], row["Evidence Class"]]))
      : new Map(checks.map((row) => [row["Check ID"], "human-review-required"]));
    const objectiveIds = objectives.map((row) => row["Objective ID"]);
    return {
      objectives: new Set(objectiveIds),
      checks: new Set(checks.map((row) => row["Check ID"])),
      checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
      evidenceClasses,
      slices: [{
        "Slice ID": "SLICE-1", Objectives: objectiveIds.join(", "), Dependencies: "None.",
        Targets: artifact.fields.authority.allowed_roots.join(", "),
        "Observable outcome": artifact.fields.goal,
        "Check IDs": checks.map((row) => row["Check ID"]).join(", "), "Human review": "no",
      }],
      steps: new Set(["STEP-1"]),
      requiredChecks: new Set(checks.filter((row) => row.Required === "yes").map((row) => row["Check ID"])),
      allowedTargets: [...artifact.fields.authority.allowed_roots],
      prohibitedTargets: [...artifact.fields.authority.protected_paths, ...artifact.fields.authority.approval_required_paths],
      objectiveDependencies: new Map(objectiveIds.map((id) => [id, new Set(artifact.fields.authority.allowed_roots)])),
    };
  }
  const objectives = tableRows(artifact.sections.get("Objectives") ?? "", tables.objectives);
  const checks = tableRows(artifact.sections.get("Verification") ?? "", tables.verification);
  const steps = tableRows(artifact.sections.get("Execution steps") ?? "", tables.steps);
  const scope = tableRows(artifact.sections.get("Scope and targets") ?? "", tables.scope);
  const verificationWithClass = tableRows(artifact.sections.get("Verification") ?? "", tables.verificationWithClass);
  const slices = tableRows(subsection(artifact.sections.get("Execution steps") ?? "", "Vertical slices"), tables.slices);
  const objectiveDependencies = new Map(objectives.map((row) => [row["Objective ID"], new Set()]));
  for (const check of checks) for (const objective of ids(check.Objectives, objectivePattern)) for (const target of targetTokens(check.Prerequisites)) objectiveDependencies.get(objective)?.add(target);
  return {
    objectives: new Set(objectives.map((row) => row["Objective ID"])),
    checks: new Set(checks.map((row) => row["Check ID"])),
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    evidenceClasses: new Map(verificationWithClass.map((row) => [row["Check ID"], row["Evidence Class"]])),
    slices,
    steps: new Set(steps.map((row) => row["Step ID"])),
    requiredChecks: new Set(checks.filter((row) => row.Required === "yes").map((row) => row["Check ID"])),
    allowedTargets: scope.filter((row) => ["required", "permitted", "incidental"].includes(row.Category)).flatMap((row) => targetTokens(row.Targets)),
    prohibitedTargets: scope.filter((row) => row.Category === "prohibited").flatMap((row) => targetTokens(row.Targets)),
    objectiveDependencies,
  };
}

function validatePlanV4(parsed, sections, failures) {
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
  const verification = tableRows(sections.get("Verification") ?? "", tables.verificationWithClass);
  for (const row of verification) {
    if (!/^CHECK-[1-9][0-9]*$/.test(row["Check ID"])) failures.push(`Verification: invalid Check ID ${row["Check ID"]}`);
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(row["Evidence Class"])) failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  if (verification.length === 0) parsed.normalizations.push("synthesized strategy checks from acceptance outcomes");
  if (data.objectives.size !== parsed.fields.acceptance.length) failures.push("acceptance outcomes must map one-to-one to objectives");
  if (parsed.wrapper) {
    const todos = parsed.wrapper.todos ?? [];
    for (const todo of todos) {
      if (!String(todo.content ?? "").startsWith(modelInheritMarker)) failures.push(`native todo ${todo.id ?? "<unknown>"} must start with ${modelInheritMarker}`);
    }
    const final = String(todos.at(-1)?.content ?? "");
    if (!/verify|check|evidence|snapshot/i.test(final)) failures.push("final native todo must verify or evidence the implemented result");
    if (parsed.fields.schema === 5 && !/workflow_closeout/.test(final)) failures.push("final native todo must call workflow_closeout");
  }
}

function evidenceData(artifact) {
  if (artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean") return leanEvidenceData(artifact.fields);
  const results = tableRows(artifact.sections.get("Subject results") ?? "", tables.results);
  const outcomes = tableRows(artifact.sections.get("Objective outcomes") ?? "", tables.objectiveOutcomes);
  const changes = tableRows(artifact.sections.get("Changes") ?? "", tables.changes);
  const snapshot = tableRows(artifact.sections.get("Repository snapshot") ?? "", tables.snapshot)[0];
  const checks = tableRows(artifact.sections.get("Checks") ?? "", tables.checks);
  const steps = tableRows(artifact.sections.get("Idempotency and resume") ?? "", tables.resume);
  return {
    results,
    outcomes,
    outcomeRows: new Map(outcomes.map((row) => [row["Objective ID"], row])),
    changes,
    snapshot,
    checks,
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    steps,
  };
}

function reviewData(artifact) {
  const coverage = tableRows(artifact.sections.get("Evidence coverage") ?? "", tables.coverage);
  const findings = tableRows(artifact.sections.get("Findings") ?? "", tables.findings);
  return { coverage, findings };
}

function validatePlan(parsed, sections, failures) {
  const options = { normalizations: parsed.normalizations };
  const readiness = requireTable(sections, "Intent and decisions", tables.readiness, failures, options);
  const readinessByKey = new Map(readiness.rows.map((row) => [normalizedHeader(row["Readiness item"]), row]));
  for (const item of readinessItems) if (!readinessByKey.has(normalizedHeader(item))) failures.push(`Intent Readiness is missing ${item}`);
  if (readiness.rows.map((row) => normalizedHeader(row["Readiness item"])).join("\n") !== readinessItems.map(normalizedHeader).join("\n")) parsed.normalizations.push("normalized Intent Readiness row order");
  const openDecisions = readinessByKey.get(normalizedHeader("Material open decisions"));
  if (parsed.fields.status === "ready" && !noneLike(openDecisions?.Resolution)) failures.push("ready work-plan requires no material open decisions");

  const decisions = requireTable(sections, "Intent and decisions", tables.decisions, failures, { allowNone: true, normalizations: parsed.normalizations });
  const decisionIds = exactIdSet(decisions.rows, "Decision ID", /DEC-[1-9][0-9]*/, "Decisions", failures);
  const objectives = requireTable(sections, "Objectives", tables.objectives, failures, options);
  const objectiveIds = exactIdSet(objectives.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objectives", failures);

  const baseline = requireTable(sections, "Evidence and baseline", tables.baseline, failures, options);
  const kinds = new Set(baseline.rows.map((row) => row.Kind));
  if (!kinds.has("repository")) failures.push("baseline requires repository evidence");
  for (const kind of kinds) if (!baselineKinds.includes(kind)) parsed.normalizations.push(`baseline uses additional Kind ${kind}`);

  const scope = requireTable(sections, "Scope and targets", tables.scope, failures, options);
  const categories = new Set(scope.rows.map((row) => row.Category));
  for (const category of requiredScopeCategories) if (!categories.has(category)) failures.push(`scope is missing required category ${category}`);
  for (const category of categories) if (![...requiredScopeCategories, "incidental"].includes(category)) failures.push(`scope has unsupported category ${category}`);
  if (!categories.has("incidental")) parsed.normalizations.push("Scope and targets: omitted incidental scope materialized as empty");

  const steps = requireTable(sections, "Execution steps", tables.steps, failures, options);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Execution steps", failures);
  const coveredObjectives = new Set();
  const referencedChecks = new Set();
  for (const row of steps.rows) {
    for (const objective of ids(row.Objectives, objectivePattern)) {
      coveredObjectives.add(objective);
      if (!objectiveIds.has(objective)) failures.push(`Execution steps: unknown ${objective}`);
    }
    const rowChecks = ids(row["Check IDs"], checkPattern);
    if (rowChecks.length === 0) failures.push(`Execution steps: ${row["Step ID"]} has no Check ID`);
    rowChecks.forEach((check) => referencedChecks.add(check));
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Execution steps: ${row["Step ID"]} needs a PROBE-N completion probe`);
  }
  if (!sameSet(coveredObjectives, objectiveIds)) failures.push("Execution steps must cover every objective");

  const checks = requireTable(sections, "Verification", tables.verification, failures, options);
  const classifiedChecks = tableRows(sections.get("Verification") ?? "", tables.verificationWithClass);
  const classifications = new Map(classifiedChecks.map((row) => [row["Check ID"], row["Evidence Class"]]));
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Verification", failures);
  for (const row of checks.rows) {
    const covered = ids(row.Objectives, objectivePattern);
    if (covered.length === 0) failures.push(`Verification: ${row["Check ID"]} has no objective`);
    covered.forEach((objective) => { if (!objectiveIds.has(objective)) failures.push(`Verification: unknown ${objective}`); });
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) failures.push(`Verification: ${row["Check ID"]} invalid Cost Class`);
    if (targetTokens(row.Prerequisites).length === 0) failures.push(`Verification: ${row["Check ID"]} needs concrete Prerequisites`);
    const evidenceClass = classifications.get(row["Check ID"]);
    if (!evidenceClass) failures.push(`Verification: ${row["Check ID"]} needs Evidence Class`);
    if (evidenceClass && !/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(evidenceClass)) failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  validateCostOrder(checks.rows, "Cost Class", "Verification", parsed);
  for (const check of referencedChecks) if (!checkIds.has(check)) failures.push(`Execution steps reference unknown ${check}`);
  for (const objective of objectiveIds) if (!checks.rows.some((row) => ids(row.Objectives, objectivePattern).includes(objective))) failures.push(`${objective} has no verification Check`);
  for (const objective of objectiveIds) if (!checks.rows.some((row) => row.Required === "yes" && ids(row.Objectives, objectivePattern).includes(objective))) failures.push(`${objective} has no required verification Check`);

  const intentContent = sections.get("Intent and decisions") ?? "";
  const scopeContent = sections.get("Scope and targets") ?? "";
  const executionContent = sections.get("Execution steps") ?? "";
  const productRequirements = tableRows(subsection(intentContent, "Product requirements"), tables.productRequirements);
  const systemImpact = tableRows(subsection(scopeContent, "System architecture"), tables.systemImpact);
  const programDesign = tableRows(subsection(scopeContent, "Program design"), tables.programDesign);
  const slices = tableRows(subsection(executionContent, "Vertical slices"), tables.slices);
  if (["compact", "full"].includes(parsed.fields.design_depth)) {
    if (systemImpact.length === 0) failures.push(`${parsed.fields.design_depth} design requires a System architecture table`);
    if (slices.length === 0) failures.push(`${parsed.fields.design_depth} design requires a Vertical slices table`);
  }
  if (parsed.fields.design_depth === "full") {
    if (productRequirements.length === 0) failures.push("full design requires a Product requirements table");
    if (programDesign.length === 0) failures.push("full design requires a Program design table");
  }
  const sliceIds = exactIdSet(slices, "Slice ID", /SLICE-[1-9][0-9]*/, "Vertical slices", failures);
  for (const row of slices) {
    const sliceObjectives = ids(row.Objectives, objectivePattern);
    if (sliceObjectives.length === 0) failures.push(`Vertical slices: ${row["Slice ID"]} has no objective`);
    for (const objective of sliceObjectives) if (!objectiveIds.has(objective)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${objective}`);
    for (const dependency of ids(row.Dependencies, slicePattern)) if (!sliceIds.has(dependency)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${dependency}`);
    const sliceChecks = ids(row["Check IDs"], checkPattern);
    if (sliceChecks.length === 0) failures.push(`Vertical slices: ${row["Slice ID"]} has no Check ID`);
    for (const check of sliceChecks) if (!checkIds.has(check)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${check}`);
    if (!/^(?:yes|no)$/.test(row["Human review"])) failures.push(`Vertical slices: ${row["Slice ID"]} Human review must be yes|no`);
  }

  if (parsed.fields.automation_profile_max !== "manual") {
    const bounds = parsed.fields.automation_bounds;
    if (!bounds) failures.push(`${parsed.fields.automation_profile_max} plan requires automation_bounds`);
    else {
      const scopedTargets = scope.rows.filter((row) => ["required", "permitted"].includes(row.Category)).flatMap((row) => targetTokens(row.Targets));
      for (const target of bounds.allowed_targets ?? []) if (!scopedTargets.some((scopeTarget) => targetMatches(target, scopeTarget))) failures.push(`automation_bounds target ${target} is outside required/permitted scope`);
      if ((riskRank[bounds.max_risk] ?? 0) > (riskRank[parsed.fields.risk] ?? 0)) failures.push("automation_bounds max_risk cannot exceed root risk");
    }
  }

  const operational = requireTable(sections, "Operational readiness", tables.operational, failures, options);
  const concerns = new Set(operational.rows.map((row) => row.Concern));
  const notApplicable = concerns.has("Not applicable");
  if (parsed.fields.runtime_relevant === true) {
    if (notApplicable) failures.push("runtime-relevant work cannot use Not applicable operational readiness");
    for (const concern of ["Observable signal", "Failure condition", "Recovery or rollback"]) {
      if (!concerns.has(concern)) failures.push(`Operational readiness: missing ${concern}`);
    }
  } else if (operational.rows.length !== 1 || operational.rows[0]?.Concern !== "Not applicable") {
    failures.push("non-runtime work requires exactly one Not applicable operational readiness row");
  }

  const factors = requireTable(sections, "Risk and closeout", tables.assuranceFactors, failures, options);
  const factorNames = new Set(factors.rows.map((row) => normalizedHeader(row.Factor)));
  for (const [factor] of assuranceFactors) if (!factorNames.has(normalizedHeader(factor))) failures.push(`Assurance factors are missing ${factor}`);
  if (factors.rows.map((row) => normalizedHeader(row.Factor)).join("\n") !== assuranceFactors.map(([factor]) => normalizedHeader(factor)).join("\n")) parsed.normalizations.push("normalized assurance factor order");
  let score = 0;
  for (const [factor, minimum, maximum] of assuranceFactors) {
    const raw = factors.rows.find((row) => normalizedHeader(row.Factor) === normalizedHeader(factor))?.Score;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) failures.push(`Assurance factor ${factor} Score must be an integer ${minimum}..${maximum}`);
    else score += value;
  }
  if (score !== parsed.fields.assurance_score) failures.push(`assurance_score must equal computed score ${score}`);
  const triggers = parsed.fields.hard_triggers ?? [];
  for (const trigger of triggers) if (!hardTriggers.has(trigger)) failures.push(`unknown hard trigger ${trigger}`);
  const derived = derivedAssurance(score, triggers);
  const selectedRank = assuranceRank[parsed.fields.assurance_profile] ?? 0;
  const derivedRank = assuranceRank[derived];
  if (parsed.fields.assurance_override === "none" && parsed.fields.assurance_profile !== derived) failures.push(`assurance_profile must equal derived profile ${derived} without override`);
  if (parsed.fields.assurance_override === "raised" && selectedRank <= derivedRank) failures.push("raised assurance override must select a higher profile than derived");
  if (parsed.fields.assurance_override === "lowered") {
    if (triggers.length > 0) failures.push("hard-trigger assurance cannot be lowered");
    if (selectedRank >= derivedRank) failures.push("lowered assurance override must select a lower profile than derived");
    const decision = decisions.rows.find((row) => row["Decision ID"] === parsed.fields.assurance_override_decision_id);
    if (!decisionIds.has(parsed.fields.assurance_override_decision_id) || !/\bHuman (?:decision|approval)\b/i.test(decision?.Source ?? "")) failures.push("lowered assurance requires a human-sourced decision");
  }

  const controls = requireTable(sections, "Risk and closeout", tables.controls, failures, { allowNone: true, normalizations: parsed.normalizations });
  exactIdSet(controls.rows, "Control ID", /CTRL-[1-9][0-9]*/, "Pareto controls", failures);
  for (const row of controls.rows) {
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost class"])) failures.push(`Pareto controls: ${row["Control ID"]} invalid Cost class`);
    if (!/^(?:include|defer)$/.test(row.Decision)) failures.push(`Pareto controls: ${row["Control ID"]} Decision must be include|defer`);
    const matchedTriggers = triggers.filter((trigger) => row["Objective or failure mode"].includes(trigger));
    if (matchedTriggers.length > 0 && row.Decision !== "include") failures.push(`Pareto controls: hard-trigger control ${row["Control ID"]} cannot be deferred`);
  }
  for (const trigger of triggers) if (!controls.rows.some((row) => row["Objective or failure mode"].includes(trigger) && row.Decision === "include")) failures.push(`hard trigger ${trigger} requires an included Pareto control`);
  if (parsed.fields.status === "ready" && parsed.fields.intent_ready !== true) failures.push("ready work-plan requires intent_ready true");

  if (parsed.wrapper) {
    const todos = parsed.wrapper.todos ?? [];
    const stepIds = steps.rows.map((row) => row["Step ID"]);
    for (const stepId of stepIds) if (!todos.some((todo) => String(todo.content).includes(stepId))) failures.push(`native todos must project ${stepId}`);
    const final = String(todos.at(-1)?.content ?? "");
    if (!/verify|check|evidence|snapshot/i.test(final)) failures.push("final native todo must verify or evidence the implemented result");
    if (/\/correct-work/.test(final)) failures.push("initial native implementation must not require another Workflow command");
  }
}

function resultIdPattern(fields) {
  return String(fields.subject_id ?? "").startsWith("cp-") ? fixPattern : objectivePattern;
}

function validateEvidenceGrades(parsed, failures) {
  const entries = parsed.fields.check_evidence ?? [];
  const grades = entries.map((entry) => entry.grade);
  const patched = entries.filter((entry) => (entry.baseline_or_patched ?? (parsed.fields.evidence_mode === "lean" ? "patched" : null)) === "patched");
  if (grades.includes("failed") && parsed.fields.overall_grade !== "failed") failures.push("failed check evidence requires overall_grade failed");
  if (parsed.fields.status === "complete" && parsed.fields.overall_grade !== "verified") failures.push("complete evidence requires overall_grade verified");
  if (parsed.fields.status === "complete" && patched.some((entry) => entry.grade !== "verified")) failures.push("complete evidence requires every patched Check grade verified");
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
  validateEvidenceGrades(parsed, failures);
  if (!Object.hasOwn(parsed.fields, "strategy_revision")) parsed.normalizations.push("lean evidence: interpreted missing strategy_revision as 0");
  for (const entry of parsed.fields.check_evidence ?? []) {
    if (!Object.hasOwn(entry, "baseline_or_patched")) parsed.normalizations.push(`lean evidence: interpreted ${entry.check_id} baseline_or_patched as patched`);
  }
  parsed.effective = {
    strategyRevision: parsed.fields.strategy_revision ?? 0,
    checkEvidence: (parsed.fields.check_evidence ?? []).map((entry) => ({ baseline_or_patched: "patched", ...entry })),
  };
}

function validateEvidence(parsed, sections, failures) {
  if (parsed.fields.schema === 5 && parsed.fields.evidence_mode === "lean") {
    validateLeanEvidence(parsed, sections, failures);
    return;
  }
  const options = { normalizations: parsed.normalizations };
  const pattern = resultIdPattern(parsed.fields);
  const results = requireTable(sections, "Subject results", tables.results, failures, { optional: true, normalizations: parsed.normalizations });
  const resultIds = exactIdSet(results.rows, "Objective ID", pattern, "Subject results", failures);
  for (const row of results.rows) if (!/^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Result)) failures.push(`Subject results: ${row["Objective ID"]} invalid Result`);

  const outcomes = requireTable(sections, "Objective outcomes", tables.objectiveOutcomes, failures, options);
  const outcomeIds = exactIdSet(outcomes.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objective outcomes", failures);
  if (!sameSet(outcomeIds, new Set(parsed.fields.affected_objectives ?? []))) failures.push("Objective outcomes must exactly match affected_objectives");
  for (const row of outcomes.rows) if (!/^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Status)) failures.push(`Objective outcomes: ${row["Objective ID"]} invalid Status`);

  const affected = new Set(parsed.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (const id of affected) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both affected and reused`);
  const executed = new Set(parsed.fields.executed_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of executed) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both executed and reused`);

  const changes = requireTable(sections, "Changes", tables.changes, failures, { allowNone: true, optional: true, normalizations: parsed.normalizations });
  const declaredChangedPaths = new Set(parsed.fields.changed_paths ?? []);
  const visibleChangedPaths = new Set(changes.rows.flatMap((row) => targetTokens(row["Path or Symbol"])));
  if (parsed.fields.schema === 5 && !sameSet(declaredChangedPaths, visibleChangedPaths)) failures.push("Changes table must exactly match changed_paths");
  for (const path of declaredChangedPaths) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`changed path must remain repository-relative: ${path}`);
  }
  for (const row of changes.rows) {
    const covered = ids(row["Objective Coverage"], pattern);
    if (covered.length === 0) failures.push("Changes: every row must name a subject objective");
    covered.forEach((id) => { if (!(resultIds.size > 0 ? resultIds : outcomeIds).has(id)) failures.push(`Changes: unknown ${id}`); });
  }

  const snapshot = requireTable(sections, "Repository snapshot", tables.snapshot, failures, options);
  let snapshotFingerprints = new Map();
  if (snapshot.rows.length === 1) {
    const row = snapshot.rows[0];
    parsed.fields.snapshot_id = row["Snapshot ID"];
    snapshotFingerprints = fingerprintMap(row["Relevant fingerprints"]);
  }

  const checks = requireTable(sections, "Checks", tables.checks, failures, options);
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Checks", failures);
  if (!sameSet(checkIds, executed)) failures.push("Checks table must exactly match executed_checks");
  for (const row of checks.rows) {
    if (!/^(?:passed|failed|blocked|skipped)$/.test(row.Status)) failures.push(`Checks: ${row["Check ID"]} invalid Status`);
    const prerequisites = fingerprintMap(row["Prerequisite fingerprints"]);
    for (const [path, hash] of prerequisites) if (snapshotFingerprints.get(path) !== hash) failures.push(`Checks: ${row["Check ID"]} prerequisite ${path} must match Repository snapshot`);
    if (row.Status === "blocked" && !/^blocked-by:CHECK-[1-9][0-9]*\b/.test(row["Observed Result"])) failures.push(`Checks: ${row["Check ID"]} blocked status needs blocked-by:CHECK-N evidence`);
  }
  if (parsed.fields.schema >= 4) {
    const entries = parsed.fields.check_evidence ?? [];
    const patched = new Map(entries.filter((entry) => entry.baseline_or_patched === "patched").map((entry) => [entry.check_id, entry]));
    for (const check of parsed.fields.executed_checks ?? []) if (!patched.has(check)) failures.push(`check_evidence requires patched evidence for ${check}`);
    validateEvidenceGrades(parsed, failures);
  }

  const resume = requireTable(sections, "Idempotency and resume", tables.resume, failures, { optional: true, normalizations: parsed.normalizations });
  exactIdSet(resume.rows, "Step ID", /STEP-[1-9][0-9]*/, "Idempotency and resume", failures);
  for (const row of resume.rows) {
    if (!/^(?:satisfied|pending|partial|conflicted)$/.test(row.State)) failures.push(`Idempotency and resume: ${row["Step ID"]} invalid State`);
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Idempotency and resume: ${row["Step ID"]} needs a PROBE-N completion probe`);
  }

  const deviations = requireTable(sections, "Deviations", tables.deviations, failures, { allowNone: true, optional: true, normalizations: parsed.normalizations });
  for (const row of deviations.rows) if (!/^DEV-[1-9][0-9]*$/.test(row["Deviation ID"])) failures.push(`Deviations: invalid ${row["Deviation ID"]}`);
  if (parsed.fields.status === "complete") {
    if (results.rows.some((row) => row.Result === "blocked")) failures.push("complete evidence cannot contain blocked subject results");
    if (checks.rows.some((row) => row.Status === "blocked")) failures.push("complete evidence cannot contain blocked Checks");
    if (resume.rows.some((row) => ["pending", "partial", "conflicted"].includes(row.State))) failures.push("complete evidence requires every step state satisfied");
  } else if (parsed.fields.status === "blocked" && !results.rows.some((row) => row.Result === "blocked") && !checks.rows.some((row) => row.Status === "blocked") && !/BLOCKER:\s*\S.{10,}/i.test(sections.get("Summary") ?? "")) {
    failures.push("blocked evidence requires blocked work or a concrete BLOCKER reason");
  }
  const operationalEvidence = (sections.get("Operational evidence") ?? "").trim();
  if (operationalEvidence && !/^not applicable\.?$/i.test(operationalEvidence)) requireTable(sections, "Operational evidence", tables.operationalEvidence, failures);
  if (/production (?:is|was) (?:healthy|successful|verified)/i.test(operationalEvidence)) failures.push("repository evidence must not claim observed production success");
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
  const checks = { rows: tableRows(content, tables.correctionChecks) };
  if (fixes.rows.length === 0) failures.push("Correction plan requires a FIX table");
  if (steps.rows.length === 0) failures.push("Correction plan requires a step table");
  if (checks.rows.length === 0) failures.push("Correction plan requires a Check table");

  const declaredLearnings = Array.isArray(parsed.fields.learning_candidates) ? parsed.fields.learning_candidates : [];
  const pseudoLearning = new Map([["Correction plan", content]]);
  const learnings = requireTable(pseudoLearning, "Correction plan", tables.learningCandidates, failures, { normalizations: parsed.normalizations });
  const learningIds = exactIdSet(learnings.rows, "Learning ID", learningPattern, "Correction learning", failures);
  if (!sameSet(learningIds, new Set(declaredLearnings))) failures.push("Correction learning table must exactly match learning_candidates");
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
  const actualAuditors = new Set(parsed.fields.auditors_run ?? []);
  const auditorRow = coverageByKind.get(normalizedHeader("Auditors"))?.[0];
  const visibleAuditors = new Set(String(auditorRow?.Inspected ?? "").split(",").map((value) => value.trim()).filter((value) => value && !noneLike(value)));
  if (coverage.rows.length > 0 && !sameSet(visibleAuditors, actualAuditors)) parsed.normalizations.push("Evidence coverage: auditor summary derived from frontmatter");
  const routeRank = { inline: 1, targeted: 2, full: 3 };
  let minimumRoute = actualAuditors.has("risk-auditor") || findings.rows.some((row) => /^(?:high|critical)$/.test(row.Severity))
    ? "full"
    : actualAuditors.has("delivery-auditor") ? "targeted" : "inline";
  if (routeRank[parsed.fields.review_route] < routeRank[minimumRoute]) failures.push(`review_route must be at least computed minimum ${minimumRoute}`);
  const routeAuditors = parsed.fields.review_route === "inline" ? ["inline"] : parsed.fields.review_route === "targeted" ? ["inline", "delivery-auditor"] : ["inline", "delivery-auditor", "risk-auditor"];
  const missingAuditors = routeAuditors.filter((auditor) => !actualAuditors.has(auditor));

  const next = sections.get("Next action") ?? "";
  if (!next.toLowerCase().includes(String(parsed.fields.next_action).toLowerCase())) failures.push("Next action section must state frontmatter next_action");
  if (parsed.fields.assessment === "achieved") {
    if (parsed.fields.next_action !== "none") failures.push("achieved review requires next_action none");
    if (findings.rows.length > 0) failures.push("achieved review cannot contain findings");
    const snapshotRow = coverageByKind.get(normalizedHeader("Snapshot"))?.[0];
    if (coverage.rows.length > 0 && (normalizedHeader(snapshotRow?.Result) !== "consistent" || noneLike(snapshotRow?.Inspected))) failures.push("achieved review coverage contradicts current snapshot consistency");
  }
  if (parsed.fields.next_action === "none" && parsed.fields.assessment !== "achieved") failures.push("next_action none requires assessment achieved");
  if (parsed.fields.schema >= 4) {
    if (parsed.fields.delivery_status === "verified" && parsed.fields.assessment !== "achieved") failures.push("verified delivery requires achieved assessment");
    if (parsed.fields.delivery_status === "provisional" && parsed.fields.next_action !== "accept-provisional") failures.push("provisional delivery requires accept-provisional");
    if (parsed.fields.next_action === "accept-provisional" && parsed.fields.delivery_status !== "provisional") failures.push("accept-provisional requires provisional delivery");
  }
  if (parsed.fields.next_action === "correct" && findings.rows.length === 0) failures.push("correct review requires findings");
  if (parsed.fields.next_action !== "correct" && Array.isArray(parsed.fields.learning_candidates)) failures.push("learning_candidates are allowed only when next_action is correct");
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
    plannedAssurance: null,
    assuranceUsed: parsed.fields.review_route === "full" ? "deep" : parsed.fields.review_route === "targeted" ? "standard" : null,
    inspectedObjectives: [...inspectedObjectives],
    reusedObjectives: [...reusedObjectives],
    inspectedChecks: [...inspectedChecks],
    reusedChecks: [...reusedChecks],
    auditorsRun: [...actualAuditors],
    missingAuditors,
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
      if (parsed.fields.schema >= 4) validatePlanV4(parsed, sections, failures);
      else validatePlan(parsed, sections, failures);
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

function authoritativeArtifactProjection(artifact, root) {
  const schema = JSON.parse(readFileSync(schemaFor(root, artifact.fields.artifact), "utf8"));
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
    slices: data.slices.map((row) => ({ ...row })),
    allowedTargets: [...data.allowedTargets],
    prohibitedTargets: [...data.prohibitedTargets],
    strategy: artifact.fields.schema >= 4 ? {
      strategy_id: `strategy-${artifact.fields.id.slice(3)}`,
      revision: 0,
      parent_hash: null,
      root_projection_hash: authoritative.projection_hash,
      task_class: artifact.fields.certification?.task_recipe ?? null,
      recipe_version: "workflow-recipe-1",
      primary_targets: [...data.allowedTargets],
      steps: data.slices.map((row) => ({ ...row })),
      checks: [...data.checkRows.values()].map((row) => ({ ...row, "Evidence Class": data.evidenceClasses.get(row["Check ID"]) })),
      evidence_requirements: artifact.fields.profile_max === "autonomous" ? "verified" : "provisional-allowed",
      deviations: [],
      rationale: "initial strategy derived from the approved intent root",
      created_by: "planner",
    } : null,
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

function compareReusePaths(paths, current, predecessor, basis, label, requiresStrong, failures) {
  for (const path of paths) {
    const currentHash = current.get(path);
    const previousHash = predecessor.get(path);
    if (currentHash && previousHash && currentHash === previousHash) continue;
    const inspectedUnchanged = String(basis ?? "").includes(path) && /(?:inspected|unchanged|no relevant change)/i.test(String(basis));
    if (!requiresStrong && inspectedUnchanged) continue;
    if (currentHash && previousHash && currentHash !== previousHash) failures.push(`${label}: changed fingerprint for ${path} invalidates reuse`);
    else failures.push(`${label}: reuse lacks ${requiresStrong ? "strong fingerprint" : "fingerprint or current change-impact inspection"} evidence for ${path}`);
  }
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
  if (root.fields.schema === 5) {
    const authoritativeRoot = authoritativeArtifactProjection(root, rootDirectory);
    if (artifact.fields.intent_hash !== authoritativeRoot.projection_hash) failures.push(`${artifact.label}: intent_hash does not match authoritative Root projection`);
  }
  const plan = planData(root);
  const data = evidenceData(artifact);
  const leanMode = artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean";
  if (root.fields.schema === 5) {
    const fullRequired = root.fields.profile_max !== "manual" || root.fields.risk === "high" || (root.fields.hard_triggers ?? []).length > 0;
    if (fullRequired && leanMode) failures.push(`${artifact.label}: ${root.fields.profile_max} ${root.fields.risk}-risk root requires evidence_mode full`);
  }
  const currentFingerprints = fingerprintMap(data.snapshot?.["Relevant fingerprints"]);
  const reuseBasis = data.snapshot?.["Relevant fingerprints"] ?? "";
  const strongReuse = root.fields.schema >= 4
    ? root.fields.contract_level === "certified" || (root.fields.hard_triggers ?? []).length > 0
    : root.fields.assurance_profile === "deep" || (root.fields.hard_triggers ?? []).length > 0;
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

  const initial = artifact.fields.subject_id === root.fields.id;
  if (initial && artifact.fields.representation !== "full") failures.push(`${artifact.label}: initial evidence must use full representation`);
  if (!initial && !predecessorEffective) failures.push(`${artifact.label}: correction evidence requires direct predecessor evidence`);
  if (artifact.fields.representation === "full" && (reusedObjectives.size > 0 || reusedChecks.size > 0)) failures.push(`${artifact.label}: full representation cannot declare reused root state`);

  const objectives = new Map();
  for (const objective of affected) {
    const row = data.outcomeRows.get(objective);
    if (!row) failures.push(`${artifact.label}: affected ${objective} lacks an Objective outcomes row`);
    else objectives.set(objective, { status: row.Status, evidence: row.Evidence, source: artifact.fields.id });
  }
  for (const objective of reusedObjectives) {
    const previous = predecessorEffective?.objectives.get(objective);
    if (!previous) failures.push(`${artifact.label}: reused ${objective} is absent from direct predecessor evidence`);
    else {
      if (!leanMode) compareReusePaths(plan.objectiveDependencies.get(objective) ?? [], currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${objective}`, strongReuse, failures);
      objectives.set(objective, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }

  const checks = new Map();
  for (const id of executed) {
    const row = data.checkRows.get(id);
    if (!row) {
      failures.push(`${artifact.label}: executed ${id} lacks a Checks row`);
      continue;
    }
    const planned = plan.checkRows.get(id) ?? correctionForId(artifacts, artifact.fields.subject_id)?.checks.find((candidate) => candidate["Check ID"] === id);
    if (!planned) failures.push(`${artifact.label}: executed unknown ${id}`);
    else {
      const prerequisiteFingerprints = fingerprintMap(row["Prerequisite fingerprints"]);
      for (const [prerequisite, hash] of prerequisiteFingerprints) if (currentFingerprints.get(prerequisite) !== hash) failures.push(`${artifact.label}: ${id} fingerprint ${prerequisite} is not current`);
    }
    checks.set(id, { status: row.Status, observed: row["Observed Result"], fingerprints: row["Prerequisite fingerprints"], source: artifact.fields.id });
  }
  for (const id of reusedChecks) {
    const previous = predecessorEffective?.checks.get(id);
    const planned = plan.checkRows.get(id);
    if (!previous || !planned) failures.push(`${artifact.label}: reused ${id} is absent from direct predecessor root evidence`);
    else {
      if (!leanMode) compareReusePaths(targetTokens(planned.Prerequisites), currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${id}`, strongReuse, failures);
      checks.set(id, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }

  for (const change of data.changes) for (const target of targetTokens(change["Path or Symbol"])) {
    const allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope));
    const prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    if (!allowed || prohibited) failures.push(`${artifact.label}: changed target ${target} is outside root scope`);
  }

  const operationalContent = (artifact.sections.get("Operational evidence") ?? "").trim();
  let operationalReady = true;
  if (root.fields.schema >= 4) {
    if (operationalContent && !/^not applicable\.?$/i.test(operationalContent)) {
      const operationalRows = tableRows(operationalContent, tables.operationalEvidence);
      operationalReady = operationalRows.length > 0 && operationalRows.every((row) => row.Status === "satisfied");
    }
  } else if (root.fields.runtime_relevant === true) {
    const operationalRows = tableRows(operationalContent, tables.operationalEvidence);
    const byConcern = new Map(operationalRows.map((row) => [normalizedHeader(row.Concern), row]));
    for (const concern of ["Observable signal", "Failure condition", "Recovery or rollback"]) {
      const row = byConcern.get(normalizedHeader(concern));
      if (!row) failures.push(`${artifact.label}: runtime operational evidence is missing ${concern}`);
      if (row && !/^(?:satisfied|unsatisfied|blocked)$/.test(row.Status)) failures.push(`${artifact.label}: runtime operational evidence ${concern} has invalid Status`);
      if (row?.Status !== "satisfied") operationalReady = false;
    }
    if (artifact.fields.status === "complete" && !operationalReady) failures.push(`${artifact.label}: complete runtime evidence requires satisfied operational proof`);
  } else if (operationalContent && !/^not applicable\.?$/i.test(operationalContent)) {
    failures.push(`${artifact.label}: non-runtime operational evidence must be omitted or Not applicable.`);
    operationalReady = false;
  }

  if (initial) {
    const delivered = data.results.length > 0 ? new Set(data.results.map((row) => row["Objective ID"])) : new Set(data.outcomes.map((row) => row["Objective ID"]));
    if (!sameSet(delivered, plan.objectives)) failures.push(`${artifact.label}: initial evidence must cover every root objective`);
    if (artifact.fields.source_review_id || artifact.fields.predecessor_evidence_id) failures.push(`${artifact.label}: initial evidence cannot reference review or predecessor evidence`);
  } else {
    const sourceReview = artifacts.get(artifact.fields.source_review_id);
    const correction = correctionForId(artifacts, artifact.fields.subject_id);
    if (!sourceReview || sourceReview.fields.correction_id !== artifact.fields.subject_id || !correction) failures.push(`${artifact.label}: correction evidence does not resolve its source review and correction`);
    else {
      const expectedFixes = new Set(correction.fixes.map((row) => row["FIX ID"]));
      if (!leanMode && !sameSet(new Set(data.results.map((row) => row["Objective ID"])), expectedFixes)) failures.push(`${artifact.label}: correction Subject results must cover every FIX`);
      for (const check of correction.checks.filter((row) => row.Required === "yes")) if (!executed.has(check["Check ID"])) failures.push(`${artifact.label}: missing executed correction Check ${check["Check ID"]}`);
    }
  }

  const reviewReady = artifact.fields.status === "complete"
    && (artifact.fields.schema < 4 || artifact.fields.overall_grade === "verified")
    && operationalReady
    && [...plan.requiredChecks].every((id) => checks.get(id)?.status === "passed");
  const effective = { root, plan, objectives, checks, snapshot: data.snapshot, snapshotFingerprints: currentFingerprints, operationalReady, reviewReady, predecessor: predecessorEffective };
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
    const allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope));
    const prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    if (!allowed || prohibited) failures.push(`${review.label}: correction target ${target} is outside root scope`);
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
    const fingerprintSignature = objectives.flatMap((id) => [...effective?.plan.objectiveDependencies.get(id) ?? []]).sort().map((path) => `${path}=${effective?.snapshotFingerprints.get(path) ?? "missing"}`).join(";");
    return [finding["Finding key"], { severity: ({ critical: 4, high: 3, medium: 2, low: 1 }[finding.Severity] ?? 9), objectiveRank, passedChecks, fingerprintSignature }];
  }));
}

function measurableProgress(previous, current) {
  if (!previous || !current) return false;
  return current.severity < previous.severity || current.objectiveRank > previous.objectiveRank || current.passedChecks > previous.passedChecks || current.fingerprintSignature !== previous.fingerprintSignature;
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
    else if (predecessor.fields.schema !== 5) failures.push(`${plan.label}: predecessor plan must use Schema 5`);
    const sourceReview = artifacts.get(sourceReviewId);
    if (!sourceReview || sourceReview.fields.artifact !== "work-review") failures.push(`${plan.label}: missing replan source review ${sourceReviewId}`);
    else {
      if (sourceReview.fields.schema !== 5) failures.push(`${plan.label}: replan source review must use Schema 5`);
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

function inspectCompactArtifactSet(entries, root = defaultRoot) {
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
    artifacts.set(built.parsed.fields.id, { label, ...built.parsed });
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
    if (evidence.filter((item) => item.fields.subject_id === rootId).length !== 1) errors.push(`${rootId}: evidence chain requires exactly one initial root delivery`);
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
      if (learningOwners.has(id)) errors.push(`${review.label}: learning candidate ${id} duplicates ${learningOwners.get(id)} within root ${rootId}`);
      else learningOwners.set(id, review.label);
    }
    const reviewIndex = new Map(ordered.map((review, index) => [review.fields.id, index]));
    const rootEvidence = orderedEvidenceByRoot.get(rootId) ?? [];
    for (let index = 0; index < ordered.length; index += 1) {
      const review = ordered[index];
      const evidence = artifacts.get(review.fields.latest_evidence_id);
      if (!evidence || evidence.fields.artifact !== "delivery-evidence") {
        errors.push(`${review.label}: missing latest evidence ${review.fields.latest_evidence_id}`);
        continue;
      }
      const effective = evidence.effective;
      if (evidence.fields.root_plan_id !== rootId) errors.push(`${review.label}: latest evidence belongs to another root`);
      const knownFailedEvidence = evidenceHasKnownFailure(evidence.fields);
      if (knownFailedEvidence && review.fields.delivery_status !== "blocked") errors.push(`${review.label}: known failed or blocked evidence requires blocked delivery_status`);
      if (knownFailedEvidence && ["accept-provisional", "none"].includes(review.fields.next_action)) errors.push(`${review.label}: known failed or blocked evidence cannot be accepted or achieved`);
      const candidates = rootEvidence.filter((item) => item.fields.source_review_id === null || (reviewIndex.get(item.fields.source_review_id) ?? Number.POSITIVE_INFINITY) < index);
      if (candidates.at(-1)?.fields.id !== review.fields.latest_evidence_id) errors.push(`${review.label}: latest_evidence_id is not the evidence tip at review time`);

      disjointCoverage(review.fields.inspected_objectives, review.fields.reused_objectives, plan.objectives, `${review.label}: objective review`, errors);
      disjointCoverage(review.fields.inspected_checks, review.fields.reused_checks, plan.requiredChecks, `${review.label}: Check review`, errors);
      if (index === 0 && ((review.fields.reused_objectives ?? []).length > 0 || (review.fields.reused_checks ?? []).length > 0)) errors.push(`${review.label}: first review must inspect all root evidence`);
      const fullReviewRequired = rootPlan.fields.schema >= 4
        ? rootPlan.fields.contract_level === "certified" || (rootPlan.fields.hard_triggers ?? []).length > 0
        : rootPlan.fields.assurance_profile === "deep" || (rootPlan.fields.hard_triggers ?? []).length > 0;
      if (fullReviewRequired && review.fields.review_route !== "full") {
        errors.push(`${review.label}: certified or hard-trigger root requires review_route full`);
      }
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
      const plannedAssurance = rootPlan.fields.schema >= 4
        ? ({ lean: "lean", controlled: "standard", certified: "deep" }[rootPlan.fields.contract_level] ?? "standard")
        : rootPlan.fields.assurance_profile;
      review.effective = {
        ...review.effective,
        plannedAssurance,
        assuranceUsed: review.fields.review_route === "full" ? "deep" : review.fields.review_route === "targeted" ? "standard" : plannedAssurance,
        snapshotId: effective?.snapshot?.["Snapshot ID"] ?? null,
        correctionRound: candidates.length - 1,
        reviewReady: effective?.reviewReady ?? false,
        loopState: reviewData(review).findings.length > 0 ? "degraded" : "healthy",
        proxies: {
          objectivesInspected: review.fields.inspected_objectives.length,
          objectivesReused: review.fields.reused_objectives.length,
          checksExecuted: review.fields.inspected_checks.length,
          checksReused: review.fields.reused_checks.length,
          auditorsRun: (review.fields.auditors_run ?? []).length,
        },
      };
      validateCompactCorrection(review, rootPlan, evidence, artifacts, errors);
    }

    for (let index = 2; index < ordered.length; index += 1) {
      const window = ordered.slice(index - 2, index + 1);
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
        }
      }
      if (!window[2].effective.loopState) window[2].effective.loopState = reviewData(window[2]).findings.length > 0 ? "degraded" : "healthy";
    }
  }

  return { errors: unique(errors), diagnostics: unique(diagnostics), normalizations: unique(normalizations), effective: artifacts, root_tips: rootTips };
}

export function inspectArtifactSet(entries, root = defaultRoot) {
  return inspectCompactArtifactSet(entries, root);
}

export function validateArtifactSet(entries, root = defaultRoot) {
  return inspectCompactArtifactSet(entries, root).errors;
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
    learning_candidates: artifacts
      .filter((artifact) => artifact.fields.artifact === "work-review"
        && artifact.fields.root_plan_id === activeRootId
        && activeReview?.fields.assessment === "achieved"
        && activeReview?.fields.delivery_status === "verified"
        && artifact.correction?.learnings?.length > 0)
      .flatMap((artifact) => artifact.correction.learnings.map((learning) => {
        const evidence = artifacts.find((candidate) => candidate.fields.artifact === "delivery-evidence"
          && candidate.fields.subject_id === artifact.fields.correction_id
          && candidate.fields.status === "complete");
        return {
          root_plan_id: artifact.fields.root_plan_id,
          review_id: artifact.fields.id,
          correction_id: artifact.fields.correction_id,
          learning_id: learning["Learning ID"],
          correction_evidence_id: evidence?.fields.id ?? null,
          evidence_confirmed: Boolean(evidence),
        };
      })),
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
