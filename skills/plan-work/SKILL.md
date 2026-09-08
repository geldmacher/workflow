---
name: plan-work
description: Plan repository work when the user asks for an implementation plan.
---

# plan-work

Read the [working agreement](../../references/workflow.md). Inspect the repository before asking questions that it can answer. Planning is read-only; verification inspection does not start the product.

Stop investigating once the goal, boundaries, key interfaces, and suitable checks are clear enough for implementation. Ask about consequential human choices with a reasoned recommendation. A clear assignment needs no interview or advance design of routine implementation details.

Explain the goal and benefit, observable success criteria, scope and exclusions, material risks and dependencies, key decisions, and appropriate checks. Include files, interfaces, commands, examples, or sequencing where they remove ambiguity. A small change may need only a few paragraphs.

Before presenting the plan, resolve missing success criteria, conflicting instructions, open permissions, and consequential choices. Give it a descriptive title and carry the working agreement, execution boundaries, reporting expectations, and accepted references into the handoff. A fresh executor must not need product or authority decisions. Direct the human to check the plan and start implementation. Include the closing recommendation for a separately commissioned review and its host-specific invocation.

Recommend an engineering playbook only when it materially helps; read the [catalog](../engineering-work/references/catalog.md) in that case. An explicit selection is optional and is not a planning gate. When selected, read only that playbook's reference from the catalog.

For relevant behavior changes, inspect existing checks, harnesses, and project verifiers; reuse suitable coverage. Only when acceptance has a concrete gap or a relevant verifier needs adjustment, read the [verification guidance](../../references/verification-work.md) for the proposal and handoff. Verifier edits require explicit acceptance of that proposal; an unanswered or declined suggestion is not implementation scope. Resolve any remaining gap that prevents agreed acceptance before finalizing the plan.
