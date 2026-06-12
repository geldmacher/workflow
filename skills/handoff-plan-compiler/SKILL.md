---
name: handoff-plan-compiler
description: Compile an idea, ticket, or high-level plan into a compact executor-ready handoff. Use before handing work to another agent or model.
---

# Handoff Plan Compiler

## Goal

Produce a copy-pasteable handoff packet that an executor can follow without reconstructing hidden intent.

## Inputs

Gather only what is needed:

- user goal or ticket outcome
- current plan or decision
- target files, symbols, or areas
- patterns to reuse
- verification command or check
- non-goals and stop conditions

If execution-critical information is missing, ask before compiling.

## Cursor Actions

When available in Cursor:

- Use `AskQuestion` for execution-critical ambiguity.
- Request a mode switch, or use Cursor's mode-switch action when available, when the user asks to move from planning to implementation.
- Use a plan artifact only when the user wants durable planning or the task is large enough to benefit from one.

## Output

Return only this packet, in this order:

1. `Intent and success condition`
2. `Scope and non-goals`
3. `Context packet`
4. `Target files and symbols`
5. `References to existing patterns`
6. `Executable agent plan`
7. `Verification`
8. `Escalate instead of guessing when`
9. `Open questions`

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
