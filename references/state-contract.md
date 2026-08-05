# Derived Workflow state

State is derived from Root, Strategy, evidence, ledger, approvals, and observations; it is never an artifact.

Snapshots expose hashes, Strategy revision, Profiles, delivery, deviations, Dirty Baseline, Qualification Key, blockers, actor, actions, and revision. Manual uses `artifact-chain`; controller uses `controller-run`.

An explicit selector wins. Otherwise resolve the unique active Plan lineage tip; only without Manual context may status use one active controller subject. Missing or multiple tips authorize nothing.

Verified Manual delivery reaches `achieved` after review. A provisional review waits at `delivery-ready-provisional`; `/accept-work [wp-id] provisional` yields an ephemeral `accepted-provisional` snapshot with `root_plan_id`, `acceptance_persisted: false`, and `acceptance_basis_hash`. Later status returns provisional again.

Supervised delivery waits at `delivery-ready-verified` or provisional. Failed acceptance is `blocked`. Only verified, accepted Runs qualify; provisional acceptance never qualifies or publishes Learning. Autonomous `achieved` requires every required Check.

Pause, resume, interruption, budget cancellation, and crash recovery preserve Strategy revisions and the hash-chained ledger. Status/watch are read-only. Workflow-3 and Workflow-4 documents and Runs appear as `read-only-workflow-3` or `read-only-workflow-4`; they cannot mutate, block active Workflow-5 work, or qualify.
