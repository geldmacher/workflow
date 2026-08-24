---
name: accept-work
description: Ephemerally acknowledge one current provisional Manual delivery.
---

# /accept-work

Read [work-automation](../skills/work-automation/SKILL.md). The command token remains `accept-work` for compatibility, but it only acknowledges `[wp-id] provisional` against exact current-task Root/Evidence/Review bytes.

Collect the complete current Schema-5 Manual artifact chain and call `workflow_status` with those exact artifacts, optional `root_plan_id`, and `manual_acceptance: provisional`. Proceed only for one `delivery-ready-provisional` Root and its unique current review tip. Report `accepted-provisional`, resolved `root_plan_id`, `acceptance_persisted: false`, and `acceptance_basis_hash` only when returned. Say explicitly that the acknowledgement applies only to this response, is not persisted or verified, and that later status returns `delivery-ready-provisional`; it grants no Qualification or Learning authority. Do not create or modify state, artifacts, guidance, or Git. Refuse verified, blocked, failed, incomplete, mixed, legacy, stale, ambiguous, or correction-pending chains.
