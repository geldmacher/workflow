---
name: implement-work
description: Implement one approved portable Workflow Root and close it out through the Manual MCP under separate human authorization.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Implement work

Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [executable contract](../../../../references/executable-contract.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), and [closeout](../../../../references/closeout-contract.md) completely.

Treat this explicit invocation as implementation authority only for one exact Schema-5 Root present in the current conversation. Require an unambiguous workspace root and call `workflow_plan_preflight` again with the exact Root. Proceed only when it is feasible, has no blocking issues, and returns the same Root ID.

Before mutation, capture repository identity, status, relevant fingerprints, and the complete baseline needed to distinguish pre-existing work. Baseline failure stops before writing. Preserve unrelated changes. Check every directly observable write target against allowed roots, protected paths, approval-required paths, dependency rules, external-effect limits, and delivery boundaries before mutation; unresolved targets remain fail-closed at complete closeout inventory. Stop for new scope or authority.

Implement the approved outcome and run every required machine Check as its exact standalone planned command in the planned directory; one leading `rtk` is allowed. Report failed or unavailable proof honestly. Recompute the repository state and stop on unexplained drift.

Call `workflow_closeout` with the exact Root text and ID, explicit changed paths, direct Check observations, and the stable repository snapshot. Completion requires a successful exact Schema-5 Evidence result from that call. If closeout fails, do not claim completion; route to `close-work` after resolving the reported blocker. Do not merge, push, publish, deploy, or install.

Portable clients do not standardize native lifecycle receipts. Unless the client supplies compatible protected host receipts, MCP must downgrade machine claims and expose one current-delivery Problem. In human-facing output use one primary journey action and put `enforcement_level: explicit`, IDs, hashes, paths, and receipts only in Technical traceability. Do not loop or fabricate proof; report the provisional boundary and continue to fresh human review.
