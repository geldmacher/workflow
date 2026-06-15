---
name: handoff-plan-compiler
description: Compile an idea, ticket, or high-level plan into a normal Cursor plan artifact containing a compact executor-ready handoff. Use before handing work to another agent or model.
---

# Handoff Plan Compiler

## Goal

Produce a normal Cursor plan artifact containing a copy-pasteable handoff packet that an executor can follow without reconstructing hidden intent.

## Inputs

Gather only what is needed:

- user goal or ticket outcome
- current plan or decision
- target files, symbols, or areas
- patterns to reuse
- verification command or check
- non-goals and stop conditions

If execution-critical information is missing, ask before compiling. Do not use `Open questions` as a substitute for resolving blockers.

## Clarification Gate

Before creating or refining a handoff plan, identify any ambiguity that would make the executor guess about intent, scope, target files, exact changes, verification, or stop conditions.

- MUST use Cursor's interview tool (`AskQuestion`) for execution-critical ambiguity when available.
- If `AskQuestion` is unavailable, ask targeted questions in chat and stop before compiling.
- Only compile the handoff once execution-critical answers are available.
- Keep `Open questions` limited to non-blocking follow-ups that do not affect the executable plan.

## Cursor Actions

When available in Cursor:

- Use `AskQuestion` for execution-critical ambiguity before compiling.
- Request Plan Mode, or use Cursor's plan artifact surface when available, before compiling the handoff.
- Request a mode switch, or use Cursor's mode-switch action when available, when the user asks to move from planning to implementation.
- Use a normal Cursor plan artifact by default for `/compile-handoff` and for manual requests that say to compile or create a handoff plan.
- If Plan Mode is active and a current or attached plan artifact already exists, refine that plan in place instead of creating a second plan.
- Only return the packet directly in chat when Cursor plan artifacts are unavailable, the user explicitly asks for chat-only output, or the handoff is intentionally transient.

## Output

The Cursor plan body must contain only this packet, in this order:

1. `Intent and success condition`
2. `Scope and non-goals`
3. `Context packet`
4. `Target files and symbols`
5. `References to existing patterns`
6. `Executable agent plan`
7. `Verification`
8. `Escalate instead of guessing when`
9. `Open questions`

When creating the plan artifact, use a concise plan name that describes the handoff outcome, and put the packet in the artifact body. The final chat response should only mention that the plan was created and where to find it; do not duplicate the packet in chat unless the user asks.

## Readiness Check

For risky, large, or ambiguous handoffs, run the `handoff-readiness-reviewer` agent on the compiled packet and apply its rewrite instructions before handing off. Skip the check for small, unambiguous packets.

## Step Rules

In `Executable agent plan`, each numbered step must include:

- target files or symbols
- exact change
- key constraint or non-goal
- reference pattern, if any
- verification check
- escalation trigger

Keep the packet concise. Add detail only when it prevents drift.
