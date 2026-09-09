<img src="assets/logo.svg" alt="Design" width="64" height="64">

# Workflow

**Clear plans. Reviewed results. You set the direction.**

Workflow brings structure to AI-assisted development in Cursor, Codex, and compatible coding agents. Turn a goal into an actionable plan, implement it, review the changes, and resolve findings—with clear reports of what changed, what was checked, and what remains open.

- **Agree on the work.** Define scope, important decisions, and verifiable goals before implementation.
- **Understand the result.** See the changes, actual checks, and remaining issues in your task.
- **Choose how to work.** Commission individual steps or start an Auto-Work sequence with independent review and bounded correction rounds.

[Installation](docs/installation.md) · [Working guide](docs/manual-workflow.md) · [Latest release](https://github.com/geldmacher/workflow/releases/latest)

## Install or update

Use `/install-release` in Cursor or `$install-release` in Codex to install the latest stable Workflow release for the current host. The skill verifies the selected download and preserves a recoverable previous installation. It requires no repository checkout, Node.js, or npm. See the [installation guide](docs/installation.md#install-from-your-harness) for prerequisites and host activation.

For a first installation, or an older version without this skill, paste this prompt into Cursor or Codex:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

This bootstrap becomes available with the first published release containing `install-release`. It does not need Workflow to be installed already. File installation and host activation are separate: follow the reported reload or restart, Plugins Directory, and fresh-task steps.

## Choose how to work

| Mode | Your role | What Workflow does |
|---|---|---|
| Manual | Commission planning, implementation, review, and correction separately. | Guide each requested step and report its result. |
| Light (default for Auto-Work) | Approve the plan and accept the reviewed result. | Run implementation, independent review, and bounded correction rounds in between. |
| Dark | Explicitly commission a goal and scope. | Prepare the plan and run the sequence through verified repository work without individual plan and result approvals. |

Both Auto-Work modes pause for consequential unresolved decisions and require a fresh separate native reviewer for every review. Auto-Work needs a host that can delegate to another agent; it cannot complete without that capability.

## Try it on a real task

For example, add a CSV export to an existing orders page with Light Auto-Work:

> Use auto-work light to add CSV export to the orders page. Export the currently filtered orders using the visible columns. Follow the existing download conventions and use at most three correction rounds.

Workflow prepares a plan for your approval, then implements it, has a separate agent review the result, and addresses findings within the correction limit. You receive the reviewed result with its checks and any remaining limitations for acceptance.

Invoke `/auto-work` in Cursor, `$auto-work` in Codex, or `auto-work` in a compatible portable client. See the [operating rules](skills/auto-work/references/operation.md) for mode switches, pauses, and resumption.

Prefer to commission each step yourself?

1. Start `/plan-work` in Cursor or `$plan-work` in Codex with your goal.
2. Approve the plan and start the host's native implementation action.
3. Request `/review-work` or `$review-work` to assess the result without repository changes.
4. Request `/correct-work` or `$correct-work` for the findings you want fixed, then commission a fresh review.

Portable clients additionally expose `implement-work`. The [working guide](docs/manual-workflow.md) covers the full manual flow and [handoffs between tasks](docs/manual-workflow.md#handoff).

## Make the next task better

Workflow helps useful discoveries outlast the task that produced them. A verified setup recipe, a project-specific convention, or a lesson from a difficult correction can become guidance for future work—so the next task starts with what the project has already learned.

### Turn experience into project knowledge

During implementation and correction, Workflow captures reusable learning candidates with their evidence and proposed destination. Every review checks both earlier and new candidates and offers the confirmed, applicable lessons through `learn-from-work`. Candidates stay in the reports across correction rounds, so you can take up the offer later without losing earlier discoveries.

When you commission `learn-from-work`, it checks the lessons against current code, later findings, and existing guidance before saving them in appropriate project instructions or skills. It merges duplicates and keeps unresolved conflicts open. Future planning reads the saved guidance and checks that it still applies.

For the CSV export example, a confirmed lesson might explain which existing download helper to use and how to prepare isolated export data. Saving that guidance gives future export tasks a demonstrated starting point. The process improves the project's working knowledge over time; it does not train the model or silently rewrite project rules. Learning is offered when there is something supported and useful to save, and remains your choice—even when Auto-Work runs the other phases.

See [learning across reviews](docs/manual-workflow.md#learning-across-reviews) for the offer, reconciliation, and saving process.

### Keep verification useful as the product changes

A project verifier is a reusable skill for checking real behavior: how to start the relevant UI, CLI, or service, exercise a feature, recognize the expected result, retain evidence, and clean up test resources. It gives later tasks a concrete way to check whether the product still does what it should.

`workflow-doctor` inspects verification readiness without starting the product. `verification-work` inspects, creates, or maintains the verifier. During planning, Workflow reuses suitable existing checks directly. If coverage is missing or a verifier has become stale, it proactively offers a concrete creation or maintenance proposal with its benefit, scope, destination, and closing trial.

Once you accept that work and commission implementation, verifier changes and their trial are part of the assignment; you do not need to remember a separate maintenance step. Maintenance normally covers the affected features. An explicitly requested `maintain full` covers the agreed full feature map. At implementation close, the agent exercises the maintained behavior and reports evidence and gaps; review then checks the result against the plan and product.

For the CSV export, accepted verifier work could document how to set filters, trigger the download, and check its columns and rows. If an approved change later alters the download flow, planning can identify and offer the necessary verifier update. Product regressions remain findings; maintenance must not change expected results just to make a failing check pass.

**Automatic reuse and maintenance offers; verifier edits after acceptance.** Workflow preserves approval already given for the scope. It does not run a background maintenance service. See [verification in the process](docs/manual-workflow.md#verification-in-the-process).

### Use a method that fits the task

Engineering playbooks give the agent a focused approach for the work at hand. During planning, Workflow considers useful methods and offers relevant choices with their benefit, intended phase, one recommendation, and an option to use none. You do not need to know the playbook names in advance. Only selected methods are loaded and included in the plan.

| Your task | Example playbooks | What they help establish |
|---|---|---|
| Understand or fix a defect | `investigation`, `bug-fix`, `runtime-forensics`, `trace-forensics` | An explanation, a reproduced defect and verified correction, or a diagnosis grounded in runtime or captured evidence. |
| Build or reshape a feature | `feature`, `refactoring`, `prototype` | Intentional behavior, preserved behavior during structural changes, or evidence for a decision before production work. |
| Improve performance or another metric | `performance`, `hillclimb` | A measured improvement against a baseline, or bounded iterations toward an agreed metric. |
| Match a design or assess agent behavior | `visual-parity`, `evaluation`, `skill-authoring` | A comparison against a fixed visual reference, an evaluation using fixed criteria, or a structurally validated skill. |
| Resume or pause work | `session-pickup`, `pause-safely` | A grounded restart or a clear, resumable stopping point. |

Playbook and verifier offers are independent: you can choose either, both, or neither. Declining an offer leaves its additions out of the plan; missing necessary verification still stays visible. See the [playbook catalog](skills/engineering-work/references/catalog.md) for all methods and [how offers work](docs/manual-workflow.md#supporting-work).

`work-status` and `explain-work` help you understand progress, open questions, and decisions throughout the task.

## Scope and permissions

Workflow supplies skills and reference documents. Your coding agent runs the work under its host and project permissions. No Workflow runtime, Node.js, hooks, or MCP service is required. Auto-Work runs in the active task; it provides no background worker or restart guarantee.

Plans and reports stay in your task. Existing approval remains valid within its scope; material changes to goals or permissions need your decision. Failed necessary checks prevent successful completion, and missing proof stays visible.

The default finish line is repository work. Commit, push, PR, merge, deployment, installation, production access, publication, and learning each need explicit authorization. Optional Auto-Work delivery requires named actions and destinations: Light needs result acceptance, and Dark additionally needs existing technically enforced project checks covering the actual delivered candidate. See [delivery rules](skills/auto-work/references/delivery.md).

## Development

The contributor north star is `AGENTS.md`. Shared instructions live in `skills/` and `references/`; the target builder adds only necessary host differences. Node.js 22 and npm are needed for development tooling, not skill use.

Run `npm ci`, `npm run build:targets`, and `npm run release-check`. Checks cover packaging, links, context, deterministic archives, and isolated deployment behavior. Realistic [behavior exercises](docs/behavior-validation.md) establish skill behavior separately from structural validation.

Release and local deployment are separate authorized operations; repository checks do not establish installation or host activation.
