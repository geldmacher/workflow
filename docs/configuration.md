# Controller configuration

The controller resolves immutable safety prohibitions first, then project ceilings, user routing/budgets, and finally per-run restrictions. A lower layer may tighten but never expand a higher boundary.

## User routing

Create `~/.cursor/geldmacher-workflow/config.yaml` with schema 1 and one or more named profiles. The top level, profiles, routes, pricing, and budget objects are closed: unknown fields fail before normalization. An optional top-level `extensions` object may carry non-authoritative metadata. Each route profile contains exactly `planner`, `writer`, `writer_escalated`, `reviewer`, and `explainer`. Only `model_options` is intentionally open, and every contained value must be scalar and pass live adapter validation. Replace every example ID and price with the exact versioned model and current configured pricing you intend to authorize.

```yaml
schema: 1
planning_preflight_budget:
  max_active_minutes: 5
  max_total_tokens: 20000
  max_cost_usd: 2
  max_validation_repairs: 1
route_profiles:
  default:
    planner:
      model_id: exact-premium-planner-id
      reasoning_effort: high
      model_options: {}
      fallback: deny
      pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    writer:
      model_id: exact-economy-writer-id
      reasoning_effort: medium
      model_options: {}
      fallback: deny
      pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    writer_escalated:
      model_id: exact-premium-writer-id
      reasoning_effort: high
      model_options: {}
      fallback: deny
      pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    reviewer:
      model_id: exact-premium-reviewer-id
      reasoning_effort: high
      model_options: {}
      fallback: deny
      pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    explainer:
      model_id: exact-explainer-id
      reasoning_effort: medium
      model_options: {}
      fallback: deny
      pricing_usd_per_million: { input: 0, output: 0, cache_read: 0, cache_write: 0 }
```

Zero prices are valid only for genuinely zero-priced routes; otherwise they make cost estimates wrong and should not be used. `/work-models` rejects unavailable IDs, unsupported effort values, unknown options, aliases without exact catalog identity, and every fallback other than `deny`.

`planning_preflight_budget` is mandatory for `workflow_prepare` and has no defaults. It limits elapsed active minutes, total Planner tokens, configured cost, and technical schema-repair turns. Every repair resumes the same Planner Agent; exhausting any bound fails the Preparation without a Root. The manual `/plan-work` path does not load Controller configuration and remains available without these settings.

`CURSOR_API_KEY` must be present only in the MCP process environment. Do not put it in this file, project policy, plan, receipt, or repository.

## Project policy

Create `.cursor/workflow-policy.yaml` only in repositories that opt into controlled automation. Its top level, maximum budgets, and policy objects are also closed before safe defaults are applied; an optional top-level `extensions` object is non-authoritative. Begin with automation disabled:

```yaml
schema: 1
automation_enabled: false
unattended_enabled: false
allowed_write_roots:
  - src
  - test
protected_paths:
  - .git
  - .cursor/workflow-policy.yaml
protected_oracles:
  - test/security-oracle.test.js
certified_regions:
  - src
  - test
harness_version: workflow-harness-1
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

All paths are repository-relative. Auto execution gets only the intersection of `allowed_write_roots` and the root's frozen `automation_bounds.allowed_targets`. Protected paths and oracles remain unwritable even if another field names them.

`max_risk` and `maximum_budgets` are project ceilings. The approved root must stay at or below them; it may tighten them per run but cannot expand them.

For a narrowly authorized `auto-gated` dependency change, set both project and root dependency policy to `allow-listed` and list exact dependency names in both layers. The controller detects direct npm dependency/version changes; lock-only or unsupported manifest changes are classified as `unknown:<path>` and stop. `unattended-eligible` still requires dependency policy `deny`.

`unattended_enabled: true` additionally requires protected oracles, certified regions, a harness version, and a positive qualifying-run minimum already met by trusted history. This configuration still does not override a missing capability receipt, full design, hard trigger, dependency change, external effect, planned human gate, model mismatch, or incomplete root budget.

The project does not declare its own successful-run count. The controller derives qualifying history from achieved, human-accepted `auto-gated` runs in its external state. A repository edit cannot manufacture this history.

## External state

The controller owns these locations:

```text
~/.cursor/geldmacher-workflow/state/<repo-hash>/
~/.cursor/geldmacher-workflow/worktrees/<repo-hash>/<run-id>/
~/.cursor/geldmacher-workflow/runtime/<plugin-version>/<sdk-version>/<platform>/
```

Do not edit them manually. Preparations live below `preparations/<preparation-id>/`; Runs live below `runs/<run-id>/`. The explicit provisioner alone creates the runtime directory; MCP startup never installs or repairs it. A valid runtime manifest binds the installed Plugin hash, bundled Worker, exact lock inventory, SDK, platform package, and runtime hash.

New Preparation and Run documents freeze record schema 1, artifact schema 3, controller protocol 3, and plugin version 3.0.0. A capability receipt is a separate closed schema-2 document at `state/<repo-hash>/capability-receipt.json`, is valid for at most 30 days, and is accepted only if every current version, route, harness, Plugin, Worker, runtime, lock, and platform hash matches. Raw Root hashes retain opaque extensions for auditability; separate authoritative-projection hashes bind the extension-free model context in Preparation, Run, and phase receipts. Atomic replacement, repository/create locks and subject locks protect compatible mutations, while JSONL events provide watch cursors. Planner SDK stores/receipts remain with the Preparation and are copied immutably into the approved Run; implementation receipts stay with the Run. Run branches use `workflow/<run-id>` and are never integrated automatically.

Historical run files without the exact protocol tuple are never rewritten or deleted. Status and watch expose them as stopped with `compatibility: read-only-incompatible` and blocker `incompatible-run-protocol`; control, answer, runner, resume, active-run locking, and qualifying-history queries ignore or reject them as appropriate.
