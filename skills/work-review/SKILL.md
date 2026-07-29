---
name: work-review
description: Review delivery against one Workflow root.
---

Use a fresh Cursor Ask context; do not inherit Writer assumptions. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), and [review](../../references/review-contract.md) completely. Inspect read-only with Cursor capabilities: repository search, MCP, browser/documentation, and subagents when useful.

Resolve one schema-3 root, design/slices, evidence tip, reuse, and churn. Reject schema-2/mixed, ambiguous, or invalid chains. Compare evidence to current sources; inspection is not a rerun. Preserve each Check's expected outcome; accept equivalents only with no weaker scope, risk, or evidence.

Choose `clarify` only for a human decision, `replan` for changed intent/scope/acceptance/risk, and `retry-review` only when evidence is missing to decide. Use `correct` when Agent Mode can close a proven in-scope gap, including verification-only work.

Return one compact schema-3 review covering every root Objective and required Check. Only when the decision is `correct`, read [embedded correction](../../references/correction-contract.md) completely and author one Findings-backed correction. Do not load the Learning closeout contract during review. Never infer production success.
