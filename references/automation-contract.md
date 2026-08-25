# Generic harness authorization contract

Supervised and Autonomous share the Schema-6 lifecycle and generic Harness boundary.

PhaseRequest binds phase, Run/revision, transition/idempotency, Root/lineage, workspace, authority, verification, budgets, and read-only Review. It contains no execution policy.

PhaseResult binds deployment, transition, snapshots, paths, Check attestations, usage, limitations, and a protected reference. Only an external Host Adapter establishes trust; direct modules and self-hashes do not.

`protectedCapability` is atomic and idempotent. Only PhaseResults use Prepare → Stage/Recover → Result Ready → Commit Ready → Commit. Live foreign ownership returns `in_progress`; dead owners recover staging only, never blind mutating work.

Missing protection is phase-local Shadow Mode. Supervised needs human acceptance. Cursor injects receipts only after exact revision-bound decision prompts; Codex/portable remain Manual-only. Autonomous needs one exact deployment-bound qualification and verified evidence.

Push, PR, merge, deploy, production, publication, integration, and automatic Learning are outside Workflow.
