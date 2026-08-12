---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Omit Task model overrides or use `inherit`; observed Children must match the parent or a configured Manual approved candidate. Treat trailing text as a new goal. `replan [wp-*]` needs the explicit or active Schema-5 Root and unique review tip with `next_action: replan`; otherwise emit no Root and require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only for material outcome, scope, public behavior, security, risk, or acceptance decisions. Replan preserves confirmed decisions and reopens only review findings.

Before answers, load no contracts; continue only decision-independent research. Without the question tool ask one blocker. Emit no plan or draft before the answer; clear intent needs no interview.

## Root Planning

Once ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), [adaptive design](../../references/design-contract.md), and [closeout](../../references/closeout-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Give each objective its cheapest sufficient falsifiable required Check; merge duplicates and defer non-essential breadth. `expensive` is required only without a cheaper equivalent for essential acceptance or material risk. Put path-specific acceptance targets in backticks.

Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests/scanners stay optional, never a six-item checklist.

The host plan guard validates every exact Manual Root locally; it grants no approval. Standalone `workflow_plan_preflight` remains optional compatibility and controller-preparation transport. Honor host tool-approval preference: `strict` expects MCP prompts when an MCP tool is used; `allowlisted` expects a host allowlist and never claims approval.

A replan creates a fresh `wp-*` with exact predecessor/review bindings and human **Implement Plan** approval. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented, scope repository-only, and budgets proportional.

Mark the final closeout todo `[workflow-model-inherit-v1]` with a short verify/closeout sentence and metadata `workflow_attestation: { schema: 1, kind: plan-closeout, action: delivery-closeout }`. Legacy `action: workflow_closeout` remains accepted. Keep closeout ceremony out of visible todo text. See [plan container](../../references/plan-container-contract.md) and [closeout](../../references/closeout-contract.md). Skip normal-path `workflow_artifact_record`; cache-write failure requires attachment but does not invalidate the Plan. Unresolved Intent or infeasible Roots add `Meaning:` plus the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#intent-root-and-plan) before `### Next step`.
