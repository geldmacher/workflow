Cursor owns native Plan UI. Emit one H1, then a `yaml artifact-envelope` containing the Schema-5 `work-plan`, never a generic `text` fence. Intent, Acceptance, Boundaries, and Risks may use prose, lists, or tables rather than fixed tables.

## Parent-model affinity

The Cursor-selected primary owns **Implement Plan**. Tasks omit model overrides or use `inherit`; subagents inherit its model or a configured Manual approved candidate. Plugin agents use `model: inherit`. The primary integrates results and closeout.

The final closeout todo starts with `[workflow-model-inherit-v1]` and carries typed `workflow_attestation` metadata. Earlier `STEP-*` todos may omit it. Wrapper metadata never enters the Root or `extensions`.

For `replan`, preserve decisions not reopened by the source review. Use a fresh Root ID with exact `predecessor_plan_id` and `replan_source_review_id`. Cursor suspends the immutable predecessor, stages the candidate, and activates it only from a successful `CreatePlan` receipt matching `conversation_id`, `generation_id`, `tool_use_id`, Root ID, and exact Root hash. Failure or mismatch leaves both inactive until a valid retry or explicit predecessor re-approval. Cursor exposes no stable internal Plan UI ID.

Put the explicit `### Verification` table directly inside `## Acceptance`, before its next H2. Columns: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites`. Other sections stay semantic; compact/full nests [Design depth](design-contract.md) H3 tables when applicable. Steps may exist only as native `STEP-*` todos.

The host guard validates the exact Root locally; standalone `workflow_plan_preflight` is optional transport. Missing steps or typed closeout fail. End with `[workflow-model-inherit-v1] Verify checks and close out delivery.` and metadata `workflow_attestation: { schema: 1, kind: plan-closeout, action: delivery-closeout }` before human **Implement Plan** approval. Legacy `action: workflow_closeout` remains accepted; visible todo text contains no closeout ceremony.

## Codex proposed_plan

Codex returns `<proposed_plan>` with the exact Schema-5 Root and one typed plan-closeout attestation in `## Final implementation step`; see [closeout](./closeout-contract.md).
