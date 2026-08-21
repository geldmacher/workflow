---
name: accept-work
description: Ephemerally accept one current provisional Manual delivery. Use when the user invokes $accept-work with a provisional Schema-5 review chain.
---

# $accept-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [human-first output](../../references/human-output-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Require one exact complete current Schema-5 chain whose unique review tip permits provisional acceptance. Call `workflow_status` with the exact artifacts, explicit `root_plan_id`, and `manual_acceptance: provisional`.

Report `Quick decision`, complete human `Details`, then the authoritative `Agent and machine contract` containing `accepted-provisional`, the Root ID, `acceptance_persisted: false`, and the returned basis hash only when the tool returns them. Refuse verified, blocked, failed, incomplete, stale, mixed, ambiguous, or correction-pending chains. Do not create or modify files, artifacts, guidance, Git state, or persistent approval state.
