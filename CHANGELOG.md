# Changelog

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
