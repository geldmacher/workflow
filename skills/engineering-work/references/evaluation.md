# evaluation

Use to compare agent behavior under fixed criteria before recommending a change. Establish the approved experiment scope, candidate variants, resource budget, and access first. Tools, models, execution, and any collaboration belong to the project and host. This method does not itself authorize agent runs or repository mutation.

## Preserve blinding

- Give each candidate an organic user request and realistic project context. Keep evaluation instructions, the rubric, competing outputs, and candidate identities outside what it can see.
- Use neutral labels and project-shaped paths. Remove experiment-specific names that reveal the condition or desired result; do not distort legitimate task content just because a normal project uses a word such as test.
- Do not tell a candidate that other candidates exist or ask it to enumerate its hidden reasoning or which principles it followed. Assess observable work and accessible execution records instead of compliance self-reports.
- The judge may know it is evaluating, but receives sanitized labels rather than model or variant identities. Compare the variants on one common scale.

## Run a bounded comparison

1. Frame the behavior under study and define a small rubric, typically three to six concrete criteria. Hold it back from candidates. Decide what evidence would support promotion and which limitations must remain visible.
2. Prepare isolated candidate environments with the intended variant and equivalent relevant context, input, permissions, and resources. Check what the candidate can actually read for accidental condition leakage.
3. Give each candidate the same natural task. Use the agreed execution budget and method. If a run fails or the conditions differ, record that fact rather than silently substituting a more favorable run.
4. Inspect outputs and task-local execution records where authorized and available. Do not search unrelated workspaces or private conversations. Missing records limit claims about how the result was produced.
5. Give the judge the rubric and sanitized outputs together for a consistent comparison. Read every output yourself and compare the verdict against the artifacts. Disagreement can reveal rubric ambiguity or bias and requires an explained synthesis, not automatic acceptance of a score.
6. If candidate identity or the expected result leaked, mark the affected comparison compromised. Rerun only within the approved budget and corrected conditions; otherwise report it as inconclusive. Do not repair the appearance of blinding after a biased run.

## Result

Report the variants, criteria, observed results, judge's verdict, your synthesis, and whether the evidence supports promotion. Include failed runs, exposure risks, missing records, and sampling limits. Evaluation informs the human decision; it does not automatically approve, install, or publish a change.
