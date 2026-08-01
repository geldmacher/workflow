---
name: work-closeout
description: Recover deterministic Schema-5 delivery closeout without repository edits.
---

Read [protocol](../../references/artifact-protocol.md) and [closeout](../../references/closeout-contract.md) completely.

Resolve explicit `wp-*`, else the active Plan Root. Load hash-bound `workflow_artifact_context` and merge task artifacts. Exact task chains survive cache absence; hash conflicts, invalid chains, multiple tips, or stale corrections block.

Reuse Evidence only when HEAD, paths, and prerequisite fingerprints match; otherwise it is stale.

1. Capture workspace identity, HEAD, porcelain-v2 state with visible untracked paths, and fingerprints for every tracked, visible untracked, and Check-prerequisite path. Use SHA-256 over bytes, symlink targets, gitlink OIDs, or a missing marker; sort POSIX paths bytewise and encode `` `path`=<64 lowercase hex> ``.
2. Reuse only snapshot-bound observations. Run a missing bounded Check only in an external byte-equivalent snapshot that is technically read-only, or under a non-bypassable full-tree write audit with restored writes. Write-deny the original repository and await the full tree. Network, production, credentials, installs, and external effects stay unavailable. Without isolation mark it `unavailable`; any write attempt blocks.
3. Mark unsafe or unavailable Checks `unavailable` with the limitation. A known failed Check stays `failed`, never unavailable or provisional.
4. Recompute the complete baseline from step 1 and compare content, paths, index state, and HEAD. If a Check changed repository state, stop as blocked, identify the mutation, and emit no Evidence. Never clean up or modify the repository under this command.
5. Call `workflow_closeout` with exact chain, changed paths, snapshot, Manual profile, Strategy revision, and structured observations. Supply required semantic IDs/hashes; never invent Evidence identity, topology, mode, grade, or status.
6. Recompute the baseline. On drift, output `Closeout blocked — repository mutation detected` with Check, paths, and fingerprints; emit no Evidence. Otherwise return the artifact byte-for-byte plus any attach instruction. Evidence certifies only its bound snapshot.

The handoff cache is transport only. It creates no Run, approval, acceptance, qualification, or Learning.
