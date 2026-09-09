# refactoring

Use for a structural change that preserves agreed behavior: rename, extract, inline, deduplicate, move, or reshape. New behavior belongs to [feature](./feature.md); correcting a defect belongs to [bug-fix](./bug-fix.md). Changes require the applicable plan and matching execution instruction.

## Hold the behavior while changing structure

1. Establish the existing contract and a way to compare behavior before moving structure. Use adequate existing coverage, a characterization test, recorded baseline, or equivalence check. If coverage is absent, establish the necessary observation first. Type checking and lint alone do not prove behavioral equivalence.
2. Name the target module layout, types, and call relationships. Explain which indirection, hidden state, invalid state, or duplicated knowledge the change removes. A clear, local implementation does not need a new abstraction merely to look more systematic.
3. Remove only demonstrably obsolete structure inside the approved scope before adding its replacement. Retain necessary boundary validation, rationale, and compatibility. Deletion needs evidence that the behavior or consumer is no longer required.
4. Move in small steps that preserve the established comparison. When replacing an internal API, migrate its callers and remove the superseded path in the same authorized scope. Check string references, configuration, documentation, and back-references as well as typed usages. Preserve any explicitly required public compatibility.
5. When a new defect or feature need emerges, separate the finding from the structural work. Continue only where the approved behavior-preserving change remains valid; otherwise surface the consequential decision before proceeding.
6. Prove equivalence against the real outputs or artifact. Use replay, output comparison, or a representative run on the matching surface as appropriate. Inspect the diff yourself; another executor's success assertion is not the evidence.
7. Confirm the result improves understanding: fewer steps from question to answer, less hidden state, or fewer unnecessary indirections. Remove unsupported experiments without disturbing unrelated work. If the proposed structure brings no defensible benefit, report that rather than treating a smaller diff as success.

## Result

Describe the structural change, preserved contract, equivalence evidence, and the concrete improvement in understandability. State any excluded behavior change or unproved equivalence. Ordered verification does not authorize commits, rebases, or PRs.
