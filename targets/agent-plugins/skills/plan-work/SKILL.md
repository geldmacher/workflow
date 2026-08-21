---
name: plan-work
description: Create and preflight an exact human-authorized Schema-5 Workflow implementation plan without implementing it.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Plan work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [human-first output](../../../../references/human-output-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), [design contract](../../../../references/design-contract.md), and [closeout](../../../../references/closeout-contract.md) completely.

Inspect the repository read-only. Clarify only choices that materially change the outcome, scope, authority, public behavior, data or security posture, risk, or acceptance.

Create one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID, `profile_max: manual`, an explicit authority envelope, and the cheapest sufficient required Checks. Inspect each shell command's complete wrapper and pre/post lifecycle-hook chain. Required Verification must not write repository content during fresh read-only Review; keep mutating commands in implementation, and do not present a ready Root without sufficient read-only proof. Consider material correctness, security, maintainability, performance, efficiency, and comprehensibility; advanced tests and scanners stay optional. Its final implementation step must identify `implement-work` as the separately authorized next action and semantic `delivery-closeout` as the finish.

Call `workflow_plan_preflight` with the exact complete Root text. Present the Root only when structured output says `feasible: true`, `blocking_issues` is empty, and `root_plan_id` equals the Root ID. Otherwise repair the Root or stop with the exact blockers. Never treat prose, an ID alone, or a preflight for different bytes as approval.

Return `Quick decision` with the `implement-work` approval action, complete human `Details`, then the final authoritative `Agent and machine contract` containing the exact Root. The Root must stand alone for a weaker capable implementer with explicit ordered dependencies, targets, completion probes, Check context, boundaries, and stop/replan conditions; do not refer back to the human projection or duplicate it as JSON. Do not edit files or begin implementation.
