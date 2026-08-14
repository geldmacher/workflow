---
name: work-automation
description: Operate adaptive supervised and certified autonomous Workflow runs.
---

Use bundled `workflow_*` tools; never hand-edit state. Load only: `/auto-work` [Preparation](../../references/automation-preparation-contract.md); `/work-status|work-watch|accept-work` [state](../../references/state-contract.md); `/work-control` plus [authorization](../../references/automation-contract.md); `/work-models` [pools](../../references/model-routing-contract.md); `/work-verification` [Profiles](../../references/verification-profile-contract.md).

Before mutation read fresh status, revision, and idempotency key. No result grants unstated authority. Never push, PR, merge, deploy, integrate, or auto-learn. Replan passes exact predecessor/review `root_artifacts`; invalid lineage stops.

Manual status/acceptance sends exact task artifacts; omit `root_plan_id` only for their unique active lineage tip. Never infer authority/evidence. Missing/ambiguous waits; invalid replans. Send `manual_acceptance: provisional` only after explicit `/accept-work`; never persist it. Workflow-3/4 is status-only.

A reviewed Run is explained by the outer agent from Root, Strategy, Evidence, receipts, paths, and snapshot—never an extra phase or model call. Order `What was achieved`, `What this means`, `Verification and limits`, then `Technical traceability`. Only `achieved` is **Final repository explanation**; every other state is **Preliminary explanation** with blocker and recovery. Verified acceptance becomes final.

Keep journey task-local; Runs aid recovery. Blockers state reason and resolution.
