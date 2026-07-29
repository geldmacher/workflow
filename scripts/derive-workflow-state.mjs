const states = new Set([
  "intake", "intent-clarification", "root-plan-review", "intent-ready", "product-aligned",
  "architecture-aligned", "program-design-aligned", "slice-ready", "implementing",
  "host-verifying", "slice-review", "root-review", "delivery-ready", "waiting-human",
  "replan", "achieved", "paused", "interrupted", "stopped", "failed",
]);

const terminalLifecycle = new Set(["stopped", "failed"]);

function snapshot(input, state, overrides = {}) {
  if (!states.has(state)) throw new Error(`unsupported workflow state ${state}`);
  const snapshotSource = input.snapshot_source ?? (input.run_id ? "controller-run" : "artifact-chain");
  return {
    run_id: input.run_id ?? null,
    root_plan_id: input.root_plan_id ?? null,
    requested_profile: input.requested_profile ?? "manual",
    effective_profile: input.effective_profile ?? input.requested_profile ?? "manual",
    design_depth: input.design_depth ?? null,
    compatibility: input.compatibility ?? "compatible",
    state,
    snapshot_source: snapshotSource,
    allowed_actions: [],
    required_actor: "none",
    next_action: "none",
    evidence_tip: input.evidence_tip ?? null,
    review_tip: input.review_tip ?? null,
    blockers: [...new Set(input.blockers ?? [])],
    downgrade_reason: input.downgrade_reason ?? null,
    revision: input.revision ?? (snapshotSource === "artifact-chain" ? null : 0),
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
 * Derive the semantic Workflow state from immutable artifacts, run events and
 * current repository observations. The return value is never persisted as a
 * repository artifact.
 */
export function deriveWorkflowState(input = {}) {
  const manualArtifacts = input.snapshot_source === "artifact-chain";
  if (terminalLifecycle.has(input.lifecycle)) return snapshot(input, input.lifecycle, { required_actor: "none" });
  if (input.lifecycle === "paused") return snapshot(input, "paused", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "resume" });
  if (input.lifecycle === "interrupted") return snapshot(input, "interrupted", { allowed_actions: ["resume", "stop"], required_actor: "human", next_action: "reconcile-and-resume" });
  if (manualArtifacts && input.manual_context_incomplete) return snapshot(input, "waiting-human", {
    allowed_actions: ["provide-artifacts"],
    required_actor: "human",
    next_action: "provide-artifacts",
  });
  if (input.artifact_chain_valid === false) return snapshot(input, "replan", {
    allowed_actions: manualArtifacts ? ["replan"] : ["replan", "stop"],
    required_actor: "human",
    next_action: manualArtifacts ? "replan" : "create-schema-3-root",
  });
  if (input.downgrade_pending) return waiting(input, input.downgrade_reason ?? "profile-downgrade-requires-approval", "approve-downgrade");
  if ((input.blockers ?? []).length > 0 || input.lifecycle === "waiting-human") return waiting(input, null, input.next_action ?? "answer");
  if (!input.goal && !input.root_plan_id) return snapshot(input, "intake", { allowed_actions: ["provide-goal", "provide-root-plan"], required_actor: "human", next_action: "provide-intent" });
  if (input.material_open_decisions) return snapshot(input, "intent-clarification", { allowed_actions: manualArtifacts ? ["answer", "replan"] : ["answer", "stop"], required_actor: "human", next_action: "resolve-intent" });
  if (!input.root_plan_id || input.plan_status === "draft") return snapshot(input, "root-plan-review", { allowed_actions: ["inspect", "approve", "stop"], required_actor: input.plan_status === "draft" ? "human" : "planner", next_action: input.plan_status === "draft" ? "approve-plan" : "create-root-plan" });
  if (!input.plan_approved) return snapshot(input, "root-plan-review", manualArtifacts
    ? { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" }
    : { allowed_actions: ["inspect", "approve", "stop"], required_actor: "human", next_action: "approve-plan" });
  if (!input.intent_ready) return snapshot(input, "replan", { allowed_actions: ["replan", "stop"], required_actor: "human", next_action: "replan", blockers: ["root-plan-not-intent-ready"] });

  const depth = input.design_depth;
  if (input.root_schema_valid === false || !["oneshot", "compact", "full"].includes(depth)) return snapshot(input, "replan", {
    allowed_actions: ["replan", "stop"],
    required_actor: "human",
    next_action: "create-schema-3-root",
    blockers: [input.root_schema_valid === false ? "invalid-schema-3-root" : "missing-or-invalid-design-depth"],
  });
  if (depth !== "oneshot" && !input.product_aligned) return snapshot(input, "intent-ready", { allowed_actions: ["align-product", "replan"], required_actor: "planner", next_action: "align-product" });
  if (["compact", "full"].includes(depth) && !input.architecture_aligned) return snapshot(input, "product-aligned", { allowed_actions: ["align-architecture", "replan"], required_actor: "planner", next_action: "align-architecture" });
  if (depth === "full" && !input.program_design_aligned) return snapshot(input, "architecture-aligned", { allowed_actions: ["align-program-design", "replan"], required_actor: "planner", next_action: "align-program-design" });
  if (depth === "full" && !input.slices_ready) return snapshot(input, "program-design-aligned", { allowed_actions: ["prepare-slices", "replan"], required_actor: "planner", next_action: "prepare-slices" });

  if (!input.execution_started) return snapshot(input, manualArtifacts ? "root-plan-review" : "slice-ready", manualArtifacts
    ? { allowed_actions: ["inspect", "implement", "replan"], required_actor: "human", next_action: "implement-plan" }
    : { allowed_actions: ["implement", "pause", "stop"], required_actor: "writer", next_action: "implement-slice" });
  if (input.phase === "implementing") return snapshot(input, "implementing", { allowed_actions: ["pause", "stop"], required_actor: "writer", next_action: "finish-slice" });
  if (input.phase === "host-verifying") return snapshot(input, "host-verifying", { allowed_actions: ["pause", "stop"], required_actor: "controller", next_action: "verify-slice" });
  if (input.phase === "slice-review") return snapshot(input, "slice-review", { allowed_actions: ["pause", "stop"], required_actor: "reviewer", next_action: "review-slice" });

  const nextAction = input.review?.next_action;
  if (manualArtifacts && input.correction_evidence_pending_review) return snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "review-root" });
  if (nextAction === "clarify") return manualArtifacts
    ? snapshot(input, "waiting-human", { allowed_actions: ["answer", "replan"], required_actor: "human", next_action: "answer", blockers: [...new Set([...(input.blockers ?? []), "review-requires-clarification"])] })
    : waiting(input, "review-requires-clarification", "answer");
  if (nextAction === "replan") return snapshot(input, "replan", { allowed_actions: manualArtifacts ? ["replan"] : ["replan", "stop"], required_actor: "human", next_action: "replan" });
  if (nextAction === "correct") return manualArtifacts
    ? snapshot(input, "waiting-human", { allowed_actions: ["inspect", "correct", "replan"], required_actor: "human", next_action: "approve-correction" })
    : snapshot(input, "slice-review", { allowed_actions: ["correct", "pause", "stop"], required_actor: "writer", next_action: "correct" });
  if (nextAction === "retry-review") return manualArtifacts
    ? snapshot(input, "root-review", { allowed_actions: ["review"], required_actor: "reviewer", next_action: "retry-review" })
    : snapshot(input, "slice-review", { allowed_actions: ["retry-review", "pause", "stop"], required_actor: "reviewer", next_action: "retry-review" });
  if (input.more_slices) return snapshot(input, "slice-ready", { allowed_actions: ["implement", "pause", "stop"], required_actor: "writer", next_action: "implement-next-slice" });
  if (!input.root_review_complete) return snapshot(input, "root-review", { allowed_actions: manualArtifacts ? ["review"] : ["review", "pause", "stop"], required_actor: "reviewer", next_action: "review-root" });
  if (input.review?.assessment !== "achieved") return snapshot(input, "replan", { allowed_actions: ["replan", "stop"], required_actor: "human", next_action: "replan", blockers: ["root-review-not-achieved"] });
  if (input.effective_profile === "auto-gated" && !input.delivery_accepted) return snapshot(input, "delivery-ready", { allowed_actions: ["accept", "inspect", "stop"], required_actor: "human", next_action: "accept-delivery" });
  return snapshot(input, "achieved", { allowed_actions: ["explain", "learn"], required_actor: "human", next_action: "none" });
}

export const workflowStates = Object.freeze([...states]);
