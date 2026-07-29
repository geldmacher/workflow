# Changelog

## 3.0.0

- Added one shared profile model for `manual`, `auto-gated`, and computed `unattended-eligible` operation while preserving the existing human-approved manual loop.
- Replaced the artifact contract with breaking schema 3 for plans, evidence, reviews, and corrections. All semantic fields, evidence classes, topology links, assurance values, and automation bounds are explicit; schema-2 and mixed chains are rejected without migration or runtime conversion.
- Closed artifact, user-configuration, project-policy, route, pricing, budget, policy, and automation objects while retaining an opaque, non-authoritative top-level `extensions` object and scalar, live-validated `model_options`. Artifact extensions remain raw-hash-auditable but are excluded from the stable model-facing projection, never interpreted by manual components, restored outside the model for existing roots, and stripped when invented during goal planning.
- Versioned new Preparations and Runs with artifact schema 3, record schema 1, controller protocol 3, and plugin version 3.0.0; capability receipts use a separate closed schema 2 with 30-day expiry and schema-1 rejection. Earlier Runs remain immutable, status/watch-only, incompatible with resume/control, and excluded from active-run locks and qualifying history.
- Added a freshly derived `WorkflowSnapshot` state machine without introducing repository session state.
- Made the same state graph available to manual schema-3 chains through stateless `/work-status [wp-id]`, with human Plan/Correction gates, explicit missing-context handling, artifact fingerprints, and no Run, persistence, API key, or model call.
- Added the anytime, chat-only `/explain-work` Command with a fresh-context `work-explainer`, plus a focused design auditor.
- Added `/auto-work`, `/work-status`, `/work-watch`, `/work-control`, and `/work-models` backed by seven versioned stdio MCP tools, including `workflow_prepare`.
- Added a pinned Cursor SDK worker adapter, exact catalog validation, requested/accepted/observed model receipts, separately frozen input/produced artifact-projection hashes, `fallback: deny`, stable Premium Plan → Economy Write → Premium Review phase routing, Writer-owned corrections, and one-way bounded Writer escalation.
- Added Premium Auto-Planning for both goals and valid schema-3 Roots as a read-only, budgeted Preparation phase. It captures exactly one Cursor `CreatePlan` or at most three material Intent questions, repairs technical validation errors with the same Planner Agent, computes semantic Root diffs, and creates no Run before explicit hash-bound approval.
- Added one-time Preparation consumption and atomic Run binding with frozen baseline/configuration/policy/harness hashes, Planner receipts, expiry, revisions, request-bound idempotency, status/watch/stop, and crash reconciliation.
- Made Automation context phase-specific: Preparation, state/control, and model-routing Commands load only their required contracts, while Premium Planning receives a focused versioned Preparation contract.
- Focused manual Commands and Skills on invocation and phase control, made Correction candidate authoring independent from Learning closeout, and added versioned phase-load measurement with per-file breakdowns, explicit targets, and a checked no-growth context ratchet.
- Hardened the optimized context paths with fresh Writer-independent manual Review, semantic `artifact`-field resolution instead of filenames, and automatic Command/Skill/load-matrix consistency checks.
- Added external atomic run state, JSONL events, optimistic revisions, idempotency, per-run process locks, isolated worktrees/branches, direct-argv host checks under a network-denied sandbox, protected paths/oracles, drift and secret checks, budgets, pause/resume/stop, local checkpoints, and host-owned integration.
- Added a static and optionally live capability spike. The current adapter intentionally remains in Shadow Mode until Marketplace packaging plus SDK write, network, secret, attestation, and restart/resume boundaries are positively proven for the pinned versions.
- Added an explicit deterministic Worker-runtime provisioner, plugin/runtime provenance binding, cooperative SDK `Run.cancel()` for Pause/Stop/deadlines, hard-cancel interruption semantics, private RC Marketplace metadata, three-run canary probes, audit/cost gates, and atomic capability-receipt issuance. Development and environment-overridden Workers remain Shadow-only.
- Kept queueing, parallel execution, push, PR, merge, deploy, automatic learning, hooks, and always-on Rules outside 3.0.0.

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
