const MANUAL_TOOLS = new Set([
  "workflow_plan_preflight",
  "workflow_artifact_record",
  "workflow_artifact_context",
  "workflow_closeout",
  "workflow_status",
]);

const localeOf = (value) => value === "de" ? "de" : "en";
const localized = (locale, en, de) => locale === "de" ? de : en;

function unique(values = []) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function list(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function message(value) {
  if (typeof value === "string") return value;
  return value?.message ?? JSON.stringify(value);
}

function stateOf(toolName, value, isError) {
  if (isError || value?.error) return "failed";
  if (value?.run?.workflow_state) return value.run.workflow_state;
  if (toolName === "workflow_plan_preflight") return value?.feasible ? "root-ready" : "shadow-review";
  if (toolName === "workflow_status") return value?.run?.workflow_state ?? value?.snapshot?.state ?? value?.state ?? "status-available";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") {
    if (value?.mode === "shadow" && value?.status === "unavailable") return "shadow-review";
    return value?.outcome ?? value?.authoritative_fields?.outcome ?? "open-points";
  }
  if (toolName === "workflow_closeout") return value?.status === "blocked" ? "blocked" : "root-review";
  return "context-available";
}

function outcomeOf(state, value, isError) {
  if (isError || value?.error || state === "failed") return "failed";
  if (["open-points", "shadow-review"].includes(state)) return "partial";
  if (state === "correction-needed") return "blocked";
  return "ready";
}

function actionOf(toolName, state, value, locale) {
  const runAction = value?.run?.next_action;
  if (runAction === "none") return null;
  if (state === "root-ready") return { id: "implement-plan", label: "Implement Plan", why: localized(locale, "The Schema-6 Root is ready for explicit human approval.", "Der Schema-6-Root ist für die ausdrückliche menschliche Freigabe bereit.") };
  if (["root-review", "review-needed"].includes(state)) return { id: "review-work", label: "Review Work", why: localized(locale, "The completed work is waiting for a separately authorized read-only Review.", "Die abgeschlossene Arbeit wartet auf einen separat autorisierten, read-only Review.") };
  if (state === "correction-needed") return { id: "correct", label: "Correct Work", why: localized(locale, "The current Review contains one bounded correction inside the Root.", "Der aktuelle Review enthält genau eine begrenzte Korrektur innerhalb des Roots.") };
  if (state === "open-points") return { id: "human-assessment", label: localized(locale, "Assess open points", "Offene Punkte beurteilen"), why: localized(locale, "The Review names the exact limitation and its impact.", "Der Review benennt die konkrete Grenze und ihre Auswirkung.") };
  if (state === "shadow-review") return {
    id: "human-assessment",
    label: localized(locale, "Assess the formal binding open point", "Offenen Bindungspunkt beurteilen"),
    why: localized(locale, "Shadow findings are useful, but the named formal limitation needs natural human assessment and grants no correction authority.", "Shadow-Findings sind nützlich, aber die formale Grenze braucht eine natürliche menschliche Beurteilung und erteilt keine Korrekturautorität."),
  };
  if (state === "achieved") return null;
  if (toolName === "workflow_status" && value?.snapshot?.next_action) return {
    id: value.snapshot.next_action,
    label: String(value.snapshot.next_action).replaceAll("-", " "),
    why: "This is the next lifecycle action derived from the exact artifact chain.",
  };
  if (state === "failed") return { id: "human-assessment", label: localized(locale, "Assess the reported limitation", "Gemeldete Grenze beurteilen"), why: localized(locale, "Workflow cannot safely derive a formal outcome.", "Workflow kann kein sicheres formales Ergebnis ableiten.") };
  return null;
}

function summaryOf(toolName, state, value, locale) {
  if (value?.error) return message(value.error);
  if (toolName === "workflow_plan_preflight") return value.feasible
    ? "The Schema-6 Intent Root is feasible and ready for human approval."
    : "The proposed Root is not ready; its intent or authority contract needs correction.";
  if (state === "shadow-review") return value?.repository_outcome
    ?? "A read-only repository assessment may continue, but formal Plan conformance is unavailable.";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") return value?.outcome
    ? `Fresh repository Review concluded ${value.outcome}.`
    : "Fresh repository Review completed.";
  if (toolName === "workflow_closeout") return `Delivery Evidence is ${value?.status ?? "available"} with grade ${value?.overall_grade ?? "unknown"}.`;
  if (value?.run) {
    const point = value.run.open_points?.[0]?.summary;
    if (point) return point;
    if (state === "review-needed") return localized(locale, "The authorized work phase completed. Fresh Review is pending and has not started.", "Die autorisierte Arbeitsphase ist abgeschlossen. Fresh Review pending; der Review wurde noch nicht gestartet.");
    if (state === "correction-needed") return localized(locale, "The Review found correctable in-Root deviations.", "Der Review hat innerhalb des Roots korrigierbare Abweichungen gefunden.");
    if (state === "achieved") return localized(locale, "The reviewed repository outcomes are achieved.", "Die geprüften Repository-Ergebnisse sind erreicht.");
    if (state === "open-points") return localized(locale, "The run ended with concrete open points for human assessment.", "Der Lauf endete mit konkreten offenen Punkten zur menschlichen Beurteilung.");
    return localized(locale, `Workflow state is ${state}.`, `Workflow-Status ist ${state}.`);
  }
  if (toolName === "workflow_status") return localized(locale, `Workflow state is ${state}.`, `Workflow-Status ist ${state}.`);
  if (toolName === "workflow_artifact_record") return "Exact Root transport was recorded; transport does not grant authority.";
  return "Exact Workflow context is available.";
}

function evidenceStatusOf(toolName, state, value, locale) {
  if (state === "shadow-review") return value?.evidence_status ?? "No Workflow Evidence or Work Review artifact was created.";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") {
    if (state === "achieved") return "Repository outcomes are achieved on the current snapshot; Evidence remains supported rather than verified.";
    if (state === "open-points") return "Formal Evidence exists and its concrete limitation is reported separately from the repository outcome.";
    return "Formal Review requires one bounded correction.";
  }
  return localized(locale, "Workflow evidence status follows the lifecycle result reported below.", "Der Workflow-Evidenzstatus folgt dem unten ausgewiesenen Lifecycle-Ergebnis.");
}

function limitationLines(value) {
  return unique([
    ...list(value?.limitations),
    ...list(value?.harness_limitations),
    ...list(value?.warning),
    ...list(value?.warnings),
    ...list(value?.human_attention?.reasons).map((entry) => message(entry?.message ?? entry)),
    ...list(value?.problem_details).map((entry) => message(entry?.problem ?? entry)),
  ]);
}

function blockerLines(value, state) {
  return unique([
    ...list(value?.blocking_issues).map(message),
    ...list(value?.snapshot?.blockers).map(message),
    ...(state === "blocked" && value?.error ? [message(value.error)] : []),
  ]);
}

function repositoryFindings(value, state) {
  if (state !== "shadow-review" || value?.repository_findings_authoritative !== false || !Array.isArray(value?.repository_findings)) return [];
  return value.repository_findings.slice(0, 32).flatMap((finding) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return [];
    const { key, severity, evidence, reasoning } = finding;
    if (![key, severity, evidence, reasoning].every((entry) => typeof entry === "string" && entry.trim())) return [];
    const inline = (entry) => entry.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    return [{ key: inline(key), severity: inline(severity), evidence: inline(evidence), reasoning: inline(reasoning) }];
  });
}

export function buildPresentation(toolName, value, { isError = false, clientHost = "portable", presentationLocale = "en" } = {}) {
  const locale = localeOf(presentationLocale);
  const state = stateOf(toolName, value, isError);
  const outcome = outcomeOf(state, value, isError);
  const action = actionOf(toolName, state, value, locale);
  const checks = value?.check_evidence ?? [];
  const findings = repositoryFindings(value, state);
  return {
    schema: 1,
    tool: toolName,
    workflow_state: state,
    outcome,
    locale,
    summary: summaryOf(toolName, state, value, locale),
    repository_outcome: summaryOf(toolName, state, value, locale),
    evidence_status: evidenceStatusOf(toolName, state, value, locale),
    repository_findings_authoritative: state === "shadow-review" ? false : null,
    repository_findings: findings,
    checks: checks.map((entry) => `${entry.check_id}: ${entry.grade}`),
    blockers: blockerLines(value, state),
    limitations: limitationLines(value),
    open_points: list(value?.run?.open_points).map((entry) => message(entry?.summary ?? entry)),
    next_action: action?.id ?? "none",
    primary_action: action,
    client_host: clientHost,
    technical_traceability: {
      root_plan_id: value?.root_plan_id ?? value?.run?.root_plan_id ?? value?.snapshot?.root_plan_id ?? null,
      run_id: value?.run?.run_id ?? null,
      run_revision: value?.run?.revision ?? null,
      technical_state: value?.run?.technical ?? null,
      evidence_id: value?.delivery_evidence_id ?? value?.snapshot?.latest_evidence_id ?? null,
      review_id: value?.work_review_id ?? value?.snapshot?.latest_review_id ?? null,
      artifact_hash: value?.artifact_hash ?? null,
      root_content_hash: value?.root_content_hash ?? null,
      repository_snapshot_hash: value?.repository_state_hash ?? value?.repository_snapshot?.snapshot_hash ?? null,
      harness_mode: value?.harness_mode ?? null,
      harness_status: value?.harness_status ?? null,
      review_mode: value?.mode ?? null,
      reason_code: value?.reason_code ?? null,
      artifacts_persisted: value?.artifacts_persisted ?? null,
      workflow_state_changed: value?.workflow_state_changed ?? null,
      persistence_scope: value?.persistence_scope ?? null,
      handoff_persisted: value?.handoff_persisted ?? null,
      changed_paths: value?.changed_paths ?? [],
    },
  };
}

function section(title, entries) {
  return entries.length > 0 ? `\n${title}:\n${entries.map((entry) => `- ${entry}`).join("\n")}` : "";
}

export function formatManualToolContent(presentation) {
  const locale = localeOf(presentation.locale);
  const action = presentation.primary_action;
  const next = action
    ? `\n\n### ${localized(locale, "Next step", "Nächster Schritt")}\n\n- ${localized(locale, "Now", "Jetzt")}: ${action.label}\n- ${localized(locale, "Why", "Warum")}: ${action.why}`
    : `\n\n### ${localized(locale, "Done", "Erledigt")}\n\n${localized(locale, "No further Workflow action is required for this result.", "Für dieses Ergebnis ist keine weitere Workflow-Aktion erforderlich.")}`;
  const trace = presentation.technical_traceability;
  const findings = presentation.workflow_state === "shadow-review"
    ? `\n\n### Repository findings (non-authoritative)\n\n${presentation.repository_findings.length > 0
      ? presentation.repository_findings.map((finding) => `- **${finding.key}** (${finding.severity}) — Evidence: ${finding.evidence} Reasoning: ${finding.reasoning}`).join("\n")
      : "- No findings were available from a valid closed Schema-1 review input."}`
    : "";
  const technical = [
    `Root: ${trace.root_plan_id ?? "none"}`,
    `Run: ${trace.run_id ?? "none"}@${trace.run_revision ?? "none"}`,
    `Evidence: ${trace.evidence_id ?? "none"}`,
    `Review: ${trace.review_id ?? "none"}`,
    `Artifact hash: ${trace.artifact_hash ?? "none"}`,
    `Repository snapshot hash: ${trace.repository_snapshot_hash ?? "none"}`,
    `Harness: ${trace.harness_mode ?? "not reported"} / ${trace.harness_status ?? "not reported"}`,
    `Review mode: ${trace.review_mode ?? "not reported"}`,
    `Reason: ${trace.reason_code ?? "none"}`,
    `Artifacts persisted: ${trace.artifacts_persisted ?? "not reported"}`,
    `Workflow state changed: ${trace.workflow_state_changed ?? "not reported"}`,
    `Persistence scope: ${trace.persistence_scope ?? "not reported"}`,
    `Task-local handoff persisted: ${trace.handoff_persisted ?? "not reported"}`,
    `Changed paths: ${(trace.changed_paths ?? []).join(", ") || "none"}`,
    `Technical state: ${trace.technical_state ? JSON.stringify(trace.technical_state) : "none"}`,
  ];
  return `## Workflow · ${presentation.workflow_state}\n\n### ${localized(locale, "Quick decision", "Kurzentscheidung")}\n\n- ${localized(locale, "Result", "Ergebnis")}: ${presentation.repository_outcome}\n- ${localized(locale, "Impact", "Auswirkung")}: ${presentation.evidence_status}${section(localized(locale, "Open points", "Offene Punkte"), presentation.open_points)}${section(localized(locale, "Blockers", "Blocker"), presentation.blockers)}${section(localized(locale, "Limitations", "Grenzen"), presentation.limitations)}${findings}${next}\n\n### Details\n\n${localized(locale, "Workflow reports lifecycle state, authority and evidence only. Concrete execution remains owned by the active project harness. Task-local handoff cache is separate from committed native Review-invocation persistence.", "Workflow meldet nur Lifecycle-Status, Autorität und Evidenz. Die konkrete Ausführung bleibt beim aktiven Projekt-Harness. Der task-lokale Handoff-Cache ist von persistierter nativer Review-Bindung getrennt.")}\n\n<details><summary>Agent and machine contract (authoritative) · Technical traceability</summary>\n\n${technical.join("\n")}\n\n</details>\n`;
}

export function isManualWorkflowTool(toolName) {
  return MANUAL_TOOLS.has(toolName);
}

export function resetManualPresentationDedupe() {
  // Presentation is intentionally stateless.
}

export function coalesceManualPresentation(presentation) {
  return { ...presentation, update_suppressed: false };
}

export function manualMcpResult(toolName, value, isError = false, { clientHost = "portable", presentationLocale = "en" } = {}) {
  if (!isManualWorkflowTool(toolName)) {
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
  }
  return workflowMcpResult(toolName, value, isError, { clientHost, presentationLocale });
}

export function workflowMcpResult(toolName, value, isError = false, { clientHost = "portable", presentationLocale = "en" } = {}) {
  const presentation = buildPresentation(toolName, value, { isError, clientHost, presentationLocale });
  return {
    content: [{ type: "text", text: formatManualToolContent(presentation) }],
    structuredContent: { ...value, presentation },
    isError,
  };
}
