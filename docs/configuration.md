# Workflow 5 configuration

The controller resolves immutable prohibitions, project ceilings, approved user Pools, then per-Run authority. Lower layers may tighten but never expand a higher boundary.

## Host tool-approval preference

Manual users on Cursor and Codex may set a shared Schema-1 preference at `~/.geldmacher/workflow/preferences.yaml` (see [host approval contract](../references/host-approval-contract.md)). It steers whether you expect explicit host MCP confirmations (`tool_approval: strict`, the fail-safe default) or a host allowlist for Workflow tools (`tool_approval: allowlisted`). The preference never grants Cursor or Codex approvals and never writes host settings; host sandbox and human approvals remain authoritative.

Every Workflow MCP tool publishes standard safety annotations. Prefer least-privilege host presets: read-only Manual inspection, the five Manual tools, or an explicit full Cursor controller wildcard (`workflow:*`). On Cursor you may also allowlist exact read-only controller inspection tools such as event watching and live model validation by `server:tool` name. Cursor allowlisted setup uses `~/.cursor/permissions.json` with the declared server key `workflow` and, when the approval chip shows it, the matching plugin-prefixed id. Codex allowlisted setup targets the Manual server key `geldmacher-workflow` in `.mcp.json`, for example `default_tools_approval_mode = "writes"`. Roots, sandbox, and External-File Protection stay separate. `workflow_status` reports non-authoritative `host_tool_approval` metadata only.

## Which profile needs configuration?

- Codex currently exposes only `manual`; it uses the host sandbox, human approvals, Manual subagent policy or parent inheritance, five Manual MCP tools, and no Controller configuration.
- `manual` needs neither User Config nor Project Policy. The optional host preference above is independent of Controller User Config. The human chooses the primary model and drives the workflow.
- `supervised` needs both files below, `supervised_enabled: true`, complete budgets, exact model Pools, and positive live capability proof. The controller executes; the human accepts every delivery.
- `autonomous` needs every supervised requirement plus `autonomous_enabled: true`, an approved and clean Verification Profile, an exact certified Qualification Key, and enough accepted verified supervised history. Only fully verified delivery can complete without final human acceptance.

Configuration expresses permission but does not prove the installed environment is safe. Without a valid matching Capability Receipt, controller profiles stay in read-only Shadow Mode. See the [profile guide](profiles.md) for the complete comparison.

## Manual model ownership

Controller Route Pools do not select or favor the model for `/plan-work`, **Implement Plan**, `/correct-work`, `/review-work`, or `/explain-work`. The human selects the primary model. Cursor Task calls omit the model field or use the literal `inherit`; declared plugin agents use `model: inherit`. Concrete Cursor Task model values remain denied. Observed Cursor Children must match the parent or an explicitly configured Manual approved candidate. Codex may rewrite `Agent` inputs to the first configured ordered candidate and advance after unavailable-model failures, with the parent as final fallback. Missing or invalid Manual subagent policy stays parent-only. See [manual subagent policy](../references/manual-subagent-policy.md).

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

Cross-host Schema-5 handoff records live under `~/.geldmacher/workflow/handoff/by-root/<root-content-sha256>/`. Content-addressed Multi-Tips live under `~/.geldmacher/workflow/handoff/tips/<wp-id>/<root-content-sha256>.json`; exact Root text selects a tip directly, ID-only lookup succeeds only when the candidate set is unique, and legacy single-tip files under `~/.geldmacher/workflow/handoff/tips/<wp-id>.json` remain readable without rewrite or deletion. Legacy repository-key stores under `~/.geldmacher/workflow/state/<repository-key>/handoff/` remain readable for compatibility. The optional host tool-approval preference lives beside that home at `~/.geldmacher/workflow/preferences.yaml` and is parsed with the same standards-compliant YAML reader used by Manual subagent policy. Cursor MCP sets `GELDMACHER_WORKFLOW_WORKSPACE_ROOT=${workspaceFolder}` for operational workspace identity; Codex continues without an invented workspace placeholder and uses content-bound handoff plus Roots fallback. Codex operational Hook/task state lives under `PLUGIN_DATA`; credentials, Runs, worktrees, approval state, and capability receipts never cross host boundaries. `GELDMACHER_WORKFLOW_HOME` relocates the shared Workflow home; `GELDMACHER_WORKFLOW_SHARED_ROOT` may relocate the shared Handoff base; `GELDMACHER_WORKFLOW_PREFERENCES` may point at an explicit preferences file. The explicit idempotent importer is `npm run migrate:handoff -- --workspace <root>`; it verifies record schema, text hashes, and complete chains, never deletes the source, and blocks immutable ID conflicts.

A known conflicting cached Review can be inspected and quarantined explicitly with `npm run state:maintenance -- quarantine-handoff --root-hash <root-sha256> --artifact <wr-id> --expected-text-hash <review-sha256>`. This is a dry run unless `--apply` is supplied. Apply rechecks the exact namespace, ID, type, and text hash, refuses active dependents, moves the original record into a timestamp/hash-bound `handoff/quarantine/` directory with the prior index and manifest, and rebuilds only that namespace's derived index. It never selects a Root/Review by visible ID alone, guesses replacement bytes, or touches other Root namespaces. Record the authoritative task Review only after inspecting the dry-run report.

New records freeze Run/Preparation Schema 2, Artifact Schema 5, Controller Protocol 5, and Plugin 5.3.0. Capability Receipt Schema 4 binds plugin/runtime/lock hashes, exact certified models, Route Pool, Verification Profile, capability vector, and Qualification bindings. Workflow-5 records remain compatible across minor Plugin releases when their record, Artifact, and Controller schemas match; Capability Receipts still require the exact Plugin and runtime hashes. Workflow-3/4 records remain status/watch-only.
