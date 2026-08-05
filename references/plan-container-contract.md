Cursor owns native Plan UI and capabilities. Emit one H1, then a fenced `yaml artifact-envelope` containing the Schema-5 `work-plan`, never a generic `text` fence. Intent, Acceptance, Boundaries, and Risks may use fitting prose, lists, or tables.

## Parent-model affinity

The Cursor-selected primary owns **Implement Plan**. Subagents inherit its model; omit Task overrides. Plugin agents use `model: inherit`. The primary integrates results and closeout. Workflow selects no model.

Every native todo, including each `STEP-*` and closeout, starts with `[workflow-model-inherit-v1]`. This internal marker belongs only to the Plan wrapper, never the closed Root or `extensions`.

For `replan`, preserve confirmed decisions unless reopened by the source review. Create a fresh Root ID with exact `predecessor_plan_id` and `replan_source_review_id`; the predecessor stays immutable and the replacement needs native human approval.

Ready plans use these table columns:

- Intent: `Readiness item | Resolution | Evidence`, plus `Decision ID | Choice | Rationale | Rejected alternative | Source` or `None.`
- Objectives: `Objective ID | Observable outcome | Acceptance evidence`.
- Baseline: `Evidence ID | Kind | Observation | Source`, including `repository`.
- Scope: `Category | Targets | Boundary`, with lower-case `required`, `permitted`, `prohibited`.
- Steps: `Step ID | Objectives | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action`.
- Verification: `Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites`; Checks only, PROBEs stay in Steps. Every objective has a cheapest sufficient falsifiable required Check; duplicate or non-essential expensive proof is deferred.
- Operations: `Concern | Requirement | Repository proof`; non-runtime uses one `Not applicable` row.
- Risk: `Factor | Score | Evidence`; controls may be `None.` when optional.

Compact/full nests [Design depth](design-contract.md) H3 tables in the eight H2s. Numbered H2s, shortened tables, unmarked or missing `STEP-*` todos fail; aliases are input tolerance only. Run read-only `workflow_plan_preflight` on the exact Root before `CreatePlan`; it grants no approval. End with one marked `workflow_closeout` todo supplying exact Root/chain and printing its valid artifact unchanged. The Schema-5-only guard enforces this before human **Implement Plan**.
