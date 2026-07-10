---
name: handoff-executor
description: Execute the active Cursor handoff plan with verified preflight, step checks, and controlled deviations.
---

# Handoff Executor

## Goal

Treat the active handoff packet as the implementation scope. Implement it in order, prove each required result, and stop instead of guessing when it is incomplete.

## Active Scope Priority

Resolve the packet to execute before changing files:

1. Use a ready `Recommended next handoff` from `review-delivery` only when its metadata explicitly names the active handoff as its predecessor.
2. Otherwise use the current or attached Cursor plan artifact.
3. Ask the user to choose when multiple candidate packets are equally plausible.
4. Do not select a packet whose metadata, targets, or acceptance criteria cannot be confirmed.

## Required Packet Sections

- `Handoff metadata`
- `Intent and acceptance criteria`
- `Scope boundaries and non-goals`
- `Repository evidence`
- `Target files and symbols`
- `Reference patterns`
- `Executable agent plan`
- `Verification matrix`
- `Risk and deviation policy`
- `Escalate instead of guessing when`
- `Delivery evidence requirements`
- `Open questions`

Do not change files until every required section is present and execution-critical details are concrete.

## Preflight

Before editing:

1. Read the applicable project instructions and cited reference patterns.
2. Capture the current workspace baseline: HEAD when available, dirty files, and known pre-existing failures.
3. Confirm that must-modify targets, symbols, and required checks still exist.
4. Confirm that each acceptance criterion has an implementation step and a verification entry.
5. Stop and request a tightened handoff when the packet, baseline, targets, or verification cannot be confirmed.

## Execution Rules

- Do not re-architect the work unless the packet asks for it.
- Respect the `must modify`, `may modify`, `generated or incidental`, and `must not modify` target boundaries.
- Reuse cited patterns before inventing new ones.
- If a target, exact change, verification check, or stop condition is missing, ask for a tightened handoff.
- Treat each numbered item in `Executable agent plan` as one executable task.
- For each step: read the cited context, implement the exact change, inspect the resulting diff, run the step-level check, and record completion only after the check succeeds.
- Run every required verification matrix entry. If its required evidence cannot be produced, stop and report the blocker.
- Recommend `review-delivery` when risk, scope, or uncertainty justifies it; do not make it mandatory by default.

## Deviations

Before any unplanned change, apply `Risk and deviation policy`.

- Only changes explicitly permitted by the packet may proceed without a question.
- For a change that requires approval, use `AskQuestion` before editing. State the planned behavior, discovered constraint, proposed change, affected files, and verification impact.
- For a change that requires a tightened handoff, stop before editing.
- Record every approved or permitted deviation in the required deviation log. State `none` when there were no deviations.

## Final Reconciliation

Before closeout:

1. Compare the final diff with the target boundaries.
2. Confirm every acceptance criterion against its verification evidence.
3. Confirm every required verification entry has an observed result.
4. Complete the delivery evidence and deviation log required by the packet.

## Cursor Actions

When available in Cursor:

- Mirror the numbered `Executable agent plan` steps as visible execution tasks and update their status as work proceeds.
- Use `AskQuestion` for missing execution-critical details or approval-required deviations.
- Request a mode switch, or use Cursor's mode-switch action when available, if the current mode prevents implementation.
- Use the selected existing plan artifact when it is the active scope; do not create a parallel plan unless the packet asks for one.

## Closeout

Keep the user-facing closeout short and evidence-based:

- `Delivery summary`
- `Verification evidence`
- `Deviation log`
- `Residual risks and skipped validation`
- `Review recommendation`
