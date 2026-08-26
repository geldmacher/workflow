# Delivery engineering playbooks

Every mutating entry requires an approved Schema-6 Root and implementation authority. The project harness chooses all concrete execution. Each claim is limited to the Root's verification intent and available evidence.

## `bug-fix`

Reproduce the symptom on the relevant surface, narrow competing causes, confirm the surviving mechanism, make the smallest Root-authorized correction, and prove the original reproduction no longer fails. Unreproduced or wrong-surface results remain inconclusive; speculative guards do not count as a fix.

## `feature`

Ground the affected contract, choose the domain shape before scattered logic, identify independent and shared work, implement within Root authority, and verify the requested behavior plus material boundaries. Design alternatives remain human-readable trace, not Root extensions.

## `refactoring`

Pin current behavior with a characterization or equivalence surface, name the target structure, subtract redundant structure first, migrate callers and remove the superseded path in the same authorized wave, and prove behavior remains equivalent. Newly discovered behavior changes route to a separate bug-fix or feature decision.

## `performance`

Capture a representative baseline, use measurement to select the dominant cost, change only the mechanism supported by that evidence, capture the comparable post-change result, and report baseline, result, delta, and noise limitation. Source inspection alone cannot prove improvement.

## `hillclimb`

Fix one metric, direction, representative workload, budget, regression floor, and checkable stop predicate before iteration. Freeze a sensitive measurement surface. For each hypothesis, make one bounded change, measure, retain only a result beyond noise with green guardrails, otherwise revert it. Stop at the predicate, exhausted budget, or a justified marginal-return boundary without relaxing success criteria.

## `prototype`

Name the decision first, build only the smallest isolated disposable artifact needed to observe alternatives, compare them on the relevant surface, and return evidence, tradeoffs, and a recommendation. The artifact is never delivery, cannot satisfy Root acceptance, and must be rebuilt through `feature` if selected.

## `visual-parity`

Bind an immutable reference before change, forbid reference or comparison tampering, change one independently verifiable unit at a time, and let the harness choose the visual comparison. Any non-accepted difference remains a failure or an explicit human decision; visual inspection alone cannot upgrade evidence.

## `skill-authoring`

Keep discovery precise, load detail progressively, preserve user scope and authorization, validate frontmatter and links, and test structural behavior where it matters. Agent prose earns its place by changing a decision. Do not add unrelated permissions, installation, or publication.

## `evaluation`

Fix the behavior under study and a small concrete rubric, give each candidate the same organic task without evaluation cues, keep candidate identity hidden from the judge, and compare all outputs on one scale. The harness chooses candidates, models, environments, and execution. Inspect actual outputs and traces rather than self-reports; results inform a human decision and never become Workflow authority by themselves.
