# Manual Workflow Contract

This contract is host-neutral. A host facade may translate command syntax and native plan containers, but it must preserve the same Schema-5 artifact text, IDs, hashes, chain rules, and status derivation.

## Authority

- The human authorizes planning, implementation, every correction, review, replan, provisional acceptance, and learning as separate actions. Starting a fresh read-only Manual review phase authorizes final verification: an `achieved/verified/none` verdict completes the Root, while only a provisional verdict needs the separate ephemeral `/accept-work provisional` decision. Freshness is a phase boundary, not a requirement to open another task or chat.
- Manual Workflow never starts controller automation, merges, pushes, publishes, or deploys.
- Native host activity is outside Workflow unless the current action explicitly invokes a Workflow command or marked role. Installed hooks must remain passive and non-blocking when activation cannot be established. Once explicitly active, deliberate Plan validation, read-only Review, authority, and model-attestation decisions remain enforceable.
- Subagents are optional role helpers. By default they inherit the parent model. An optional Manual subagent policy may approve concrete host-specific candidates; see [manual subagent policy](./manual-subagent-policy.md). Their output is advisory until the primary agent verifies and records it.
- Review is read-only. A proven gap requires a separate correction or implementation action.

## Artifact flow

1. Planning creates one immutable Schema-5 `work-plan` Root with a visible `wp-*` ID.
2. Cursor and Codex validate exact Schema-5 Roots when their native plan event exposes one. Their native Plan is the sole Manual plan container. Cursor may retain exact validated `CreatePlan` bytes as protected conversation-bound transport provenance; only the later human native **Implement Plan** choice approves them. The observation, receipts, caches, and handoffs cannot independently authorize implementation or Review.
3. The human selects native **Implement Plan**. Implementation and correction use normal host sandboxing and approval prompts, execute inside the Root authority, and finish normally. They create no Evidence, typed closeout, delivery report, Stop continuation, or lifecycle recovery turn.
4. In the same task, a fresh read-only reviewer resolves the native Root and current-task predecessor artifacts. Cursor uses a five-minute single-use receipt bound to workspace, conversation, generation, semantic call, exact approved `CreatePlan` bytes, and validated predecessors. Codex and portable clients retain the exact-input path. Missing, unapproved, invalid, ambiguous, expired, replayed, or mismatched context blocks only Review and provides one bounded remedy.
5. The reviewer directly executes or inspects planned Checks and submits closed Schema-1 review input plus those observations to `workflow_closeout` work-review mode. Cursor excludes model-supplied Root/artifact transport from authority and consumes the protected receipt atomically; Codex and portable clients supply exact bytes. From the server-observed repository snapshot, the builder creates missing full or delta `delivery-evidence` and the `work-review` atomically. Both exact artifacts are returned or neither is emitted.
6. A failed required Check completes Review with blocked delivery and a correction, clarification, retry, or replan action. High risk and Hard Triggers select delivery and risk auditors, plus design review when material; unresolved uncertainty remains provisional or blocked for human decision.
7. Status is derived only from exact current-task Root/Evidence/Review bytes. Legacy Manual state and automatic cross-task restoration are ignored. Portable clients may still use delivery-evidence mode and content-addressed transport for compatibility, but neither grants Cursor/Codex task authority. Optional host `tool_approval` preference metadata is advisory only; see [host approval](./host-approval-contract.md).

Artifact text remains host-neutral and immutable. Human-facing summaries lead with journey state, outcome, Check summary, at most one blocker, and one action; exact machine artifacts remain secondary but authoritative in `Technical traceability`. Actionable Manual-phase replies use the `### Next step` footer from [manual MCP output](./manual-mcp-output-contract.md) (Now/How/Why; Off track when blocked). Terminal `achieved` and `accepted-provisional` status use compact state-specific completion blocks. Prefer MCP `presentation` when present; keep command tokens exact.

The default Manual journey is task-local from Plan through Review and any bounded Correction. `handoff_persisted: false` never blocks exact artifacts returned in the current task. Manual chains are not automatically restored or transferred to another task or host. Supervised and Autonomous controller storage remains unchanged.

Manual machine `verified` needs a fresh reviewer observation bound to the exact Root, planned command or inspection, directory, expectation, result, and repetition. Cursor's native task-binding receipt is required only to transport exact Manual Root/chain bytes into its Review call; it does not upgrade Check evidence. Codex and portable Manual retain exact-input transport. Supervised and Autonomous retain their stricter certification rules. Missing or rootless proof downgrades; observed failure stays `failed`; human gates are unchanged.

Closeout, status, and review expose current-delivery coverage only. Success stays compact; actionable Human attention and Problems include why, recovery, and one next action. No history or automatic Learning follows.

When a user-visible state, Evidence grade, non-achieved Review outcome, handoff limitation, or recovery condition needs interpretation, add at most one short `Meaning:` sentence and one topic-specific `Learn more:` link inside technical traceability. Use the canonical [Manual Workflow guide](https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md); omit blanket help from ordinary successful prose and from explanations that already translate the chain.

## Roles

- Planner: read-only discovery, intent interview, Schema-5 Root construction, native plan presentation, and optional preflight.
- Primary implementer: executes only the approved Root, reports implementation observations, and finishes normally.
- Delivery auditor: read-only comparison of changed code and evidence against acceptance and required Checks.
- Risk auditor: read-only inspection of material safety, security, data, and irreversible-operation risks.
- Design auditor: read-only inspection of architecture and public-contract fit.
- Explainer: read-only explanation of behavior and boundaries.

Role helpers receive the exact Root/chain, a bounded question, and the marker `[workflow-model-inherit-v1]`. Cursor Tasks omit model overrides or use `inherit`. Codex may apply a configured ordered Manual candidate rewrite with parent fallback. Unapproved concrete models remain forbidden.

## Failure boundary

- Invalid, ambiguous, conflicting, Schema-3/4, or incomplete chains stop the action.
- Unavailable cache transport does not invalidate or block exact artifacts already present in the task. Attach exact artifacts only when deliberately continuing in another task or host that cannot load them.
- Unattested or model-divergent subagent output is not evidence.
- Missing native Root or operational MCP workspace context blocks only Review or the affected MCP operation, never implementation already authorized by the host-native Plan action. `workflow_status` is not an implementation mutation gate.
- An absent Workflow subject is an inactive status, not an error or permission decision. Hook/MCP availability cannot infer that Workflow is active.
- Known failed required Checks cannot produce achieved or verified delivery, but they do not prevent the builder from returning a completed blocked Review.
- Repository ambiguity or out-of-authority dirty paths appear as Evidence limitations or Findings; they do not trigger lifecycle recovery loops.
