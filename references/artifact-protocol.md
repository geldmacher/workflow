# Artifact protocol

Schema 6 is the only supported Workflow contract: immutable `work-plan`, `delivery-evidence`, and fresh `work-review`. Every other artifact schema is rejected and grants no transition.

The Root fixes intent, acceptance, constraints, authority, risk, budgets, and profile. Verification is intent-only: `Check ID | Objectives | Verification Intent | Expected Evidence | Required | Evidence Class | Cost Class | Prerequisites`. Lineage is exact and content-bound. Review consumes exact Root and Evidence bytes.

Evidence separates subject `changed_paths` from visible non-delivery `ambient_paths`. Finding-free supported Review may be achieved while proof stays provisional; only protected attestation yields verified. Transport, presentation, trace, and harness internals grant no authority. Workflow builds IDs and artifacts from closed input; unknown authority fails closed and `extensions` stays opaque.
