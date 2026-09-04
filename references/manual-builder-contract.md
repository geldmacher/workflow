# Stateless Manual builder contract

`dist/manual-workflow.mjs` is the host-neutral local construction boundary. It requires Node.js 22, reads one closed JSON object from standard input, writes one deterministic JSON result, performs no repository discovery or mutation, runs no Check or tool, and persists no state.

## Operations

- `build-plan` accepts `plan_markdown` and a closed `authority_core` input. It generates the content/Core hashes and returns one native plan with exactly one expandable `yaml workflow-authority` block.
- `validate-plan` validates the generated Core, both hashes, Schema-6 semantics, and authority. It does not validate editorial plan structure.
- `build-review` accepts the exact Root and predecessors, closed semantic Review input, one repository observation, and Check observations. It returns one atomic Evidence/Review pair, an internal retry, or Shadow.
- `status` derives the human-relevant state only from exact Root and artifact bytes.

Every request is Schema 1 and may use `presentation_locale: de|en`; locale affects presentation only. Unknown fields and earlier public operations or artifact formats are rejected as unsupported.

## Observations and recovery

Repository observation contains canonical repository root, complete disjoint subject/ambient changed paths, opaque snapshot material, and explicit limitations. Uncertainty is subject. Each supplied Check observation contains original Check ID, `supported|partial|unavailable|failed`, observed result, evidence material, and limitations. The builder creates hashes and caps unprotected proof below verified.

All required Checks need explicit observations. Missing entries return `manual-review-internal-retry`, exact `missing_check_ids`, a stable `retry_signature`, and no artifacts. Explicit partial, unavailable, or failed required observations appear as concrete Open Points unless a correctable Finding takes outcome precedence.

Malformed formal binding during `build-review` returns `manual-shadow-review`: supplied Findings and Open Points remain visible, a formal-binding point is added, no artifacts are emitted, and Correct Work is unavailable.

## Human output and authority

The first layer names the repository result, required-Check summary, deviations, scope, proof quality, and one next human action. Findings and Open Points appear only when present. Human Details contain concise Check observations without evidence hashes, distinct additional limitations, and exceptional path categories; fully allowed paths remain a count. IDs, hashes, schemas, attestations, and proof metadata remain in the structured result and exact artifacts instead of competing with the human decision. Review actions are only `none`, `correct`, and `human-assessment`; internal retry is not a human gate.

Subject paths outside Root authority become Authority Open Points and receive no correction authority. Ambient paths remain visible and non-blocking. Protected, approval-required, malformed, overlapping, or escaping paths never gain authority. Optional protected sealing may append stronger Evidence but does not change the three Review outcomes or edit existing artifacts.
