import {
  buildWorkflowAuthorityPlan,
  canonicalAuthorityRootText,
} from "../../src/core/workflow-authority-core.mjs";

export const planMarkdown = `# Adaptive retry delivery

Implement retry handling while preserving repository consistency and the declared authority boundary.

The implementation prompt may use arbitrary headings and prose. Its formatting is intentionally not part of Workflow authority.
`;

export function authorityCore(profile = "manual", overrides = {}) {
  const controlled = profile === "manual" ? {} : {
    max_active_minutes: 30,
    max_total_tokens: 100000,
    max_cost_usd: 25,
  };
  return {
    artifact: "work-plan",
    schema: 6,
    id: "wp-adaptive-retry",
    status: "ready",
    source: "$plan-work",
    profile,
    goal: "Implement adaptive retry handling without weakening repository consistency or authority boundaries.",
    acceptance: ["Retry behavior is implemented and repository consistency remains demonstrably intact."],
    non_goals: ["Do not deploy or publish."],
    constraints: ["Keep concrete execution choices outside Workflow core."],
    risk: "medium",
    hard_triggers: [],
    authority: {
      allowed_roots: ["src", "tests"],
      protected_paths: [".git", "**/.env*"],
      approval_required_paths: [".github"],
      dependencies: "deny",
      external_effects: "none",
      delivery: "repository-only",
      ...controlled,
    },
    verification: [{
      check_id: "CHECK-1",
      objectives: ["OBJ-1"],
      verification_intent: "Prove retry behavior and repository consistency with project-appropriate verification.",
      expected_evidence: "Repository evidence showing the acceptance outcome on the current snapshot.",
      required: true,
      evidence_class: "harness-verifiable",
      cost_class: "standard",
      prerequisites: ["Relevant implementation and test surfaces are available."],
    }],
    ...overrides,
  };
}

export function nativePlan(profile = "manual", overrides = {}) {
  return buildWorkflowAuthorityPlan(planMarkdown, authorityCore(profile, overrides)).root_plan;
}

export function rootPlan(profile = "manual", overrides = {}) {
  return canonicalAuthorityRootText(nativePlan(profile, overrides));
}

export function supportedCheck(checkId = "CHECK-1") {
  return {
    check_id: checkId,
    grade: "supported",
    observed: "The required behavior passed on the exact current repository snapshot.",
    evidence_hashes: ["a".repeat(64)],
    limitations: ["The observation is not protected and therefore remains supported rather than verified."],
  };
}

export function manualSupportedObservation(checkId = "CHECK-1") {
  return {
    check_id: checkId,
    grade: "supported",
    observed: "The required behavior passed on the exact current repository snapshot.",
    evidence_material: ["focused repository verification passed"],
    limitations: [],
  };
}

export function achievedReviewInput(overrides = {}) {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "achieved",
    assessment_summary: "The approved repository outcomes are achieved on the current snapshot.",
    snapshot_summary: "The exact repository snapshot was inspected read-only.",
    findings: [],
    open_points: [],
    ...overrides,
  };
}
