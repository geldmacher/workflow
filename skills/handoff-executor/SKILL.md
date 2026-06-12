---
name: handoff-executor
description: Execute an existing handoff packet without replanning or broadening scope. Use when the user provides a compiled handoff and wants implementation.
---

# Handoff Executor

## Goal

Treat the latest handoff packet as the active scope. Implement it in order and stop instead of guessing when it is incomplete.

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
- Run the verification named in the packet when possible.
- Recommend `review-delivery` when risk, scope, or uncertainty justifies it; do not make it mandatory by default.

## Cursor Actions

When available in Cursor:

- Use `AskQuestion` for missing execution-critical details.
- Request a mode switch, or use Cursor's mode-switch action when available, if the current mode prevents implementation.
- Use the existing plan artifact only when the packet explicitly references it; otherwise do not create a parallel plan.

## Closeout

Keep the user-facing closeout short:

- what changed
- what verification ran
- whether delivery review is recommended and why
