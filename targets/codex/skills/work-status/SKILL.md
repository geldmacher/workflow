---
name: work-status
description: Derive Manual Workflow status from an exact artifact chain.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Collect exact Schema-6 Root/Evidence/Review bytes from this task only. Reject every unsupported artifact schema. Do not restore authority from IDs, hook state, cache, or another task. Invoke `../../dist/manual-workflow.mjs status` with the explicit complete chain. Missing Evidence means fresh Review is next, not invented status.

Report lifecycle, evidence grade, limitations, required human decision, and one next phase. Do not infer commands, tools, models, harness strategy, or Controller execution. Do not mutate repository, artifacts, acceptance, or operational state.
