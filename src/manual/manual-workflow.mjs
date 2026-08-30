import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";
import {
  defaultRoot,
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan,
} from "../../scripts/validate-artifact.source.mjs";
import { classifyChangedPathAuthority } from "../core/manual-path-authority.mjs";
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

const acceptRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("accept-provisional"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
  presentation_locale: presentationLocaleSchema,
});

const schemas = Object.freeze({
  "validate-plan": validatePlanRequestSchema,
  "build-review": buildReviewRequestSchema,
  status: statusRequestSchema,
  "accept-provisional": acceptRequestSchema,
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

function boundedLine(value, maximum = 1_900) {
  const source = String(value ?? "").trim();
  if (source.length <= maximum) return source;
  const suffix = " … [bounded]";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}

function authorityLimitedReviewInput(reviewInput, message) {
  const limitation = boundedLine(message);
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment) ? "partially-achieved" : reviewInput.assessment,
    recommended_action: "clarify",
    snapshot_assessment: "incomplete",
    snapshot_summary: boundedLine(`${reviewInput.snapshot_summary} ${limitation}`),
    missing_evidence: unique([...(reviewInput.missing_evidence ?? []), limitation]),
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
  const limitation = boundedLine(message);
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment) ? "provisional" : reviewInput.assessment,
    recommended_action: ["none", "accept-provisional"].includes(reviewInput.recommended_action)
      ? "accept-provisional"
      : reviewInput.recommended_action,
    missing_evidence: unique([...(reviewInput.missing_evidence ?? []), limitation]),
  };
}

const PRESENTATION_LABELS = Object.freeze({
  en: Object.freeze({
    decision: "Decision", nextAction: "Next action", actionToken: "Action token", repositoryOutcome: "Repository outcome",
    reason: "Reason", evidenceGrade: "Evidence grade", proofBoundary: "Proof boundary", scope: "Scope",
    findings: "Findings", checks: "Checks", limitations: "Limitations", changedPaths: "Changed paths",
    traceability: "Traceability", planBlockers: "Plan blockers", advisories: "Advisories",
    root: "Root", evidence: "Evidence", review: "Review", artifactHash: "artifact hash",
    rootHash: "Root content hash", intentHash: "Intent hash", workspaceBindingHash: "Workspace binding hash",
    repositorySnapshotHash: "Repository snapshot hash", artifactSetHash: "Artifact-set hash",
  }),
  de: Object.freeze({
    decision: "Entscheidung", nextAction: "Nächste Aktion", actionToken: "Aktions-Token", repositoryOutcome: "Repository-Ergebnis",
    reason: "Grund", evidenceGrade: "Evidenzgrad", proofBoundary: "Nachweisgrenze", scope: "Umfang",
    findings: "Feststellungen", checks: "Checks", limitations: "Grenzen", changedPaths: "Geänderte Pfade",
    traceability: "Rückverfolgbarkeit", planBlockers: "Planblocker", advisories: "Hinweise",
    root: "Root", evidence: "Evidence", review: "Review", artifactHash: "Artefakt-Hash",
    rootHash: "Root-Inhalts-Hash", intentHash: "Intent-Hash", workspaceBindingHash: "Workspace-Bindungs-Hash",
    repositorySnapshotHash: "Repository-Snapshot-Hash", artifactSetHash: "Artefaktmengen-Hash",
  }),
});

const GERMAN_VALUES = Object.freeze({
  ready: "bereit", blocked: "blockiert", verified: "verifiziert", provisional: "vorläufig",
  failed: "fehlgeschlagen", supported: "gestützt", partial: "teilweise", unavailable: "nicht verfügbar", none: "keiner",
  "within-authority": "innerhalb der erklärten Autorität", "provisional-drift": "vorläufige Scope-Abweichung",
  protected: "Grenze eines geschützten Pfads", "approval-required": "separate Freigabe erforderlich",
  intake: "Aufnahme", "intent-clarification": "Intent-Klärung", "root-plan-review": "Root-Plan-Review",
  implementing: "Implementierung läuft", reviewing: "Review läuft", correcting: "Korrektur läuft",
  "delivery-ready-verified": "verifiziert lieferbereit", "delivery-ready-provisional": "vorläufig lieferbereit",
  "waiting-human": "wartet auf eine menschliche Entscheidung", replan: "Neuplanung", achieved: "erreicht",
  "accepted-provisional": "vorläufig angenommen", paused: "pausiert", interrupted: "unterbrochen",
  stopped: "gestoppt", "review-requires-clarification": "Review benötigt Klärung",
  "schema-6-replan-required": "Schema-6-Neuplanung erforderlich", "root-plan-not-intent-ready": "Root-Plan noch nicht intent-bereit",
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
  const copy = labels(locale);
  const token = safeInline(action);
  return `- ${copy.actionToken}: \`${token}\``;
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
    "manual-acceptance-denied": "Die aktuelle exakte Artefaktkette kann nicht vorläufig angenommen werden.",
    "unsupported-operation": "Die angeforderte Manual-Operation wird nicht unterstützt.",
  } : {
    "manual-input-invalid": "The closed input does not match the required Manual request shape.",
    "manual-json-invalid": "The Manual input is not a valid JSON object.",
    "schema-6-root-invalid": "The supplied Root is not a valid exact Schema-6 Root.",
    "schema-6-chain-invalid": "The supplied Schema-6 artifact chain is invalid or incomplete.",
    "artifact-bytes-conflict": "Conflicting bytes were supplied for the same artifact ID.",
    "foreign-artifact-chain": "At least one artifact does not belong to the current Root.",
    "check-observation-ambiguous": "The Check observations are ambiguous.",
    "manual-acceptance-denied": "The current exact artifact chain is not eligible for provisional acceptance.",
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
  if (review.fields.assessment === "achieved" && review.fields.next_action === "none") {
    if (review.fields.delivery_status === "verified") return de
      ? "Alles OK: Die Akzeptanzziele sind erreicht und die Lieferung ist verifiziert."
      : "All good: the acceptance outcomes are achieved and delivery is verified.";
    return de
      ? "Alles OK: Die Akzeptanzziele sind erreicht; der Nachweis bleibt unterhalb von verifiziert."
      : "All good: the acceptance outcomes are achieved; proof remains below verified.";
  }
  if (review.fields.delivery_status === "blocked") return de
    ? "Dieser Liefer-Snapshot ist blockiert."
    : "This delivery snapshot is blocked.";
  if (review.fields.delivery_status === "provisional") return de
    ? "Diese Lieferung ist vorläufig und benötigt eine menschliche Entscheidung."
    : "This delivery is provisional and needs a human decision.";
  return de ? "Diese Lieferung ist verifiziert." : "This delivery is verified.";
}

function reviewReason({ review, reviewInput, pathAuthority, checks }, locale) {
  const de = localeOf(locale) === "de";
  const failed = checks.find((entry) => entry.grade === "failed");
  if (failed) return de
    ? `Erforderlicher Check ${safeInline(failed.check_id)} ist fehlgeschlagen und blockiert diese Lieferung.`
    : `Required Check ${safeInline(failed.check_id)} failed and blocks this delivery.`;
  if ((pathAuthority?.protected_paths ?? []).length > 0) return de
    ? (pathAuthority.protected_paths.length === 1 ? "1 geschützter geänderter Pfad blockiert diese Lieferung." : `${pathAuthority.protected_paths.length} geschützte geänderte Pfade blockieren diese Lieferung.`)
    : `${counted(pathAuthority.protected_paths.length, "protected changed path blocks", "protected changed paths block")} this delivery.`;
  if ((pathAuthority?.approval_required_paths ?? []).length > 0) return de
    ? (pathAuthority.approval_required_paths.length === 1 ? "1 geänderter Pfad benötigt eine separate menschliche Freigabe." : `${pathAuthority.approval_required_paths.length} geänderte Pfade benötigen eine separate menschliche Freigabe.`)
    : `${counted(pathAuthority.approval_required_paths.length, "changed path requires", "changed paths require")} separate human approval.`;
  if (reviewInput.findings.length > 0) return de
    ? `${counted(reviewInput.findings.length, "Feststellung führt", "Feststellungen führen")} zur Aktion ${safeInline(review.fields.next_action)}.`
    : `${counted(reviewInput.findings.length, "finding requires", "findings require")} the ${safeInline(review.fields.next_action)} action.`;
  const reasons = {
    "accept-provisional": de ? "Die Review fand keinen Lieferblocker; die Evidenz bleibt vorläufig." : "The Review found no delivery blocker; the evidence remains provisional.",
    replan: de ? "Das beabsichtigte Ergebnis benötigt eine neu freigegebene Root-Autorität." : "The intended outcome requires newly approved Root authority.",
    clarify: de ? "Eine benannte menschliche Entscheidung bleibt offen." : "A named human decision remains open.",
    "retry-review": de ? "Für den aktuellen Snapshot ist eine frische Review erforderlich." : "The current snapshot requires a fresh Review.",
    none: de ? "Die Review hat die Akzeptanzziele erreicht." : "The Review achieved the acceptance outcomes.",
  };
  return reasons[review.fields.next_action] ?? (de ? "Die Review hat eine weitere Workflow-Aktion abgeleitet." : "The Review derived a further Workflow action.");
}

function reviewPresentation({ rootFields, rootPlan, evidence, review, reviewInput, repositoryObservation, pathAuthority, trace, locale }) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const findings = reviewInput.findings.map((finding) => findingLine(finding, lang));
  const scopeLimitation = authorityScopeLimitation(pathAuthority);
  const blockingLimitation = authorityBlockingLimitation(pathAuthority);
  const limitations = unique([
    ...repositoryObservation.limitations,
    ...(scopeLimitation ? [scopeLimitation] : []),
    ...(blockingLimitation ? [blockingLimitation] : []),
    ...reviewInput.missing_evidence,
    ...(evidence.fields.check_evidence ?? []).flatMap((entry) => entry.limitations ?? []),
  ]);
  const checks = evidence.fields.check_evidence ?? [];
  const checkLines = checks.map((entry) => checkLine(entry, lang));
  const shownScopeLimitation = authorityScopePresentation(pathAuthority, lang);
  const proofLimitations = limitations
    .filter((entry) => entry !== blockingLimitation)
    .map((entry) => entry === scopeLimitation ? shownScopeLimitation : entry)
    .filter(Boolean);
  const primaryProofBoundary = evidence.fields.overall_grade !== "verified"
    ? (lang === "de"
      ? "Ungeschützte Manual-Beobachtungen können keine verifizierte Lieferung belegen."
      : "Unprotected Manual observations cannot establish verified delivery.")
    : null;
  const statusLabel = displayValue(lang, review.fields.delivery_status);
  const presentation = {
    schema: 1,
    kind: "manual-review-presentation",
    root_plan_id: rootFields.id,
    evidence_id: evidence.fields.id,
    review_id: review.fields.id,
    assessment: review.fields.assessment,
    delivery_status: review.fields.delivery_status,
    evidence_grade: evidence.fields.overall_grade,
    findings: reviewInput.findings,
    limitations,
    checks: evidence.fields.check_evidence,
    path_authority: pathAuthority,
    next_action: review.fields.next_action,
  };
  const traceLines = [
    `- ${copy.root}: ${safeInline(rootFields.id)}`,
    `- ${copy.rootHash}: ${sha256(rootPlan)}`,
    `- ${copy.intentHash}: ${safeInline(trace.intent_hash)}`,
    `- ${copy.workspaceBindingHash}: ${safeInline(trace.workspace_binding_hash)}`,
    `- ${copy.repositorySnapshotHash}: ${safeInline(trace.repository_snapshot_hash)}`,
    `- ${copy.evidence}: ${safeInline(evidence.fields.id)}`,
    `- ${copy.evidence} ${copy.artifactHash}: ${safeInline(evidence.artifact_hash)}`,
    `- ${copy.review}: ${safeInline(review.fields.id)}`,
    `- ${copy.review} ${copy.artifactHash}: ${safeInline(review.artifact_hash)}`,
  ];
  const detailBlocks = [
    detailBlock(`${copy.findings} (${findings.length})`, findings),
    detailBlock(`${copy.checks} (${checkLines.length})`, checkLines),
    detailBlock(`${copy.limitations} (${proofLimitations.length})`, proofLimitations.map((entry) => `- ${localizedKnownText(entry, lang)}`)),
    detailBlock(`${copy.changedPaths} (${changedPathCount(pathAuthority)})`, pathLines(pathAuthority, lang)),
    detailBlock(copy.traceability, traceLines),
  ].filter(Boolean);
  const decisionLines = [
    `- ${reviewDecision(review, lang)}`,
    `- ${copy.reason}: ${reviewReason({ review, reviewInput, pathAuthority, checks }, lang)}`,
    `- ${copy.repositoryOutcome}: ${concise(reviewInput.assessment_summary)}`,
    `- ${copy.evidenceGrade}: ${displayValue(lang, evidence.fields.overall_grade)}.`,
    ...(primaryProofBoundary ? [`- ${copy.proofBoundary}: ${concise(primaryProofBoundary)}`] : []),
    `- ${copy.scope}: ${scopeSummary(pathAuthority, lang)}.`,
    ...(review.fields.delivery_status === "blocked" ? [lang === "de"
      ? "- Nur dieser Liefer-Snapshot ist blockiert; die normale Host- und Workflow-Nutzung bleibt verfügbar."
      : "- Only this delivery snapshot is blocked; normal host and Workflow use remains available."] : []),
  ];
  const terminalSuccess = review.fields.assessment === "achieved" && review.fields.next_action === "none";
  const humanOutput = [
    terminalSuccess
      ? (lang === "de" ? "## Review-Ergebnis · alles OK" : "## Review result · all good")
      : (lang === "de" ? `## Review-Ergebnis · Lieferung ${statusLabel}` : `## Review result · Delivery ${statusLabel}`),
    `### ${copy.decision}`,
    decisionLines.join("\n"),
    `### ${copy.nextAction}`,
    actionLine(review.fields.next_action, lang),
    ...detailBlocks,
  ].join("\n\n");
  return { presentation, humanOutput: `${humanOutput}\n` };
}

function planPresentation(result, rootPlan, locale) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const state = result.feasible ? "ready" : "blocked";
  const blockers = result.blocking_issues.map(issueLine);
  const advisories = (result.advisories ?? []).map(issueLine);
  const nextAction = result.feasible ? "implement-plan" : "correct-plan";
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

function statusPresentation(status, accepted = false, pathAuthority = null, locale = "en", current = {}) {
  const lang = localeOf(locale);
  const copy = labels(lang);
  const snapshot = status.snapshot;
  const problems = status.problem_details ?? [];
  const blockingProblems = problems.filter((entry) => entry.blocking === true);
  const proofProblems = problems.filter((entry) => entry.blocking !== true);
  const snapshotBlockers = unique(snapshot.blockers ?? []);
  const decision = accepted
    ? (lang === "de"
      ? "Die vorläufige Lieferung ist für diese Aufgabe ausdrücklich angenommen; die Annahme wird nicht gespeichert und ändert den Evidenzgrad nicht."
      : "The provisional delivery is explicitly accepted for this task; acceptance is not persisted and does not change the evidence grade.")
    : (lang === "de"
      ? `Der manuelle Workflow hat den Status ${displayValue(lang, snapshot.state)}.`
      : `The Manual Workflow is in the ${displayValue(lang, snapshot.state)} state.`);
  const blockingIds = unique(blockingProblems.map((entry) => entry.check_id));
  const reason = blockingProblems.length > 0
    ? (lang === "de"
      ? `${counted(blockingProblems.length, "Lieferblocker", "Lieferblocker")}${blockingIds.length > 0 ? ` (${blockingIds.join(", ")})` : ""} ${blockingProblems.length === 1 ? "benötigt" : "benötigen"} Aufmerksamkeit.`
      : `${counted(blockingProblems.length, "delivery blocker", "delivery blockers")}${blockingIds.length > 0 ? ` (${blockingIds.join(", ")})` : ""} ${blockingProblems.length === 1 ? "needs" : "need"} attention.`)
    : snapshotBlockers.length > 0
      ? (lang === "de"
        ? `${counted(snapshotBlockers.length, "Lebenszyklus-Blocker", "Lebenszyklus-Blocker")} ${snapshotBlockers.length === 1 ? "benötigt" : "benötigen"} Aufmerksamkeit.`
        : `${counted(snapshotBlockers.length, "lifecycle blocker", "lifecycle blockers")} ${snapshotBlockers.length === 1 ? "needs" : "need"} attention.`)
      : accepted
        ? (lang === "de" ? "Die Annahme ist flüchtig und verleiht keine dauerhafte Autorität." : "Acceptance is ephemeral and grants no persistent authority.")
        : (lang === "de" ? "Der Zustand wurde ausschließlich aus der exakten Artefaktkette abgeleitet." : "The state was derived only from the exact artifact chain.");
  const proofBoundary = proofProblems.length > 0
    ? (lang === "de"
      ? `${counted(proofProblems.length, "Nachweisgrenze verhindert", "Nachweisgrenzen verhindern")} eine verifizierte Aussage.`
      : `${counted(proofProblems.length, "proof limitation prevents", "proof limitations prevent")} a verified claim.`)
    : snapshot.evidence_grade && snapshot.evidence_grade !== "verified"
      ? (lang === "de" ? `Der Evidenzgrad ${displayValue(lang, snapshot.evidence_grade)} belegt keine verifizierte Lieferung.` : `Evidence grade ${displayValue(lang, snapshot.evidence_grade)} does not establish verified delivery.`)
      : null;
  const problemLines = problems.map((entry) => [
    `- ${localizedKnownText(entry.problem, lang)}`,
    ...(entry.check_id ? [`  - Check: ${safeInline(entry.check_id)}`] : []),
    ...(entry.why ? [`  - ${lang === "de" ? "Warum" : "Why"}: ${localizedKnownText(entry.why, lang)}`] : []),
    ...(entry.resolution ? [`  - ${lang === "de" ? "Lösung" : "Resolution"}: ${localizedKnownText(entry.resolution, lang)}`] : []),
    `  - ${lang === "de" ? "Blockiert die Lieferung" : "Blocks delivery"}: ${entry.blocking === true ? (lang === "de" ? "ja" : "yes") : (lang === "de" ? "nein" : "no")}`,
  ].join("\n"));
  const existingProblems = new Set(problems.map((entry) => entry.problem));
  problemLines.push(...snapshotBlockers
    .filter((entry) => !existingProblems.has(entry))
    .map((entry) => `- ${safeInline(displayValue(lang, entry))}`));
  const trace = status.artifact_summary ?? {};
  const currentFindings = (current.review?.findings ?? []).map((finding) => findingLine(finding, lang));
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
  const title = accepted
    ? (lang === "de" ? "## Vorläufige Annahme · angenommen" : "## Provisional acceptance · accepted")
    : (lang === "de" ? `## Manueller Workflow-Status · ${displayValue(lang, snapshot.state)}` : `## Manual workflow status · ${displayValue(lang, snapshot.state)}`);
  return [
    title,
    `### ${copy.decision}`,
    [
      `- ${decision}`,
      `- ${copy.reason}: ${concise(reason)}`,
      `- ${lang === "de" ? "Lieferstatus" : "Delivery status"}: ${displayValue(lang, snapshot.delivery_status ?? "none")}.`,
      `- ${copy.evidenceGrade}: ${displayValue(lang, snapshot.evidence_grade ?? "none")}.`,
      ...(proofBoundary ? [`- ${copy.proofBoundary}: ${concise(proofBoundary)}`] : []),
      `- ${copy.scope}: ${scopeSummary(pathAuthority, lang)}.`,
    ].join("\n"),
    `### ${copy.nextAction}`,
    actionLine(snapshot.next_action, lang),
    detailBlock(`${copy.findings} (${currentFindings.length})`, currentFindings),
    detailBlock(`${copy.checks} (${currentChecks.length})`, currentChecks),
    detailBlock(`${copy.limitations} (${currentLimitations.length})`, currentLimitations),
    detailBlock(`${lang === "de" ? "Statusprobleme und Lösungen" : "Status problems and resolutions"} (${problemLines.length})`, problemLines),
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
  const effectiveReviewInput = blockingAuthorityLimitation
    ? authorityLimitedReviewInput(request.review_input, blockingAuthorityLimitation)
    : scopeAuthorityLimitation
      ? scopeLimitedReviewInput(request.review_input, scopeAuthorityLimitation)
      : request.review_input;
  const localCheckEvidence = checkEvidence(request.check_observations);
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
    rootPlan: request.root_plan,
    evidence,
    review,
    reviewInput: review.normalized_review_input,
    repositoryObservation: request.repository_observation,
    pathAuthority,
    trace: {
      intent_hash: contract.authoritative_projection_hash,
      workspace_binding_hash: hashes.workspaceBindingHash,
      repository_snapshot_hash: hashes.snapshotHash,
    },
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

function deriveStatus(request, pluginRoot, manualAcceptance = null) {
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
    manualAcceptance,
  });
  const pathAuthority = classifyChangedPathAuthority(exact.rootFields, status.changed_paths, null, status.ambient_paths);
  return {
    schema: 1,
    kind: manualAcceptance ? "manual-provisional-acceptance" : "manual-workflow-status",
    ok: true,
    accepted: manualAcceptance === "provisional",
    persisted: false,
    snapshot: status.snapshot,
    artifact_summary: status.artifact_summary,
    diagnostics: status.diagnostics,
    changed_paths: status.changed_paths,
    ambient_paths: status.ambient_paths,
    path_authority: pathAuthority,
    human_output: statusPresentation(status, manualAcceptance === "provisional", pathAuthority, request.presentation_locale, current),
    artifacts: [],
  };
}

function acceptProvisional(request, pluginRoot) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const reviewTipId = exact.tips.review_tips[exact.rootFields.id] ?? null;
  const reviewTip = reviewTipId ? exact.chain.effective.get(reviewTipId) : null;
  const current = deriveStatus(request, pluginRoot);
  if (current.snapshot.delivery_status !== "provisional" || current.snapshot.next_action !== "accept-provisional") {
    const nextAction = reviewTip?.fields?.next_action ?? "provide-artifacts";
    const error = codedError("manual-acceptance-denied", `The current exact chain cannot be accepted provisionally; it requires ${nextAction}.`);
    error.nextAction = nextAction;
    throw error;
  }
  return deriveStatus(request, pluginRoot, "provisional");
}

function shadowError(operation, input, error) {
  const locale = localeOf(input?.presentation_locale);
  const copy = labels(locale);
  const code = error?.code ?? "manual-workflow-failed";
  const message = String(error?.message ?? error);
  const nextAction = error?.nextAction
    ?? (operation === "validate-plan" ? "correct-plan" : ["status", "accept-provisional"].includes(operation) ? "provide-artifacts" : "retry-review");
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
    const request = parseRequest(operation, input);
    if (operation === "validate-plan") return validatePlan(request, pluginRoot);
    if (operation === "build-review") return buildReview(request, pluginRoot);
    if (operation === "status") return deriveStatus(request, pluginRoot);
    if (operation === "accept-provisional") return acceptProvisional(request, pluginRoot);
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
