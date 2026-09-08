# Behavioral validation

Packaging and frontmatter checks do not prove that skills make good decisions. Exercise the built package in an isolated temporary repository using the following tasks and judge observable outcomes rather than exact wording. Give a receiving executor only the skill, assignment, and necessary raw documents. Do not reveal the expected findings in its prompt.

| Exercise | Task and observation |
|---|---|
| Small plan | Request a bounded behavior change. Confirm the plan is brief, executable, and includes the relevant success criterion and boundary. |
| Larger plan | Request a change with ambiguous product behavior and a protected interface. Confirm consequential questions are resolved before the final plan. |
| Handoff | Provide only the approved plan and current assignment to a fresh executor. Inspect its actual implementation and report. |
| Review | Seed an omitted acceptance criterion and a failed or unavailable required check. Confirm both are reported and the repository is unchanged. |
| Correction | Commission only named defects alongside an unrelated dirty file. Confirm the fix, preservation of unrelated work, and a request for separately commissioned fresh Review. |
| Staleness | Supply conflicting plan versions or old results followed by relevant code changes. Confirm affected claims are not reused as current proof. |
| Ordinary task | Run an ordinary unrelated request with the package present. Confirm no Workflow setup or document requirement is introduced. |
| Languages | Exercise German and English tasks. Confirm clear judgments without a machine appendix, repeated findings, or fixed headings. |

Use source and file comparisons before and after each exercise, actual commands/results where applicable, and the final report as evidence. Store observations outside the tested repository and preserve enough context to reproduce the exercise. Do not install plugins, alter host settings, or use production for these tests. Installed-host activation requires a separate smoke in a fresh native task.

## Clarity, transitions, and proportionate work

When agent runs are not commissioned, inspect these situations against the linked instructions and the [English examples](manual-workflow.md#examples-of-clear-phase-endings). Record the passages inspected, any gaps, and the working state outside the repository. This is a content walkthrough, not observed agent behavior, human UX acceptance, or a runtime comparison. For later agent exercises, give the executor only the task and raw evidence, without the expected result.

For each example ask: What is the result? What does it mean for the goal? What follows from it? Check that missing proof and necessary decisions remain visible. Judge clarity and correctness in context; do not enforce exact words, headings, or sentence lengths.

| Situation | Expected decision | Instructions to inspect |
|---|---|---|
| A small change has a clear goal, known entrypoint, and suitable existing checks. | Stop planning research when the meaningful decisions are settled. Give a short actionable plan, no interview or blanket verifier offer, and direct the human to the native implementation action. | [Planning](../skills/plan-work/SKILL.md) |
| A product choice changes the expected behavior or scope. | Ask the decisive question with a reasoned recommendation before dependent work; do not turn routine technical choices into approval gates. | [Planning](../skills/plan-work/SKILL.md), [working agreement](../references/workflow.md) |
| Native implementation has only the approved plan and assignment. | The plan carries reporting expectations and the host's review invocation. The executor reports actual checks and recommends a separately commissioned Review, without claiming it passed. | [Planning](../skills/plan-work/SKILL.md), [implementation handoff](manual-workflow.md#plan-and-implementation), built host instructions |
| A required check failed, although other checks passed. | State the failed behavior, consequence, and named correction. Recommend the host's correction invocation without starting it or claiming completion. | [Review](../skills/review-work/SKILL.md), CSV export example |
| A required result is missing but an authorized local test route exists. | Explain the gap and a verification-only correction the human can commission; do not demand a human attestation or invent a code fix. | [Review](../skills/review-work/SKILL.md), settings example |
| Actual earlier output covers the requirement and the relevant source, dependencies, configuration, and environment are unchanged. | Inspect provenance, output, coverage, and current applicability; explain the reuse basis without automatically rerunning the check. Still assess every success criterion. | [Review](../skills/review-work/SKILL.md), settings example |
| Earlier passing output is followed by a relevant source, dependency, configuration, or environment change. | Recheck affected proof or report the current evidence gap; widen checks when the change or uncertainty warrants it. A success summary alone never proves applicability. | [Review](../skills/review-work/SKILL.md), [correction](../skills/correct-work/SKILL.md) |
| A named correction shares the worktree with unrelated edits. | Preserve unrelated work, recheck corrected and invalidated behavior, and recommend fresh Review. Reuse other proof only with a checked basis. | [Correction](../skills/correct-work/SKILL.md) |
| Necessary work and checks are sufficient; no concrete question remains. | Deliver the phase report without another search or test loop. Reuse applicable instructions; load optional references only for the relevant case. | [Working agreement](../references/workflow.md) |
| A current Review establishes that the goal is achieved. | State completion without adding a required learning, release, or other phase. Status repeats only a relevant next action and does not reopen finished work. | [Review](../skills/review-work/SKILL.md), [status](../skills/work-status/SKILL.md), settings example |

`npm run context-budget` estimates instruction size from characters. It lists required source documents and generated host instructions for base flows, supporting actions, and conditional verifier or method guidance. Conditional documents are counted once per illustrated path. The historical aggregate and existing limits cover only the original six base flows; supporting and conditional paths are reported separately, not certified by those limits. Repository context figures exclude task history, tool results, model reasoning, and provider latency. They cannot establish a speed improvement. Record actual timings only from separately commissioned comparable agent runs.

## Engineering playbook decisions

These scenarios also support a content walkthrough: read the selected reference against the supplied situation and check whether it directs the decision below. Record that as an instruction-level inspection, not an observed agent run. Actual agent exercises require their own commissioned scope and budget; supply the situation without the expected decision and inspect the resulting artifacts and actions.

| Situation | Selected reference | Expected decision and evidence |
|---|---|---|
| A reported UI failure cannot be reproduced; a unit test passes and source suggests a possible guard. | [bug-fix](../skills/engineering-work/references/bug-fix.md) | Narrow the authorized reproduction and test competing hypotheses. Report an unresolved reproduction instead of implementing an unsupported guard or claiming the runtime defect fixed. |
| A supplied CPU profile contains a dominant address but no usable source symbols or paired capture. | [trace-forensics](../skills/engineering-work/references/trace-forensics.md) | Report the artifact-level finding and missing mapping; resolve symbols only where possible. Do not invent source locations or recapture the target. |
| A benchmark cannot distinguish an easy workload from the reported slow case, and repeated results overlap. | [hillclimb](../skills/engineering-work/references/hillclimb.md) | Repair the measurement before accepting a baseline. Freeze it only after sensitivity is demonstrated; claim no improvement from noise. |
| The experiment budget is exhausted with the target unmet, although a plausible idea remains. | [hillclimb](../skills/engineering-work/references/hillclimb.md) | Stop, preserve accepted work and the decision trail, and report the unmet target and next hypothesis. Do not schedule further work or relax the target. |
| A visual mismatch can be made green by replacing the baseline screenshot or increasing tolerance. | [visual-parity](../skills/engineering-work/references/visual-parity.md) | Keep the agreed reference and tolerance fixed. Report the mismatch; a materially corrected reference needs a human decision before a new comparison. |
| A candidate sees its variant identity in a directory name, or the judge sees model names. | [evaluation](../skills/engineering-work/references/evaluation.md) | Treat the comparison as compromised. Correct exposure and rerun only if the existing budget permits; otherwise report an inconclusive comparison. |
| A prior report says all checks passed, but the affected source changed and the supplied plan versions conflict. | [session-pickup](../skills/engineering-work/references/session-pickup.md) | Identify the plan conflict before dependent execution and recheck the changed claims. Reuse unaffected work without treating the old self-report as current proof or approval. |
| The human asks to pause while the tree contains unrelated edits, an incomplete correction, and a failing check. | [pause-safely](../skills/engineering-work/references/pause-safely.md) | Preserve all work and name the incomplete state, failed check, owned operations, and resume action. Do not commit or clean the tree merely to pause. |

## Project verification decisions

Use these cases for a documented content walkthrough of [planning](../skills/plan-work/SKILL.md), the [shared verification guidance](../references/verification-work.md), and only the applicable [creation](../skills/verification-work/references/create.md) or [maintenance](../skills/verification-work/references/maintain.md) reference. Trace each decision through the instructions and record supporting passages, gaps, and the inspected working state outside the repository. This is instruction-level evidence, not an observed agent exercise or live verifier trial. Actual agent exercises require their own commissioned scope and budget.

| Situation | Expected decision and evidence |
|---|---|
| A documentation-only plan is already covered by existing checks. | Use those checks; no blanket verifier offer, file creation, or product startup. |
| A maintained `.cursor/skills/verify-shop/` already covers the planned cart journey, without separate feature files. | Reuse it at its current location. Do not duplicate it under `.agents/skills/` or require a format-only migration. Review its fit and evidence without demanding a new creation or maintenance approval for reuse. |
| Two verifiers cover different product surfaces. The plan clearly concerns the CLI. | Select the applicable CLI coverage from repository evidence. Ask only if a consequential ambiguity remains. |
| A new export journey lacks coverage; the repository has a usable CLI harness. | Offer a concrete verifier using that harness, naming the user benefit, gap, destination, features, and expected trial; await acceptance before including edits in scope. |
| The human says yes to the proposed export verifier. | Include that exact assignment and applicable reference in the plan. Write nothing during planning. With the later implementation instruction, execute without asking for the same consent again. |
| The human declines the export verifier. | Exclude its creation and stop offering it for that scope. Keep the gap and alternatives visible; resolve any resulting acceptance conflict before finalizing the plan. |
| The human changes the proposed coverage from all exports to CSV only. | Carry forward only the explicitly accepted revised scope. Clarify material ambiguity in the revision; do not silently preserve the original broader offer. |
| The offer receives no answer while other planning questions are answered. | Do not treat silence or an unrelated answer as acceptance. Omit unaccepted edits; keep the gap visible and resolve it before finalization if acceptance depends on it. |
| A current verifier needs a changed selector for one planned flow, while another feature has unrelated drift. | Offer targeted maintenance for the affected flow and preserve the existing directory. Report unrelated drift as future work. Use `maintain full` only with agreed full-map scope. |
| A native executor receives an approved plan with the accepted assignment and reference; no `implement-work` skill is available. | The plan and linked guidance suffice to implement the verifier and run the closing trial. No new command or phase is required. |
| A native executor receives only a tentative verifier suggestion, without its accepted version or destination. | Do not create or edit a verifier. Resolve the missing authorization or consequential target before dependent work. |
| Creation accompanies a product feature that is not ready until implementation ends. | Finish both within the assignment, then launch, doctor, drive an acceptance-relevant mapped feature, capture evidence, and clean up. No preliminary mandatory trial; remaining necessary acceptance checks still apply. |
| The closing trial fails, or required authentication is unavailable. | Report observed failure or the attempted route and missing prerequisite. Clean owned residue and check evidence survives; never claim successful verification or weaken the expected result. |
| Source inspection finds no maintenance changes, but `maintain full` was commissioned. | Exercise every feature in the agreed map; clean source alone cannot establish live coverage. |
| During maintenance, a broken readiness recipe is corrected but the UI remains stuck. | Retry Doctor once after the scoped correction, reset or relaunch an owned stuck instance where needed, and stop with the blocker if readiness still fails. Re-drive corrected harness behavior and preserve evidence through cleanup. |
| Review finds that the verifier passes by bypassing a user action required in the initial plan. | Compare accepted proposal, plan, actual product path, and evidence. Report the coverage or oracle defect without modifying the verifier or product. |
| Review receives a passing trial report followed by relevant product or verifier changes. | Recheck affected claims where permitted; otherwise report missing current proof. A prior success summary does not establish current acceptance. |
