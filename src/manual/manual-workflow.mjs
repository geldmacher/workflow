import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";
import {
  defaultRoot,
  effectiveCliSummary,
  executionContractFromArtifactText,
  extractEmbeddedWorkPlanText,
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan,
} from "../../scripts/validate-artifact.source.mjs";
import { classifyChangedPathAuthority } from "../core/manual-path-authority.mjs";
import { buildWorkflowAuthorityPlan } from "../core/workflow-authority-core.mjs";
import { buildDeliveryEvidence } from "../controller/delivery-closeout.mjs";
import { deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { buildWorkReview } from "../controller/work-review-builder.mjs";
import { reviewInputSchema } from "../mcp/review-input-contract.mjs";

const DETERMINISTIC_OBSERVED_AT = "1970-01-01T00:00:00.000Z";
const line = (maximum = 8_000) => z.string().min(1).max(maximum);
const artifactEntrySchema = z.strictObject({
  label: line(200),
  text: line(1_000_000),
});
const artifactEntriesSchema = z.array(artifactEntrySchema).max(256);
const presentationLocaleSchema = z.enum(["de", "en"]).optional().default("en");

const validatePlanRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("validate-plan"),
  root_plan: line(1_000_000),
  presentation_locale: presentationLocaleSchema,
});

const buildPlanRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("build-plan"),
  plan_markdown: line(1_000_000),
  authority_core: z.record(z.string(), z.unknown()),
  presentation_locale: presentationLocaleSchema,
});

const repositoryObservationSchema = z.strictObject({
  schema: z.literal(1),
  kind: z.literal("unprotected-repository-observation"),
  repository_root: line(8_000),
  subject_changed_paths: z.array(line(8_000)).max(20_000),
  ambient_changed_paths: z.array(line(8_000)).max(20_000),
  snapshot_material: z.array(line(100_000)).min(1).max(2_000),
  limitations: z.array(line(8_000)).max(128),
}).superRefine((value, context) => {
  const subject = new Set(value.subject_changed_paths);
  const overlap = value.ambient_changed_paths.find((path) => subject.has(path));
  if (overlap) context.addIssue({ code: "custom", path: ["ambient_changed_paths"], message: `path must not also be subject: ${overlap}` });
});

const checkObservationSchema = z.strictObject({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  grade: z.enum(["supported", "partial", "unavailable", "failed"]),
  observed: line(8_000),
  evidence_material: z.array(line(100_000)).max(2_000),
  limitations: z.array(line(8_000)).max(128),
}).superRefine((value, context) => {
  if (value.grade !== "unavailable" && value.evidence_material.length === 0) {
    context.addIssue({ code: "custom", path: ["evidence_material"], message: `${value.grade} observations require evidence_material` });
  }
  if (["partial", "unavailable"].includes(value.grade) && value.limitations.length === 0) {
    context.addIssue({ code: "custom", path: ["limitations"], message: `${value.grade} observations require a concrete limitation` });
  }
});

const buildReviewRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("build-review"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
  review_input: reviewInputSchema,
  repository_observation: repositoryObservationSchema,
  check_observations: z.array(checkObservationSchema).max(512),
  presentation_locale: presentationLocaleSchema,
});

const statusRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("status"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
  presentation_locale: presentationLocaleSchema,
});

const schemas = Object.freeze({
  "build-plan": buildPlanRequestSchema,
  "validate-plan": validatePlanRequestSchema,
  "build-review": buildReviewRequestSchema,
  status: statusRequestSchema,
});

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function unique(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))];
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseRequest(operation, input) {
  const schema = schemas[operation];
  if (!schema) throw codedError("unsupported-operation", `Unsupported manual-workflow operation: ${operation}`);
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const location = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
  throw codedError("manual-input-invalid", `Closed Schema-1 ${operation} input is invalid${location}: ${issue?.message ?? "invalid input"}`);
}

function exactRootRequest(request) {
  if (request.operation === "build-plan") return request;
  const extracted = extractEmbeddedWorkPlanText(request.root_plan);
  return extracted == null ? request : { ...request, root_plan: extracted };
}

function exactRoot(rootPlan, pluginRoot) {
  const inspected = inspectArtifactText(rootPlan, pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact.fields.schema !== 6) {
    throw codedError("schema-6-root-invalid", `An exact valid Schema-6 Root is required: ${inspected.errors.join("; ") || "input is not a work-plan"}`);
  }
  return inspected.artifact.fields;
}

function exactChain(rootPlan, artifacts, pluginRoot) {
  const rootFields = exactRoot(rootPlan, pluginRoot);
  const byId = new Map([[rootFields.id, { label: rootFields.id, text: rootPlan }]]);
  for (const entry of artifacts) {
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    const fields = inspected.artifact?.fields;
    if (inspected.errors.length > 0 || !fields?.id || fields.schema !== 6) {
      throw codedError("schema-6-chain-invalid", `Artifact ${entry.label} is not an exact valid Schema-6 artifact: ${inspected.errors.join("; ") || "unsupported artifact"}`);
    }
    const prior = byId.get(fields.id);
    if (prior && prior.text !== entry.text) throw codedError("artifact-bytes-conflict", `Artifact ${fields.id} has conflicting immutable bytes`);
    byId.set(fields.id, { label: fields.id, text: entry.text });
  }
  const entries = [...byId.values()];
  const chain = inspectArtifactSet(entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (chain.errors.length > 0) throw codedError("schema-6-chain-invalid", `The exact Schema-6 chain is invalid: ${chain.errors.join("; ")}`);
  const fieldsById = new Map(entries.map((entry) => {
    const fields = inspectArtifactText(entry.text, pluginRoot).artifact.fields;
    return [fields.id, fields];
  }));
  const lineageRootIds = new Set();
  let cursor = rootFields.id;
  while (cursor && !lineageRootIds.has(cursor)) {
    lineageRootIds.add(cursor);
    cursor = fieldsById.get(cursor)?.predecessor_plan_id ?? null;
  }
  for (const fields of fieldsById.values()) {
    const related = fields.artifact === "work-plan"
      ? lineageRootIds.has(fields.id)
      : lineageRootIds.has(fields.root_plan_id);
    if (!related) throw codedError("foreign-artifact-chain", `Artifact ${fields.id} is foreign to current Root ${rootFields.id}`);
  }
  return { rootFields, entries, chain, tips: effectiveCliSummary(chain) };
}

function observationHashes(observation) {
  const canonicalRepositoryRoot = realpathSync(observation.repository_root);
  const normalized = stable({
    schema: observation.schema,
    kind: observation.kind,
    repository_root: canonicalRepositoryRoot,
    subject_changed_paths: unique(observation.subject_changed_paths).sort(),
    ambient_changed_paths: unique(observation.ambient_changed_paths).sort(),
    snapshot_material: observation.snapshot_material,
    limitations: unique(observation.limitations),
  });
  const workspaceBindingHash = sha256(stableJson({ repository_root: canonicalRepositoryRoot }));
  return {
    normalized,
    workspaceBindingHash,
    snapshotHash: sha256(stableJson({ ...normalized, workspace_binding_hash: workspaceBindingHash })),
  };
}

function checkEvidence(observations) {
  const ids = observations.map((entry) => entry.check_id);
  if (new Set(ids).size !== ids.length) throw codedError("check-observation-ambiguous", "Check observations must use unique Check IDs");
  return observations.map((entry) => ({
    check_id: entry.check_id,
    grade: entry.grade,
    observed: entry.observed,
    evidence_hashes: unique(entry.evidence_material.map(sha256)).sort(),
    limitations: unique([
      ...entry.limitations,
      "This Check is based on an unprotected Manual observation and cannot establish verified evidence.",
    ]),
  }));
}

function observationLimitedReviewInput(reviewInput, observations, requiredCheckIds) {
  const required = new Set(requiredCheckIds);
  const existing = new Set((reviewInput.open_points ?? []).map((point) => point.key));
  const points = observations
    .filter((entry) => required.has(entry.check_id) && !["supported", "verified"].includes(entry.grade))
    .map((entry) => {
      let key = `${entry.check_id.toLowerCase()}-${entry.grade}`;
      let suffix = 2;
      while (existing.has(key)) key = `${entry.check_id.toLowerCase()}-${entry.grade}-${suffix++}`;
      existing.add(key);
      const cause = unique([entry.observed, ...(entry.limitations ?? [])]).join(" ");
      return {
        key,
        type: entry.grade === "unavailable" ? "environment" : "evidence",
        summary: `${entry.check_id} is ${entry.grade} for the current repository snapshot.`,
        evidence: cause,
        impact: `${entry.check_id} cannot currently support an achieved result.`,
        question: `How should the human assess the stated ${entry.check_id} limitation?`,
      };
    });
  if (points.length === 0) return reviewInput;
  return {
    ...reviewInput,
    outcome: reviewInput.outcome === "correction-needed" ? "correction-needed" : "open-points",
    open_points: [...(reviewInput.open_points ?? []), ...points],
  };
}

function boundedLine(value, maximum = 1_900) {
  const source = String(value ?? "").trim();
  if (source.length <= maximum) return source;
  const suffix = " … [bounded]";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}

function authorityLimitedReviewInput(reviewInput, message) {
  const limitation = boundedLine(message);
  const point = {
    key: "authority-boundary",
    type: "authority",
    summary: "Repository changes cross the approved authority boundary.",
    evidence: limitation,
    impact: "Workflow cannot authorize a correction or an achieved outcome for these paths.",
    question: "Should the human provide a new Authority Core for these paths or leave them outside this delivery?",
  };
  return {
    ...reviewInput,
    outcome: "open-points",
    snapshot_summary: boundedLine(`${reviewInput.snapshot_summary} ${limitation}`),
    findings: (reviewInput.findings ?? []).map((finding) => ({ ...finding, resolution: "open" })),
    open_points: [...(reviewInput.open_points ?? []), point],
    correction: undefined,
  };
}

function authorityBlockingLimitation(projection) {
  const limits = [
    ...(projection.protected_paths.length > 0
      ? [`Protected changed paths block delivery: ${projection.protected_paths.join(", ")}.`]
      : []),
    ...(projection.approval_required_paths.length > 0
      ? [`Changed paths requiring separate human approval block delivery: ${projection.approval_required_paths.join(", ")}.`]
      : []),
  ];
  return limits.length > 0 ? limits.join(" ") : null;
}

function authorityScopeLimitation(projection) {
  if (projection.outside_allowed_paths.length === 0) return null;
  return `Provisional scope drift remains visible without granting authority: ${projection.outside_allowed_paths.join(", ")}.`;
}

function scopeLimitedReviewInput(reviewInput, message) {
  return authorityLimitedReviewInput(reviewInput, message);
}

const PRESENTATION_LABELS = Object.freeze({
  en: Object.freeze({
    decision: "Decision", nextAction: "Next action", actionToken: "Action token", repositoryOutcome: "Repository outcome",
    reason: "Reason", evidenceGrade: "Evidence grade", proofBoundary: "Proof boundary", scope: "Scope",
    findings: "Findings", checks: "Checks", limitations: "Limitations", changedPaths: "Changed paths",
    deviations: "Deviations", proof: "Proof", details: "Details", exceptionalPaths: "Exceptional paths",
    traceability: "Traceability", planBlockers: "Plan blockers", advisories: "Advisories",
    root: "Root", evidence: "Evidence", review: "Review", artifactHash: "artifact hash",
    rootHash: "Root content hash", intentHash: "Intent hash", workspaceBindingHash: "Workspace binding hash",
    repositorySnapshotHash: "Repository snapshot hash", artifactSetHash: "Artifact-set hash",
  }),
  de: Object.freeze({
    decision: "Entscheidung", nextAction: "Nächste Aktion", actionToken: "Aktions-Token", repositoryOutcome: "Repository-Ergebnis",
    reason: "Grund", evidenceGrade: "Evidenzgrad", proofBoundary: "Nachweisgrenze", scope: "Umfang",
    findings: "Feststellungen", checks: "Checks", limitations: "Grenzen", changedPaths: "Geänderte Pfade",
    deviations: "Abweichungen", proof: "Nachweis", details: "Details", exceptionalPaths: "Besondere Pfade",
    traceability: "Rückverfolgbarkeit", planBlockers: "Planblocker", advisories: "Hinweise",
    root: "Root", evidence: "Evidence", review: "Review", artifactHash: "Artefakt-Hash",
    rootHash: "Root-Inhalts-Hash", intentHash: "Intent-Hash", workspaceBindingHash: "Workspace-Bindungs-Hash",
    repositorySnapshotHash: "Repository-Snapshot-Hash", artifactSetHash: "Artefaktmengen-Hash",
  }),
});

const GERMAN_VALUES = Object.freeze({
  ready: "bereit", blocked: "blockiert", verified: "verifiziert", provisional: "vorläufig",
  failed: "fehlgeschlagen", supported: "gestützt", partial: "teilweise", unavailable: "nicht verfügbar", none: "keiner",
  "within-authority": "innerhalb der erklärten Autorität", "outside-authority": "außerhalb der erklärten Autorität",
  protected: "Grenze eines geschützten Pfads", "approval-required": "separate Freigabe erforderlich",
  intake: "Aufnahme", "intent-clarification": "Intent-Klärung", "root-plan-review": "Root-Plan-Review",
  implementing: "Implementierung läuft", reviewing: "Review läuft", correcting: "Korrektur läuft",
  "waiting-human": "wartet auf eine menschliche Entscheidung", achieved: "erreicht",
  paused: "pausiert", interrupted: "unterbrochen",
  "correction-needed": "Korrektur erforderlich", "open-points": "offene Punkte", "human-assessment": "menschliche Nachbeurteilung",
  "root-ready": "Root bereit", "review-needed": "Review erforderlich", "shadow-review": "Shadow Review", "review-work": "Review Work",
  "root-plan-not-intent-ready": "Root-Plan noch nicht intent-bereit",
  "harness-phase-failed": "Harness-Phase fehlgeschlagen", "harness-unavailable": "Harness nicht verfügbar",
  "manual-artifact-context-missing": "Manual-Artefaktkontext fehlt",
});

const KNOWN_GERMAN_TEXT = Object.freeze({
  "This Check is based on an unprotected Manual observation and cannot establish verified evidence.": "Dieser Check basiert auf einer ungeschützten Manual-Beobachtung und kann keine verifizierte Evidenz begründen.",
  "No project-harness observation was available for this verification intent.": "Für diese Verifikationsabsicht lag keine Beobachtung des Projektharness vor.",
  "The active project harness did not return evidence for this Check.": "Der aktive Projektharness lieferte für diesen Check keine Evidenz.",
  "The project harness attested a failed Check for the current repository snapshot.": "Der Projektharness attestierte einen fehlgeschlagenen Check für den aktuellen Repository-Snapshot.",
  "The project harness attested its observation, but this Check still requires an explicit human decision.": "Der Projektharness attestierte seine Beobachtung, aber dieser Check benötigt weiterhin eine ausdrückliche menschliche Entscheidung.",
  "The project harness reported this Check as unavailable.": "Der Projektharness meldete diesen Check als nicht verfügbar.",
  "The project harness reported a passing Check, but no protected host receipt binds it to this transition.": "Der Projektharness meldete einen bestandenen Check, aber kein geschützter Host-Beleg bindet ihn an diesen Übergang.",
  "No protected project-harness attestation binds this Check to the current Root and repository snapshot.": "Keine geschützte Projektharness-Attestierung bindet diesen Check an den aktuellen Root und Repository-Snapshot.",
  "A required failed Check blocks delivery.": "Ein fehlgeschlagener erforderlicher Check blockiert die Lieferung.",
  "Workflow does not interpret concrete execution and therefore needs a protected harness attestation for verified evidence.": "Workflow interpretiert keine konkrete Ausführung und benötigt deshalb für verifizierte Evidenz eine geschützte Harness-Attestierung.",
  "This Check is reserved for human authority.": "Dieser Check ist menschlicher Autorität vorbehalten.",
  "Request the named human decision before continuing.": "Fordere vor dem Fortfahren die benannte menschliche Entscheidung an.",
});

function localeOf(value) {
  return value === "de" ? "de" : "en";
}

function labels(locale) {
  return PRESENTATION_LABELS[localeOf(locale)];
}

function displayValue(locale, value) {
  const token = String(value ?? "none");
  return localeOf(locale) === "de" ? (GERMAN_VALUES[token] ?? token.replaceAll("-", " ")) : token.replaceAll("-", " ");
}

function safeInline(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function localizedKnownText(value, locale) {
  const source = String(value ?? "").trim();
  if (localeOf(locale) !== "de") return safeInline(source);
  if (KNOWN_GERMAN_TEXT[source]) return safeInline(KNOWN_GERMAN_TEXT[source]);
  const problem = source.match(/^(CHECK-[1-9][0-9]*) (failed and blocks delivery|is not bound to sufficient project-harness evidence|requires an explicit human decision)\.$/);
  if (problem) {
    const [, checkId, kind] = problem;
    const message = {
      "failed and blocks delivery": `${checkId} ist fehlgeschlagen und blockiert die Lieferung.`,
      "is not bound to sufficient project-harness evidence": `${checkId} ist nicht an ausreichende Projektharness-Evidenz gebunden.`,
      "requires an explicit human decision": `${checkId} benötigt eine ausdrückliche menschliche Entscheidung.`,
    }[kind];
    return safeInline(message);
  }
  const attest = source.match(/^Resolve the cause and ask the project harness to attest (CHECK-[1-9][0-9]*) again\.$/);
  if (attest) return safeInline(`Behebe die Ursache und lasse den Projektharness ${attest[1]} erneut attestieren.`);
  const observe = source.match(/^Have the active project harness observe (CHECK-[1-9][0-9]*) and return a protected attestation\.$/);
  if (observe) return safeInline(`Lasse den aktiven Projektharness ${observe[1]} beobachten und eine geschützte Attestierung zurückgeben.`);
  return safeInline(source);
}

function counted(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function concise(value, maximum = 320) {
  const source = safeInline(value);
  if (source.length <= maximum) return source;
  const suffix = " …";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}

function detailBlock(summary, lines) {
  const content = (lines ?? []).filter(Boolean);
  if (content.length === 0) return null;
  return `<details>\n<summary>${safeInline(summary)}</summary>\n\n${content.join("\n")}\n\n</details>`;
}

function actionLine(action, locale) {
  const de = localeOf(locale) === "de";
  if (action === "none") return de ? "- Keine weitere Workflow-Aktion erforderlich." : "- No further Workflow action is required.";
  if (action === "correct") return de ? "- **Correct Work**" : "- **Correct Work**";
  if (action === "human-assessment") return de
    ? "- Bitte beurteilen Sie die konkret benannten offenen Punkte in natürlicher Sprache."
    : "- Please assess the specifically named open points in natural language.";
  if (action === "review-work") return "- **Review Work**";
  const copy = labels(locale);
  return `- ${copy.actionToken}: \`${safeInline(action)}\``;
}

function shadowReason(code, locale) {
  const de = localeOf(locale) === "de";
  const reasons = de ? {
    "manual-input-invalid": "Die geschlossene Eingabe entspricht nicht dem erforderlichen Manual-Anfrageformat.",
    "manual-json-invalid": "Die Manual-Eingabe ist kein gültiges JSON-Objekt.",
    "schema-6-root-invalid": "Der bereitgestellte Root ist kein gültiger exakter Schema-6-Root.",
    "schema-6-chain-invalid": "Die bereitgestellte Schema-6-Artefaktkette ist ungültig oder unvollständig.",
    "artifact-bytes-conflict": "Für dieselbe Artefakt-ID wurden widersprüchliche Bytes bereitgestellt.",
    "foreign-artifact-chain": "Mindestens ein Artefakt gehört nicht zum aktuellen Root.",
    "check-observation-ambiguous": "Die Check-Beobachtungen sind nicht eindeutig.",
    "check-observations-incomplete": "Erforderliche Check-Beobachtungen fehlen und müssen intern nachgereicht werden.",
    "review-open-points-required": "Die Evidenz benötigt konkrete offene Punkte statt eines Achieved-Ergebnisses.",
    "unsupported-operation": "Die angeforderte Manual-Operation wird nicht unterstützt.",
  } : {
    "manual-input-invalid": "The closed input does not match the required Manual request shape.",
    "manual-json-invalid": "The Manual input is not a valid JSON object.",
    "schema-6-root-invalid": "The supplied Root is not a valid exact Schema-6 Root.",
    "schema-6-chain-invalid": "The supplied Schema-6 artifact chain is invalid or incomplete.",
    "artifact-bytes-conflict": "Conflicting bytes were supplied for the same artifact ID.",
    "foreign-artifact-chain": "At least one artifact does not belong to the current Root.",
    "check-observation-ambiguous": "The Check observations are ambiguous.",
    "check-observations-incomplete": "Required Check observations are missing and must be supplied by the internal retry.",
    "review-open-points-required": "The evidence requires concrete open points instead of an Achieved outcome.",
    "unsupported-operation": "The requested Manual operation is not supported.",
  };
  return reasons[code] ?? (de
    ? "Die Manual-Operation konnte ihre geschlossene Eingabe nicht sicher verarbeiten."
    : "The Manual operation could not safely process its closed input.");
}

function issueLine(issue) {
  if (!issue || typeof issue !== "object") return `- ${safeInline(issue)}`;
  const code = safeInline(issue.code ?? "issue");
  return `- ${code}: ${safeInline(issue.message ?? JSON.stringify(issue))}`;
}

function findingLine(finding, locale) {
  const de = localeOf(locale) === "de";
  const key = finding.key ?? finding["Finding key"];
  const severity = finding.severity ?? finding.Severity;
  const objectives = finding.objective_ids ?? String(finding.Objectives ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const checks = finding.check_ids ?? String(finding.Checks ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const evidence = finding.evidence ?? finding.Evidence;
  const reasoning = finding.reasoning ?? finding.Reasoning;
  const resolution = finding.resolution ?? finding.Resolution;
  return [
    `- [${safeInline(severity).toUpperCase()}] ${safeInline(key)} — ${de ? "Ziele" : "Objectives"}: ${objectives.map(safeInline).join(", ")}; Checks: ${checks.map(safeInline).join(", ")}; ${de ? "Evidenz" : "Evidence"}: ${safeInline(evidence)} ${de ? "Begründung" : "Reasoning"}: ${safeInline(reasoning)}`,
    ...(resolution ? [` ${de ? "Lösung" : "Resolution"}: ${safeInline(resolution)}`] : []),
    ".",
  ].join("");
}

function checkLine(check, locale) {
  const de = localeOf(locale) === "de";
  const hashes = (check.evidence_hashes ?? []).map(safeInline);
  const attestation = typeof check.attestation_hash === "string" ? safeInline(check.attestation_hash) : null;
  return [
    `- ${safeInline(check.check_id)} — ${de ? "Grad" : "grade"}: ${displayValue(locale, check.grade)}; ${de ? "Beobachtung" : "observed"}: ${localizedKnownText(check.observed, locale)}`,
    ...(hashes.length > 0 ? [`  - ${de ? "Evidenz-Hashes" : "Evidence hashes"}: ${hashes.join(", ")}`] : []),
    ...(attestation ? [`  - ${de ? "Attestierungs-Hash" : "Attestation hash"}: ${attestation}`] : []),
  ].join("\n");
}

function pathLines(pathAuthority, locale) {
  const de = localeOf(locale) === "de";
  const categories = [
    [de ? "Lieferpfade · erlaubt" : "Subject paths · allowed", pathAuthority?.allowed_paths],
    [de ? "Lieferpfade · außerhalb erlaubter Roots" : "Subject paths · outside allowed roots", pathAuthority?.outside_allowed_paths],
    [de ? "Lieferpfade · freigabepflichtig" : "Subject paths · approval required", pathAuthority?.approval_required_paths],
    [de ? "Lieferpfade · geschützt" : "Subject paths · protected", pathAuthority?.protected_paths],
    [de ? "Umgebungsänderungen · nicht Teil der Lieferung" : "Ambient changes · not part of delivery", pathAuthority?.ambient_paths],
  ];
  return categories.flatMap(([title, paths]) => (paths ?? []).length > 0
    ? [`- ${title} (${paths.length})`, ...paths.map((path) => `  - ${safeInline(path)}`)]
    : []);
}

function changedPathCount(pathAuthority) {
  return ["allowed_paths", "outside_allowed_paths", "approval_required_paths", "protected_paths", "ambient_paths"]
    .reduce((total, key) => total + (pathAuthority?.[key]?.length ?? 0), 0);
}

function scopeSummary(pathAuthority, locale) {
  const total = changedPathCount(pathAuthority);
  const count = localeOf(locale) === "de"
    ? counted(total, "geänderter Pfad", "geänderte Pfade")
    : counted(total, "changed path", "changed paths");
  return `${count}; ${displayValue(locale, pathAuthority?.status ?? "unknown")}`;
}

function authorityScopePresentation(pathAuthority, locale) {
  const count = pathAuthority?.outside_allowed_paths?.length ?? 0;
  if (count === 0) return null;
  return localeOf(locale) === "de"
    ? `Vorläufige Scope-Abweichung bleibt für ${count === 1 ? "1 Pfad" : `${count} Pfade`} sichtbar, ohne Autorität zu verleihen.`
    : `Provisional scope drift remains visible for ${counted(count, "path", "paths")} without granting authority.`;
}

function reviewDecision(review, locale) {
  const de = localeOf(locale) === "de";
  if (review.fields.outcome === "achieved") return de
    ? "Die genehmigten Akzeptanzziele sind im Repository erfüllt."
    : "The approved acceptance outcomes are satisfied in the repository.";
  if (review.fields.outcome === "correction-needed") return de
    ? "Die Umsetzung benötigt eine begrenzte Korrektur der unten genannten Feststellungen."
    : "The implementation needs one bounded correction for the findings below.";
  return de
    ? "Die Repository-Prüfung ist abgeschlossen; die unten genannten offenen Punkte benötigen eine menschliche Entscheidung."
    : "Repository inspection is complete; the open points below need a human decision.";
}

function requiredCheckSummary(requiredCheckIds, checks, locale) {
  const de = localeOf(locale) === "de";
  const required = new Set(requiredCheckIds);
  const observed = checks.filter((entry) => required.has(entry.check_id));
  if (required.size === 0) return de ? "keine erforderlichen Checks" : "no required Checks";
  const count = (grade) => observed.filter((entry) => entry.grade === grade).length;
  const verified = count("verified");
  const supported = count("supported");
  const sufficient = verified + supported;
  const missing = required.size - observed.length;
  const qualifiers = [
    ...(verified > 0 ? [`${verified} ${de ? "geschützt verifiziert" : "protected and verified"}`] : []),
    ...(supported > 0 ? [`${supported} ${de ? "manuell gestützt" : "manually supported"}`] : []),
    ...(count("partial") > 0 ? [`${count("partial")} ${de ? "teilweise" : "partial"}`] : []),
    ...(count("unavailable") > 0 ? [`${count("unavailable")} ${de ? "nicht verfügbar" : "unavailable"}`] : []),
    ...(count("failed") > 0 ? [`${count("failed")} ${de ? "fehlgeschlagen" : "failed"}`] : []),
    ...(missing > 0 ? [`${missing} ${de ? "ohne Beobachtung" : "without observation"}`] : []),
  ];
  const base = de
    ? `${sufficient}/${required.size} ausreichend belegt`
    : `${sufficient}/${required.size} sufficiently supported`;
  return qualifiers.length > 0 ? `${base} (${qualifiers.join(", ")})` : base;
}

function reviewDeviationSummary(reviewInput, locale) {
  const de = localeOf(locale) === "de";
  const findings = reviewInput.findings.length;
  const openPoints = reviewInput.open_points.length;
  if (findings === 0 && openPoints === 0) return de ? "keine Feststellungen oder offenen Punkte" : "no findings or open points";
  return de
    ? `${findings} ${findings === 1 ? "Feststellung" : "Feststellungen"}; ${openPoints} ${openPoints === 1 ? "offener Punkt" : "offene Punkte"}`
    : `${findings} ${findings === 1 ? "finding" : "findings"}; ${openPoints} open ${openPoints === 1 ? "point" : "points"}`;
}

function reviewScopeSummary(pathAuthority, locale) {
  const de = localeOf(locale) === "de";
  const allowed = pathAuthority?.allowed_paths?.length ?? 0;
  const outside = pathAuthority?.outside_allowed_paths?.length ?? 0;
  const approval = pathAuthority?.approval_required_paths?.length ?? 0;
  const protectedCount = pathAuthority?.protected_paths?.length ?? 0;
  const ambient = pathAuthority?.ambient_paths?.length ?? 0;
  const subject = allowed + outside + approval + protectedCount;
  const exceptions = outside + approval + protectedCount;
  const subjectSummary = subject === 0
    ? (de ? "keine Lieferpfade" : "no subject paths")
    : (de
      ? `${allowed}/${subject} Lieferpfade innerhalb der Autorität`
      : `${allowed}/${subject} subject paths within authority`);
  const parts = [subjectSummary];
  if (exceptions > 0) parts.push(de ? `${exceptions} mit Autoritätsabweichung` : `${exceptions} with authority deviations`);
  if (ambient > 0) parts.push(de
    ? `${ambient} sichtbare ${ambient === 1 ? "Umgebungsänderung" : "Umgebungsänderungen"}`
    : `${ambient} visible ambient ${ambient === 1 ? "change" : "changes"}`);
  return parts.join("; ");
}

function proofSummary(grade, locale) {
  const de = localeOf(locale) === "de";
  const summaries = de ? {
    verified: "verifiziert – geschützt an Root und Repository-Snapshot gebunden",
    supported: "gestützt – durch aktuelle manuelle Beobachtungen belegt, aber nicht geschützt verifiziert",
    partial: "teilweise – die vorhandenen Beobachtungen belegen das Ergebnis nicht vollständig",
    unavailable: "nicht verfügbar – ein erforderlicher Nachweis konnte nicht erhoben werden",
    failed: "fehlgeschlagen – mindestens ein erforderlicher Check ist nicht erfüllt",
  } : {
    verified: "verified – protected and bound to the Root and repository snapshot",
    supported: "supported – backed by current manual observations, but not protected and verified",
    partial: "partial – the available observations do not fully support the outcome",
    unavailable: "unavailable – required proof could not be obtained",
    failed: "failed – at least one required Check is not satisfied",
  };
  return summaries[grade] ?? displayValue(locale, grade);
}

function reviewFindingLine(finding) {
  const key = safeInline(finding.key ?? finding["Finding key"] ?? "finding");
  const severity = safeInline(finding.severity ?? finding.Severity ?? "unknown").toUpperCase();
  const summary = concise(finding.reasoning ?? finding.Reasoning ?? finding.evidence ?? finding.Evidence, 260);
  return `- [${severity}] ${key}: ${summary}`;
}

function reviewOpenPointLine(point, locale) {
  const de = localeOf(locale) === "de";
  return [
    `- ${safeInline(point.summary)}`,
    `  - ${de ? "Auswirkung" : "Impact"}: ${safeInline(point.impact)}`,
    `  - ${de ? "Frage" : "Question"}: ${safeInline(point.question)}`,
  ].join("\n");
}

function reviewCheckTable(checks, locale) {
  const de = localeOf(locale) === "de";
  const header = de
    ? "| Check | Grad | Beobachtung |\n|---|---|---|"
    : "| Check | Grade | Observation |\n|---|---|---|";
  const rows = checks.map((check) => `| ${safeInline(check.check_id)} | ${displayValue(locale, check.grade)} | ${concise(check.observed, 260).replaceAll("|", "\\|")} |`);
  return [header, ...rows].join("\n");
}

function exceptionalPathLines(pathAuthority, locale) {
  const de = localeOf(locale) === "de";
  const categories = [
    [de ? "Außerhalb erlaubter Roots" : "Outside allowed roots", pathAuthority?.outside_allowed_paths],
    [de ? "Freigabepflichtig" : "Approval required", pathAuthority?.approval_required_paths],
    [de ? "Geschützt" : "Protected", pathAuthority?.protected_paths],
    [de ? "Umgebungsänderungen" : "Ambient changes", pathAuthority?.ambient_paths],
  ];
  return categories.flatMap(([title, paths]) => (paths ?? []).length > 0
    ? [`- ${title} (${paths.length})`, ...paths.map((path) => `  - ${safeInline(path)}`)]
    : []);
}

function genericProofLimitation(value) {
  return /unprotected manual observation|cannot establish verified|no protected .*attestation|passing check.*no protected host receipt/i.test(String(value));
}

function reviewPresentation({ rootFields, evidence, review, reviewInput, repositoryObservation, pathAuthority, requiredCheckIds, locale }) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const findings = reviewInput.findings.map(reviewFindingLine);
  const openPointLines = reviewInput.open_points.map((point) => reviewOpenPointLine(point, lang));
  const scopeLimitation = authorityScopeLimitation(pathAuthority);
  const blockingLimitation = authorityBlockingLimitation(pathAuthority);
  const limitations = unique([
    ...repositoryObservation.limitations,
    ...(scopeLimitation ? [scopeLimitation] : []),
    ...(blockingLimitation ? [blockingLimitation] : []),
    ...reviewInput.open_points.map((point) => `${point.summary} ${point.impact}`),
    ...(evidence.fields.check_evidence ?? []).flatMap((entry) => entry.limitations ?? []),
  ]);
  const checks = evidence.fields.check_evidence ?? [];
  const shownScopeLimitation = authorityScopePresentation(pathAuthority, lang);
  const visibleOpenPointLimits = reviewInput.open_points.map((point) => `${point.summary} ${point.impact}`);
  const detailLimitations = limitations
    .filter((entry) => entry !== blockingLimitation)
    .map((entry) => entry === scopeLimitation ? shownScopeLimitation : entry)
    .filter((entry) => entry && !genericProofLimitation(entry) && !visibleOpenPointLimits.includes(entry));
  const presentation = {
    schema: 1,
    kind: "manual-review-presentation",
    root_plan_id: rootFields.id,
    evidence_id: evidence.fields.id,
    review_id: review.fields.id,
    outcome: review.fields.outcome,
    evidence_grade: evidence.fields.overall_grade,
    findings: reviewInput.findings,
    open_points: reviewInput.open_points,
    limitations,
    checks: evidence.fields.check_evidence,
    path_authority: pathAuthority,
    next_action: review.fields.next_action,
  };
  const exceptionalPaths = exceptionalPathLines(pathAuthority, lang);
  const detailSections = [
    ...(checks.length > 0 ? [`### ${copy.checks}\n\n${reviewCheckTable(checks, lang)}`] : []),
    ...(detailLimitations.length > 0 ? [`### ${copy.limitations}\n\n${detailLimitations.map((entry) => `- ${localizedKnownText(entry, lang)}`).join("\n")}`] : []),
    ...(exceptionalPaths.length > 0 ? [`### ${copy.exceptionalPaths}\n\n${exceptionalPaths.join("\n")}`] : []),
  ];
  const decisionLines = [
    `- ${copy.checks}: ${requiredCheckSummary(requiredCheckIds, checks, lang)}.`,
    `- ${copy.deviations}: ${reviewDeviationSummary(reviewInput, lang)}.`,
    `- ${copy.scope}: ${reviewScopeSummary(pathAuthority, lang)}.`,
    `- ${copy.proof}: ${proofSummary(evidence.fields.overall_grade, lang)}.`,
  ];
  const findingsSection = findings.length > 0 ? `### ${copy.findings}\n\n${findings.join("\n")}` : null;
  const openPointsSection = openPointLines.length > 0
    ? `### ${lang === "de" ? "Offene Punkte" : "Open points"}\n\n${openPointLines.join("\n")}`
    : null;
  const humanOutput = [
    `## Review · ${displayValue(lang, review.fields.outcome)}`,
    reviewDecision(review, lang),
    decisionLines.join("\n"),
    findingsSection,
    openPointsSection,
    `### ${copy.nextAction}`,
    actionLine(review.fields.next_action, lang),
    detailBlock(copy.details, detailSections),
  ].filter(Boolean).join("\n\n");
  return { presentation, humanOutput: `${humanOutput}\n` };
}

function planPresentation(result, rootPlan, locale) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const state = result.feasible ? "ready" : "blocked";
  const blockers = result.blocking_issues.map(issueLine);
  const advisories = (result.advisories ?? []).map(issueLine);
  const nextAction = result.feasible ? "implement-plan" : "human-assessment";
  const decision = result.feasible
    ? (lang === "de" ? "Der exakte Schema-6-Root ist gültig und bereit für eine separate menschliche Implementierungsfreigabe." : "The exact Schema-6 Root is valid and ready for separate human implementation approval.")
    : (lang === "de" ? "Der Root ist nicht implementierungsbereit und muss zuerst korrigiert werden." : "The Root is not ready for implementation and must be corrected first.");
  const reason = result.feasible
    ? (lang === "de" ? "Die Planvalidierung hat keine Blocker gefunden." : "Plan validation found no blockers.")
    : safeInline(result.blocking_issues[0]?.message ?? result.blocking_issues[0]?.code ?? "Plan validation failed.");
  return [
    lang === "de" ? `## Planvalidierung · ${displayValue(lang, state)}` : `## Plan validation · ${displayValue(lang, state)}`,
    `### ${copy.decision}`,
    `- ${decision}\n- ${copy.reason}: ${reason}`,
    `### ${copy.nextAction}`,
    actionLine(nextAction, lang),
    detailBlock(`${copy.planBlockers} (${blockers.length})`, blockers),
    detailBlock(`${copy.advisories} (${advisories.length})`, advisories),
    detailBlock(copy.traceability, [
      ...(result.root_plan_id ? [`- ${copy.root}: ${safeInline(result.root_plan_id)}`] : []),
      `- ${copy.rootHash}: ${sha256(rootPlan)}`,
    ]),
  ].filter(Boolean).join("\n\n") + "\n";
}

function statusPresentation(status, _accepted = false, pathAuthority = null, locale = "en", current = {}) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const snapshot = status.snapshot;
  const trace = status.artifact_summary ?? {};
  const currentFindings = (current.review?.fields?.findings ?? []).map((finding) => findingLine(finding, lang));
  const currentOpenPoints = (current.review?.fields?.open_points ?? []).map((point) => `- ${safeInline(point.summary)} — ${lang === "de" ? "Frage" : "Question"}: ${safeInline(point.question)}`);
  const currentChecks = (current.evidence?.fields?.check_evidence ?? []).map((check) => checkLine(check, lang));
  const currentLimitations = unique((current.evidence?.fields?.check_evidence ?? [])
    .flatMap((check) => check.limitations ?? []))
    .map((entry) => `- ${localizedKnownText(entry, lang)}`);
  const traceLines = [
    `- ${copy.root}: ${safeInline(trace.root_plan_id ?? snapshot.root_plan_id)}`,
    ...(trace.root_content_hash ? [`- ${copy.rootHash}: ${safeInline(trace.root_content_hash)}`] : []),
    ...(trace.evidence_tip ? [`- ${copy.evidence}: ${safeInline(trace.evidence_tip)}`] : []),
    ...(trace.evidence_hash ? [`- ${copy.evidence} ${copy.artifactHash}: ${safeInline(trace.evidence_hash)}`] : []),
    ...(trace.review_tip ? [`- ${copy.review}: ${safeInline(trace.review_tip)}`] : []),
    ...(trace.review_hash ? [`- ${copy.review} ${copy.artifactHash}: ${safeInline(trace.review_hash)}`] : []),
    ...(trace.artifact_set_hash ? [`- ${copy.artifactSetHash}: ${safeInline(trace.artifact_set_hash)}`] : []),
  ].filter((entry) => !entry.endsWith(": "));
  return [
    lang === "de" ? `## Workflow-Status · ${displayValue(lang, snapshot.state)}` : `## Workflow status · ${displayValue(lang, snapshot.state)}`,
    `### ${copy.decision}`,
    [
      lang === "de" ? `- Der aktuelle menschlich relevante Zustand ist ${displayValue(lang, snapshot.state)}.` : `- The current human-relevant state is ${displayValue(lang, snapshot.state)}.`,
      lang === "de" ? "- Der Zustand wurde ausschließlich aus der exakten Artefaktkette abgeleitet." : "- The state was derived only from the exact artifact chain.",
      `- ${copy.evidenceGrade}: ${displayValue(lang, snapshot.evidence_grade ?? "none")}.`,
      `- ${copy.scope}: ${scopeSummary(pathAuthority, lang)}.`,
    ].join("\n"),
    `### ${copy.nextAction}`,
    actionLine(snapshot.next_action, lang),
    detailBlock(`${copy.findings} (${currentFindings.length})`, currentFindings),
    detailBlock(`${lang === "de" ? "Offene Punkte" : "Open points"} (${currentOpenPoints.length})`, currentOpenPoints),
    detailBlock(`${copy.checks} (${currentChecks.length})`, currentChecks),
    detailBlock(`${copy.limitations} (${currentLimitations.length})`, currentLimitations),
    detailBlock(`${copy.changedPaths} (${changedPathCount(pathAuthority)})`, pathLines(pathAuthority, lang)),
    detailBlock(copy.traceability, traceLines),
  ].filter(Boolean).join("\n\n") + "\n";
}

function validatePlan(request, pluginRoot) {
  const result = preflightRootPlan(request.root_plan, pluginRoot);
  return {
    schema: 1,
    kind: "manual-plan-validation",
    ok: result.feasible,
    root_plan_id: result.root_plan_id,
    root_content_hash: sha256(request.root_plan),
    result,
    human_output: planPresentation(result, request.root_plan, request.presentation_locale),
    artifacts: [],
  };
}

function buildPlan(request, pluginRoot) {
  const built = buildWorkflowAuthorityPlan(request.plan_markdown, request.authority_core);
  const exact = extractEmbeddedWorkPlanText(built.root_plan);
  if (!exact) throw codedError("schema-6-root-invalid", "Generated workflow authority core could not be normalized");
  const result = preflightRootPlan(exact, pluginRoot);
  if (!result.feasible) throw codedError("schema-6-root-invalid", `Generated Schema-6 Root is invalid: ${result.blocking_issues.map((entry) => entry.message ?? entry.code).join("; ")}`);
  return {
    schema: 1,
    kind: "manual-plan-build",
    ok: true,
    root_plan_id: built.core.id,
    plan_content_hash: built.core.plan_content_hash,
    root_content_hash: sha256(exact),
    root_plan: built.root_plan,
    result,
    human_output: planPresentation(result, exact, request.presentation_locale),
    artifacts: [],
  };
}

function buildReview(request, pluginRoot) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(request.root_plan, pluginRoot);
  if (contract.errors.length > 0) throw codedError("schema-6-root-invalid", `Root execution contract is invalid: ${contract.errors.join("; ")}`);
  const hashes = observationHashes(request.repository_observation);
  const pathAuthority = classifyChangedPathAuthority(
    exact.rootFields,
    hashes.normalized.subject_changed_paths,
    hashes.normalized.repository_root,
    hashes.normalized.ambient_changed_paths,
  );
  const blockingAuthorityLimitation = authorityBlockingLimitation(pathAuthority);
  const scopeAuthorityLimitation = authorityScopeLimitation(pathAuthority);
  const authorityReviewInput = blockingAuthorityLimitation
    ? authorityLimitedReviewInput(request.review_input, blockingAuthorityLimitation)
    : scopeAuthorityLimitation
      ? scopeLimitedReviewInput(request.review_input, scopeAuthorityLimitation)
      : request.review_input;
  const localCheckEvidence = checkEvidence(request.check_observations);
  const requiredCheckIds = contract.checks.filter((check) => check.Required === "yes").map((check) => check["Check ID"]);
  const effectiveReviewInput = observationLimitedReviewInput(authorityReviewInput, request.check_observations, requiredCheckIds);
  const evidenceTipId = exact.tips.evidence_tips[exact.rootFields.id] ?? null;
  const reviewTipId = exact.tips.review_tips[exact.rootFields.id] ?? null;
  const reviewTip = reviewTipId ? exact.chain.effective.get(reviewTipId) : null;
  const correctionPending = Boolean(
    evidenceTipId
    && reviewTip?.fields?.latest_evidence_id === evidenceTipId
    && reviewTip?.fields?.next_action === "correct"
    && reviewTip?.fields?.correction_id,
  );

  let evidence;
  let reviewArtifacts;
  let chainUpdate;
  if (!evidenceTipId || correctionPending) {
    evidence = buildDeliveryEvidence({
      rootPlanText: request.root_plan,
      artifacts: exact.entries,
      checkEvidence: localCheckEvidence,
      changedPaths: hashes.normalized.subject_changed_paths,
      ambientPaths: hashes.normalized.ambient_changed_paths,
      effectiveProfile: "manual",
      harnessAttestations: [],
      enforceHarnessAttestations: true,
      workspaceBinding: hashes.workspaceBindingHash,
      workspaceSnapshotHash: hashes.snapshotHash,
      forcedStatus: blockingAuthorityLimitation ? "blocked" : null,
      allowManualScopeDrift: true,
      summary: blockingAuthorityLimitation,
      pluginRoot,
    });
    reviewArtifacts = [...exact.entries, { label: evidence.fields.id, text: evidence.artifact }];
    chainUpdate = "append";
  } else {
    const refreshBaseEntries = exact.entries.filter((entry) => ![evidenceTipId, reviewTipId].includes(entry.label));
    const candidate = buildDeliveryEvidence({
      rootPlanText: request.root_plan,
      artifacts: refreshBaseEntries,
      checkEvidence: localCheckEvidence,
      changedPaths: hashes.normalized.subject_changed_paths,
      ambientPaths: hashes.normalized.ambient_changed_paths,
      effectiveProfile: "manual",
      harnessAttestations: [],
      enforceHarnessAttestations: true,
      workspaceBinding: hashes.workspaceBindingHash,
      workspaceSnapshotHash: hashes.snapshotHash,
      forcedStatus: blockingAuthorityLimitation ? "blocked" : null,
      allowManualScopeDrift: true,
      summary: blockingAuthorityLimitation,
      pluginRoot,
    });
    const existingEvidence = exact.entries.find((entry) => entry.label === evidenceTipId)?.text ?? null;
    if (existingEvidence === candidate.artifact) {
      evidence = { ...candidate, duplicate: true };
      reviewArtifacts = exact.entries;
      chainUpdate = "reuse";
    } else {
      evidence = candidate;
      reviewArtifacts = [...refreshBaseEntries, { label: candidate.fields.id, text: candidate.artifact }];
      chainUpdate = candidate.fields.representation === "delta" ? "replace-delta-suffix" : "replace-full-tip";
    }
  }

  const review = buildWorkReview({
    rootPlanText: request.root_plan,
    artifacts: reviewArtifacts,
    reviewInput: effectiveReviewInput,
    allowUnprovenancedReviews: true,
    pluginRoot,
  });
  const shown = reviewPresentation({
    rootFields: exact.rootFields,
    evidence,
    review,
    reviewInput: review.normalized_review_input,
    repositoryObservation: request.repository_observation,
    pathAuthority,
    requiredCheckIds,
    locale: request.presentation_locale,
  });
  return {
    schema: 1,
    kind: "manual-review-result",
    ok: true,
    mode: "manual-local",
    root_plan_id: exact.rootFields.id,
    root_content_hash: sha256(request.root_plan),
    intent_hash: contract.authoritative_projection_hash,
    workspace_binding_hash: hashes.workspaceBindingHash,
    repository_snapshot_hash: hashes.snapshotHash,
    chain_update: chainUpdate,
    path_authority: pathAuthority,
    presentation: shown.presentation,
    human_output: shown.humanOutput,
    artifacts: [
      { artifact: "delivery-evidence", label: evidence.fields.id, text: evidence.artifact, artifact_hash: evidence.artifact_hash },
      { artifact: "work-review", label: review.fields.id, text: review.artifact, artifact_hash: review.artifact_hash },
    ],
  };
}

function deriveStatus(request, pluginRoot) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const evidenceTipId = exact.tips.evidence_tips[exact.rootFields.id] ?? null;
  const reviewTipId = exact.tips.review_tips[exact.rootFields.id] ?? null;
  const current = {
    evidence: evidenceTipId ? exact.chain.effective.get(evidenceTipId) : null,
    review: reviewTipId ? exact.chain.effective.get(reviewTipId) : null,
  };
  const status = deriveManualWorkflowSnapshot({
    rootPlanId: exact.rootFields.id,
    artifacts: exact.entries,
    pluginRoot,
    observedAt: DETERMINISTIC_OBSERVED_AT,
  });
  const pathAuthority = classifyChangedPathAuthority(exact.rootFields, status.changed_paths, null, status.ambient_paths);
  return {
    schema: 1,
    kind: "manual-workflow-status",
    ok: true,
    snapshot: status.snapshot,
    artifact_summary: status.artifact_summary,
    diagnostics: status.diagnostics,
    changed_paths: status.changed_paths,
    ambient_paths: status.ambient_paths,
    path_authority: pathAuthority,
    human_output: statusPresentation(status, false, pathAuthority, request.presentation_locale, current),
    artifacts: [],
  };
}

function shadowError(operation, input, error) {
  const locale = localeOf(input?.presentation_locale);
  const copy = labels(locale);
  const code = error?.code ?? "manual-workflow-failed";
  const message = String(error?.message ?? error);
  if (operation === "build-review" && code === "check-observations-incomplete") {
    const checkIds = unique(error?.check_ids ?? []);
    const signature = sha256(stableJson({ code, check_ids: checkIds }));
    return {
      schema: 1,
      kind: "manual-review-internal-retry",
      ok: false,
      mode: "internal-retry",
      operation,
      retryable: true,
      retry_signature: signature,
      missing_check_ids: checkIds,
      next_action: "internal-retry",
      error: { code, message },
      human_output: locale === "de"
        ? `Interner Review-Retry: Es fehlen Beobachtungen für ${checkIds.join(", ")}. Es wurden keine Artefakte erstellt.`
        : `Internal Review retry: observations are missing for ${checkIds.join(", ")}. No artifacts were created.`,
      artifacts: [],
    };
  }
  if (operation === "build-review" && code === "schema-6-root-invalid") {
    const supplied = input?.review_input ?? {};
    const point = {
      key: "formal-binding",
      type: "formal-binding",
      summary: locale === "de" ? "Der menschliche Plan ist nicht an einen gültigen Authority Core gebunden." : "The human plan is not bound to a valid Authority Core.",
      evidence: message,
      impact: locale === "de" ? "Der repository-read-only Review bleibt informativ, kann aber keine Artefakte oder Korrekturautorität erzeugen." : "The repository-read-only review remains informative but cannot create artifacts or correction authority.",
      question: locale === "de" ? "Soll ein gültiger Authority Core erzeugt werden, bevor eine Korrektur autorisiert wird?" : "Should a valid Authority Core be generated before any correction is authorized?",
    };
    const findings = (supplied.findings ?? []).map(reviewFindingLine);
    const openPoints = [...(supplied.open_points ?? []), point];
    const openPointLines = openPoints.map((entry) => reviewOpenPointLine(entry, locale));
    return {
      schema: 1,
      kind: "manual-shadow-review",
      ok: true,
      mode: "shadow-review",
      operation,
      outcome: "shadow-review",
      next_action: "human-assessment",
      findings: supplied.findings ?? [],
      open_points: openPoints,
      error: { code, message },
      human_output: [
        locale === "de" ? "## Shadow Review · formale Bindung fehlt" : "## Shadow review · formal binding missing",
        locale === "de"
          ? "Die Repository-Prüfung bleibt informativ, kann aber keine autoritativen Artefakte oder Korrekturautorität erzeugen."
          : "Repository inspection remains informative, but it cannot create authoritative artifacts or correction authority.",
        findings.length > 0 ? `### ${copy.findings}\n\n${findings.join("\n")}` : null,
        `### ${locale === "de" ? "Offene Punkte" : "Open points"}\n\n${openPointLines.join("\n")}`,
        `### ${copy.nextAction}`,
        actionLine("human-assessment", locale),
      ].filter(Boolean).join("\n\n") + "\n",
      artifacts: [],
    };
  }
  const nextAction = error?.nextAction ?? "human-assessment";
  return {
    schema: 1,
    kind: "manual-workflow-error",
    ok: false,
    mode: "shadow",
    operation,
    error: { code, message },
    input_preserved: true,
    supplied_root_retained: typeof input?.root_plan === "string",
    supplied_artifact_count: Array.isArray(input?.artifacts) ? input.artifacts.length : 0,
    next_action: nextAction,
    human_output: [
      locale === "de" ? "## Manueller Workflow · Shadow" : "## Manual workflow · shadow",
      `### ${copy.decision}`,
      locale === "de"
        ? `- Die angeforderte Manual-Operation konnte nicht abgeschlossen werden.\n- ${copy.reason}: ${shadowReason(code, locale)}\n- Es wurde kein Schema-6-Evidence- oder Review-Artefakt erstellt.\n- Nur diese Manual-Operation ist betroffen; die normale Host- und Workflow-Nutzung bleibt verfügbar.`
        : `- The requested Manual operation could not be completed.\n- ${copy.reason}: ${shadowReason(code, locale)}\n- No Schema-6 Evidence or Review artifact was created.\n- Only this Manual operation is affected; normal host and Workflow use remains available.`,
      `### ${copy.nextAction}`,
      actionLine(nextAction, locale),
      detailBlock(copy.traceability, [
        `- ${locale === "de" ? "Operation" : "Operation"}: ${safeInline(operation)}`,
        `- ${locale === "de" ? "Fehlercode" : "Error code"}: ${safeInline(code)}`,
        `- ${locale === "de" ? "Fehler" : "Error"}: ${safeInline(message)}`,
        `- ${locale === "de" ? "Root bereitgestellt" : "Root supplied"}: ${typeof input?.root_plan === "string" ? (locale === "de" ? "ja" : "yes") : (locale === "de" ? "nein" : "no")}`,
        `- ${locale === "de" ? "Bereitgestellte Artefakte" : "Supplied artifacts"}: ${Array.isArray(input?.artifacts) ? input.artifacts.length : 0}`,
      ]),
    ].filter(Boolean).join("\n\n") + "\n",
    artifacts: [],
  };
}

export function executeManualOperation(operation, input, { pluginRoot = defaultRoot } = {}) {
  try {
    const request = exactRootRequest(parseRequest(operation, input));
    if (operation === "build-plan") return buildPlan(request, pluginRoot);
    if (operation === "validate-plan") return validatePlan(request, pluginRoot);
    if (operation === "build-review") return buildReview(request, pluginRoot);
    if (operation === "status") return deriveStatus(request, pluginRoot);
    throw codedError("unsupported-operation", `Unsupported manual-workflow operation: ${operation}`);
  } catch (error) {
    return shadowError(operation, input, error);
  }
}

export function serializeManualResult(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function main() {
  const operation = process.argv[2];
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch (error) {
    const result = shadowError(operation ?? "unknown", null, codedError("manual-json-invalid", `Manual input must be one JSON object: ${error.message}`));
    process.stdout.write(serializeManualResult(result));
    process.exitCode = 2;
    return;
  }
  const result = executeManualOperation(operation, input);
  process.stdout.write(serializeManualResult(result));
  if (!result.ok) process.exitCode = 2;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
