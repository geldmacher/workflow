---
name: work-status
description: Derive portable Manual Workflow status from one exact current Schema-5 artifact chain.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Work status

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [human-first output](../../../../references/human-output-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [state contract](../../../../references/state-contract.md) completely.

Collect the exact current Schema-5 artifacts for one `wp-*` Root. Use `workflow_artifact_context` only for non-authoritative transport enrichment. Call `workflow_status` with the explicit Root ID and complete exact chain.

Report `Quick decision`, complete human `Details`, then the authoritative `Agent and machine contract` containing state, Evidence and Review tips, blockers, required actor, provisional acceptance eligibility, Manual learning eligibility, current-delivery constraint coverage, human attention, Problems, and limitations exactly as returned or deterministically derived. Missing Evidence routes to `close-work`, not invented status. Do not infer controller preparations, automation, or native host enforcement.

Stay read-only. Do not mutate repository files, artifacts, acceptance, operational state, host settings, or external systems.
