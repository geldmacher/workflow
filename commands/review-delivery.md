---
name: review-delivery
description: Review completed work against intent, handoff scope, and verification evidence.
---

# Review Delivery

Use after implementation when the user wants an intent, scope, and evidence check.

1. Follow the `delivery-review` skill.
2. When independence matters — especially when the implementing agent would review its own work — delegate the review to the `delivery-reviewer` agent instead of reviewing inline.
3. Compare original intent, handoff packet, actual changes, and verification evidence.
4. Start with gaps and risks.
5. If follow-up work is useful, emit `Recommended next handoff` using the canonical packet.

Do not make review mandatory by default.
