---
name: accept-work
description: Ephemerally accept one current provisional Schema-6 Manual delivery.
---

# $accept-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Require one exact complete current Schema-6 chain whose unique review tip permits provisional acceptance. Call `workflow_status` with the exact artifacts, explicit `root_plan_id`, and `manual_acceptance: provisional`.

Report the ephemeral decision only when returned. Refuse unsupported, verified, blocked, failed, incomplete, stale, mixed, ambiguous, or correction-pending chains. Do not create or modify files, artifacts, guidance, Git state, or persistent approval state.
