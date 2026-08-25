const states = new Set([
  "intake", "intent-clarification", "root-plan-review", "implementing", "reviewing", "correcting",
  "delivery-ready-verified", "delivery-ready-provisional", "waiting-human", "replan", "achieved",
  "accepted-provisional", "blocked", "paused", "interrupted", "stopped", "failed",
]);

const terminalLifecycle = new Set(["achieved", "accepted-provisional", "blocked", "stopped", "failed"]);

function snapshot(input, state, overrides = {}) {
  if (!states.has(state)) throw new Error(`unsupported workflow state ${state}`);
  return {
    run_id: input.run_id ?? null,
    root_plan_id: input.root_plan_id ?? null,
    requested_profile: input.requested_profile ?? "manual",
    effective_profile: input.effective_profile ?? input.requested_profile ?? "manual",
    contract_level: input.plan?.fields?.contract_level ?? input.contract_level ?? null,
    state,
    snapshot_source: input.snapshot_source ?? (input.run_id ? "harness-run" : "artifact-chain"),
    allowed_actions: [],
    required_actor: "none",
    next_action: "none",
    evidence_tip: input.evidence_tip ?? null,
    review_tip: input.review_tip ?? null,
    blockers: [...new Set(input.blockers ?? [])],
    downgrade_reason: input.downgrade_reason ?? null,
    intent_hash: input.intent_hash ?? input.root_authoritative_projection_hash ?? null,
    evidence_grade: input.evidence_grade ?? null,
    delivery_status: input.delivery_status ?? null,
    qualification_key: input.qualification_key ?? null,
    artifact_set_hash: input.artifact_set_hash ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
    ...overrides,
  };
}

function waiting(input, blocker, nextAction = "answer") {
  return snapshot(input, "waiting-human", {
    allowed_actions: ["answer", "pause", "stop"],
    required_actor: "human",
    next_action: nextAction,
    blockers: [...new Set([...(input.blockers ?? []), blocker].filter(Boolean))],
  });
}

/**
 * Derive lifecycle state from the artifact chain and opaque harness phase
 * status. The state machine never infers commands, tools, models or runners.
 */
export function deriveWorkflowState(input = {}) {
  const manualArtifacts = (input.snapshot_source ?? (input.run_id ? "harness-run" : "artifact-chain")) === "artifact-chain";
  if (terminalLifecycle.has(input.lifecycle)) return snapshot(input, input.lifecycle);
  if (input.lifecycle === "paused") return snapshot(input, "paused", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "resume" });
  if (input.lifecycle === "interrupted") return snapshot(input, "interrupted", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "reconcile-and-resume" });
  if (input.manual_context_incomplete) return snapshot(input, "waiting-human", { allowed_actions: ["provide-artifacts"], required_actor: "human", next_action: "provide-artifacts" });
  if (input.artifact_chain_valid === false || input.root_schema_valid === false) return snapshot(input, "replan", {
    allowed_actions: ["replan"],
    required_actor: "human",
    next_action: "create-schema-6-root",
    blockers: [...new Set([...(input.blockers ?? []), "schema-6-replan-required"])],
  });
  if ((input.blockers ?? []).length > 0 || input.lifecycle === "waiting-human") return waiting(input, null, input.next_action ?? "answer");
  if (!input.goal && !input.root_plan_id) return snapshot(input, "intake", { allowed_actions: ["provide-goal", "provide-root-plan"], required_actor: "human", next_action: "provide-intent" });
  if (input.material_open_decisions) return snapshot(input, "intent-clarification", { allowed_actions: ["answer", "replan"], required_actor: "human", next_action: "resolve-intent" });
  if (!input.root_plan_id || input.plan_status === "draft") return snapshot(input, "root-plan-review", { allowed_actions: ["inspect", "approve", "stop"], required_actor: "human", next_action: input.plan_status === "draft" ? "approve-plan" : "create-root-plan" });
  if (!input.plan_approved) return snapshot(input, "root-plan-review", { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" });
  if (!input.intent_ready) return snapshot(input, "replan", { allowed_actions: ["replan"], required_actor: "human", next_action: "replan", blockers: ["root-plan-not-intent-ready"] });
  if (input.harness_status === "failed" || input.phase_status === "failed") return snapshot(input, "blocked", {
    allowed_actions: ["inspect", "correct", "replan"],
    required_actor: "human",
    next_action: "inspect-failure",
    blockers: [...new Set([...(input.blockers ?? []), "harness-phase-failed"])],
  });
  if (input.harness_status === "unavailable" || input.phase_status === "unavailable") return snapshot(input, "waiting-human", {
    allowed_actions: ["retry", "replan", "stop"],
    required_actor: "human",
    next_action: "retry-or-replan",
    blockers: [...new Set([...(input.blockers ?? []), "harness-unavailable"])],
  });
  if (!input.execution_started && !input.phase && !input.delivery_status && !input.review) {
    return snapshot(input, "root-plan-review", { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" });
  }
  if (input.phase === "implement" && input.phase_status !== "complete") return snapshot(input, "implementing", { allowed_actions: ["pause", "stop"], required_actor: "harness", next_action: "complete-implementation" });
  if (input.phase === "correct" && input.phase_status !== "complete") return snapshot(input, "correcting", { allowed_actions: ["pause", "stop"], required_actor: "harness", next_action: "complete-correction" });
  if ((input.phase === "review" || input.execution_started) && !input.root_review_complete && !input.review) return snapshot(input, "reviewing", { allowed_actions: ["review", "pause", "stop"], required_actor: "reviewer", next_action: "review-root" });

  const nextAction = input.review?.next_action;
  if (nextAction === "clarify") return waiting(input, "review-requires-clarification", "answer");
  if (nextAction === "replan") return snapshot(input, "replan", { allowed_actions: ["replan"], required_actor: "human", next_action: "replan" });
  if (nextAction === "correct") return snapshot(input, "waiting-human", { allowed_actions: ["inspect", "correct", "replan"], required_actor: "human", next_action: "approve-correction" });
  if (nextAction === "retry-review") return snapshot(input, "reviewing", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "retry-review" });

  if (input.delivery_status === "provisional") {
    if (manualArtifacts && input.manual_acceptance === "provisional") return snapshot(input, "accepted-provisional", {
      allowed_actions: ["inspect"],
      acceptance_persisted: false,
      acceptance_basis_hash: input.acceptance_basis_hash ?? input.artifact_set_hash ?? null,
    });
    return snapshot(input, "delivery-ready-provisional", { allowed_actions: ["accept-provisional", "inspect"], required_actor: "human", next_action: "accept-provisional" });
  }
  if (input.delivery_status === "verified" && input.review?.assessment !== "achieved") return snapshot(input, "delivery-ready-verified", { allowed_actions: ["inspect", "review"], required_actor: "reviewer", next_action: "review-root" });
  if (input.review?.assessment !== "achieved") return snapshot(input, "reviewing", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "review-root" });
  return snapshot(input, "achieved", { allowed_actions: ["explain", "learn"] });
}

export const workflowStates = Object.freeze([...states]);
