---
name: plan-work
description: Create and preflight an exact human-authorized Schema-5 Workflow implementation plan without implementing it.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Plan work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), [design contract](../../../../references/design-contract.md), and [closeout](../../../../references/closeout-contract.md) completely.

Inspect the repository read-only. Clarify only choices that materially change the outcome, scope, authority, public behavior, data or security posture, risk, or acceptance.

Create one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID, `profile_max: manual`, an explicit authority envelope, and the cheapest sufficient required Checks. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests and scanners stay optional. Its final implementation step must identify `implement-work` as the separately authorized next action and semantic `delivery-closeout` as the finish.

Call `workflow_plan_preflight` with the exact complete Root text. Present the Root only when structured output says `feasible: true`, `blocking_issues` is empty, and `root_plan_id` equals the Root ID. Otherwise repair the Root or stop with the exact blockers. Never treat prose, an ID alone, or a preflight for different bytes as approval.

Return the exact Root and a concise next step telling the human to invoke `implement-work` after approval. Do not edit files or begin implementation.
