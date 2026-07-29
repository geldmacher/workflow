function collectCreatePlans(value, found = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return found;
  seen.add(value);
  if (value.type === "createPlan" && typeof value.args?.plan === "string") found.push(value.args.plan);
  for (const child of Object.values(value)) collectCreatePlans(child, found, seen);
  return found;
}

export function createPlanArguments(step) {
  return collectCreatePlans(step);
}

export function validateIntentBlockerReport(value) {
  const questions = value?.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) throw new Error("intent blocker report requires one to three questions");
  const normalized = questions.map((question, index) => {
    if (typeof question !== "string" || question.trim().length < 8) throw new Error(`intent blocker question ${index + 1} is not concrete`);
    return question.trim();
  });
  return {
    questions: normalized,
    rationale: typeof value.rationale === "string" && value.rationale.trim() ? value.rationale.trim() : null,
  };
}

export function classifyPlanningOutput({ plans = [], blockerReports = [] }) {
  if (plans.length > 0 && blockerReports.length > 0) throw new Error("planner returned both CreatePlan and intent blockers");
  if (plans.length !== 1 && blockerReports.length === 0) throw new Error(`planner must return exactly one CreatePlan or one intent blocker report; observed ${plans.length} plans`);
  if (plans.length === 0 && blockerReports.length !== 1) throw new Error(`planner must return exactly one CreatePlan or one intent blocker report; observed ${blockerReports.length} blocker reports`);
  if (plans.length === 1) return { kind: "root", root_plan_text: plans[0] };
  return { kind: "manual-planning-required", ...validateIntentBlockerReport(blockerReports[0]) };
}
