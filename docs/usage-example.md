# Workflow 4 usage example

Manual remains familiar: `/plan-work`, human **Implement Plan**, `/review-work`, optional `/correct-work`, then `/learn-from-work` or `/explain-work`. The Plan is a compact Schema-4 Intent Root; presentation may be prose, lists, or tables.

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
