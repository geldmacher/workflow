# Release validation record

Validation date: 2026-07-16. See [the release checklist](release-checklist.md).

| Check | Status | Evidence |
|---|---|---|
| Plugin structure and release metadata | Passed | `npm run release-check` completed plugin validation and Markdown link validation. |
| Cursor-native protocol and tolerant schema 2 | Passed | 57 deterministic tests cover extraction/normalization, native wrappers, Intent Interview readiness, embedded Lean `None.` markers, hard root/scope/chain invariants, full/delta materialization, equivalent Checks, supported change-impact reuse, optional auditors, and diagnostic churn. |
| Runtime parity and clean-cache execution | Passed | Generated validator matches source and runs without plugin-local `node_modules`. |
| Legacy cleanup | Passed | Runtime scan and policy tests find no retired workflow components, standalone state/constraint artifacts, old commands, capability probes, tool allow/deny lists, or exact mode-gate response. |
| Context economy | Passed with diagnostic | Estimated Plan 2190, Correction 2010, Review 1738; Plan and Correction exceed the economic target while remaining within the former 2200-token planning ceiling. Budgets are diagnostic and no exact runtime or monetary cost is claimed. |
| Clear native Plan smoke | Passed | Grok 4.5 Low Fast recognized the JSDoc request as fully specified, skipped the interview, loaded detailed contracts only afterward, created a native plan, and made no repository change. The saved plan passes the runtime validator. |
| Material Intent Interview | Contract and fallback passed; native Editor UI pending | Policy tests require the native Ask Question Tool, waiting, and no pre-answer plan. The installed Cursor CLI did not expose that tool to Grok 4.5, so the interactive run used one blocking prose question and no `CreatePlan`; after the human answer it recorded `DEC-1`, cleared material open decisions, and produced a valid root. A Grok High attempt separately ended in `resource_exhausted`; positive native Question UI still requires a Cursor Editor run where the tool is exposed. |
| Native Ask review | Passed | Ask tolerated normal chat text around the artifact, inspected current sources and the cumulative evidence chain, accepted an equivalent non-weaker Check, returned `achieved`, and made no mutation. No fixed tool-call list was asserted. |
| MCP and future Ask capabilities | Contract passed; optional runtime not observed | Static policy tests allow MCP, browser/documentation, semantic search, and subagents without classifying tools. The harness supplied no MCP call during this run, which is not a release blocker. |
| Verification-only correction | Passed after one transient Cursor backend reconnect | Agent classified the latest FIX as already `satisfied`, ran the effective regression suite (48/48), used available Agent inspection/terminal capabilities, made no edit, and returned delta evidence. |
| Root continuity and idempotency | Passed | The correction and follow-up review resolve the same `wp-*`; unchanged evidence is reused only where current inspection or strong prerequisites support it. |
| Existing harness changes preserved | Passed | Harness status stayed limited to the original two dirty files. SHA-256 remained `61d274a4f3d654d269114916f513c70f00147d41886df720a828595e68515011` and `3dfe52e4f963308f530e33ac8026c2892fc3a207964aa2758630cfb8e1c36de2`; final harness tests passed 48/48. |
| Local test workspace | Passed | Ignored `.tests/` remains available for local development and scratch tests; functional Cursor tests use `/private/tmp/cursor-plugin-harness`. |

Cursor modes remain the authority for capabilities and sandboxing. The plugin validates Workflow meaning—intent, scope, chain, evidence, risk, and approval—without redefining the active mode's tool environment.
