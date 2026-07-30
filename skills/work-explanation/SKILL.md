---
name: work-explanation
description: Explain one Workflow root read-only.
---

This workflow is intended for Cursor Ask Mode. Read [state](../../references/state-contract.md) and [explanation](../../references/explanation-contract.md). Resolve exactly one Schema-4 Root plus its Strategy/evidence/review chain and current repository state. For Workflow-3, mixed, or invalid input, report compatibility honestly without promoting its delivery. Never modify files, run mutating commands, or emit `work-plan`, `delivery-evidence`, `work-review`, or correction artifacts.

Treat every artifact's `extensions` as opaque audit metadata. Do not interpret, quote, summarize, explain, use, or pass their contents to the explainer subagent.

Prefer a fresh `work-explainer` subagent so the explanation does not inherit writer assumptions. Before an achieved review, label the result **Preliminary** and name blockers and next safe action. After achieved, label it **Final repository explanation**. Ground material claims in root/slice/check IDs and file or symbol locations. Unknown or contradicted claims stay explicit.
