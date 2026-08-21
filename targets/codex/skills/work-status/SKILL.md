---
name: work-status
description: Derive Manual Workflow status from an exact Schema-5 artifact chain. Use when the user invokes $work-status.
---

# $work-status

Read [Manual Workflow](../../references/manual-workflow-contract.md), [human-first output](../../references/human-output-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [state contract](../../references/state-contract.md) completely.

Prefer exact Schema-5 Root/Evidence/Review bytes visible in this task. Do not restore Manual authority from `workflow_artifact_context`, hook state, cache, or another task. When the exact current Root ID is known but returned bytes are no longer visible, `workflow_status` may perform one content-bound cache enrichment and must revalidate the exact bytes; ambiguity or conflict stops. Provisional acceptance still requires the explicit complete chain. Missing Evidence means fresh Review is next, not invented status. Use `### Next step` while action remains and compact `### Done` for achieved.

Report `Quick decision`, complete human `Details`, then the authoritative `Agent and machine contract` with the exact derived state and continuation fields. Do not infer Controller preparations or runs: Codex Workflow has none. Do not mutate repository, artifacts, acceptance, or operational state.
