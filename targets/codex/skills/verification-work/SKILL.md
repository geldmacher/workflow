---
name: verification-work
description: Inspect, create, or maintain one project-local behavioral verifier within an approved Workflow implementation or correction boundary.
---

# $verification-work

Read the [project verification contract](../../references/verification-work-contract.md) completely. For Create or Maintenance also read the [project verifier template](../../references/project-verifier-template.md).

Accept `inspect` by default, `create`, `maintain`, or the explicit full-map form `maintain full`.

`inspect` is repository-read-only and uses the Doctor status contract. Before `create` or either Maintenance form, require one exact approved Schema-6 Root, matching human implementation or correction authorization, and path authority for the exact `.agents/skills/verify-<surface-slug>` directory. New dependencies, protected paths, product-code changes, external effects, or a broader surface are Open Points, not implicit permission.

Choose the nearest unambiguous product-surface owner and materialize one focused verifier with concrete repository-grounded commands, selectors, oracles, helpers, isolation, evidence, and cleanup. Initial Create covers the current scope and at most three to five high-value features. Leave no template markers. Validate the structure, then run Doctor and Drive for at least one mapped feature through the active project harness.

Default `maintain` inspects and drives only features affected by the Root or repository delta. `maintain full` covers the entire map. Change only the verifier directory and never edit an oracle to hide a product regression. Preserve evidence while cleaning only resources created by the run.

Return exactly `clean`, `changed`, or `blocked` with paths, exercised features, observations, and limitations. `changed` ends with fresh Review pending. Never claim `verified`, reuse stale evidence for a new snapshot, or commit, push, open a PR, merge, deploy, publish, install, access production, or persist Learning.
