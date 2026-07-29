# Release checklist

## Deterministic checks

- [ ] Build the runtime validator and all three controller bundles; verify generated parity.
- [ ] Confirm local SDK/platform dependencies exactly match the pinned version and `dist` contains no misleading vendored copy.
- [ ] Run all Node tests, plugin validation, Markdown link checks, context target/ratchet checks, and dependency audit review.
- [ ] Confirm the versioned context load graph matches direct Command/Skill links, counts each file once, keeps oneshot Planning free of Design, keeps base Review free of Correction/Learning, and keeps Correction Review free of Learning closeout. Any baseline update must be an explicit reviewed diff after every target passes.
- [ ] Confirm complete schema-3 `oneshot`, `compact`, and `full` chains pass, while every schema-2 artifact and mixed schema-2/3 chain fails before graph materialization.
- [ ] Confirm missing explicit plan/review/evidence fields, evidence classes, topology links, Learning candidates, exact assurance values, and required writer tiers fail without normalization or repair.
- [ ] Confirm closed artifact/configuration/policy objects reject unknown fields, while top-level `extensions` and scalar, live-validated `model_options` remain valid. Artifact extensions must change the raw hash but not the authoritative projection hash, reach no model/manual semantic consumer, survive existing-root Planning unchanged, and be stripped when invented during goal Planning.
- [ ] Confirm `oneshot`, `compact`, and `full` requirements, evidence classes, slices, automation bounds, and target containment.
- [ ] Confirm every public state, transition, gate, downgrade, interruption, revision conflict, idempotent replay, and active-run lock is table-tested.
- [ ] Confirm `/work-status wp-*` derives Root approval, Review, human Correction approval, post-Correction Review, clarification, replan, retry and achieved states from exact schema-3 artifacts without creating a Store, file, event, lock, receipt, Preparation or Run.
- [ ] Confirm missing manual chat artifacts yield `waiting-human`/`provide-artifacts`, while schema-2, mixed, branched, cyclic and semantically invalid present chains yield `replan`; dirty files never count as approval.
- [ ] Confirm exact model/effort/options validation, requested/accepted/observed receipts, input/produced artifact-projection binding, remap denial, pricing accounting, same-Agent Planner repair, Writer affinity, and one-way bounded Writer escalation.
- [ ] Confirm `workflow_prepare` accepts exactly one goal or valid schema-3 Root, invokes no Planner for schema 2/incomplete schema 3, captures exactly one Plan or Intent-blocker report, and creates no Run.
- [ ] Confirm Planning budgets, expiry, semantic Root diff, Root-hash approval, one-time consumption, atomic Run binding, idempotent crash reconciliation, and inherited immutable Planner receipts.
- [ ] Confirm Planner, Reviewer, and Explainer have no product write path; Writer receives only the root/project target intersection.
- [ ] Confirm protected paths/oracles, dependency manifests, secret signatures, repository drift, external effects, and every budget fail closed.
- [ ] Confirm host Checks use direct argument vectors, no shell syntax, no controller secrets, a writable temporary directory, and denied network.
- [ ] Confirm MCP exposes exactly seven tools, uses `${CURSOR_PLUGIN_ROOT}`, and has no runtime install/latest chain.
- [ ] Confirm the private Marketplace validates against the official schema, contains exactly this plugin with `source: "."`, and is installed from the recorded RC commit.
- [ ] Confirm the Worker runtime is provisioned only by explicit operator action, binds Plugin/Worker/lock inventory/SDK/platform hashes, refuses overwrite, and development or environment overrides force Shadow Mode.
- [ ] Confirm new runs contain exact plugin, artifact, run-record, and controller protocol versions; capability Receipt schema 2 is closed, expires within 30 days, rejects schema 1, and invalidates every version/hash/route/runtime/harness drift.
- [ ] Confirm Pause, Stop, and deadline use a cooperative sentinel and terminal SDK `cancelled` receipt; only a grace-period overrun is hard-killed and derived `interrupted`.
- [ ] Confirm older run files are unchanged and status/watch-only as `read-only-incompatible`, cannot be controlled, answered, resumed, or counted as history, and do not block new schema-3 runs.
- [ ] Confirm `/explain-work` is available before and after achievement, stays chat-only, and ships no Rule or Hook.
- [ ] Confirm no queue, parallelism, push, PR, merge, deploy, automatic learning, or production-success claim exists.

## Capability spike

Run `npm run capability-spike` first. It must report static observations honestly and `automation_safe: false` while hard SDK/Marketplace boundaries remain unproven.

Before any live call, review the production dependency audit. High/Critical always blocks issuance. SDK/transport-path Moderate requires a separate hashed human risk acceptance. Never use overrides, `npm audit fix`, or `--force` to satisfy this gate.

A positive activation additionally requires:

- [ ] MCP start from the actually installed Marketplace copy.
- [ ] Exact SDK and matching platform runtime resolve from the actually installed Marketplace copy without an install-on-first-use step.
- [ ] Live exact model catalog validation using a valid environment-only `CURSOR_API_KEY`.
- [ ] Paid read-only Agent create/resume smoke with explicit `--approve-sdk-cost`, unchanged repository, matching model receipts, request IDs, usage, and external store recovery.
- [ ] Paid Plan-mode smoke captures exactly one `CreatePlan`, excludes simultaneous Intent blockers, prevents repository mutation, and preserves Planner Agent affinity across one validator repair.
- [ ] Hard proof that SDK tool calls cannot write outside Writer targets.
- [ ] Hard proof that SDK tool calls cannot reach unapproved networks while model transport remains functional.
- [ ] Hard proof that SDK tool calls cannot read controller/API secrets.
- [ ] Crash/restart/resume and cancel behavior verified without fabricated success or stale state.

If any hard observation is negative, unavailable, classifier-derived, or merely asserted, do not create a positive external capability receipt. Auto profiles remain Shadow Mode.

The receipt-bearing command, exact 25 USD phase allocation, ten-run history matrix, and positive/negative Unattended pilots are specified in the [certification runbook](certification-runbook.md).

## Cursor CLI and Editor harness

Use only `/private/tmp/cursor-plugin-harness` for functional Cursor tests. Before testing, capture Git status, binary diff, and hashes of existing dirty files. Never reset, stash, overwrite, or clean pre-existing changes.

Manual schema-3 acceptance:

- [ ] Clear Plan skips an unnecessary interview; material ambiguity uses the native Question UI or a blocking no-plan fallback.
- [ ] **Implement Plan** still performs initial manual delivery and emits full evidence.
- [ ] Ask review starts in a fresh context, inherits no Writer assumptions, remains non-mutating, and accepts Cursor-provided inspection capabilities.
- [ ] Misleading artifact filenames or caller labels do not affect root, evidence, review, or correction topology; consumers resolve the semantic `artifact` field.
- [ ] Agent applies only the human-approved correction; repeated correction is idempotent.
- [ ] `/explain-work` is preliminary during work and source-backed after achievement without mutation or artifact output.
- [ ] `/work-status [wp-id]` reports the manual chain through the shared state graph, retains human implementation/Correction gates, and makes no model call or persistent change.
- [ ] `/learn-from-work` persists only confirmed, human-invoked closeout guidance and remains idempotent.
- [ ] Schema-2 and mixed chains fail with an incompatible-root/replan instruction in every manual Command, including `/explain-work`.

Controller acceptance after capability activation only:

- [ ] Goal and valid existing Root both use Premium Planning; invalid/old Roots never reach the Planner; material Intent questions return to `/plan-work` without a headless interview.
- [ ] A Root-ready Preparation displays Root, semantic diff, hashes, exact Planner receipt and usage; explicit hash-bound Root approval and a proposed downgrade are separate visible gates.
- [ ] Preparation status/watch/stop, expiry, crash recovery, one-time consumption, and Run creation with `plan_approved: true` behave as documented.
- [ ] One external worktree and `workflow/<run-id>` branch are used; source-repository drift stops the run.
- [ ] Slice gates, final auto-gated acceptance, bounded corrections, single escalation, pause/resume/stop, crash recovery, local checkpoints, and run-owned rollback after unauthorized Writer changes behave as documented.
- [ ] Unattended eligibility rejects full design, hard triggers, planned human gates, dependencies, effects, missing history/oracles/certification, and incomplete receipts.
- [ ] No successful run integrates or publishes its branch.

Existing harness files must remain byte-identical. Remove only run-owned temporary content and finish with the harness's own deterministic tests.
