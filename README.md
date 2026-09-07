# Workflow

Workflow helps people and executors agree on understandable plans, implement them, review the result, and correct concrete findings. The approved plan and human-readable reports stay in the native task.

[Installation](docs/installation.md) · [Working guide](docs/manual-workflow.md) · [Latest release](https://github.com/geldmacher/workflow/releases/latest)

## How it works

1. Use `/plan-work` in Cursor or `$plan-work` in Codex to prepare an actionable plan. The plan describes outcomes, boundaries, consequential decisions, and verification at the right level of detail.
2. Start implementation using the host's native implementation action. The executor works within the approved assignment and reports changes, actual checks, deviations, and limitations.
3. Start `/review-work` or `$review-work` separately. Review inspects the current result without repository changes and explains whether the goal is achieved, corrections are needed, or questions remain open.
4. Commission `/correct-work` or `$correct-work` for the named findings, then request a fresh Review.

A receiving task needs an explicit [handoff](docs/manual-workflow.md#handoff): the approved plan, current assignment, reports, working state, and unresolved decisions. Documents have content requirements, while their structure remains appropriate to the task. There is no machine counterpart to maintain.

## Supporting actions

- `work-status` explains documented progress and uncertainties; `explain-work` explains decisions and findings.
- `learn-from-work` saves explicitly commissioned, confirmed project lessons.
- `engineering-work` optionally suggests or applies a selected method.
- `workflow-doctor` inspects verification readiness without product startup; `verification-work` inspects or maintains an authorized project verifier.

Cursor and Codex use native implementation. Portable clients additionally expose `implement-work`. All three packages share the same source instructions and require only a host capable of using skills. Workflow has no Node runtime requirement, hooks, MCP service, or automation profiles.

## Boundaries

Humans commission phases separately. Existing approval remains valid within its scope; material goal or permission changes need a decision. The executor chooses concrete tools under host and project permissions. Failed necessary checks prevent success; missing proof stays visible. Workflow supplies a working method, not technical enforcement or cryptographic approval guarantees.

The finish line is repository work. Commit, push, PR, merge, deployment, installation, production, publication, and learning are not automatic phase transitions.

## Development

The contributor north star is `AGENTS.md`. Shared instructions live in `skills/` and `references/`; the target builder adds only necessary host differences. Node.js 22 and npm are needed for development tooling, not skill use.

Run `npm ci`, `npm run build:targets`, and `npm run release-check`. Checks cover packaging, links, context, deterministic archives, and isolated deployment behavior. Realistic [behavior exercises](docs/behavior-validation.md) establish skill behavior separately from structural validation.

This checkout contains an unreleased incompatible redesign. The package version remains at the last release until an explicit version cut. Release and local deployment are separate authorized operations; repository checks do not establish installation or host activation.
