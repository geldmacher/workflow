# Derived Workflow state

State is derived, never stored. Snapshots expose delivery, Profile, blockers, actor, actions, revision, and source. Manual status adds `Meaning:` plus the state [guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md#manual-states); unknown states use its generic topic, controller states none.

`workflow_status.learning` is a uniform read-only projection for Manual chains, Runs, and Preparations (ineligible), with source binding, eligibility/blockers, workspace/delivery proof, compatibility, and candidates. An explicit selector wins; otherwise resolve one Plan tip, then one controller subject only without Manual context. Zero/multiple tips authorize nothing.

Manual `achieved/verified/none` completes directly; provisional needs ephemeral `/accept-work provisional`, stays nonpersistent/non-qualifying, and grants no Learning. Terminal snapshots need no actor.

Supervised qualifies only after verified acceptance; Autonomous needs every required Check and no final acceptance unless downgraded. Controller Learning also needs current-workspace content plus the process-local receipt issued when state-establishing start/control/answer returned that Run. Stored-ID status/watch lookup is diagnostic and issues no receipt.

Recovery preserves Strategy revisions and the chained candidate/path ledger. Broken lineage, fresh Root/Strategy integrity, event schema, reviewer receipts, Git objects, integration, or drift proof blocks Learning. Status/watch mutate nothing. Workflow-3/4 remains read-only and non-qualifying.
