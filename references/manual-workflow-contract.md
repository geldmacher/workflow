# Manual Workflow Contract

This contract is host-neutral. A host facade may translate command syntax and native plan containers, but it must preserve the same Schema-5 artifact text, IDs, hashes, chain rules, status derivation, and closeout semantics.

## Authority

- The human authorizes planning, implementation, correction, review, and learning as separate actions. Starting a fresh Manual review authorizes final verification: an `achieved/verified/none` verdict completes the Root, while only a provisional verdict needs the separate ephemeral `/accept-work provisional` decision.
- Manual Workflow never starts controller automation, merges, pushes, publishes, or deploys.
- Subagents are optional role helpers. By default they inherit the parent model. An optional Manual subagent policy may approve concrete host-specific candidates; see [manual subagent policy](./manual-subagent-policy.md). Their output is advisory until the primary agent verifies and records it.
- Review is read-only. A proven gap requires a separate correction or implementation action.

## Artifact flow

1. Planning creates one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID.
2. The host validates every exact Manual Root locally through its native plan guard before presentation. Standalone `workflow_plan_preflight` remains optional compatibility and controller-preparation transport; `workflow_artifact_record` is best-effort transport only.
3. The host presents its native plan container. Its final implementation step uses semantic `delivery-closeout`; legacy `workflow_closeout` remains accepted.
4. Implementation observes every required Check and returns one typed native closeout report. The host derives repository evidence and creates one `delivery-evidence` artifact with a `de-*` ID. The optional MCP closeout path remains wire-compatible.
5. A fresh review task validates the exact Root/Evidence chain and emits one `work-review` artifact with a `wr-*` ID. Codex captures its exact bytes task-locally under the Root-content hash so an authorized correction receives Root, predecessor Evidence, and Source Review without reconstructing the Review or successfully recording it through MCP. Task artifacts are authoritative; `workflow_artifact_context` and `workflow_artifact_record` are optional transport enrichment.
6. Status is derived from the exact current-task artifact chain. The shared root-content handoff cache is transport only and never grants authority. Optional host `tool_approval` preference metadata is advisory only; see [host approval](./host-approval-contract.md).

Artifact text remains host-neutral and immutable. Human-facing summaries lead with outcome, checks, and gaps; exact machine artifacts remain secondary but authoritative. Actionable Manual-phase replies end with the `### Next step` footer from [manual MCP output](./manual-mcp-output-contract.md) (Now/How/Why; Off track when blocked). Terminal `achieved` and `accepted-provisional` status use their compact, state-specific completion blocks. Prefer MCP `presentation` when present; keep command tokens exact.

Machine `verified` needs a fresh host receipt bound to exact Root, command, directory, and repository snapshot. Receipts are host-neutral hashes with no raw output, expire after 24 hours, and are purged after persisted closeout. Missing/stale/rootless proof downgrades; host failure stays `failed`; human gates are unchanged.

Closeout, status, and review expose current-delivery coverage only. Success stays compact; actionable Human attention and Problems include why, recovery, and one next action. No history or automatic Learning follows.

When a user-visible state, Evidence grade, non-achieved Review outcome, handoff limitation, or recovery condition needs interpretation, add at most one short `Meaning:` sentence and one topic-specific `Learn more:` link before the final action block. Use the canonical [Manual Workflow guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md); omit blanket help from ordinary successful prose and from explanations that already translate the chain.

## Roles

- Planner: read-only discovery, intent interview, Schema-5 Root construction, native plan presentation, and optional preflight.
- Primary implementer: executes only the approved Root, collects direct Check observations, and performs closeout.
- Delivery auditor: read-only comparison of changed code and evidence against acceptance and required Checks.
- Risk auditor: read-only inspection of material safety, security, data, and irreversible-operation risks.
- Design auditor: read-only inspection of architecture and public-contract fit.
- Explainer: read-only explanation of behavior and boundaries.

Role helpers receive the exact Root/chain, a bounded question, and the marker `[workflow-model-inherit-v1]`. Cursor Tasks omit model overrides or use `inherit`. Codex may apply a configured ordered Manual candidate rewrite with parent fallback. Unapproved concrete models remain forbidden.

## Failure boundary

- Invalid, ambiguous, conflicting, Schema-3/4, or incomplete chains stop the action.
- Native closeout failures name their concrete class and cause in the host response; a visible `closeout-input` never implies that Evidence was created.
- Unavailable cache transport does not invalidate exact artifacts already present in the task; they must be attached explicitly.
- Unattested or model-divergent subagent output is not evidence.
- Missing or invalid closeout blocks implementation completion. Local plan validation is required for every Manual Root; standalone MCP preflight is optional and its failure cannot fabricate success or override local validation.
