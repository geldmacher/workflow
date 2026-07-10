---
name: review-delivery
description: Review completed work against acceptance criteria, actual diff, verification evidence, and declared deviations.
---

# Review Delivery

Use after implementation when the user wants an intent, scope, and evidence check.

1. Follow the `delivery-review` skill.
2. In Ask Mode, review directly in the current chat so the selected model performs the review. In a mode that can edit files, delegate to the readonly `delivery-reviewer` agent.
3. Independently inspect the active handoff, current diff, changed and untracked files, verification evidence, and deviation log. Do not rely only on a supplied summary.
4. Start with gaps and risks, then assess every acceptance criterion and every declared or undeclared deviation.
5. If follow-up work is useful, emit `Recommended next handoff` using the canonical packet and executable step rules.
6. Before emitting that handoff, use Cursor's interview tool (`AskQuestion`) when execution-critical clarification is needed. If it cannot be clarified, emit no plan and list the needed answers.
7. Treat an explicitly linked `Recommended next handoff` as the preferred input for the next `/execute-handoff` loop.

Do not make review mandatory by default.
