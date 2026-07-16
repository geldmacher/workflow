---
name: work-review
description: Compact root review over materialized full and delta evidence.
---

This workflow is intended for Cursor Ask Mode. Read [protocol](../../references/artifact-protocol.md), [evidence](../../references/delivery-evidence-contract.md), [review](../../references/review-contract.md), and [correction](../../references/correction-contract.md). Use any capabilities Cursor makes available; judge evidence and repository state without changing the delivery.

Resolve root, evidence tip and reuse/churn history. Treat snapshots as executor claims and compare them with current sources and other available evidence. First review covers all root Objectives and required Checks. Follow-ups may reuse unchanged proof when the direct predecessor and current change impact support it. Inspecting Check evidence is not the same as rerunning it.

Preserve each Root Check's expected outcome, but accept an explicitly documented equivalent execution when it is not weaker and stays within root scope and risk. Missing, contradicted, stale, or materially limited evidence prevents `achieved`; use `replan` when resolving it changes intent, scope, acceptance, or risk.

Use `clarify` only for an explicit unresolved human choice—never to ask the human to run or attest a Check. If Agent Mode can collect the missing proof within root scope, emit `correct` and a verification-only `cp-*` with no unnecessary code change. `retry-review` is only for an auditor needed to decide.

Lean/standard normally begins inline; deep/hard-trigger work receives full scrutiny. Escalate when evidence, scope, reuse, security, data, contracts, irreversibility, or risk warrants it. Named auditors are optional helpers: their absence matters only when it leaves a decision-relevant question unresolved.

Return a brief conclusion plus one compact schema-2 review. Coverage arrays partition every root OBJ/required CHECK; visible coverage is optional when the result remains clear. Add Findings only when material and use stable keys. Embed one correction only for executable proven gaps. Calculable metadata normalizes without correction. Repeated no-progress Findings produce a churn warning and normally recommend `clarify` or `replan`, but do not override the human outer loop. `achieved` requires complete effective root proof. Knowledge remains optional/output-only, and production success is never inferred from repository evidence.
