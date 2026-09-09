# visual-parity

Use to match a fixed visual reference or preserve appearance during a UI or styling migration. Changes require the applicable plan and execution instruction. A parity claim needs a comparison against the agreed baseline; visual inspection alone proves only what was observed.

## Bind the reference, then compare

1. Establish the baseline before changing the implementation. Identify the reference version, relevant components, states, viewport sizes, and rendering conditions. Stabilize fonts, data, animation, and timing where they would otherwise introduce unrelated variation.
2. Establish the image comparison procedure and acceptance tolerance. Use zero difference when exact pixel equivalence is commissioned; otherwise apply the explicitly agreed tolerance. A missing baseline or unresolved consequential tolerance prevents a parity claim.
3. Keep reference images and the comparison criteria fixed during the attempt. Do not update snapshots, hide mismatches, or restructure components to game the comparison. If the baseline appears wrong or the harness needs a material correction, surface the decision; establish an approved replacement baseline before drawing new conclusions.
4. Migrate shared primitives before their dependent components. Work in independently verifiable units and account for shared state. Any collaboration and isolation mechanisms belong to the executor and host.
5. Capture each unit on the matching surface and compare all relevant states against its baseline. Investigate mismatches, including layout, typography, interaction state, and rendering noise. An unexplained difference outside tolerance is a failure, not a cosmetic exception.
6. Repeat correction and comparison within the authorized scope and budget. Complete the applicable interaction and regression checks as well; a matching static image does not prove behavior. If the environment cannot reproduce the rendering conditions, report the limitation instead of declaring equivalence.

## Result

Report the units and states compared, reference and comparison artifact locations, actual differences against tolerance, interaction checks, and remaining work. Do not change the acceptance standard or start an unbounded loop to turn a failing comparison into success.
