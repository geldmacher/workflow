# Let Auto-Work run the sequence

Auto-Work connects planning, implementation, independent review, and correction in one request. You define the task and how much to delegate. It reports what was achieved, what was checked, and what remains open.

Your coding environment must be able to delegate each review to a fresh separate agent. Without that capability, Auto-Work cannot complete its review step. You can still use the [manual workflow](manual-workflow.md).

## Choose Light or Dark

| | Light — the default | Dark — explicitly requested |
|---|---|---|
| Before implementation | You approve the plan. | The agent prepares a plan within your stated goal and scope. |
| Implementation and correction | The agent runs the sequence. | The agent runs the sequence. |
| Review | A fresh separate agent reviews each round. | A fresh separate agent reviews each round. |
| Completion | You accept the reviewed result. | The sequence can finish after positive review and necessary checks. |

Both modes pause for important unresolved decisions, missing access, or exhausted limits. Dark does not let the agent invent requirements or bypass permissions. The mode changes who approves the plan and result, not the quality requirements.

## Start with a concrete task

Open the project and use this prompt:

> Use auto-work light to add CSV export to the orders page. Export the currently filtered orders using the visible columns. Empty exports should contain headers. Follow the existing download conventions and use at most three correction rounds.

You can also invoke `$auto-work` in Codex or `/auto-work` in Cursor. Use Cursor Agent Mode for the sequence. In Codex, a read-only Plan mode can prepare the plan but cannot implement it; use native implementation to continue the authorized sequence. Portable clients use `auto-work` and their available execution capabilities.

For Dark, say “Use auto-work dark” and give the same concrete goal, scope, and constraints. Asking only for a plan remains read-only in either mode.

## What happens next

1. **Plan:** the agent inspects the project and defines the change and its checks. In Light, you approve it before implementation. Existing approval for the same plan and scope remains valid.
2. **Implement:** the agent makes the agreed changes and reports the checks and result.
3. **Review:** a fresh separate agent checks the work against the plan without changing it. The implementation stays unchanged while it is being reviewed.
4. **Correct if needed:** the executor addresses findings, then a fresh reviewer checks the result again. A correction can also collect missing proof without changing code.
5. **Finish:** you receive the outcome, evidence, remaining issues, and any acceptance still needed. Light waits for your acceptance after positive review.

For the CSV example, review might find that the export includes orders hidden by the filter. Correction addresses that finding; the next review checks the filtered export and the other agreed requirements. You do not need to request every internal step separately.

## When a run stops incomplete

The default limit is **three correction rounds after the initial implementation and review**. You can set another nonnegative whole-number limit, including zero. Every permitted correction receives a review. The sequence can stop earlier if a finding repeats without new evidence or an effective fix, a reviewer is unavailable, or an important decision or permission is missing.

This fictional report illustrates an incomplete result:

> CSV export is implemented, but completion is unconfirmed. Three correction rounds have been used. Review still found incorrect quoting when a value contains a line break. The report includes the failing input and output. A further correction round needs your instruction.

Reaching the limit does not turn an unresolved result into success. A failed reviewer is missing evidence, not approval. Host time, token, and cancellation limits also apply.

## Pause and resume

Ask to pause when you need to stop. The handoff retains the plan, current mode and work, findings, checks, used and remaining correction rounds, open lessons, and next action. Any unfinished external operation is reported with its actual known state.

Resume with a clear instruction and access to the earlier reports:

> Resume the CSV export task from this handoff. Keep the approved scope and remaining correction budget.

The agent compares the reports with the current repository before relying on earlier evidence. Resuming, renaming a task, or switching modes does not reset the correction budget. Missing history stays an explicit gap.

You may explicitly switch between Light and Dark for the remaining work. Scope, permissions, evidence, and consumed rounds carry over. Switching to Light requires your acceptance of the reviewed result; entering Dark requires a sufficiently clear assignment and an available reviewer. A question during Dark does not silently change its mode.

## Delivery and learning

The normal finish line is completed repository work. Commit, push, pull requests, merge, deployment, installation, production access, and publication need explicitly named actions and destinations. Light delivery waits for your result acceptance. Dark delivery additionally requires existing project checks that technically enforce the conditions for the exact version being delivered. See the [delivery rules](../skills/auto-work/references/delivery.md).

Useful lessons can be collected and offered during the sequence. Saving them still requires a separate learning request. Planning can also offer optional methods and verifier work. See [project improvement](project-improvement.md).

For executor details, see the [operating rules](../skills/auto-work/references/operation.md). To control each phase yourself, use the [manual guide](manual-workflow.md).
