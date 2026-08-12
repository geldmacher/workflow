---
name: work-closeout
description: Recover deterministic Schema-5 delivery closeout without repository edits.
---

Read [protocol](../../references/artifact-protocol.md) and [closeout](../../references/closeout-contract.md) completely.

Resolve explicit `wp-*`, else the active Plan Root. Task artifacts precede hash-bound `workflow_artifact_context`. Content-bound handoff uses the exact Root hash; missing workspace binding or `roots-request-failed|roots-empty` cannot discard an exact task chain. Other Root errors, conflicts, ambiguity, or stale correction block.

Reuse Evidence only when HEAD, paths, and prerequisite fingerprints match; otherwise it is stale.

1. Capture workspace, HEAD, porcelain-v2 including untracked paths, and fingerprints for every tracked, visible untracked, and Check-prerequisite path: SHA-256 of bytes, symlink target, gitlink OID, or missing marker; byte-sort POSIX paths.
2. Reuse only snapshot-bound observations. Run a missing Check only in an external byte-equivalent snapshot that is technically read-only, or with a non-bypassable full-tree write audit and restored writes. Write-deny the original repository and await the full tree. Network, production, credentials, installs, and external effects stay unavailable; otherwise mark `unavailable`, and block any write.
3. Mark unsafe or unavailable Checks `unavailable` with the limitation. A known failed Check stays `failed`, never unavailable or provisional.
4. Recompute the complete baseline and compare content, paths, index state, and HEAD. A Check mutation blocks with its details and no Evidence; never clean or modify the repository.
5. Return one strict `closeout-input` phase `review-recovery` with Root, Strategy revision, Checks, and summary—no derived Evidence or path fields. The hook derives the complete authoritative path inventory and snapshot, then persists under the Root hash; `workflow_closeout` is optional recovery transport.
6. Recompute again. Drift outputs `Closeout blocked — repository mutation detected` with Check, paths, and fingerprints. Otherwise continue one read-only review with hydrated Evidence. No pre-mutation baseline permits only provisional in-authority Evidence, caps verified observations at `supported`, and preserves failures.

Run each machine Check as its exact standalone planned command/directory; one leading `rtk` is allowed. Automatic no-raw-output receipts downgrade missing/stale/rootless proof with an exact rerun and preserve failure.

The root-content handoff cache is transport only: no Run, approval, acceptance, qualification, or Learning. Host preferences grant no MCP approval. For non-verified Evidence or attachment, add one `Meaning:` sentence and the matching [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#evidence-grades) before the final action.
