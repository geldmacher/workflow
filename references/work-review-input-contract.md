# Work Review semantic input

The reviewer supplies one closed Schema-1 input with `outcome`, `assessment_summary`, `snapshot_summary`, `findings`, `open_points`, and an optional `correction`.

Findings contain semantic key, severity, original Objective IDs, original Check IDs, evidence, reasoning, and resolution `correct|open`. Open Points contain semantic key, type `evidence|authority|intent|environment|formal-binding|no-progress`, summary, evidence, impact, and one human question.

`correction-needed` requires at least one `correct` Finding and one complete Correction. Every correctable Finding is covered by a fix and every fix by a step. Steps use bounded targets, outcome, implementation latitude, non-authoritative completion probe, original `root_check_ids`, and deviation action. No correction-specific Checks exist.

`open-points` requires at least one Open Point and no pending correctable Finding. `achieved` permits no Finding, Open Point, or Correction. The deterministic final precedence is correctable Finding, then Open Points, then finding-free required Checks at least supported.

The reviewer authors no IDs, hashes, receipts, attestations, evidence grades, or lineage and prescribes no concrete command, tool, model, framework, sandbox, worktree, route, or retry recipe.
