---
name: work-execution
description: Apply one approved correction and return evidence.
---

Read [protocol](../../references/artifact-protocol.md), [correction](../../references/correction-contract.md), and [closeout](../../references/closeout-contract.md) completely.

`[workflow-model-inherit-v1]` The primary owns execution, integration, and closeout. It may delegate bounded work when Task calls omit Task model overrides or use `inherit`; children match the parent or approved Manual candidate.

Resolve the active native Cursor Plan Root from task artifacts; handoff only enriches. Select its latest actionable correction/Evidence tip. Before mutation reject conflicting hashes or stale chain/Workflow-3/4; validate root, Strategy revision when required, chain, scope, reuse, risk, and approval.

Re-bind the task Root and baseline before mutation. Reject protected, approval-required, or out-of-authority targets. Failure blocks.

Classify FIXes `satisfied|pending|partial|conflicted`; execute pending/partial; verification-only avoids edits. Closeout adds correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks. Reuse unaffected proof at its existing grade. Equivalent Checks run once on stable state with honest Evidence per ID. Conflict, drift, or changed intent/scope/risk stops; unavailable or failed proof stays exact.

On Cursor invoke `workflow_closeout` internally with exact chain/observations, consume `structuredContent`, and print no attestation or artifact. If unavailable, use one native `closeout-input` fallback; the hook derives paths/snapshot. Codex keeps its typed path. Task-local Evidence proceeds to Review despite optional handoff failure; attach only to switch task/host. Report result, Checks, one plain blocker with resolution, and one action; trace raw details. Never invent Evidence or materialize Learning candidates.

Run each machine Check as its exact standalone planned command/directory; one leading `rtk` is allowed. Receipts downgrade unattested/stale/rootless proof, preserve failure, and give the rerun.
