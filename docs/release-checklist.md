# Release checklist

## Deterministic checks

- [ ] Build the runtime validator from source and confirm parity.
- [ ] Run all Node tests, plugin validation, link check, and context diagnostics.
- [ ] Confirm runtime guidance contains no retired components, capability probes, tool allow/deny lists, exact mode refusals, or repository-local Cursor harness.
- [ ] Confirm schema-2 validation accepts flexible IDs, optional timestamps, additional metadata, heading aliases, adaptive sections, equivalent Checks, supported change-impact reuse, optional auditors, and diagnostic churn.
- [ ] Confirm invalid roots, ambiguous tips, unsafe reuse, insufficient achieved evidence, scope/risk expansion, and missing human approval remain blocking.
- [ ] Confirm Planning explicitly uses the native Ask Question Tool for material decisions, permits a blocking prose fallback only after native invocation failure, and emits no plan before the answer.

## Cursor CLI harness

Use the ignored repository-local `.tests/` directory for local development and scratch tests. It is not the functional Cursor workspace.

Use only `/private/tmp/cursor-plugin-harness` for functional Cursor tests. Before testing, capture Git status, binary diff, and hashes of existing dirty files. Never reset, stash, overwrite, or clean pre-existing changes.

Invoke `cursor-agent` with the local plugin source, trusted workspace, sandbox, printable machine-readable output, and the intended mode:

- Plan Mode for `/plan-work`.
- Cursor's native plan implementation flow for initial delivery.
- Ask Mode for `/review-work`.
- Agent Mode for `/correct-work`; force only inside a unique `.workflow-smoke/<run-id>` owned by the test.

Acceptance:

- [ ] A clear Plan creates a normalizable root without an unnecessary interview or capability probing.
- [ ] An intentionally ambiguous Grok 4.5 Plan uses the native interview before `CreatePlan`; after the answer the root records the human decision and has no material open decision.
- [ ] If the native interview cannot be invoked, the prose fallback is blocking and contains no plan draft. Non-interactive `--print` output alone is not accepted as proof of the native UI.
- [ ] Ask produces a cumulative review and does not mutate the harness. Tests must not enforce a fixed tool-call list; read-only MCP/browser/search/subagent calls are allowed.
- [ ] Agent applies only correction targets and emits full/delta evidence, including verification-only execution without unnecessary edits.
- [ ] Repeated correction is idempotent and follow-up review still resolves the same root.
- [ ] Existing harness files remain byte-identical; remove only the run-owned smoke directory.
- [ ] Finish with `rtk npm test` in the harness.

Unavailable optional MCP or subagent infrastructure is recorded, not treated as a release failure. The plugin ships no MCP server merely for testing.
