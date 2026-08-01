---
name: accept-work
description: Ephemerally accept one current provisional Manual delivery.
---

# /accept-work

Read [work-automation](../skills/work-automation/SKILL.md). Accept `[wp-id] provisional`; without `wp-*`, use the unique active native Cursor Plan.

Collect the complete current Schema-5 Manual artifact chain and call `workflow_status` with those exact artifacts, optional `root_plan_id`, and `manual_acceptance: provisional`. Proceed only for one `delivery-ready-provisional` Root and its unique current review tip. Report `accepted-provisional`, resolved `root_plan_id`, `acceptance_persisted: false`, and `acceptance_basis_hash` only when returned. Do not create or modify state, artifacts, guidance, or Git. Refuse verified, blocked, failed, incomplete, mixed, legacy, stale, ambiguous, or correction-pending chains.
