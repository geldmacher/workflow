# Workflow for Codex

Workflow provides a human-authorized Manual delivery loop for Codex: native `$plan-work`, normal implementation, fresh same-task `$review-work`, acceptance, learning, explanation, and artifact-derived status.

The Codex package has no host-specific automation runtime, route pool, credentials, background Run, worktree manager, automatic merge, push, publication, or deployment. It shares only immutable Schema-5 artifact contracts and the neutral Handoff Store at `~/.geldmacher/workflow/state/<repository-key>/handoff/`.

This target is intended for local installation through the personal Codex marketplace. Plugin hooks require explicit trust review and a new task after installation or update.

See the bundled [Manual Workflow guide](docs/manual-workflow.md) for the command flow, states, Evidence grades, Review outcomes, and recovery paths.
