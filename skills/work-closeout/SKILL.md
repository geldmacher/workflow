---
name: work-closeout
description: Recover deterministic Schema-5 delivery closeout without repository edits.
---

Read [protocol](../../references/artifact-protocol.md) and [closeout](../../references/closeout-contract.md) completely.

Resolve explicit `wp-*`, else active Plan Root. Task artifacts precede `workflow_artifact_context`. Content-bound handoff uses exact Root hash; missing workspace binding or `roots-request-failed|roots-empty` cannot discard the task chain. Other errors, conflict, ambiguity, or stale correction block.

Reuse Evidence only when HEAD, paths, and prerequisite fingerprints match.

1. Capture workspace, HEAD, porcelain-v2/untracked, and fingerprints for every tracked, visible untracked, and Check-prerequisite path: byte SHA-256, symlink target, gitlink OID, or missing; byte-sort paths.
2. Reuse snapshot-bound observations. Run missing Checks only in an external byte-equivalent snapshot that is technically read-only, or with a non-bypassable full-tree write audit and restored writes. Write-deny the original repository; await the full tree. Network, production, credentials, installs, and external effects stay unavailable; else mark `unavailable` and block writes.
3. Unsafe Checks are `unavailable`; known failure stays `failed`.
4. Recompute the complete baseline; compare content, paths, index state, and HEAD. Mutation blocks without Evidence; never clean or modify the repository.
5. Invoke `workflow_closeout` internally with exact chain/observations; print neither a delivery-report nor a persisted artifact. If unavailable, use one `closeout-input` `review-recovery`; the hook derives Evidence/paths and continues once.
6. Recompute. Drift reports `Closeout blocked — repository mutation detected` with Check, paths, fingerprints. Otherwise return Evidence to the same review. Without pre-mutation baseline, Evidence is provisional, verified caps at `supported`, failures persist.

Run each machine Check as its exact standalone planned command/directory; one leading `rtk` is allowed. Receipts downgrade missing/stale/rootless proof, preserve failure, and name rerun.

The root-content handoff cache is transport only: no Run, authority, or Learning. With `handoff_persisted: false`, keep task-local Evidence; attach only to switch task/host. Host preferences grant no MCP approval. For non-verified Evidence add `Meaning:` and the [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#evidence-grades).
