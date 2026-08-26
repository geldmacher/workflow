const MANUAL_TOOLS = new Set([
  "workflow_plan_preflight",
  "workflow_artifact_record",
  "workflow_artifact_context",
  "workflow_closeout",
  "workflow_status",
]);

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
  if (toolName === "workflow_plan_preflight") return value?.feasible ? "root-plan-review" : "blocked";
  if (toolName === "workflow_status") return value?.snapshot?.state ?? value?.state ?? "status-available";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") {
    if (value?.mode === "shadow" && value?.status === "unavailable") return "shadow-review";
    if (value.delivery_status === "verified") return "achieved";
    if (value.delivery_status === "provisional") return "delivery-ready-provisional";
    return "blocked";
  }
  if (toolName === "workflow_closeout") return value?.status === "blocked" ? "blocked" : "root-review";
  return "context-available";
}

function outcomeOf(state, value, isError) {
  if (isError || value?.error || state === "failed") return "failed";
  if (state === "blocked" || value?.status === "blocked") return "blocked";
  if (["delivery-ready-provisional", "root-review", "root-plan-review", "shadow-review"].includes(state)) return "partial";
  return "ready";
}

function actionOf(toolName, state, value) {
  if (state === "root-plan-review") return { id: "implement-plan", label: "Implement Plan", why: "The Schema-6 Root is ready for explicit human approval." };
  if (state === "root-review") return { id: "review-root", label: "Run fresh Review", why: "Evidence exists and needs a fresh read-only delivery decision." };
  if (state === "delivery-ready-provisional") return { id: "accept-provisional", label: "Decide on provisional delivery", why: "Evidence is honest but not fully harness-attested." };
  if (state === "shadow-review") return {
    id: value?.recovery_action ?? "establish-formal-review-binding",
    label: value?.recovery_action === "create-formal-plan-binding" ? "Create a formal Plan binding" : "Establish formal Review binding",
    why: "Shadow findings are useful but cannot create Workflow evidence or change lifecycle state.",
  };
  if (state === "achieved") return null;
  if (toolName === "workflow_status" && value?.snapshot?.next_action) return {
    id: value.snapshot.next_action,
    label: String(value.snapshot.next_action).replaceAll("-", " "),
    why: "This is the next lifecycle action derived from the exact artifact chain.",
  };
  if (state === "blocked" || state === "failed") return { id: "resolve-blocker", label: "Resolve the reported blocker", why: "Workflow cannot advance this phase while the named condition remains." };
  return null;
}

function summaryOf(toolName, state, value) {
  if (value?.error) return message(value.error);
  if (toolName === "workflow_plan_preflight") return value.feasible
    ? "The Schema-6 Intent Root is feasible and ready for human approval."
    : "The proposed Root is not ready; its intent or authority contract needs correction.";
  if (state === "shadow-review") return value?.repository_outcome
    ?? "A read-only repository assessment may continue, but formal Plan conformance is unavailable.";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") return value?.assessment
    ? `Fresh repository Review concluded ${value.assessment}.`
    : "Fresh repository Review completed.";
  if (toolName === "workflow_closeout") return `Delivery Evidence is ${value?.status ?? "available"} with grade ${value?.overall_grade ?? "unknown"}.`;
  if (toolName === "workflow_status") return `Workflow state is ${state}.`;
  if (toolName === "workflow_artifact_record") return "Exact Root transport was recorded; transport does not grant authority.";
  return "Exact Workflow context is available.";
}

function evidenceStatusOf(toolName, state, value) {
  if (state === "shadow-review") return value?.evidence_status ?? "No Workflow Evidence or Work Review artifact was created.";
  if (toolName === "workflow_closeout" && value?.artifact_kind === "work-review") {
    if (state === "achieved") return "Protected Evidence verifies the delivery on the bound repository snapshot.";
    if (state === "delivery-ready-provisional") return "Formal Evidence exists, but its declared limitation prevents a verified claim.";
    return "Formal Review did not establish a delivery-ready evidence state.";
  }
  return "Workflow evidence status follows the lifecycle result reported below.";
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

export function buildPresentation(toolName, value, { isError = false, clientHost = "portable" } = {}) {
  const state = stateOf(toolName, value, isError);
  const outcome = outcomeOf(state, value, isError);
  const action = actionOf(toolName, state, value);
  const checks = value?.check_evidence ?? [];
  const findings = repositoryFindings(value, state);
  return {
    schema: 1,
    tool: toolName,
    workflow_state: state,
    outcome,
    summary: summaryOf(toolName, state, value),
    repository_outcome: summaryOf(toolName, state, value),
    evidence_status: evidenceStatusOf(toolName, state, value),
    repository_findings_authoritative: state === "shadow-review" ? false : null,
    repository_findings: findings,
    checks: checks.map((entry) => `${entry.check_id}: ${entry.grade}`),
    blockers: blockerLines(value, state),
    limitations: limitationLines(value),
    next_action: action?.id ?? "none",
    primary_action: action,
    client_host: clientHost,
    technical_traceability: {
      root_plan_id: value?.root_plan_id ?? value?.snapshot?.root_plan_id ?? null,
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
  const action = presentation.primary_action;
  const next = action
    ? `\n\n### Next step\n\n- Now: ${action.label}\n- Why: ${action.why}`
    : "\n\n### Done\n\nNo further Workflow action is required for this result.";
  const trace = presentation.technical_traceability;
  const findings = presentation.workflow_state === "shadow-review"
    ? `\n\n### Repository findings (non-authoritative)\n\n${presentation.repository_findings.length > 0
      ? presentation.repository_findings.map((finding) => `- **${finding.key}** (${finding.severity}) — Evidence: ${finding.evidence} Reasoning: ${finding.reasoning}`).join("\n")
      : "- No findings were available from a valid closed Schema-1 review input."}`
    : "";
  const technical = [
    `Root: ${trace.root_plan_id ?? "none"}`,
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
  ];
  return `## Workflow · ${presentation.workflow_state}\n\n### Quick decision\n\n- Repository outcome: ${presentation.repository_outcome}\n- Evidence status: ${presentation.evidence_status}${section("Blockers", presentation.blockers)}${section("Limitations", presentation.limitations)}${findings}${next}\n\n### Details\n\nWorkflow reports lifecycle state, authority and evidence only. Concrete execution remains owned by the active project harness. Task-local handoff cache is separate from committed native Review-invocation persistence.\n\n<details><summary>Agent and machine contract (authoritative) · Technical traceability</summary>\n\n${technical.join("\n")}\n\n</details>\n`;
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

export function manualMcpResult(toolName, value, isError = false, { clientHost = "portable" } = {}) {
  if (!isManualWorkflowTool(toolName)) {
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
  }
  const presentation = buildPresentation(toolName, value, { isError, clientHost });
  return {
    content: [{ type: "text", text: formatManualToolContent(presentation) }],
    structuredContent: { ...value, presentation },
    isError,
  };
}
