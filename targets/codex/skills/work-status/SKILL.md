---
name: work-status
description: Derive Manual Workflow status from an exact Schema-5 artifact chain. Use when the user invokes $work-status.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Collect exact Schema-5 Root/Evidence/Review bytes from this task only. Do not restore Manual authority from `workflow_artifact_context`, hook state, cache, or another task. `workflow_status` remains optional convenience and must receive the explicit complete chain. Missing Evidence means fresh Review is next, not recovery or invented status. Use `### Next step` while action remains and compact `### Done` for achieved.

Do not infer Controller preparations or runs: Codex Workflow has none. Do not mutate repository, artifacts, acceptance, or operational state.
