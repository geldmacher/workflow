---
name: accept-work
description: Ephemerally acknowledge one current provisional Manual delivery.
---

# /accept-work

Read [Manual local state](../skills/manual-workflow/SKILL.md). Acknowledge only one exact current Schema-6 `delivery-ready-provisional` chain through the bundled builder's `accept-provisional` operation.

Return the builder's human output unchanged. The acknowledgement is ephemeral, unverified, non-qualifying, and grants no implementation, learning, deployment, or publication authority. Reject verified, blocked, failed, unsupported, ambiguous, or correction-pending chains.
