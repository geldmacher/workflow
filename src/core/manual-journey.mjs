export const MANUAL_JOURNEY_STATE_LABELS = Object.freeze({
  "plan-ready": "Plan ready",
  "implementation-active": "Implementation active",
  "closeout-recovery-required": "Closeout recovery required",
  "review-ready": "Review required",
  "review-active": "Review active",
  "correction-approval-required": "Correction approval required",
  "replan-approval-required": "Replan approval required",
  "provisional-acceptance-required": "Provisional acceptance required",
  "clarification-required": "Clarification required",
  blocked: "Blocked",
  done: "Done",
});

export const HUMAN_WORKFLOW_PHASE_LABELS = Object.freeze({
  "plan-ready": "Plan ready",
  "in-progress": "In progress",
  "review-needed": "Review needed",
  "decision-needed": "Decision needed",
  blocked: "Blocked",
  completed: "Completed",
});

export const MANUAL_PRIMARY_ACTIONS = Object.freeze({
  "repair-root": Object.freeze({ label: "Repair the Root", command: "plan-work" }),
  "implement-plan": Object.freeze({ label: "Implement the Plan", command: "Implement Plan" }),
  "attach-artifact": Object.freeze({ label: "Export the exact artifact", command: "attach-artifact" }),
  "review-root": Object.freeze({ label: "Review delivery", command: "review-work" }),
  "accept-provisional": Object.freeze({ label: "Acknowledge the provisional gap", command: "accept-work" }),
  closeout: Object.freeze({ label: "Portable Evidence build", command: "workflow_closeout" }),
  correct: Object.freeze({ label: "Fix failing Checks", command: "correct-work" }),
  "approve-correction": Object.freeze({ label: "Apply bounded correction", command: "correct-work" }),
  "provide-artifacts": Object.freeze({ label: "Supply artifact chain", command: "work-status" }),
  replan: Object.freeze({ label: "Replan the Root", command: "plan-work replan" }),
  "retry-review": Object.freeze({ label: "Retry review", command: "review-work" }),
  answer: Object.freeze({ label: "Answer clarification", command: "answer clarification" }),
  "resolve-intent": Object.freeze({ label: "Resolve intent", command: "plan-work" }),
  "resolve-blocker": Object.freeze({ label: "Resolve the named blocker", command: "resolve blocker, then work-status" }),
  none: Object.freeze({ label: "Done", command: "none" }),
  learn: Object.freeze({ label: "Persist learnings", command: "learn-from-work" }),
  explain: Object.freeze({ label: "Explain the chain", command: "explain-work" }),
});

export const MANUAL_HOST_ACTION_INVOKES = Object.freeze({
  cursor: Object.freeze({
    "repair-root": "/plan-work",
    "implement-plan": "Implement Plan",
    "attach-artifact": "Attach the exact artifact",
    "review-root": "/review-work",
    "accept-provisional": "/accept-work provisional",
    closeout: "/review-work",
    correct: "/correct-work",
    "approve-correction": "/correct-work",
    "provide-artifacts": "/work-status",
    replan: "/plan-work replan",
    "retry-review": "/review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "/plan-work",
    "resolve-blocker": "Fix the named cause, then run /work-status again",
    none: "No further Workflow action required",
    learn: "/learn-from-work",
    explain: "/explain-work",
  }),
  codex: Object.freeze({
    "repair-root": "$plan-work",
    "implement-plan": "Implement Plan",
    "attach-artifact": "Attach the exact artifact",
    "review-root": "$review-work",
    "accept-provisional": "$accept-work provisional",
    closeout: "$review-work",
    correct: "$correct-work",
    "approve-correction": "$correct-work",
    "provide-artifacts": "$work-status",
    replan: "$plan-work replan",
    "retry-review": "$review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "$plan-work",
    "resolve-blocker": "Fix the named cause, then run $work-status again",
    none: "No further Workflow action required",
    learn: "$learn-from-work",
    explain: "$explain-work",
  }),
  portable: Object.freeze({
    "repair-root": "plan-work",
    "implement-plan": "implement-work",
    "attach-artifact": "attach-artifact",
    "review-root": "review-work",
    "accept-provisional": "accept-work provisional",
    closeout: "workflow_closeout",
    correct: "correct-work",
    "approve-correction": "correct-work",
    "provide-artifacts": "work-status",
    replan: "plan-work replan",
    "retry-review": "review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "plan-work",
    "resolve-blocker": "Fix the named cause, then run work-status again",
    none: "No further Workflow action required",
    learn: "learn-from-work",
    explain: "explain-work",
  }),
});

const SAFE_BLOCKED_ACTIONS = new Set([
  "repair-root",
  "attach-artifact",
  "review-root",
  "closeout",
  "provide-artifacts",
  "replan",
  "retry-review",
  "answer",
  "resolve-intent",
  "resolve-blocker",
]);

export function normalizeManualPrimaryAction(presentation, action) {
  if (action === "none" && presentation?.workflow_state === "stopped") return "none";
  if (!["blocked", "failed"].includes(presentation?.outcome)) return action;
  if (SAFE_BLOCKED_ACTIONS.has(action)) return action;
  if (action === "implement-plan") return "repair-root";
  if (["accept-provisional", "approve-correction", "correct"].includes(action)) return "retry-review";
  return "provide-artifacts";
}

export function deriveManualJourneyState(presentation, action) {
  const state = presentation?.workflow_state;
  if (["achieved", "accepted-provisional"].includes(state) || action === "none") return "done";
  if (action === "implement-plan") return "plan-ready";
  if (action === "approve-correction") return "correction-approval-required";
  if (action === "replan") return "replan-approval-required";
  if (action === "accept-provisional") return "provisional-acceptance-required";
  if (["blocked", "failed"].includes(presentation?.outcome)) return "blocked";
  if (["review-root", "retry-review"].includes(action)) return "review-ready";
  if (["answer", "resolve-intent", "resolve-blocker", "provide-artifacts"].includes(action)) return "clarification-required";
  if (["closeout", "attach-artifact"].includes(action)) return "closeout-recovery-required";
  return presentation?.phase === "review" ? "review-active" : "implementation-active";
}

export function deriveHumanWorkflowPhase({ journeyState, workflowState, outcome } = {}) {
  if (["achieved", "accepted-provisional", "stopped"].includes(workflowState) || journeyState === "done") return "completed";
  if (journeyState === "plan-ready") return "plan-ready";
  if (["review-ready", "review-active", "closeout-recovery-required"].includes(journeyState)) return "review-needed";
  if ([
    "correction-approval-required",
    "replan-approval-required",
    "provisional-acceptance-required",
    "clarification-required",
  ].includes(journeyState)) return "decision-needed";
  if (outcome === "blocked" || outcome === "failed" || journeyState === "blocked") return "blocked";
  return "in-progress";
}

export function taskBoundManualInvoke(action, _trace = {}, clientHost = "portable") {
  const host = MANUAL_HOST_ACTION_INVOKES[clientHost] ? clientHost : "portable";
  return MANUAL_HOST_ACTION_INVOKES[host][action]
    ?? MANUAL_PRIMARY_ACTIONS[action]?.command
    ?? String(action);
}

export function manualJourneyDecision({ state = "blocked", blocker, action, trace = {}, clientHost = "portable" }) {
  const normalizedAction = normalizeManualPrimaryAction({ outcome: state === "blocked" ? "blocked" : "partial" }, action);
  const label = MANUAL_JOURNEY_STATE_LABELS[state] ?? state;
  const catalog = MANUAL_PRIMARY_ACTIONS[normalizedAction] ?? { label: normalizedAction };
  return `Workflow · ${label}. Reason: ${blocker} Resolution: ${catalog.label} — ${taskBoundManualInvoke(normalizedAction, trace, clientHost)}.`;
}
