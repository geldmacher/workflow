---
name: handoff-plan-compiler
description: Compile an idea, ticket, or high-level plan into a normal Cursor plan artifact containing a compact, evidence-based executor handoff. Use before handing work to another agent or model.
---

# Handoff Plan Compiler

## Goal

Produce a normal Cursor plan artifact containing a copy-pasteable handoff packet that an executor can follow without reconstructing hidden intent or inventing repository facts.

## Repository Discovery

Gather only what the executor needs, and confirm it in the repository before writing the packet:

- user goal or ticket outcome
- project instructions and applicable rules
- workspace baseline and known pre-existing changes
- current behavior, target files, and symbols
- patterns to reuse and the reason each applies
- relevant tests, verification commands, or inspection methods
- non-goals, stop conditions, and risk factors

If execution-critical information is missing, ask before compiling. Do not use `Open questions` as a substitute for resolving blockers. Do not present an unconfirmed path, symbol, behavior, or pattern as repository evidence.

## Clarification Gate

Before creating or refining a handoff plan, identify any ambiguity that would make the executor guess about intent, scope, target files, exact changes, verification, risk, or stop conditions.

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

`Handoff metadata` contains a concise handoff ID, source, status `ready`, predecessor when applicable, planning baseline, and risk level. Define observable acceptance criteria with IDs such as `AC-1`; every step and every verification entry must name the criteria it covers.

When creating the plan artifact, use a concise plan name that describes the handoff outcome, and put the packet in the artifact body. The final chat response should only mention that the plan was created and where to find it; do not duplicate the packet in chat unless the user asks.

## Readiness Check

Classify risk before handoff:

- `low`: localized work with no contract, data, security, dependency, or infrastructure impact
- `medium`: multi-file behavior or an internal contract with limited blast radius
- `high`: public APIs, data, migrations, authentication, security, dependencies, infrastructure, or architectural decisions

Run the `handoff-readiness-reviewer` agent on every medium- and high-risk packet and apply its rewrite instructions before handing off. Use it for low-risk work when evidence or scope is ambiguous.

## Step Rules

Each numbered item in `Executable agent plan` must include:

- step ID and covered acceptance criteria
- target files or symbols
- exact change
- key constraint or non-goal
- reference pattern, if any
- step-level verification check
- deviation trigger and required action

Every acceptance criterion must appear in at least one implementation step and one verification matrix entry. Define the risk and deviation policy before the executor receives the packet. Keep the packet concise. Add detail only when it prevents drift.
