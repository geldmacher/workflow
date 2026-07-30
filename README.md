# Geldmacher Workflow 4

Cursor-native, human-governed repository delivery with an immutable Intent Root and an adaptive, evidence-calibrated execution Strategy.

## Intent and expectations

Workflow 4 keeps the human-approved delivery intent fixed while allowing the execution strategy to evolve inside an explicit authority envelope. It is designed for repository-local work where evidence quality, bounded effects, and honest terminal states matter more than rigid adherence to a precomputed sequence.

| Profile | Human boundary | Controller behavior |
|---|---|---|
| `manual` | Human starts implementation and corrections | Lean Schema-4 Root; no controller or certification required |
| `supervised` | Human approves Intent and accepts every delivery | One canonical Writer may adapt Strategy inside approved roots |
| `autonomous` | Human approves Intent and exact certification hashes | Only an exact Qualification Key; incomplete evidence downgrades to supervised |

The hard kernel never relaxes human Intent, repository boundaries, protected paths, secrets, budgets, external-effect prohibition, or honest evidence. Strategy, slices, tools, adjacent in-root scope, equivalent checks, and approved model fallback remain adaptive.

## Installation

Install or link this directory as the `geldmacher-workflow` Cursor plugin. The plugin manifest is `.cursor-plugin/plugin.json`; controller tools are exposed through `mcp.json`. Project-specific automation additionally needs User Config Schema 2 and Project Policy Schema 2 configuration described in [configuration](docs/configuration.md).

## Usage

Manual commands remain `/plan-work`, Cursor **Implement Plan**, `/review-work`, `/correct-work`, `/learn-from-work`, `/explain-work`, and `/work-status`.

Controller operation:

1. `/work-models [route-profile]` validates the seven ordered approved model Pools.
2. `/work-verification draft <surface>` creates a Verification Profile draft; `prove`, human `approve <hash>`, and `audit` bind and monitor it.
3. `/auto-work <goal|wp-id> <supervised|autonomous> [route-profile]` creates a read-only Preparation.
4. `/auto-work <preparation-id> approve` approves exactly the displayed Intent Root hash.
5. `/work-status` and `/work-watch` show Strategy revision, effective Profile, evidence grade, deviations, Dirty Baseline hash, and Qualification Key.
6. `/work-control <run-id> accept` requires `acceptance: verified|provisional` matching delivery.

`achieved` requires complete verified evidence. `accepted-provisional` records a human acceptance with an evidence gap and never counts toward qualification. A known failed required Check is `blocked` and cannot be provisional.

## Artifact protocol

New work uses Artifact Schema 4. The compact `work-plan` stores the immutable Intent Root and closed authority envelope; the external controller owns hash-linked `execution-strategy` revisions, graded evidence, and the Decision Ledger. Workflow-3 documents and Runs stay readable through status/watch but are not mutable or automatically converted. See [artifact protocol](references/artifact-protocol.md) and [Workflow-4 migration](docs/migration-workflow-4.md).

## Components

- Commands in `commands/` provide the manual and controller entry points.
- Skills in `skills/` progressively load only the contracts needed by the active phase.
- Agents in `agents/` provide fresh read-only auditing and explanation roles.
- `src/controller/` and `src/mcp/` implement the adaptive engine and public MCP surface; generated standalone bundles live in `dist/`.
- `schemas/` and `references/` define the closed machine and human-facing contracts.

## Versions

- Plugin 4.0.0
- Artifact Schema 4
- Controller Protocol 4
- Run/Preparation Record Schema 2
- Capability Receipt Schema 3
- User Config Schema 2
- Project Policy Schema 2

See [configuration](docs/configuration.md), [Workflow-4 migration](docs/migration-workflow-4.md), and the [certification runbook](docs/certification-runbook.md).

Repository delivery is the maximum effect: no automatic push, PR, merge, deployment, production access, branch integration, or learning publication.

## Development

Run `npm test` for repository behavior, `npm run release-check` for generated-bundle parity, tests, context budgets, release validation, and Markdown links, and `npm pack --dry-run` to inspect the package surface. Live Cursor and Marketplace certification are separate environment-bound gates and must not be inferred from repository tests.
