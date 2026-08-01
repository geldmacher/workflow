# Workflow 5 usage example

Manual remains familiar: `/plan-work`, human **Implement Plan**, `/review-work`, optional `/correct-work`, then `/learn-from-work` or `/explain-work`. Select the primary model in Cursor before execution. Workflow does not route the Manual model; the primary agent may use subagents only through model inheritance and remains responsible for their integration. Implement Plan performs closeout automatically; use `/close-work [wp-id]` only if Evidence is missing. The Plan is a compact Schema-5 Intent Root; presentation may be prose, lists, or tables. Low/medium-risk Manual work without Hard Triggers normally returns Lean Evidence.

Every native implementation todo carries an internal model-inheritance marker. In that Workflow context the plugin hook allows subagents when no child-model override is requested and Cursor reports a known parent model. Explicit overrides or an unknown parent fail closed. Start `/review-work` or `/explain-work` in a fresh Ask context after closeout; only the marked, named read-only plugin agents may then be delegated to.

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

```text
/work-models default
/auto-work "Fix retry regression" supervised default
/auto-work prep-... approve
/work-status run-...
/work-control run-... accept acceptance=verified
```

The controller snapshots a Dirty human baseline into an isolated worktree, maintains one Writer, records Strategy revisions and granular evidence, and returns a local branch for human integration.

For a verifiable UI surface:

```text
/work-verification draft "desktop-ui"
/work-verification prove
/work-verification approve <displayed-hash>
/work-verification audit
```

Only after exact per-key certification use `autonomous`. An evidence gap automatically becomes supervised provisional delivery. A known failed Check becomes blocked. Neither path publishes, integrates, deploys, or learns automatically.
