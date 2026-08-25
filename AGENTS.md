# Workflow north star

Workflow is a host-neutral lifecycle and evidence kernel for trustworthy repository delivery. It standardizes **Plan → Implement → Review → Correct or Replan** while preserving human authority, immutable intent, honest evidence, and a repository-only finish line.

## Workflow owns

- A human-approved Schema-6 Intent Root: goal, acceptance, scope, risk, authority, budgets, protected paths, and external effects.
- Schema 6 is the only maintained artifact, protocol, status, and runtime world. Other Workflow generations have no readers, compatibility states, migrations, explanations, acceptance, or transitions.
- Phase transitions, immutable artifact lineage, status derivation, evidence grades, and the human decisions required at material boundaries.
- The invariants that Review is repository-read-only, known failed required Checks block delivery, and unavailable proof never becomes success.
- Exact Root, workspace, predecessor, receipt, and snapshot binding. These bindings establish authority and provenance, not execution policy.

## The project harness owns

- Repository discovery and every concrete execution choice: commands, programs, tools, models, runners, working directories, environment setup, sandboxes, worktrees, retries, and verification strategy.
- Enforcement of phase constraints inside the active host and an opaque attestation of what it observed.
- Project-specific meaning for frameworks such as DDEV, npm, Git, language toolchains, browsers, services, or custom scripts.

Workflow must never parse, classify, allowlist, rewrite, compare, or execute those concrete choices. It may retain opaque trace text for humans, but trace text is never authority. If a rule needs to know a program, tool, model, host, or framework name, it belongs in a harness adapter, not in the Workflow core.

## Evidence and failure boundary

- A protected harness attestation may verify a Check only when it binds the exact Root, verification intent, workspace, and repository snapshot.
- Missing attestation caps the claim at supported or provisional. An attested failure remains failed. A mismatched attestation is rejected.
- Harness or Workflow availability failures affect only the targeted Workflow phase. Ordinary Cursor and Codex prompts, shell, tasks, browser, and MCP use remain available.
- No profile automatically pushes, opens or merges a PR, deploys, accesses production, integrates a branch, or publishes learning.

## Profiles

- **Manual is the default:** the human separately authorizes Plan, implementation, Review, correction or replan, provisional acceptance, and learning.
- **Supervised:** Workflow may orchestrate a compatible harness inside an approved Root, but a human accepts every delivery.
- **Autonomous:** only an exact previously qualified key may omit final acceptance; missing capability or qualification proof downgrades to supervised or Shadow Mode.
- Profiles change human gates, never the ownership of concrete execution.

## Change guardrails

Keep this root `AGENTS.md` as the one contributor Northstar for Cursor and Codex. Extend the existing lifecycle and artifact contracts before adding surfaces. Core modules must not depend on process execution, host SDKs, model catalogs, command parsers, or project-framework rules. Repository build, test, and deployment scripts are this repository's own development harness and are outside the shipped Workflow runtime boundary.
