# Workflow 5 usage example

Choose the smallest profile that fits the task. `manual` means you drive the work in Cursor. `supervised` means the controller drives execution but you accept the delivery. `autonomous` means the same controller may finish a fully verified delivery only for an exact certified Qualification Key. All three keep the same approved Intent, evidence rules, repository-only boundary, and prohibition on automatic push, PR, merge, or deployment. See the [profile guide](profiles.md) for prerequisites.

Manual remains familiar: `/plan-work`, human **Implement Plan**, `/review-work`, optional `/correct-work`, then `/learn-from-work` or an `/explain-work` refresh. The fresh review automatically gives a plain-language result explanation followed by technical traceability. Select the primary model in Cursor before execution; Controller Pools do not route Manual models. Children inherit the parent or an approved Manual candidate. The host validates every Schema-5 Root locally; standalone preflight and handoff calls are optional compatibility. Implement Plan ends with typed `closeout-input`; the lifecycle hook binds Root/lineage, derives snapshot and changed paths, and persists Evidence without requiring MCP or a delivery-report. Use `/close-work [wp-id]` only when Evidence is missing. A fresh review may recover it once; `achieved/verified/none` completes the Root and only provisional delivery needs `/accept-work provisional`. Repository checks do not prove live host activation. See the [Manual Workflow guide](manual-workflow.md).

The final closeout todo carries an internal model-inheritance marker. In that Workflow context the plugin hook allows Cursor Tasks only when the Task model is omitted or `inherit`, the parent is known, and Cursor reports a Child that exactly matches the parent or a configured Manual approved candidate. Every concrete Task override, missing attestation, out-of-policy Child, or uncorrelated start fails closed. Start `/review-work` or `/explain-work` in a fresh Ask context after closeout; only the marked, named read-only plugin agents may then be delegated to.

Within the current task, selectorless context commands resolve the unique active native Plan lineage. An explicit `wp-*` still selects a historical or targeted Root. Without a native Plan, read-only status or explanation may fall back to one unique active controller subject; ambiguity stops without producing a partial artifact.

For a plausible Manual delivery with an unavailable proof surface:

```text
/work-status
/accept-work provisional
```

Acceptance is a hash-bound response snapshot only and reports the resolved `root_plan_id`, `acceptance_basis_hash`, and `acceptance_persisted: false`. No controller or repository state is written; a later `/work-status` again shows `delivery-ready-provisional`. The explicit forms `/work-status wp-...` and `/accept-work wp-... provisional` remain available.

When the current review requires material replanning:

```text
/plan-work replan
```

The new Schema-5 Root receives a fresh `wp-*` ID and binds the predecessor plus the current `next_action: replan` review. Confirmed decisions and unchanged boundaries carry forward, while changed intent, scope, or risk questions return to human approval.

For supervised execution:

Before this can create a writable Run, configure exact model Pools and budgets, set `supervised_enabled: true`, and provide positive live capability proof for the installed environment. Otherwise the profile remains in Shadow Mode.

```text
/work-models default
/auto-work "Fix retry regression" supervised default
/auto-work prep-... approve
/work-status run-...
/work-control run-... accept acceptance=verified
```

The controller snapshots a Dirty human baseline into an isolated worktree, maintains one Writer, records Strategy revisions and granular evidence, and returns a local branch for human integration. Its reviewed delivery handoff is explained by the current outer agent from existing Run data: preliminary while Supervised acceptance is pending, final after verified acceptance. No explainer phase or model call is added. Learning candidates remain recorded only; after acceptance and integration, separate `/learn-from-work` may apply confirmed guidance.

For a verifiable UI surface:

```text
/work-verification draft "desktop-ui"
/work-verification prove
/work-verification approve <displayed-hash>
/work-verification audit
```

Only after exact per-key certification, an approved Verification Profile, and enough accepted verified supervised history should you request `autonomous`. The human still approves the Root. A fully verified delivery may finish directly with a final explanation; downgrade, evidence gap, or blocker stays preliminary and names the next action. Learning still needs a separate invocation. Neither path publishes, integrates, deploys, or learns automatically.
