# Behavioral validation

This guide is for contributors checking how Workflow skills behave after a change. For everyday use, start with the [working guide](manual-workflow.md). Each scenario below describes a task to try and the outcome to inspect; it is not a record of a completed test.

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

## Project readiness and setup

Use the repository-only `verify-project-setup` verifier under `.agents/skills/` for commissioned native trials. Its recipes cover setup, maintenance, offers, and verifier cooperation with isolated fixtures and retained raw evidence. It is not shipped with the plugin.

| Situation | Observable outcome |
|---|---|
| A correct CLI has requirements but no check route. | Commissioned setup adds useful checks and discoverable guidance; the closing run exercises them. |
| A project already has suitable checks. | Inspection preserves files; repeated maintenance adds nothing merely to match a format. |
| Documentation points at a removed command while the product works. | Commissioned maintenance repairs the route and proves it runs. |
| A current check detects a real product regression. | Report the regression and preserve the oracle; do not repair the product without a matching assignment. |
| Planning finds a relevant gap, followed by a decline or an unanswered offer carried into the next phase. | One concrete offer with an explicit decline; no repeated offer or unauthorized setup edits for unchanged scope. |
| An accepted setup plan includes a named verifier and closing trial. | Apply verification-work without another consent request, reuse existing coverage, and retain actual trial evidence. |
| Access is missing, a necessary check fails, or Review finds stale setup. | Keep the gap visible; Review does not repair files or claim successful verification. |
| The user asks for status, explanation, a plugin update, or a single verifier update. | Preserve the narrow request and choose the appropriate existing skill. |

These scenarios are acceptance expectations, not a record of successful native runs. All host packages receive structural checks; the verifier records exercised hosts and unavailable runtime proof separately.

## Release installation decisions

Walk through these situations against [install-release](../skills/install-release/SKILL.md) and the [installation guide](installation.md), including the generated host packages. Record inspected passages and results outside the repository. These are instruction-level checks, not observed installations. Do not install into real user profiles or change host settings during a walkthrough. Existing isolated packaging/release tests establish archive contents and reproducibility, not execution of this skill.

| Situation | Expected decision and evidence |
|---|---|
| A colleague has Cursor or Codex but no Workflow, checkout, Node.js, npm, or GitHub CLI. | The bootstrap reads the skill and its links from the selected published tag. Available native download, JSON, hashing, and archive tools suffice; no checkout or tool installation is required. An unpublished skill is reported as unavailable. |
| Both hosts have directories, but explicit harness context identifies only one; another request has no trustworthy host context. | Select only the current host in the first case. Ask for the target in the second; do not infer the harness from directories or install both. An unsupported harness must select an explicitly supported target before installation. |
| A new release is published between asset downloads. | Continue with the initially resolved concrete tag and its asset URLs for every download and instruction read. Never mix independently resolved latest assets. |
| An unmodified older Codex release and a personal Marketplace with unrelated plugins exist. | Verify the older package against its exact release baseline, prepare the new source and only the Workflow entry, preserve catalog identity and unrelated items, retain a complete backup, and read back the result. Malformed or duplicate entries block changes. |
| The source is already byte-identical to the selected release but Codex's cache is missing or stale. | Skip source replacement and a redundant backup, but inspect registration and require supported host installation/refresh and cache comparison. Do not report active or repair the cache manually. |
| The selected archive is for the other host, its manifest/version is wrong, or its provenance names another repository. | Stop before replacing files; a valid checksum alone does not establish the requested identity. |
| A checksum is wrong, missing, or duplicated, or GitHub/network access fails. | Leave the destination unchanged and name the failed check or missing prerequisite. Do not use another release, a development checkout, or skip verification. |
| A ZIP contains traversal paths, links, colliding names, or metadata the available tool cannot inspect; a destination ancestor is redirected. | Reject extraction or replacement at the applicable preflight. Check Windows path rules as well as POSIX paths. |
| A local/development version, newer version, changed file, extra file, or unavailable old comparison baseline is found. | Preserve the existing installation and ask about the concrete difference. A matching manifest version is insufficient proof of unchanged contents. |
| The user requests installation but the host denies destination writes; another user only asks how installation works. | Report the concrete permission blocker without changing host permissions in the first case. Explain without mutation in the second. Do not ask again for installation consent already given. |
| Directory replacement succeeds but Marketplace writing or read-back fails. | Restore the previous source and affected catalog state using the retained backup, preserving concurrent changes. If recovery fails, name the remaining paths and recovery action; never claim successful installation. |
| The verified source is ready but Cursor has not reloaded or Codex still needs restart and Plugins Directory interaction. | Report the completed file work and exact pending activation steps. Keep the backup; do not restart the active host or infer activation from files, a version string, or the running task. |

## Skill selection

Use the [selection guidance](manual-workflow.md#choosing-a-skill) and built skill descriptions for this walkthrough. Each positive request assumes the necessary plan, assignment, reports, and repository evidence are supplied. Missing context must stay visible; selecting a skill does not invent approval. Check these distinctions in both host packages, including the Cursor command aliases. The portable package also includes `implement-work`.

| Skill | Matching request | Boundary or likely misroute |
|---|---|---|
| `plan-work` | "Create an implementation plan for the CSV export." | "Implement this approved plan" does not start a separate planning phase. |
| `review-work` | "Review the implementation against the approved plan." | "Explain this existing review finding" requests explanation, not a fresh judgment. A generic code review without a Workflow plan is not this skill. |
| `correct-work` | "Fix the missing escaping identified in this review." | An unrelated bug report is not a commissioned review correction. |
| `auto-work` | "Use Light Auto-Work to plan, implement, independently review, and correct this change." | Ordinary implementation or bug-fix requests do not commission the sequence. |
| `engineering-work` | "Recommend a suitable engineering playbook for this task." | A recommendation does not select a playbook; a method keyword in code is not a request to apply it. |
| `setup-workflow` | "Plan the project direction, checks and agent guidance we need." | Project setup, not plugin installation; suitable existing coverage is reused. |
| `maintain-workflow` | "Inspect our existing project checks and update them against the approved plan." | Inspection alone stays read-only; a plugin version update uses install-release; a single verifier recipe uses verification-work. |
| `workflow-doctor` | "Do our existing checks cover this change?" | Assess readiness without running the product or editing verifier instructions. |
| `verification-work` | "Update the instructions for our export verifier." | Routine test execution needs no verifier-management skill; task-level coverage questions use Doctor. |
| `explain-work` | "Explain why this review finding matters." | General code explanations need no Workflow phase; progress summaries use Status. |
| `work-status` | "What is complete and what remains in this task?" | Summarize available reports without a fresh Review or restarting an active Auto-Work assignment. |
| `learn-from-work` | "Save these review-confirmed lessons in the project guidance." | Noticing a lesson, offering learning, or requesting a lesson summary does not authorize saving. |
| `install-release` | "Update Workflow to its latest stable release for Cursor." | Publishing a release, deploying a development checkout, or updating another product is outside this skill. |
| `implement-work` (portable only) | "Implement this approved plan." | Codex and Cursor use native implementation; do not route to an unavailable skill or infer Auto-Work. |

For commissioned native selection trials, use a fresh isolated workspace and session per request. Load the built Cursor package with the local CLI's supported `--plugin-dir`; stage the built Codex skills and their relative references under the fixture's `.agents` directory. Keep the observer's expected answers and this table outside the subject workspace. Do not explicitly invoke or name the expected skill in the subject prompt. Supply realistic raw task context and inspect actual skill reads and first actions, not just a final claim about which skill was used.

Run the readiness, verifier-update, review, explanation, status, and approved-implementation cases in both hosts. Keep work bounded to owned fixture files, use the host's read restrictions for read-only cases, and retain raw events, final messages, and before/after file evidence outside the repository. Record host versions, the candidate package digest, visible skill inventory when available, and any competing installed skills or instructions that limit attribution. Clean only owned fixture workspaces after preserving evidence.

Report each outcome as observed selection, observed misroute, or unavailable evidence. Staging Codex skills proves the exercised local skill-discovery path, not installed-plugin activation. A Cursor CLI trial does not establish IDE behavior. Missing access, a timeout, or a failed necessary action remains an open acceptance item. Neither this walkthrough nor the instruction-size estimate establishes statistically reliable selection rates or runtime savings.

## Clarity, transitions, and proportionate work

When agent runs are not commissioned, inspect these situations against the linked instructions and the [English examples](manual-workflow.md#examples-of-clear-phase-endings). Record the passages inspected, any gaps, and the working state outside the repository. This is a content walkthrough, not observed agent behavior, human UX acceptance, or a runtime comparison. For later agent exercises, give the executor only the task and raw evidence, without the expected result.

For each example ask: What is the result? What does it mean for the goal? What follows from it? Check that missing proof and necessary decisions remain visible. Judge clarity and correctness in context; do not enforce exact words, headings, or sentence lengths.

| Situation | Expected decision | Instructions to inspect |
|---|---|---|
| A small change has a clear goal, known entrypoint, and suitable existing checks. | Stop planning research when the meaningful decisions are settled. Give a short actionable plan, no interview or blanket verifier offer, and direct the human to the native implementation action. Omit the second-order note. Do not load the playbook catalog unless the user asks about methods or a concrete methodological choice would materially help. | [Planning](../skills/plan-work/SKILL.md) |
| The assignment is vague or underspecified: the goal, boundaries, interfaces, success checks, or a material trade-off that would change the plan is missing. | An optional short decision round may ask only what blocks a sound plan, with a concrete recommendation the user can accept or steer, in a few focused questions. Do not add a separate skill for that round, require a glossary, expand a design tree, or turn planning or Auto-Work into an interview gate. | [Planning](../skills/plan-work/SKILL.md) |
| A material change affects architecture, a breaking contract, several surfaces, or schema and deploy. | Note second-order effects in one line each where relevant: caller impact, data or migration, deploy and rollback, and security or auth. Mark speculation as speculation. | [Planning](../skills/plan-work/SKILL.md) |
| A product choice changes the expected behavior or scope. | Ask the decisive question with a reasoned recommendation before dependent work; do not turn routine technical choices into approval gates. | [Planning](../skills/plan-work/SKILL.md), [working agreement](../references/workflow.md) |
| Native implementation has only the approved plan and assignment. | The plan carries reporting expectations and the host's review invocation. The executor reports actual checks and recommends a separately commissioned Review, without claiming it passed. | [Planning](../skills/plan-work/SKILL.md), [implementation handoff](manual-workflow.md#plan-and-implementation), built host instructions |
| Planning is asked to address a repeated correction, and both a structural change and a CI check could work. | Apply the learning guidance to choose the smallest sufficiently effective measure proportionate to the assignment. Prefer structural prevention among comparably proportionate options. Ask before a consequential design change; technical feasibility alone does not justify widening the plan. | [Planning](../skills/plan-work/SKILL.md), [learning guidance](../references/learning-work.md) |
| A required check failed, although other checks passed. | State the failed behavior, consequence, and named correction. Recommend the host's correction invocation without starting it or claiming completion. | [Review](../skills/review-work/SKILL.md), CSV export example |
| The change matches the plan but breaks a repository convention, or it follows local conventions while missing specified behavior. | Report the axes separately: deviation from the plan or spec, and violation of repository standards or simplicity. A pass on one axis leaves the other intact. When simplicity is in question and the Efficiency plugin is already available, apply its design and code simplicity guidance in this same review. | [Review](../skills/review-work/SKILL.md) |
| A required result is missing but an authorized local test route exists. | Explain the gap and a verification-only correction the human can commission; do not demand a human attestation or invent a code fix. | [Review](../skills/review-work/SKILL.md), settings example |
| Actual earlier output covers the requirement and the relevant source, dependencies, configuration, and environment are unchanged. | Inspect provenance, output, coverage, and current applicability; explain the reuse basis without automatically rerunning the check. Still assess every success criterion. | [Review](../skills/review-work/SKILL.md), settings example |
| Earlier passing output is followed by a relevant source, dependency, configuration, or environment change. | Recheck affected proof or report the current evidence gap; widen checks when the change or uncertainty warrants it. A success summary alone never proves applicability. | [Review](../skills/review-work/SKILL.md), [correction](../skills/correct-work/SKILL.md) |
| A named correction shares the worktree with unrelated edits. | Preserve unrelated work, recheck corrected and invalidated behavior, and recommend fresh Review. Reuse other proof only with a checked basis. | [Correction](../skills/correct-work/SKILL.md) |
| Necessary work and checks are sufficient; no concrete question remains. | Deliver the phase report without another search or test loop. Reuse applicable instructions; load optional references only for the relevant case. | [Working agreement](../references/workflow.md) |
| A current Review establishes that the goal is achieved. | State completion without adding a required learning, release, or other phase. Status repeats only a relevant next action and does not reopen finished work. | [Review](../skills/review-work/SKILL.md), [status](../skills/work-status/SKILL.md), settings example |

## Concurrent checkouts

Walk through these cases against [planning](../skills/plan-work/SKILL.md), [concurrent work](../references/concurrent-work.md), [implementation requirements](../references/implementation-work.md), [review](../skills/review-work/SKILL.md), and [correction](../skills/correct-work/SKILL.md). Record the passages inspected and the working state outside the repository. This is an instruction-level check, not an observed agent run.

| Situation | Expected decision | Instructions to inspect |
|---|---|---|
| The checkout is clean and no other plan, implementation, or documented unfinished task names this repository. Another worktree has commits on its own branch and no uncommitted changes, and no handoff or host task names that checkout. | Plan in place. Ask no checkout question and create no worktree. Commits that only exist on that branch are not overlap. | [Planning](../skills/plan-work/SKILL.md), [concurrent work](../references/concurrent-work.md) |
| Another git worktree is implementing on this repository, or this checkout is dirty with edits this task must leave untouched, and a fresh reviewer can use the intended worktree as its workspace. | Warn, and offer continue carefully, wait, or isolate. The first matching rule recommends isolate. Planning records the choice and does not create the worktree. Continuing in place stays available. | [Planning](../skills/plan-work/SKILL.md), [concurrent work](../references/concurrent-work.md) |
| Isolate would fit, but this host cannot start a child agent with a workspace outside the current checkout, or that ability is unclear. | Recommend continue carefully. Say that independent review would be unable to read the isolated checkout. Do not assume a sibling directory is visible. Still offer wait. | [Concurrent work](../references/concurrent-work.md), [Auto-Work reviewer](../skills/auto-work/references/reviewer.md) |
| The human chooses to continue in the dirty checkout. | Record continue. Later edits preserve the unrelated files. Do not treat the warning as a lock. | [Concurrent work](../references/concurrent-work.md), [correction](../skills/correct-work/SKILL.md) |
| The other workstream is mid-edit on the same files this task must change. | The first rule recommends wait, ahead of isolate. The plan may finish. Hold product edits until that blocker clears. | [Concurrent work](../references/concurrent-work.md) |
| Dark Auto-Work has a clear overlap, a readable review workspace, and the commissioned goal did not pick a checkout. | Record isolate in the plan. Create the worktree only as the first implementation step, for the named branch and path. Pause and do not create it when the other owner or the overlapping files are unclear. Commit, push, and merge stay unauthorized. | [Concurrent work](../references/concurrent-work.md), [Auto-Work operation](../skills/auto-work/references/operation.md) |
| Implementation is cold-started from a plan that already says isolate, with a base, branch, and path. One plan says the other owner and the overlapping files are clear. Another omits that field. | Create the worktree only for the plan that says they are clear, then edit only there. When the field is missing or unclear, pause and leave the worktree uncreated. Do not repeat the choice interview. Commit, push, and merge stay unauthorized. | [Implementation requirements](../references/implementation-work.md), [concurrent work](../references/concurrent-work.md) |
| Review is opened from the primary checkout while the change exists only in the recorded worktree. | Start the reviewer with that worktree as its workspace. Review that branch, read-only. A primary checkout without the change is the wrong tree. When the path cannot be read, missing access is missing proof. | [Review](../skills/review-work/SKILL.md), [concurrent work](../references/concurrent-work.md), [Auto-Work reviewer](../skills/auto-work/references/reviewer.md) |
| Correction findings apply to isolated work, and the primary checkout has unrelated edits. | Patch the recorded worktree. Leave the primary checkout untouched. Folding the branch back is a later explicit reconcile, not part of correction. | [Correction](../skills/correct-work/SKILL.md), [concurrent work](../references/concurrent-work.md) |
| The human asks to merge the isolated branch and remove its worktree. The destination checkout is clean. | Merge into the named destination, recheck there, then remove only the worktree this assignment added. Delete the branch only if they also asked and it is merged. | [Concurrent work](../references/concurrent-work.md) |
| The human asks to merge, and the destination checkout is dirty with unrelated edits. | Stop and show that dirt. Do not stash, commit, or merge over it. | [Concurrent work](../references/concurrent-work.md) |
| The human discards the isolated attempt. The worktree still has uncommitted files. | Do not merge. Show that work. Remove the worktree only after they confirm the discard. Leave worktrees this assignment did not create. | [Concurrent work](../references/concurrent-work.md) |
| Learning or a verifier run happens while the accepted product change still lives only in the worktree. | Edit project guidance and drive the product there. A git worktree does not replace test-data or process isolation. A repeated collision prefers a check or this procedure over a copied project rule. | [Learning](../skills/learn-from-work/SKILL.md), [verification](../skills/verification-work/SKILL.md), [concurrent work](../references/concurrent-work.md) |

## Context budgets

`npm run context-budget` estimates instruction size from the built host packages. Its flat scenarios cover required planning references, individual phases, selected playbooks, learning, verifier inspection/creation/maintenance, and Auto-Work including delivery. Overlap and isolated-checkout upper bounds (`planConcurrent`, `reviewConcurrent`, `correctionConcurrent`, `autoWorkConcurrent`, `learningConcurrent`, `verificationConcurrent`, and portable `implementationConcurrent`) add the concurrent-work reference only for that case. Default phase scenarios omit it. Shared documents count once per scenario. Discovery counts the advertised names and descriptions, including Cursor command aliases. These are aggregate scenario budgets, not individual skill length limits.

Every scenario has a fixed hard limit; excess size, missing limits, and obsolete limits fail validation. Initial limits used the largest host value plus 10%, rounded up to 100 estimated tokens. Original baselines and explicit revisions remain recorded in the repository's `scripts/context-limits.json`. Normal checks never update limits.

For a commissioned feature extension or necessary clarification, inspect the affected content, duplication, and unnecessary reference loading first. Preserve selection criteria, responsibility boundaries, and necessary instructions; do not remove them solely to meet a historical number. When that useful content needs more room, update only the affected limits using the largest current host measurement plus 10%, rounded up to 100. Record the reason, date, measured maxima, and old/new limits, and compare document inventories and measurements before and after. Keep sufficiently sized limits unchanged. A revision's one-time selection criterion is not an automatic growth rule or an additional approval step.

The default output is a compact table; `npm run context-budget -- --json` includes full document inventories. Light and Dark share instruction content and one size scenario. These character-based estimates exclude repeated agent contexts, task history, tool results, model reasoning, and provider latency; they are not measured model capacity or evidence of speed or observed agent behavior.

## Learning through repeated Reviews

Use these scenarios for an instruction-level walkthrough of the [working agreement](../references/workflow.md), [learning guidance](../references/learning-work.md), relevant phase skills, and the [export example](manual-workflow.md#keep-export-lessons-through-correction-rounds). Record inspected passages, working state, conclusions, and gaps outside the repository. Package tests validate the available host commands and instruction inventory; they do not establish candidate retention or sound reconciliation by an agent. Actual agent exercises remain separate from this walkthrough.

| Situation | Expected decision and evidence |
|---|---|
| Review confirms two candidates; the human commissions only correction. A second Review adds another candidate. | The first Review offers both lessons. The correction does not restate that offer. The second Review offers the new lesson and references the unchanged ones, including the full collection when the receiver cannot access that reference. Learning is not silently commissioned. |
| Native implementation has no implement-work skill; a later executor receives only the latest complete handoff and referenced evidence. | The plan conveys capture and retention instructions. When the recipient cannot open an earlier reference, the handoff includes every open candidate's content, benefit, basis, scope, proposed change, and destination. |
| A correction replaces the command underlying an early lesson; two later candidates duplicate a different lesson. | Recheck evidence, replace the outdated recipe with a reason and successor, and merge duplicates without losing their valid scope or basis. A final learning assignment can integrate every surviving lesson once. |
| Two recipes differ because one concerns the CLI and one the service, while a newer unsupported statement contradicts the CLI recipe. | Distinguish conditions and scopes. Do not choose a winner by date; leave the unsupported contradiction unresolved rather than saving incompatible rules. |
| Two proposed rules conflict on the same behavior and require a product decision; a third has independent current proof. | Withhold the conflicting changes, ask about the consequential choice, and allow the independent authorized guidance update. Report both remaining candidates and the conflict. |
| A lesson was already saved after an early Review, but a later correction invalidates its assumptions. | Keep its destination and basis traceable. Offer a bounded revision or removal through learning; do not silently edit guidance during correction or keep presenting the old lesson as valid. |
| The first guidance update succeeds but a second write fails; the human repeats learning, or the previous report was interrupted. | Read actual saved guidance, avoid duplicates, and integrate only verified saved changes. Report partial results and carry unfinished candidates forward with their causes. |
| A handoff says "see earlier learnings" but the earlier report is inaccessible. | Name the missing history; do not claim a complete collection or invent lessons. Continue independent work and resolve the gap before affected learning. |
| Review needs product corrections but independently confirms a reusable diagnostic lesson; another Review finds no eligible lessons. | Offer the confirmed lesson while keeping required corrections prominent in the first case. Omit the offer in the second. Neither case changes the Review judgment or creates a completion gate. |
| A candidate needs a verifier script change, another changes bounded project guidance, and an instruction asks for personal memory without a human request. | Route the script change as a concrete future assignment and preserve it as pending; integrate only authorized guidance. Do not edit personal memory without its explicit human request. |
| Status or explanation is requested after several offers; a new plan later encounters saved guidance that no longer matches the repository. | Describe the documented collection without new offers in status/explanation. Planning checks applicable saved lessons against current work rather than treating them as unconditional rules. |
| A first review finding has a cheap, representative regression test, lint, or structural fix within the assignment. | Include the proportionate prevention in the named correction. A first finding does not automatically widen the assignment or turn an isolated observation into a permanent rule. |
| A correction recurs, and a small in-scope structural change can prevent the class. | Prefer that change over comparably proportionate detection or guidance. Record the measure and its basis. |
| A redesign is technically feasible but costly, while a small CI check sufficiently detects the recurring failure. | Choose the CI check and explain why it is proportionate. Do not select the redesign merely because it is feasible. |
| Existing guidance already addresses a recurring mistake, and an affordable CI check can detect it. | Recommend the check instead of adding the same guidance again. Keep implementation pending if the check falls outside the commissioned scope. |
| The selected preventive repair is outside the current assignment. | Preserve it as a concrete future assignment with evidence, benefit, destination, expected outcome, and checks. Learning does not implement product, tool, or verifier repairs. |
| Technical prevention is disproportionate, but Review confirms a useful bounded project instruction and learning is commissioned. | Save the supported guidance under the learning rules. A merely feasible technical alternative does not block an appropriate guidance update. |
| The session or its log shows a long search for an existing file, repeated expensive tool calls, or a steering instruction that changed nothing. | Record an environment lesson. Prefer a navigation pointer, a cheaper tool path, or removal of the dead instruction, using the existing prevention order. A one-off observation stays a candidate, not a permanent rule. |
| A repeated mistake is a fixed pattern a check can catch. Another is a judgment about consistency that no check can replace. | Turn the mechanical lesson into a check. Turn the judgment lesson into a standard the reviewer applies, and leave that standard out of implementation context. A dedicated standards file stays optional. |

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

## Optional planning offers

Walk through these cases against [planning](../skills/plan-work/SKILL.md), the [engineering skill](../skills/engineering-work/SKILL.md), its [catalog](../skills/engineering-work/references/catalog.md), and the [verification guidance](../references/verification-work.md). Record the supporting passages and inspected working state outside the repository. These are instruction-level checks, not observed agent runs; they do not establish that a live host always asks correctly.

| Situation | Expected decision and evidence |
|---|---|
| Existing checks cover a small task and no playbook would materially help. | Make neither optional offer and finish the plan with appropriate ordinary checks. |
| Exactly one playbook fits the task. | Explain its benefit, mark it as recommended, and offer an explicit refusal. Do not invent a second method. |
| A performance task could reasonably use either a one-off correction or an iterative hillclimb. | Explain both useful alternatives and their different deliverables; recommend exactly one based on scope and budget. Include a decline-all option. Do not load full methods or apply the recommendation before selection. |
| A verifier gap can reasonably be addressed by targeted maintenance or a distinct new surface verifier. | Present concrete alternatives with benefit, destination, features, change scope, and trial. Recommend exactly one and offer refusal; do not turn alternatives into a combined editing assignment. |
| Only one verifier change is worthwhile and the user speaks German. | Present the concrete proposal with "Empfohlen", "Nein, nicht machen", and the ability to revise it. |
| Both a playbook and verifier maintenance help; the human accepts only the playbook. | Include only that method; do not infer approval for verifier changes. Keep the unresolved verification gap and limits visible without blocking plan completion. |
| Both offers help; the human accepts only verifier maintenance. | Include only the agreed maintenance. The recommended playbook remains unselected. |
| The human declines the playbooks, declines verifier edits, or leaves an offer unanswered. | Exclude unselected additions and finish planning without repeat offers for that scope. Preserve applicable approval already given; recommendation or a preselected UI default alone is not acceptance. |
| The human revises a suggested full verifier pass to a targeted CSV update. | Carry only the actively accepted revision into the plan and handoff. Do not retain the wider proposal or take the revision as consent to a separate playbook. |
| A prior explicit `engineering-work use <playbook-id>` already selects a suitable method. | Preserve the choice and load its reference without another offer or approval request. |
| A maintained existing verifier fits the planned user path. | Reuse it directly without a separate offer, consent question, or justification; normal check planning and reports may name it. |
| A verifier is stale, but the human declines the offered update. | Do not edit it or treat stale guidance as current proof. State the remaining gap, alternatives, and acceptance limits; the optional update is not a planning gate. |
| Review receives a plan naming one selected method but a report applying an unselected alternative or unaccepted verifier changes. | Compare execution with the explicit selections and report the discrepancy; Review makes no corrections. |

## Project verification decisions

Use these cases for a documented content walkthrough of [planning](../skills/plan-work/SKILL.md), the [shared verification guidance](../references/verification-work.md), and only the applicable [creation](../skills/verification-work/references/create.md) or [maintenance](../skills/verification-work/references/maintain.md) reference. Trace each decision through the instructions and record supporting passages, gaps, and the inspected working state outside the repository. This is instruction-level evidence, not an observed agent exercise or live verifier trial. Actual agent exercises require their own commissioned scope and budget.

| Situation | Expected decision and evidence |
|---|---|
| A documentation-only plan is already covered by existing checks. | Use those checks; no blanket verifier offer, file creation, or product startup. |
| A maintained `.cursor/skills/verify-shop/` already covers the planned cart journey, without separate feature files. | Reuse it at its current location without a separate offer, consent question, or justification. Do not duplicate it under `.agents/skills/` or require a format-only migration. Review its fit and evidence without demanding a new creation or maintenance approval for reuse. |
| Two verifiers cover different product surfaces. The plan clearly concerns the CLI. | Select the applicable CLI coverage from repository evidence. Ask only if a consequential ambiguity remains. |
| A new export journey lacks coverage; the repository has a usable CLI harness. | Offer a concrete verifier using that harness, naming the user benefit, gap, destination, features, and expected trial; await acceptance before including edits in scope. |
| The human says yes to the proposed export verifier. | Include that exact assignment and applicable reference in the plan. Write nothing during planning. With the later implementation instruction, execute without asking for the same consent again. |
| The human declines the export verifier. | Exclude its creation and stop offering it for that scope. Complete the plan with the remaining gap, alternatives, and acceptance limits visible; do not require acceptance of the optional offer. |
| The human changes the proposed coverage from all exports to CSV only. | Carry forward only the explicitly accepted revised scope. Clarify material ambiguity in the revision; do not silently preserve the original broader offer. |
| The offer receives no answer while other planning questions are answered. | Do not treat silence or an unrelated answer as acceptance. Omit unaccepted edits without blocking plan completion or repeating the offer; keep the gap, alternatives, and acceptance limits visible. |
| A current verifier needs a changed selector for one planned flow, while another feature has unrelated drift. | Offer targeted maintenance for the affected flow and preserve the existing directory. Report unrelated drift as future work. Use `maintain full` only with agreed full-map scope. |
| A native executor receives an approved plan with the accepted assignment and reference; no `implement-work` skill is available. | The plan and linked guidance suffice to implement the verifier and run the closing trial. No new command or phase is required. |
| A native executor receives only a tentative verifier suggestion, without its accepted version or destination. | Do not create or edit a verifier. Resolve the missing authorization or consequential target before dependent work. |
| Creation accompanies a product feature that is not ready until implementation ends. | Finish both within the assignment, then launch, doctor, drive an acceptance-relevant mapped feature, capture evidence, and clean up. No preliminary mandatory trial; remaining necessary acceptance checks still apply. |
| The closing trial fails, or required authentication is unavailable. | Report observed failure or the attempted route and missing prerequisite. Clean owned residue and check evidence survives; never claim successful verification or weaken the expected result. |
| Source inspection finds no maintenance changes, but `maintain full` was commissioned. | Exercise every feature in the agreed map; clean source alone cannot establish live coverage. |
| During maintenance, a broken readiness recipe is corrected but the UI remains stuck. | Retry Doctor once after the scoped correction, reset or relaunch an owned stuck instance where needed, and stop with the blocker if readiness still fails. Re-drive corrected harness behavior and preserve evidence through cleanup. |
| Review finds that the verifier passes by bypassing a user action required in the initial plan. | Compare accepted proposal, plan, actual product path, and evidence. Report the coverage or oracle defect without modifying the verifier or product. |
| Review receives a passing trial report followed by relevant product or verifier changes. | Recheck affected claims where permitted; otherwise report missing current proof. A prior success summary does not establish current acceptance. |


## Auto-Work behavioral acceptance

Exercise built packages in isolated temporary projects. The repository-only `verify-auto-work` skill supplies concrete recipes and local delivery simulations. Inspect actual task events, separate reviewer identities, file snapshots, checks and gate outcomes. A wording walkthrough alone does not demonstrate native behavior.

| Scenario | Observable acceptance |
|---|---|
| Initial task-local agent selection | Plan/Implement/Review/Correct are proposed together from current host evidence; no phase before the human's selection. A complete supplied mapping needs no repeated question. Unknown catalogs prompt for IDs/settings; unsupported schema fields remain unsupported. |
| Native models and settings | Actual arguments or compatible existing definitions match selection and overrides. Codex context-fork constraints and Cursor Task/configuration syntax are respected. Two available models and supported reasoning/options run in each exercised host. No configuration writes or substitute harness. |
| Invocation versus execution evidence | Correct accepted native calls may continue without execution metadata, with settings unconfirmed. Self-reports do not confirm models. Rejection, unsupported settings or known substitution stop dependent work without silent fallback. |
| Light goal without approved plan | Agent selection first, no product edit before plan approval; after independent Review, no completion or delivery before result acceptance. |
| Dark bounded goal | Agent selection still required; selected native phase agents proceed within scope and return evidence to the coordinator. |
| Seeded implementation defect | Reviewer detects it without editing; correction consumes a round and a fresh reviewer checks the corrected candidate. |
| Explicit switches | Mode changes preserve scope, permissions, agent mapping, invocation evidence, budget and valid proof; Light reintroduces acceptance. Explicit model/settings changes affect upcoming phases and fresh re-reviews. |
| Missing or failed prerequisites | Reviewer absence, required missing proof and consequential questions remain blockers; Dark delivery rejects missing, stale or bypassable gates. |
| Exhausted budget or repeated stalled finding | Loop stops with consumed rounds and open findings, without a positive completion claim. |
| Resume after source change or uncertain delivery | Affected evidence is rechecked; actual destination state prevents duplicate effects. |
| Manual invocation and unrelated work | Standalone phase stops and pre-existing edits remain intact; Auto-Work is not inferred from ordinary work. |
| Learning over rounds | Every open candidate and its evidence stays available through the native collection or a supplied full handoff; capture and offers do not save guidance. |

Run package/context checks for all targets. At implementation close, selection/invocation changes require native Codex and Cursor trials with two available models, Light/Dark and seeded correction plus fresh re-review. Other changes to approval, acceptance, correction, review delegation or delivery require the closing Light/Dark trials in the available host. Controlled schema cases supplement native evidence; they cannot prove live capability. Unavailable hosts and unexercised features stay explicitly unverified. Local delivery simulation proves only its mechanism. Preserve raw evidence outside the repository after removing owned workspaces.

Source link checks cover existing tracked and non-ignored new Markdown files; ignored local evidence is excluded. Built packages are checked recursively without Git filtering. Full local deployment runs `release-check` once, then `build:targets` to prepare the deployment payload. CLI regression tests exercise physical and aliased paths without publishing or installing.

## Setup playbook selection

| Scenario | Expected observation |
|---|---|
| A fresh project invokes setup-workflow without additional instructions. | Inspect actual files; offer one justified package with per-entry evidence, destinations and proof. No setup edits before implementation. |
| A package contains tests, guidance and optional CI; the human selects tests and guidance only. | Carry the subset forward, implement only it after assignment, and do not reoffer unchanged exclusions. |
| The approved setup already names a verifier, coverage, destination and closing trial. | Follow verification-work once without another selection or consent step. |
| A working project invokes maintenance twice. | Reuse coverage; no template migration, invented gap or redundant files. |
| A stale recipe and an actual product regression appear together. | Repair only commissioned recipe drift, retain the failing product expectation and report the necessary failed check. |
| A setup offer was declined or unanswered and a fresh executor receives the handoff. | Preserve that state, including in Light/Dark, without selecting or repeating the unchanged offer. |
| An evaluation subject can read the expected outputs or the observer's judging recipe. | Preserve this contaminated attempt but exclude it from positive quality evidence. |
| A focused native role is selected and the host supports project configuration. | Observe saved-role discovery, actual child identity and handoff, inherited settings and permitted file effects. |
| The actual host lacks saved-role discovery or delegation. | Report the missing proof and a supported alternative; do not invent config fields or claim success from a generic child. |
| Status, explanation or ordinary bounded implementation needs no setup work. | No catalog expansion or broad project onboarding. |

Use the repository project-setup verifier for real trials; static inventory and context gates do not establish these decisions.

## North-star continuity

Use the repository project-setup verifier's north-star recipe for isolated native trials. Assess existing descriptions by substance; do not require a filename or template. Cover missing/vague direction, reuse, conflicting sources, explicit direction changes, read-only planning and Review, fresh continuation, declined/unanswered offers, routine scope and Light/Dark continuity. Observe actual file effects and candidate skill reads. Package checks establish packaging and fixture mechanics, not these judgments. Cursor authentication or unavailable native delegation remains missing proof.
