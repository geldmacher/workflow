# Behavior tests

Use for meaningful requirements, boundary conditions or regressions without reliable tests. Skip implementation-mirroring assertions and tests for trivial prose changes. Inspect requirements, public interfaces, existing suites, fixtures and actual failures; current output alone is not the oracle.

## Build checks that can detect the defect

Choose the smallest test boundary that can observe the requirement, adding integration coverage when wiring or persistence matters. Assert outcomes and relevant side effects rather than private call sequences. Include representative normal, empty, boundary and error cases according to the contract; a larger case count is not itself quality.

Keep tests independent of execution order, ambient time, randomness and shared user data. Prefer real lightweight collaborators or maintained fakes when they preserve fidelity; use mocks at genuine external boundaries and document what they cannot prove. Avoid reimplementing the same algorithm to compute expected values. Failed assertions must fail the command, with enough context to reproduce the case.

Possible artifacts are tests in the existing suite, focused fixtures and existing runner configuration. For a CSV CLI, assert exact output and exit status for zero, one and multiple rows through a real subprocess. Library-only assertions cannot establish CLI wiring.

## Prove and maintain

Run the new tests and affected existing ones. Where useful, reproduce the defect or inject it in an isolated copy and establish that the test fails for the expected reason. Restore the copy without changing the agreed oracle. Maintenance follows approved behavior changes, obsolete fixtures and flakiness causes; do not replace a reliable failing expectation with the observed regression.
