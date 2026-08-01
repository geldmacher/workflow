---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Subagents inherit its model; omit Task overrides.

Treat trailing text as a new goal. For `replan [wp-*]`, resolve the explicit or active Plan Root and unique current review tip. Require Schema 5 with `next_action: replan`; otherwise produce no Root and require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only when choices materially change outcome, scope, public behavior, data/security, risk, or acceptance; give concrete options, effects, and a recommendation.

For replan, preserve confirmed decisions and unchanged authority by default. Reopen only intent, scope, acceptance, or risk made material by the source review; do not silently inherit contradicted assumptions.

Do not search for the question tool or load contracts, schemas, fixtures, examples, or assurance boilerplate before the answer. Only decision-independent facts may continue. If unavailable, ask one compact blocking prose question. Emit no plan or draft before the answer; clear intent needs no interview.

## Root Planning

Once intent is ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), [adaptive design](../../references/design-contract.md), and [closeout](../../references/closeout-contract.md) completely. Preserve every material human answer in the Intent Root.

Workflow-3/4 or mixed input remains read-only and requires a fresh Workflow-5 Root, never automatic conversion.

Construct one immutable Schema-5 Intent Root. Before `CreatePlan`, check goal, observable acceptance, non-goals, constraints, authority, risk, hard triggers, and profile contract. Use compact meaningful prose, lists, or tables; keep mutable steps and Check tactics in Strategy.

A replan creates a fresh `wp-*`, binds `predecessor_plan_id` and `replan_source_review_id` to the source review with `next_action: replan`, and leaves its predecessor immutable. The new native Plan requires human **Implement Plan** approval.

Do not invent `extensions`; do not consume them. Keep Strategy outcome-oriented and Checks economic. Controlled/certified Roots need complete budgets; lean Roots keep meaningful bounds. Cursor-selected primary owns **Implement Plan** approval; delivery stops at the repository boundary.

Prefix every native todo with `[workflow-model-inherit-v1]`. The final marked todo calls `workflow_closeout` with structured Check observations and prints its artifact unchanged. After `CreatePlan`, record the exact Root through `workflow_artifact_record`. Cache failure leaves the Plan valid; retain the Root and state the attach requirement.
