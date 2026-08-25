# Release validation

Repository validation covers Schema-6-only closed artifacts, absence of compatibility surfaces, external Host Adapter loading, deployment- and transition-bound protected Harness contracts, transactional lifecycle and human-decision recovery, active Root and workspace preservation, fresh Review, generated target parity, documentation, context budgets, links, and release-surface closure.

Architecture tests prove shipped Workflow core code has no command parser, program allowlist, process runner, model catalog, controller-owned sandbox, worktree, or retry recipe. Fake harnesses with different private execution choices must produce identical Core behavior when their PhaseResults are equivalent.

The critical automation group must retain at least 90 percent line and 85 percent branch coverage across the lifecycle, Host Adapter loader, Cursor automation hook, and Decision Receipts. The existing Native Cursor Authority and Cursor Review Guard branch floors remain at least 85 and 80 percent.

The repository's own scripts choose how to build and test this repository. Their concrete commands belong to the development harness, not shipped Workflow policy.
