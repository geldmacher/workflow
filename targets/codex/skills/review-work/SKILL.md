---
name: review-work
description: Perform a fresh repository-read-only Review against an exact Schema-6 Root.
---

# $review-work

Start a fresh repository-read-only Review. Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Use the exact current-task Schema-6 Root from Codex Plan mode and exact predecessor bytes already present in this task. In a fresh task, require explicit attachment of the exact Root and every referenced artifact. Cache, handoff, hook state, IDs, and MCP state are not authority. Reject every unsupported artifact schema.

Assess every acceptance objective, authority boundary, verification intent, repository observation, finding, and limitation. The active project harness chooses every concrete read-only inspection mechanism and supplies opaque observations. Workflow never evaluates commands, tools, models, frameworks, routes, retries, sandboxes, or worktrees.

Create the closed review, repository-observation, and Check-observation inputs described by the local contract. Use only `supported`, `partial`, `unavailable`, or `failed`; never supply IDs, hashes, attestations, receipts, or verified claims. Invoke `../../dist/manual-workflow.mjs build-review` once. It creates the Evidence/Review pair atomically without MCP, adapters, MCP Roots, hooks, cache, or state.

On success, present the returned `human_output` and then both returned artifact texts unchanged. Do not independently summarize findings or next action. Unprotected success is at most provisional; failed required Checks remain blocking. On a Shadow error, present its single recovery action and create no pseudo-artifact while retaining the supplied bytes in the task.

Never mutate during Review. Optional protected sealing is a separate explicit capability; it may append a new protected result but never edits the Manual artifacts.
