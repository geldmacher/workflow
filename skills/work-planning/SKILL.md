---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Omit model overrides or use `inherit`; Children match the parent or a Manual approved candidate. `replan [wp-*]` requires an active Schema-5 Root and unique `next_action: replan` review tip; otherwise no Root—require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only about material outcome, scope, behavior, security, risk, or acceptance. Replan reopens only review findings.

Before answers, load no contracts and do only decision-independent research. Without the question tool ask one blocker. Emit no plan or draft before the answer; skip the interview when intent is clear.

## Root Planning

Once ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), [adaptive design](../../references/design-contract.md), and [closeout](../../references/closeout-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Give each objective its cheapest sufficient falsifiable required Check; merge duplicates. Require `expensive` only when essential and no cheaper equivalent exists. Backtick path-specific targets.

Put every new Root's explicit `### Verification` table directly inside `## Acceptance`, before its next H2; any later placement fails preflight.

Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests/scanners stay optional, never a six-item checklist.

The host guard validates the exact Root but grants no approval. `workflow_plan_preflight` is optional transport. MCP: `strict` expects prompts; `allowlisted` expects a host allowlist and claims no approval.

A replan creates a fresh `wp-*` with exact predecessor/review bindings and human **Implement Plan** approval. Cursor activates it only after a successful `CreatePlan` receipt matches its generation, tool use, and exact Root hash. Failure or mismatch leaves both Roots inactive until retry or explicit predecessor re-approval. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented, scope repository-only, and budgets proportional.

Final todo: `[workflow-model-inherit-v1] Verify checks and close out delivery.` with metadata `workflow_attestation: { schema: 1, kind: plan-closeout, action: delivery-closeout }`. Legacy `action: workflow_closeout` remains accepted; visible text contains no ceremony. See [plan container](../../references/plan-container-contract.md) and [closeout](../../references/closeout-contract.md). Skip normal `workflow_artifact_record`; cache failure requires attachment but does not invalidate the Plan. Unresolved Intent or infeasible Roots add `Meaning:` plus the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#intent-root-and-plan) before `### Next step`.
