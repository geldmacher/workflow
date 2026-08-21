---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*`; never edit state. Load [runtime output](../../references/human-output-runtime-contract.md), plus: `/auto-work` [Preparation](../../references/automation-preparation-contract.md); `/work-status|work-watch|accept-work` [state](../../references/state-contract.md); `/work-control` [authorization](../../references/automation-contract.md); `/work-models` [pools](../../references/model-routing-contract.md); `/work-verification` [Profiles](../../references/verification-profile-contract.md).

Before mutation read status/revision/idempotency. Results grant no authority or push/PR/merge/deploy/integrate/auto-learn. Replan requires exact predecessor/review `root_artifacts`; invalid lineage stops.

Manual status prefers exact artifacts. A Root ID may once revalidate cache as non-authoritative transport; missing/conflicting/ambiguous waits. Never infer proof. Acceptance needs an explicit chain via `/accept-work`. Workflow-3/4 is status-only.

Outer agent explains directly—no extra phase/model call—via runtime output; final adds exact Root/Strategy/Evidence/receipts/paths/snapshot/continuation. Only `achieved` is **Final repository explanation**; others are **Preliminary explanation** with blocker/recovery. Verified acceptance finalizes it.

Task-local Runs aid recovery; blockers give reason/resolution.
