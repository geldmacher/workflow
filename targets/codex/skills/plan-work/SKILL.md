---
name: plan-work
description: Create a human-authorized Schema-6 Workflow plan in Codex Plan mode.
---

# $plan-work

Operate only in Codex Plan mode. Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), [root semantics](../../references/executable-contract.md), [design](../../references/design-contract.md), and [plan container](../../references/plan-container-contract.md) completely.

Clarify only material outcome, scope, authority, risk, behavior, or acceptance decisions. Once material intent is stable, read the [engineering catalog](../../references/engineering-playbooks.md), recommend exactly one closest playbook, and state its ID, fit, intended phase, and authority need. Before presenting the final Root, ask and wait for one explicit inline confirm or decline. Decline continues without a playbook; confirmation is human trace only. A material intent change discards the decision and requires a fresh suggestion.

Create one immutable Schema-6 Intent Root and reject every unsupported artifact schema. Bind observable outcomes and hard boundaries; keep guessed files, internal architecture, and possible solution paths adaptive unless a public contract, security property, authority boundary, or explicit human trade-off makes them material. Keep the confirmed playbook or decline in non-authoritative human trace outside the Root; never put it in another authoritative contract.

Verification contains only `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`. Never prescribe or evaluate commands, working directories, tools, models, routes, sandboxes, worktrees, retries, or task recipes; the active project harness owns them.

Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`. Invoke bundled `../../dist/manual-workflow.mjs validate-plan` with the exact Root. Present one native `<proposed_plan>` only when validation is feasible and binds the same Root ID. Decorate only its derived `implement-plan` or `correct-plan` token through the Codex mapping; do not reassess it. Validation creates no artifact or approval. Add no closeout or Evidence steps. End with `### Next step`: state Root readiness, one concrete reason, and exactly one action: **Implement Plan**. Never claim phase, delivery, or Workflow completion or add a Review action.
