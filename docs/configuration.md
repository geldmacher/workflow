# Workflow 5 configuration

The controller resolves immutable prohibitions, project ceilings, approved user Pools, then per-Run authority. Lower layers may tighten but never expand a higher boundary.

## Which profile needs configuration?

- `manual` needs neither User Config nor Project Policy. The human chooses the Cursor model and drives the workflow.
- `supervised` needs both files below, `supervised_enabled: true`, complete budgets, exact model Pools, and positive live capability proof. The controller executes; the human accepts every delivery.
- `autonomous` needs every supervised requirement plus `autonomous_enabled: true`, an approved and clean Verification Profile, an exact certified Qualification Key, and enough accepted verified supervised history. Only fully verified delivery can complete without final human acceptance.

Configuration expresses permission but does not prove the installed environment is safe. Without a valid matching Capability Receipt, controller profiles stay in read-only Shadow Mode. See the [profile guide](profiles.md) for the complete comparison.

## Manual model ownership

Controller Route Pools do not select or favor the model for `/plan-work`, **Implement Plan**, `/correct-work`, `/review-work`, or `/explain-work`. The human selects the primary model in Cursor. Workflow subagents are allowed only by inheritance: Task calls omit the model field or use the literal `inherit`, and declared plugin agents use `model: inherit`. Any concrete Task model value is denied even when it equals the parent slug. The primary remains responsible for integration and closeout. Named post-implementation auditors and the explainer are additionally read-only.

The repository-specific state stores short-lived hashed Task correlations and durable model incidents without prompts, personal data, or absolute workspace paths. `workflow_status` and `workflow_artifact_context` show the non-authoritative `model_inheritance` summary. A separately verified Child result remains usable and keeps its Evidence grade and Review verdict. For `supervised` and `autonomous`, a model deviation still fails the existing exact model attestation and therefore cannot qualify the affected run.

## User Config Schema 2

Create `~/.cursor/geldmacher-workflow/config.yaml`. Every role uses an ordered Pool with fallback limited to that approved Pool. Replace IDs and prices with exact current values.

```yaml
schema: 2
planning_preflight_budget:
  max_active_minutes: 5
  max_total_tokens: 20000
  max_cost_usd: 2
  max_validation_repairs: 1
route_profiles:
  default:
    planner: &premium
      selection: ordered
      fallback: approved-pool
      candidates:
        - model_id: exact-premium-model-v1
          reasoning_effort: high
          model_options: {}
          pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    investigator: *premium
    writer:
      selection: ordered
      fallback: approved-pool
      candidates:
        - model_id: exact-economy-writer-v1
          reasoning_effort: medium
          model_options: {}
          pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
        - model_id: exact-approved-writer-fallback-v1
          reasoning_effort: medium
          model_options: {}
          pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    writer_escalated: *premium
    verifier: *premium
    reviewer: *premium
    explainer: *premium
```

Aliases, unsupported options, silent remaps, and free fallback fail. Writer affinity persists until a phase or escalation boundary. `CURSOR_API_KEY` remains process-only.

## Project Policy Schema 2

Create `.cursor/workflow-policy.yaml` only when the repository opts in:

```yaml
schema: 2
supervised_enabled: true
autonomous_enabled: false
scope_envelope:
  allowed_roots: [src, tests]
  protected_paths: [.git, .cursor/workflow-policy.yaml]
  approval_required_paths: []
verification_profile:
  profile_id: verify-desktop-ui
  manifest_path: .cursor/workflow-verification.yaml
  activated_hash: replace-with-approved-64-character-hash
certified_regions: [src]
minimum_qualifying_runs: 10
dependencies: deny
allowed_dependencies: []
external_effects: none
max_risk: medium
maximum_budgets:
  max_active_minutes: 60
  max_total_tokens: 100000
  max_cost_usd: 10
  max_correction_cycles: 3
```

Enable `autonomous` only after the Verification Profile hash is proved and human-approved, the Route Pool has a positive granular Capability Receipt, and qualifying verified supervised history exists for the exact task/profile/pool/region tuple. Project files cannot manufacture history.

## External state

Preparations, Runs, Strategy revisions, receipts, proof artifacts, approvals, ledgers, and worktrees live under `~/.cursor/geldmacher-workflow/`. Do not edit them manually. Run branches use `workflow/<run-id>` and are never integrated automatically.

New records freeze Run/Preparation Schema 2, Artifact Schema 5, Controller Protocol 5, and Plugin 5.1.0. Capability Receipt Schema 4 binds plugin/runtime/lock hashes, exact certified models, Route Pool, Verification Profile, capability vector, and Qualification bindings. Workflow-5 records remain compatible across minor Plugin releases when their record, Artifact, and Controller schemas match; Capability Receipts still require the exact Plugin and runtime hashes. Workflow-3/4 records remain status/watch-only.
