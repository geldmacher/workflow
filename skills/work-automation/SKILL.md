---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*` tools; never hand-edit state. Load only: `/auto-work` [Preparation](../../references/automation-preparation-contract.md); `/work-status|work-watch|accept-work` [state](../../references/state-contract.md); `/work-control` plus [authorization](../../references/automation-contract.md); `/work-models` [pools](../../references/model-routing-contract.md); `/work-verification` [Profiles](../../references/verification-profile-contract.md).

Before mutation read fresh status, revision, and idempotency key. No result grants unstated authority. Never push, PR, merge, deploy, integrate, or auto-learn. Replan passes exact predecessor/review `root_artifacts`; invalid lineage stops.

Manual status/provisional acknowledgement sends exact task artifacts; omit `root_plan_id` only for the unique active tip. Never infer authority/evidence. Missing/ambiguous waits; invalid replans. Send `manual_acceptance: provisional` only after explicit `/accept-work`; report one-response-only, unverified, unpersisted, no Qualification/Learning, and later `delivery-ready-provisional`. Workflow-3/4 is status-only.

The outer agent renders unchanged structured Root, Strategy, Evidence, receipts, paths, and snapshot; no extra phase or model call. Use `Quick decision` → `Details` → authoritative contract, six human phases, one action, and distinguish Limitation from Blocker. Only `achieved` is **Final repository explanation**; every other state is **Preliminary explanation**. Verified controller acceptance is final; provisional is persisted but unverified and non-qualifying.

Keep journey task-local; Runs aid recovery. Blockers state reason and resolution.
