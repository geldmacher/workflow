import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPresentation,
  coalesceManualPresentation,
  formatManualToolContent,
  isManualWorkflowTool,
  manualMcpResult,
  resetManualPresentationDedupe,
} from "../src/mcp/manual-presentation.mjs";

test("Manual presentation is human-first and keeps technical traceability", () => {
  const value = {
    feasible: true,
    root_plan_id: "wp-v6",
    blocking_issues: [],
  };
  const presentation = buildPresentation("workflow_plan_preflight", value, { clientHost: "codex" });
  assert.equal(presentation.workflow_state, "root-plan-review");
  assert.equal(presentation.primary_action.id, "implement-plan");
  const text = formatManualToolContent(presentation);
  assert.match(text, /### Quick decision/);
  assert.match(text, /### Next step/);
  assert.match(text, /Implement Plan/);
  assert.match(text, /Agent and machine contract \(authoritative\)/);
  assert.match(text, /Concrete execution remains owned by the active project harness/);
});

test("provisional Review exposes limitations without inventing failure or success", () => {
  const response = manualMcpResult("workflow_closeout", {
    artifact_kind: "work-review",
    root_plan_id: "wp-v6",
    delivery_status: "provisional",
    assessment: "provisional",
    harness_mode: "shadow",
    harness_status: "unavailable",
    harness_limitations: ["No compatible project harness capability was available."],
    check_evidence: [{ check_id: "CHECK-1", grade: "supported" }],
  }, false, { clientHost: "cursor" });
  assert.equal(response.isError, false);
  assert.equal(response.structuredContent.presentation.workflow_state, "delivery-ready-provisional");
  assert.equal(response.structuredContent.presentation.outcome, "partial");
  assert.match(response.content[0].text, /No compatible project harness capability/);
  assert.match(response.content[0].text, /Decide on provisional delivery/);
});

test("Shadow Review separates repository utility from absent formal evidence", () => {
  const response = manualMcpResult("workflow_closeout", {
    artifact_kind: "work-review",
    mode: "shadow",
    status: "unavailable",
    assessment: "shadow",
    repository_outcome: "Read-only findings are available without a Root comparison.",
    evidence_status: "No Workflow Evidence or Work Review artifact was created.",
    reason_code: "native-task-receipt-unavailable",
    limitations: ["Formal Root and workspace binding are unavailable."],
    artifacts_persisted: false,
    workflow_state_changed: false,
    persistence_scope: "none",
    handoff_persisted: false,
    repository_findings_authoritative: false,
    repository_findings: [{
      key: "binding-gap",
      severity: "high",
      evidence: "The host supplied no protected Review receipt.",
      reasoning: "Conversation Root bytes alone cannot establish host authority.",
    }],
    recovery_action: "establish-formal-review-binding",
  }, false, { clientHost: "cursor" });
  assert.equal(response.isError, false);
  assert.equal(response.structuredContent.presentation.workflow_state, "shadow-review");
  assert.equal(response.structuredContent.presentation.outcome, "partial");
  assert.equal(response.structuredContent.presentation.primary_action.id, "establish-formal-review-binding");
  assert.match(response.content[0].text, /Repository outcome: Read-only findings/);
  assert.match(response.content[0].text, /Evidence status: No Workflow Evidence or Work Review artifact was created/);
  assert.match(response.content[0].text, /Artifacts persisted: false/);
  assert.match(response.content[0].text, /Workflow state changed: false/);
  assert.match(response.content[0].text, /Persistence scope: none/);
  assert.match(response.content[0].text, /Task-local handoff persisted: false/);
  assert.match(response.content[0].text, /### Repository findings \(non-authoritative\)/);
  assert.match(response.content[0].text, /binding-gap/);
  assert.deepEqual(Object.keys(response.structuredContent.presentation.repository_findings[0]), ["key", "severity", "evidence", "reasoning"]);
  assert.equal((response.content[0].text.match(/### Next step/g) ?? []).length, 1);
});

test("presentation scope excludes generic harness orchestration", () => {
  for (const name of [
    "workflow_plan_preflight",
    "workflow_artifact_record",
    "workflow_artifact_context",
    "workflow_closeout",
    "workflow_status",
  ]) assert.equal(isManualWorkflowTool(name), true);
  assert.equal(isManualWorkflowTool("workflow_prepare"), false);
});

test("errors remain explicit and ordinary unknown tools keep raw transport", () => {
  const failed = manualMcpResult("workflow_status", { error: "artifact chain invalid" }, true);
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /artifact chain invalid/);
  const raw = manualMcpResult("project_specific_tool", { ok: true });
  assert.deepEqual(raw.structuredContent, { ok: true });
  assert.equal(JSON.parse(raw.content[0].text).ok, true);
});

test("presentation covers blocked, achieved, status, Evidence, and transport outcomes", () => {
  const blocked = buildPresentation("workflow_plan_preflight", {
    feasible: false,
    blocking_issues: [{ message: "Intent is incomplete." }],
    warnings: ["Harness capability is unavailable."],
  });
  assert.equal(blocked.workflow_state, "blocked");
  assert.equal(blocked.outcome, "blocked");
  assert.equal(blocked.primary_action.id, "resolve-blocker");
  assert.deepEqual(blocked.blockers, ["Intent is incomplete."]);
  assert.match(formatManualToolContent(blocked), /Blockers:\n- Intent is incomplete/);

  const achieved = buildPresentation("workflow_closeout", {
    artifact_kind: "work-review",
    delivery_status: "verified",
    assessment: "achieved",
  });
  assert.equal(achieved.workflow_state, "achieved");
  assert.equal(achieved.primary_action, null);
  assert.match(formatManualToolContent(achieved), /### Done/);

  const status = buildPresentation("workflow_status", {
    snapshot: { state: "waiting-human", next_action: "review-work", blockers: ["Human Review required."] },
  });
  assert.equal(status.primary_action.id, "review-work");
  assert.equal(status.primary_action.label, "review work");

  const evidence = buildPresentation("workflow_closeout", { status: "blocked", overall_grade: "failed" });
  assert.equal(evidence.workflow_state, "blocked");
  assert.match(evidence.summary, /Delivery Evidence is blocked/);
  assert.equal(buildPresentation("workflow_artifact_record", {}).summary.includes("transport"), true);
  assert.equal(buildPresentation("workflow_artifact_context", {}).workflow_state, "context-available");
});

test("limitations are deduplicated and presentation helpers stay stateless", () => {
  const presentation = buildPresentation("workflow_status", {
    state: "status-available",
    limitations: ["same", "same"],
    warning: "warning",
    human_attention: { reasons: [{ message: "human" }] },
    problem_details: [{ problem: "problem" }],
  });
  assert.deepEqual(presentation.limitations, ["same", "warning", "human", "problem"]);
  resetManualPresentationDedupe();
  assert.equal(coalesceManualPresentation(presentation).update_suppressed, false);
});
