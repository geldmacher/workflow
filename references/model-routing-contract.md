# Model Pool contract

User Config Schema 2 defines ordered approved Pools for `planner`, `investigator`, `writer`, `writer_escalated`, `verifier`, `reviewer`, and `explainer`. Every candidate has a concrete model ID, reasoning setting, scalar options, and non-negative price. Pool selection is `ordered`; fallback is only `approved-pool`.

The first available compatible candidate is selected. Aliases, free choice, silent remapping, and candidates outside the Pool are rejected. Receipts bind Pool hash, selected candidate, selection reason, requested/catalog-accepted/SDK-observed configuration, request and agent IDs, usage, configured cost, and Intent projection hash.

Writer affinity persists through a phase. Repeated findings or invalid outputs may escalate only at an artifact or correction boundary to the next approved candidate; no turn-by-turn churn. Autonomous runs may use only candidates positively named in the Capability Receipt.

Default user configuration is `~/.cursor/geldmacher-workflow/config.yaml`. `CURSOR_API_KEY` is process-only and never serialized.
