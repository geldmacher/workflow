---
name: review-work
description: Perform a fresh read-only Workflow delivery review. Use when the user invokes $review-work or requests review against a Schema-5 Root.
---

# $review-work

Use a fresh Codex task. Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), [delivery evidence](../../references/delivery-evidence-contract.md), and [review contract](../../references/review-contract.md) completely.

Resolve one exact Schema-5 Root/Evidence chain from task artifacts. `workflow_artifact_context` may enrich transport but never grants authority. No Root means request context; no Evidence means prescribe `$close-work`. Invalid, conflicting, mixed-version, stale, or ambiguous chains block review.

Stay read-only. Do not edit files or run mutating tools. Optional built-in delivery, risk, or design auditors receive a bounded role prompt plus `[workflow-model-inherit-v1]` and no model/provider override. Verify their claims yourself; unattested output is not evidence.

Emit one Schema-5 `work-review` with the unique `wr-*` ID and calibrated `next_action` (`clarify`, `replan`, `retry-review`, `correct`, or achieved). Never raise evidence grades. Record the exact review using `workflow_artifact_record`. Any correction remains a separate human-authorized task.
