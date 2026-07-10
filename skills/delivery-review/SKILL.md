---
name: delivery-review
description: Review completed work against the active handoff, acceptance criteria, actual diff, and verification evidence. Use after delegated or multi-step implementation.
---

# Delivery Review

## Goal

Check whether the delivered work matches the handoff, acceptance criteria, actual diff, and verification evidence. Start with gaps and risks.

## Review Inputs

- original user goal
- active handoff packet or explicit plan
- workspace baseline when available
- current diff, changed files, and untracked files
- tests, checks, screenshots, or command output
- delivery evidence and deviation log

Independently inspect the repository and diff when the current mode permits reading them. Treat the delivery summary and deviation log as claims to verify, not as substitutes for evidence. If evidence is missing, say so.

## Review Mode

- In Ask Mode, perform the review directly in the current chat so the selected model reviews the work.
- In a mode that can edit files, delegate to the `delivery-reviewer` agent. It is configured readonly and receives the complete review inputs.
- A delegated reviewer reports execution-critical clarification needs to the parent. The parent asks the user before producing another executable handoff.

## Output

Use this concise structure:

- **Verdict**: `fully achieved` | `mostly achieved` | `partially achieved` | `not achieved`
- **Acceptance criteria**: each AC with achieved, not achieved, or insufficient evidence
- **Findings**: gaps and risks first; each includes severity, affected ACs, file or symbol evidence, and reasoning
- **Scope and deviations**: approved, unapproved, undisclosed, or `none`
- **Missing validation**: required evidence not available
- **Recommended next handoff**: `none` or a compact executable improvement handoff packet

## Follow-Up Handoff

When follow-up work is useful, write `Recommended next handoff` as the improvement plan for the next `/execute-handoff` loop. It must be concise, concrete, model-agnostic, and executable without hidden context. Its metadata names source `review`, status `ready`, and the active handoff as predecessor.

Before emitting a `Recommended next handoff`, identify whether any execution-critical detail is missing. If the next improvement plan would require guessing about intent, scope, target files, exact changes, verification, risk, or stop conditions, use Cursor's interview tool (`AskQuestion`) when available. If `AskQuestion` is unavailable, set `Recommended next handoff` to `none` and list the needed clarification under findings or missing validation.

Use the canonical packet:

1. `Handoff metadata`
2. `Intent and acceptance criteria`
3. `Scope boundaries and non-goals`
4. `Repository evidence`
5. `Target files and symbols`
6. `Reference patterns`
7. `Executable agent plan`
8. `Verification matrix`
9. `Risk and deviation policy`
10. `Escalate instead of guessing when`
11. `Delivery evidence requirements`
12. `Open questions`

Each numbered item in `Executable agent plan` must include step ID, covered acceptance criteria, targets, exact change, key constraint, reference pattern when relevant, step-level verification, and deviation trigger.

If a useful follow-up cannot be written concretely enough for execution, set `Recommended next handoff` to `none` and list the missing information under findings or missing validation. Do not put execution-critical unresolved questions into `Open questions`; reserve that section for non-blocking follow-ups.

Delivery review is recommended by risk and usefulness, not required by default.
