---
name: delivery-review
description: Review completed work against the original intent, handoff packet, and verification evidence. Use after delegated or multi-step implementation.
---

# Delivery Review

## Goal

Check whether the delivered work matches intent and evidence. Start with gaps and risks.

## Review Inputs

- original user goal
- handoff packet or explicit plan
- actual changed files or artifacts
- tests, checks, screenshots, or command output
- known deviations or skipped validation

If evidence is missing, say so.

## Readonly Delegation

Always delegate this review to the `delivery-reviewer` agent instead of reviewing inline. The reviewer is configured readonly and should receive the review inputs above. If delegation is unavailable, report that blocker instead of performing the delivery review inline.

## Output

Use this concise structure:

- **Verdict**: `fully achieved` | `mostly achieved` | `partially achieved` | `not achieved`
- **Matches intent**: evidence-backed bullets
- **Gaps or risks**: specific bullets
- **Deviations**: justified, unjustified, or `none`
- **Missing validation**: checks not run or evidence not available
- **Recommended next handoff**: `none` or a compact compile-compatible improvement handoff packet

## Follow-Up Handoff

When follow-up work is useful, write `Recommended next handoff` as the improvement plan for the next `/execute-handoff` loop. It must meet the same execution standard as a `/compile-handoff` output: concise, concrete, model-agnostic, and executable without hidden context.

Use the canonical packet:

1. `Intent and success condition`
2. `Scope and non-goals`
3. `Context packet`
4. `Target files and symbols`
5. `References to existing patterns`
6. `Executable agent plan`
7. `Verification`
8. `Escalate instead of guessing when`
9. `Open questions`

Each numbered item in `Executable agent plan` must include:

- target files or symbols
- exact change
- key constraint or non-goal
- reference pattern, if any
- verification check
- escalation trigger

If a useful follow-up cannot be written concretely enough for execution, set `Recommended next handoff` to `none` and list the missing information under gaps, risks, or missing validation.

Delivery review is recommended by risk and usefulness, not required by default.
