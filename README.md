<img src="assets/logo.svg" alt="Workflow" width="64" height="64">

# Workflow

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix the issues it finds. It works with Cursor, Codex, and compatible coding agents.

- **Agree on the work first.** Clarify the goal, important decisions, and how to check the result.
- **Understand what you get.** See what changed, what was checked, and what still needs attention.
- **Choose how much to delegate.** Request each step yourself or let Auto-Work run the sequence with independent review.

## Install or update

**First installation:** paste this into Cursor or Codex in a mode that can make changes:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

No repository checkout, Node.js, or npm is needed. Your agent needs GitHub access and permission to install the plugin. The prompt requires a published release containing `install-release`; the guide also covers manual installation.

**Already installed?** Use `/install-release` in Cursor or `$install-release` in Codex to update.

Follow the reported activation steps: reload Cursor; in Codex, restart the app and install or refresh Workflow in the Plugins Directory. Then start a fresh task. See the [installation guide](docs/installation.md) for details and troubleshooting.

## Try your first task

Open a project and ask:

> Use auto-work light to add CSV export to the orders page. Export the currently filtered orders using the visible columns. Follow the existing download conventions and use at most three correction rounds.

You approve the plan. Workflow implements it, asks a separate agent to review it, and addresses findings within the agreed limit. You then receive the result, checks, and any remaining issues. In Light mode, you accept the reviewed result before completion.

Auto-Work needs a host that can delegate to a separate reviewer. [Follow the walkthrough](docs/auto-work.md).

## Choose how to work

| Mode | Your involvement |
|---|---|
| Manual | Request planning, implementation, review, and correction separately. |
| Light | Approve the plan and accept the reviewed result; delegate the steps between. |
| Dark | Define the goal and scope; delegate planning and the review/correction sequence. |

Both Auto-Work modes pause for important unresolved decisions. Publishing or deploying changes requires an explicit request. [Compare the modes](docs/auto-work.md#choose-light-or-dark) or [follow the manual guide](docs/manual-workflow.md).

## Make future tasks easier

- **Save useful lessons** in project guidance after review, when you request it. [Learning](docs/project-improvement.md#save-project-knowledge)
- **Keep checks repeatable** with documented steps for testing real behavior. [Verification](docs/project-improvement.md#keep-checks-useful)
- **Choose a fitting method** for a bug fix, feature, or performance problem. [Playbooks](docs/project-improvement.md#choose-a-working-method)

[Working guide](docs/manual-workflow.md) · [Development and releases](docs/release-checklist.md) · [Latest release](https://github.com/geldmacher/workflow/releases/latest)
