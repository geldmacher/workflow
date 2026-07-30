# Derived Workflow state

State is projected from the immutable Intent Root, current Strategy revision, evidence, Decision Ledger, approvals, and repository observations. It is never a repository artifact.

Snapshots expose Intent hash, Strategy revision/hash, requested/effective Profile, evidence grade, delivery status, deviations, Dirty Baseline hash, Qualification Key, blockers, actor, allowed actions, and revision. Manual snapshots use `artifact-chain` and no Run; controller snapshots use `controller-run`.

Verified supervised delivery waits at `delivery-ready-verified`; provisional delivery waits at `delivery-ready-provisional`. Human acceptance produces `achieved` or `accepted-provisional`. A known failed acceptance check produces `blocked` and cannot be accepted provisional. Only fully verified, accepted supervised Runs qualify for history. Autonomous may reach `achieved` directly only when every required check is verified.

Pause, resume, interruption, budget cancellation, and crash recovery preserve Strategy revisions and the hash-chained ledger. Status/watch are read-only. Workflow-3 documents and Runs appear as `read-only-workflow-3`; they cannot mutate, block active Workflow-4 work, or qualify.
