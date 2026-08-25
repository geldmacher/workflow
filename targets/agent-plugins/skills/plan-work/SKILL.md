---
name: plan-work
description: Create and preflight an exact human-authorized Schema-6 Intent Root without implementing it.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Plan work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), and [design contract](../../../../references/design-contract.md) completely.

Inspect read-only and clarify only choices that materially change outcome, scope, authority, risk, behavior, or acceptance. Create one immutable Schema-6 Root with a visible `wp-*` ID and explicit authority envelope. Reject every unsupported artifact schema.

Verification contains only `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`. Never prescribe or evaluate commands, working directories, tools, models, routes, retries, sandboxes, worktrees, or task recipes. The active project harness owns every concrete execution choice.

Call `workflow_plan_preflight` with the exact Root. Present it only when the result is feasible and binds the same Root ID. Preflight validates structure but grants no approval.

Return the exact Root and tell the human to invoke `implement-work` after approval. Do not edit files or begin implementation.
