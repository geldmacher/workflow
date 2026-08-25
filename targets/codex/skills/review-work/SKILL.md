---
name: review-work
description: Perform a fresh repository-read-only Review against an exact Schema-6 Root.
---

# $review-work

Start a fresh repository-read-only Review. Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Use the exact current-task Schema-6 Root from Codex Plan mode and exact predecessor bytes already present in this task. Cache and handoff are transport only. Reject every unsupported artifact schema. Recoverable transport defects do not erase a valid Root.

Assess acceptance, authority, verification intents, repository state, findings, and limitations. The active project harness chooses every concrete inspection mechanism and attests matching before/after snapshots. Workflow never evaluates commands, tools, models, frameworks, routes, retries, sandboxes, or worktrees.

Missing harness evidence keeps the Root and yields provisional Evidence. Verified requires protected Check attestations bound to Root, workspace, intent, and snapshot. Attested failure remains failed; contradictory bindings are rejected; human-decision Checks remain human gates.

Call `workflow_closeout` once with `artifact_kind: work-review`, exact current-task bytes, and one closed `review_input`. It returns Delivery Evidence and Work Review atomically or neither. Never mutate during Review. Present a concise outcome, limitations, technical traceability, and one lifecycle-level next action.
