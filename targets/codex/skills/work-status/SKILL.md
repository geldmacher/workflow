---
name: work-status
description: Derive Manual Workflow status from an exact Schema-5 artifact chain. Use when the user invokes $work-status.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Collect the exact current-task Schema-5 artifacts for one `wp-*` Root. Use `workflow_artifact_context` only for non-authoritative transport enrichment; `workflow_status` remains optional convenience and must receive the explicit complete chain. Derive and report requested/effective Profile, required actor, downgrade reason, state, evidence/review tips, blockers, Manual learning eligibility, model-attestation diagnostic, and non-authoritative host approval exactly. Missing Evidence routes to the bounded read-only review recovery, not to invented status. Use `### Next step` while action remains and compact `### Done` for achieved.
Collect the exact current-task Schema-5 artifacts for one `wp-*` Root. Use `workflow_artifact_context` only for non-authoritative transport enrichment; `workflow_status` remains optional convenience and must receive the explicit complete chain. Derive and report requested/effective Profile, required actor, downgrade reason, state, evidence/review tips, blockers, Manual learning eligibility, model-attestation diagnostic, and non-authoritative host approval exactly. Include current-delivery constraint coverage, human attention, and actionable Problems only when present. Missing Evidence routes to bounded read-only review recovery, not invented status. Use `### Next step` while action remains and compact `### Done` for achieved.

Do not infer Controller preparations or runs: Codex Workflow has none. Do not mutate repository, artifacts, acceptance, or operational state.
