# Deterministic Closeout

`workflow_closeout` is the only Schema-5 delivery-evidence producer. Callers provide exact Root/chain text and observations only: effective profile, Strategy revision, changed paths, repository snapshot, and one structured entry per required Check. They never choose Evidence identity, `intent_hash`, predecessor/source bindings, `representation`, `evidence_mode`, aggregate grade, or status.

The builder validates Root authority and the complete candidate chain before returning any artifact. Same inputs are idempotent. A current Evidence tip is returned byte-for-byte; changed inputs against that tip, stale topology, competing closeouts, conflicting hashes, missing required Checks, and authority violations block.

`representation` and `evidence_mode` are independent. `representation: full|delta` describes chain topology: an initial Root delivery is full; Correction Evidence is a delta bound to the source review and prior Evidence tip. `evidence_mode: lean|full` describes proof detail: effective Manual with `profile_max: manual`, low/medium risk, and no Hard Trigger is lean; all other cases are full. Initial Manual Evidence may therefore be `representation: full` with `evidence_mode: lean`.

`workflow_artifact_record` stores validated exact Schema-5 Roots and reviews. `workflow_artifact_context` returns the revalidated chain and may bind it to active Plan text. The repository-specific append-only cache is non-authoritative transport: it creates no Run, approval, acceptance, qualification, or Learning, and has no automatic cleanup. If persistence alone fails, `workflow_closeout` still returns the valid artifact with `handoff_persisted: false` and an explicit attach instruction. Semantic conflicts never produce Evidence.
