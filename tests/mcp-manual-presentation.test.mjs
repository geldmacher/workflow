import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  buildPresentation,
  formatChangedPaths,
  formatManualToolContent,
  isManualWorkflowTool,
  JOURNEY_STATE_LABELS,
  MANUAL_GUIDE_LABEL,
  MANUAL_GUIDE_URL,
  manualMcpResult,
  resetManualPresentationDedupe,
  statusPresentationOutcome,
} from "../src/mcp/manual-presentation.mjs";

const chatGolden = JSON.parse(readFileSync(join(defaultRoot, "tests", "fixtures", "manual-chat-golden.json"), "utf8"));

test("Manual presentation leads with outcome and next action without JSON content", () => {
  resetManualPresentationDedupe();
  const response = manualMcpResult("workflow_plan_preflight", {
    feasible: true,
    root_plan_id: "wp-adaptive-retry",
    blocking_issues: [],
    advisories: [],
    required_checks: ["CHECK-1"],
    deferred_checks: [],
  });
  assert.equal(response.isError, false);
  assert.match(response.content[0].text, /## Workflow · Plan ready/);
  assert.match(response.content[0].text, /Technical traceability[\s\S]*workflow_plan_preflight — ready/);
  assert.match(response.content[0].text, /What happened:/);
  assert.match(response.content[0].text, /### Next step/);
  assert.match(response.content[0].text, /- Now: Implement the Plan/);
  assert.match(response.content[0].text, /- How: Implement Plan/);
  assert.match(response.content[0].text, /- Why: Delivers inside the approved Root/);
  assert.doesNotMatch(response.content[0].text, /Off track:/);
  assert.doesNotMatch(response.content[0].text, /^\s*\{/);
  assert.equal(response.structuredContent.presentation.schema, 1);
  assert.equal(response.structuredContent.presentation.next_action, "implement-plan");
  assert.equal(response.structuredContent.presentation.journey_state, "plan-ready");
  assert.equal(response.structuredContent.presentation.enforcement_level, "explicit");
  assert.deepEqual(response.structuredContent.presentation.primary_action, {
    id: "implement-plan",
    label: "Implement the Plan",
    invoke: "Implement Plan",
    why: "Delivers inside the approved Root and runs deterministic closeout.",
  });
  assert.equal(response.structuredContent.presentation.technical_traceability.root_plan_id, "wp-adaptive-retry");
  assert.match(response.structuredContent.presentation.next_action_invoke, /Implement Plan/);
  assert.match(response.structuredContent.presentation.next_action_benefit, /closeout/);
  assert.equal(response.structuredContent.root_plan_id, "wp-adaptive-retry");
  assert.equal(response.structuredContent.feasible, true);
  assert.equal(isManualWorkflowTool("workflow_plan_preflight"), true);
  assert.equal(isManualWorkflowTool("workflow_prepare"), false);
});

test("Manual presentation keeps success compact and explains actionable receipt gaps", () => {
  const success = formatManualToolContent(buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-receipted",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: ["src/a.mjs"],
    constraint_summary: {
      receipt_coverage: { attested: 1, eligible: 1 },
      evidence_gap_checks: [],
    },
    human_attention: { required: false, reasons: [] },
    problem_details: [],
  }));
  assert.match(success, /host-attested machine Checks: 1\/1/);
  assert.doesNotMatch(success, /Human attention:|Problems:/);
  assert.match(success, /### Next step[\s\S]*Now: Review delivery/);

  const gap = formatManualToolContent(buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-gap",
    overall_grade: "supported",
    status: "provisional",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: ["src/a.mjs"],
    constraint_summary: {
      receipt_coverage: { attested: 0, eligible: 1 },
      evidence_gap_checks: ["CHECK-1"],
    },
    human_attention: {
      required: true,
      reasons: [{
        code: "evidence-gap",
        check_id: "CHECK-1",
        message: "CHECK-1 is not fully verified.",
        recovery: "Run `npm test` from repository root, then retry closeout.",
      }],
    },
    problem_details: [{
      problem: "CHECK-1 has no current host receipt.",
      why: "The current evidence cannot support a verified delivery claim.",
      resolution: "Run `npm test` from repository root, then retry closeout.",
      blocking: false,
    }],
  }));
  assert.match(gap, /What happened:/);
  assert.match(gap, /Human attention:[\s\S]*CHECK-1.*npm test/);
  assert.match(gap, /Problems:[\s\S]*Why: The current evidence cannot support a verified delivery claim/);
  assert.match(gap, /Resolution: Run `npm test` from repository root/);
  assert.match(gap, /### Next step[\s\S]*Now: Review delivery[\s\S]*Why:/);
  assert.match(gap, /Technical traceability[\s\S]*Problems:[\s\S]*npm test/);
  assert.doesNotMatch(gap, /Now: Deterministic closeout/);

  const legacy = formatManualToolContent(buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-legacy",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "full",
    handoff_persisted: true,
    changed_paths: ["src/a.mjs"],
    constraint_summary: {
      receipt_coverage: { attested: 0, eligible: 1 },
      evidence_gap_checks: ["CHECK-1"],
      legacy_unattested_verified_checks: ["CHECK-1"],
    },
    human_attention: { required: true, reasons: [] },
    problem_details: [],
  }));
  assert.match(legacy, /workflow_closeout — partial/);
  assert.match(legacy, /Now: Review delivery/);
  assert.match(legacy, /Legacy verified claims lack current host receipts/);
});

test("Next-step footer covers task-local closeout, optional handoff loss, and blocked status", () => {
  const readyCloseout = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-ready",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: ["src/a.mjs"],
  });
  const readyText = formatManualToolContent(readyCloseout);
  assert.match(readyText, /### Next step/);
  assert.match(readyText, /- Now: Review delivery/);
  assert.match(readyText, /- How: review-work/);
  assert.match(readyText, /- Why: Produces a fresh read-only verdict/);
  assert.doesNotMatch(readyText, /Off track:/);
  assert.equal(readyCloseout.next_action, "review-root");
  assert.match(readyCloseout.next_action_benefit, /fresh read-only verdict/);

  const unpersisted = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-attach",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: false,
    warning: "handoff cache unavailable; attach the returned artifact",
  });
  const attachText = formatManualToolContent(unpersisted);
  assert.equal(unpersisted.next_action, "review-root");
  assert.match(attachText, /Now: Review delivery/);
  assert.match(attachText, /task-local Evidence remains valid/i);
  assert.equal(unpersisted.next_action_blocked_reason, undefined);

  const blockedEvidence = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-blocked",
    overall_grade: "failed",
    status: "blocked",
    evidence_mode: "full",
    handoff_persisted: true,
  });
  const blockedText = formatManualToolContent(blockedEvidence);
  assert.equal(blockedEvidence.outcome, "blocked");
  assert.match(blockedText, /Action blocker: Evidence status blocked/);
  assert.match(blockedText, /- How: review-work/);
  assert.doesNotMatch(blockedText.split("<details>")[0], /correct-work|replan/);

  const status = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-x",
      state: "root-plan-review",
      next_action: "implement-plan",
      blockers: ["missing evidence"],
      latest_evidence_id: null,
      latest_review_id: null,
    },
  });
  const statusText = formatManualToolContent(status);
  assert.equal(status.outcome, "blocked");
  assert.equal(status.workflow_state, "root-plan-review");
  assert.match(statusText, /profile: manual/);
  assert.match(statusText, /required actor: unknown/);
  assert.match(statusText, /Blocker: missing evidence/);
  assert.match(statusText, /Resolution: Resolve blocking issues/);
  assert.match(statusText, /Action blocker: Delivery Evidence is not available yet/);
  assert.doesNotMatch(statusText.split("<details>")[0], /Implement Plan/);
  assert.match(status.next_action_invoke, /plan-work wp-x/);
});

test("Manual presentation separates blockers from advisories and warnings", () => {
  const blocked = buildPresentation("workflow_plan_preflight", {
    feasible: false,
    root_plan_id: "wp-x",
    blocking_issues: [{ message: "missing required check" }],
    advisories: [{ message: "expensive required check" }],
    required_checks: [],
  });
  assert.equal(blocked.outcome, "blocked");
  assert.deepEqual(blocked.gaps, ["missing required check"]);
  assert.deepEqual(blocked.advisories, ["expensive required check"]);

  const warning = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-x",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: false,
    warning: "handoff cache unavailable; attach the returned artifact",
  });
  assert.equal(warning.outcome, "ready");
  assert.equal(warning.next_action, "review-root");
  assert.match(warning.warnings.join("\n"), /attach the returned artifact/);
  assert.match(warning.advisories.join("\n"), /Task-local Evidence remains valid/);
  assert.equal(warning.gaps.length, 0);
  assert.doesNotMatch(formatManualToolContent(warning), /artifact: delivery-evidence/);
});

test("Manual presentation covers record, context, status, and error paths", () => {
  const recorded = buildPresentation("workflow_artifact_record", {
    recorded: ["wp-x"],
    duplicates: [],
    handoff_persisted: true,
    handoff_mode: "root-content-cache",
  });
  assert.equal(recorded.outcome, "ready");
  assert.equal(recorded.next_action, "implement-plan");
  assert.match(formatManualToolContent(recorded), /exact artifact chain is available/);
  assert.match(formatManualToolContent(recorded), /recorded: wp-x/);

  const recordedReview = buildPresentation("workflow_artifact_record", {
    recorded: ["wr-x"],
    duplicates: ["wp-x", "de-x"],
    handoff_persisted: true,
    handoff_mode: "root-content-cache",
  });
  const recordedReviewText = formatManualToolContent(recordedReview);
  assert.equal(recordedReview.next_action, "provide-artifacts");
  assert.match(recordedReviewText, /work-status/);
  assert.doesNotMatch(recordedReviewText, /Implement the Plan/);

  const unpersisted = buildPresentation("workflow_artifact_record", {
    recorded: [],
    duplicates: [],
    handoff_persisted: false,
    handoff_mode: "stateless",
    warning: "handoff cache unavailable",
  });
  assert.equal(unpersisted.outcome, "partial");
  assert.equal(unpersisted.next_action, "attach-artifact");

  const context = buildPresentation("workflow_artifact_context", {
    root_plan_id: "wp-x",
    artifacts: [{ label: "wp-x", text: "plan" }],
    evidence_tip: null,
    review_tip: null,
  });
  assert.equal(context.next_action, "review-root");
  assert.match(formatManualToolContent(context), /Review will attempt one internal Evidence recovery/);

  const withEvidence = buildPresentation("workflow_artifact_context", {
    root_plan_id: "wp-x",
    artifacts: [{ label: "wp-x", text: "plan" }, { label: "de-x", text: "evidence" }],
    evidence_tip: "de-x",
    review_tip: null,
  });
  assert.equal(withEvidence.next_action, "review-root");

  const status = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-x",
      state: "root-plan-review",
      next_action: "implement-plan",
      blockers: ["missing evidence"],
      latest_evidence_id: null,
      latest_review_id: null,
    },
    host_tool_approval: {
      tool_approval: "strict",
      source: "default",
      authoritative: false,
      grants_host_approval: false,
      host_allowlist_required: false,
    },
    model_inheritance: { status: "unavailable" },
  });
  assert.equal(status.outcome, "blocked");
  assert.match(formatManualToolContent(status), /missing evidence/);
  assert.match(formatManualToolContent(status), /host approvals: per-call prompts expected \(source: default\); Workflow grants none/);
  assert.doesNotMatch(formatManualToolContent(status), /\[object Object\]/);

  const failed = manualMcpResult("workflow_closeout", { error: "exact Root text is required" }, true);
  assert.equal(failed.isError, true);
  assert.equal(failed.structuredContent.presentation.outcome, "blocked");
  assert.equal(failed.structuredContent.presentation.next_action, "review-root");
  assert.match(failed.content[0].text, /exact Root text is required/);
  assert.match(failed.content[0].text, /- How: review-work/);
  assert.doesNotMatch(failed.content[0].text, /No further Workflow action/);

  const malformedReview = manualMcpResult("workflow_closeout", {
    error: "review_input.assessment achieved is more positive than review_input.auditor_reports delivery-auditor assessment not-achieved",
    error_code: "review-input-invalid",
  }, true);
  assert.equal(malformedReview.structuredContent.presentation.phase, "review");
  assert.equal(malformedReview.structuredContent.presentation.next_action, "retry-review");
  assert.match(malformedReview.content[0].text, /reviewer response could not be converted/i);
  assert.match(malformedReview.content[0].text, /Root, Evidence, Checks, and repository work remain unchanged/i);
  assert.match(malformedReview.content[0].text, /same task|this task/i);
  assert.doesNotMatch(malformedReview.content[0].text, /Repair the exact Root|Replan the Root/);

  const rejectedReview = manualMcpResult("workflow_artifact_record", {
    error: "new full model-authored work-review artifacts cannot establish authority; repeat Review in this task",
  }, true);
  assert.equal(rejectedReview.structuredContent.presentation.phase, "review");
  assert.equal(rejectedReview.structuredContent.presentation.next_action, "retry-review");
  assert.match(rejectedReview.content[0].text, /Remove the supplied work-review artifact/i);
  assert.doesNotMatch(rejectedReview.content[0].text, /outside the approved plan boundary|plan-work replan/i);

  const unknown = buildPresentation("workflow_unknown", { ok: true });
  assert.equal(unknown.outcome, "ready");
  assert.match(formatManualToolContent(unknown), /Workflow tool completed|\{"ok":true\}/);

  const coded = buildPresentation("workflow_plan_preflight", {
    feasible: false,
    root_plan_id: "wp-y",
    blocking_issues: [{ code: "missing-required-check" }, 42, "", null],
    advisories: "not-an-array",
    required_checks: ["CHECK-1"],
    deferred_checks: ["CHECK-2"],
  });
  assert.deepEqual(coded.gaps, ["missing-required-check", "42", "null"]);
  assert.deepEqual(coded.advisories, []);

  const emptyError = buildPresentation("workflow_closeout", {}, { isError: true });
  assert.equal(emptyError.outcome, "blocked");
  assert.equal(emptyError.next_action, "review-root");
  assert.match(emptyError.summary, /Workflow tool failed/);

  const otherFailed = buildPresentation("workflow_artifact_record", { error: "invalid artifact" }, { isError: true });
  assert.equal(otherFailed.outcome, "failed");
  assert.equal(otherFailed.next_action, "provide-artifacts");
  assert.doesNotMatch(formatManualToolContent(otherFailed), /### Done/);

  const preflightFailed = buildPresentation("workflow_plan_preflight", { error: "invalid Root" }, { isError: true });
  assert.equal(preflightFailed.next_action, "repair-root");
  assert.doesNotMatch(formatManualToolContent(preflightFailed), /### Done/);

  const readyCloseout = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-y",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "full",
    handoff_persisted: true,
    changed_paths: ["src/retry.mjs", "tests/retry.test.mjs"],
  });
  assert.equal(readyCloseout.outcome, "ready");
  assert.equal(readyCloseout.next_action, "review-root");
  assert.match(formatManualToolContent(readyCloseout), /changed paths \(2\): src\/retry\.mjs, tests\/retry\.test\.mjs/);

  const blockedCloseout = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-blocked",
    overall_grade: "failed",
    status: "blocked",
    evidence_mode: "full",
    handoff_persisted: true,
    changed_paths: ["src/retry.mjs"],
  });
  assert.equal(blockedCloseout.outcome, "blocked");
  assert.equal(blockedCloseout.next_action, "review-root");
  assert.match(blockedCloseout.summary, /Delivery is blocked/);
  assert.doesNotMatch(blockedCloseout.summary, /is ready/);
  assert.match(formatManualToolContent(blockedCloseout), /workflow_closeout — blocked/);
  assert.doesNotMatch(formatManualToolContent(blockedCloseout), /No further Workflow action/);

  const provisionalCloseout = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-partial",
    overall_grade: "supported",
    status: "provisional",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: [],
  });
  assert.equal(provisionalCloseout.outcome, "partial");
  assert.match(formatManualToolContent(provisionalCloseout), /changed paths: none/);

  const customAction = buildPresentation("workflow_status", {
    snapshot: { state: "delivery-ready", next_action: "accept-provisional", blockers: [] },
  });
  assert.equal(customAction.next_action_label, "Accept provisional delivery");
  assert.match(customAction.next_action_invoke, /accept-work provisional/);

  const fallbackAction = buildPresentation("workflow_status", {
    snapshot: { state: "unknown", next_action: "custom-next", blockers: [] },
  });
  assert.equal(fallbackAction.next_action_label, "custom-next");
});

test("status presentation maps terminal and actionable states honestly", () => {
  assert.equal(statusPresentationOutcome({ state: "delivery-ready-provisional", blockers: [] }), "partial");
  assert.equal(statusPresentationOutcome({ state: "root-review", blockers: [] }), "partial");
  assert.equal(statusPresentationOutcome({ state: "root-plan-review", blockers: [] }), "partial");
  assert.equal(statusPresentationOutcome({ state: "waiting-human", blockers: [] }), "partial");
  assert.equal(statusPresentationOutcome({ state: "replan", blockers: [] }), "partial");
  assert.equal(statusPresentationOutcome({ state: "achieved", blockers: [] }), "ready");
  assert.equal(statusPresentationOutcome({ state: "accepted-provisional", blockers: [] }), "ready");
  assert.equal(statusPresentationOutcome({ state: "stopped", blockers: [] }), "blocked");
  assert.equal(statusPresentationOutcome({ state: "achieved", blockers: ["x"] }), "blocked");

  const achieved = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-done",
      requested_profile: "manual",
      effective_profile: "manual",
      state: "achieved",
      required_actor: "none",
      next_action: "none",
      blockers: [],
      latest_evidence_id: "de-done",
      latest_review_id: "wr-done",
    },
  });
  const achievedText = formatManualToolContent(achieved);
  assert.equal(achieved.workflow_state, "achieved");
  assert.match(achievedText, /evidence: de-done/);
  assert.match(achievedText, /review: wr-done/);
  assert.match(achievedText, /### Done/);
  assert.equal(achieved.primary_action, null);
  assert.equal(achieved.journey_state, "done");
  assert.doesNotMatch(achievedText.split("<details>")[0], /\/learn-from-work|\/explain-work/);
  assert.doesNotMatch(achievedText, /- Now:|- How:|- Why:/);

  const accepted = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-provisional",
      requested_profile: "manual",
      effective_profile: "manual",
      state: "accepted-provisional",
      required_actor: "none",
      next_action: "none",
      blockers: [],
      latest_evidence_id: "de-provisional",
      latest_review_id: "wr-provisional",
    },
  });
  const acceptedText = formatManualToolContent(accepted);
  assert.match(acceptedText, /### Accepted provisionally/);
  assert.match(acceptedText, /not persisted/);
  assert.doesNotMatch(acceptedText, /### Done/);

  const downgraded = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-downgraded",
      requested_profile: "autonomous",
      effective_profile: "supervised",
      downgrade_reason: "qualification-missing",
      state: "delivery-ready-verified",
      required_actor: "human",
      next_action: "accept-verified",
      blockers: [],
    },
  });
  const downgradedText = formatManualToolContent(downgraded);
  assert.match(downgradedText, /profile: autonomous → supervised/);
  assert.match(downgradedText, /profile downgrade: autonomous → supervised \(qualification-missing\)/);
  assert.match(downgradedText, /required actor: human/);

  const manualTips = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-tips",
      requested_profile: "manual",
      effective_profile: "manual",
      state: "root-review",
      required_actor: "reviewer",
      next_action: "review-root",
      blockers: [],
      evidence_tip: "de-tip",
      review_tip: "wr-tip",
    },
  });
  assert.match(formatManualToolContent(manualTips), /evidence: de-tip/);
  assert.match(formatManualToolContent(manualTips), /review: wr-tip/);

  const provisional = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-x",
      state: "delivery-ready-provisional",
      next_action: "accept-provisional",
      blockers: [],
      latest_evidence_id: "de-x",
      latest_review_id: "wr-x",
    },
  });
  assert.equal(provisional.outcome, "partial");
  assert.match(formatManualToolContent(provisional), /workflow_status — partial/);

  const minimalAchieved = buildPresentation("workflow_status", {
    snapshot: { root_plan_id: "wp-x", state: "achieved", next_action: "none", blockers: [] },
  });
  assert.equal(minimalAchieved.outcome, "ready");
});

test("Manual status help is state-specific and remains in secondary technical traceability", () => {
  const presentation = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-help",
      requested_profile: "manual",
      effective_profile: "manual",
      snapshot_source: "artifact-chain",
      state: "root-plan-review",
      required_actor: "human",
      next_action: "implement-plan",
      blockers: [],
    },
  });
  assert.deepEqual(Object.keys(presentation.help), ["topic", "meaning", "label", "url"]);
  assert.equal(presentation.help.topic, "manual-state-root-plan-review");
  assert.equal(presentation.help.label, MANUAL_GUIDE_LABEL);
  assert.equal(presentation.help.url, `${MANUAL_GUIDE_URL}#root-plan-review`);
  const text = formatManualToolContent(presentation);
  assert.equal((text.match(/^Meaning:/gm) ?? []).length, 1);
  assert.equal((text.match(/^Learn more:/gm) ?? []).length, 1);
  assert.ok(text.indexOf("Meaning:") > text.indexOf("### Next step"));
  assert.ok(text.indexOf("Learn more:") > text.indexOf("### Next step"));
  assert.ok(text.indexOf("Meaning:") > text.indexOf("Technical traceability"));
  assert.match(text, /### Next step[\s\S]*- Now: Implement the Plan/);

  const achieved = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-help",
      snapshot_source: "artifact-chain",
      state: "achieved",
      required_actor: "none",
      next_action: "none",
      blockers: [],
    },
  });
  const achievedText = formatManualToolContent(achieved);
  assert.ok(achievedText.indexOf("Learn more:") > achievedText.indexOf("### Done"));
  assert.match(achievedText, /### Done\nRepository delivery is complete/);

  const accepted = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-help",
      snapshot_source: "artifact-chain",
      state: "accepted-provisional",
      required_actor: "none",
      next_action: "none",
      blockers: [],
    },
  });
  const acceptedText = formatManualToolContent(accepted);
  assert.ok(acceptedText.indexOf("Learn more:") > acceptedText.indexOf("### Accepted provisionally"));
  assert.match(acceptedText, /### Accepted provisionally\nThis one-time acceptance/);
});

test("unknown Manual states fall back safely while controller states receive no Manual semantics", () => {
  const unknown = buildPresentation("workflow_status", {
    snapshot: {
      root_plan_id: "wp-future",
      snapshot_source: "artifact-chain",
      state: "future-manual-state",
      next_action: "custom-next",
      blockers: [],
    },
  });
  assert.equal(unknown.help.topic, "manual-states");
  assert.equal(unknown.help.url, `${MANUAL_GUIDE_URL}#manual-states`);
  assert.doesNotMatch(unknown.help.meaning, /future-manual-state/);

  const controller = buildPresentation("workflow_status", {
    snapshot: {
      run_id: "run-controller",
      root_plan_id: "wp-controller",
      requested_profile: "supervised",
      effective_profile: "supervised",
      snapshot_source: "controller-run",
      state: "delivery-ready-verified",
      next_action: "accept-verified",
      blockers: [],
    },
  });
  assert.equal(controller.help, undefined);
  assert.doesNotMatch(formatManualToolContent(controller), /Meaning:|Learn more:/);
});

test("exceptional closeout, handoff, preflight, and error results select one relevant help topic", () => {
  const supported = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-supported",
    overall_grade: "supported",
    status: "provisional",
    handoff_persisted: true,
    changed_paths: [],
  });
  assert.equal(supported.help.topic, "manual-evidence-supported");
  assert.equal(supported.help.url, `${MANUAL_GUIDE_URL}#supported`);

  const attach = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-attach",
    overall_grade: "verified",
    status: "complete",
    handoff_persisted: false,
    changed_paths: [],
  });
  assert.equal(attach.help.topic, "artifacts-tips-and-handoff");

  const infeasible = buildPresentation("workflow_plan_preflight", {
    feasible: false,
    root_plan_id: "wp-blocked",
    blocking_issues: ["missing acceptance"],
    advisories: [],
    required_checks: [],
    deferred_checks: [],
  });
  assert.equal(infeasible.help.topic, "intent-root-and-plan");

  const feasible = buildPresentation("workflow_plan_preflight", {
    feasible: true,
    root_plan_id: "wp-ready",
    blocking_issues: [],
    advisories: [],
    required_checks: ["CHECK-1"],
    deferred_checks: [],
  });
  assert.equal(feasible.help, undefined);

  const failed = buildPresentation("workflow_artifact_record", { error: "invalid artifact" }, { isError: true });
  assert.equal(failed.help.topic, "recovery-and-troubleshooting");
  const failedText = formatManualToolContent(failed);
  assert.equal((failedText.match(/^Learn more:/gm) ?? []).length, 1);
  assert.ok(failedText.indexOf("Learn more:") > failedText.indexOf("### Next step"));
});

test("two-layer chat exposes one primary action, keeps IDs secondary, and derives a stable deduplication key", () => {
  const value = {
    snapshot: {
      root_plan_id: "wp-chat",
      snapshot_source: "artifact-chain",
      state: "root-review",
      required_actor: "reviewer",
      next_action: "review-root",
      blockers: [],
      evidence_tip: "de-chat",
      review_tip: null,
    },
  };
  const first = buildPresentation("workflow_status", value);
  const second = buildPresentation("workflow_status", value);
  assert.equal(first.journey_state, "review-ready");
  assert.equal(first.primary_action.id, "review-root");
  assert.equal(first.deduplication_key, second.deduplication_key);
  const text = formatManualToolContent(first);
  const primary = text.split("<details>")[0];
  assert.equal((primary.match(/^- Now:/gm) ?? []).length, 1);
  assert.match(primary, /- How: review-work wp-chat/);
  assert.doesNotMatch(primary.replace(/- How:.*\n/, ""), /wp-chat|de-chat|workflow_status|MCP|```yaml/);
  assert.match(text, /Technical traceability[\s\S]*Root: wp-chat[\s\S]*Evidence: de-chat/);
  const normalized = buildPresentation("workflow_status", {
    ...value,
    enforcement_level: "unsupported-value",
  });
  assert.equal(normalized.enforcement_level, "explicit");
  const changed = buildPresentation("workflow_status", {
    snapshot: { ...value.snapshot, state: "replan", next_action: "replan" },
  });
  assert.notEqual(first.deduplication_key, changed.deduplication_key);
});

test("Manual presentation coalesces repeated root updates and re-emits new Evidence", () => {
  resetManualPresentationDedupe();
  const first = manualMcpResult("workflow_closeout", {
    root_plan_id: "wp-coalesce",
    delivery_evidence_id: "de-coalesce-1",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: [],
  });
  assert.equal(first.content.length, 1);
  const duplicateAcrossTool = manualMcpResult("workflow_status", {
    snapshot: {
      root_plan_id: "wp-coalesce",
      snapshot_source: "artifact-chain",
      state: "root-review",
      required_actor: "reviewer",
      next_action: "review-root",
      blockers: [],
      evidence_tip: "de-coalesce-1",
      review_tip: null,
    },
  });
  assert.equal(duplicateAcrossTool.content.length, 0);
  assert.equal(duplicateAcrossTool.structuredContent.presentation.update_suppressed, true);
  const newEvidence = manualMcpResult("workflow_status", {
    snapshot: {
      ...duplicateAcrossTool.structuredContent.snapshot,
      evidence_tip: "de-coalesce-2",
    },
  });
  assert.equal(newEvidence.content.length, 1);
  assert.equal(newEvidence.structuredContent.presentation.update_suppressed, false);
});

test("golden chat matrix covers every journey state, one action, terminal Done, and technical fallback", () => {
  const expectedStates = [
    "plan-ready",
    "implementation-active",
    "closeout-recovery-required",
    "review-ready",
    "review-active",
    "correction-approval-required",
    "replan-approval-required",
    "provisional-acceptance-required",
    "clarification-required",
    "blocked",
    "done",
  ];
  assert.deepEqual(chatGolden.map((entry) => entry.state), expectedStates);
  for (const entry of chatGolden) {
    const action = entry.action ?? "none";
    const presentation = entry.state === "plan-ready"
      ? buildPresentation("workflow_plan_preflight", {
        feasible: true,
        root_plan_id: "wp-golden-chat",
        blocking_issues: [],
        advisories: [],
        required_checks: ["CHECK-1"],
        deferred_checks: [],
      })
      : entry.state === "review-ready"
        ? buildPresentation("workflow_closeout", {
          root_plan_id: "wp-golden-chat",
          delivery_evidence_id: "de-golden-chat",
          overall_grade: "verified",
          status: "complete",
          handoff_persisted: true,
          changed_paths: [],
        })
        : buildPresentation("workflow_status", {
            snapshot: {
              root_plan_id: "wp-golden-chat",
              snapshot_source: "artifact-chain",
              state: entry.state === "done" ? "achieved" : entry.state,
              journey_state: entry.state,
              required_actor: entry.state === "done" ? "none" : "human",
              next_action: action,
              blockers: entry.blocker ? [entry.blocker] : [],
              evidence_tip: entry.state === "done" ? "de-golden-chat" : null,
              review_tip: entry.state === "done" ? "wr-golden-chat" : null,
            },
        });
    assert.equal(presentation.journey_state, entry.state);
    assert.equal(presentation.outcome, entry.outcome);
    const disclosure = formatManualToolContent(presentation);
    const fallback = formatManualToolContent(presentation, { technicalDisclosure: false });
    const primary = disclosure.split("<details>")[0];
    assert.match(primary, new RegExp(`Workflow · ${JOURNEY_STATE_LABELS[entry.state]}`));
    assert.doesNotMatch(primary.replace(/- How:.*\n/, ""), /wp-golden-chat|```yaml|workflow_(?:closeout|status)|MCP/);
    assert.match(fallback, /\n---\n\n### Technical traceability\n/);
    if (entry.action) {
      assert.equal(presentation.primary_action.id, entry.action);
      assert.equal((primary.match(/^- Now:/gm) ?? []).length, 1);
      assert.doesNotMatch(primary, /### Done/);
    } else {
      assert.equal(presentation.primary_action, null);
      assert.match(primary, /### Done/);
      assert.equal((primary.match(/^- Now:/gm) ?? []).length, 0);
    }
    if (entry.outcome === "blocked") assert.doesNotMatch(primary, /complete and verified|Delivery is complete/);
    else assert.doesNotMatch(primary, /Workflow is blocked/);
  }
});

test("changed path rendering stays bounded while preserving count", () => {
  assert.equal(formatChangedPaths([]), "changed paths: none");
  assert.equal(formatChangedPaths(["a.mjs", "b.mjs"]), "changed paths (2): a.mjs, b.mjs");
  const many = Array.from({ length: 50 }, (_, index) => `src/path-${index}.mjs`);
  const rendered = formatChangedPaths(many);
  assert.match(rendered, /changed paths \(50, showing 10\):/);
  assert.match(rendered, /\(\+40 more\)/);
  assert.equal(rendered.includes("src/path-11.mjs"), false);

  const closeout = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-many",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: many,
  });
  assert.match(closeout.checks.join("\n"), /changed paths \(50, showing 10\)/);
  assert.doesNotMatch(formatManualToolContent(closeout), /src\/path-11\.mjs/);

  const response = manualMcpResult("workflow_closeout", {
    delivery_evidence_id: "de-many",
    overall_grade: "verified",
    status: "complete",
    evidence_mode: "lean",
    handoff_persisted: true,
    changed_paths: many,
  });
  assert.equal(response.structuredContent.changed_paths.length, 50);
  assert.equal(response.structuredContent.changed_paths[11], "src/path-11.mjs");
  assert.doesNotMatch(response.content[0].text, /src\/path-11\.mjs/);
});

test("blocked closeout with unpersisted handoff still routes to review", () => {
  const blocked = buildPresentation("workflow_closeout", {
    delivery_evidence_id: "de-fail",
    overall_grade: "failed",
    status: "blocked",
    evidence_mode: "lean",
    handoff_persisted: false,
    warning: "handoff cache unavailable",
    changed_paths: ["src/a.mjs"],
  });
  assert.equal(blocked.outcome, "blocked");
  assert.equal(blocked.next_action, "review-root");
  assert.match(blocked.gaps.join("\n"), /blocks delivery acceptance/);
  assert.doesNotMatch(blocked.gaps.join("\n"), /Attach the returned Evidence/);
});

test("legacy MCP text flag restores JSON content", () => {
  const previous = process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT;
  process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT = "1";
  try {
    const response = manualMcpResult("workflow_status", { snapshot: { state: "root-plan-review", next_action: "implement-plan" } });
    assert.match(response.content[0].text, /^\{\s*"snapshot"/);
    assert.doesNotMatch(response.content[0].text, /Meaning:|Learn more:/);
    assert.equal(response.structuredContent.presentation, undefined);
  } finally {
    if (previous === undefined) delete process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT;
    else process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT = previous;
  }
});
