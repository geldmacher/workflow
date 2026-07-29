# Workflow

Cursor-native, human-governed software-factory workflow for repository delivery. Version 3.x keeps the existing manual Plan → Implement → Review → Correct loop and adds one fail-closed controller for `auto-gated` and computed `unattended-eligible` runs.

## Intent and expectations

All three profiles use the same schema-3 root, design/slice semantics, checks, evidence, review decisions, and derived state:

| Profile | Human authority | Execution |
|---|---|---|
| `manual` | Plan, initial implementation, every correction | Cursor Plan/Ask/Agent modes and explicit Commands |
| `auto-gated` | Root, declared slice gates, exceptions, final local delivery | Controller-owned external worktree and run branch |
| `unattended-eligible` | Root, then no planned gate | Only after computed eligibility; otherwise a visible proposed downgrade |

`unattended-eligible` is not a blanket autonomous mode. It requires complete budgets, exact model receipts, certified repository regions and protected oracles, sufficient qualifying history, and verified SDK write/network/secret boundaries. The current pinned SDK adapter remains in Shadow Mode until an external capability receipt proves those hard boundaries. A failed or missing capability never falls back to trust in SDK Auto-review.

Delivery ends at the local repository boundary. Workflow does not push, create pull requests, merge, deploy, access production, infer production health, or learn automatically.

## Installation

Clone or link this standalone repository at `~/.cursor/plugins/local/geldmacher-workflow/`, run `npm ci`, build the tracked runtime bundles during development, and reload Cursor. `mcp.json` starts the pinned controller from `${CURSOR_PLUGIN_ROOT}/dist/workflow-mcp.mjs`; runtime startup never invokes `npx`, resolves `latest`, or installs dependencies. The MCP/controller bundles are self-contained. Manual Workflow needs no API key, capability receipt, or separately provisioned SDK runtime.

For certification only, the private RC Marketplace is declared by `.cursor-plugin/marketplace.json`. In the actually installed RC copy an operator explicitly runs `npm run provision:worker-runtime -- --marketplace-git-commit <exact-sha>`; the provisioner installs only the exact lockfile tree into external user state and binds it to Marketplace commit, Plugin, Worker, SDK/platform, and lock hashes. Development or environment-overridden Workers force Shadow Mode. See the [capability spike](docs/capability-spike.md) and [certification runbook](docs/certification-runbook.md).

Automated profiles additionally need user routing and project policy. See [configuration](docs/configuration.md) and the [capability spike](docs/capability-spike.md). Keep `CURSOR_API_KEY` only in the Cursor/MCP process environment.

## Usage

### Manual

1. In Cursor Plan Mode, run `/plan-work <goal>`. Material human decisions are resolved before one immutable root is created. `design_depth` (`oneshot`, `compact`, `full`) is independent from assurance and automation.
2. Inspect the root and choose Cursor's native **Implement Plan**. This remains the explicit approval for initial manual execution.
3. In a fresh Ask task, run `/review-work [wp-id]` with the root and latest evidence.
4. If the review recommends `correct`, inspect its embedded correction and run `/correct-work` in Agent Mode. The human approves each manual correction.
5. Run `/review-work` again. Optionally close out with `/learn-from-work [instruction]`.
6. Run `/work-status [wp-id]` whenever the complete Root chain is available in the current task. It derives the same state graph without a Run, persistence, API key, or model call; missing chat artifacts wait for input, while invalid schema-3 chains replan.
7. At any point, run `/explain-work [wp-id]` in Ask Mode. Before achievement it returns a clearly preliminary explanation with blockers; afterward it explains intent, architecture, flow, change map, decisions, invariants, verification, risks, and future change points. It is chat-only and never a gate or proof artifact.

### Controlled automation

1. Run `/work-models [route-profile]` to validate exact model IDs, reasoning parameters, options, pricing metadata, `fallback: deny`, SDK version, and catalog hash.
2. Run `/auto-work <goal|wp-id> <auto-gated|unattended-eligible> [route-profile]`. The Controller validates a supplied schema-3 Root first, then runs exactly the configured `planner` route read-only. It creates a Preparation, not a Run.
3. Follow `/work-status <preparation-id>` or `/work-watch <preparation-id>`. Material Intent questions return to manual `/plan-work`. At `root-ready`, inspect the Root, semantic diff, hashes, Planner receipt, and usage.
4. Run `/auto-work <preparation-id> approve` to approve exactly the displayed Root hash. Only then does `workflow_start` atomically consume the Preparation and create a Run with `plan_approved: true`. A proposed unattended downgrade remains a separate approval.
5. Follow Run events with `/work-watch`; use `/work-control` for Slice/downgrade approval, `pause`, `resume`, `stop`, `answer`, or final `accept`.
6. Successful delivery remains on `workflow/<run-id>` in the external worktree. Integration is always host-owned.

Every controller mutation uses the current `revision` and a unique idempotency key. Preparation keys are additionally bound to the exact Goal or raw Root hash, requested profile, and Route profile; reuse for another request fails. Missing budgets, route mismatches, unavailable models, repository drift, protected paths/oracles, secrets, dependencies, external effects, repeated findings, or exhausted budgets produce `waiting-human` or `replan`.

See [the complete workflow example](docs/usage-example.md).

### Cursor mode boundary

[Cursor Commands](https://docs.cursor.com/en/agent/chat/commands) do not bind a mode declaratively. Select Plan, Ask, or Agent for manual Commands. The automated Commands call only the bundled MCP controller. Cursor's SDK sandbox and Auto-review are defense-in-depth signals, not the controller's authorization source.

## Artifact protocol

Workflow 3.0 accepts only schema 3. Every artifact declares `schema: 3`; every artifact schema is closed except for one optional, non-authoritative top-level `extensions` object:

- `work-plan` (`wp-*`): immutable root intent, scope, checks, assurance, design depth, and optional frozen automation bounds.
- `delivery-evidence` (`de-*`): full initial evidence or a compact correction delta.
- `work-review` (`wr-*`): cumulative assessment and optional embedded correction.
- embedded correction (`cp-*`): Findings-backed, in-scope work with output-only `LRN-*` candidates.

Schema-2 artifacts and mixed schema-2/3 chains are rejected before graph materialization and must be replanned. There is no migration command, runtime converter, default design depth, default automation ceiling, inferred review topology, assurance repair, or evidence-class fallback. Every Check declares its evidence class. `compact` adds system impact and vertical slices; `full` also requires product requirements and program design. Slice size is a heuristic, never a success oracle.

The controller persists only external Preparation/Run events, hashes, receipts, SDK stores and worktrees. `WorkflowSnapshot` is freshly derived from root/evidence/review/run/repository observations; manual `/work-status` derives it directly from exact current-task artifacts without creating external state. No repository `session-state` artifact is introduced.

Validation remains syntactically tolerant and semantically strict. Whitespace, documented heading aliases, Cursor companion text, table formatting, reordered content, equivalent Checks, and supported evidence reuse are accepted. Core semantic fields are never derived or repaired. Extra metadata is valid only inside `extensions`: it remains in the raw artifact and raw artifact hash for auditability, but is excluded from the stable authoritative projection sent to Planner, Writer, Reviewer, or Explainer. Existing-root Planning restores only the original opaque value after the model turn; goal Planning strips model-invented extensions. Manual components likewise never interpret, quote, summarize, explain, or use extensions. The controller freezes and receipts the projection hash separately, so extensions cannot influence scope, routing, eligibility, state, or model decisions. Ambiguous roots, incomplete intent, unsafe reuse, scope/risk expansion, missing approval, incomplete budgets, or insufficient attestations block progress.

New Preparations and Runs freeze artifact schema 3, record schema 1, controller protocol 3, and plugin version 3.0.0. Earlier and otherwise incompatible external Runs stay visible through status/watch as `read-only-incompatible`, but cannot be controlled, answered, resumed, or counted as qualifying history, and they do not block a new compatible Run.

## Components

- **Manual Commands**: `/plan-work`, `/review-work`, `/correct-work`, `/learn-from-work`, `/explain-work`, plus stateless `/work-status [wp-id]`
- **Controller Commands**: `/auto-work`, `/work-status`, `/work-watch`, `/work-control`, `/work-models`
- **Skills**: `work-planning`, `work-review`, `work-execution`, `work-learning`, `work-explanation`, `work-automation`
- **Agents**: `work-plan-auditor`, `work-design-auditor`, `delivery-auditor`, `risk-auditor`, `work-explainer`
- **MCP tools**: `workflow_prepare`, `workflow_start`, `workflow_status`, `workflow_watch`, `workflow_control`, `workflow_answer`, `workflow_validate_models`
- **Rules and hooks**: none

## Development

```bash
npm ci
npm run build:runtime-validator
npm run build:controller
npm run provision:worker-runtime -- --marketplace-git-commit <exact-sha> # certification only
npm test
npm run context-budget
npm run release-check
```

Context measurement uses explicit phase load paths and a checked regression baseline. `npm run context-baseline` updates that baseline only after an intentional, reviewed contract change has met every phase target; normal checks never rewrite it.

Use the ignored `.tests/` directory for local development and scratch tests. Functional Cursor tests use `/private/tmp/cursor-plugin-harness`; see [the release checklist](docs/release-checklist.md). Real SDK smokes require explicit cost approval, valid authentication, and isolated test targets. Existing harness changes must remain byte-identical.
