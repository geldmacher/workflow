# Run authorization contract

The three profiles share schema-3 roots, checks, evidence semantics, review decisions, and derived state. Schema-2 roots and mixed chains are rejected before authorization. They differ only in authorization:

| Profile | Planned human gates | Execution boundary |
|---|---|---|
| `manual` | Plan, implementation, each correction | Cursor-selected modes and commands |
| `auto-gated` | Root, declared slice gates, final local delivery, exceptions | One isolated local run branch |
| `unattended-eligible` | Root, then no planned gates | Only after computed eligibility; one isolated local run branch |

An approved Run requires one active Run, exact validated routes, verified hard SDK write and CreatePlan boundaries, verified worker-network and SDK-secret isolation, closed budgets, and project opt-in. A missing capability keeps the controller in read-only Shadow Mode. `unattended-eligible` may be downgraded to `auto-gated`, but the downgraded Run waits for separate approval.

Only Writer routes (`writer`, `writer_escalated`) are writable; Planner, Reviewer, and Explainer are read-only. Model prompts and receipts bind the frozen, extension-free Root projection. Host Checks use direct argv without a shell. Controller state and SDK records stay outside the repository. Mutations require current `expected_revision` plus unique `idempotency_key`. Preparations accept only `stop`; Run approval only a declared Slice gate or visible downgrade. Control never expands Root scope, risk, dependencies, effects, delivery, or budgets. `waiting-human` is a stop, never a waiver.

Dependency changes default to `deny`. Auto-gated roots may use the intersection of explicit project/root dependency allow-lists; unsupported or lock-only changes remain unknown and stop. Unattended eligibility always requires dependency denial.

The controller never pushes, opens a PR, merges, deploys, learns automatically, or treats longitudinal metrics as proof. Pause and stop are safety requests; an in-flight SDK operation may end as `interrupted` and always needs explicit reconciliation before resume.

Runs freeze record schema 1, artifact schema 3, controller protocol 3, and plugin version. Earlier Runs remain status/watch-readable but are terminal read-only, cannot block a new Run, and never count as qualifying history.
