# Artifact protocol

Schema 6 is the only supported Workflow contract. It defines immutable `work-plan` Roots, `delivery-evidence`, and fresh host-built `work-review` artifacts. Every other artifact schema is rejected generically and cannot be read, explained, converted, resumed, accepted, or used for a transition.

The Root fixes intent, acceptance, constraints, authority, risk, budgets, and profile. Its verification contract is intent-only: `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`. Lineage is exact, linear, and content-bound. Evidence reports only Check ID, grade, observation, evidence hashes, limitations, and an optional protected harness-attestation hash. Review consumes exact Root and Evidence bytes.

Transport, cache, presentation, opaque trace, and harness internals never grant authority. New review IDs, correction IDs, and serialized artifacts are built by Workflow from closed semantic input. Unknown authoritative fields fail closed; `extensions` is the only opaque trace surface and is never interpreted as authority.
