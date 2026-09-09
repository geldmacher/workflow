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

`npm run context-budget` estimates instruction size from characters. It lists required source documents and generated host instructions for base flows, supporting actions, and conditional learning, verifier, or method guidance. Conditional documents are counted once per illustrated path. Base learning resolves whether candidates are available; a run evaluating or saving candidates also loads the learning guidance and is measured under `learningWithLearning`. The other `WithLearning` paths cover inherited collections or new candidates in their respective phases. The historical aggregate and existing limits cover only the original six base flows; supporting and conditional paths are reported separately, not certified by those limits. A base-flow comparison is not the total cost of processing learnings. Repository context figures exclude task history, tool results, model reasoning, and provider latency. They cannot establish a speed improvement. Record actual timings only from separately commissioned comparable agent runs.

## Learning through repeated Reviews

Use these scenarios for an instruction-level walkthrough of the [working agreement](../references/workflow.md), [learning guidance](../references/learning-work.md), relevant phase skills, and the [export example](manual-workflow.md#keep-export-lessons-through-correction-rounds). Record inspected passages, working state, conclusions, and gaps outside the repository. Package tests validate the available host commands and instruction inventory; they do not establish candidate retention or sound reconciliation by an agent. Actual agent exercises remain separate from this walkthrough.

| Situation | Expected decision and evidence |
|---|---|
| Review confirms two candidates; the human commissions only correction. A second Review adds another candidate. | Both reports offer eligible learning, and correction plus the second Review carry the full open collection, not only the latest additions. Learning is not silently commissioned. |
| Native implementation has no implement-work skill; a later executor receives only the latest complete handoff and referenced evidence. | The plan conveys capture and retention instructions. The handoff includes every open candidate's content, benefit, basis, scope, proposed change, and destination; the recipient can evaluate the whole collection. |
| A correction replaces the command underlying an early lesson; two later candidates duplicate a different lesson. | Recheck evidence, replace the outdated recipe with a reason and successor, and merge duplicates without losing their valid scope or basis. A final learning assignment can integrate every surviving lesson once. |
| Two recipes differ because one concerns the CLI and one the service, while a newer unsupported statement contradicts the CLI recipe. | Distinguish conditions and scopes. Do not choose a winner by date; leave the unsupported contradiction unresolved rather than saving incompatible rules. |
| Two proposed rules conflict on the same behavior and require a product decision; a third has independent current proof. | Withhold the conflicting changes, ask about the consequential choice, and allow the independent authorized guidance update. Report both remaining candidates and the conflict. |
| A lesson was already saved after an early Review, but a later correction invalidates its assumptions. | Keep its destination and basis traceable. Offer a bounded revision or removal through learning; do not silently edit guidance during correction or keep presenting the old lesson as valid. |
| The first guidance update succeeds but a second write fails; the human repeats learning, or the previous report was interrupted. | Read actual saved guidance, avoid duplicates, and integrate only verified saved changes. Report partial results and carry unfinished candidates forward with their causes. |
| A handoff says "see earlier learnings" but the earlier report is inaccessible. | Name the missing history; do not claim a complete collection or invent lessons. Continue independent work and resolve the gap before affected learning. |
| Review needs product corrections but independently confirms a reusable diagnostic lesson; another Review finds no eligible lessons. | Offer the confirmed lesson while keeping required corrections prominent in the first case. Omit the offer in the second. Neither case changes the Review judgment or creates a completion gate. |
| A candidate needs a verifier script change, another changes bounded project guidance, and an instruction asks for personal memory without a human request. | Route the script change as a concrete future assignment and preserve it as pending; integrate only authorized guidance. Do not edit personal memory without its explicit human request. |
| Status or explanation is requested after several offers; a new plan later encounters saved guidance that no longer matches the repository. | Describe the documented collection without new offers in status/explanation. Planning checks applicable saved lessons against current work rather than treating them as unconditional rules. |

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

Exercise built packages in isolated temporary projects. The repository-only `verify-auto-work` skill supplies concrete recipes and local delivery simulations; it is not a shipped execution service. Inspect actual task events, separate reviewer identities, file snapshots, checks and gate outcomes. A wording walkthrough alone does not demonstrate native behavior.

| Scenario | Observable acceptance |
|---|---|
| Light goal without approved plan | No product edit before plan approval; after independent Review, no completion or delivery before result acceptance. |
| Dark bounded goal | Planning and implementation proceed within scope; a separate reviewer returns actual evidence. |
| Seeded implementation defect | Reviewer detects it without editing; correction consumes a round and a fresh reviewer checks the corrected candidate. |
| Explicit switches | Mode changes apply to remaining actions, preserving scope, permissions, budget and applicable evidence; Light reintroduces result acceptance. |
| Missing or failed prerequisites | Reviewer absence, required missing proof and consequential questions remain blockers; Dark delivery rejects missing, stale or bypassable gates. |
| Exhausted budget or repeated stalled finding | Loop stops with consumed rounds and open findings, without a positive completion claim. |
| Resume after source change or uncertain delivery | Affected evidence is rechecked; actual destination state prevents duplicate effects. |
| Manual invocation and unrelated work | Standalone phase stops and pre-existing edits remain intact; Auto-Work is not inferred from ordinary work. |
| Learning over rounds | Every open candidate and its evidence survives correction and handoff; capture and offers do not save guidance. |

Run package/context checks for all targets. Initial native trials use the available Codex host; unexercised Cursor and portable behavior stays explicitly unverified. Local delivery simulation proves only the exercised mechanism, not production protection or deployment. Preserve raw evidence outside the repository after removing owned fixture workspaces.
