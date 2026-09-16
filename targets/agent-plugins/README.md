# Workflow for Agent Plugins

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix findings in compatible coding agents.

- **Agree on the work first:** define the goal and how to check it.
- **Understand the result:** see what changed, checks performed, and open issues.
- **Choose how much to delegate:** request individual steps or an Auto-Work sequence.

## Install or update

This portable package supplies skills for compatible coding agents. Loading and activating it depends on your client's plugin support; follow that client's package instructions.

The included `install-release` skill installs Workflow releases for **Cursor or Codex only**. It does not install this portable package into another client. If you want to use one of those supported hosts, follow the [first-install prompt and activation steps](../../docs/installation.md#install-from-your-harness). No repository checkout, Node.js, or npm is needed for those release installations.

In Cursor, use `/install-release` for updates; in Codex, use `$install-release`. In another host, explicitly name Cursor or Codex before asking this skill to install anything.

## Try your first task

Open a project and ask:

> Use auto-work light to add CSV export to the orders page. Export the currently filtered orders using the visible columns. Follow the existing download conventions and use at most three correction rounds.

You approve the plan. The agent implements it, delegates review to a fresh separate agent, and addresses findings within the limit. You then receive the result and its checks for acceptance. Auto-Work requires native delegation to a separate reviewer. [Follow the walkthrough](../../docs/auto-work.md).

## Choose how to work

| Mode | Your involvement |
|---|---|
| Manual | Request each phase separately. |
| Light | Approve the plan and accept the reviewed result. |
| Dark | Define the goal and scope; delegate planning and the review/correction sequence. |

Both Auto-Work modes pause for important unresolved decisions. Publishing or deploying needs an explicit assignment.

Prefer manual work? Use `plan-work`, approve the plan, and request `implement-work`. Then request `review-work`; use `correct-work` for findings and request a fresh review afterward. See the [working guide](../../docs/manual-workflow.md).

## Make future tasks easier

- [Save reviewed lessons](../../docs/project-improvement.md#save-project-knowledge) in project guidance when you request it.
- [Keep checks repeatable](../../docs/project-improvement.md#keep-checks-useful) with practical verification instructions.
- [Choose a fitting method](../../docs/project-improvement.md#choose-a-working-method) for the task through optional playbooks.

Your coding environment controls execution and permissions. Workflow supplies the skills and reference documents.
