# Evidence Schema 5

`workflow_closeout` derives `delivery-evidence.intent_hash` from the authoritative Root projection, lineage included. Callers provide observations, never identity, hashes, topology, mode, aggregate grade, or status. Evidence declares `evidence_mode: lean|full`, grades executed Checks, covers objectives/Checks, and lists `changed_paths`. Grades are `verified|supported|partial|unavailable|failed`; review never raises them. A failed Check requires blocked evidence, never achieved or provisional.

Manual low/medium-risk work without Hard Triggers uses `lean`. Manual high-risk or Hard-Trigger work, supervised, and autonomous use `full`. The validator checks every changed path against Root Authority.

`representation: full|delta` is topological and independent from proof detail. Initial Evidence uses `representation: full`; Correction Evidence uses `delta` and binds its source review plus prior Evidence tip. Therefore initial Manual Evidence can correctly combine `representation: full` with `evidence_mode: lean`.

Lean Evidence needs only a meaningful `Summary` body because its machine-readable core is closed frontmatter. Each Check needs `check_id`, `grade`, `observed`, and `limitations`. `verified` additionally needs surface, method, expected result, and at least one repetition; `supported|partial` need method and expected result; `unavailable` needs a concrete limitation; `failed` needs method and expected result. Missing `strategy_revision` is interpreted as `0`, and missing `baseline_or_patched` as `patched`, without rewriting the artifact. Feature IDs and artifact hashes are optional.

`executed_checks` includes unavailable observed slots.

Full Evidence retains objective, change, repository-snapshot, Check, resume, deviation, and operational proof. Every full Check includes surface, method, baseline/patched state, expected/observed result, repetitions, artifact hashes, and limitations. Autonomous requires verified evidence for every required Check; supervised may deliver provisional only when no Check failed.

Task recipes bind baseline and patched comparison: bugfix repeats the same surface twice; refactor uses characterization, snapshot, or equivalence proof; performance uses comparable traces and explicit metrics; feature covers acceptance and regression; investigation is read-only; verify-existing compares baseline and the existing candidate without creating a competing fix.
