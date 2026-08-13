# Evidence Schema 5

The builder derives `delivery-evidence.intent_hash` from the exact Root projection and lineage. Lifecycle hooks are Manual's default caller; `workflow_closeout` is optional. Callers supply observations, never identity, hashes, topology, mode, aggregate grade, or status. Evidence declares `evidence_mode: lean|full`, covers objectives/Checks, and lists host-attested `changed_paths`. Grades: `verified|supported|partial|unavailable|failed`; review never raises them. Any failed Check blocks.

Low/medium-risk Manual without Hard Triggers uses `lean`; high-risk/triggered Manual, supervised, and autonomous use `full`. Paths stay in Root Authority. `representation: full|delta`: initial Evidence is full; Correction is a delta bound to its review and prior tip.

Lean needs a meaningful `Summary` and closed machine core. Each Check has ID, grade, observed result, limitations. `verified` adds surface/method/expected/repetition; `supported|partial` method/expected; `unavailable` a concrete limit; `failed` method/expected. Defaults: `strategy_revision:0`, `baseline_or_patched:patched`, without rewriting. Feature IDs/hashes are optional; `executed_checks` includes unavailable slots.

Full retains objective, change, snapshot, Check, resume, deviation, and operational proof. Checks include surface, method, baseline/patched state, expected/observed result, repetitions, hashes, limitations. Autonomous requires every required Check verified; supervised is provisional only without failures.

Recipes bind baseline/patched comparison: bugfix repeats one surface; refactor uses characterization/snapshot/equivalence; performance comparable traces/metrics; feature acceptance/regression; investigation read-only; verify-existing compares baseline with the existing candidate, without a competing fix.
