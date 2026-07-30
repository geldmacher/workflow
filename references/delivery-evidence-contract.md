# Evidence Schema 4

Each `delivery-evidence` links the Intent hash and Strategy revision. Every Check entry records `grade`, surface, feature/check ID, method, baseline or patched state, expected and observed result, repetitions, artifact hashes, and limitations.

Grades are `verified|supported|partial|unavailable|failed`. Autonomous requires verified evidence for every required Check. Supervised may deliver provisional only when no Check is failed. A known failed Check always blocks. Reviewer opinion cannot raise a grade.

Task recipes bind baseline and patched comparison: bugfix repeats the same surface twice; refactor uses characterization, snapshot, or equivalence proof; performance uses comparable traces and explicit metrics; feature covers acceptance and regression; investigation is read-only; verify-existing compares baseline and the existing candidate without creating a competing fix.
