---
name: handoff-executor
description: Execute the active Cursor handoff plan or the latest review-delivery improvement plan without replanning or broadening scope.
---

# Handoff Executor

## Goal

Treat the active handoff packet as the implementation scope. Implement it in order and stop instead of guessing when it is incomplete.

## Active Scope Priority

Resolve the packet to execute before changing files:

1. Use the latest `Recommended next handoff` from `review-delivery` when present. This is the improvement plan for the next loop iteration.
2. Otherwise use the current or attached Cursor plan artifact.
3. Ask the user to choose when multiple candidate packets are equally plausible.
4. Do not fall back to older plans unless the user explicitly selects them.

## Required Packet Sections

- `Intent and success condition`
- `Scope and non-goals`
- `Context packet`
- `Target files and symbols`
- `References to existing patterns`
- `Executable agent plan`
- `Verification`
- `Escalate instead of guessing when`
- `Open questions`

## Execution Rules

- Do not re-architect the work unless the packet asks for it.
- Do not touch files outside `Target files and symbols` unless a step explicitly permits it.
- Reuse cited patterns before inventing new ones.
- If a target, exact change, verification check, or stop condition is missing, ask for a tightened handoff.
- Treat each numbered item in `Executable agent plan` as one executable task.
- Run the verification named in the packet when possible.
- Recommend `review-delivery` when risk, scope, or uncertainty justifies it; do not make it mandatory by default.

## Cursor Actions

When available in Cursor:

- Mirror the numbered `Executable agent plan` steps as visible execution tasks and update their status as work proceeds.
- Use `AskQuestion` for missing execution-critical details.
- Request a mode switch, or use Cursor's mode-switch action when available, if the current mode prevents implementation.
- Use the selected existing plan artifact when it is the active scope; do not create a parallel plan unless the packet asks for one.

## Closeout

Keep the user-facing closeout short:

- what changed
- what verification ran
- whether delivery review is recommended and why
