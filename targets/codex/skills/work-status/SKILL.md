---
name: work-status
description: Derive Manual Workflow status from an exact artifact chain.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [local builder](../../references/manual-builder-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Collect exact Schema-6 Root/Evidence/Review bytes from this task only. Reject every unsupported artifact schema. Do not restore authority from IDs, hook state, cache, or another task. Set `presentation_locale` to `de` only when the human's active request is German, otherwise `en`, then invoke `../../dist/manual-workflow.mjs status` with the explicit complete chain. Missing Evidence means fresh Review is next, not invented status.

Render `human_output` once and decorate only `snapshot.next_action` through the fixed Codex mapping. Do not independently assess or add another action. Do not infer commands, tools, models, harness strategy, or Controller execution. Do not mutate repository, artifacts, acceptance, or operational state.
