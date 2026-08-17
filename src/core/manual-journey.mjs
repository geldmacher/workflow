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

export const MANUAL_PRIMARY_ACTIONS = Object.freeze({
  "repair-root": Object.freeze({ label: "Repair the Root", command: "plan-work" }),
  "implement-plan": Object.freeze({ label: "Implement the Plan", command: "Implement Plan" }),
  "attach-artifact": Object.freeze({ label: "Export the exact artifact", command: "attach-artifact" }),
  "review-root": Object.freeze({ label: "Review delivery", command: "review-work" }),
  "accept-provisional": Object.freeze({ label: "Accept provisional delivery", command: "accept-work" }),
  closeout: Object.freeze({ label: "Portable Evidence build", command: "workflow_closeout" }),
  correct: Object.freeze({ label: "Fix failing Checks", command: "correct-work" }),
  "approve-correction": Object.freeze({ label: "Apply bounded correction", command: "correct-work" }),
  "provide-artifacts": Object.freeze({ label: "Supply artifact chain", command: "work-status" }),
  replan: Object.freeze({ label: "Replan the Root", command: "plan-work replan" }),
  "retry-review": Object.freeze({ label: "Retry review", command: "review-work" }),
  answer: Object.freeze({ label: "Answer clarification", command: "answer clarification" }),
  "resolve-intent": Object.freeze({ label: "Resolve intent", command: "plan-work" }),
  none: Object.freeze({ label: "Done", command: "none" }),
  learn: Object.freeze({ label: "Persist learnings", command: "learn-from-work" }),
  explain: Object.freeze({ label: "Explain the chain", command: "explain-work" }),
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
]);

export function normalizeManualPrimaryAction(presentation, action) {
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
  if (["answer", "resolve-intent", "provide-artifacts"].includes(action)) return "clarification-required";
  if (["closeout", "attach-artifact"].includes(action)) return "closeout-recovery-required";
  return presentation?.phase === "review" ? "review-active" : "implementation-active";
}

export function taskBoundManualInvoke(action, trace = {}) {
  const catalog = MANUAL_PRIMARY_ACTIONS[action] ?? { command: String(action), label: String(action) };
  const root = trace.root_plan_id ?? null;
  const evidence = trace.evidence_id ?? null;
  const review = trace.review_id ?? null;
  if (action === "none") return "No further Workflow action required";
  if (action === "implement-plan") return catalog.command;
  if (action === "accept-provisional") return [catalog.command, root, "provisional"].filter(Boolean).join(" ");
  if (action === "attach-artifact") return [catalog.command, evidence ?? root].filter(Boolean).join(" ");
  if (action === "answer") return [catalog.command, review ?? root].filter(Boolean).join(" ");
  return [catalog.command, root].filter(Boolean).join(" ");
}

export function manualJourneyDecision({ state = "blocked", blocker, action, trace = {} }) {
  const normalizedAction = normalizeManualPrimaryAction({ outcome: state === "blocked" ? "blocked" : "partial" }, action);
  const label = MANUAL_JOURNEY_STATE_LABELS[state] ?? state;
  const catalog = MANUAL_PRIMARY_ACTIONS[normalizedAction] ?? { label: normalizedAction };
  return `Workflow · ${label}. Reason: ${blocker} Resolution: ${catalog.label} — ${taskBoundManualInvoke(normalizedAction, trace)}.`;
}
