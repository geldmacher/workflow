# Release validation

Repository validation covers Schema-6-only closed artifacts, absence of compatibility surfaces, external Host Adapter loading, deployment- and transition-bound protected Harness contracts, transactional lifecycle and human-decision recovery, active Root and workspace preservation, fresh Review, generated target parity, documentation, context budgets, links, and release-surface closure.

Architecture tests prove shipped Workflow core code has no command parser, program allowlist, process runner, model catalog, controller-owned sandbox, worktree, or retry recipe. Fake harnesses with different private execution choices must produce identical Core behavior when their PhaseResults are equivalent.

The critical automation group must retain at least 90 percent line and 85 percent branch coverage across the lifecycle, Host Adapter loader, Cursor automation hook, and Decision Receipts. The existing Native Cursor Authority and Cursor Review Guard branch floors remain at least 85 and 80 percent.

The repository's own scripts choose how to build and test this repository. Their concrete commands belong to the development harness, not shipped Workflow policy.

The repository-local GitHub Release harness exposes read-only status, deterministic preparation, and a separately authorized receipt-bound publication action. Focused tests use controlled Git and GitHub substitutes to cover authentication, tag and commit binding, receipt drift, drafts, partial or conflicting releases, idempotent retries, and read-back failures without creating a live release. Archive tests independently prove stable bytes, one root directory, canonical manifest placement, preserved executable modes, target exclusions, symlink rejection, and recognizable-secret rejection. Two complete preparations also build the real Cursor and Codex targets from one isolated clean release-cut snapshot and compare every published byte and the resulting receipt. Documentation tests parse the complete personal Marketplace example and preserve selected-host checksum usability, update and rollback separation, Hook Trust, desktop restart, installed-cache, Plugins Directory, and fresh-task activation guidance in both host packages.

`release:prepare` runs the complete repository release gate before writing ignored `.build/releases/v<version>/` output. `release:publish -- <receipt-sha256>` does not create or push commits or tags, overwrite or delete assets, deploy a plugin, or activate a host.
