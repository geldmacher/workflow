# AGENTS.md

## Workflow Roles

Treat `planner`, `executor`, `reviewer`, and `user` as model-agnostic roles. Do not encode model strength, speed, vendor, or capability into the workflow.

The typical split is:

1. A planner compiles the handoff into a durable Cursor plan artifact.
2. An executor implements that plan without broadening scope.
3. A readonly reviewer checks delivery when risk justifies it.
4. When review finds useful follow-up work, it emits a compile-compatible `Recommended next handoff`.
5. `/execute-handoff` treats that improvement plan as the preferred scope for the next loop.

Because the roles stay model-agnostic, any assignment works.

## Clarification Gate

Every initial handoff and review-generated improvement handoff must pass a clarification gate before it is emitted.

- If execution-critical details are missing, use Cursor's interview tool (`AskQuestion`) when available.
- If `AskQuestion` is unavailable, ask targeted questions in chat and stop before emitting the handoff.
- Do not emit an executable plan with unresolved execution-critical questions.
- Keep `Open questions` limited to non-blocking follow-ups.

Execution-critical details include intent, scope, target files or symbols, exact edits, verification, and stop conditions.

## Handoff Packet

All handoff plan artifacts use the same packet as their body:

1. `Intent and success condition`
2. `Scope and non-goals`
3. `Context packet`
4. `Target files and symbols`
5. `References to existing patterns`
6. `Executable agent plan`
7. `Verification`
8. `Escalate instead of guessing when`
9. `Open questions`

The canonical definition lives in `rules/handoff-quality.mdc`; keep all other copies in sync with it. The rule defines the packet content, while the `compile-handoff` command and `handoff-plan-compiler` skill define Cursor's default delivery surface: a normal plan artifact.

Every `Recommended next handoff` from delivery review must use the same packet format and executable step quality as a compiled handoff, so it can become the next `/execute-handoff` scope without reinterpretation.

`Open questions` is for non-blocking follow-ups only. Anything that would change intent, scope, targets, exact edits, verification, or stop conditions must be clarified before the plan is emitted.

## Execution Rules

- Prefer one concise handoff packet over a long narrative.
- A handoff is ready only when it names concrete targets, exact changes, verification, and stop conditions.
- The executor must not broaden scope, invent adjacent refactors, or reinterpret the goal when the packet is incomplete.
- The executor must stop and ask for a tightened handoff when execution-critical details are missing.
- When Cursor exposes task or plan progress UI, mirror each numbered item in `Executable agent plan` as visible execution progress.
- Delivery review is risk-based and recommended when useful; it is not mandatory by default.
- Keep output short by default. Add detail only when it reduces execution ambiguity.

## Step Quality

Each numbered item in `Executable agent plan` must include:

- target files or symbols
- exact change
- key constraint or non-goal
- reference pattern, if any
- verification check
- escalation trigger
