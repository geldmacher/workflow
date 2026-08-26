# Workflow

Workflow turns AI output into trustworthy repository delivery by standardizing lifecycle, intent, authority, artifact lineage, evidence grades, and human decisions. Workflow 6 is deliberately not an execution engine: the active project harness owns every concrete command, tool, model, framework, sandbox, worktree, retry, and verification strategy.

## Intent and expectations

The default lifecycle is Plan → Implement → fresh Review → Correct or Replan. A human approves the Schema-6 Intent Root. Workflow keeps that authority immutable, reports evidence honestly, and never treats transport or presentation as permission.

The central contributor Northstar is the root `AGENTS.md`. There is no second Northstar file.

- Workflow owns lifecycle, Intent, Authority, Lineage, Evidence, artifacts, and human gates.
- The project harness owns concrete execution.
- Missing harness evidence is provisional or unavailable, never disguised success.
- A harness failure blocks only the affected phase; ordinary Cursor and Codex use remains available.
- The finish line is repository-only. Workflow never pushes, opens or merges PRs, deploys, accesses production, publishes, or learns automatically.

## Installation

Install or link the plugin through the supported host mechanism. Local repository deployment is a separate operational action and is not part of ordinary implementation.

Current contract versions:

- Plugin 6.0.0
- Artifact Schema 6
- Controller Protocol 6
- Harness Capability Receipt Schema 1

## Usage

Manual is the default and has no MCP dependency:

1. `/plan-work <goal>` or `$plan-work <goal>` creates a human-approved Schema-6 Root.
2. The host's native implementation action authorizes repository work.
3. `/review-work` or `$review-work` starts fresh repository-read-only Review. The project harness supplies closed unprotected observations to the bundled stateless local builder.
4. The local builder validates lineage and authority, computes IDs and hashes, and atomically returns exact Evidence plus Review together with the human presentation. Unprotected success is capped at provisional.
5. Use correction, replan, another fresh Review, or `/accept-work provisional` only when the Review requests it.

The Manual path uses neither MCP, Host Adapter, MCP Roots, Hook Trust, cache, nor persistent Workflow state. If local input is missing, malformed, foreign, stale, conflicting, or ambiguous, the builder returns a clearly labelled Shadow result with no pseudo-artifacts and retains the task's Root and predecessor bytes for retry. A fresh task must receive those exact bytes explicitly.

The MCP server remains registered for `/auto-work`, automation status, and optional protected sealing. Protected sealing binds the exact local provisional pair through `seal_artifacts` and may append a fresh fully verified `seal` Evidence/Review pair; it never edits or upgrades previously returned artifacts. An incomplete or failed sealing attempt creates no artifacts and changes no Manual status. Automation, adapter, MCP, Roots, timeout, and Hook failures affect only that requested automation phase and never ordinary host use.

`$engineering-work suggest` optionally recommends one adapted engineering playbook. `$engineering-work use <playbook-id>` confirms that methodology, but never grants implementation authority or changes Workflow evidence. The curated catalog covers diagnosis, bug and feature work, refactoring, performance, bounded experimentation, skill evaluation, and safe continuity; shipping, merge, deployment, autopilot landing, and destructive cleanup stay outside Workflow.

`/auto-work` advances a revisioned Schema-6 Run through protected implementation and fresh Review until its next human gate or terminal state. Only an external Host Adapter can protect Harness provenance; a directly configured Harness remains Shadow Mode. Cursor human decisions use exactly `/auto-work accept-delivery <run-id>@<revision>`, `/auto-work approve-correction <run-id>@<revision>`, or `/auto-work stop <run-id>@<revision>` so the host can inject a receipt outside model context. Codex and portable targets remain Manual-only.

Removed in Workflow 6: `/work-models`, `/work-verification`, `/work-watch`, and `/work-control`. Model pools, Verification Profiles, controller-owned workers, worktrees, sandboxes, command runners, and retry recipes are not Workflow responsibilities.

## Artifact protocol

Schema 6 uses intent-only verification:

`Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`

Authoritative Roots contain no working directory, command, tool, model, route, task recipe, or retry count. Evidence contains Check ID, grade, observation, evidence hashes, limitations, and optional protected harness-attestation hash.

Workflow 6 is the only maintained artifact, protocol, status, and runtime contract. Every other artifact schema is rejected as unsupported; Workflow does not read, explain, convert, resume, or accept it.

See [overview](docs/overview.md), [profiles](docs/profiles.md), [Manual Workflow](docs/manual-workflow.md), and [configuration](docs/configuration.md).

## Components

- Commands and Skills define the Manual lifecycle and collect closed semantic observations.
- The bundled `dist/manual-workflow.mjs` program validates and deterministically constructs Manual artifacts without repository discovery, execution, MCP, or state.
- Schemas and the validator define closed Schema-6 artifacts.
- Core modules validate authority, lineage, evidence, generic PhaseRequest and PhaseResult contracts.
- Host adapters bind the exact Root, canonical workspace, Review selection, and protected receipts.
- Project harness adapters supply concrete execution outside the Workflow core.
- Generated Cursor, Codex, and portable targets share canonical sources.

## Development

Use repository scripts in `package.json` as this repository's development harness. These scripts may use concrete tools because they maintain this repository; they are not shipped Workflow execution policy.

Architecture tests protect the Core-to-Harness boundary and ensure concrete execution details do not enter authoritative artifacts or Workflow evaluation. Release validation rebuilds runtime validators, host bundles, and portable targets and checks for drift.

Commit, push, deployment, local installation, and host restart are separate operations.
