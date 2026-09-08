# investigation

Use for a question about how something works, why it was built that way, whether a claim holds, or which alternative to choose. The deliverable is an evidence-backed explanation or recommendation. This playbook is repository-read-only.

## Work from the question to an answer

1. Establish the question, audience, and decision the answer should support. Check the premise against the available evidence; an unsupported premise is a finding, not a reason to invent an explanation.
2. Trace the relevant entrypoints, contracts, data flow, and authoritative records. For motivation or regression questions, inspect the relevant history and recorded decisions as well as current code. Separate an author's recorded reason from your inference about it.
3. Follow the smallest useful path through the subsystem. Use targeted searches and reduced excerpts for large records. Expand only when a dependency or competing explanation can change the answer.
4. Compare plausible explanations against the evidence. Name contradictions and gaps. If alternatives need a recommendation, compare their consequences for the actual goal, including costs, risks, and what remains unknown.
5. Return your judgment with concrete source locations and relevant observations. Explain the system's key concepts, how they connect, where the behavior lives, and material gotchas to the extent the question needs them.

A source-only finding does not establish runtime behavior that has not been observed. If answering would require a new prototype, runtime intervention, or repository change outside the assignment, describe that next step and its missing authority. A proposed fix can be handed to [bug-fix](./bug-fix.md), [feature](./feature.md), or [refactoring](./refactoring.md); recommending it does not start implementation.

## Result

Lead with the answer or recommendation, then give the evidence and tradeoffs that support it. Distinguish observations, inferences, and unresolved questions. Use a comparison table only when it helps the decision; no fixed report structure is required.
