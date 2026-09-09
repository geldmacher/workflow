# Independent review in Auto-Work

For each initial or post-correction Review, start a fresh separate native agent. Give it the applicable plan and assignment, active mode, implementation or correction report, exact current workspace or revision, relevant raw evidence, and complete learning collection. Give access to the packaged [review skill](../../review-work/SKILL.md) and its linked references. A copied implementation conclusion is not independent evidence. Do not give the reviewer the answer it should reach.

Use available host read-only restrictions and explicitly require repository-read-only behavior, including untracked files. Inherit the parent's model settings. Do not create global agent configurations, weaken host permissions, or substitute a self-review when delegation is unavailable. A separate context provides separation of judgment, not a guarantee of correctness or a new sandbox; describe actual host restrictions honestly.

While the reviewer runs, the executor makes no changes to the reviewed state and waits for its result. Avoid concurrent writers to that workspace. The reviewer compares the plan with actual files and evidence, applies the Review rubric, reports defects and missing proof, and returns without corrections or delivery. Permitted transient test output belongs outside the repository. If the state changes, invalidate the affected conclusions and obtain current review evidence before progressing.

Use native result references and raw check output to retain the reviewed state and judgment. A successful agent execution alone is not a positive review. Only a reasoned goal-achieved judgment with sufficient necessary evidence allows the executor to move to acceptance or delivery. Corrections needed route to the named in-scope fixes when budget remains. Open consequential questions, unavailable checks, or reviewer failure stay visible; missing review evidence never counts as success.

Standalone Review continues to end with the appropriate human next action. In this expressly commissioned sequence, its report instead returns control to Auto-Work. Learning offers remain optional and do not stop the loop or authorize saving guidance.
