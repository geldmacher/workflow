---
name: correct-work
description: Correct proven in-scope portable Workflow findings under separate human authorization and deterministic closeout.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Correct work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [correction contract](../../../../references/correction-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), and [closeout](../../../../references/closeout-contract.md) completely.

Resolve one exact current Schema-5 Root, Evidence, and Review chain. Use `workflow_artifact_context` only as non-authoritative enrichment. Proceed only when the unique Review tip says `next_action: correct` and names bounded Findings. Ambiguity, changed acceptance, or new authority requires a new `plan-work` action.

Treat this invocation as authority only for the named correction. Re-bind the exact Root and capture the baseline before mutation; failure stops without editing. Reject directly observable protected, approval-required, or out-of-authority targets, preserve unrelated work, and run correction Checks plus every inherited required Root Check not already passed as exact standalone planned commands. Equivalent probes may run once, but each Check keeps honest Evidence.

Call `workflow_closeout` with the exact Root, current Review lineage, changed paths, observations, and stable snapshot. Completion requires the returned exact correction Evidence. Do not invent Evidence fields or merge, push, publish, deploy, or install.

If the portable client cannot supply protected host receipts, preserve the returned downgrade, show `enforcement_level: explicit` in Technical traceability, and route it to fresh review instead of fabricating verified correction Evidence.
