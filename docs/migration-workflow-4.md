# Migrating from Workflow 3 to Workflow 4

Workflow 4 is intentionally not an in-place artifact migration. Existing Workflow-3 documents and Runs remain readable via status/watch, but are immutable, do not block a new Run, and never contribute qualifying history.

## Configuration

1. Change User Config `schema: 1` to `schema: 2`.
2. Replace each single role route with `selection: ordered`, `fallback: approved-pool`, and `candidates`. Add `investigator` and `verifier` Pools.
3. Change Project Policy to Schema 2: `supervised_enabled`, `autonomous_enabled`, `scope_envelope`, and optional `verification_profile`.
4. Replace repository-global unattended assumptions with exact certified regions and per-key qualifying history.

## Artifacts and operation

- Create a fresh Schema-4 Intent Root; do not rewrite an approved Workflow-3 Root.
- Move mutable steps, slices, equivalent checks, deviations, and rationale into external Strategy revisions.
- Replace binary evidence claims with granular grades and baseline/patched identity.
- Replace `auto-gated` with `supervised`; replace `unattended-eligible` with exact-key `autonomous`.
- Accept delivery explicitly as `verified` or `provisional`. A failed Check is never provisional.

The names now describe who controls execution and acceptance: Manual is human-driven, supervised is controller-driven with human delivery acceptance, and autonomous is exact-qualified controller work that may finish only with complete verified evidence. See the [profile guide](profiles.md) for current prerequisites.

## Rollout

Release manual first. Run supervised in Shadow Mode until live Cursor and Marketplace boundaries are certified. Activate autonomous independently for each `task_class + verification_profile_hash + route_pool_hash + certified_region` key.
