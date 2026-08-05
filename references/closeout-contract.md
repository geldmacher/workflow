# Deterministic Closeout

`workflow_closeout` alone produces Schema-5 Evidence from an exact chain, profile, Strategy revision, changed paths, snapshot, and required-Check observations. Callers never choose identity, hashes, topology, mode, grade, or status.

The builder validates authority and the chain. Same inputs are idempotent; changed inputs, stale or competing topology, conflicts, missing Checks, or authority violations block.

`representation: full|delta` is topology; Correction is a delta bound to review and tip. `evidence_mode: lean|full` is detail: low/medium Manual without Hard Triggers is lean; otherwise full.

Artifact record/context is append-only transport, not authority. Persistence failure returns valid unpersisted Evidence plus attach instructions. On roots discovery failure, exact Root/chain may do so without filesystem/state access; supplied selectors are ignored and no workspace binding is declared. Missing Root/chain, redirect, drift, conflict, or a foreign selector with resolved Roots never falls back.
