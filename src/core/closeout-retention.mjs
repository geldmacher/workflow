/**
 * Compatibility facade over typed Manual closeout attestation.
 * Free-form [workflow-closeout-v1] prose is no longer accepted.
 */

import {
  PLAN_CLOSEOUT_ATTESTATION,
  formatPlanCloseoutAttestationFence,
  planCloseoutAttestationIssues,
  extractFinalImplementationStep,
} from "./manual-attestation.mjs";

/** @deprecated Use PLAN_CLOSEOUT_ATTESTATION / formatPlanCloseoutAttestationFence(). */
export const WORKFLOW_CLOSEOUT_MARKER = "yaml workflow-attestation";

/** @deprecated Use formatPlanCloseoutAttestationFence() or PLAN_CLOSEOUT_ATTESTATION. */
export const WORKFLOW_CLOSEOUT_DIRECTIVE_V1 = formatPlanCloseoutAttestationFence();

export {
  PLAN_CLOSEOUT_ATTESTATION,
  formatPlanCloseoutAttestationFence,
  extractFinalImplementationStep,
  planCloseoutAttestationIssues,
};

export function closeoutRetentionIssues(text, options = {}) {
  return planCloseoutAttestationIssues(text, options);
}

export function retainsExactCloseoutArtifact(text) {
  return planCloseoutAttestationIssues(text).length === 0;
}

export function hasNegatedCloseoutRetention(text) {
  return planCloseoutAttestationIssues(text).length > 0;
}

export function hasPositiveCloseoutRetention(text) {
  return planCloseoutAttestationIssues(text).length === 0;
}
