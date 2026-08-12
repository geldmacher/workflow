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
    "Handoff only transports exact artifact bytes; missing cache context requires explicit artifacts and grants no authority.",
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
    "intent-clarification",
    "The Root is not intent-ready because a material goal, acceptance, authority, or risk decision still needs a human answer.",
  ),
  "root-plan-review": helpEntry(
    "manual-state-root-plan-review",
    "root-plan-review",
    "A ready Intent Root exists and waits for human Implement Plan approval before Delivery Evidence can be created.",
  ),
  "root-review": helpEntry(
    "manual-state-root-review",
    "root-review",
    "Delivery Evidence exists and now needs a fresh read-only review against the approved Root.",
  ),
  "waiting-human": helpEntry(
    "manual-state-waiting-human",
    "waiting-human",
    "Workflow needs the human to resolve the listed clarification, correction approval, or missing exact context.",
  ),
  replan: helpEntry(
    "manual-state-replan",
    "replan",
    "The current Root or chain cannot safely authorize the required work and must be replaced through a newly approved plan.",
  ),
  "delivery-ready-provisional": helpEntry(
    "manual-state-delivery-ready-provisional",
    "delivery-ready-provisional",
    "No known failed required Check blocks delivery, but proof remains incomplete or unavailable and needs an explicit human decision.",
  ),
  "accepted-provisional": helpEntry(
    "manual-state-accepted-provisional",
    "accepted-provisional",
    "The human accepted this evidence gap once; the delivery is still not verified and the acceptance is not persisted.",
  ),
  achieved: helpEntry(
    "manual-state-achieved",
    "achieved",
    "A fresh review verified the required Checks for this repository-only Root, so no further Workflow action is required.",
  ),
  blocked: helpEntry(
    "manual-state-blocked",
    "blocked",
    "A known failure or safety boundary prevents delivery and cannot be overridden by provisional acceptance.",
  ),
  failed: helpEntry(
    "manual-state-failed",
    "failed",
    "Workflow could not produce a valid result; repair the reported failure before retrying.",
  ),
  stopped: helpEntry(
    "manual-state-stopped",
    "stopped",
    "This subject is intentionally non-actionable, commonly because it is read-only Workflow-3 or Workflow-4 history.",
  ),
});

const MANUAL_EVIDENCE_HELP = Object.freeze({
  verified: helpEntry(
    "manual-evidence-verified",
    "verified",
    "The required Check was directly observed with the method and repetition needed for verified Evidence.",
  ),
  supported: helpEntry(
    "manual-evidence-supported",
    "supported",
    "Meaningful inspection supports the claim, but the proof is not strong enough for verified delivery.",
  ),
  partial: helpEntry(
    "manual-evidence-partial",
    "partial",
    "Some relevant proof exists, but it does not fully cover the required Check or expected result.",
  ),
  unavailable: helpEntry(
    "manual-evidence-unavailable",
    "unavailable",
    "The required proof surface could not be used; the named limitation is missing proof, not success or failure.",
  ),
  failed: helpEntry(
    "manual-evidence-failed",
    "failed-evidence",
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
    benefit: "Delivers inside the approved Root and runs deterministic closeout.",
    blocked_when: "No approved Root is ready for implementation.",
    recovery: "Finish Plan presentation and human approval first.",
  },
  "attach-artifact": {
    label: "Attach the exact artifact",
    invoke: "Agent: attach exact Root/Evidence text to the next Workflow command",
    benefit: "Preserves the chain when handoff transport is unavailable.",
    blocked_when: "Handoff cache did not persist the exact artifact.",
    recovery: "Paste the exact artifact bytes, then continue review or status.",
  },
  "review-root": {
    label: "Fresh review",
    invoke: "Ask: run a fresh /review-work or $review-work against the exact Root/Evidence chain",
    benefit: "Produces a fresh verdict without Writer assumptions.",
    blocked_when: "Evidence is missing or the chain is incomplete.",
    recovery: "Run /close-work [wp-id] or $close-work first, then review.",
  },
  "accept-provisional": {
    label: "Accept provisional delivery",
    invoke: "Ask/Agent: /accept-work provisional or $accept-work provisional only for an explicit provisional acceptance",
    benefit: "Records a one-time human acceptance of an evidence gap.",
    blocked_when: "Current review is not provisional.",
    recovery: "Run a fresh review before accepting.",
  },
  closeout: {
    label: "Deterministic closeout",
    invoke: "Agent: /close-work [wp-id] or $close-work, or finish Implement Plan closeout",
    benefit: "Builds validated Evidence from observed Checks.",
    blocked_when: "Exact Root/chain or Check observations are missing.",
    recovery: "Supply exact artifacts and required Check observations, then retry.",
  },
  correct: {
    label: "Fix failing Checks",
    invoke: "Agent: repair failing required Checks, then closeout again",
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
    invoke: "Ask: fresh /review-work or $review-work with complete evidence",
    benefit: "Reassesses once Evidence or context is complete.",
    blocked_when: "Evidence is still missing or incomplete.",
    recovery: "Close out or attach Evidence, then retry review.",
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

function firstLine(text, fallback = "No summary.") {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value || fallback;
}

function resolveNextStep(action, overrides = {}) {
  const entry = NEXT_STEP_CATALOG[action];
  if (!entry) {
    return {
      action,
      label: action,
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
    label: entry.label,
    invoke: overrides.invoke ?? entry.invoke,
    benefit: overrides.benefit ?? entry.benefit,
    blocked_reason: blockedReason,
    recovery,
    // Keep a short compatible summary that still embeds the exact invoke tokens.
    label_line: entry.invoke.includes(":") ? `${entry.invoke}.` : entry.invoke,
  };
}

function nextActionLabel(action) {
  return resolveNextStep(action).label_line;
}

function withNextStepFields(presentation, action, overrides = {}) {
  const step = resolveNextStep(action, overrides);
  return {
    ...presentation,
    next_action: action,
    next_action_label: step.label_line,
    next_action_invoke: step.invoke,
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
    ? `Delivery evidence ${value.delivery_evidence_id ?? "unknown"} is blocked (${grade} / ${status}).`
    : outcome === "partial"
      ? `Delivery evidence ${value.delivery_evidence_id ?? "unknown"} is partial (${grade} / ${status}).`
      : persisted
        ? `Delivery evidence ${value.delivery_evidence_id ?? "unknown"} is ready (${grade} / ${status}).`
        : `Delivery evidence ${value.delivery_evidence_id ?? "unknown"} is ready (${grade} / ${status}); handoff cache unavailable — attach required.`;

  let nextAction = "review-root";
  let overrides = {};
  if (blocked) {
    nextAction = "review-root";
    overrides = {
      blocked_reason: `Evidence status ${status} with grade ${grade} blocks delivery acceptance.`,
      recovery: "Ask: /review-work or $review-work; then /correct-work or replan as the review directs.",
    };
  } else if (!persisted) {
    nextAction = "attach-artifact";
    overrides = {
      blocked_reason: "Handoff cache unavailable; exact Evidence must travel with the next command.",
      recovery: "Attach the returned Evidence artifact, then Ask: /review-work or $review-work.",
    };
  } else if (legacyReceiptGaps.length > 0) {
    overrides = {
      blocked_reason: `Legacy verified claims lack current host receipts: ${legacyReceiptGaps.join(", ")}.`,
      recovery: "Ask: run a fresh /review-work or $review-work and follow its bounded correction route.",
    };
  } else if (outcome === "partial" && evidenceGaps.length > 0) {
    nextAction = "closeout";
    overrides = {
      invoke: "Agent: follow each Evidence-gap problem's exact Check rerun, then retry closeout",
      benefit: "Obtains the missing host receipts before the independent review.",
      blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
      recovery: "Run the exact Check reruns listed under Problems, then retry closeout.",
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
    checks: [
      `evidence mode: ${value.evidence_mode ?? "unknown"}`,
      `handoff persisted: ${persisted ? "yes" : "no"}`,
      formatChangedPaths(value.changed_paths),
      receiptCoverageLine(value.constraint_summary),
    ].filter(Boolean),
    gaps: [
      ...(blocked ? [`Evidence status ${status} with grade ${grade} blocks delivery acceptance.`] : []),
      ...(persisted ? [] : ["Attach the returned Evidence artifact explicitly."]),
      ...((value.constraint_summary?.evidence_gap_checks ?? []).length > 0
        ? [`Evidence gaps: ${value.constraint_summary.evidence_gap_checks.join(", ")}.`]
        : []),
    ],
    human_attention: humanAttentionLines(value.human_attention),
    problems: problemLines(value.problem_details),
    advisories: persisted ? [] : ["Handoff is transport only and never grants authority."],
    warnings,
    errors: [],
  }, nextAction, overrides), help);
}

function errorPresentation(toolName, value) {
  const summary = firstLine(value?.error, "Workflow tool failed.");
  // Every failed Manual tool keeps a recoverable action; errors must never render as Done.
  const closeoutFailed = toolName === "workflow_closeout";
  const nextAction = toolName === "workflow_plan_preflight"
    ? "repair-root"
    : closeoutFailed
      ? "review-root"
      : "provide-artifacts";
  const recovery = toolName === "workflow_plan_preflight"
    ? "Repair the Root blockers, then retry validation or /plan-work."
    : closeoutFailed
      ? "Repair the exact Root/chain and Check observations, then retry closeout or Ask: /review-work."
      : "Supply the exact current Schema-5 artifacts, then retry the failed Workflow command.";
  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: toolName,
    phase: toolName.replace(/^workflow_/, "").replaceAll("_", "-"),
    outcome: closeoutFailed ? "blocked" : "failed",
    summary,
    checks: [],
    gaps: [summary],
    advisories: [],
    warnings: [],
    errors: [summary],
  }, nextAction, {
    blocked_reason: summary,
    recovery,
  }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
}

function buildPresentation(toolName, value, { isError = false } = {}) {
  if (isError || value?.error) {
    return errorPresentation(toolName, value);
  }

  if (toolName === "workflow_plan_preflight") {
    const blockers = asList(value.blocking_issues);
    const advisories = asList(value.advisories);
    const feasible = value.feasible === true && blockers.length === 0;
    const nextAction = feasible ? "implement-plan" : "repair-root";
    const overrides = feasible
      ? {}
      : {
        blocked_reason: blockers[0] ?? "Root cannot be presented yet.",
        recovery: "Repair the Root blockers, then retry validation or /plan-work.",
      };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "plan-preflight",
      outcome: feasible ? "ready" : "blocked",
      summary: feasible
        ? `Root ${value.root_plan_id ?? "unknown"} is feasible for presentation.`
        : `Root ${value.root_plan_id ?? "unknown"} cannot be presented yet.`,
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
        ? `Cached ${(value.recorded ?? []).join(", ") || "artifacts"} in root-content handoff.`
        : "Artifact validated; handoff cache was unavailable.",
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
    const nextAction = value.evidence_tip ? "review-root" : "closeout";
    const overrides = value.evidence_tip
      ? {}
      : {
        blocked_reason: "No Evidence tip is loaded for this Root.",
        recovery: "Run /close-work [wp-id] or finish Implement Plan closeout, then review.",
      };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "artifact-context",
      outcome: value.evidence_tip ? "ready" : "partial",
      summary: `Loaded ${count} artifact${count === 1 ? "" : "s"} for ${value.root_plan_id ?? "unknown"}.`,
      checks: [
        `evidence tip: ${value.evidence_tip ?? "none"}`,
        `review tip: ${value.review_tip ?? "none"}`,
      ],
      gaps: value.evidence_tip ? [] : ["Evidence tip missing; closeout before review."],
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
    const overrides = (outcome === "blocked" || outcome === "partial") && action !== "none"
      ? {
        blocked_reason: blockers[0] ?? `Manual state is ${state}.`,
        recovery: resolveNextStep(action).invoke,
      }
      : outcome === "blocked" && blockers.length > 0
        ? {
          blocked_reason: blockers[0],
          recovery: "Clear blockers with the listed Workflow command, then re-check /work-status.",
        }
        : {};
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "status",
      workflow_state: state,
      outcome,
      summary: requiredActor === "none"
        ? `Root ${snapshot.root_plan_id ?? value.root_plan_id ?? "unknown"} is ${state}; no further actor is required.`
        : `Root ${snapshot.root_plan_id ?? value.root_plan_id ?? "unknown"} is ${state}; ${requiredActor} acts next.`,
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
    }, action, overrides);
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
      "Repository delivery is complete for this Root. Optional: /learn-from-work or /explain-work (Codex: $learn-from-work or $explain-work).",
    ].join("\n");
  }
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "accepted-provisional" && presentation.next_action === "none") {
    return [
      "### Accepted provisionally",
      "This one-time acceptance is not persisted; the next /work-status or $work-status returns delivery-ready-provisional.",
    ].join("\n");
  }
  const step = resolveNextStep(presentation.next_action ?? "none");
  const now = NEXT_STEP_CATALOG[presentation.next_action] ? step.label : (presentation.next_action ?? "unknown");
  const lines = [
    "### Next step",
    `- Now: ${now}`,
    `- How: ${presentation.next_action_invoke ?? step.invoke}`,
    `- Why: ${presentation.next_action_benefit ?? step.benefit}`,
  ];
  if (presentation.next_action_blocked_reason && presentation.next_action_recovery) {
    lines.push(`- Off track: ${presentation.next_action_blocked_reason} → ${presentation.next_action_recovery}`);
  }
  return lines.join("\n");
}

export function formatManualToolContent(presentation) {
  const lines = [
    `${presentation.tool} — ${presentation.outcome}`,
    `What happened: ${presentation.summary}`,
    "",
    formatSection("Checks", presentation.checks),
    formatSection("Gaps", presentation.gaps),
    formatSection("Human attention", presentation.human_attention),
    formatSection("Problems", presentation.problems),
    formatSection("Advisories", presentation.advisories),
    formatSection("Warnings", presentation.warnings),
    formatSection("Errors", presentation.errors),
    formatHelp(presentation.help),
    formatNextStepFooter(presentation),
  ].filter((line) => line !== null && line !== undefined);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function isManualWorkflowTool(toolName) {
  return MANUAL_TOOLS.has(toolName);
}

export function manualMcpResult(toolName, value, isError = false) {
  if (process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT === "1" || !isManualWorkflowTool(toolName)) {
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError,
    };
  }
  const presentation = buildPresentation(toolName, value, { isError });
  const structuredContent = { ...value, presentation };
  return {
    content: [{ type: "text", text: formatManualToolContent(presentation) }],
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
  NEXT_STEP_CATALOG,
  resolveNextStep,
  statusPresentationOutcome,
};
