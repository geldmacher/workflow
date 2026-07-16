const riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });

export function evaluateExecutionState(state) {
  if ((state.argumentCount ?? 0) !== 0) return { action: "stop", reason: "arguments-not-allowed" };
  if (!Array.isArray(state.actionableReviewIds) || state.actionableReviewIds.length !== 1) {
    return { action: "stop", reason: state.actionableReviewIds?.length > 1 ? "ambiguous-actionable-review" : "missing-actionable-review" };
  }
  const [reviewId] = state.actionableReviewIds;
  if (state.latestReviewId !== reviewId) return { action: "stop", reason: "review-is-not-latest" };
  if (!state.chainValid) return { action: "stop", reason: "invalid-root-review-correction-chain" };
  if (state.baselineMatches === false && state.driftMaterial === true) return { action: "stop", reason: "material-repository-drift" };
  if ((riskRank[state.discoveredRisk] ?? 3) > (riskRank[state.rootRisk] ?? 0)) return { action: "stop", reason: "risk-floor-raised" };
  const stepStates = state.stepStates ?? [];
  if (stepStates.includes("conflicted")) return { action: "stop", reason: "conflicted-correction-step" };
  if (stepStates.length > 0 && stepStates.every((value) => value === "satisfied")) return { action: "verify-only", reason: "correction-already-satisfied" };
  if (stepStates.some((value) => !["satisfied", "pending", "partial"].includes(value))) return { action: "stop", reason: "invalid-step-state" };
  return { action: "proceed", reason: "correction-preflight-satisfied" };
}
