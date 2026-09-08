# Working with Workflow

Plan → Implement → Review → Correct → Review is a sequence of separately commissioned phases. The human-readable documents are the shared reference. Use the user's language and as much structure as the task needs.

Each phase ends with its result and the human's next useful action. Explain why that action matters when it is not obvious. Small tasks need a short answer; longer results benefit from headings or lists that fit their content. Use familiar terms and keep evidence beside the claim it supports. There is no fixed response template or extra summary to fill in.

## Plan and implementation

A useful plan explains the goal and benefit, observable success criteria, scope and exclusions, important decisions, dependencies, risks, and appropriate checks. Read relevant saved project lessons and check their current applicability. Investigate until those decisions, key interfaces, and checks are clear enough for implementation. Technical details are welcome when they remove ambiguity; routine choices stay with the executor. Significant product and permission decisions must be settled before implementation. A clear assignment needs no interview. The human next checks the plan and starts its implementation.

The human commissions implementation against an identifiable plan version. Material amendments need an explicit decision; editorial improvements do not. The executor preserves unrelated work and reports the actual outcome, changes, deviations, checks and results, working state, and remaining limitations. The report recommends a separately commissioned Review against the plan; it does not establish that Review passed. Native implementation receives these reporting expectations, learning capture and carry-forward instructions, the current collection, and the host's review invocation through the plan handoff, even when no implementation skill is available.

## Review and correction

Review identifies the approved plan, relevant reports, and current repository state. It inspects all success criteria and boundaries without changing repository files, including untracked files. Any permitted transient test output belongs outside the repository. Checks with prohibited side effects remain missing evidence.

The judgment leads: goal achieved, corrections needed, or open points. Failed necessary checks prevent a positive completion claim. Missing proof remains visible even if other checks pass. Evidence describes actual observations on a named working state; changed work requires reassessing affected conclusions.

Review covers every success criterion, starting with the smallest sufficient inspection. Before reusing a result, inspect its origin, actual output, coverage, and applicability to the current source, dependencies, configuration, and relevant environment. Inspecting evidence does not mean rerunning every check. Recheck affected or uncertain proof and widen checks when dependencies, failures, or unresolved risks warrant it. State the reuse basis briefly; an earlier success summary alone is insufficient. The same principle applies after corrections.

An actionable finding explains observed behavior, evidence, impact, expected correction, permitted scope, and recheck. It can directly serve as the correction assignment. The human commissions correction; the executor fixes those findings, preserves unrelated edits, and reports the result. A fresh Review is a separate instruction.

For missing proof, name the check and a permitted way to collect it. The human can commission a verification-only correction without unnecessary code changes. Ask for a human decision only when the executor cannot resolve the access, scope, or product choice within the assignment. Once the goal is established as achieved, no further Workflow phase is required.

## Handoff

Keep the approved plan and reports in the native task. A new task receives the approved plan version, human assignment, useful implementation and review reports, current repository state, unresolved decisions, next action, and the complete compact content of every open learning candidate with evidence references. Retain accessible outcomes for integrated or retired lessons, including reasons and successors. A reference to "earlier learnings" alone is insufficient. Use accessible native references for supporting documents or include their relevant text when unavailable to the recipient. A descriptive title and task reference may identify the version; no fixed identifier or metadata block is required.

An executor compares the handoff with the current repository. Missing plan versions, contradictory assignments, or stale observations call for precise clarification before dependent work. An earlier agent's confidence is not human authorization. Previous technical artifacts do not resume a workflow; start from a clear assignment under the current method.

## Learning across reviews

Implementation and correction capture reusable insights with their future benefit, evidence, scope and conditions, proposed change, and destination. Every subsequent phase report and handoff carries all open candidates, including those offered but not taken up. The collection lives in the existing task documents; there is no separate log or required layout. Missing earlier reports or evidence remain an explicit gap, not a reconstructed history.

Every Review checks inherited and new candidates against current work and offers all independently confirmed, applicable lessons together. An overall judgment of corrections needed does not prevent an offer supported by the lesson's own evidence. Necessary corrections and missing proof remain prominent. No eligible lessons means no offer; learning never becomes a required completion step. Status and explanation describe documented learning when relevant without renewing offers.

Later rounds may refine a lesson, merge duplicates, distinguish different conditions, or supersede it. Newer statements do not override earlier evidence by default. Retired candidates retain a reason and successor where appropriate. Unresolved conflicts stay open, withholding only the affected changes. If later work invalidates already saved guidance, propose an update or removal for a subsequent learning assignment.

Commission `$learn-from-work` in Codex, `/learn-from-work` in Cursor Agent Mode, or `learn-from-work` in a portable client. Unless you narrow the assignment, it considers every open candidate from the available collection. It checks current Review evidence, later changes, existing guidance, and interactions across the proposed batch before saving. Independent confirmed lessons can be saved while consequential conflicts or unclear destinations await a decision. Only bounded project guidance or appropriate skill updates belong to learning; broader code, tooling, verifier, or plugin improvements become concrete future development assignments and stay pending until separately handled or rejected. Personal memory requires its own explicit request.

The learning report identifies actual saved paths and evidence, merged or retired candidates and reasons, and every still-open item. Read-back must confirm the combined saved guidance before claiming integration. Partial failures preserve unfinished work. Repeating learning checks the actual destination first, so an interrupted report does not cause duplicate rules. Later planning reads applicable saved guidance and verifies that it still fits. The [learning guidance](../references/learning-work.md) defines these decisions for executors.

## Supporting work

Status and explanation are read-only accounts of the available documents and their limits. Learning persists confirmed reusable knowledge only when explicitly commissioned. Engineering methods are optional. Verifier inspection is read-only; creation and maintenance need a matching implementation or correction assignment covering the destination and outcome.

During planning, independently assess whether engineering playbooks and verifier creation or maintenance help. Either, both, or neither may be offered. Present useful options with a brief reason, including several alternatives when meaningful and no artificial extras. Mark exactly one substantive option per offer as recommended for the goal, scope, and repository. Include an explicit decline-all option and allow revisions. In German these labels are "Empfohlen" and "Nein, nicht machen"; use equivalents in the user's language.

Only actively selected methods and accepted verifier work enter the binding plan. Recommendation, silence, and consent to the other offer are not selection. Preserve earlier explicit approval. Declining playbooks means none of those methods is used. Declined or unanswered offers do not block plan completion or trigger repeat offers for the same scope. Read full playbook references only for selected methods.

Reuse suitable existing checks, harnesses, and verifiers without a separate offer, consent question, or justification; ordinary check planning and results can still name them. Offer concrete creation or maintenance only for an actual gap or update need. Each option identifies its benefit, destination, affected features, change scope, and closing trial. Without active acceptance, do not edit verifier files. After a decline, name remaining gaps, alternatives, and acceptance limits; stale guidance does not become reliable evidence and success criteria are not silently waived.

The plan carries the accepted verifier assignment and applicable [creation](../skills/verification-work/references/create.md) or [maintenance](../skills/verification-work/references/maintain.md) reference into native implementation. Planning does not create files or start the product. The implementation instruction starts the agreed work, including the first end-to-end trial at its close when product and verifier are ready together. Preserve trial evidence through cleanup; failed or unavailable necessary checks leave verification incomplete. A separately commissioned Review checks the verifier against the accepted proposal, approved plan, implemented behavior, and current evidence, without modifying it.

## Completion

After sufficient necessary work and checks, report the repository outcome and proof honestly. Further investigation or checks need a concrete unresolved question. Reuse still-applicable instructions already read, and load optional methods or verifier details only when the task needs them. Installation, release, production access, and host activation are separate facts and actions. Native host permissions enforce execution boundaries; Workflow does not claim its own technical approval or integrity mechanism.

## Examples of clear phase endings

These are fictional examples, not required wording or evidence of executed checks. Real plans and reports retain the details their task needs. Codex uses `$skill-name`; Cursor uses `/skill-name`, with Plan Mode for planning, Ask Mode for Review, and Agent Mode for correction and learning. Portable clients use the corresponding skill names and `implement-work` for implementation.

### Add an empty CSV export

The user has specified that an empty export must contain its column headers. A small plan explains that change, the existing export entrypoint, and checks for empty and populated exports. It ends:

> The plan is ready: empty CSV exports will contain their column headers. Exports with data will remain unchanged. Check the plan and start implementation with Implement Plan. After implementation, commission a separate review with `$review-work`.

After implementation, the report names the changed file and the actual output from the existing tests:

> Empty exports now contain the column headers. The existing automated tests pass. Start `$review-work` to check the implementation against the plan.

Review exercises a populated export and finds that the existing tests missed a lost row. It names the affected export code and recheck:

> A correction is needed: exports with data lose their first row. This fails the second goal in the plan. Commission `$correct-work` with the described fix and checks for both export cases.

After the commissioned fix and successful rechecks:

> Exports include the first data row again. The checks for empty and populated exports pass. Start `$review-work` to check the correction against the plan.

### Review a resumed settings change

Review receives actual earlier test output. Source, dependencies, configuration, and relevant test conditions are unchanged. The approved plan also requires a keyboard check for which no result exists:

> The saved-settings tests still support this change: their output covers the requirement, and the code and test conditions they depend on are unchanged. The required keyboard check is missing, so completion is still unconfirmed. Commission `$correct-work` to run that check in the local test app and report the result; no code change is needed unless a defect is found.

If a consequential product choice blocks the check, the question states the choice and recommendation:

> The plan gives conflicting instructions for Escape: keep the edited value or restore the saved value. I recommend restoring the saved value so Escape cancels the edit. Which behavior should the check require?

After the human decides, commissions the check, and requests a fresh Review with current passing evidence:

> The goal is achieved. Saving works and the keyboard check confirms the agreed Escape behavior. The required checks support the current change; no further Workflow step is needed.

### Keep export lessons through correction rounds

In this fictional repository, an initial Review confirms two guidance candidates: "Export command location" documents that the command currently runs from the backend directory; "Isolated export data" documents the demonstrated temporary-data recipe. Their report carries the observed commands and results, scope, benefit, and proposed project-guide destinations. It offers learning while naming an unrelated export correction. The human commissions only correction, so both candidates remain open.

Correction introduces a verified root-level command wrapper. The next Review replaces "Export command location" with "Use the root export wrapper", recording why the earlier recipe is obsolete. It confirms a new "Wait for export readiness" lesson from the observed ready signal. A duplicate isolated-data suggestion is merged with the existing candidate. The report carries the full content and evidence for all three open candidates and again offers learning.

A fresh executor receives that collection, the replacement reason, approved plan, reports, and current assignment. A later commissioned learn-from-work checks the three candidates together against current guidance and saves all three when their evidence still applies. It reports the retired backend-directory recipe instead of installing both command rules. If the ready-signal evidence is now missing, the two independent lessons can still be integrated while that candidate remains explicitly open.
