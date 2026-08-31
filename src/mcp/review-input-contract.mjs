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
  resolution: z.enum(["correct", "open"]),
});

const openPoint = z.strictObject({
  key: semanticKey,
  type: z.enum(["evidence", "authority", "intent", "environment", "formal-binding", "no-progress"]),
  summary: line(),
  evidence: line(4_000),
  impact: line(),
  question: line(),
});

const correction = z.strictObject({
  fixes: z.array(z.strictObject({
    key: semanticKey,
    finding_keys: z.array(semanticKey).min(1).max(32),
    required_outcome: line(),
    evidence: line(),
  })).min(1).max(32),
  steps: z.array(z.strictObject({
    key: semanticKey,
    fix_keys: z.array(semanticKey).min(1).max(32),
    targets: z.array(line(1_000)).min(1).max(64),
    required_outcome: line(),
    implementation_latitude: line(),
    completion_probe: line(),
    root_check_ids: z.array(checkId).min(1).max(128),
    deviation_action: line(),
  })).min(1).max(32),
});

export const reviewInputSchema = z.strictObject({
  schema: z.literal(1),
  kind: z.literal("review-input"),
  outcome: z.enum(["achieved", "correction-needed", "open-points"]),
  assessment_summary: line(),
  snapshot_summary: line(),
  findings: z.array(finding).max(32),
  open_points: z.array(openPoint).max(32),
  correction: correction.optional(),
}).superRefine((value, context) => {
  const correctable = value.findings.filter((finding) => finding.resolution === "correct");
  if (value.outcome === "achieved" && (value.findings.length > 0 || value.open_points.length > 0 || value.correction)) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "achieved requires no findings, open points, or correction" });
  }
  if (value.outcome === "correction-needed" && (correctable.length === 0 || !value.correction)) {
    context.addIssue({ code: "custom", path: ["correction"], message: "correction-needed requires correctable findings and one correction" });
  }
  if (value.outcome === "open-points" && (value.open_points.length === 0 || correctable.length > 0 || value.correction)) {
    context.addIssue({ code: "custom", path: ["open_points"], message: "open-points requires open points and no pending correction" });
  }
});

const malformedReviewInputCandidate = z.record(z.string().max(200), z.unknown())
  .refine((value) => Object.keys(value).length <= 32, "review_input recovery candidate exceeds 32 fields")
  .describe("Recovery-only malformed review_input object. The host-owned builder still requires the closed Schema-1 branch and never infers missing judgments.");

export const reviewInputTransportSchema = z.union([
  reviewInputSchema,
  malformedReviewInputCandidate,
]);
