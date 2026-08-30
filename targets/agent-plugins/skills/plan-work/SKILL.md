---
name: plan-work
description: Create and preflight an exact human-authorized Schema-6 Intent Root without implementing it.
compatibility: Requires an Agent Plugins v1 client with Agent Skills, Node.js 22+, and PLUGIN_ROOT support; Manual use does not require MCP.
---

# Plan work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [local builder](../../../../references/manual-builder-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), [design contract](../../../../references/design-contract.md), and [plan container](../../../../references/plan-container-contract.md) completely.

Inspect read-only and clarify only choices that materially change outcome, scope, authority, risk, behavior, or acceptance. Once material intent is stable, read the [engineering catalog](../../../../references/engineering-playbooks.md), recommend exactly one closest playbook, and state its ID, fit, intended phase, and authority need. Before returning the final Root, ask and wait for one explicit inline confirm or decline. Decline continues without a playbook; confirmation is human trace only. A material intent change discards the decision and requires a fresh suggestion.

Create one immutable Schema-6 Root with a visible `wp-*` ID and explicit authority envelope. Reject every unsupported artifact schema. Bind observable outcomes and hard boundaries; keep guessed files, internal architecture, and possible solution paths adaptive unless a public contract, security property, authority boundary, or explicit human trade-off makes them material. Keep the confirmed playbook or decline in non-authoritative human trace outside the Root; never put it in another authoritative contract.

Verification contains only `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`. Never prescribe or evaluate commands, working directories, tools, models, routes, retries, sandboxes, worktrees, or task recipes. The active project harness owns every concrete execution choice.

Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`. Invoke `${PLUGIN_ROOT}/dist/manual-workflow.mjs validate-plan` with the exact Root. Present it only when the result is feasible and binds the same Root ID. Decorate only the derived `implement-plan` or `correct-plan` action through the portable mapping; do not reassess it. Local validation creates no artifact or approval.

Return the exact Root. State readiness, one concrete reason, and exactly one next action: invoke `implement-work` after approval. Never edit, implement, claim completion, or add a Review action.
