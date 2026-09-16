# Working with Workflow

Workflow turns a development task into a clear sequence: **plan → implement → review → correct if needed → review again**. A skill is a set of instructions your coding agent uses for one of these jobs.

You can request each step yourself, or ask [Auto-Work](auto-work.md) to run the sequence. In either case, the plan and reports stay in your task, so you can see what was agreed, what happened, and what comes next.

New here? Start with [installation](installation.md), then follow the CSV-export example below. To explore optional help, see [project knowledge, checks, and methods](project-improvement.md).

## Choosing a skill

You can use ordinary language, such as “Create an implementation plan for CSV export.” To select a skill directly, use `$skill-name` in Codex or `/skill-name` in Cursor. Other compatible clients use the skill name without a prefix.

| What you want | Skill or action |
|---|---|
| Plan a change | `plan-work` |
| Implement an approved plan | Native **Implement Plan** in Cursor/Codex; `implement-work` in portable clients |
| Run planning, implementation, review, and correction together | `auto-work` |
| Check the result against the plan | `review-work` |
| Fix findings from a review | `correct-work` |
| Understand a finding or decision | `explain-work` |
| See what is done and what remains | `work-status` |
| Save reviewed project lessons | `learn-from-work` |
| Find a suitable working method | `engineering-work` |
| Check whether verification is ready | `workflow-doctor` |
| Inspect, create, or update reusable verification instructions | `verification-work` |

Requesting implementation does not start Auto-Work. Ask for that sequence explicitly if you want it. Explaining a finding or asking for status does not start a new review. Running existing tests does not require a separate verifier-management step.

In Cursor, use Plan Mode for planning, Ask Mode for standalone review, and Agent Mode for implementation, correction, and learning. In Codex, use Plan mode for planning, then Implement Plan. A read-only mode cannot make changes.

## Plan and implementation

### 1. Describe the change

For example, in Codex:

> $plan-work Add CSV export to the orders page. Export only the currently filtered orders, using the visible columns. An empty export should contain the column headers. Follow the existing download conventions.

In Cursor, replace `$plan-work` with `/plan-work`.

The agent inspects your project and prepares a plan. It explains the intended result, scope, important decisions, risks, and checks. It also reads relevant saved project lessons and checks that they still apply. Questions should resolve real uncertainty; a clear, small task should produce a proportionate plan.

For this example, look for checks covering filtered orders, visible columns, and empty exports. Resolve important choices before approving the plan. Planning may also offer optional [methods or verifier work](project-improvement.md).

### 2. Approve and implement

Check the plan, then use **Implement Plan** in Cursor or Codex. In a portable client, explicitly request `implement-work` against that plan.

The implementation follows the approved scope and preserves unrelated changes. Its report explains what changed, checks and results, deviations, and anything still open. Useful project lessons are carried forward for review. Important changes to the goal or permissions need your decision; routine implementation choices stay with the agent.

A successful implementation report is the input to review. It does not mean review has already happened.

## Review and correction

### 3. Request a review

> $review-work Review the CSV export against the approved plan and the implementation report.

Review checks the result without changing repository files. It can use still-applicable evidence after checking its origin, output, and relevance; changed or uncertain evidence needs a fresh check. It must cover the whole plan, not just the tests that happened to pass. Test output may only be created outside the repository, and checks that cannot run within those limits remain visible gaps.

The result tells you whether the goal is achieved, corrections are needed, or proof is missing. A finding explains the observed problem, why it matters, what should change, and how to check the fix.

### 4. Correct findings, then review again

Suppose review finds that the export ignores the active filter:

> $correct-work Fix the review finding about filtered CSV exports. Preserve the visible-column selection and check both filtered and empty exports.

Correction addresses the requested findings and reports the result. Then request `review-work` again. In manual work, each review is a separate request.

Sometimes only a check is missing. You can ask `correct-work` to collect that evidence without changing code unless the check reveals a defect. A failed necessary check or missing required proof prevents a positive completion claim.

## Handoff

When continuing in a new task or with another executor, supply:

- The approved plan and current assignment.
- Relevant implementation and review reports, with their evidence.
- The current repository state, open decisions, and next action.
- The complete open learning collection: each lesson, its evidence, and proposed destination. Include reasons and replacements for retired lessons where relevant.

Use accessible task references or paste the relevant content. “Continue where we left off” is insufficient when the new executor cannot read the earlier task. The receiver compares the handoff with the actual repository; missing or contradictory context must be resolved before dependent work.

For an Auto-Work handoff, also preserve the mode, correction budget already used, pending acceptance, and any delivery assignment. See [pause and resume](auto-work.md#pause-and-resume).

## Learning across reviews

Review can offer to save useful project knowledge, such as the verified download helper for CSV exports. Saving remains your choice. See [how learning works](project-improvement.md#save-project-knowledge).

## Supporting work

Planning may offer a suitable method or help with repeatable checks. You can accept either, both, or neither. See [how to choose](project-improvement.md#what-you-choose).

### Engineering playbooks in the process

A playbook gives the agent a method suited to the task. See [methods and examples](project-improvement.md#choose-a-working-method).

### Verification in the process

A verifier records how to exercise real behavior and recognize a correct result. See [creating and maintaining checks](project-improvement.md#keep-checks-useful).

### Selection and execution

Offers explain their benefit and scope; only selected additions enter the plan. See [selection and execution](project-improvement.md#what-you-choose) for approval and maintenance details.

## Completion

When the goal is achieved and the required checks support it, no further Workflow phase is needed. Reports distinguish actual results from missing proof. They use your language and enough detail for the task, without a fixed document template.

The default outcome is work in your repository. Commit, push, pull requests, merge, deployment, installation, production access, publication, and learning require explicit authorization. Workflow supplies instructions; your coding environment controls execution and permissions.

## Examples of clear phase endings

These are fictional reports illustrating the kind of information you receive, not executed checks or required wording. Real reports include their actual evidence.

### Add an empty CSV export

After implementation:

> Empty exports now contain column headers. The empty and populated export checks pass. Request `$review-work` to check the result against the plan.

If review finds a missed requirement:

> Correction needed: filtered exports still include hidden orders. The downloaded rows do not match the active filter. Fix the selection and recheck filtered and empty exports.

After correction, request a fresh review. A positive review might conclude:

> The goal is achieved. Exported rows match the active filter, columns match the visible selection, and empty exports retain their headers. The required checks support the current change.

### Review a resumed settings change

> Earlier save-test results still apply to the unchanged code and test conditions. The required keyboard check is missing, so completion is unconfirmed. Request that check; no code change is needed unless it reveals a defect.

### Keep export lessons through correction rounds

Lessons remain in the reports even if you choose to fix code first. See the [worked learning example](project-improvement.md#example-lessons-through-corrections).
