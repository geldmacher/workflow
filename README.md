<img src="assets/logo.svg" alt="Workflow" width="64" height="64">

# Workflow

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix the issues it finds. It works with Cursor, Codex, and compatible coding agents.

- **Agree on the work first.** Clarify the goal, important decisions, and how to check the result.
- **Understand what you get.** See what changed, what was checked, and what still needs attention.
- **Control the next step.** Request planning, implementation, review, and correction separately.

## Install or update from a release

Use the [latest stable GitHub Release](https://github.com/geldmacher/workflow/releases/latest) for installation and updates. Choose manual installation or let your own agent handle it. No repository checkout, Node.js, or npm is needed.

**Manually:** download the release archive for Cursor or Codex together with `SHA256SUMS` and `provenance.json`, verify the files, and follow the [manual installation steps](docs/installation.md#manual-installation). For updates, follow the [manual update steps](docs/installation.md#manual-update) to back up and replace the complete package.

**With your agent:** for a first installation, paste this into Cursor or Codex in a mode that can make changes:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

Your agent needs GitHub access and permission to install the plugin. The selected release must contain `install-release`.

**Update with your agent:** use the included `install-release` skill:

- Cursor: `/install-release Update Workflow to the latest stable release for Cursor.`
- Codex: `$install-release Update Workflow to the latest stable release for Codex.`

Follow the reported activation steps: reload Cursor; in Codex, restart the app and install or refresh Workflow in the Plugins Directory. Then start a fresh task. See the [installation guide](docs/installation.md) for details and troubleshooting.

## Start with the manual workflow

The recommended starting point is **plan → implement → review → correct if needed → review again**. Open a project and request each phase separately.

**1. Plan the change.** Ask:

> Use plan-work to add CSV export to the orders page. Export only the currently filtered orders, using the visible columns. Empty exports should contain headers. Follow the existing download conventions.

Ordinary language works. To select the skill directly, use `$plan-work` in Codex, `/plan-work` in Cursor, or `plan-work` in portable clients. Use the same prefix for the skills below.

**2. Approve and implement.** Check the proposed behavior, scope, and checks, then select **Implement Plan** in Cursor or Codex. In a portable client, ask `implement-work` to implement the approved plan. You receive the changes, checks, and any open issues.

**3. Request review.** After implementation, ask:

> Use review-work to review the CSV export against the approved plan and implementation report.

**4. Correct if needed.** If review finds an issue, ask:

> Use correct-work to fix the CSV export findings from this review and run the affected checks.

Then request `review-work` again. A positive review with the required proof completes the repository work. Publishing or deploying needs an explicit request.

For a small, obvious edit, a direct request to your agent may be enough. For the full sequence, a bug-fix example, and tips on reusing checks, follow the [working guide](docs/manual-workflow.md).

## Make future tasks easier

- [Set up or maintain project feedback](docs/project-improvement.md#set-up-and-maintain-project-feedback) with clear project purpose, useful checks and agent guidance.
- **Save useful lessons** in project guidance after review, when you request it. [Learning](docs/project-improvement.md#save-project-knowledge)
- **Keep checks repeatable** with documented steps for testing real behavior. [Verification](docs/project-improvement.md#keep-checks-useful)
- **Choose a fitting method** for a bug fix, feature, or performance problem. [Playbooks](docs/project-improvement.md#choose-a-working-method)

[Working guide](docs/manual-workflow.md) · [Development and releases](docs/release-checklist.md) · [Latest release](https://github.com/geldmacher/workflow/releases/latest)

**Experimental: Auto-Work.** An optional approach connects the phases through native agents. Its Light/Dark modes, requirements, and limits are explained in the [separate guide](docs/auto-work.md).
