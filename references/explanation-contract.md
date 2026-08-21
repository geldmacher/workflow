# Work explanation

`/explain-work [wp-id]` is a read-only, chat-only refresh, never success evidence, review, approval, or learning closeout. Every completed review and reviewed controller handoff uses the same shape directly; no extra explainer phase/model call.

Resolve by exact current-task artifact bytes, never filename, cache, or legacy Manual state. Only without a Manual Plan may an explicitly selected controller Run use its own stored artifacts. Require a complete Schema-5 chain. Workflow-3/4 is read-only history; mixed/invalid chains are incompatible. `extensions` remains opaque audit metadata, excluded from explanations and explainer handoffs.

Only derived `achieved` is **Final repository explanation**; otherwise use **Preliminary explanation**, blockers, and next safe action. Follow [human-first Workflow output](./human-output-contract.md) in this order:

1. `Quick decision`: result, Check summary, blocker when present, and one action.
2. `Details`: `What was achieved` as plain intent and outcome, `What this means`, and `Verification and limits` in plain language.
3. `Agent and machine contract`: `Technical traceability` with architecture/control/data flow, change map, decisions, invariants, future changes, exact Workflow/Check/Finding IDs, paths/symbols, and continuation data.

The two human layers stand alone for someone who missed implementation. The last layer separates executor claims from inspected evidence, keeps unknowns explicit, and is authoritative for continuing agents. Persist nothing without separate authorization.
