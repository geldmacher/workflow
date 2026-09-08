# prototype

Use an isolated, disposable experiment to settle a design or empirical decision cheaply. The deliverable is evidence and a recommendation, not production-ready code. A mutating prototype still needs an approved scope and matching execution instruction; choosing this method does not bypass planning permissions.

## Build the smallest useful experiment

1. Name the decision: a layout, interaction, density, observed behavior, timing, or technical approach. A request for an already-decided production behavior belongs to [feature](./feature.md).
2. Separate observable questions from product preferences. Investigate what a bounded experiment can settle; ask the human about consequential preferences that observation cannot decide. When the visual direction is open, gather useful references and agree the directions before building.
3. Use an isolated scratch location and the lightest suitable tools. A visual choice may need a small rendered page; a behavioral question may need only a script. Avoid production integration and unrelated infrastructure. External dependencies and live surfaces still follow host and project permissions.
4. When alternatives matter, make them easy to compare under the same conditions. Label variants and, where useful, place them behind a common switcher. Explore enough variation to answer the question without expanding beyond the agreed time or resource budget.
5. Observe the actual decision surface. Drive interactions and capture relevant states for visual options; record output or repeated timings for behavioral options. Verification should establish the decision, not simulate production readiness through unrelated test coverage.
6. Compare the evidence, tradeoffs, and uncertainty. If the experiment cannot distinguish the alternatives, explain why and what additional observation would help instead of declaring a winner.

## Result and transition

Present the variants, observations or screenshots, recommendation, and scratch artifact location. State the limits of the experiment and that the artifact is disposable. Carry the chosen direction into a separately commissioned production scope with its own verification. Reuse suitable work only after it is checked against those production requirements. Do not delete unrelated files or promote the prototype just to finish the task.
