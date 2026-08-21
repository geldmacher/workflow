import {
  MANUAL_JOURNEY_STATE_LABELS,
  MANUAL_PRIMARY_ACTIONS,
  deriveManualJourneyState,
  normalizeManualPrimaryAction,
  taskBoundManualInvoke,
} from "../core/manual-journey.mjs";

const MANUAL_TOOLS = new Set([
  "workflow_plan_preflight",
  "workflow_artifact_record",
  "workflow_artifact_context",
  "workflow_closeout",
  "workflow_status",
]);

const MAX_DISPLAY_CHANGED_PATHS = 10;
const TERMINAL_READY_STATES = new Set(["achieved", "accepted-provisional"]);
const TERMINAL_BLOCKED_STATES = new Set(["blocked", "stopped", "failed"]);
const MANUAL_GUIDE_URL = "https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md";
const MANUAL_GUIDE_LABEL = "Manual Workflow guide";

const JOURNEY_STATE_LABELS = MANUAL_JOURNEY_STATE_LABELS;
const RECENT_PRESENTATION_UPDATES = new Map();
const MAX_RECENT_PRESENTATION_UPDATES = 256;

function helpEntry(topic, anchor, meaning) {
  return Object.freeze({
    topic,
    meaning,
    label: MANUAL_GUIDE_LABEL,
    url: `${MANUAL_GUIDE_URL}#${anchor}`,
  });
}

const MANUAL_HELP_TOPICS = Object.freeze({
  "manual-states": helpEntry(
    "manual-states",
    "manual-states",
    "Workflow derived this read-only Manual state from the current artifact chain; its blockers and next action remain authoritative.",
  ),
  "intent-root-and-plan": helpEntry(
    "intent-root-and-plan",
    "intent-root-and-plan",
    "The Intent Root must define a feasible goal, acceptance, authority, risk, and required Checks before implementation can be approved.",
  ),
  "artifacts-tips-and-handoff": helpEntry(
    "artifacts-tips-and-handoff",
    "artifacts-tips-and-handoff",
    "Cursor and Codex trust exact current-task artifact bytes; handoff remains portable transport and never restores native task authority.",
  ),
  "recovery-and-troubleshooting": helpEntry(
    "recovery-and-troubleshooting",
    "recovery-and-troubleshooting",
    "The requested Workflow operation did not produce an actionable result; repair the reported input, chain, or environment issue before continuing.",
  ),
});

const MANUAL_STATE_HELP = Object.freeze({
  "intent-clarification": helpEntry(
    "manual-state-intent-clarification",
    "manual-states",
    "The Root is not intent-ready because a material goal, acceptance, authority, or risk decision still needs a human answer.",
  ),
  "root-plan-review": helpEntry(
    "manual-state-root-plan-review",
    "manual-states",
    "A ready native Intent Root exists and waits for human Implement Plan approval before repository implementation.",
  ),
  "root-review": helpEntry(
    "manual-state-root-review",
    "manual-states",
    "Implementation finished and now needs fresh read-only Review to create Evidence and the delivery verdict atomically.",
  ),
  "waiting-human": helpEntry(
    "manual-state-waiting-human",
    "manual-states",
    "Workflow needs the human to resolve the listed clarification, correction approval, or missing exact context.",
  ),
  replan: helpEntry(
    "manual-state-replan",
    "manual-states",
    "The current Root or chain cannot safely authorize the required work and must be replaced through a newly approved plan.",
  ),
  "delivery-ready-provisional": helpEntry(
    "manual-state-delivery-ready-provisional",
    "manual-states",
    "No known failed required Check blocks delivery, but proof remains incomplete or unavailable and needs an explicit human decision.",
  ),
  "accepted-provisional": helpEntry(
    "manual-state-accepted-provisional",
    "manual-states",
    "The human accepted this evidence gap once; the delivery is still not verified and the acceptance is not persisted.",
  ),
  achieved: helpEntry(
    "manual-state-achieved",
    "manual-states",
    "A fresh review verified the required Checks for this repository-only Root, so no further Workflow action is required.",
  ),
  blocked: helpEntry(
    "manual-state-blocked",
    "manual-states",
    "A known failure or safety boundary prevents delivery and cannot be overridden by provisional acceptance.",
  ),
  failed: helpEntry(
    "manual-state-failed",
    "manual-states",
    "Workflow could not produce a valid result; repair the reported failure before retrying.",
  ),
  stopped: helpEntry(
    "manual-state-stopped",
    "manual-states",
    "This subject is intentionally non-actionable, commonly because it is read-only Workflow-3 or Workflow-4 history.",
  ),
});

const MANUAL_EVIDENCE_HELP = Object.freeze({
  verified: helpEntry(
    "manual-evidence-verified",
    "evidence-grades",
    "The required Check was directly observed with the method and repetition needed for verified Evidence.",
  ),
  supported: helpEntry(
    "manual-evidence-supported",
    "evidence-grades",
    "Meaningful inspection supports the claim, but the proof is not strong enough for verified delivery.",
  ),
  partial: helpEntry(
    "manual-evidence-partial",
    "evidence-grades",
    "Some relevant proof exists, but it does not fully cover the required Check or expected result.",
  ),
  unavailable: helpEntry(
    "manual-evidence-unavailable",
    "evidence-grades",
    "The required proof surface could not be used; the named limitation is missing proof, not success or failure.",
  ),
  failed: helpEntry(
    "manual-evidence-failed",
    "evidence-grades",
    "The observed result contradicted a required Check, so delivery is blocked and cannot be accepted provisionally.",
  ),
});

function manualStateHelp(state) {
  return MANUAL_STATE_HELP[state] ?? MANUAL_HELP_TOPICS["manual-states"];
}

function manualEvidenceHelp(grade) {
  return MANUAL_EVIDENCE_HELP[grade] ?? helpEntry(
    "manual-evidence-grades",
    "evidence-grades",
    "Evidence grades describe how directly each required Check was observed and never become stronger through review wording alone.",
  );
}

function isManualStatusSnapshot(snapshot) {
  if (snapshot.snapshot_source) return snapshot.snapshot_source === "artifact-chain";
  if (snapshot.run_id) return false;
  const requested = snapshot.requested_profile ?? "manual";
  const effective = snapshot.effective_profile ?? requested;
  return requested === "manual" && effective === "manual";
}

const NEXT_STEP_CATALOG = {
  "repair-root": {
    label: "Repair the Root",
    invoke: "Plan: fix blockers, then /plan-work or $plan-work again",
    benefit: "Makes the Root feasible before approval.",
    blocked_when: "Root is infeasible or incomplete.",
    recovery: "Resolve blocking issues, then re-validate the exact Root.",
  },
  "implement-plan": {
    label: "Implement the Plan",
    invoke: "Human: native Implement Plan (approves the presented Root)",
    benefit: "Delivers inside the approved Root and finishes normally.",
    blocked_when: "No approved Root is ready for implementation.",
    recovery: "Finish Plan presentation and human approval first.",
  },
  "attach-artifact": {
    label: "Export the exact artifact",
    invoke: "Agent: attach exact Root/Evidence text only when intentionally continuing in another task or host",
    benefit: "Exports the chain when optional cross-task transport is unavailable.",
    blocked_when: "A deliberate cross-task continuation cannot load the exact artifact.",
    recovery: "Stay in the current task, or paste the exact artifact bytes into the chosen new task.",
  },
  "review-root": {
    label: "Review delivery",
    invoke: "Current task, read-only phase: run /review-work or $review-work against the exact task-local chain",
    benefit: "Produces a fresh read-only verdict without requiring a new task or chat.",
    blocked_when: "The current task cannot resolve one exact Root/Evidence chain.",
    recovery: "Run Review in the current task; its atomic builder creates any missing Evidence together with the Review.",
  },
  "accept-provisional": {
    label: "Accept provisional delivery",
    invoke: "Ask/Agent: /accept-work provisional or $accept-work provisional only for an explicit provisional acceptance",
    benefit: "Records a one-time human acceptance of an evidence gap.",
    blocked_when: "Current review is not provisional.",
    recovery: "Run a fresh review before accepting.",
  },
  closeout: {
    label: "Portable Evidence build",
    invoke: "Compatible portable client: call workflow_closeout delivery-evidence mode",
    benefit: "Preserves portable transport; Cursor and Codex use fresh Review instead.",
    blocked_when: "Exact Root/chain or Check observations are missing.",
    recovery: "On Cursor or Codex start fresh Review; portable clients supply exact artifacts and observations.",
  },
  correct: {
    label: "Fix failing Checks",
    invoke: "Agent: repair failing required Checks, then run fresh Review",
    benefit: "Restores a deliverable Evidence grade.",
    blocked_when: "Intent, scope, or risk must change.",
    recovery: "Use /plan-work replan or $plan-work replan instead.",
  },
  "approve-correction": {
    label: "Apply bounded correction",
    invoke: "Agent: /correct-work or $correct-work, then Ask: fresh /review-work",
    benefit: "Applies only the review-approved in-scope FIX set.",
    blocked_when: "No actionable correction tip is present.",
    recovery: "Run /review-work or $review-work first.",
  },
  "provide-artifacts": {
    label: "Supply artifact chain",
    invoke: "Ask/Agent: pass current Schema-5 Root/Evidence/Review to workflow_status",
    benefit: "Derives status without inventing tips.",
    blocked_when: "Tips are missing or ambiguous.",
    recovery: "Pass an explicit wp-* plus exact artifacts.",
  },
  replan: {
    label: "Replan the Root",
    invoke: "Plan: /plan-work replan or $plan-work replan, then approve the replacement",
    benefit: "Creates a new approval boundary when Intent must change.",
    blocked_when: "Current review does not require next_action replan.",
    recovery: "Run a fresh review that requests replan first.",
  },
  "retry-review": {
    label: "Retry review",
    invoke: "Current task, read-only phase: rerun /review-work or $review-work with the updated evidence",
    benefit: "Reassesses once Evidence or context is complete.",
    blocked_when: "Evidence is still missing or incomplete.",
    recovery: "Keep the exact chain in this task, resolve the named evidence gap, then rerun Review.",
  },
  answer: {
    label: "Answer clarification",
    invoke: "Ask: answer the open review clarification",
    benefit: "Unblocks a human decision without mutating delivery.",
    blocked_when: "No open clarify decision is pending.",
    recovery: "Run /work-status or $work-status to see the current tip.",
  },
  "resolve-intent": {
    label: "Resolve intent",
    invoke: "Plan: answer open intent questions or replan",
    benefit: "Restores Intent Readiness before a Root is presented.",
    blocked_when: "Goal or acceptance decisions remain open.",
    recovery: "Run /plan-work <goal> or $plan-work <goal> with decisive answers.",
  },
  none: {
    label: "Done",
    invoke: "No further Workflow command required",
    benefit: "Delivery is complete for this Root.",
    blocked_when: null,
    recovery: "Optional: /learn-from-work or /explain-work (Codex: $learn-from-work / $explain-work).",
  },
  learn: {
    label: "Persist learnings",
    invoke: "Agent: /learn-from-work or $learn-from-work",
    benefit: "Captures confirmed reusable guidance after earned delivery.",
    blocked_when: "Delivery is not verified and achieved.",
    recovery: "Finish a verified achieved review; provisional acceptance never authorizes Learning.",
  },
  explain: {
    label: "Explain the chain",
    invoke: "Ask: /explain-work or $explain-work",
    benefit: "Translates the Root/Evidence/Review chain for humans.",
    blocked_when: "No exact chain is available.",
    recovery: "Run /work-status or supply exact artifacts first.",
  },
};

function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") return String(entry.message ?? entry.code ?? JSON.stringify(entry));
    return String(entry);
  }).filter(Boolean);
}

function uniqueText(values) {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).trim()))];
}

function firstLine(text, fallback = "No summary.") {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value || fallback;
}

function humanBlocker(value, fallbackRecovery = "Follow the single next action, then retry the same Workflow phase.") {
  const technical = firstLine(value, "Workflow could not complete this phase.");
  if (/handoff|cache/i.test(technical)) return {
    reason: "Optional cross-task handoff is unavailable; the exact task-local chain is still usable in the current task.",
    recovery: "Continue in the current task. Export the exact artifact only if you intentionally switch tasks or hosts.",
  };
  if (/roots-request-failed|roots-empty|workspace roots|workspace binding/i.test(technical)) return {
    reason: "Workflow cannot establish an optional workspace handoff context.",
    recovery: "Continue with the exact artifacts already held in this task; otherwise select the current Root explicitly.",
  };
  if (/baseline/i.test(technical)) return {
    reason: "Workflow cannot prove which repository changes belong to this delivery because the pre-change baseline is unavailable.",
    recovery: "Use the named replan action to create a new clean approval and baseline boundary.",
  };
  if (/model-authored work-review|review artifact.*authority|host-owned Review authority/i.test(technical)) return {
    reason: "The supplied Review artifact cannot establish host-owned Review authority.",
    recovery: fallbackRecovery,
  };
  if (/CHECK-[1-9][0-9]*.*(?:not fully verified|host receipt)|(?:not fully verified|host receipt).*CHECK-[1-9][0-9]*/i.test(technical)) return {
    reason: "A required verification Check is not fully verified.",
    recovery: fallbackRecovery,
  };
  if (/authority|outside (?:the )?(?:root|scope)|protected path|approval-required/i.test(technical)) return {
    reason: "The requested or observed change is outside the approved plan boundary.",
    recovery: "Keep the change inside the approved Root, or run plan-work replan and approve the expanded boundary.",
  };
  if (/required .*check.*failed|failed .*required .*check|check .*failed/i.test(technical)) return {
    reason: "A required verification Check failed, so Workflow cannot call the delivery successful.",
    recovery: "Run Review in this task, then apply its bounded correction or replan action.",
  };
  if (/missing .*evidence|evidence .*missing|no evidence tip/i.test(technical)) return {
    reason: "Delivery Evidence is not available yet for the approved Root.",
    recovery: fallbackRecovery,
  };
  if (/missing .*root|no .*root|exact root .*unavailable|root .*required/i.test(technical)) return {
    reason: "The approved Intent Root is not available in this task.",
    recovery: "Select or approve the exact current Root, then retry the same Workflow phase.",
  };
  if (/ambiguous|multiple|conflict|mismatch|different immutable/i.test(technical)) return {
    reason: "Workflow found conflicting or ambiguous versions and cannot determine one safe current chain.",
    recovery: "Select the exact current wp-* Root in this task and retry without reconstructing artifact text.",
  };
  return { reason: technical, recovery: fallbackRecovery };
}

function resolveNextStep(action, overrides = {}) {
  const entry = NEXT_STEP_CATALOG[action];
  const shared = MANUAL_PRIMARY_ACTIONS[action];
  if (!entry) {
    return {
      action,
      label: shared?.label ?? action,
      invoke: action,
      benefit: "Continue with the stated Workflow action.",
      blocked_reason: overrides.blocked_reason ?? null,
      recovery: overrides.recovery ?? null,
      label_line: action,
    };
  }
  const blockedReason = overrides.blocked_reason ?? null;
  const recovery = overrides.recovery ?? (blockedReason ? entry.recovery : null);
  return {
    action,
    label: shared?.label ?? entry.label,
    invoke: overrides.invoke ?? shared?.command ?? entry.invoke,
    benefit: overrides.benefit ?? entry.benefit,
    blocked_reason: blockedReason,
    recovery,
    // Keep a short compatible summary that still embeds the exact invoke tokens.
    label_line: overrides.invoke ?? shared?.command ?? entry.invoke,
  };
}

function nextActionLabel(action) {
  return resolveNextStep(action).label_line;
}

function journeyStateFor(presentation, action) {
  return deriveManualJourneyState(presentation, action);
}

function firstProblem(presentation) {
  return [
    ...asList(presentation.blocker ? [presentation.blocker] : []),
    ...asList(presentation.gaps),
    ...asList(presentation.human_attention),
    ...asList(presentation.problems),
    ...asList(presentation.errors),
  ][0] ?? null;
}

function defaultTechnicalTraceability(presentation) {
  return {
    root_plan_id: presentation.root_plan_id ?? null,
    evidence_id: presentation.evidence_id ?? null,
    review_id: presentation.review_id ?? null,
    correction_id: presentation.correction_id ?? null,
    check_ids: presentation.check_ids ?? [],
    finding_ids: presentation.finding_ids ?? [],
    changed_paths: presentation.changed_paths ?? [],
    root_content_hash: presentation.root_content_hash ?? null,
    evidence_hash: presentation.evidence_hash ?? null,
    review_hash: presentation.review_hash ?? null,
    artifact_set_hash: presentation.artifact_set_hash ?? null,
    repository_snapshot_hash: presentation.repository_snapshot_hash ?? null,
    receipt_ids: presentation.receipt_ids ?? [],
  };
}

function normalizedEnforcementLevel(value) {
  return ["host-native", "explicit"].includes(value) ? value : "explicit";
}

function withNextStepFields(presentation, action, overrides = {}) {
  const normalizedAction = normalizeManualPrimaryAction(presentation, action);
  const step = resolveNextStep(normalizedAction, overrides);
  const technicalTraceability = presentation.technical_traceability ?? defaultTechnicalTraceability(presentation);
  const journeyState = presentation.journey_state ?? journeyStateFor(presentation, normalizedAction);
  const enforcementLevel = normalizedEnforcementLevel(presentation.enforcement_level);
  const problem = firstProblem(presentation) ?? step.blocked_reason ?? null;
  const primaryInvoke = taskBoundManualInvoke(normalizedAction, technicalTraceability);
  return {
    ...presentation,
    ...(problem ? { blocker: problem } : {}),
    journey_state: journeyState,
    enforcement_level: enforcementLevel,
    primary_action: normalizedAction === "none"
      ? null
      : { id: normalizedAction, label: step.label, invoke: primaryInvoke, why: step.benefit },
    technical_traceability: { ...technicalTraceability, enforcement_level: enforcementLevel },
    deduplication_key: [
      technicalTraceability.root_plan_id ?? "no-root",
      technicalTraceability.evidence_id ?? "no-evidence",
      technicalTraceability.review_id ?? "no-review",
      journeyState,
      problem ?? "no-problem",
      normalizedAction,
    ].join("|"),
    next_action: normalizedAction,
    next_action_label: step.label,
    next_action_invoke: primaryInvoke,
    next_action_benefit: step.benefit,
    ...(step.blocked_reason
      ? {
        next_action_blocked_reason: step.blocked_reason,
        next_action_recovery: step.recovery,
      }
      : {}),
  };
}

function withHelpFields(presentation, help) {
  return help ? { ...presentation, help } : presentation;
}

function formatHostToolApproval(value) {
  if (!value) return null;
  if (typeof value === "string") return `host approvals: ${value}; Workflow grants none`;
  if (typeof value !== "object" || Array.isArray(value)) return `host approvals: ${String(value)}; Workflow grants none`;
  const mode = value.tool_approval ?? value.mode;
  if (!mode) return null;
  const source = value.source ? ` (source: ${value.source})` : "";
  if (mode === "strict") return `host approvals: per-call prompts expected${source}; Workflow grants none`;
  if (mode === "allowlisted") return `host approvals: host allowlist expected${source}; preference grants none`;
  return `host approvals: ${mode}${source}; Workflow grants none`;
}

function formatChangedPaths(paths, { maxDisplay = MAX_DISPLAY_CHANGED_PATHS } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) return "changed paths: none";
  if (paths.length <= maxDisplay) return `changed paths (${paths.length}): ${paths.join(", ")}`;
  const shown = paths.slice(0, maxDisplay).join(", ");
  return `changed paths (${paths.length}, showing ${maxDisplay}): ${shown}, … (+${paths.length - maxDisplay} more)`;
}

function receiptCoverageLine(summary) {
  const coverage = summary?.receipt_coverage;
  if (!coverage || !Number.isInteger(coverage.attested) || !Number.isInteger(coverage.eligible)) return null;
  return `host-attested machine Checks: ${coverage.attested}/${coverage.eligible}`;
}

function humanAttentionLines(value) {
  if (value?.required !== true || !Array.isArray(value.reasons)) return [];
  return value.reasons.map((reason) => {
    if (typeof reason === "string") return reason;
    const check = reason?.check_id ? `${reason.check_id}: ` : "";
    return `${check}${reason?.message ?? reason?.code ?? "Human attention required"}${reason?.recovery ? ` → ${reason.recovery}` : ""}`;
  });
}

function problemLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map((problem) => {
    if (typeof problem === "string") return problem;
    return `${problem?.problem ?? "Workflow problem"} Why: ${problem?.why ?? "The current delivery claim is incomplete."} Resolution: ${problem?.resolution ?? "Follow the stated Workflow recovery."}`;
  });
}

function statusPresentationOutcome(snapshot) {
  const blockers = asList(snapshot.blockers);
  const state = snapshot.state ?? "unknown";
  if (blockers.length > 0) return "blocked";
  if (TERMINAL_READY_STATES.has(state)) return "ready";
  if (TERMINAL_BLOCKED_STATES.has(state)) return "blocked";
  return "partial";
}

function closeoutPresentation(value) {
  if (value.artifact_kind === "work-review") {
    const blocked = value.delivery_status === "blocked";
    const provisional = value.delivery_status === "provisional";
    const outcome = blocked ? "blocked" : provisional ? "partial" : "ready";
    const reviewAction = value.next_action ?? "retry-review";
    const nextAction = reviewAction === "correct" ? "approve-correction" : reviewAction;
    const recovery = nextAction === "retry-review"
      ? "Correct the named review_input field and repeat Review in this task; no repository work or new task is required."
      : `Continue with ${nextAction} in this task.`;
    return withNextStepFields({
      schema: 1,
      tool: "workflow_closeout",
      phase: "review",
      outcome,
      summary: blocked
        ? `The host built a valid task-local Review and selected ${nextAction}.`
        : provisional
          ? "The host built a valid task-local provisional Review."
          : "The host built a valid task-local verified Review.",
      check_summary: `Review input and exact Root/Evidence chain produced ${value.work_review_id ?? "one work-review"}.`,
      enforcement_level: "host-native",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: value.latest_evidence_id ?? null,
        review_id: value.work_review_id ?? null,
        review_hash: value.artifact_hash ?? null,
        correction_id: value.correction_id ?? null,
        artifact_set_hash: value.artifact_set_hash ?? null,
        check_ids: value.authoritative_fields?.inspected_checks ?? [],
        finding_ids: [],
        changed_paths: [],
        handoff_persisted: value.handoff_persisted !== false,
      },
      checks: [
        `assessment: ${value.assessment ?? "unknown"}`,
        `delivery status: ${value.delivery_status ?? "unknown"}`,
        `review route: ${value.review_route ?? "unknown"}`,
        `task-local valid: ${value.task_local_valid === true ? "yes" : "unknown"}`,
        `handoff persisted: ${value.handoff_persisted === true ? "yes" : "no"}`,
      ],
      gaps: blocked ? [`Review selected ${nextAction}; only the Review/delivery route is blocked.`] : [],
      advisories: [
        "The exact task-local artifact is authoritative; optional handoff persistence is resilience only.",
        ...(value.handoff_persisted === false ? ["Handoff failure did not invalidate this Review."] : []),
      ],
      warnings: asList(value.warning ? [value.warning] : []),
      errors: [],
    }, nextAction, blocked ? { blocked_reason: `Review selected ${nextAction}.`, recovery } : {});
  }
  const persisted = value.handoff_persisted !== false;
  const status = value.status ?? "unknown";
  const grade = value.overall_grade ?? "ungraded";
  const warnings = asList(value.warning ? [value.warning] : []);
  const evidenceGaps = value.constraint_summary?.evidence_gap_checks ?? [];
  const legacyReceiptGaps = value.constraint_summary?.legacy_unattested_verified_checks ?? [];
  const blocked = status === "blocked" || grade === "failed";
  const provisionalEvidence = status === "provisional"
    || grade === "partial"
    || grade === "unavailable"
    || grade === "supported"
    || evidenceGaps.length > 0;
  let outcome = "ready";
  if (blocked) outcome = "blocked";
  else if (provisionalEvidence) outcome = "partial";

  const summary = blocked
    ? "Portable delivery Evidence is blocked because a required Check has a known failure."
    : outcome === "partial"
      ? "Portable delivery Evidence has at least one limited required proof."
      : "Portable delivery Evidence is complete and ready for task-local read-only Review.";

  let nextAction = "review-root";
  let overrides = {};
  if (blocked) {
    nextAction = "review-root";
    overrides = {
      blocked_reason: `Evidence status ${status} with grade ${grade} blocks delivery acceptance.`,
      recovery: "Run one fresh independent review and follow only the single action it selects.",
    };
  } else if (legacyReceiptGaps.length > 0) {
    overrides = {
      blocked_reason: `Legacy verified claims lack current host receipts: ${legacyReceiptGaps.join(", ")}.`,
      recovery: "Ask: run a fresh /review-work or $review-work and follow its bounded correction route.",
    };
  } else if (outcome === "partial" && evidenceGaps.length > 0) {
    overrides = {
      benefit: "Lets the fresh read-only review decide whether to rerun proof, correct, or accept a provisional limit.",
      blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
      recovery: "Run Review in this task and follow its one bounded next action.",
    };
  } else if (outcome === "partial") {
    overrides = {
      blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
      recovery: "Ask: /review-work or $review-work; accept provisional only if the review allows it.",
    };
  }

  const help = blocked
    ? manualEvidenceHelp("failed")
    : !persisted
      ? MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"]
      : manualEvidenceHelp(grade);

  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: "workflow_closeout",
    phase: "closeout",
    outcome,
    summary,
    check_summary: blocked
      ? "Required delivery evidence contains a known failure."
      : outcome === "partial"
        ? `${evidenceGaps.length || 1} required proof gap${evidenceGaps.length === 1 ? "" : "s"} remain.`
        : "Required portable Evidence is ready for fresh Review.",
    enforcement_level: value.enforcement_level
      ?? ((value.constraint_summary?.receipt_coverage?.eligible ?? 0) > 0
        && value.constraint_summary.receipt_coverage.attested === value.constraint_summary.receipt_coverage.eligible
        ? "host-native"
        : "explicit"),
    technical_traceability: {
      root_plan_id: value.root_plan_id ?? null,
      root_content_hash: value.root_content_hash ?? null,
      evidence_id: value.delivery_evidence_id ?? null,
      evidence_hash: value.artifact_hash ?? null,
      artifact_set_hash: value.artifact_set_hash ?? null,
      repository_snapshot_hash: value.repository_snapshot_hash ?? null,
      review_id: value.source_review_id ?? null,
      correction_id: value.correction_id ?? null,
      check_ids: (value.check_evidence ?? []).map((entry) => entry.check_id).filter(Boolean),
      finding_ids: [],
      changed_paths: value.changed_paths ?? [],
      receipt_ids: [...new Set((value.check_evidence ?? []).flatMap((entry) => entry.artifact_hashes ?? []))],
      evidence_status: status,
      evidence_grade: grade,
      handoff_persisted: persisted,
    },
    checks: [
      `evidence mode: ${value.evidence_mode ?? "unknown"}`,
      `handoff persisted: ${persisted ? "yes" : "no"}`,
      formatChangedPaths(value.changed_paths),
      receiptCoverageLine(value.constraint_summary),
    ].filter(Boolean),
    gaps: [
      ...(blocked ? [`Evidence status ${status} with grade ${grade} blocks delivery acceptance.`] : []),
      ...((value.constraint_summary?.evidence_gap_checks ?? []).length > 0
        ? [`Evidence gaps: ${value.constraint_summary.evidence_gap_checks.join(", ")}.`]
        : []),
    ],
    human_attention: humanAttentionLines(value.human_attention),
    problems: problemLines(value.problem_details),
    advisories: persisted
      ? []
      : ["Task-local Evidence remains valid; optional cross-task handoff is unavailable."],
    warnings,
    errors: [],
  }, nextAction, overrides), help);
}

function errorPresentation(toolName, value) {
  const technical = firstLine(value?.error, "Workflow tool failed.");
  const reviewErrorCode = value?.error_code
    ?? (/review_input|workflow-review-input/i.test(technical)
      ? "review-input-invalid"
      : /model-authored work-review|newly imported work-review|host builder provenance/i.test(technical)
        ? "review-artifact-rejected"
        : null);
  if (["review-input-invalid", "review-artifact-rejected"].includes(reviewErrorCode)) {
    const rejectedArtifact = reviewErrorCode === "review-artifact-rejected";
    const reason = rejectedArtifact
      ? "Workflow rejected a supplied Review artifact because it cannot establish host-owned Review authority."
      : "The reviewer response could not be converted into a valid host-owned Review.";
    const recovery = rejectedArtifact
      ? "Remove the supplied work-review artifact, pass only review_input schema 1, and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required."
      : "Correct the named review_input field and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required.";
    return withHelpFields(withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "review",
      outcome: "blocked",
      summary: reason,
      blocker: reason,
      checks: [],
      gaps: [reason],
      advisories: [],
      warnings: [],
      errors: [technical],
    }, "retry-review", {
      blocked_reason: reason,
      recovery,
      invoke: "Current task, read-only phase: correct the named Review input and rerun /review-work or $review-work",
    }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
  }
  // Every failed Manual tool keeps a recoverable action; errors must never render as Done.
  const closeoutFailed = toolName === "workflow_closeout";
  const nextAction = toolName === "workflow_plan_preflight"
    ? "repair-root"
    : closeoutFailed
      ? "review-root"
      : "provide-artifacts";
  const fallbackRecovery = toolName === "workflow_plan_preflight"
    ? "Repair the Root blockers, then retry validation or /plan-work."
    : closeoutFailed
      ? "Repair the exact Root/chain and Check observations, then retry closeout or Ask: /review-work."
      : "Supply the exact current Schema-5 artifacts, then retry the failed Workflow command.";
  const guidance = humanBlocker(technical, fallbackRecovery);
  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: toolName,
    phase: toolName.replace(/^workflow_/, "").replaceAll("_", "-"),
    outcome: closeoutFailed ? "blocked" : "failed",
    summary: guidance.reason,
    blocker: guidance.reason,
    checks: [],
    gaps: [guidance.reason],
    advisories: [],
    warnings: [],
    errors: [technical],
  }, nextAction, {
    blocked_reason: guidance.reason,
    recovery: guidance.recovery,
  }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
}

function buildPresentationCore(toolName, value, { isError = false } = {}) {
  if (isError || value?.error) {
    return errorPresentation(toolName, value);
  }

  if (toolName === "workflow_plan_preflight") {
    const blockers = asList(value.blocking_issues);
    const advisories = asList(value.advisories);
    const feasible = value.feasible === true && blockers.length === 0;
    const nextAction = feasible ? "implement-plan" : "repair-root";
    const blockerGuidance = feasible ? null : humanBlocker(blockers[0] ?? "Root cannot be presented yet.", "Repair the Root blockers, then retry /plan-work.");
    const overrides = feasible
      ? {}
      : {
        blocked_reason: blockerGuidance.reason,
        recovery: blockerGuidance.recovery,
      };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "plan-preflight",
      outcome: feasible ? "ready" : "blocked",
      ...(blockerGuidance ? { blocker: blockerGuidance.reason } : {}),
      summary: feasible
        ? "The Intent Root is valid and ready for human implementation approval."
        : "The Intent Root is not ready for implementation approval.",
      check_summary: feasible ? "Root structure and required Checks are feasible." : "Root validation has blocking issues.",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: null,
        review_id: null,
        correction_id: null,
        check_ids: value.required_checks ?? [],
        finding_ids: [],
        changed_paths: [],
      },
      checks: [
        `required: ${(value.required_checks ?? []).join(", ") || "none"}`,
        `deferred: ${(value.deferred_checks ?? []).join(", ") || "none"}`,
      ],
      gaps: blockers,
      advisories,
      warnings: [],
      errors: [],
    }, nextAction, overrides);
    return feasible ? presentation : withHelpFields(presentation, MANUAL_HELP_TOPICS["intent-root-and-plan"]);
  }

  if (toolName === "workflow_artifact_record") {
    const persisted = value.handoff_persisted !== false && value.handoff_mode !== "stateless";
    const warnings = asList(value.warning ? [value.warning] : []);
    const recordedIds = [...asList(value.recorded), ...asList(value.duplicates)];
    const containsReview = recordedIds.some((id) => /^wr-/.test(id));
    const nextAction = persisted
      ? containsReview ? "provide-artifacts" : "implement-plan"
      : "attach-artifact";
    const overrides = persisted
      ? {}
      : {
        blocked_reason: "Artifact validated; handoff cache was unavailable.",
        recovery: "Attach the exact artifact explicitly; handoff is transport only.",
      };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "artifact-record",
      outcome: persisted ? "ready" : "partial",
      summary: persisted
        ? "The exact artifact chain is available for the next Manual phase."
        : "Artifact validated; handoff cache was unavailable.",
      check_summary: persisted ? "Artifact bytes were validated and retained." : "Artifact bytes are valid but not retained.",
      checks: [
        `recorded: ${(value.recorded ?? []).join(", ") || "none"}`,
        `duplicates: ${(value.duplicates ?? []).join(", ") || "none"}`,
      ],
      gaps: persisted ? [] : ["Attach the exact artifact explicitly; handoff is transport only."],
      advisories: ["Handoff is transport only and never grants authority."],
      warnings,
      errors: [],
    }, nextAction, overrides);
    return persisted ? presentation : withHelpFields(presentation, MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"]);
  }

  if (toolName === "workflow_artifact_context") {
    const count = Array.isArray(value.artifacts) ? value.artifacts.length : 0;
    const nextAction = "review-root";
    const overrides = value.evidence_tip
      ? {}
      : {
        blocked_reason: "No Evidence tip is loaded for this Root.",
        recovery: "Run Review in this task; it attempts one internal idempotent closeout before asking for another action.",
      };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "artifact-context",
      outcome: value.evidence_tip ? "ready" : "partial",
      summary: value.evidence_tip
        ? "The exact current artifact chain is ready for task-local read-only review."
        : "The current Root is loaded; task-local Review will attempt one internal Evidence recovery.",
      check_summary: value.evidence_tip ? "Delivery Evidence is available." : "Delivery Evidence is missing.",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: value.evidence_tip ?? null,
        review_id: value.review_tip ?? null,
        correction_id: null,
        check_ids: [],
        finding_ids: [],
        changed_paths: [],
        artifact_count: count,
      },
      checks: [
        `evidence tip: ${value.evidence_tip ?? "none"}`,
        `review tip: ${value.review_tip ?? "none"}`,
      ],
      gaps: value.evidence_tip ? [] : ["Evidence tip missing; Review will attempt one internal recovery."],
      advisories: ["Task artifacts remain authoritative; context is enrichment only."],
      warnings: asList(value.warning ? [value.warning] : []),
      errors: [],
    }, nextAction, overrides);
    return value.evidence_tip && !value.warning
      ? presentation
      : withHelpFields(presentation, MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"]);
  }

  if (toolName === "workflow_closeout") {
    return closeoutPresentation(value);
  }

  if (toolName === "workflow_status") {
    const snapshot = value.snapshot ?? {};
    const blockers = asList(snapshot.blockers);
    const state = snapshot.state ?? "unknown";
    const action = snapshot.next_action ?? "none";
    const requestedProfile = snapshot.requested_profile ?? "manual";
    const effectiveProfile = snapshot.effective_profile ?? requestedProfile;
    const requiredActor = snapshot.required_actor ?? "unknown";
    const downgradeReason = snapshot.downgrade_reason ?? null;
    const outcome = statusPresentationOutcome(snapshot);
    const safeAction = normalizeManualPrimaryAction({ outcome }, action);
    const overrides = blockers.length > 0 && (outcome === "blocked" || outcome === "partial") && action !== "none"
      ? {
        blocked_reason: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).reason,
        recovery: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).recovery,
      }
      : outcome === "blocked" && blockers.length > 0
        ? {
          blocked_reason: humanBlocker(blockers[0]).reason,
          recovery: humanBlocker(blockers[0], "Clear the named issue, then re-check /work-status.").recovery,
        }
        : {};
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "status",
      workflow_state: state,
      journey_state: snapshot.journey_state ?? null,
      outcome,
      summary: requiredActor === "none"
        ? `The Manual delivery is ${state}; no further actor is required.`
        : `The Manual delivery is ${state}; ${requiredActor} acts next.`,
      check_summary: state === "achieved"
        ? "Fresh review verified the required repository evidence."
        : state === "root-review"
          ? "Delivery Evidence is ready for fresh review."
          : state === "root-plan-review"
            ? "Implementation Evidence does not exist yet."
            : blockers.length > 0
              ? "The current Workflow state has blocking evidence or context."
              : "Current Checks and evidence remain visible in technical traceability.",
      enforcement_level: value.enforcement_level ?? "explicit",
      technical_traceability: {
        root_plan_id: snapshot.root_plan_id ?? value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? value.artifact_summary?.root_content_hash ?? null,
        evidence_id: snapshot.latest_evidence_id ?? snapshot.evidence_tip ?? null,
        evidence_hash: value.evidence_hash ?? value.artifact_summary?.evidence_hash ?? null,
        review_id: snapshot.latest_review_id ?? snapshot.review_tip ?? null,
        review_hash: value.artifact_summary?.review_hash ?? null,
        correction_id: snapshot.review?.correction_id ?? null,
        check_ids: value.constraint_summary?.required_checks ?? [],
        finding_ids: value.artifact_summary?.finding_ids ?? [],
        changed_paths: [],
        artifact_set_hash: snapshot.artifact_set_hash ?? value.artifact_summary?.artifact_set_hash ?? null,
        repository_snapshot_hash: value.repository_snapshot_hash ?? null,
        receipt_ids: value.receipt_ids ?? value.artifact_summary?.receipt_ids ?? [],
        workflow_state: state,
      },
      checks: [
        requestedProfile === effectiveProfile
          ? `profile: ${effectiveProfile}`
          : `profile: ${requestedProfile} → ${effectiveProfile}`,
        `required actor: ${requiredActor}`,
        `evidence: ${snapshot.latest_evidence_id ?? snapshot.evidence_tip ?? "none"}`,
        `review: ${snapshot.latest_review_id ?? snapshot.review_tip ?? "none"}`,
        receiptCoverageLine(value.constraint_summary),
      ].filter(Boolean),
      gaps: blockers,
      advisories: asList([
        formatHostToolApproval(value.host_tool_approval),
        value.model_inheritance?.status ? `model_inheritance: ${value.model_inheritance.status}` : null,
      ].filter(Boolean)),
      warnings: asList([
        ...(value.warning ? [value.warning] : []),
        ...(downgradeReason ? [`profile downgrade: ${requestedProfile} → ${effectiveProfile} (${downgradeReason})`] : []),
      ]),
      errors: [],
      human_attention: humanAttentionLines(value.human_attention),
      problems: problemLines(value.problem_details),
    }, safeAction, overrides);
    return isManualStatusSnapshot(snapshot)
      ? withHelpFields(presentation, manualStateHelp(state))
      : presentation;
  }

  return withNextStepFields({
    schema: 1,
    tool: toolName,
    phase: "manual",
    outcome: "ready",
    summary: firstLine(JSON.stringify(value), "Workflow tool completed."),
    checks: [],
    gaps: [],
    advisories: [],
    warnings: [],
    errors: [],
  }, "none");
}

function buildPresentation(toolName, value, options = {}) {
  const presentation = buildPresentationCore(toolName, value, options);
  return value?.human_projection
    ? { ...presentation, human_projection: value.human_projection }
    : presentation;
}

function formatSection(title, items) {
  if (!items || items.length === 0) return null;
  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
}

function formatHelp(help) {
  if (!help?.meaning || !help?.label || !help?.url) return null;
  return [
    `Meaning: ${help.meaning}`,
    `Learn more: [${help.label}](${help.url})`,
  ].join("\n");
}

function formatNextStepFooter(presentation) {
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "achieved" && presentation.next_action === "none") {
    return [
      "### Done",
      "Repository delivery is complete for this Root.",
    ].join("\n");
  }
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "accepted-provisional" && presentation.next_action === "none") {
    return [
      "### Accepted provisionally",
      "This one-time acceptance is not persisted; the next /work-status or $work-status returns delivery-ready-provisional.",
    ].join("\n");
  }
  const primary = presentation.primary_action;
  if (!primary) return ["### Done", "No further Workflow action is required."].join("\n");
  return [
    "### Next step",
    `- Now: ${primary.label}`,
    `- How: ${primary.invoke}`,
    `- Why: ${primary.why}`,
  ].join("\n");
}

function formatProjectionList(label, values, fallback) {
  const items = asList(values);
  const effective = items.length > 0 ? items : [fallback];
  return [
    `${label}:`,
    ...effective.map((item) => item.includes("\n") ? item : `- ${item}`),
  ].join("\n");
}

function formatHumanDetails(presentation, journeyLabel, blocker) {
  const guidance = blocker
    ? humanBlocker(blocker, presentation.next_action_recovery ?? "Follow the single next action, then repeat this Workflow phase.")
    : null;
  const projection = presentation.human_projection ?? {};
  const considerations = [...new Set([
    ...asList(presentation.human_attention),
    ...asList(presentation.problems),
    ...asList(presentation.gaps),
    ...asList(presentation.warnings),
    ...asList(presentation.advisories),
  ].filter((item) => item !== blocker).map((item) => humanBlocker(item).reason))];
  return [
    "## Details",
    "Read this section when the quick decision does not resolve uncertainty.",
    "",
    "### Outcome and approach",
    "",
    `Outcome: ${projection.outcome ?? presentation.summary}`,
    formatProjectionList(
      "Approach and rationale",
      projection.approach_and_rationale,
      "No separate approach rationale is available for this tool result; use the exact Root in structuredContent before implementation.",
    ),
    "",
    "### Scope and boundaries",
    "",
    formatProjectionList("In scope", projection.in_scope, "No repository scope is available in this tool result."),
    "",
    formatProjectionList("Non-goals", projection.non_goals, "No explicit non-goals are available in this tool result."),
    "",
    formatProjectionList("Constraints", projection.constraints, "No explicit constraints are available in this tool result."),
    "",
    "### Verification, risks, and recovery",
    "",
    formatProjectionList(
      "Acceptance and verification",
      uniqueText([...(projection.acceptance_and_verification ?? []), presentation.check_summary]),
      "Exact verification observations are unavailable; consult structuredContent before continuing.",
    ),
    "",
    formatProjectionList("Risks and trade-offs", projection.risks_and_tradeoffs, "No explicit risks or trade-offs are available in this tool result."),
    "",
    formatProjectionList(
      "Unknowns and recovery",
      uniqueText([
        ...(projection.unknowns_and_recovery ?? []),
        ...(guidance ? [guidance.reason, presentation.next_action_recovery ?? guidance.recovery] : []),
        ...considerations,
        `Current Workflow state: ${journeyLabel}.`,
      ]),
      "No additional uncertainty or recovery condition is reported for this tool result.",
    ),
  ].filter((line) => line !== null && line !== undefined).join("\n");
}

function traceValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === null || value === undefined || value === "" ? "none" : String(value);
}

function formatTechnicalTraceability(presentation, { disclosure = true } = {}) {
  const trace = presentation.technical_traceability ?? {};
  const identity = [
    `Root: ${trace.root_plan_id ?? "none"}`,
    `Root hash: ${trace.root_content_hash ?? "none"}`,
    `Evidence: ${trace.evidence_id ?? "none"}`,
    `Evidence hash: ${trace.evidence_hash ?? "none"}`,
    `Review: ${trace.review_id ?? "none"}`,
    `Review hash: ${trace.review_hash ?? "none"}`,
    `Correction: ${trace.correction_id ?? "none"}`,
    `Artifact set hash: ${trace.artifact_set_hash ?? "none"}`,
    `Repository snapshot hash: ${trace.repository_snapshot_hash ?? "none"}`,
    `Receipt IDs: ${traceValue(trace.receipt_ids)}`,
    `Check IDs: ${traceValue(trace.check_ids)}`,
    `Finding IDs: ${traceValue(trace.finding_ids)}`,
    formatChangedPaths(trace.changed_paths),
    `Enforcement: ${presentation.enforcement_level ?? trace.enforcement_level ?? "explicit"}`,
    `Update key: ${presentation.deduplication_key ?? "none"}`,
  ];
  const body = [
    `${presentation.tool} — ${presentation.outcome}`,
    ...identity,
    formatSection("Checks", presentation.checks),
    formatSection("Gaps", presentation.gaps),
    formatSection("Human attention", presentation.human_attention),
    formatSection("Problems", presentation.problems),
    formatSection("Advisories", presentation.advisories),
    formatSection("Warnings", presentation.warnings),
    formatSection("Errors", presentation.errors),
    presentation.next_action_blocked_reason ? `Action blocker: ${presentation.next_action_blocked_reason}` : null,
    presentation.next_action_recovery ? `Recovery detail: ${presentation.next_action_recovery}` : null,
    formatHelp(presentation.help),
  ].filter((line) => line !== null && line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const index = [
    "The complete structuredContent returned with this tool result is the authoritative agent and machine contract.",
    "Read structuredContent before continuing. This bounded visible index is non-authoritative and intentionally omits exact artifact bytes instead of duplicating them.",
    "",
    "### Technical traceability index",
    "",
    body,
  ].join("\n");
  return disclosure
    ? `<details><summary>Agent and machine index (structuredContent is authoritative)</summary>\n\n${index}\n\n</details>`
    : `---\n\n## Agent and machine index\n\n${index}`;
}

export function formatManualToolContent(presentation, { technicalDisclosure = true } = {}) {
  const journeyLabel = JOURNEY_STATE_LABELS[presentation.journey_state] ?? presentation.journey_state ?? "Manual state";
  const blocker = firstProblem(presentation);
  const blockerGuidance = blocker
    ? humanBlocker(blocker, presentation.next_action_recovery ?? "Follow the single next action, then repeat this Workflow phase.")
    : null;
  const lines = [
    "## Quick decision",
    "",
    "Use this section for the immediate Workflow decision.",
    `State: ${journeyLabel}`,
    `What happened: ${presentation.summary}`,
    `Checks: ${presentation.check_summary ?? "See technical traceability for exact evidence."}`,
    blockerGuidance ? `Blocker: ${blockerGuidance.reason}` : null,
    blockerGuidance ? `Resolution: ${presentation.next_action_recovery ?? blockerGuidance.recovery}` : null,
    "",
    formatNextStepFooter(presentation),
    "",
    formatHumanDetails(presentation, journeyLabel, blocker),
    "",
    formatTechnicalTraceability(presentation, { disclosure: technicalDisclosure }),
  ].filter((line) => line !== null && line !== undefined);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function isManualWorkflowTool(toolName) {
  return MANUAL_TOOLS.has(toolName);
}

export function resetManualPresentationDedupe() {
  RECENT_PRESENTATION_UPDATES.clear();
}

export function coalesceManualPresentation(presentation) {
  const trace = presentation.technical_traceability ?? {};
  const subject = trace.root_plan_id
    ? `root|${trace.root_plan_id}`
    : [presentation.tool, "no-root", presentation.phase ?? "manual"].join("|");
  const duplicate = RECENT_PRESENTATION_UPDATES.get(subject) === presentation.deduplication_key;
  if (!duplicate) {
    RECENT_PRESENTATION_UPDATES.delete(subject);
    RECENT_PRESENTATION_UPDATES.set(subject, presentation.deduplication_key);
    while (RECENT_PRESENTATION_UPDATES.size > MAX_RECENT_PRESENTATION_UPDATES) {
      RECENT_PRESENTATION_UPDATES.delete(RECENT_PRESENTATION_UPDATES.keys().next().value);
    }
  }
  return { ...presentation, update_suppressed: duplicate };
}

export function manualMcpResult(toolName, value, isError = false) {
  const { human_projection: _humanProjection, ...machineValue } = value ?? {};
  if (process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT === "1" || !isManualWorkflowTool(toolName)) {
    return {
      content: [{ type: "text", text: JSON.stringify(machineValue, null, 2) }],
      structuredContent: machineValue,
      isError,
    };
  }
  const presentation = coalesceManualPresentation(buildPresentation(toolName, value, { isError }));
  const structuredContent = { ...machineValue, presentation };
  return {
    content: presentation.update_suppressed ? [] : [{ type: "text", text: formatManualToolContent(presentation) }],
    structuredContent,
    isError,
  };
}

export {
  buildPresentation,
  formatChangedPaths,
  MANUAL_EVIDENCE_HELP,
  MANUAL_GUIDE_LABEL,
  MANUAL_GUIDE_URL,
  MANUAL_HELP_TOPICS,
  MANUAL_STATE_HELP,
  JOURNEY_STATE_LABELS,
  NEXT_STEP_CATALOG,
  MANUAL_PRIMARY_ACTIONS,
  resolveNextStep,
  statusPresentationOutcome,
};
