# Make future tasks easier

A task can leave more than working code: knowledge the next agent can reuse, a repeatable way to check behavior, or a better method for approaching the problem. Workflow offers these when they help. You choose which additions to make.

| Need | What helps | Example for CSV export |
|---|---|---|
| Avoid rediscovering project conventions | Saved project lessons | Which download helper to use and why |
| Check real behavior consistently | A verifier: reusable checking instructions | How to apply filters, download a CSV, and check its rows |
| Give the agent an appropriate approach | A playbook: a focused working method | How to reproduce and fix an export defect |

## Set up and maintain project feedback

Use `setup-workflow` to establish project direction and prepare a project's tests, evals where useful, check scripts, project-local CI configuration, and agent guidance. It starts from the important user journeys and project requirements, reuses suitable coverage, and proposes only concrete improvements. Runtime prerequisites and missing access stay visible. Machine-wide installation, host settings, and external CI changes need their own assignment.

For example:

> $setup-workflow Plan a feedback setup for our CSV exporter. Reuse the existing Node checks, cover empty and filtered exports, and make the check routes discoverable in our project guidance.

Review the proposed scope, then commission implementation through the normal Workflow phases. An existing approved setup assignment is carried through without another approval for each component. After implementation, the report distinguishes configured files from checks actually run and behavior still unverified.

Use `maintain-workflow` to inspect established setup, including projects that never used the setup skill. It checks current requirements, commands, prerequisites, CI files, and guidance. Without an update assignment, it remains read-only and does not launch the product.

> $maintain-workflow Inspect whether our export checks and agent instructions still match the current CLI.

For an approved update plan:

> $maintain-workflow Implement the approved update to the export check command and its project instructions. Preserve the expected CSV behavior.

A suitable setup needs no edits. Partial setup is extended where useful; existing locations are retained. A broken check route, a product regression, and missing access require different responses. Maintenance never changes expected behavior just to obtain a passing result.

### Keep project direction useful

Setup always checks the project's **north star**: whom it serves, why it exists, the intended benefit, and the principles and boundaries that guide decisions. A clear existing definition is reused wherever it lives. Missing or vague direction is drafted from known requirements and refined with you; the agent asks about consequential gaps instead of inventing goals. The agreed text belongs in the existing project description, or a short README section if none exists, with an agent-guidance link where useful.

> This exporter helps operations staff transfer complete, ordered records into existing spreadsheets. Predictability matters more than advanced formatting. It remains a local tool with no vendor-service dependency.

Planning compares relevant choices with that direction and your task. If you explicitly change the project direction, its documentation is included in the related implementation or correction without another approval or learning phase. Planning and Review keep the files unchanged and carry the decision, its basis, destination and pending update forward. Maintenance compares actual text with your decisions and leaves suitable content unchanged.

> We have decided to serve external auditors as well as our operations team. Update the project description as part of the approved documentation work; the export format and local-only boundary stay the same.

A task-specific exception or technical choice does not redefine the project. Unresolved conflicts are brought to you with their impact. Declined or unanswered proposals are retained without repeated offers; a bounded routine task needs no project-wide redefinition. Review reports a missed agreed update without editing it. Reusable lessons still use the separate learning process.

### Offers during ordinary Workflow work

Planning and execution check prerequisites and feedback relevant to the task. A concrete gap can lead to a setup or maintenance offer naming the impact, proposed changes, destinations, and closing proof. Current evidence is reused; there is no project-wide onboarding requirement for every task. Status and explanation do not initiate readiness work.

You can accept, revise, or decline the proposal. Declined or unanswered offers are not repeated for the same scope in later phases. The task handoff carries that decision. Optional improvements do not block the task, while missing necessary prerequisites still limit execution or the evidence supporting completion.

`workflow-doctor` remains the task-level readiness check. `verification-work` owns concrete reusable verification instructions. An accepted setup proposal may include verifier creation or maintenance when it names the purpose, destination, coverage, and closing trial; that scope needs no second approval. A single verifier update can go straight to `verification-work`. Setup and maintenance concern the project; updating the Workflow plugin uses `install-release`.

## Choose setup playbooks

Setup and maintenance share a [catalog](../skills/setup-workflow/references/catalog.md) covering code checks, behavior tests, user journeys, evaluations, test data and isolation, commands and CI, guidance, project skills, and optional subagent roles. The agent reads relevant entries to assess the project and offers one recommended combination with a reason, concrete changes, destinations and closing proof for each entry. Reading a method is not selecting it.

For example, a fresh TYPO3/DDEV site might benefit from existing Composer checks exposed through the container, a navigation journey using known content, and short contributor instructions. The actual tools and paths come from the project; there is no required TYPO3 recipe or built-in `ddev check` assumption.

> Accept behavior-tests and project-guidance from your proposal. Leave CI and subagent roles out. Include the named export verifier and its closing CLI trial. Use this selection in the setup plan.

After plan approval, commission implementation normally. An already approved matching assignment needs no additional playbook selection; included verifier work gets no second approval. The setup choice does not select Engineering playbooks. Declined or unanswered entries are carried through handoffs and are not reoffered for unchanged scope, including experimental Auto-Work.

> $maintain-workflow Inspect whether the existing setup still fits our exporter after the command rename. Reuse working coverage and report any drift.

An adequate unchanged setup needs no new artifacts. A requested update corrects the selected gaps and exercises affected routes; real product failures stay visible.

> Consider a project-local read-only schema reviewer for our recurring independent schema checks. Explain its benefit, supported host configuration, expected handoff and native trial before including it.

A subagent role is optional, narrowly scoped and tested through actual discovery and delegation. A generic child spawn does not prove the saved role was used. Unsupported host capabilities remain explicit; global host configuration is a separate assignment.

## Save project knowledge

During implementation and correction, Workflow records useful discoveries as **learning candidates**: proposed lessons with evidence, a future benefit, where they apply, and where they could be saved. Collection happens as part of the work; it does not silently change project instructions.

When a correction recurs despite a fix or existing guidance, follow the [learning guidance](../references/learning-work.md) to choose prevention proportionate to the task. A structural change or CI check can be more useful than another guidance paragraph, but technical feasibility alone does not justify a large change. A first finding can also justify proportionate prevention within its assignment. The session or its log can also show where the agent could not find something, wasted tool calls, or followed an instruction that changed nothing. Mechanical lessons become checks. Judgment lessons become standards the reviewer applies. Learning saves supported, bounded guidance only when requested and appropriate; larger repairs remain future assignments.

Every review checks earlier and new candidates against the current work. If any lessons are confirmed and useful, it offers `learn-from-work`. A lesson can be sound even when an unrelated code correction remains; the learning offer does not change the review judgment. If there is nothing useful to save, there is no offer.

For example, review might establish that the existing download helper correctly handles CSV filenames. A fictional offer could say:

> Save the verified download-helper convention in the project guide so future export tasks can reuse it. The report links the implementation and the checks supporting this lesson.

To accept, ask:

> $learn-from-work Save the confirmed CSV export lessons from this task.

Use `/learn-from-work` in Cursor Agent Mode. In other compatible clients, use `learn-from-work`.

The skill rechecks current evidence, later changes, existing guidance, duplicates, and conflicts before saving. Unless you narrow the request, it considers the complete available open collection. Its report names saved files and lessons, merged or retired candidates, and anything still unresolved. It reads back the saved guidance before reporting successful integration; a repeated or interrupted request checks the destination first to avoid duplicates.

Future planning reads relevant saved guidance and checks that it still applies. This improves project instructions and skills; it does not train the model. Saving personal memory needs its own explicit request. Broader code, tooling, verifier, or plugin changes become separate development assignments.

### Example: lessons through corrections

This is a fictional sequence:

1. Review confirms two lessons: run the export check from the backend directory, and use isolated temporary orders as test data. You choose to fix a code finding first; both lessons remain in the reports.
2. Correction introduces a verified root-level command. The next review replaces the backend-directory recipe with the new command, records why, and keeps the test-data lesson. It also confirms how to wait for export readiness.
3. You request learning later. The agent checks all three current lessons together. It saves those still supported and retires the old command recipe, rather than saving conflicting instructions.

If one lesson lacks evidence, it stays open while independent confirmed lessons can be saved. Conflicts are resolved from evidence and scope, not merely by choosing the newest statement. If saved guidance has become wrong, review can propose its later update or removal.

One complete collection stays in the task. Later reports carry changes and a reference to that collection, and include each candidate's content, evidence, benefit, scope, and proposed destination when the receiver cannot open the reference. Missing earlier reports remain a visible gap. You can defer saving without discarding the collection; learning is never a required completion step. Status and explanation can describe it without repeating the offer.

See the [executor learning guidance](../references/learning-work.md) for reconciliation details.

## Keep checks useful

A **verifier** is a reusable skill describing how to check real product behavior. It records prerequisites, how to start the relevant UI, CLI, or service, actions to take, expected results, evidence to retain, and cleanup.

For CSV export, this could explain how to create temporary orders, set a filter, download the file, compare columns and rows, and remove the temporary data. Existing tests and suitable verifiers are reused first.

Alongside project setup and maintenance, two focused skills have different jobs:

- `workflow-doctor` inspects whether verification is ready without starting the product.
- `verification-work` inspects, creates, or maintains a concrete verifier. Inspection is read-only; creating or changing it needs an implementation or correction assignment covering that work.

You can ask “Do our checks cover the CSV export?” to inspect readiness. During planning, Workflow also looks for concrete gaps or stale instructions and offers creation or maintenance when useful.

A fictional proposal might say:

> Add an export-checking recipe to the project's verifier. Cover filters, visible columns, and empty exports. At implementation close, run that recipe against the finished feature and retain the downloaded examples as evidence.

Once you accept the proposal and commission implementation, the verifier changes and their first end-to-end trial are part of the work. Review checks the accepted scope and actual evidence. You do not need to remember a separate maintenance request for that already accepted work.

Maintenance normally covers affected features. Explicitly requesting `maintain full` covers the agreed full feature map. If a later task changes the download flow, planning can offer an update to the recipe. A product regression remains a finding: changing the expected result just to make a check pass is not maintenance.

If a necessary trial fails or cannot run, the report names the missing proof. Accepting documentation work alone does not establish that the product passed its checks. See the executor instructions for [creation](../skills/verification-work/references/create.md) and [maintenance](../skills/verification-work/references/maintain.md).

## Choose a working method

An engineering **playbook** gives the agent a focused approach for the current task. It does not add a permanent project mode or authorize extra phases.

| Your task | Example method | What it helps establish |
|---|---|---|
| Add CSV export | `feature` | Agreed behavior and checks for the new capability |
| Fix ignored export filters | `bug-fix` | A reproduced defect and a checked correction |
| Understand an unexplained live failure | `runtime-forensics` | A diagnosis based on fresh runtime evidence |
| Speed up a large export | `performance` | A measured improvement against a baseline |
| Restructure export code | `refactoring` | Preserved behavior while changing structure |

Planning offers relevant options with a benefit, intended phase, one recommendation, and a choice to use none. You do not need to memorize method names. To ask directly, use `engineering-work suggest`; to select a known method, use `engineering-work use <playbook-id>`, with your host's usual skill prefix.

Only selected methods are loaded and included in the plan. The [full catalog](../skills/engineering-work/references/catalog.md) covers additional methods, including prototypes, visual comparisons, evaluations, and task resumption.

## What you choose

Playbook selection is independent of setup and verifier offers. Setup can include explicitly named verifier work without a duplicate offer. You may choose either, both, or neither. Each proposal explains its benefit and scope; a verifier proposal also names its destination, affected features, and closing trial. You can ask for a revised proposal.

A recommendation or silence does not count as acceptance. Declined or unanswered offers are left out of the plan, do not block planning, and are not repeated for that scope. Existing approval remains valid. Suitable existing checks can be reused without a new offer.

Declining additional verifier work does not remove the need to prove the agreed result. Remaining gaps, alternatives, and limits stay visible. Learning is a separate choice after review, even in experimental Auto-Work.

Return to the [working guide](manual-workflow.md). The optional [experimental Auto-Work approach](auto-work.md) is explained separately.
