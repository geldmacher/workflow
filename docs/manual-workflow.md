# Manual Workflow

## Intent Root and Plan

Planning creates one immutable Schema-6 Root in the host-native Plan. The Root fixes goal, acceptance, constraints, authority, risk, profile, and intent-only verification. The bundled local builder validates the exact Root before presentation but grants no approval. Human selection of the native implementation action grants implementation authority; Root observation, receipt, cache, and handoff do not replace it. Implementation later reports only phase completion with fresh Review pending, never reviewed delivery completion.

Workflow accepts only Schema 6. Unsupported artifact schemas do not produce status, explanation, acceptance, or a new lifecycle transition.

## Implementation

The active project harness decides how to deliver the approved outcomes. Workflow neither prescribes nor judges commands, programs, tools, models, working directories, worktrees, sandboxes, retries, or framework strategy.

Workflow, MCP, adapter, Root transport, hook, or harness unavailability does not block ordinary host use. Continue only within already approved Root authority and report unavailable evidence honestly. Implementation creates neither Evidence nor Workflow state.

## Fresh Review

Review is repository-read-only. The Skill resolves the exact current-task Root and predecessor artifact bytes, inspects acceptance and repository state through the active project harness, and closes one semantic Review input plus unprotected repository and Check observations.

The bundled stateless `manual-workflow` builder accepts those closed inputs and performs only validation, canonical serialization, hashing, path authority, lineage, artifact construction, and presentation projection. It never discovers the repository, runs Git or Checks, selects a command or framework, calls MCP, reads Hook or cache state, or persists artifacts.

The builder canonicalizes the supplied repository root as its workspace binding and returns one atomic `delivery-evidence`/`work-review` pair or no artifacts. IDs, Root/intent/workspace/snapshot/artifact hashes, grades, path classification, and the visible decision are computed from the same validated result. Model-supplied verified claims, hashes, attestations, and receipts are rejected. Failed required Checks remain blocking.

Every Manual request may pass `presentation_locale: de|en`; the Skill uses German only for an active German conversation and otherwise passes English. Locale affects fixed presentation wording only. Human output leads with the decision, its concrete reason, required-Check result, affected scope, at most one proof boundary, and one next action. It distinguishes a blocked delivery from ordinary host availability. Complete findings, Checks, distinct limitations, paths, IDs, and hashes remain once in closed details. Review then places each exact artifact once, unchanged, in its own closed disclosure block.

The builder retains canonical actions. Cursor, Codex, and portable Skills merely decorate the operation's authoritative action with `/correct-work`, `$correct-work`, or `correct-work` style host syntax; they never infer a replacement action or assessment.

Literal authority roots match themselves and descendants. `*` matches within one segment; `**` is recursive only as a complete segment and may match zero or more segments. Ordinary repository-internal changes outside `allowed_roots` stay visible in Evidence and cap Manual delivery at provisional. They do not force clarification or silently gain authority. Protected and approval-required paths remain blocked, while malformed, traversal, absolute, or repository/symlink-escaping paths return Shadow without artifacts. Protected sealing keeps hard Root authority.

Missing or invalid Root, artifacts, observations, lineage, or authority produce a stable Shadow result without a Schema-6 pseudo-artifact. Exact task bytes remain available for retry. Same-task context is the normal transport; a fresh task requires explicit human attachment of the exact Root and every referenced Evidence/Review artifact.

The registered MCP server is outside the Manual dependency graph. `/auto-work` and optional protected sealing may use protected PhaseRequests, PhaseResults, receipts, and adapter bindings. Protected sealing binds the exact local pair and appends fresh `seal` Evidence plus Review only when every required Check is verified; incomplete or failed attempts create no artifacts. Already issued Manual bytes and Manual status remain unchanged.

## Evidence grades

- `verified`: only a separately protected passing attestation binds Check intent, Root, workspace, and snapshot.
- `supported` or `partial`: useful unprotected Manual evidence exists but is not fully bound. Supported requires an unambiguous outcome on the current snapshot; command invocation, source presence, masked exit status, or unknown outcome is partial or unavailable.
- `unavailable`: evidence could not be obtained and a concrete limitation is recorded.
- `failed`: an observed Check failure blocks delivery; only separately protected provenance may describe that failure as harness-attested.

A contradictory Root, workspace, intent, or snapshot binding is rejected.

## Correction and Replan

Correction applies only the builder-created current correction proposal. It creates no Evidence or state. Its handoff says only that correction is complete and fresh Review is pending; the later Review constructs delta Evidence. Changed intent, authority, risk, dependencies, or external effects requires a fresh human-approved Schema-6 replan.

## Manual states

Manual status is derived locally from exact artifact bytes: plan ready, review needed, decision needed, blocked, provisional, or completed. Transport is not authority. Provisional acceptance is explicit, ephemeral, unverified, non-persisted, and creates no qualification or learning permission.
