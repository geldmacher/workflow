---
name: work-status
description: Derive Manual Workflow status from an exact Schema-5 artifact chain. Use when the user invokes $work-status.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Collect the exact current-task Schema-5 artifacts for one `wp-*` Root. Use `workflow_artifact_context` only for non-authoritative transport enrichment, then call the manual branch of `workflow_status` with the explicit Root ID and complete artifacts. Report the derived state, evidence/review tips, blockers, next safe action, model-attestation diagnostic, and non-authoritative `host_tool_approval` exactly. Never claim that preference granted Codex MCP approval; see [Codex Manual](../../references/codex-manual.md).

Do not infer Controller preparations or runs: Codex Workflow has none. Do not mutate repository, artifacts, acceptance, or operational state.
