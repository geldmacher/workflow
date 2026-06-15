---
name: compile-handoff
description: Compile an idea, ticket, or high-level plan into a normal Cursor plan artifact containing an executor-ready handoff packet.
---

# Compile Handoff

Use when an idea, ticket, or plan should become an executor-ready handoff in a normal Cursor plan artifact.

1. Follow the `handoff-plan-compiler` skill.
2. Gather the minimum context needed to remove execution ambiguity.
3. If critical details are missing, use Cursor's interview tool (`AskQuestion`) when available; otherwise ask targeted questions in chat and stop before compiling.
4. For risky, large, or ambiguous handoffs, validate the packet with the `handoff-readiness-reviewer` agent and apply its rewrite instructions before handing off.
5. Request Plan Mode, or use Cursor's plan artifact surface when available, before creating the handoff.
6. Create a normal Cursor plan artifact with the canonical handoff packet as the plan body.
7. Do not implement the handoff while compiling it.

Keep the packet short, concrete, and executor-ready. In Cursor, `/compile-handoff` should produce a durable plan artifact by default, not just a chat-only packet.
