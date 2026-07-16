# Release checklist

## Deterministic checks

- [ ] Build the runtime validator from source and confirm parity.
- [ ] Run all Node tests, plugin validation, link check, and context diagnostics.
- [ ] Confirm runtime guidance contains no retired components, capability probes, tool allow/deny lists, exact mode refusals, or repository-local Cursor harness.
- [ ] Confirm schema-2 validation accepts flexible IDs, optional timestamps, additional metadata, heading aliases, adaptive sections, equivalent Checks, supported change-impact reuse, optional auditors, diagnostic churn, and legacy corrections without Learning candidates.
- [ ] Confirm declared `LRN-*` candidates match frontmatter and table content, reference current Findings, remain root-unique, and stay output-only until learning closeout.
- [ ] Confirm Learning routing covers suitable existing docs/components, new `.cursor/rules`, `.agents/skills`, `.cursor/agents`, `.cursor/commands`, and the last-resort docs fallback without semantic duplication.
- [ ] Confirm a bare `docs/` directory is not treated as suitable navigation, executable Learnings prefer components, and Rule/Skill/Subagent frontmatter plus Command Markdown follow the target-project convention.
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
- Agent Mode for `/learn-from-work`; operate only on run-owned guidance targets inside the unique smoke directory.

Acceptance:

- [ ] A clear Plan creates a normalizable root without an unnecessary interview or capability probing.
- [ ] An intentionally ambiguous Grok 4.5 Plan uses the native interview before `CreatePlan`; after the answer the root records the human decision and has no material open decision.
- [ ] If the native interview cannot be invoked, the prose fallback is blocking and contains no plan draft. Non-interactive `--print` output alone is not accepted as proof of the native UI.
- [ ] Ask produces a cumulative review and does not mutate the harness. Tests must not enforce a fixed tool-call list; read-only MCP/browser/search/subagent calls are allowed.
- [ ] Agent applies only correction targets and emits full/delta evidence, including verification-only execution without unnecessary edits.
- [ ] Repeated correction is idempotent and follow-up review still resolves the same root.
- [ ] Learning closeout collects only candidates with complete correction evidence and current repository support, skips open candidates, incorporates one manual instruction, and does not duplicate stronger existing guidance.
- [ ] Repeating the same learning closeout is diff-free; stronger existing guidance is unchanged and a migrated fallback entry is removed when a component supersedes it.
- [ ] Only a durable general Learning without suitable guidance or a clear component trigger uses `docs/workflow-learnings.md`, linked from existing navigation.
- [ ] Existing harness files remain byte-identical; remove only the run-owned smoke directory.
- [ ] Finish with `rtk npm test` in the harness.

Unavailable optional MCP or subagent infrastructure is recorded, not treated as a release failure. The plugin ships no MCP server merely for testing.
