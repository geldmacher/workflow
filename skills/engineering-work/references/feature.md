# feature

Use to add or intentionally change behavior. The approved plan defines the requested outcome and acceptance. Apply design work during planning and repository changes only with the matching implementation or correction instruction.

## Establish the design

1. Trace the affected subsystem, existing behavior, interfaces, and consumers. Describe what changes for the user or caller and what must remain compatible.
2. Name the domain data and its organizing structure before scattering logic: a state machine for meaningful transitions, a registry for repeated dispatch, or a typed model for shared shape assumptions. Keep an already clear local structure when it fits.
3. Compare materially different designs when they affect acceptance, authority, compatibility, or maintainability. Preserve the approved choice and its rationale. Do not silently turn an unresolved product decision into an implementation detail.
4. Establish the useful execution decomposition: blocking prerequisites, independently verifiable work, shared mutable state, and the smallest safe units. Shared primitives come before their consumers. Separate writable state when practical and serialize real shared invariants. A small task may need only one executor; this method mandates neither delegation nor a checkpoint format.

## Implement and prove the outcome

5. Implement one coherent unit at a time within the approved scope. Keep tightly coupled code under clear ownership. The executor and host select tools, sequencing, and any authorized collaboration.
6. Carry changes to shared primitives through all affected consumers and verify the behavior each depends on. Respect agreed compatibility; consequential contract changes require a human decision.
7. Verify the requested behavior on the relevant surface, including material failure paths and regressions. Choose checks that exercise the user's result. Build or type checks alone cannot establish an interaction they never drive.
8. Inspect the resulting diff and evidence. If a needed surface or check is unavailable, state what remains unproven. Implementation self-checks do not commission or replace a fresh Workflow Review.

## Result

Explain what was built, the important design choice and why it fits, observed behavior, and verification limits. Include sequencing or shared-state decisions only where they help assess the result. Keep open consequential decisions visible. Commit organization, PRs, and delivery are separate assignments.
