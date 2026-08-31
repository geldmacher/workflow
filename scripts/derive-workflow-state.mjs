const states = new Set(["root-ready", "review-needed", "correction-needed", "achieved", "open-points", "shadow-review"]);

function snapshot(input, state, overrides = {}) {
  if (!states.has(state)) throw new Error(`unsupported workflow state ${state}`);
  return {
    run_id: input.run_id ?? null,
    root_plan_id: input.root_plan_id ?? null,
    requested_profile: input.requested_profile ?? "manual",
    effective_profile: input.effective_profile ?? input.requested_profile ?? "manual",
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
    qualification_key: input.qualification_key ?? null,
    artifact_set_hash: input.artifact_set_hash ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Derive the small human-facing Workflow state. Harness availability and
 * retries remain implementation detail and never become extra human gates.
 */
export function deriveWorkflowState(input = {}) {
  if (input.manual_context_incomplete || input.artifact_chain_valid === false || input.root_schema_valid === false) {
    return snapshot(input, "shadow-review", {
      allowed_actions: ["human-assessment"],
      required_actor: "human",
      next_action: "human-assessment",
    });
  }
  if (!input.root_plan_id) {
    return snapshot(input, "shadow-review", {
      allowed_actions: ["human-assessment"],
      required_actor: "human",
      next_action: "human-assessment",
    });
  }
  if (!input.execution_started && !input.review) {
    return snapshot(input, "root-ready", {
      allowed_actions: ["implement"],
      required_actor: "human",
      next_action: "implement-plan",
    });
  }
  if (input.correction_evidence_pending_review || !input.review) {
    return snapshot(input, "review-needed", {
      allowed_actions: ["review"],
      required_actor: "human",
      next_action: "review-work",
    });
  }
  if (input.review.outcome === "correction-needed") {
    return snapshot(input, "correction-needed", {
      allowed_actions: ["correct"],
      required_actor: "human",
      next_action: "correct",
    });
  }
  if (input.review.outcome === "open-points") {
    return snapshot(input, "open-points", {
      allowed_actions: ["human-assessment"],
      required_actor: "human",
      next_action: "human-assessment",
    });
  }
  if (input.review.outcome === "achieved") return snapshot(input, "achieved", { allowed_actions: ["explain", "learn"] });
  return snapshot(input, "review-needed", {
    allowed_actions: ["review"],
    required_actor: "human",
    next_action: "review-work",
  });
}

export const workflowStates = Object.freeze([...states]);
