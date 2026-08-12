---
name: work-execution
description: Apply one approved correction and return evidence.
---

Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), and [closeout](../../references/closeout-contract.md) completely.

`[workflow-model-inherit-v1]` The primary owns execution, integration, and closeout. It may delegate bounded work when Task calls omit Task model overrides or use `inherit`; plugin agents inherit. Children match the parent or an approved Manual candidate.

Resolve the active native Cursor Plan's Root from exact task artifacts first; use hash-bound `workflow_artifact_context` only as transport enrichment. Cache absence does not discard exact task artifacts. Select its latest actionable correction/evidence tip. Never select an older or unrelated Root. Reject conflicting hashes, missing, stale, ambiguous, Workflow-3/4-only, mixed, or invalid chains before mutation. Use the validator when available; otherwise check root, Strategy revision when required, chain, scope, reuse, risk, and approval.

Refresh the repository and classify every FIX `satisfied|pending|partial|conflicted`. Execute only pending/partial FIXes; verification-only avoids edits. For correction closeout, combine its Checks with every inherited required Root Check not effectively `passed`; reuse only passed Root proof. Execute semantically equivalent Checks once on the same stable state and emit honest Evidence for each ID. Stop on conflict, drift, or changed intent/scope/risk; record unavailable or failed proof exactly. Finish with one strict `closeout-input` for `implementation|correction`; omit path fields because the hook binds the exact task-local Root/lineage, derives the complete authoritative paths/snapshot, builds, and persists Evidence. `workflow_closeout` remains optional; only it needs delivery-report/attachment handling. Lead with outcome, checks, gaps, and `### Next step`; on recovery/replan add one `Meaning:` sentence plus [Review results and next actions](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#review-results-and-next-actions). Never claim delivery without builder-owned Evidence, invent its derived fields, or materialize Learning candidates.

Run each machine Check as its exact standalone planned command/directory; one leading `rtk` is allowed. Receipts downgrade unattested/stale/rootless proof, preserve failure, and give the rerun.
