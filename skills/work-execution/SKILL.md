---
name: work-execution
description: Apply one approved correction and return evidence.
---

Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), and [closeout](../../references/closeout-contract.md) completely.

`[workflow-model-inherit-v1]` The primary owns execution, integration, and closeout. It may delegate bounded work only with the Cursor-selected model: omit Task model overrides; plugin agents use `model: inherit`.

Resolve the active native Cursor Plan's Root and hydrate its current chain through `workflow_artifact_context`, hash-bound to exact Plan text; cache absence alone does not discard exact task artifacts. Select only its latest actionable correction/evidence tip. Never select an older or unrelated Root. Reject conflicting hashes, missing, stale, ambiguous, Workflow-3/4-only, mixed, or invalid chains before mutation. Use the validator when available; otherwise check root, Strategy revision when required, chain, scope, reuse, risk, and approval.

Refresh the repository and classify every FIX `satisfied|pending|partial|conflicted`. Execute only pending/partial FIXes, preserve partial work, and stop on conflict or changed intent, scope, or risk. Verification-only avoids edits. Run affected Checks, justify reuse, then call `workflow_closeout` with structured observations and print its returned Correction Evidence unchanged. Never invent Evidence identity, hash, topology, grade, mode, or status; never materialize Learning candidates. Hand control to Ask `/review-work`.
