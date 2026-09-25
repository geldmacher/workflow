---
name: plan-work
description: "Create an implementation plan when repository planning is requested."
---

# plan-work

Apply the [working agreement](../../references/workflow.md); read it if missing or uncertain. A natural-language request for an implementation plan selects planning; routine reasoning within implementation does not start a separate planning phase. Inspect the repository and applicable saved project lessons, checking their current relevance, before asking questions it can answer. Planning is read-only; verification inspection does not start the product.

Stop investigating once the goal, boundaries, key interfaces, and suitable checks are clear enough for implementation. Ask about consequential human choices with a reasoned recommendation. A clear assignment needs no interview or advance design of routine implementation details.

Explain the goal and benefit, observable success criteria, scope and exclusions, material risks and dependencies, key decisions, and appropriate checks. Include files, interfaces, commands, examples, or sequencing where they remove ambiguity. A small change may need only a few paragraphs. When the change is material (architecture, a breaking change, several surfaces, or schema and deploy), note second-order effects in one line each where relevant: caller impact, data or migration, deploy and rollback, and security or auth. Mark speculation as speculation. Omit this for a routine fix or a small plan.

Before presenting the plan, settle success criteria, instruction conflicts, permissions, and consequential choices. Give it a descriptive title. Carry the working agreement, [implementation requirements](../../references/implementation-work.md), accepted references, and open learning collection into the handoff. Use an accessible reference to the complete collection when the receiver can reach it; include the full collection when they cannot. In standalone work, direct the human to check the plan and start implementation, then commission Review. In expressly commissioned Auto-Work, Light waits for plan approval; Dark can continue within the human goal assignment. Neither mode resolves consequential missing choices by assumption.

Assess playbooks when the user asks about methods or a concrete methodological choice would materially help the task; otherwise do not load the catalog. Assess verifier gaps independently. Explain useful options with exactly one recommendation per offer and an explicit refusal. Only actively selected additions enter the plan; recommendations or accepting another offer are not consent. Preserve prior approval. Declined or unanswered offers neither block planning nor recur for that scope.

Read the [catalog](../engineering-work/references/catalog.md) only in that case; full method references wait for explicit selection.

Reuse suitable checks and verifiers without an offer or justification. For gaps or update needs, read the [verification guidance](../../references/verification-work.md) for concrete options and handoff; retain evidence gaps and acceptance limits.
