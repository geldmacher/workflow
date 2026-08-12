# Evidence Schema 5

The deterministic builder derives `delivery-evidence.intent_hash` from the exact Root projection, including lineage. Lifecycle hooks are the default Manual caller; `workflow_closeout` is optional compatibility. Callers provide observations, never identity, hashes, topology, mode, aggregate grade, or status. Evidence declares `evidence_mode: lean|full`, covers objectives/Checks, and lists host-attested `changed_paths`. Grades are `verified|supported|partial|unavailable|failed`; review never raises them. Any failed Check makes Evidence blocked, not achieved/provisional.

Manual low/medium risk without Hard Triggers uses `lean`; Manual high risk/Hard Triggers, supervised, and autonomous use `full`. Every changed path must be inside Root Authority. Independent topology is `representation: full|delta`: initial Evidence is full; Correction is a delta bound to its review and prior Evidence tip.

Lean Evidence needs a meaningful `Summary` plus its closed machine core. Each Check needs `check_id`, grade, observed result, and limitations. `verified` also needs surface, method, expected result, and a repetition; `supported|partial` need method/expected; `unavailable` a concrete limitation; `failed` method/expected. Missing `strategy_revision` means `0`; missing `baseline_or_patched` means `patched`, without rewriting. Feature IDs/artifact hashes are optional, and `executed_checks` includes unavailable slots.

Full Evidence retains objective, change, repository snapshot, Check, resume, deviation, and operational proof. Each Check includes surface, method, baseline/patched state, expected/observed result, repetitions, artifact hashes, and limitations. Autonomous requires every required Check verified; supervised may be provisional only with no failed Check.

Task recipes bind baseline/patched comparison: bugfix repeats one surface; refactor uses characterization, snapshot, or equivalence; performance uses comparable traces and metrics; feature covers acceptance/regression; investigation is read-only; verify-existing compares baseline with the existing candidate without a competing fix.
