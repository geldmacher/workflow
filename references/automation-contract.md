# Generic harness authorization contract

Supervised and Autonomous share the Schema-6 lifecycle and generic Harness boundary.

PhaseRequest binds phase, Run/revision, transition/idempotency, Root/lineage, workspace, authority, verification, budgets, and read-only Review. It contains no execution policy.

PhaseResult binds deployment, transition, snapshots, paths, Check attestations, usage, limitations, and a protected reference. Only an external Host Adapter establishes trust; direct modules and self-hashes do not.

`protectedCapability` is atomic and idempotent. Only PhaseResults use Prepare → Stage/Recover → Result Ready → Commit Ready → Commit. Live foreign ownership returns `in_progress`; dead owners recover staging only, never blind mutating work.

Missing protection is phase-local Shadow Mode. Cursor injects receipts only after exact revision-bound Review Work or Correct Work prompts; Codex/portable remain Manual-only. Autonomous needs one exact deployment-bound qualification and verified evidence.

Implementation stops at Review needed. Review starts only through a separate human Review Work action. Correct Work applies one bounded Correction and stops again at Fresh Review pending. No profile automatically crosses one of these human phase boundaries.

Push, PR, merge, deploy, production, publication, integration, and automatic Learning are outside Workflow.
