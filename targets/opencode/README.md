# Workflow for OpenCode

**Clear plans. Reviewed results. You set the direction.**

Workflow helps your coding agent plan a change, implement it, review the result, and fix findings in OpenCode 2.1.2.

- **Agree on the work first:** define the goal and how to check it.
- **Understand the result:** see what changed, checks performed, and open issues.
- **Control the next step:** request planning, implementation, review, and correction separately.

This package targets [OpenCode 2.1.2](https://opencode.ai/changelog) only (`npm` package `@opencode/cli`). The `opencode-ai` package remains OpenCode 1.x and is not supported. Skill discovery and explicit loading follow the [OpenCode 2.1 skills guide](https://opencode.ai/v2/docs/skills/). Slash commands follow the [commands guide](https://opencode.ai/v2/docs/commands/).

## Install or update from a release

Use the [latest stable GitHub Release](https://github.com/geldmacher/workflow/releases/latest) for installation and updates. No repository checkout, Node.js, or npm is needed.

**Manually:** download `geldmacher-workflow-opencode-<tag>.zip`, `SHA256SUMS`, and `provenance.json` from the same release, then follow the [manual installation](../../docs/installation.md#manual-installation) or [manual update](../../docs/installation.md#manual-update) steps.

**With your agent:** for a first installation, paste this into OpenCode in a mode that can make changes:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for OpenCode. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

The agent needs GitHub access and installation permissions; the selected release must contain `install-release`.

**Update with your agent:** use the included skill:

> @install-release Update Workflow to the latest stable release for OpenCode.

`/install-release` sends the same request. Follow the reported activation steps and start a new OpenCode session. The [installation guide](../../docs/installation.md) covers each step and recovery.

## How skills are selected

OpenCode lists each skill that has a description. Model auto-invocation stays enabled: these skills do not set `opencode/autoinvoke` to false. You can also select one yourself:

- Type `@plan-work` to load that skill by id.
- Type `/plan-work` to run the matching command, which loads the same skill.

Skill ids are the directory names, such as `plan-work`. The frontmatter `name` matches that id.

## Start with the manual workflow

The recommended starting point is **plan → implement → review → correct if needed → review again**. Open a project and request each phase separately.

**1. Plan the change.** Ask:

> @plan-work Add CSV export to the orders page. Export only the currently filtered orders, using the visible columns. Empty exports should contain headers. Follow the existing download conventions.

**2. Approve and implement.** Check the proposed behavior, scope, and checks, then continue with the OpenCode build agent. You receive the changes, checks, and any open issues.

**3. Request review.** After implementation, ask:

> @review-work Review the CSV export against the approved plan and implementation report.

**4. Correct if needed.** If review finds an issue, ask:

> @correct-work Fix the CSV export findings from this review and run the affected checks.

Then request `@review-work` again. A positive review with the required proof completes the repository work. Publishing or deploying needs an explicit request.

For a small, obvious edit, a direct request to your agent may be enough. For the full sequence, a bug-fix example, and tips on reusing checks, follow the [working guide](../../docs/manual-workflow.md).

## Make future tasks easier

- [Set up or maintain project feedback](../../docs/project-improvement.md#set-up-and-maintain-project-feedback) with clear project purpose, useful checks and agent guidance.
- [Save reviewed lessons](../../docs/project-improvement.md#save-project-knowledge) in project guidance when you request it.
- [Keep checks repeatable](../../docs/project-improvement.md#keep-checks-useful) with practical verification instructions.
- [Choose a fitting method](../../docs/project-improvement.md#choose-a-working-method) for the task through optional playbooks.

Your coding environment controls execution and permissions. Workflow supplies the skills and reference documents.

**Experimental: Auto-Work.** An optional approach connects the phases through native agents. OpenCode's `subagent` tool and the default subagent depth are described in the [separate guide](../../docs/auto-work.md).
