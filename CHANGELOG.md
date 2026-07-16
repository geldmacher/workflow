# Changelog

## 2.1.0

- Added optional `/learn-from-work [instruction]` and `work-learning` for direct, project-local learning closeout at any human-selected workflow stop.
- Added root-unique `LRN-*` correction candidates with Finding links, reusable guidance, candidate destinations, and confirmation evidence.
- Added semantic validation and root-chain uniqueness for declared candidates while preserving legacy schema-2 corrections as diagnostic, candidate-free input.
- Kept learning candidates output-only during review and correction; only complete correction evidence plus current repository support makes them eligible for closeout.
- Added deterministic target routing that first updates existing guidance, then materializes reusable Learnings as type-correct Cursor Rules, Skills, Subagents, or Commands; the linked docs page is a true last fallback.
- Added idempotency, semantic deduplication, fallback migration, and safety guidance without shipping rules, hooks, MCP servers, or autonomous publishing.

## 2.0.0

- Added the human-governed Plan → native implementation → Ask review → Agent correction loop.
- Added Intent Readiness, immutable root scope, adaptive assurance, progressive full/delta evidence, stable Finding keys, and idempotent correction.
- Added a two-phase Plan flow that uses Cursor's native Ask Question Tool for material Intent decisions before loading full planning contracts or creating a root plan, with a blocking prose fallback only after native invocation failure.
- Canonicalized post-interview `CreatePlan` output while accepting Cursor's current native wrapper, explicit embedded `None.` markers, and numeric comparison text without false placeholder failures.
- Made Cursor modes authoritative for capabilities and sandbox behavior; runtime guidance does not probe or redefine their tool surface.
- Enabled Ask review to use any Cursor-provided inspection capability, including semantic search, browser/documentation access, MCPs, and subagents.
- Reduced the protocol to root plans, delivery evidence, cumulative reviews, and embedded corrections; constraints live in the root and resume derives from repository/evidence state.
- Added tolerant extraction, flexible stable IDs, optional metadata, heading/table aliases, adaptive sections, equivalent Check execution, change-impact reuse, optional audit helpers, and diagnostic churn handling.
- Kept semantic blocking for ambiguous roots/tips, missing achieved evidence, unsafe reuse, scope/risk expansion, and absent human approval.
- Kept delivery at the repository boundary without autonomous publishing, deployment, production access, or production-success claims.
