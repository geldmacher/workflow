---
name: work-execution
description: Apply one approved correction and return evidence.
---

Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), and [closeout](../../references/closeout-contract.md) completely.

`[workflow-model-inherit-v1]` The primary owns execution, integration, and closeout. It may delegate bounded work when Task calls omit Task model overrides or use `inherit`; plugin agents inherit. Children match the parent or an approved Manual candidate.

Resolve the active native Cursor Plan Root from exact task artifacts; handoff is enrichment only. Select its latest actionable correction/Evidence tip, never older or unrelated. Before mutation reject conflicting hashes or stale/invalid/Workflow-3/4 data; validate root, Strategy revision when required, chain, scope, reuse, risk, and approval.

Re-bind the exact task Root and capture baseline before mutation. Reject observable protected, approval-required, or out-of-authority targets. Failure blocks; it is never completed delivery.

Refresh the repository and classify every FIX `satisfied|pending|partial|conflicted`. Execute only pending/partial FIXes; verification-only avoids edits. For correction closeout, combine its Checks with every inherited required Root Check not effectively `passed`; reuse only passed Root proof. Execute semantically equivalent Checks once on the same stable state and emit honest Evidence for each ID. Stop on conflict, drift, or changed intent/scope/risk; record unavailable or failed proof exactly. Finish with one strict `closeout-input` for `implementation|correction`; omit path fields because the hook binds the exact task-local Root/lineage, derives the complete authoritative paths/snapshot, builds, and persists Evidence. `workflow_closeout` remains optional; only it needs delivery-report/attachment handling. The primary chat layer contains journey state, result, Check summary, at most one blocker, and one action; put exact IDs, paths, receipts, and host enforcement in Technical traceability. Never claim delivery without builder-owned Evidence, invent its derived fields, or materialize Learning candidates.

Run each machine Check as its exact standalone planned command/directory; one leading `rtk` is allowed. Receipts downgrade unattested/stale/rootless proof, preserve failure, and give the rerun.
