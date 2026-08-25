import * as z from "zod/v4";

const semanticKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const objectiveId = z.string().regex(/^OBJ-[1-9][0-9]*$/);
const checkId = z.string().regex(/^CHECK-[1-9][0-9]*$/);
const line = (max = 2_000) => z.string().min(1).max(max);

const finding = z.strictObject({
  key: semanticKey,
  severity: z.enum(["low", "medium", "high", "critical"]),
  objective_ids: z.array(objectiveId).min(1).max(64),
  check_ids: z.array(checkId).min(1).max(128),
  evidence: line(4_000),
  reasoning: line(4_000),
  resolution: z.enum(["correct", "clarify", "replan"]),
});

const correction = z.strictObject({
  fixes: z.array(z.strictObject({
    key: semanticKey,
    finding_keys: z.array(semanticKey).min(1).max(32),
    required_outcome: line(),
    evidence: line(),
  })).min(1).max(32),
  checks: z.array(z.strictObject({
    key: semanticKey,
    fix_keys: z.array(semanticKey).min(1).max(32),
    verification_intent: line(),
    expected_evidence: line(),
    evidence_class: z.enum(["harness-verifiable", "reviewer-observable", "human-decision-required"]),
    required: z.boolean(),
    cost_class: z.enum(["cheap", "standard", "expensive"]),
    prerequisites: z.array(line(1_000)).min(1).max(64),
  })).min(1).max(32),
  steps: z.array(z.strictObject({
    key: semanticKey,
    fix_keys: z.array(semanticKey).min(1).max(32),
    targets: z.array(line(1_000)).min(1).max(64),
    required_outcome: line(),
    implementation_latitude: line(),
    completion_probe: line(),
    check_keys: z.array(semanticKey).min(1).max(32),
    deviation_action: line(),
  })).min(1).max(32),
  learning_candidates: z.array(z.strictObject({
    key: semanticKey,
    finding_keys: z.array(semanticKey).min(1).max(32),
    reusable_guidance: line(),
    candidate_targets: z.array(line(1_000)).min(1).max(64),
    confirmation_evidence: line(),
  })).min(1).max(32),
});

export const reviewInputSchema = z.strictObject({
  schema: z.literal(1),
  kind: z.literal("review-input"),
  assessment: z.enum(["achieved", "provisional", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"]),
  recommended_action: z.enum(["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"]),
  assessment_summary: line(),
  snapshot_assessment: z.enum(["consistent", "contradicted", "incomplete"]),
  snapshot_summary: line(),
  findings: z.array(finding).max(32),
  missing_evidence: z.array(line()).max(32),
  correction: correction.optional(),
});

const malformedReviewInputCandidate = z.record(z.string().max(200), z.unknown())
  .refine((value) => Object.keys(value).length <= 32, "review_input recovery candidate exceeds 32 fields")
  .describe("Recovery-only malformed review_input object. The host-owned builder still requires the closed Schema-1 branch and never infers missing judgments.");

export const reviewInputTransportSchema = z.union([
  reviewInputSchema,
  malformedReviewInputCandidate,
]);
