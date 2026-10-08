# Workflow for Agent Plugins

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix findings in compatible coding agents.

- **Agree on the work first:** define the goal and how to check it.
- **Understand the result:** see what changed, checks performed, and open issues.
- **Control the next step:** request planning, implementation, review, and correction separately.

## Install or update

This portable package supplies skills for compatible coding agents. Loading and activating it depends on your client's plugin support; follow that client's package instructions.

The included `install-release` skill installs Workflow releases for **Cursor or Codex only**. It does not install this portable package into another client. For those supported hosts, the [release installation guide](../../docs/installation.md) covers manual installation and updates, prompts for your own agent, and activation. No repository checkout, Node.js, or npm is needed for those release installations.

In Cursor, use `/install-release` for updates; in Codex, use `$install-release`. In another host, explicitly name Cursor or Codex before asking this skill to install anything.

## Start with the manual workflow

The recommended starting point is **plan → implement → review → correct if needed → review again**. Open a project and request each phase separately.

**1. Plan the change.** Ask:

> Use plan-work to add CSV export to the orders page. Export only the currently filtered orders, using the visible columns. Empty exports should contain headers. Follow the existing download conventions.

**2. Approve and implement.** Check the proposed behavior, scope, and checks, then ask:

> Use implement-work to implement the approved CSV export plan.

You receive the changes, checks, and any open issues.

**3. Request review.** After implementation, ask:

> Use review-work to review the CSV export against the approved plan and implementation report.

**4. Correct if needed.** If review finds an issue, ask:

> Use correct-work to fix the CSV export findings from this review and run the affected checks.

Then request `review-work` again. A positive review with the required proof completes the repository work. Publishing or deploying needs an explicit request.

For a small, obvious edit, a direct request to your agent may be enough. For the full sequence, a bug-fix example, and tips on reusing checks, follow the [working guide](../../docs/manual-workflow.md).

## Make future tasks easier

- [Set up or maintain project feedback](../../docs/project-improvement.md#set-up-and-maintain-project-feedback) with clear project purpose, useful checks and agent guidance.
- [Save reviewed lessons](../../docs/project-improvement.md#save-project-knowledge) in project guidance when you request it.
- [Keep checks repeatable](../../docs/project-improvement.md#keep-checks-useful) with practical verification instructions.
- [Choose a fitting method](../../docs/project-improvement.md#choose-a-working-method) for the task through optional playbooks.

Your coding environment controls execution and permissions. Workflow supplies the skills and reference documents.

**Experimental: Auto-Work.** An optional approach connects the phases through native agents. Its Light/Dark modes, requirements, and limits are explained in the [separate guide](../../docs/auto-work.md).
