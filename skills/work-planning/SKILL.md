---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Subagents inherit the main model; omit Task overrides. Plugin agents set `model: inherit`.

Treat ordinary trailing text as a new goal. For exact `replan [wp-*]`, resolve the explicit or active native Plan Root and its unique current review tip. Require Schema 5 with `next_action: replan`; invalid, legacy, missing, or ambiguous input produces no Root and requires `/plan-work <goal>`.

## Intent Interview

Investigate only enough repository truth to separate facts from human decisions. Use Intent Readiness, not broad brainstorming. Before planning, ask about choices that materially change outcome, scope, public behavior, data/security, risk, or acceptance. Ask at most three related questions with concrete options, effects, and a recommendation.

For replan, preserve confirmed decisions and unchanged authority by default. Reopen only intent, scope, acceptance, or risk made material by the source review; do not silently inherit contradicted assumptions.

Never search repository/plugin text, docs, or MCP catalogs to discover that tool. Before the answer, do not load planning contracts, schemas, fixtures, examples, or assurance boilerplate. Only decision-independent fact-finding may continue. If Cursor lacks or rejects the tool, ask one compact blocking prose question with the same choices. Emit no plan or draft before the answer. Clear intent needs no interview.

## Root Planning

Once intent is ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), [adaptive design](../../references/design-contract.md), and [closeout](../../references/closeout-contract.md) completely. Preserve every material human answer in the Intent Root.

Workflow-3/4 or mixed input remains read-only and requires a fresh Workflow-5 Root, never automatic conversion.

Construct one immutable Schema-5 Intent Root. Before `CreatePlan`, check goal, observable acceptance, non-goals, constraints, authority, risk, hard triggers, and profile contract. Use meaningful Intent, Acceptance, Boundaries, and Risks prose, lists, or tables rather than fixed-table padding. Keep mutable steps and Check tactics in the initial Strategy.

A replan creates a fresh `wp-*`, binds `predecessor_plan_id` and `replan_source_review_id`, and leaves the predecessor immutable. The new native Plan requires the normal human **Implement Plan** approval.

Do not invent `extensions`; preserve them as opaque audit metadata without using or passing their contents onward. Keep Strategy steps outcome-oriented and Checks economic. Controlled/certified Roots need complete budgets; lean Roots keep meaningful bounds. Native **Implement Plan** remains the sole initial Manual approval; delivery stops at the repository boundary.

Prefix every native todo with `[workflow-model-inherit-v1]`. The final marked todo calls `workflow_closeout` with structured Check observations and prints its artifact unchanged. After `CreatePlan`, record the exact Root through `workflow_artifact_record`. Cache failure leaves the Plan valid; retain the Root and state the attach requirement.
