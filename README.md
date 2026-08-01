# Workflow 5

**Turn a Cursor task into a repository change you can trust—without giving AI authority it has not earned.**

Workflow is a Cursor-native delivery system that keeps intent, implementation, evidence, review, correction, and learning connected from the first plan to the final verdict. It gives everyday Manual work a fast, familiar path and adds the governance needed to progress toward supervised and, only after exact certification, autonomous execution.

Instead of treating generated code as “done,” Workflow preserves the outcome you approved, lets the implementation strategy adapt inside explicit boundaries, and requires evidence that matches the actual risk. You stay in control of scope, models, external effects, and acceptance while every important transition remains inspectable.

- **Move faster without losing the plot.** Plan once around an observable outcome, then let execution adapt without silently changing the goal.
- **Make quality visible.** Connect repository changes to checks, delivery evidence, and a fresh review instead of relying on agent confidence.
- **Scale trust deliberately.** Start with the human-driven workflow, introduce supervised execution when useful, and unlock autonomous behavior only for an exactly certified environment.
- **Keep the blast radius bounded.** Protected paths, budgets, dependencies, secrets, repository limits, and external effects remain hard constraints.

The result is not just more automation. It is a controlled path from idea to reviewed repository delivery, with a clear answer to what changed, why it changed, how it was verified, and who authorized it. Read the [product overview](docs/overview.md) for the full story, compare the [three profiles](docs/profiles.md), or jump to the [usage example](docs/usage-example.md).

## Intent and expectations

Workflow 5 keeps the human-approved delivery intent fixed while allowing the execution strategy to evolve inside an explicit authority envelope. Manual delivery is additionally streamlined through risk-calibrated Lean Evidence and stateless provisional acceptance.

| Profile | In simple terms | Needed to use it |
|---|---|---|
| `manual` | You start implementation and every correction in Cursor. | The plugin, your selected Cursor model, and Plan approval; no automation configuration or certification. |
| `supervised` | The controller runs inside your approved boundary; you accept every delivery. | Exact model and budget configuration, repository opt-in, and positive live capability proof. |
| `autonomous` | An exactly qualified run may complete without final human acceptance only when every required Check is verified. | Everything for supervised plus an approved Verification Profile, exact Qualification Key, certified region and models, and qualifying supervised history. |

All three profiles use the same human-approved Intent Root, repository boundary, evidence semantics, and fresh review. The hard kernel never relaxes human Intent, protected paths, secrets, budgets, external-effect prohibition, or honest evidence. Strategy, slices, tools, adjacent in-root scope, equivalent checks, and approved model fallback remain adaptive. See [Manual, supervised, and autonomous](docs/profiles.md) for the complete requirements and downgrade behavior.

## Installation

Install or link this directory as the `geldmacher-workflow` Cursor plugin; Cursor displays it as **Workflow**. The plugin manifest is `.cursor-plugin/plugin.json`; controller tools are exposed through `mcp.json`. Project-specific automation additionally needs User Config Schema 2 and Project Policy Schema 2 configuration described in [configuration](docs/configuration.md).

## Usage

The normal Manual path remains `/plan-work`, Cursor **Implement Plan**, and `/review-work`, followed when needed by `/correct-work`, `/learn-from-work`, `/explain-work`, or `/work-status`. The human selects the primary model in Cursor. The primary agent may delegate bounded planning, implementation, correction, or verification work, but every Workflow subagent must inherit that model; explicit child-model overrides and unverified parent models fail closed. Implement Plan's final todo calls the deterministic closeout builder. `/close-work [wp-id]` is only the recovery path when that automatic closeout was missed; it may run safe local read-only Checks but cannot edit the repository. Context commands use an explicit selector when supplied; otherwise they resolve the unique active native Plan lineage in the current task. `/accept-work [wp-id] provisional` produces a one-time `accepted-provisional` view for the exact current chain without persisting acceptance. `/plan-work replan [wp-id]` creates a newly approval-bound Root only from a current review whose `next_action` is `replan`.

Workflow does not choose, prefer, or remap the Manual model. Delegation must omit a Task model override; declared plugin agents use `model: inherit`. During `/review-work` and `/explain-work`, only marked, named plugin roles are allowed; those roles are `readonly: true`. The hook is plugin-local and does not alter user or project Cursor hook configuration.

Controller operation for `supervised` and `autonomous` (`manual` does not use `/auto-work`):

1. `/work-models [route-profile]` validates the seven ordered approved model Pools.
2. `/work-verification draft <surface>` creates a Verification Profile draft; `prove`, human `approve <hash>`, and `audit` bind and monitor it.
3. `/auto-work <goal|wp-id> <supervised|autonomous> [route-profile]` creates a read-only Preparation.
4. `/auto-work <preparation-id> approve` approves exactly the displayed Intent Root hash.
5. `/work-status` and `/work-watch` show Strategy revision, effective Profile, evidence grade, deviations, Dirty Baseline hash, and Qualification Key.
6. `/work-control <run-id> accept` requires `acceptance: verified|provisional` matching delivery.

`achieved` requires complete verified evidence. `accepted-provisional` records a human acceptance with an evidence gap and never counts toward qualification. Manual acceptance is explicitly ephemeral: the next `/work-status` returns `delivery-ready-provisional` again. A known failed required Check is `blocked` and cannot be provisional.

The shipped controller keeps both automated profiles in read-only Shadow Mode until the exact installed environment has positive live capability proof. Repository tests do not activate writable controller work; Manual remains usable without that certification.

## Artifact protocol

New work uses Artifact Schema 5. The compact `work-plan` stores the immutable Intent Root and closed authority envelope. Replans form a linear lineage through paired `predecessor_plan_id` and `replan_source_review_id` fields; the lineage tip is the active Root. One deterministic builder derives Evidence identity, Intent hash, topology, mode, grade, and status from the validated chain and structured observations. Manual low/medium-risk work without Hard Triggers uses Lean Evidence; all higher-risk or controller work uses Full Evidence. An external repository-specific Schema-1 handoff cache transports exact Root, Evidence, and Review text between contexts but creates no authority, Run, approval, acceptance, qualification, or Learning. Workflow-3/4 documents and Runs stay readable through status/watch but are not mutable or automatically converted. See [artifact protocol](references/artifact-protocol.md) and [Workflow-5 migration](docs/migration-workflow-5.md).

## Components

- Commands in `commands/` provide the manual and controller entry points.
- Skills in `skills/` progressively load only the contracts needed by the active phase.
- Agents in `agents/` provide fresh read-only auditing and explanation roles.
- `hooks/` enforces marked Workflow parent-model inheritance without affecting unmarked Cursor tasks.
- `src/controller/` and `src/mcp/` implement the adaptive engine and public MCP surface; generated standalone bundles live in `dist/`.
- `schemas/` and `references/` define the closed machine and human-facing contracts.

## Versions

- Plugin 5.1.0
- Artifact Schema 5
- Controller Protocol 5
- Run/Preparation Record Schema 2
- Artifact Handoff Record Schema 1
- Capability Receipt Schema 4
- User Config Schema 2
- Project Policy Schema 2

See the [profile guide](docs/profiles.md), [configuration](docs/configuration.md), [Workflow-5 migration](docs/migration-workflow-5.md), and the [certification runbook](docs/certification-runbook.md).

Repository delivery is the maximum effect: no automatic push, PR, merge, deployment, production access, branch integration, or learning publication.

## Development

Run `npm test` for repository behavior and `npm run release-check` for bundle parity, tests, critical-module coverage, schema/version contracts, context headroom, links, canonical surface, and the isolated package dry run. The normal gate is offline and uses no model inference.

State maintenance stays local and explicit: `npm run state:maintenance -- inspect --workspace <root>` is read-only, `rebuild-index` reconstructs derived metadata from append-only records, and `archive --workspace <root> --subject <id>` is a dry run. Only a terminal Run or Preparation accepts `--apply`; the command moves it to a hashed recoverable archive and never deletes it automatically. Registry audit and live Cursor/Marketplace certification remain separately authorized environment-bound gates.
