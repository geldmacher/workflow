---
name: work-planning
description: Create an intent-ready Workflow root.
---

Plan in Cursor. Omit model overrides or use `inherit`; Children match the parent or a Manual approved candidate. `replan [wp-*]` requires an active Schema-5 Root and unique `next_action: replan` review tip; otherwise no Root—require `/plan-work <goal>`.

## Intent Interview

Optimize for Intent Readiness, not broad brainstorming. Ask at most three related questions only about material outcome, scope, behavior, security, risk, or acceptance. Replan reopens only review findings.

Before answers, load no contracts and do only decision-independent research. Without the question tool ask one blocker. Emit no plan or draft before the answer; skip the interview when intent is clear.

## Root Planning

Once ready, read [root semantics](../../references/executable-contract.md), [native output](../../references/plan-container-contract.md), and [adaptive design](../../references/design-contract.md) completely. Preserve material answers in one immutable Schema-5 Intent Root; Workflow-3/4 remains read-only.

Check goal, acceptance, non-goals, constraints, authority, risk, Hard Triggers, and profile. Each objective needs its cheapest sufficient falsifiable required Check. For shell Checks inspect wrappers and pre/post hooks; Review must not write repository content. Keep mutating commands in implementation, and treat a Root without sufficient read-only proof as infeasible. Merge duplicates, require `expensive` only when essential and no cheaper equivalent exists, and backtick path-specific targets.

Put every new Root's explicit `### Verification` table directly inside `## Acceptance`, before its next H2; any later placement fails preflight.

Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests/scanners stay optional, never a six-item checklist.

The host guard validates the exact Root but grants no approval. `workflow_plan_preflight` is optional transport. MCP: `strict` expects prompts; `allowlisted` expects a host allowlist and claims no approval.

A replan creates a fresh `wp-*` with exact predecessor/review bindings from this task and renewed human **Implement Plan** approval. Do not reconstruct predecessor authority from host state, caches, or another task. Do not invent `extensions`; they are opaque audit metadata, never model context or authority. Keep Strategy outcome-oriented, scope repository-only, and budgets proportional.

Use Cursor's native Plan as the sole plan container. Native todos describe implementation and planned checks only; add no closeout todo, `workflow_attestation`, Evidence step, or artifact-record step. Unresolved Intent or infeasible Roots add `Meaning:` plus the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#intent-root-and-plan) before `### Next step`.
