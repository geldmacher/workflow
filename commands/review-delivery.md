---
name: review-delivery
description: Review completed work against intent, handoff scope, and verification evidence.
---

# Review Delivery

Use after implementation when the user wants an intent, scope, and evidence check.

1. Follow the `delivery-review` skill.
2. Delegate the review to the `delivery-reviewer` agent so the check runs readonly instead of reviewing inline.
3. Give the reviewer the original intent, handoff packet or plan, actual changes, verification evidence, and any known deviations.
4. Start with gaps and risks.
5. If follow-up work is useful, emit `Recommended next handoff` as a compile-compatible improvement plan using the canonical packet and executable step rules.
6. Treat that `Recommended next handoff` as the preferred input for the next `/execute-handoff` loop.

Do not make review mandatory by default.
