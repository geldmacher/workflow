---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Subagents inherit its model; omit Task overrides. Treat trailing text as a new goal. `replan [wp-*]` needs the explicit or active Schema-5 Root and unique review tip with `next_action: replan`; otherwise emit no Root and require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only when the answer changes outcome, scope, public behavior, data/security, risk, or acceptance; show options, effects, and a recommendation. On replan preserve confirmed decisions and authority, reopening only matters raised by the review.

Before the answer, do not load contracts or assurance boilerplate; continue only decision-independent research. If the question tool is unavailable, ask one compact blocking question. Emit no plan or draft before the answer; clear intent needs no interview.

## Root Planning

Once ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), [adaptive design](../../references/design-contract.md), and [closeout](../../references/closeout-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Give each objective its cheapest sufficient falsifiable required Check; merge duplicates and defer non-essential breadth. `expensive` is required only without a cheaper equivalent for essential acceptance or material risk. Put path-specific acceptance targets in backticks.

Before `CreatePlan`, run `workflow_plan_preflight` on the exact Root, repair blockers, and expose advisories; it grants no approval. If unavailable, low/medium Manual may disclose the equivalent inline check. High-risk or Hard-Trigger Manual and every Controller preparation stop.

A replan creates a fresh `wp-*` with exact predecessor/review bindings and human **Implement Plan** approval. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented, scope repository-only, and budgets proportional.

Mark every todo `[workflow-model-inherit-v1]`. The final todo calls `workflow_closeout` with exact Root/chain and required-Check observations, then prints its valid artifact unchanged. The Schema-5-only CreatePlan guard enforces this. Record the Root through `workflow_artifact_record`; cache failure requires attachment but does not invalidate the Plan.
