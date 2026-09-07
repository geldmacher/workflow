# Project verification

Use project verifiers when user-observable acceptance needs a running UI, CLI, service, side-effect boundary, or journey beyond established checks. Reuse a maintained verifier under `.agents/skills/verify-*` when it fits; static work already covered by existing checks need not create one.

Doctor inspects without starting the product. Explain whether current verification is sufficient, a verifier is useful but absent, existing guidance has drifted, or missing access prevents a conclusion. These are explanations, not required status codes.

Before creating or maintaining a verifier, establish its product surface, destination, expected outcome, and the human implementation or correction instruction. Keep an existing suitable location. For a new verifier use the nearest surface-owning `.agents/skills/verify-<surface>/` directory. An ambiguous owner or broader scope requires a decision. Include only meaningful feature coverage; state what remains uncovered.

A usable verifier explains setup and launch, diagnosis, exercising behavior, expected observations and failure conditions, retained evidence, isolation, and cleanup. Organize these according to the product; only the host-required skill name and description are structural requirements. Concrete commands, selectors, data, and oracles must come from the repository. Do not leave placeholders or build a generic verification framework.

Prefer local, fake, test, or dry-run boundaries. Store transient results outside the repository during Review; other phases may use an established ignored evidence location if authorized. Never create or edit verifier files during Review. Cleanup may remove only resources created by the current exercise and must preserve useful evidence. Existing resources and concurrent work are not cleanup targets.

When an oracle fails, report the observed product behavior rather than changing the expected outcome to accept it. Verifier maintenance changes only its authorized surface. Stale guidance affecting acceptance is a review finding; unrelated drift is a future task. Recheck affected observations after product or verifier changes. A structural inspection cannot establish live behavior, and a runtime check proves only what it actually observed.
