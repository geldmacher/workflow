import { createContentAddressedHandoffStore } from "./artifact-handoff.mjs";
import { buildWorkReview, persistWorkReview } from "./work-review-builder.mjs";
import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";

const NATIVE_AUDITOR_ROLES = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);

function exactById(entries, pluginRoot) {
  const byId = new Map();
  for (const [index, entry] of (entries ?? []).entries()) {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) throw new Error(`native Review artifact ${index + 1} requires exact text`);
    const inspected = inspectArtifactText(entry.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) throw new Error(`native Review artifact ${index + 1} is invalid: ${inspected.errors.join("; ")}`);
    const id = inspected.artifact.fields.id;
    const prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`native Review artifact ${id} conflicts with different immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...(entry.builder_provenance || entry.provenance ? { builder_provenance: entry.builder_provenance ?? entry.provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {}),
      ...(entry.legacy_review_recorded === true || prior?.legacy_review_recorded === true ? { legacy_review_recorded: true } : {}),
    });
  }
  return byId;
}

function containsRootEvidence(entries, rootPlanId, pluginRoot) {
  return [...entries.values()].some((entry) => {
    const fields = inspectArtifactText(entry.text, pluginRoot).artifact?.fields;
    return fields?.artifact === "delivery-evidence" && fields.root_plan_id === rootPlanId;
  });
}

function nativeReviewInput(reviewInput, hostObservedAuditorRoles) {
  if (reviewInput == null) return null;
  const observed = new Set(hostObservedAuditorRoles ?? []);
  for (const role of observed) {
    if (!NATIVE_AUDITOR_ROLES.has(role)) throw new Error(`native Review received unsupported host-observed auditor role ${role}`);
  }
  if (Array.isArray(reviewInput.auditor_reports)) {
    for (const report of reviewInput.auditor_reports) {
      if (NATIVE_AUDITOR_ROLES.has(report?.role) && !observed.has(report.role)) {
        throw new Error(`review_input.auditor_reports role ${report.role} has no host-observed native auditor completion`);
      }
    }
  }
  return reviewInput;
}

export function performNativeReview({
  rootPlanText,
  artifacts = [],
  reviewInput = null,
  boundaryReceipt = null,
  boundaryReceiptVerifier = null,
  hostObservedAuditorRoles = [],
  pluginRoot,
  handoffOptions = {},
}) {
  const root = inspectArtifactText(rootPlanText, pluginRoot);
  if (root.errors.length > 0 || root.artifact?.fields?.artifact !== "work-plan" || root.artifact.fields.schema !== 5) {
    throw new Error(`native Review requires the exact valid Schema-5 Root: ${root.errors.join("; ") || "not a work-plan"}`);
  }
  const supplied = exactById([{ label: root.artifact.fields.id, text: rootPlanText }, ...artifacts], pluginRoot);
  const taskHasEvidence = containsRootEvidence(supplied, root.artifact.fields.id, pluginRoot);
  let handoffStore = null;
  let cacheWarning = null;
  try {
    handoffStore = createContentAddressedHandoffStore(rootPlanText, pluginRoot, {
      ...handoffOptions,
      artifactSetOptions: boundaryReceiptVerifier ? { boundaryReceiptVerifier } : {},
    });
    if (!taskHasEvidence) {
      try {
        const context = handoffStore.context(root.artifact.fields.id, rootPlanText);
        const cached = exactById(context.artifacts, pluginRoot);
        for (const [id, entry] of cached) {
          const taskEntry = supplied.get(id);
          if (taskEntry && taskEntry.text !== entry.text) throw new Error(`cached artifact ${id} conflicts with task-local immutable bytes`);
          if (!taskEntry) supplied.set(id, entry);
        }
      } catch (error) {
        cacheWarning = `optional review cache was ignored: ${error.message}`;
      }
    }
  } catch (error) {
    cacheWarning = `optional review cache is unavailable: ${error.message}`;
  }

  let review = buildWorkReview({
    rootPlanText,
    artifacts: [...supplied.values()],
    reviewInput: nativeReviewInput(reviewInput, hostObservedAuditorRoles),
    boundaryReceipt,
    boundaryReceiptVerifier,
    pluginRoot,
  });
  if (taskHasEvidence && handoffStore && !review.duplicate) {
    try {
      const cachedReview = handoffStore.context(root.artifact.fields.id, rootPlanText).artifacts
        .find((entry) => entry.label === review.fields.id);
      if (cachedReview?.text === review.artifact
        && cachedReview.builder_provenance?.kind === "host-work-review-builder"
        && cachedReview.builder_provenance.review_input_hash === review.review_input_hash
        && cachedReview.builder_provenance.artifact_hash === review.artifact_hash) {
        review = { ...review, duplicate: true };
      }
    } catch (error) {
      cacheWarning = `optional review cache identity check was ignored: ${error.message}`;
    }
  }
  if (!handoffStore) {
    return {
      ...review,
      handoff_persisted: false,
      handoff_authoritative: false,
      handoff_error_code: "handoff-persist-failed",
      warning: `${cacheWarning}; task-local Review remains valid`,
    };
  }
  const persisted = persistWorkReview({ handoffStore, rootPlanText, artifacts: [...supplied.values()], review });
  return cacheWarning ? { ...persisted, warning: [cacheWarning, persisted.warning].filter(Boolean).join("; ") } : persisted;
}
