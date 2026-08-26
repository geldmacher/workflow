import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as z from "zod/v4";
import {
  defaultRoot,
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan,
} from "../../scripts/validate-artifact.source.mjs";
import { assertChangedPathAuthority } from "../core/manual-path-authority.mjs";
import { buildDeliveryEvidence } from "../controller/delivery-closeout.mjs";
import { deriveManualWorkflowSnapshot } from "../controller/manual-status.mjs";
import { buildWorkReview } from "../controller/work-review-builder.mjs";
import { reviewInputSchema } from "../mcp/review-input-contract.mjs";

const DETERMINISTIC_OBSERVED_AT = "1970-01-01T00:00:00.000Z";
const line = (maximum = 8_000) => z.string().min(1).max(maximum);
const artifactEntrySchema = z.strictObject({
  label: line(200),
  text: line(1_000_000),
});
const artifactEntriesSchema = z.array(artifactEntrySchema).max(256);

const validatePlanRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("validate-plan"),
  root_plan: line(1_000_000),
});

const repositoryObservationSchema = z.strictObject({
  schema: z.literal(1),
  kind: z.literal("unprotected-repository-observation"),
  repository_root: line(8_000),
  changed_paths: z.array(line(8_000)).max(20_000),
  snapshot_material: z.array(line(100_000)).min(1).max(2_000),
  limitations: z.array(line(8_000)).max(128),
});

const checkObservationSchema = z.strictObject({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  grade: z.enum(["supported", "partial", "unavailable", "failed"]),
  observed: line(8_000),
  evidence_material: z.array(line(100_000)).max(2_000),
  limitations: z.array(line(8_000)).max(128),
}).superRefine((value, context) => {
  if (value.grade !== "unavailable" && value.evidence_material.length === 0) {
    context.addIssue({ code: "custom", path: ["evidence_material"], message: `${value.grade} observations require evidence_material` });
  }
  if (["partial", "unavailable"].includes(value.grade) && value.limitations.length === 0) {
    context.addIssue({ code: "custom", path: ["limitations"], message: `${value.grade} observations require a concrete limitation` });
  }
});

const buildReviewRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("build-review"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
  review_input: reviewInputSchema,
  repository_observation: repositoryObservationSchema,
  check_observations: z.array(checkObservationSchema).max(512),
});

const statusRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("status"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
});

const acceptRequestSchema = z.strictObject({
  schema: z.literal(1),
  operation: z.literal("accept-provisional"),
  root_plan: line(1_000_000),
  artifacts: artifactEntriesSchema,
});

const schemas = Object.freeze({
  "validate-plan": validatePlanRequestSchema,
  "build-review": buildReviewRequestSchema,
  status: statusRequestSchema,
  "accept-provisional": acceptRequestSchema,
});

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function unique(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))];
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseRequest(operation, input) {
  const schema = schemas[operation];
  if (!schema) throw codedError("unsupported-operation", `Unsupported manual-workflow operation: ${operation}`);
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const location = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
  throw codedError("manual-input-invalid", `Closed Schema-1 ${operation} input is invalid${location}: ${issue?.message ?? "invalid input"}`);
}

function exactRoot(rootPlan, pluginRoot) {
  const inspected = inspectArtifactText(rootPlan, pluginRoot);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact.fields.schema !== 6) {
    throw codedError("schema-6-root-invalid", `An exact valid Schema-6 Root is required: ${inspected.errors.join("; ") || "input is not a work-plan"}`);
  }
  return inspected.artifact.fields;
}

function exactChain(rootPlan, artifacts, pluginRoot) {
  const rootFields = exactRoot(rootPlan, pluginRoot);
  const byId = new Map([[rootFields.id, { label: rootFields.id, text: rootPlan }]]);
  for (const entry of artifacts) {
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    const fields = inspected.artifact?.fields;
    if (inspected.errors.length > 0 || !fields?.id || fields.schema !== 6) {
      throw codedError("schema-6-chain-invalid", `Artifact ${entry.label} is not an exact valid Schema-6 artifact: ${inspected.errors.join("; ") || "unsupported artifact"}`);
    }
    const prior = byId.get(fields.id);
    if (prior && prior.text !== entry.text) throw codedError("artifact-bytes-conflict", `Artifact ${fields.id} has conflicting immutable bytes`);
    byId.set(fields.id, { label: fields.id, text: entry.text });
  }
  const entries = [...byId.values()];
  const chain = inspectArtifactSet(entries.map((entry) => [entry.label, entry.text]), pluginRoot);
  if (chain.errors.length > 0) throw codedError("schema-6-chain-invalid", `The exact Schema-6 chain is invalid: ${chain.errors.join("; ")}`);
  const fieldsById = new Map(entries.map((entry) => {
    const fields = inspectArtifactText(entry.text, pluginRoot).artifact.fields;
    return [fields.id, fields];
  }));
  const lineageRootIds = new Set();
  let cursor = rootFields.id;
  while (cursor && !lineageRootIds.has(cursor)) {
    lineageRootIds.add(cursor);
    cursor = fieldsById.get(cursor)?.predecessor_plan_id ?? null;
  }
  for (const fields of fieldsById.values()) {
    const related = fields.artifact === "work-plan"
      ? lineageRootIds.has(fields.id)
      : lineageRootIds.has(fields.root_plan_id);
    if (!related) throw codedError("foreign-artifact-chain", `Artifact ${fields.id} is foreign to current Root ${rootFields.id}`);
  }
  return { rootFields, entries, chain, tips: effectiveCliSummary(chain) };
}

function observationHashes(observation) {
  const canonicalRepositoryRoot = realpathSync(observation.repository_root);
  const normalized = stable({
    schema: observation.schema,
    kind: observation.kind,
    repository_root: canonicalRepositoryRoot,
    changed_paths: unique(observation.changed_paths).sort(),
    snapshot_material: observation.snapshot_material,
    limitations: unique(observation.limitations),
  });
  const workspaceBindingHash = sha256(stableJson({ repository_root: canonicalRepositoryRoot }));
  return {
    normalized,
    workspaceBindingHash,
    snapshotHash: sha256(stableJson({ ...normalized, workspace_binding_hash: workspaceBindingHash })),
  };
}

function checkEvidence(observations) {
  const ids = observations.map((entry) => entry.check_id);
  if (new Set(ids).size !== ids.length) throw codedError("check-observation-ambiguous", "Check observations must use unique Check IDs");
  return observations.map((entry) => ({
    check_id: entry.check_id,
    grade: entry.grade,
    observed: entry.observed,
    evidence_hashes: unique(entry.evidence_material.map(sha256)).sort(),
    limitations: unique([
      ...entry.limitations,
      "This Check is based on an unprotected Manual observation and cannot establish verified evidence.",
    ]),
  }));
}

function boundedLine(value, maximum = 1_900) {
  const source = String(value ?? "").trim();
  if (source.length <= maximum) return source;
  const suffix = " … [bounded]";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}

function authorityLimitedReviewInput(reviewInput, message) {
  const limitation = boundedLine(message);
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment) ? "partially-achieved" : reviewInput.assessment,
    recommended_action: "clarify",
    snapshot_assessment: "incomplete",
    snapshot_summary: boundedLine(`${reviewInput.snapshot_summary} ${limitation}`),
    missing_evidence: unique([...(reviewInput.missing_evidence ?? []), limitation]),
    correction: undefined,
  };
}

function authorityProjection(rootFields, changedPaths, repositoryRoot) {
  try {
    assertChangedPathAuthority(rootFields, changedPaths, repositoryRoot);
    return { authorizedPaths: unique(changedPaths).sort(), limitation: null };
  } catch (error) {
    const authorizedPaths = unique(changedPaths).filter((path) => {
      try {
        assertChangedPathAuthority(rootFields, [path], repositoryRoot);
        return true;
      } catch {
        return false;
      }
    }).sort();
    return {
      authorizedPaths,
      limitation: `Observed repository paths exceed the Root authority: ${String(error?.message ?? error)}`,
    };
  }
}

function findingLine(finding) {
  return `- [${finding.severity.toUpperCase()}] ${finding.key} — ${finding.evidence} Reasoning: ${finding.reasoning} Resolution: ${finding.resolution}.`;
}

function reviewPresentation({ rootFields, evidence, review, reviewInput, repositoryObservation, authorityLimitation }) {
  const findings = reviewInput.findings.map(findingLine);
  const limitations = unique([
    ...repositoryObservation.limitations,
    ...(authorityLimitation ? [authorityLimitation] : []),
    ...reviewInput.missing_evidence,
    ...(evidence.fields.check_evidence ?? []).flatMap((entry) => entry.limitations ?? []),
  ]);
  const checkLines = (evidence.fields.check_evidence ?? []).map((entry) => `- ${entry.check_id}: ${entry.grade} — ${entry.observed}`);
  const presentation = {
    schema: 1,
    kind: "manual-review-presentation",
    root_plan_id: rootFields.id,
    evidence_id: evidence.fields.id,
    review_id: review.fields.id,
    assessment: review.fields.assessment,
    delivery_status: review.fields.delivery_status,
    evidence_grade: evidence.fields.overall_grade,
    findings: reviewInput.findings,
    limitations,
    checks: evidence.fields.check_evidence,
    next_action: review.fields.next_action,
  };
  const humanOutput = [
    `## Workflow · ${review.fields.delivery_status}`,
    "### Quick decision",
    `- Repository outcome: ${reviewInput.assessment_summary}`,
    `- Evidence status: ${evidence.fields.overall_grade}; unprotected Manual observations cannot be verified.`,
    "### Findings",
    findings.length > 0 ? findings.join("\n") : "- None.",
    "### Checks",
    checkLines.length > 0 ? checkLines.join("\n") : "- No required Check observations were supplied.",
    "### Limitations",
    limitations.length > 0 ? limitations.map((entry) => `- ${entry}`).join("\n") : "- None.",
    "### Next step",
    `- Now: ${review.fields.next_action}`,
    "### Details",
    `Root ${rootFields.id}, Evidence ${evidence.fields.id}, and Review ${review.fields.id} are bound to snapshot ${evidence.fields.workspace_snapshot_hash}.`,
    "The machine artifacts below are the authoritative result; this presentation is derived from the same decision.",
  ].join("\n\n");
  return { presentation, humanOutput: `${humanOutput}\n` };
}

function planPresentation(result, rootPlan) {
  const state = result.feasible ? "ready" : "blocked";
  const blockers = result.blocking_issues.map((entry) => `- ${entry.message ?? entry.code ?? String(entry)}`);
  return [
    `## Workflow Plan · ${state}`,
    "### Quick decision",
    result.feasible ? "- The exact Schema-6 Root is valid and ready for separate human implementation approval." : "- The Root is not valid and must be corrected before implementation.",
    ...(blockers.length > 0 ? ["### Blockers", blockers.join("\n")] : []),
    "### Next step",
    `- Now: ${result.feasible ? "implement-plan" : "correct-plan"}`,
    "### Details",
    `Root bytes SHA-256: ${sha256(rootPlan)}`,
  ].join("\n\n") + "\n";
}

function statusPresentation(status, accepted = false) {
  const snapshot = status.snapshot;
  return [
    `## Workflow · ${snapshot.state}`,
    "### Quick decision",
    `- Manual state: ${snapshot.state}`,
    `- Delivery status: ${snapshot.delivery_status ?? "none"}`,
    `- Evidence grade: ${snapshot.evidence_grade ?? "none"}`,
    "### Next step",
    `- Now: ${snapshot.next_action}`,
    "### Details",
    accepted ? "The provisional acceptance is explicit, ephemeral, and not persisted." : "Status is derived only from the exact supplied Schema-6 artifact bytes.",
  ].join("\n\n") + "\n";
}

function validatePlan(request, pluginRoot) {
  const result = preflightRootPlan(request.root_plan, pluginRoot);
  return {
    schema: 1,
    kind: "manual-plan-validation",
    ok: result.feasible,
    root_plan_id: result.root_plan_id,
    root_content_hash: sha256(request.root_plan),
    result,
    human_output: planPresentation(result, request.root_plan),
    artifacts: [],
  };
}

function buildReview(request, pluginRoot) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const contract = executionContractFromArtifactText(request.root_plan, pluginRoot);
  if (contract.errors.length > 0) throw codedError("schema-6-root-invalid", `Root execution contract is invalid: ${contract.errors.join("; ")}`);
  const hashes = observationHashes(request.repository_observation);
  const authority = authorityProjection(exact.rootFields, hashes.normalized.changed_paths, hashes.normalized.repository_root);
  const effectiveReviewInput = authority.limitation
    ? authorityLimitedReviewInput(request.review_input, authority.limitation)
    : request.review_input;
  const localCheckEvidence = checkEvidence(request.check_observations);
  const evidenceTipId = exact.tips.evidence_tips[exact.rootFields.id] ?? null;
  const reviewTipId = exact.tips.review_tips[exact.rootFields.id] ?? null;
  const reviewTip = reviewTipId ? exact.chain.effective.get(reviewTipId) : null;
  const correctionPending = Boolean(
    evidenceTipId
    && reviewTip?.fields?.latest_evidence_id === evidenceTipId
    && reviewTip?.fields?.next_action === "correct"
    && reviewTip?.fields?.correction_id,
  );

  let evidence;
  let reviewArtifacts;
  let chainUpdate;
  if (!evidenceTipId || correctionPending) {
    evidence = buildDeliveryEvidence({
      rootPlanText: request.root_plan,
      artifacts: exact.entries,
      checkEvidence: localCheckEvidence,
      changedPaths: authority.authorizedPaths,
      effectiveProfile: "manual",
      harnessAttestations: [],
      enforceHarnessAttestations: true,
      workspaceBinding: hashes.workspaceBindingHash,
      workspaceSnapshotHash: hashes.snapshotHash,
      pluginRoot,
    });
    reviewArtifacts = [...exact.entries, { label: evidence.fields.id, text: evidence.artifact }];
    chainUpdate = "append";
  } else {
    const refreshBaseEntries = exact.entries.filter((entry) => ![evidenceTipId, reviewTipId].includes(entry.label));
    const candidate = buildDeliveryEvidence({
      rootPlanText: request.root_plan,
      artifacts: refreshBaseEntries,
      checkEvidence: localCheckEvidence,
      changedPaths: authority.authorizedPaths,
      effectiveProfile: "manual",
      harnessAttestations: [],
      enforceHarnessAttestations: true,
      workspaceBinding: hashes.workspaceBindingHash,
      workspaceSnapshotHash: hashes.snapshotHash,
      pluginRoot,
    });
    const existingEvidence = exact.entries.find((entry) => entry.label === evidenceTipId)?.text ?? null;
    if (existingEvidence === candidate.artifact) {
      evidence = { ...candidate, duplicate: true };
      reviewArtifacts = exact.entries;
      chainUpdate = "reuse";
    } else {
      evidence = candidate;
      reviewArtifacts = [...refreshBaseEntries, { label: candidate.fields.id, text: candidate.artifact }];
      chainUpdate = candidate.fields.representation === "delta" ? "replace-delta-suffix" : "replace-full-tip";
    }
  }

  const review = buildWorkReview({
    rootPlanText: request.root_plan,
    artifacts: reviewArtifacts,
    reviewInput: effectiveReviewInput,
    allowUnprovenancedReviews: true,
    pluginRoot,
  });
  const shown = reviewPresentation({
    rootFields: exact.rootFields,
    evidence,
    review,
    reviewInput: review.normalized_review_input,
    repositoryObservation: request.repository_observation,
    authorityLimitation: authority.limitation,
  });
  return {
    schema: 1,
    kind: "manual-review-result",
    ok: true,
    mode: "manual-local",
    root_plan_id: exact.rootFields.id,
    root_content_hash: sha256(request.root_plan),
    intent_hash: contract.authoritative_projection_hash,
    workspace_binding_hash: hashes.workspaceBindingHash,
    repository_snapshot_hash: hashes.snapshotHash,
    chain_update: chainUpdate,
    presentation: shown.presentation,
    human_output: shown.humanOutput,
    artifacts: [
      { artifact: "delivery-evidence", label: evidence.fields.id, text: evidence.artifact, artifact_hash: evidence.artifact_hash },
      { artifact: "work-review", label: review.fields.id, text: review.artifact, artifact_hash: review.artifact_hash },
    ],
  };
}

function deriveStatus(request, pluginRoot, manualAcceptance = null) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const status = deriveManualWorkflowSnapshot({
    rootPlanId: exact.rootFields.id,
    artifacts: exact.entries,
    pluginRoot,
    observedAt: DETERMINISTIC_OBSERVED_AT,
    manualAcceptance,
  });
  return {
    schema: 1,
    kind: manualAcceptance ? "manual-provisional-acceptance" : "manual-workflow-status",
    ok: true,
    accepted: manualAcceptance === "provisional",
    persisted: false,
    snapshot: status.snapshot,
    artifact_summary: status.artifact_summary,
    diagnostics: status.diagnostics,
    changed_paths: status.changed_paths,
    human_output: statusPresentation(status, manualAcceptance === "provisional"),
    artifacts: [],
  };
}

function acceptProvisional(request, pluginRoot) {
  const exact = exactChain(request.root_plan, request.artifacts, pluginRoot);
  const reviewTipId = exact.tips.review_tips[exact.rootFields.id] ?? null;
  const reviewTip = reviewTipId ? exact.chain.effective.get(reviewTipId) : null;
  const current = deriveStatus(request, pluginRoot);
  if (current.snapshot.delivery_status !== "provisional" || current.snapshot.next_action !== "accept-provisional") {
    const nextAction = reviewTip?.fields?.next_action ?? "provide-artifacts";
    const error = codedError("manual-acceptance-denied", `The current exact chain cannot be accepted provisionally; it requires ${nextAction}.`);
    error.nextAction = nextAction;
    throw error;
  }
  return deriveStatus(request, pluginRoot, "provisional");
}

function shadowError(operation, input, error) {
  const code = error?.code ?? "manual-workflow-failed";
  const message = String(error?.message ?? error);
  const nextAction = error?.nextAction
    ?? (operation === "validate-plan" ? "correct-plan" : ["status", "accept-provisional"].includes(operation) ? "provide-artifacts" : "retry-review");
  return {
    schema: 1,
    kind: "manual-workflow-error",
    ok: false,
    mode: "shadow",
    operation,
    error: { code, message },
    input_preserved: true,
    supplied_root_retained: typeof input?.root_plan === "string",
    supplied_artifact_count: Array.isArray(input?.artifacts) ? input.artifacts.length : 0,
    next_action: nextAction,
    human_output: `## Workflow · shadow\n\n### Quick decision\n\n- ${message}\n- No Schema-6 Evidence or Review artifact was created.\n\n### Next step\n\n- Now: ${nextAction}\n`,
    artifacts: [],
  };
}

export function executeManualOperation(operation, input, { pluginRoot = defaultRoot } = {}) {
  try {
    const request = parseRequest(operation, input);
    if (operation === "validate-plan") return validatePlan(request, pluginRoot);
    if (operation === "build-review") return buildReview(request, pluginRoot);
    if (operation === "status") return deriveStatus(request, pluginRoot);
    if (operation === "accept-provisional") return acceptProvisional(request, pluginRoot);
    throw codedError("unsupported-operation", `Unsupported manual-workflow operation: ${operation}`);
  } catch (error) {
    return shadowError(operation, input, error);
  }
}

export function serializeManualResult(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function main() {
  const operation = process.argv[2];
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch (error) {
    const result = shadowError(operation ?? "unknown", null, codedError("manual-json-invalid", `Manual input must be one JSON object: ${error.message}`));
    process.stdout.write(serializeManualResult(result));
    process.exitCode = 2;
    return;
  }
  const result = executeManualOperation(operation, input);
  process.stdout.write(serializeManualResult(result));
  if (!result.ok) process.exitCode = 2;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
