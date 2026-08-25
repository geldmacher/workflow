---
name: review-work
description: Perform a fresh repository-read-only review of one exact portable Schema-6 delivery.
compatibility: Requires an Agent Plugins v1 client with Agent Skills and stdio MCP support, Node.js 22+, and PLUGIN_ROOT/PLUGIN_DATA support.
---

# Review work

Use a fresh read-only phase in the current task; another task is optional. Read [portable Manual boundaries](../../references/portable-manual.md), [Manual Workflow](../../../../references/manual-workflow-contract.md), [artifact protocol](../../../../references/artifact-protocol.md), [delivery evidence](../../../../references/delivery-evidence-contract.md), [review contract](../../../../references/review-contract.md), [host-owned input](../../../../references/work-review-input-contract.md), and [explanation contract](../../../../references/explanation-contract.md) completely.

Require one exact current Schema-6 Root from the conversation. Cache is transport only. Reject every unsupported artifact schema. Invalid, stale, conflicting, or ambiguous Root bytes stop substantive Review.

Declare repository-read-only intent. The project harness chooses every concrete inspection mechanism and returns protected before/after snapshots plus Check attestations. Workflow evaluates only their bindings and status, never commands, tools, models, frameworks, routes, retries, sandboxes, or worktrees.

Missing harness evidence keeps the Root and produces provisional Evidence. Passing bound attestations may verify; failed attestations block; contradictory bindings are rejected; human-decision Checks remain human gates.

Return one closed Schema-1 `review_input` and call `workflow_closeout` with `artifact_kind: work-review`, the exact Root, and current-task lineage. The builder returns Delivery Evidence and Work Review atomically or neither. Do not author IDs, bindings, grades, snapshots, hashes, or artifacts.

Never mutate or trigger external effects during Review. Lead with outcome and limitations, keep technical traceability secondary, and give one lifecycle-level next action.
