# Changelog

## 5.2.0

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
