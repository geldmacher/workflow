# Derived Workflow state

State is derived from Intent Root, current Strategy, evidence, Decision Ledger, approvals, and repository observations; it is never an artifact.

Snapshots expose hashes, Strategy revision, Profiles, evidence/delivery, deviations, Dirty Baseline, Qualification Key, blockers, actor, actions, and revision. Manual uses `artifact-chain` without a Run; controller uses `controller-run`.

An explicit selector wins. Otherwise resolve the unique active native Cursor Plan lineage tip from exact current-task artifacts; only without Manual context may status fall back to a unique active controller subject. Missing or multiple tips request context and authorize nothing.

Verified Manual delivery reaches `achieved` after successful review. A current provisional Manual review waits at `delivery-ready-provisional`; `/accept-work [wp-id] provisional` asks `workflow_status` for an ephemeral `accepted-provisional` snapshot with resolved `root_plan_id`, `acceptance_persisted: false`, and an `acceptance_basis_hash`. A later status call without that parameter returns `delivery-ready-provisional` again.

Verified supervised delivery waits at `delivery-ready-verified`; controller provisional delivery waits at `delivery-ready-provisional`. A known failed acceptance check produces `blocked` and cannot be accepted provisional. Only fully verified, accepted supervised Runs qualify for history. Neither Manual provisional acceptance nor any `accepted-provisional` Run qualifies or publishes learning automatically. Autonomous may reach `achieved` directly only when every required check is verified.

Pause, resume, interruption, budget cancellation, and crash recovery preserve Strategy revisions and the hash-chained ledger. Status/watch are read-only. Workflow-3 and Workflow-4 documents and Runs appear as `read-only-workflow-3` or `read-only-workflow-4`; they cannot mutate, block active Workflow-5 work, or qualify.
