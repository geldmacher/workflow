# Working with Workflow

The recommended way to use Workflow is to request each phase yourself: **plan → implement → review → correct if needed → review again**. A skill is a set of instructions your coding agent uses for one of these jobs. Plans and reports stay in your task, so you can see what was agreed, what happened, and what comes next.

New here? [Install Workflow](installation.md), then follow the feature example below. For a small, obvious edit, a direct request to your agent may be enough; use the full sequence when an agreed plan and review help establish the result.

You can use ordinary language, such as “Create an implementation plan for CSV export.” To select a skill directly, use `$skill-name` in Codex or `/skill-name` in Cursor. Other compatible clients use the skill name without a prefix. The examples below use Codex; replace the prefix for your host.

## Plan and implementation

### 1. Describe the change

Give the agent a goal, an observable result, and important boundaries. For a feature:

> $plan-work Add CSV export to the orders page. Export only the currently filtered orders, using the visible columns. An empty export should contain the column headers. Follow the existing download conventions.

The agent inspects your project and relevant saved lessons, then prepares a plan covering scope, decisions, risks, and checks. For this example, look for checks covering filtered orders, visible columns, and empty exports.

### 2. Approve and implement

Check the plan: does it describe the behavior you want, preserve the important boundaries, and explain how to check the result? Resolve consequential choices before approving it. Routine implementation details stay with the agent.

Then use **Implement Plan** in Cursor or Codex. In a portable client, ask:

> Use implement-work to implement the approved CSV export plan.

Implementation follows the approved scope and preserves unrelated changes. Its report explains what changed, actual checks and results, deviations, and anything still open. Important changes to the goal or permissions need your decision. Useful project lessons are carried forward for review.

A successful implementation report is the input to review. It does not mean review has already happened.

## Review and correction

### 3. Request a review

> $review-work Review the CSV export against the approved plan and the implementation report.

Review checks the whole plan without changing repository files. It can reuse evidence after checking its origin and current relevance; changed or uncertain evidence needs a fresh check. Check output may only be created outside the repository, and checks that cannot run within those limits remain visible gaps.

The result tells you whether the goal is achieved, corrections are needed, or proof is missing. Each finding explains the observation, impact, requested correction, and how to check it. A miss against the plan or specification remains distinct from a break with repository standards or simplicity.

### 4. Correct findings, then review again

Suppose review finds that the export ignores the active filter:

> $correct-work Fix the review finding about filtered CSV exports. Preserve the visible-column selection and check both filtered and empty exports.

Correction addresses the requested findings and reports the result. Then ask:

> $review-work Review the corrected CSV export against the approved plan and the correction report.

Each review is a separate request. Sometimes only a check is missing: ask `correct-work` to collect that evidence without changing code unless the check reveals a defect.

## Completion

When the goal is achieved and the required checks and review support it, no further Workflow phase is needed. A failed necessary check or missing required proof prevents a positive completion claim. Reports distinguish actual results from missing proof and use enough detail for the task.

The default outcome is work in your repository. Commit, push, pull requests, merge, deployment, installation, production access, publication, and learning require explicit authorization. Workflow supplies instructions; your coding environment controls execution and permissions.

## Example: fix lost settings

Use the same sequence for a bug. Start with the observed failure and expected behavior:

> $plan-work Fix the settings page losing saved values after reopening. Reproduce the failure first. Saved values must survive reopening the page. Preserve the existing settings format and use the project's existing checks.

Check and approve the plan, then use **Implement Plan** in Cursor or Codex. In a portable client, ask `implement-work` to implement that approved plan. Implementation should report the reproduced failure, the fix, and checks of the agreed behavior.

> $review-work Review the settings fix against the approved plan and implementation report, including the reproduction and reopening checks.

If review finds that reopening works but the existing settings format changed:

> $correct-work Restore the existing settings format as requested by the review. Preserve the successful reopening behavior and rerun the affected checks.

Then request `review-work` again against the same plan and the correction report. If the first review is positive with sufficient proof, no correction round is needed.

## Use Workflow efficiently

- **Match the process to the task.** A small, clear edit may need only a direct agent request and its relevant checks. A change with decisions or several steps benefits from a plan and review.
- **Write a concrete assignment.** State the goal, how you will recognize a correct result, and important constraints. Let the agent resolve routine technical details from the repository.
- **Reuse project knowledge and checks.** Supply relevant references. Suitable existing tests and verifiers need no new setup or verifier-management step.
- **Choose additions when they help.** Setup, playbooks, verifier work, and learning address concrete needs; they are not a checklist to run for every task.
- **Stop at sufficient proof.** Complete agreed requirements and necessary checks. More phases need a concrete unresolved question.
- **Keep continuations easy.** Stay in the task where possible. A new executor needs the applicable plan, current state, evidence, and next action.

## Choosing a skill

Use this reference when you need a particular action. Planning, implementation, review, and correction above cover the normal sequence.

| What you want | Skill or action |
|---|---|
| Plan a change | `plan-work` |
| Implement an approved plan | Native **Implement Plan** in Cursor/Codex; `implement-work` in portable clients |
| Check the result against the plan | `review-work` |
| Fix findings from a review | `correct-work` |
| Understand a finding or decision | `explain-work` |
| See what is done and what remains | `work-status` |
| Save reviewed project lessons | `learn-from-work` |
| Find a suitable working method | `engineering-work` |
| Establish project purpose, checks and agent guidance | `setup-workflow` |
| Inspect or update existing project setup | `maintain-workflow` |
| Check task prerequisites and verification readiness | `workflow-doctor` |
| Inspect, create, or update reusable verification instructions | `verification-work` |

Explaining a finding or asking for status does not start a new review. Running existing tests does not require a separate verifier-management step.

In Cursor, use Plan Mode for planning, Ask Mode for standalone review, and Agent Mode for implementation, correction, and learning. In Codex, use Plan mode for planning, then Implement Plan. A read-only mode cannot make changes. An agent already in a mode that can do the read-only work should not ask for a switch only to match this preference.

## Decisions during planning

Clear assignments need no interview. When missing goals, boundaries, interfaces, success checks, or a material trade-off prevent a sound plan, the agent may ask a few focused questions with a recommendation. A small plan can be brief.

For material changes, such as architecture, a breaking change, several surfaces, or schema and deployment, planning also notes relevant caller, data or migration, deployment and rollback, and security or auth effects. Speculation stays marked; routine fixes do not need that additional discussion.

Planning can offer [setup, maintenance, methods, or verifier work](project-improvement.md) for concrete task-relevant needs. You can accept, revise, or decline. Only selected additions enter the plan, and approved matching scope needs no repeated approval. Declined or unanswered offers are carried forward without repeated offers for unchanged scope.

## When another task already uses this repository

At the start of planning, the agent checks this repository for another active plan or implementation. A git worktree counts when it has uncommitted work, or a handoff or host task names that checkout. Commits that only exist on its branch do not. An unfinished plan for this repository also counts. A clean idle worktree does not. The same branch checked out twice, a documented unfinished task, or unrelated edits that implementation would otherwise change also count. A clean checkout with no other active work continues as usual. Planning does not create a worktree, and a plan does not have to use one.

When there is overlap, you get a warning and three choices: continue carefully in this checkout, wait, or isolate the work on its own branch and git worktree. Waiting is the recommendation when the other task is mid-edit on the same files. Isolation is the recommendation when someone else is already changing this repository, or when your checkout has unrelated edits that should stay untouched, and a later review can read that worktree. When a review could not see it, the recommendation stays in the current checkout and says why. You can still choose otherwise.

The plan records the choice. Implementation follows that record, and creates the worktree only after the plan allows isolate. Review and correction use that same checkout. Merging the branch back, or removing the worktree after you discard the attempt, happens only when you ask.

## Handoff

When continuing in a new task or with another executor, supply:

- The approved plan and current assignment.
- Relevant implementation and review reports, with their evidence.
- The current repository state, open decisions (including accepted, declined, or unanswered setup offers), and next action.
- The complete open learning collection: each lesson, its evidence, and proposed destination. Include reasons and replacements for retired lessons where relevant.

Use accessible task references or paste the relevant content. “Continue where we left off” is insufficient when the new executor cannot read the earlier task. The receiver compares the handoff with the actual repository; missing or contradictory context must be resolved before dependent work.

## Learning across reviews

Review can offer to save useful project knowledge, such as the verified download helper for CSV exports. Saving remains your choice. If the same correction has already come back, a structural change or a CI check is preferred over another guidance paragraph when it is sufficiently effective and proportionate to the assignment. A session can also show a navigation failure, wasteful tool use, or a steering instruction that does not change behavior. See [how learning works](project-improvement.md#save-project-knowledge).

## Supporting work

Use `setup-workflow` to establish a project feedback setup and `maintain-workflow` to inspect or update existing direction, checks, and guidance. Both reuse suitable definitions. Explicit direction changes include their documentation in the related implementation; planning and review carry pending updates read-only. Their [playbooks](../skills/setup-workflow/references/catalog.md) support a reasoned package offer, partial selection, and decline. For example: “Accept the code checks and project guidance; leave CI and subagents out.” See [setup examples](project-improvement.md#choose-setup-playbooks).

An engineering playbook gives the agent a method suited to the task. A verifier records how to exercise real behavior and recognize a correct result. See [methods and examples](project-improvement.md#choose-a-working-method), [creating and maintaining checks](project-improvement.md#keep-checks-useful), and [selection and execution](project-improvement.md#what-you-choose).

## Examples of clear phase endings

These are fictional reports illustrating the kind of information you receive, not executed checks or required wording. Real reports include their actual evidence.

### Add an empty CSV export

After implementation:

> Empty exports now contain column headers. The empty and populated export checks pass. Request `$review-work` to check the result against the plan.

If review finds a missed requirement:

> Correction needed: filtered exports still include hidden orders. The downloaded rows do not match the active filter. Fix the selection and recheck filtered and empty exports.

After correction, request a fresh review. A positive review might conclude:

> The goal is achieved. Exported rows match the active filter, columns match the visible selection, and empty exports retain their headers. The required checks support the current change.

### Plan while another task is in progress

> Another worktree already has an orders export in progress, and this checkout has unrelated edits. I recommend isolating this plan on its own branch and worktree. You can continue carefully here, or wait until that export lands. Say which you want. A worktree is only for this overlap, not for every plan.

### Review a resumed settings change

> Earlier save-test results still apply to the unchanged code and test conditions. The required keyboard check is missing, so completion is unconfirmed. Request that check; no code change is needed unless it reveals a defect.

### Keep export lessons through correction rounds

Lessons remain in the reports even if you choose to fix code first. See the [worked learning example](project-improvement.md#example-lessons-through-corrections).

## Experimental: Auto-Work

[Auto-Work](auto-work.md) is an experimental, separately commissioned approach that connects the phases through native agents. It is not the recommended starting point. Ordinary implementation or bug-fix requests do not commission this sequence.

Its separate guide explains Light/Dark, native agents and models, prerequisites, and limits. For a handoff, also preserve the mode, selected agents/models/settings and invocation evidence, spent/remaining correction rounds, pending acceptance, and any delivery assignment. See [pause and resume](auto-work.md#pause-and-resume).
