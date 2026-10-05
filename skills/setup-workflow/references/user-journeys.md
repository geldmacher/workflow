# User journeys

Use when acceptance depends on a real UI, CLI, HTTP service or observable side effect beyond established checks. Reuse adequate journey coverage. Inspect real routes, accessible UI handles, launch commands, readiness, authentication, test data and existing harnesses before choosing a driver.

## Exercise the actual path

Begin at the user's entrypoint and assert the visible result plus relevant state changes. In a UI, prefer roles, labels or explicit stable test contracts over incidental DOM structure. Wait for observable readiness or outcomes with bounded retries instead of fixed sleeps. For a CLI, capture arguments, stdout, stderr and exit status; for HTTP, check meaningful response content and effects rather than status alone.

Control external services and state where possible, naming the boundary a fake cannot prove. Keep failures diagnosable through the actual sequence and relevant traces, screenshots or logs. Retries must not turn persistent failures into a pass or repeat irreversible effects. Restrict browsers/devices to the project's acceptance needs.

Possible artifacts are focused browser/CLI/service tests and reusable instructions. A TYPO3 navigation check can open a known content page, follow the rendered menu and assert the destination heading using controlled content. It needs the actual project URL and fixture, not a copied generic selector.

For a reusable project verifier, use [verification-work](../../verification-work/SKILL.md) with purpose, destination, coverage and closing trial. This entry guides the journey choice; the verifier owns its launch/drive/evidence/cleanup recipes.

## Prove and maintain

Exercise the configured route end to end; verify a representative broken route or missing result is detected in isolation where useful. Retain evidence after cleanup. Maintenance traces changed routes, selectors, readiness and side effects to approved requirements, distinguishing a stale driver from a product regression.
