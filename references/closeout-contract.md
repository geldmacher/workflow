# Deterministic Closeout

`workflow_closeout` alone produces Schema-5 Evidence. Callers provide exact chain, profile, Strategy revision, changed paths, snapshot, and one observation per required Check. They never choose identity, `intent_hash`, bindings, representation, mode, grade, or status.

The builder validates authority and the complete candidate chain. Same inputs are idempotent. A current tip returns byte-for-byte; changed inputs, stale topology, competing closeouts, conflicts, missing Checks, or authority violations block.

`representation: full|delta` describes topology: initial delivery is full; Correction Evidence is a delta bound to review and prior tip. `evidence_mode: lean|full` describes detail: Manual, `profile_max: manual`, low/medium risk, and no Hard Trigger is lean; otherwise full. Initial Evidence may be full representation with lean mode.

`workflow_artifact_record` caches exact Roots/reviews; `workflow_artifact_context` returns the revalidated, optionally Plan-bound chain. This append-only transport grants no authority and has no automatic cleanup. Persistence failure still returns valid Evidence with `handoff_persisted: false` and an attach instruction; semantic conflict never does.
