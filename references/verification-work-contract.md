# Project verification contract

Project verification is non-authoritative harness guidance. Workflow may expose readiness, authorize repository paths, and consume current observations, but it never chooses or interprets project commands, tools, frameworks, models, browsers, services, retries, or runners.

## Readiness

Apply this contract when acceptance needs behavior from a running UI, CLI, service, side-effect boundary, or cross-surface journey that existing repository checks do not already prove. Pure documentation, static inspection, or work already covered by a maintained deterministic check is `not-applicable`.

Evaluate in this order and return exactly one status:

| Priority | Condition | Status |
|---|---|---|
| 1 | No applicable behavioral surface exists. | `not-applicable` |
| 2 | The relevant surface, safe harness boundary, or authorized destination cannot be determined unambiguously. | `blocked` |
| 3 | An applicable surface has no project verifier. | `create-recommended` |
| 4 | A verifier exists but its contract, feature map, commands, selectors, oracle, cleanup, or current-scope coverage has drifted. | `maintenance-recommended` |
| 5 | The verifier is structurally complete and covers the relevant current behavior. | `ready` |

A Doctor inspection is repository-read-only. It may inspect source, manifests, tests, harness documentation, ignored evidence conventions, and `.agents/skills/verify-*`. It must not start an application, change files, create Workflow artifacts, assign an evidence grade, or claim runtime success. Report status, concrete cause, inspected evidence, impact, and one suggested follow-up.

## Phase and authority boundary

- Planning may inspect readiness and add one concise non-authoritative note. If Create or Maintenance is needed during implementation, the human plan and Authority Core must cover the exact verifier surface and expected outcome. Readiness is not a second playbook choice or human gate and never enters a Workflow extension.
- Implementation or Correction may run Create or Maintenance only with an exact approved Schema-6 Root, the matching human phase authorization, and path authority for the verifier directory. A new dependency, protected path, external effect, product-code change, or broader surface is an Open Point.
- Review may use an existing verifier's Drive as a project-harness recipe while remaining repository-read-only. Review never repairs the verifier. A Root-relevant stale verifier is a Finding; other drift is an Open Point.
- Learning may classify verifier drift as a future Maintenance candidate. It never edits a verifier. Stable general guidance still requires explicit Learning authorization; run-specific observations remain evidence only.

## Project verifier shape

Place one focused verifier at the nearest directory that owns the named product surface:

```text
.agents/skills/verify-<surface-slug>/
|-- SKILL.md
`-- features/
    `-- README.md
```

Use the smallest directory that owns the surface's runtime entry point and harness configuration. Derive `<surface-slug>` from a stable package, application, or product identity using lowercase letters, digits, and hyphens. If more than one in-scope surface is equally plausible, stop for a human choice.

The generated `SKILL.md` must have matching `name` and directory names, a precise discovery description, and the sections Launch, Doctor, Drive, Evidence, Cleanup, Isolation, and Helpers. The feature map must define each feature's stable ID, user-observable goal, setup, drive path, oracle, evidence, and cleanup. Initial creation covers the current scope plus at most three to five highest-value features and states the remaining coverage boundary.

Commands, selectors, paths, or oracles must be concrete and repository-grounded. Never leave placeholders in a generated verifier. Prefer existing project harnesses. If a required fact cannot be discovered, return `blocked` instead of inventing it.

Evidence belongs outside the repository or in an already established ignored project location and must survive Cleanup. Cleanup may stop or remove only resources created by the current run, using captured identifiers rather than process-name matching. Use local, test, fake, or dry-run boundaries; production and irreversible external effects require separate authority and are not verifier defaults.

## Create and Maintain

Create inspects the product surface and existing harness before materializing the project verifier template loaded by `verification-work`. Validate the generated structure, then run Doctor and Drive for at least one mapped feature. A broken baseline is reported; it is not repaired unless the Root separately authorizes that product change.

Maintain first compares the current product, harness, feature map, and requested scope. Default Maintenance updates and drives only impacted features. `maintain full` is the explicit full-map variant. Maintenance changes only the verifier directory; a product regression yields `blocked` instead of changing the oracle to accept it.

Return exactly one outcome:

- `clean`: no verifier file changed and current targeted inspection passed.
- `changed`: verifier files changed, the affected Drive was rerun, and fresh Review is pending.
- `blocked`: a named ambiguity, baseline failure, product regression, or authority boundary prevents completion.

No action commits, pushes, opens a PR, merges, deploys, publishes, installs, accesses production, or persists Learning. Evidence from before a verifier or repository snapshot change never proves the new snapshot retroactively. Protected `verified` evidence still requires the exact Workflow Root, verification intent, workspace, snapshot, and harness attestation binding.
