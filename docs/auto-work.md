# Let Auto-Work run the sequence

Auto-Work connects planning, implementation, independent review, and correction in one request. You define the task and how much to delegate. It reports what was achieved, what was checked, and what remains open.

Auto-Work coordinates in the host and chat where you invoke it. Your environment must support native phase agents and a fresh separate agent for every review. You can still use the [manual workflow](manual-workflow.md) when required delegation is unavailable.

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

Before phases start, Auto-Work asks you to select agents for **Plan, Implement, Review and Correct**, including the models and supported reasoning or other settings. This also applies to Dark. It inspects the active host's capabilities and proposes a complete assignment suited to the task. You can accept it, change individual roles or choose one model for all. A complete selection supplied in your initial request needs no second confirmation.

If the host cannot expose its available models or agents, Auto-Work says what is unknown and asks you for concrete IDs/settings or existing native agent definitions. It validates each launch against the actual delegation interface. Naming a model in a prompt alone cannot select it. Unsupported settings or a known model substitution pause dependent work. An accepted invocation can proceed when the host provides no execution metadata; the report then marks the actual settings unconfirmed.

Before each outcome report, the coordinator checks each phase against its own raw records and presents future role assignments separately from history. Missing historical selections, submissions and identities remain unknown; today's choices cannot fill those gaps. Execution defaults to unconfirmed. Confirmation needs a referenced host record reporting the effective execution model/settings; accepted calls, child IDs and self-reports alone do not suffice. Phase judgments stay separate.

The coordinator retains one immutable `BEGIN PLAN AND BOUNDARIES` block in the native task: plan/reference, verbatim criteria with time/scope, read/write boundaries, cwd and exclusions. Every child receives its complete unchanged text or an exact accessible first-read reference. The [dispatch template](../skills/auto-work/references/handoff.md) also supplies the phase-only role, absolute mandatory rule paths and first native read arguments with explicit cwd. The actual plaintext dispatch is retained before invocation. Correct and final Review reuse this template; findings and progress never replace the original boundaries. Missing fields return to the coordinator for repair without resetting spent rounds.

Before repository access, each child fully reads the fixed entry, handoff, agreement, host and phase rules, plus applicable conditional rules. Review also reads the reviewer reference. The coordinator compares original raw outputs and boundary bytes before each transition; invalid or missing proof prevents acceptance or completion. Exact paths and cwd apply from the first call. Installed skill aliases, summaries and opaque prompt decoding cannot replace the supplied rules or their original outputs. Forbidden Git includes status/diff.

Retained reports and baselines are read at their allowed original paths. New rule/check outputs use only assigned destinations. Existing safe check bodies are reused without an additional shell-escaping layer; the original expected/received values and exit status remain part of the proof.

The first-read arguments cover both the native read budget and any outer tool response budget. Recover truncated child outputs before project access. The coordinator checks the original visible outputs and recovery calls; byte-equal retained rule files alone do not prove that the child received the complete rules.

The first tool reads only the exact assignment and fixed package rules. Read project `AGENTS.md` after complete rule outputs and input validation; including it at the end of a combined first read cannot establish this order when the response is truncated.

Before delegation, the coordinator resolves preservation periods. For a new or resumed assignment, it collects genuine pre-edit contents/digests within allowed sources and carries the actual read evidence through the phases. That proves only the recorded period. A requirement extending to an earlier implementation still needs earlier evidence; later snapshots, timestamps or assertions cannot reconstruct it. Evidence collectable under the assignment is collected by the executor, without asking for human attestation or access to excluded observer files.

1. **Plan:** the agent inspects the project and defines the change and its checks. In Light, you approve it before implementation. Existing approval for the same plan and scope remains valid. If another task is already changing this repository, or your checkout has unrelated edits, planning uses the same warn-and-choose check as [manual planning](manual-workflow.md#when-another-task-already-uses-this-repository): continue carefully, wait, or isolate on a branch and worktree. The plan records the choice. Review reads that checkout and does not merge it.
2. **Implement:** the agent makes the agreed changes and reports the checks and result.
3. **Review:** a fresh separate agent checks the work against the plan without changing it. The implementation stays unchanged while it is being reviewed.
4. **Correct if needed:** the executor addresses findings, then a fresh reviewer checks the result again. A correction can also collect missing proof without changing code.
5. **Finish:** you receive the outcome, evidence, remaining issues, and any acceptance still needed. Light waits for your acceptance after positive review.

For the CSV example, review might find that the export includes orders hidden by the filter. Correction addresses that finding; the next review checks the filtered export and the other agreed requirements. You do not need to request every internal step separately.

The main agent coordinates; selected native agents perform the phases and return their reports. Every re-review uses a fresh instance with the Review selection. Auto-Work creates no project or global agent configuration and does not switch to a different harness to satisfy a model choice. See [agent selection](../skills/auto-work/references/agents.md) for executor details.

## When a run stops incomplete

The default limit is **three correction rounds after the initial implementation and review**. You can set another nonnegative whole-number limit, including zero. Every permitted correction receives a review. The sequence can stop earlier if a finding repeats without new evidence or an effective fix, a reviewer is unavailable, or an important decision or permission is missing.

This fictional report illustrates an incomplete result:

> CSV export is implemented, but completion is unconfirmed. Three correction rounds have been used. Review still found incorrect quoting when a value contains a line break. The report includes the failing input and output. A further correction round needs your instruction.

Reaching the limit does not turn an unresolved result into success. A failed reviewer is missing evidence, not approval. Host time, token, and cancellation limits also apply.

## Pause and resume

Ask to pause when you need to stop. The handoff retains the plan, mode, work, selected agents/models/settings and invocation evidence, findings, checks, spent/remaining rounds, open lessons and next action. Unfinished external operations retain their actual known state.

Resume with a clear instruction and access to the earlier reports:

> Resume the CSV export task from this handoff. Keep the approved scope and remaining correction budget.

The agent compares reports and available capabilities with current state. Resuming, renaming or switching modes does not reset the correction budget or agent selection. An explicit selection change applies to upcoming phases. Missing history stays an explicit gap.

You may explicitly switch between Light and Dark for the remaining work. Scope, permissions, evidence, and consumed rounds carry over. Switching to Light requires your acceptance of the reviewed result; entering Dark requires a sufficiently clear assignment and an available reviewer. A question during Dark does not silently change its mode.

## Delivery and learning

The normal finish line is completed repository work. Commit, push, pull requests, merge, deployment, installation, production access, and publication need explicitly named actions and destinations. Light delivery waits for your result acceptance. Dark delivery additionally requires existing project checks that technically enforce the conditions for the exact version being delivered. See the [delivery rules](../skills/auto-work/references/delivery.md).

Useful lessons can be collected and offered during the sequence. Saving them still requires a separate learning request. Planning can also offer optional methods and verifier work. See [project improvement](project-improvement.md).

For executor details, see the [operating rules](../skills/auto-work/references/operation.md). To control each phase yourself, use the [manual guide](manual-workflow.md).
