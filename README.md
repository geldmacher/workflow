# Workflow 5

**Ship AI-written code with a plan, proof, and a fresh review.**

Workflow turns Cursor, Codex, and compatible Agent Plugins clients from code generators into a controlled delivery loop. It keeps the outcome you approved connected to implementation, verification, review, correction, and learning—without giving AI authority it has not earned.

- **Stay aligned.** The approved outcome stays fixed while implementation can adapt inside clear boundaries.
- **See the proof.** Checks and evidence match the actual risk instead of relying on agent confidence.
- **Understand what was delivered.** A fresh review gives the verdict, a plain-language result explanation, and exact technical traceability.
- **Keep control.** You choose the model, approve the Plan, authorize corrections, and control every external effect.

The result: faster repository work with a clear answer to **what changed, why it changed, and how well it was verified**.

[Manual Workflow guide](docs/manual-workflow.md) · [Product overview](docs/overview.md) · [Usage example](docs/usage-example.md) · [Profile guide](docs/profiles.md)

## How it works

The default Manual path needs three human actions:

1. **Plan** an observable outcome with explicit scope and acceptance criteria.
2. **Implement** inside that approved boundary.
3. **Review and understand** the delivery in a fresh task; the result is explained before its technical evidence and traceability.

Correct, replan, accept provisional delivery, or learn only when you explicitly ask for it.

Workflow keeps the approved Intent fixed, lets Strategy adapt inside the envelope, and connects the final verdict to the exact Plan and Evidence that produced it.

## Intent and expectations

| Profile | What it does | Availability |
|---|---|---|
| `manual` | You approve the Plan, start implementation and fresh review, and separately authorize corrections. A fully verified review completes the work. | Cursor, Codex, and the portable Agent Plugins v1 target; no controller certification required. |
| `supervised` | The Cursor controller executes inside the approved boundary; you accept every delivery. | Requires explicit configuration, repository opt-in, budgets, model routing, and positive live capability proof. |
| `autonomous` | One exactly qualified Cursor workflow may complete without final acceptance when every required Check is verified. | Requires everything for supervised plus an approved Verification Profile and qualifying history. |

Manual is the default. Missing controller proof keeps supervised and autonomous execution in read-only Shadow Mode; it never turns missing evidence into success. A failed required Check blocks delivery.

Across every profile, Workflow preserves protected paths, repository limits, budgets, secrets, model accountability, and honest evidence. Read the [profile guide](docs/profiles.md) for the exact prerequisites and downgrade behavior.

## Installation

Workflow is not yet available in a public plugin store. Keep the Git checkout as the canonical source and deploy generated host copies from it. Do not clone into `~/.cursor/plugins/local` or `~/.codex/plugins`; those directories contain managed deployment copies and are atomically replaced.

### Requirements and clone

Install Git, Node.js 22 or newer, and npm. The selected host must also be installed: Cursor for a Cursor deployment, or the Codex CLI with plugin support for a Codex deployment.

```bash
mkdir -p ~/src/geldmacher-plugins
git clone https://github.com/geldmacher/workflow.git ~/src/geldmacher-plugins/workflow
cd ~/src/geldmacher-plugins/workflow
npm ci
```

If you already have a checkout, use it instead and run `npm ci` from its repository root.

### Preview and install

Choose one host or deploy both:

| Target | Preview without changing host state | Install or update |
| --- | --- | --- |
| Cursor only | `npm run deploy:local -- --dry-run --cursor-only` | `npm run deploy:local -- --cursor-only` |
| Codex only | `npm run deploy:local -- --dry-run --codex-only` | `npm run deploy:local -- --codex-only` |
| Cursor and Codex | `npm run deploy:local -- --dry-run` | `npm run deploy:local` |

Append `--full` to any preview or install command to run the complete repository `release-check` during preparation. Inspect the current installed state with `npm run deploy:status`; add `--cursor-only` or `--codex-only` to limit that check to one host.

A dry-run copies the current Git-visible checkout—tracked files plus non-ignored untracked regular files—into a disposable system-temporary snapshot and prepares the bundles there. It creates a snapshot-local dependency mirror from the checkout's physical `node_modules`—copy-on-write where supported—only for dependency resolution, rejects untracked symlinks and recognizable secret material, and removes the snapshot after success or failure. The preview may create temporary files, but it does not modify the canonical checkout, `.build`, `dist`, Marketplace, caches, or installed host copies. Ignored checkout files are intentionally unavailable to preview preparation.

A real deployment builds and validates all three deterministic bundles under the canonical checkout's `.build/plugins/`, then atomically replaces only the selected native host copies:

- Cursor: `~/.cursor/plugins/local/geldmacher-workflow`
- Codex source: `~/.codex/plugins/geldmacher-workflow`

Every installed copy contains a `.local-deploy.json` receipt with its content-derived local version, Git revision, dirty status, source path, and deployment time. Dirty checkouts are allowed and explicitly recorded. For Codex, the command also creates or updates only this plugin's entry in the `personal` Marketplace and refreshes the verified Codex cache with `codex plugin add geldmacher-workflow@personal --json`. Do not delete Codex caches manually.

After installation or an update, reload Cursor before testing its plugin surface and start a new Codex task before testing Codex discovery. Review changed hooks manually before granting trust. The deploy command does not restart either host or grant hook trust. See the [Cursor plugin documentation](https://cursor.com/docs/plugins) and OpenAI's [local plugin documentation](https://developers.openai.com/plugins/build/plugins).

### Portable Agent Plugins artifact

Build and validate the standard package without installing anything:

```bash
npm run build:targets
npm run check:agent-plugin
```

The result is `.build/plugins/agent-plugins/geldmacher-workflow`, with a root `plugin.json`, root `mcp.json`, nine Agent Skills, and the same five Manual MCP tools. `deploy:local` deliberately ignores this artifact; use only a compatible client's Agent Plugins installation flow and an isolated profile that does not also load the native package with the same ID.

The portable artifact is repository-validated, not live-client-verified. Installation, skill/MCP activation, compatible-client smoke, and publication require separate evidence. See the [architecture overview](docs/overview.md#manual-the-familiar-path-made-dependable), [release checklist](docs/release-checklist.md), and [Agent Plugins v1 specification](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md).

### Update from the origin repository

First protect any local work, then fast-forward the checkout and redeploy:

```bash
cd ~/src/geldmacher-plugins/workflow
git status --short
git fetch origin
git pull --ff-only
npm ci
npm run deploy:local -- --dry-run
npm run deploy:local
npm run deploy:status
```

Inspect a dirty status before pulling; commit or stash intentional local changes rather than discarding them. `git pull --ff-only` refuses a divergent history instead of creating an implicit merge. `npm ci` synchronizes dependencies with the updated lockfile. The last three commands above update both hosts; use the matching `--cursor-only` or `--codex-only` flag when only one host is installed. An unchanged bundle is a verified no-op; changed content receives a new host-specific local version and replaces the previous copy transactionally.

## Usage

| Step | Cursor | Codex | Agent Plugins v1 |
|---|---|---|---|
| Create the Plan | `/plan-work` | `$plan-work` in Plan mode | `plan-work` with mandatory MCP preflight |
| Implement | **Implement Plan** | **Implement Plan** | Separate `implement-work` invocation |
| Build delivery evidence | Automatic native lifecycle closeout; `/close-work` is recovery only | Automatic native lifecycle closeout; `$close-work` is recovery only | Mandatory `workflow_closeout`; `close-work` is recovery |
| Review | `/review-work` in a fresh task | `$review-work` in a fresh task | `review-work` in a fresh context |
| Check status | `/work-status` | `$work-status` | `work-status` |
| Refresh the explanation | `/explain-work` | `$explain-work` | `explain-work` |

Use `/correct-work` or `$correct-work` only after separately authorizing a correction. Reviews explain automatically; refreshing that explanation, provisional acceptance, and confirmed learning remain explicit actions—not background automation.

Cursor additionally exposes the gated supervised and autonomous controller commands. Codex intentionally provides the native Manual path with eight skills and five compatible Manual MCP tools. The Agent Plugins target provides nine portable Manual skills—including explicit `implement-work`—and requires MCP preflight/closeout where native hooks are unavailable. Neither Manual-only target contains the Cursor controller runtime, hidden model routing, background Runs, worktree manager, or publication automation.

Optional Manual preferences live in `~/.geldmacher/workflow/preferences.yaml`. They can describe expected host approvals and bounded subagent candidates, but they never grant permissions or change host settings. See [configuration](docs/configuration.md), [host approval](references/host-approval-contract.md), and [Manual subagent policy](references/manual-subagent-policy.md).

## Artifact protocol

Workflow uses Artifact Schema 5 to bind one approved Intent Root to its Delivery Evidence and fresh Review. Evidence is reported as verified, provisional, unavailable, or failed—never upgraded by wording alone.

Task artifacts remain authoritative. A content-addressed Handoff Store can transport the exact chain between tasks and hosts without creating approval, acceptance, qualification, or learning authority. See the [artifact protocol](references/artifact-protocol.md) and [Workflow 5 migration guide](docs/migration-workflow-5.md).

## Components

- `commands/` and `skills/` provide the user-facing Workflow actions.
- `agents/` provides fresh read-only audit and explanation roles.
- `hooks/` enforces marked Plan, closeout, review, and model-inheritance boundaries.
- `src/core/` contains host-neutral contracts; `src/hosts/` contains host adapters.
- `src/controller/` and `src/mcp/` implement the Cursor controller and public MCP surface.
- `targets/` defines the separate Cursor, Codex, and Agent Plugins packages.
- `schemas/` and `references/` hold the machine and human-facing contracts.

### Versions

- Plugin 5.3.0
- Artifact Schema 5
- Controller Protocol 5
- Capability Receipt Schema 4
- Run/Preparation Record Schema 2
- User Config Schema 2
- Project Policy Schema 2

## Development

Repository-local guidance lives in `AGENTS.md` and does not ship with the plugin.

```bash
npm test
npm run release-check
```

`release-check` verifies all three target builds, portable schema/MCP conformance, tests, coverage, context budgets, manifests, links, release-surface closure, and package isolation. It does not prove installation, component activation, live host enforcement, compatible-client behavior, or public-store publication; those remain separate environment-bound checks.

Workflow's maximum effect is repository delivery: **no automatic push, PR, merge, deployment, production access, or learning publication.**

MIT licensed · Built by **Geldmacher**
