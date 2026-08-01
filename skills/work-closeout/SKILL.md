---
name: work-closeout
description: Recover or repeat the deterministic Schema-5 delivery closeout for one Workflow Root without authorizing repository edits.
---

Read [protocol](../../references/artifact-protocol.md) and [closeout](../../references/closeout-contract.md) completely.

Resolve the optional explicit `wp-*`; otherwise use the active native Cursor Plan's Root. Load `workflow_artifact_context` with the exact active Plan text and merge its artifacts with the current task. Cache absence alone is not invalid when the exact active Root/current-task chain is sufficient. Identical semantic IDs with different text hashes, an invalid chain, multiple tips, or a stale correction blocks.

If the chain already has a valid Evidence tip and no actionable correction, return it unchanged only when current HEAD, paths, and prerequisite fingerprints still match its bound snapshot/proof. Otherwise report stale Evidence and block; chain validity alone is not repository currency.

1. Capture workspace identity, HEAD, porcelain-v2 state with visible untracked paths, and fingerprints for every tracked, visible untracked, and Check-prerequisite path. Use SHA-256 over bytes, symlink targets, gitlink OIDs, or a missing marker; sort POSIX paths bytewise and encode `` `path`=<64 lowercase hex> ``.
2. Reuse only exact observations bound to that snapshot and include its aggregate proof hash. Run a missing local, bounded, non-interactive Check only in an external byte-equivalent snapshot that is technically read-only to the full process tree, or under a non-bypassable full-tree write audit that detects even restored writes. Write-deny the original repository and await the full tree. Network, production, credentials, installs, and external effects stay unavailable. Without that isolation mark the Check `unavailable`; any write attempt blocks. Never weaken Root Checks.
3. Classify every unsafe or unavailable Check as `unavailable` with a concrete limitation. Record a known failed Check as `failed`; never convert it to unavailable or provisional.
4. Recompute the complete baseline from step 1 and compare content, paths, index state, and HEAD. If a Check changed repository state, stop as blocked, identify the mutation, and emit no Evidence. Never clean up or modify the repository under this command.
5. Call `workflow_closeout` with exact Root/chain text plus only changed paths, repository snapshot, `effective_profile: manual`, Strategy revision, and structured Check observations. Supply semantic Root/Check IDs and observed proof hashes where required, but never invent an Evidence ID, Intent/artifact-set hash, topology, representation, evidence mode, aggregate grade, or status.
6. Recompute the baseline after the tool returns. On drift, output `Closeout blocked — repository mutation detected`, the known Check, paths, and before/after fingerprints; emit no Evidence and flag cached output as non-authoritative stale. Otherwise return the artifact byte-for-byte plus any separate attach instruction. Fresh review handles later drift; Evidence certifies only its bound snapshot.

The handoff cache is transport only. It creates no Run, approval, acceptance, qualification, or Learning.
