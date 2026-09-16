# Workflow for Codex

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix findings in Codex.

- **Agree on the work first:** define the goal and how to check it.
- **Understand the result:** see what changed, checks performed, and open issues.
- **Choose how much to delegate:** request individual steps or an Auto-Work sequence.

## Install or update from a release

Use the [latest stable GitHub Release](https://github.com/geldmacher/workflow/releases/latest) for installation and updates. No repository checkout, Node.js, or npm is needed.

**Manually:** download `geldmacher-workflow-codex-<tag>.zip`, `SHA256SUMS`, and `provenance.json` from the same release, then follow the [manual installation](../../docs/installation.md#manual-installation) or [manual update](../../docs/installation.md#manual-update) steps.

**With your agent:** for a first installation, paste this into Codex in a mode that can make changes:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

The agent needs GitHub access and installation permissions; the selected release must contain `install-release`.

**Update with your agent:** use the included skill:

> $install-release Update Workflow to the latest stable release for Codex.

Follow the reported activation steps: fully restart the app, install or refresh Workflow in the Plugins Directory, check the installed copy, and start a fresh task. The [installation guide](../../docs/installation.md) covers each step and recovery.

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

Prefer manual work? Use `$plan-work`, approve the plan, and select **Implement Plan**. Then request `$review-work`; use `$correct-work` for findings and request a fresh review afterward. See the [working guide](../../docs/manual-workflow.md).

## Make future tasks easier

- [Save reviewed lessons](../../docs/project-improvement.md#save-project-knowledge) in project guidance when you request it.
- [Keep checks repeatable](../../docs/project-improvement.md#keep-checks-useful) with practical verification instructions.
- [Choose a fitting method](../../docs/project-improvement.md#choose-a-working-method) for the task through optional playbooks.

Your coding environment controls execution and permissions. Workflow supplies the skills and reference documents.
