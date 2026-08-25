# Changelog

## Unreleased

- Fixed release-check regressions: Host Adapter redirect rejection is exercised through a parent-directory symlink (Linux-stable), and Cursor plugin validator tests build the generated target instead of assuming `.build/plugins`.
- Removed direct project-Harness trust: only an external canonical Host Adapter outside the workspace may protect deployment-bound Capability and PhaseResult provenance.
- Added exact Cursor `/auto-work` human-decision prompts with task-, generation-, workspace-, Run-, revision-, and artifact-tip-bound host receipt injection plus narrow transport retry.
- Made automated Runs transactional through persisted Prepare, execution claim, host Stage/Recover, Result Ready, protected Commit, and atomic finalization with workspace-wide idempotency conflict detection.

## 6.0.0

- Replaced Workflow-owned execution policy with one generic project-harness boundary shared by Manual, Supervised, and Autonomous phases.
- Introduced closed Schema-6 Intent Roots with intent-only verification and protected Root/workspace/snapshot-bound Check attestations; removed all readers, records, migrations, fixtures, and state transitions for earlier Workflow schemas.
- Removed command parsing and classification, program allowlists, host Check execution, model routing, Verification Profiles, controller workers, sandboxes, worktrees, retry recipes, and their public commands.
- Made Review repository-read-only through harness before/after snapshot attestation rather than command-text inference; missing attestations stay provisional and attested failures stay failed.
- Preserved the exact active Cursor Root, canonical workspace, and Review selection across recoverable transport failure, revoked only the concrete receipt, and separated missing selection from missing Root.
- Added generic Harness Capability Receipt, PhaseRequest, PhaseResult, and Check Attestation contracts plus Shadow Mode that never blocks ordinary Cursor or Codex use.
- Established root `AGENTS.md` as the single central contributor Northstar and added architecture regression coverage for the Core-to-Harness boundary.
- Removed `/work-models`, `/work-verification`, `/work-watch`, and `/work-control`; kept repository build, test, and deployment scripts as development-harness concerns outside shipped Workflow policy.

## 5.5.1

- Restrict active Review Shell to one exact structurally safe machine-verifiable Root Check and reject command chaining, mutation flags, output options, changed test targets, and unknown npm scripts before execution.
- Split availability-first prompt observation from fail-closed active mutation enforcement; allow only exact conversation-bound transcript recovery for Review activation and force `review-observer-unavailable` delivery to remain supported/provisional.
- Canonicalize every Review workspace through the real Git toplevel and serialize conversation and turn state with owner-token/PID locks that never steal from a live process or release another owner's lock.
- Make provisional, stopped, blocked-controller, and Details output concrete: named evidence limits, ended-without-delivery completion, `resolve-blocker`, and complete human-first native Plan Next-step footers.

- Bind Cursor Manual Review to one validated CreatePlan Root, one canonical workspace, and an opaque single-use native receipt without claiming to observe the host-owned Implement Plan action.
- Attribute delivery only to repository changes after the recorded Plan or correction baseline, downgrade missing or drifting boundaries honestly, and serialize native state updates against concurrent loss or replay.
- Enforce active Review read-only behavior across mutating built-ins, shell, tasks, and MCP surfaces with a small fail-closed guard while keeping passive lifecycle observation separate.
- Present Plan, Manual MCP, and controller outcomes through one deterministic human-first projection with exact host actions, explicit limitations, and non-persistent provisional acknowledgement.
- Preserve Workflow 5 public schemas and tool contracts with frozen compatibility snapshots, critical authority coverage, sanitized Cursor payload replay, and synchronized patch-release validation.

- Block Manual work-review closeout from inheriting an Evidence tip as verified when its `changed_paths` no longer match the complete current dirty inventory.
- Require planners to inspect complete command wrapper and lifecycle-hook chains, keep required Review Checks repository-read-only, and reject ready Roots without sufficient read-only proof.
- Expand Cursor-provided `~/` workspace roots against the current home before canonical validation, reject other relative host roots explicitly, and clarify that MCP workspace/status availability never gates an already authorized native Plan implementation.
- Fix Cursor lifecycle workspace-root resolution, make globally installed Cursor and Codex hooks passive unless an explicit Workflow action is active, retain deliberate active Review/Plan denials, and report subjectless `workflow_status` as inactive instead of an operational error.
- Stop treating Codex hook `permission_mode` as native Plan-mode evidence; admit plugin-qualified `$plan-work` when collaboration-mode evidence is unavailable, retain explicit non-Plan rejection, and preserve exact Schema-5 Stop validation.

## 5.5.0

- Make Cursor and Codex native Plan contexts the sole Manual plan authority and ignore all pre-5.5 Manual active-root, plan-transaction, chain, closeout, and handoff state.
- Let Implement Plan and authorized corrections finish normally without lifecycle closeout, Evidence creation, mutation-baseline gates, typed attestations, or synthetic Stop continuations.
- Build missing full or delta Delivery Evidence and Work Review atomically in one fresh same-task read-only Review from exact native Root bytes, server-observed repository state, and direct reviewer Check observations.
- Keep high-risk and Hard-Trigger work on the full review route, return blocked Reviews for known failed required Checks, and make repository ambiguity an explicit limitation instead of a recovery loop.
- Remove native Cursor `/close-work` and Codex `$close-work` surfaces while retaining the five-tool portable compatibility contract and delivery-evidence mode.
- Release synchronized Cursor, Codex, and Agent Plugins targets as Workflow 5.5.0; deployment and live-host smoke remain separately authorized.

## 5.4.0

- Build every new authoritative Schema-5 `work-review` through one deterministic host-owned kernel shared by Cursor, Codex, controller, and portable Manual clients.
- Add the backward-compatible `work-review` mode to `workflow_closeout` while preserving the five-tool portable Manual surface and the `delivery-evidence` default.
- Reject new full unprotected caller-authored Review envelopes through both artifact recording and closeout-chain input, retain protected historical immutable reviews read-only, and keep valid task-local Reviews usable when optional handoff persistence fails.
- Keep malformed Review recovery bounded to one plain same-task retry with explicit preservation and field-level recovery guidance; reject null, coerced, or internally contradictory reviewer semantics in the shared kernel, and require non-adverse host-observed delivery/risk review for high-risk Roots.
- Kept Manual, supervised, and autonomous user journeys in one task by default; made optional cross-task handoff failure non-blocking for exact task-local Evidence; and added plain-language blocker plus resolution guidance before technical traceability.
- Simplified Manual delivery to the visible Plan → Implement Plan → Review loop with Root-scoped state across Cursor generations, internal closeout, finite recovery, exact correction/replan tips, conservative impact-based Check refresh, and one bundled hook dispatcher per host event.
- Made the lightweight loop deterministic under Hard Triggers and concurrent host processes: known failed Checks now short-circuit directly to correction, Check reuse follows objective/path/fingerprint dependencies, replans retain exact predecessor artifacts, and revisioned chain commits serialize without lost updates.
- Bound Cursor Stop continuations across their real next-generation boundary with exact generated-prompt hashes and `loop_count`, and invalidated plus recoverably replaced Evidence when a required Check fails after closeout.
- Fixed Codex Manual phase binding for exact bare, plugin-qualified, and host-rendered Workflow skill links; made pre-execution prompt rejection transactional; added bounded German implementation imperatives; and terminalized a repeated failed Stop after one continuation without Evidence, delivery success, or stale tool restrictions.
- Bound Cursor Workflow Roots to successful generation/tool-correlated `CreatePlan` receipts, kept replan predecessors as exact inert recovery context until a fresh lineage-valid Root commits, blocked implicit predecessor resume, required exact Root–Evidence–Review bytes for correction, and made completed or terminal chains quiet for later ordinary writes.
- Added a guided Manual Plan/Do/Review/Correct journey with one primary chat action, secondary Technical traceability, deterministic update keys, automatic native closeout, explicit portable enforcement limits, and a fail-closed two-round correction stop.
- Added exact task-Root, pre-mutation baseline, and direct path-authority gates for Cursor and Codex plus a narrowly invariant Schema-5 root-boundary Review that can authorize only a separately approved lineage-preserving replan.
- Made native Codex closeout use only host-derived changed paths for Evidence and Authority, with optional caller paths retained solely as non-authoritative compatibility hints.
- Bound exact task-local Root, Evidence, and Review bytes automatically for correction delta closeout without requiring MCP Roots or a prior `workflow_artifact_record`, while preserving immutable ID/hash and lineage conflicts.
- Added classified user-visible native closeout failures plus dry-run-first, hash-bound, dependent-safe Review quarantine that preserves the original record and prior index for recovery.
- Require fresh host-attested receipts before Manual machine-verifiable Checks may remain `verified`, with exact-command matching, repository-snapshot invalidation, 24-hour expiry, and no raw output retention.
- Add current-delivery constraint coverage, human-attention, problem-cause, recovery, and consistent next-step projections while keeping the normal Manual path unchanged.
- Make planning and review consider material correctness, security, maintainability, performance, efficiency, and comprehensibility signals without mandatory scanners or mutation testing.

## 5.3.0

- Added an additive Agent Plugins v1.0.0 target with a closed root manifest, nine portable Manual Agent Skills, and exactly five Manual MCP tools while retaining the native Cursor and Codex packages.
- Added pinned offline Agent Plugins schemas, package/skill/path/placeholder/secret validation, and a stdio smoke proving `PLUGIN_DATA` state isolation without package mutation.
- Documented portable Node.js, Agent Skills, stdio MCP, and plugin-environment requirements in the package and all nine skills, and tightened offline validation for every supported optional Agent Skills frontmatter shape while preserving YAML key/value types and counting Unicode code points correctly.
- Kept `deploy:local` native-only for Cursor and Codex, made dry-runs prepare from a disposable Git-visible system-temporary snapshot without mutating checkout or host state, and documented portable build, installation, compatible-client smoke, and publication as separate evidence boundaries.
- Made new correction closeouts refresh every inherited required Root Check not already passed, while reusing passed proof and allowing semantically equivalent Root/correction Checks to share one current probe without new schemas, commands, or phases.
- Made every emitted Manual review and reviewed controller handoff explain the result in a human-first layer before technical traceability, with final/preliminary state honesty and no extra controller phase, model call, artifact, or payload.
- Added a bundled English Manual Workflow guide plus concise state-, Evidence-, and recovery-specific `Meaning` and `Learn more` help in Manual presentation metadata and chat, without changing state derivation or command semantics.
- Made native lifecycle closeout the default Manual path on Cursor and Codex: one strict `closeout-input` supplies observations while the host independently binds exact Root bytes and lineage, captures the repository baseline, derives changed paths and snapshot, enforces authority, and persists builder-owned Schema-5 Evidence without an MCP call.
- Kept `workflow_closeout`, all five Manual MCP tools, legacy `action: workflow_closeout`, structuredContent, and delivery-report contracts compatible and optional; equal inputs use the same deterministic builder and conflicting native/MCP tips fail closed.
- Added one bounded read-only review recovery, provisional baseline-less recovery limits, known-failed Check preservation, later-mutation invalidation, local Manual preflight at every risk level, shared adversarial lifecycle coverage, and explicit repository-only verification boundaries without live-host certification claims.
- Bound Cursor closeout recovery to the current conversation Root and current Manual turn so ordinary Ask-mode Shell/Task use and stale workspace/plan tips cannot trigger or redirect Evidence attestation; explicit rootless closeout now reports no Root without starting recovery.

## 5.2.0

- Fixed Codex Manual MCP startup without `PLUGIN_ROOT` by locating and validating the packaged runtime from the bundle path, with a built-target Schema-5 preflight regression test.
- Hardened Cursor Manual closeout enforcement: `TodoWrite` cannot complete the plan-closeout todo before `workflow_closeout` records Evidence, Implement Plan prompts refresh the active Root, stop recovery without Evidence asks only for `workflow_closeout` (no invented `de-*` report), and unresolved `${workspaceFolder}` host env placeholders are treated as absent workspace config.
- Added human-invoked Learning parity across Manual, Supervised, and Autonomous delivery: controller correction reviewers may propose bounded advisory candidates through existing calls, status exposes uniform evidence-bound eligibility, and controller Learning blocks until verified delivered content matches the current workspace without enabling Codex controller automation.
- Hardened controller Learning with fresh Root/Strategy validation, explicit event-subject compatibility, retained reviewer-receipt attestation, exact Git object-kind matching, ephemeral current-task source receipts, and uniform ineligible Preparation projections.
- Clarified the three-profile human/agent contract and Manual acceptance semantics: the human-started fresh verified review completes the Root, terminal states require no actor, status shows effective Profile/actor/downgrade and readable host-approval expectations, achieved uses a compact Done notice, provisional acceptance stays explicitly ephemeral, and failed Manual tools always retain a recovery action.
- Added a recognizable Manual Next-step footer (Now/How/Why, plus Off track recovery) to MCP presentation text and Manual phase replies so humans see the exact next command, its benefit, and how to restore the happy path when blocked.
- Replaced free-form `[workflow-closeout-v1]` Manual closeout prose with one host-neutral typed attestation kernel: Cursor todos carry `workflow_attestation` metadata, Codex plans use a short final step plus a `yaml workflow-attestation` plan-closeout fence, and both hosts require a typed delivery-report plus exactly one native `workflow_closeout` `structuredContent` identity envelope (exact Evidence bytes, ID, raw digest, independently captured active Root, and full-root or correction lineage).
- Adapted host enforcement truthfully: Codex keeps a hard Stop on missing completion attestation and invalidates recorded closeout after later mutations, including `Task`/`Agent`/`spawn_agent`; Cursor records the approved Root during CreatePlan and Implement Plan prompts, denies completing the plan-closeout todo without recorded Evidence, observes closeout through `postToolUse` / `afterAgentResponse`, invalidates after mutating tools (including `Task`), and issues one bounded stop follow-up that is recovery, not an unbypassable hard block.
- Tightened attestation fail-closed rules so text transport never grants authority, expected lineage is mandatory in the shared kernel, persisted Evidence dumps are rejected, unpersisted Evidence must appear exactly once, and ordinary planning prose is not treated as unfinished-content.
- Bound Manual closeout completion to the independently captured active Root-content hash on Cursor and Codex, and made the shared adversarial lifecycle matrix executable across core, Cursor, Codex source, and generated-bundle suites.
- Kept review/status/recovery replies compact and mode-specific, with exact artifacts secondary and unpersisted Evidence attached exactly once.
- Finished Manual UX follow-up: blocked closeout routes to fresh review, status outcomes distinguish ready/partial/blocked, human changed-path text stays bounded, verified unpersisted Evidence remains ready with attach guidance, and compact Manual plans/replies keep exact artifacts in `structuredContent` without redundant chat dumps.
- Relocated the repository-only agentic delivery north star to canonical `.agents/AGENTS.md`, with relative root `AGENTS.md` and `.cursor/rules/agentic-delivery-north-star.mdc` entry points for Codex and Cursor, kept outside every shipped package surface.
- Made Codex planning risk-gated and fail-closed: low/medium Manual Roots without Hard Triggers may omit standalone preflight when the exact Root is presented, while high-risk/Hard-Trigger/controller Roots require a feasible exact-Root attestation and infeasible results never authorize presentation.
- Made Manual closeout presentation Evidence-aware so blocked/failed Evidence is never shown as ready, changed paths appear in closeout checks, and host tool-approval preferences render from `tool_approval` instead of `[object Object]`.
- Simplified the Manual happy path so CreatePlan validates Schema-5 Roots internally, standalone preflight stays optional for low/medium Manual without Hard Triggers, and handoff record/context are best-effort transport that never block exact task-local artifacts.
- Restored calm Manual MCP tool text that leads with outcome, checks, gaps, and next action while preserving backward-compatible `structuredContent` fields and exact artifacts.
- Required only the final closeout todo to carry `[workflow-model-inherit-v1]`; Codex planning Stop no longer blocks on missing handoff record.
- Preserved approved Schema-5 Verification checks from preflight through execution contract and deterministic closeout through one canonical extractor, with historical top-level synthesis compatibility.
- Kept `workflow_artifact_context` mutation-free for missing, corrupt, or stale handoff indexes while record, closeout, and explicit maintenance retain durable repair.
- Replaced global single Tips with append-only content-addressed Multi-Tips so reused visible `wp-*` IDs can coexist by exact Root hash, with unique-only ID lookup and legacy tip fallback.
- Unified host tool-approval and Manual subagent preference parsing on the standards-compliant `yaml` reader and generated a dependency-free Cursor hook helper from that source.
- Replaced repository-key Manual handoff transport with exact Root-content namespaces under `~/.geldmacher/workflow/handoff/by-root/<sha256>/`, so plan record/closeout/context persist without MCP `roots/list`.
- Bound Cursor operational workspace identity through `GELDMACHER_WORKFLOW_WORKSPACE_ROOT=${workspaceFolder}` while retaining `roots/list` as a fail-closed compatibility fallback and never trusting a tool-supplied `workspace_root` alone.
- Preserved source-preserving migration from legacy repository-key handoff stores into content-addressed namespaces and report `handoff_mode` / `workspace_binding` separately from true cache-write failures.
- Added host-aware Manual subagent policy with versioned concrete-ID presets, parent-only fail-safe default, Cursor inherit-and-attest approved alternatives, and Codex ordered candidate injection with parent fallback.
- Added shared Schema-1 host tool-approval preference (`strict`|`allowlisted`) with fail-safe default, Manual `workflow_status` advisory surfacing, and Cursor/Codex allowlist documentation that never grants host MCP approval.
- Published complete conservative MCP tool safety annotations for all twelve Cursor tools and the five Codex Manual tools, plus least-privilege host allowlist presets that keep Cursor and Codex settings under host control.
- Added a read-only, workspace-independent `workflow_plan_preflight` for Schema-5 Authority feasibility and Pareto Check selection before implementation approval.
- Added economic review routing with deterministic inline short-circuit, one-specialist targeted review, and exact full-review auditor coverage without weakening Hard-Trigger or certified assurance.
- Preserved valid closeout Evidence when only MCP roots transport is unavailable and the exact Root is supplied; foreign, redirected, drifting, conflicting, or missing Roots still fail closed.
- Added rootless Manual closeout metadata and a Schema-5-only `CreatePlan` guard so unavailable MCP Roots no longer force a redundant recovery closeout while incomplete native Plans fail before creation.
- Kept Artifact Schema 5 and Controller Protocol 5 stable while aligning planning/design auditors and required-Check language with the compact Intent Root.

## 5.1.0

- Hardened Marketplace identity, Capability Receipt Schema 4, canonical release hashing, MCP workspace boundaries, proof limits, and state access.
- Kept Artifact Schema 5 and Controller Protocol 5 compatible across Plugin 5 minor releases while preserving exact capability recertification.
- Added atomic rebuildable state/handoff indexes, checkpointed event tails, dry-run terminal archives, and focused coverage gates.
- Split Artifact validation and MCP contracts/handlers into maintainable modules, and shared controller build chunks where they materially reduce size.
- Reduced release and context overhead without changing the human-approved Manual delivery path.
- Expanded the plugin-local model guard across parent capture, Task preflight, Child attestation, and completion observation; added privacy-minimized incidents plus non-authoritative status/context diagnostics without changing Schema 5, Evidence, or Review authority.

## 5.0.0

- Added deterministic `workflow_closeout`, shared Manual/controller Evidence construction, and `/close-work [wp-id]` as a read-only recovery path.
- Added a repository-specific append-only external handoff cache plus MCP record/context APIs for exact, revalidated Root and Review transport across contexts.
- Added `delivery_evidence_id` and `delivery_evidence_hash` to controller Run status without changing acceptance, downgrade, lifecycle, or qualification semantics.
- Added risk-calibrated `evidence_mode: lean|full`; compact Lean Evidence is limited to low/medium-risk Manual roots without Hard Triggers.
- Added shared fail-closed active-Root resolution for Manual review, status, explanation, correction, learning, and acceptance commands while preserving explicit selectors.
- Added selectorless `/accept-work provisional` snapshots bound to the resolved Root and current artifact-set hash; the explicit-ID form remains supported.
- Added `/plan-work replan [wp-id]` and linear Schema-5 lineage binding through paired predecessor and source-review fields.
- Added a plugin-local parent-model inheritance guard: Workflow subagents are allowed without model overrides, while explicit child models and unverified parents fail closed; post-implementation agents remain named and read-only.
- Kept verified Manual review directly `achieved`; failed Checks remain unconditionally blocked.
- Moved new artifacts and controller records to Artifact Schema 5 and Controller Protocol 5.
- Preserved Workflow-3 and Workflow-4 artifacts, Preparations, and Runs as non-qualifying read-only history.

## 4.0.0

- Replaced uniform strictness with an immutable safety kernel and adaptive Strategy corridor.
- Added `manual`, `supervised`, and qualification-key-bound `autonomous` profiles with visible automatic downgrade.
- Added Artifact Schema 4 Intent Roots, Evidence Schema 4 grades, verified/provisional/blocked delivery, and `accepted-provisional`.
- Added ordered approved model Pools, phase affinity, granular Capability Receipt Schema 3, and exact model receipts.
- Added Dirty Baseline snapshots, task recipes, read-only Verifier/Reviewer fan-out, Verification Profiles, and hash-chained Decision Ledger.
- Preserved Workflow-3 status/watch compatibility as immutable read-only history.

## 3.0.0

- Introduced the first fail-closed external controller and capability certification release candidate.
