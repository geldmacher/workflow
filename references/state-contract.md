# Derived workflow state

Workflow state is a projection of the immutable Root, artifact tips, controller events, approvals, and repository observations; never a repository artifact.

An external `PlanningPreparation` freezes source, profile, hashes, baseline, budget, Planner receipts/usage, Root or blockers, expiry, revision, and consuming Run. Only `root-ready` may be consumed once with matching Root hash/revision. Status/watch are read-only; only `stop` mutates an open Preparation.

Snapshots expose identity/profile/design, compatibility, `state`, source, actions, actor, next action, artifact tips, blockers, downgrade reason, revision, artifact hash, and time. Controller snapshots use `controller-run` plus numeric revision; manual snapshots use `artifact-chain`, null Run/revision, and an order-independent hash. `scripts/derive-workflow-state.mjs` is canonical.

`workflow_status` accepts one Run, one Preparation, one manual Root plus exact `{label,text}` artifacts, or no selector for one active controller subject. Manual derivation is stateless/read-only: missing members require `provide-artifacts`; invalid present chains require `replan`; Root-only requires human **Implement Plan**; `correct` requires human `/correct-work`; Correction Evidence requires `/review-work`. Dirty files prove nothing.

`workflow_watch` starts at event cursor zero with a timeout of at most 30 seconds. Continue from its returned cursor only while the user requests monitoring; unchanged state is not progress.

Illegal or ambiguous transitions never guess. They resolve to `waiting-human`, `replan`, `interrupted`, or `failed`. A requested unattended profile that is downgraded pauses for explicit acceptance. `auto-gated` reaches `delivery-ready` before human acceptance; an eligible unattended run may reach `achieved` after root review.

Historic records without the frozen protocol are `read-only-incompatible`, `stopped`, and blocked. Status/watch remain readable; mutation, active-run blocking, and history reuse are denied.
