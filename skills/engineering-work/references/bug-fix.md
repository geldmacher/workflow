# bug-fix

Use for one reported defect whose symptom must be reproduced, explained, corrected, and checked again. Apply the steps appropriate to the commissioned phase. Repository changes require an approved plan and an implementation or correction instruction; this method does not commission the next Workflow phase.

## Reproduce and isolate

1. Reproduce the symptom on the matching surface using the project's available controls. Capture the input, environment, expected behavior, actual failure, and relevant output. Drive the reproduction yourself when access permits it.
2. If it does not reproduce, narrow the conditions, synthesize a representative trigger, or use authorized instrumentation. Name a specific access or reproduction limitation when it prevents progress. A non-reproduction does not prove the bug absent and does not justify a speculative fix.
3. Form competing hypotheses from the affected source, contracts, and relevant change history. Choose observations that rule out the largest useful portion of the remaining possibilities. Read runtime state where source alone cannot distinguish them.
4. Confirm the surviving mechanism before choosing the correction. When evidence refutes a hypothesis, remove only the temporary changes that hypothesis motivated. Preserve unrelated and pre-existing work.

## Correct and verify

5. Ground the fix in the approved behavior and scope. Resolve material design choices in planning; during execution, keep routine choices local and return consequential scope changes to the human. Implement the smallest correction supported by the evidence. Extra guards that merely might help are separate hypotheses.
6. Where a cheap, representative regression test exists, demonstrate failure before the fix and success after it. Avoid manufacturing an expensive test framework when the original reproduction provides the appropriate check.
7. Run the original reproduction again on the same surface and complete the applicable regression checks. A passing unit test proves the behavior it exercises; it does not substitute for an untested runtime symptom. An unavailable check or a result from a different surface remains a limitation.
8. Inspect the final diff for unsupported changes and leftover instrumentation. Self-verification completes the commissioned implementation or correction; a fresh Review remains separately commissioned.

## Result

Explain what was broken, the confirmed cause, the correction, and the verification. Include the decisive failing and passing observations or evidence references, along with any remaining gap. Do not claim a fix when the original symptom was never reproduced or the necessary verification remains inconclusive.
