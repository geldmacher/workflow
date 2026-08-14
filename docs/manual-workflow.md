# Manual Workflow guide

Manual Workflow is the default human-driven delivery path in Workflow. You approve each material transition; Workflow connects the approved Intent Root to implementation, evidence, fresh review, correction, and optional Learning without starting controller automation or requiring another task or chat.

## Manual flow

```text
plan-work -> Implement Plan -> review-work
                              |-> achieved
                              |-> accept provisional
                              |-> correct-work -> review-work
                              |-> plan-work replan -> Implement Plan -> review-work
```

The normal path is deliberately short:

1. `/plan-work` or `$plan-work` creates one ready Schema-5 Intent Root.
2. The human uses **Implement Plan**, which authorizes implementation only inside that Root.
3. The lifecycle closes out internally, binding observed Checks and repository changes into Delivery Evidence without showing a `closeout-input`, delivery report, or extra command. `/close-work` or `$close-work` is exceptional diagnostic recovery.
4. In the same task, `/review-work` or `$review-work` starts a fresh read-only review phase, normalizes missing Evidence internally when possible, and returns one result understandable without replaying the implementation transcript.
5. The verdict completes the Root, asks for a bounded human decision, or stops for correction or replanning.

Every actionable response uses the same two-layer chat card. The primary layer shows one journey state, one plain-language outcome, the required-Check summary, at most one blocker, and exactly one action. Root/Evidence/Review/Correction IDs, receipts, hashes, paths, and host enforcement move to the following **Technical traceability** disclosure. Repeated output with the same Root, state, problem, and action has one stable deduplication key so a host can coalesce it instead of creating a status-message stream.

Manual creates no controller Run, Route Pool, worktree orchestration, qualification history, or background execution.

## Constraint loop and host receipts

Manual keeps the visible four-step flow while adding four layers of back-pressure behind it:

1. **Preflight:** the Root fixes acceptance, authority, risk, and the cheapest sufficient required Checks before implementation.
2. **Mutation gate:** Cursor or Codex revalidates the exact task-bound Root, captures the repository baseline before the first write, and rejects directly observable protected, approval-required, or out-of-authority paths before execution. Baseline failure blocks the mutation. Opaque mutation surfaces remain subject to the complete host-derived closeout inventory.
3. **In-loop feedback:** Cursor or Codex observes each required machine Check when the agent runs the exact planned command in the planned working directory. One leading `rtk` wrapper is fine; chained or rewritten commands do not match.
4. **Delivery boundary:** closeout binds the Check result to the exact Root bytes and current repository snapshot before it may be called `verified`.

The host creates a compact content-addressed receipt without storing raw command output. Receipt capture is automatic: the user does not enter a hash, copy terminal output, confirm another step, or run another Workflow command. A later repository mutation invalidates earlier receipts. Active receipt records expire after 24 hours and are removed after successful persisted closeout; only their hashes remain in Delivery Evidence.

If a machine Check is claimed as `verified` but its receipt is missing, mismatched, expired, rootless, or tied to an older repository state, Workflow reports `supported` or `unavailable` instead. It names the exact Check, command, and working directory to rerun. A host-observed failed Check remains `failed` and blocks delivery. If that failure arrives after Evidence was already recorded, Workflow invalidates the old tip and uses one internal continuation to persist honest replacement Evidence; the next Review can route directly to correction or replan. Checks intentionally reserved for human review or approval do not require machine receipts.

Closeout, status, and review report constraint effectiveness only for the current delivery. A normal success stays compact. When attention is needed, the response adds:

- **What happened:** the current outcome and evidence coverage.
- **Human attention:** the decision or judgment that cannot be automated.
- **Problems:** each problem, why it matters, and its exact resolution.
- **Next step:** one Now/How/Why action, plus Off track only when blocked.

This does not create cross-run telemetry or automatic Learning.

## Command map

| Need | Cursor | Codex | What it means |
|---|---|---|---|
| Create or replace the Intent Root | `/plan-work` | `$plan-work` in Plan mode | Define goal, acceptance, authority, risk, and required Checks. |
| Implement the approved Root | **Implement Plan** | **Implement Plan** | Human approval to edit only inside the Root. |
| Recover missing Evidence | `/close-work` | `$close-work` | Read-only recovery; normal implementation closes out natively. |
| Review delivery | `/review-work` | `$review-work` | Fresh read-only phase in the current task; independent verdict plus a plain-language result explanation and technical traceability. |
| Apply one approved correction | `/correct-work` | `$correct-work` | Execute only the current Findings-backed `cp-*` correction. |
| Accept an evidence gap once | `/accept-work provisional` | `$accept-work provisional` | Acknowledge provisional proof without calling it verified. |
| Inspect current state | `/work-status` | `$work-status` | Derive a read-only snapshot from the current Schema-5 chain. |
| Refresh the explanation | `/explain-work` | `$explain-work` | Recreate the same read-only explanation later or for a selected Root. |
| Persist confirmed guidance | `/learn-from-work` | `$learn-from-work` | Apply bounded project guidance only from eligible achieved work. |

## Manual states

A state is a derived snapshot, not a stored approval or artifact. Read the state together with its blockers, required actor, and `next_action`; the same broad state can have different concrete recovery instructions.

### intent-clarification

The Root is not intent-ready because a material goal, acceptance, public behavior, authority, or risk decision remains open. Answer the stated question or replace the Root; the agent must not guess the missing Intent.

### root-plan-review

A ready `wp-*` Intent Root exists, but implementation has not produced Delivery Evidence yet. Inspect the Root and use **Implement Plan** only if its goal, acceptance, scope, risk, and authority are correct.

### root-review

Delivery Evidence exists and a fresh read-only review phase must assess it against the approved Root. Start `/review-work` or `$review-work` in the current task; a new task is optional, not required. Do not treat implementer claims or closeout alone as the final verdict.

### waiting-human

Workflow needs a human decision or missing exact context. Read the blocker and `next_action`: typical cases are answering a clarification, authorizing one bounded correction, or supplying the current artifact chain.

### replan

The current Root or artifact chain cannot safely authorize the required work. Create a new `wp-*` Root with `/plan-work replan` or `$plan-work replan`, preserve confirmed decisions, and approve the replacement before implementation.

### delivery-ready-provisional

No known failed required Check permits a blocking conclusion, but some proof is incomplete, inspection-backed, or unavailable. Either improve the Evidence and review again or explicitly accept the evidence gap with `/accept-work provisional` or `$accept-work provisional`.

### accepted-provisional

The human accepted the current evidence gap once. This does not upgrade Evidence to `verified`, does not create qualifying history or Learning authority, and is not persisted; a later status call returns `delivery-ready-provisional` again.

### achieved

A fresh Manual review found `achieved/verified/none`. Repository-only delivery is complete and the review already includes its final explanation; `/explain-work` can refresh it and eligible Learning remains optional.

### blocked

A known failure or safety boundary prevents delivery. Provisional acceptance cannot override it. Follow the reported correction, clarification, or replan path and review the resulting Evidence again.

### failed

Workflow could not produce a valid result for the requested operation. No success or authority follows from the failed call; repair the reported input, chain, or environment issue before retrying.

### stopped

The selected subject is intentionally non-actionable. In Manual status this commonly represents read-only Workflow-3 or Workflow-4 history, which remains inspectable but cannot be resumed, accepted, or promoted to current Workflow-5 proof.

## Intent Root and Plan

The `work-plan` (`wp-*`) is the immutable authority boundary. It fixes the observable goal, acceptance, non-goals, constraints, risk, allowed roots, protected paths, dependencies, external effects, and repository-only finish line. Implementation Strategy may adapt inside that envelope; material changes to Intent, public behavior, scope, risk, dependencies, or external effects require a replacement Root and fresh human approval.

Required Checks should be the cheapest falsifiable proof sufficient for essential acceptance and material risk. Deferred Checks are visible but are not closeout gates.

Planning and review silently consider correctness, security, maintainability, performance, efficiency, and comprehensibility. Only dimensions material to Acceptance, risk, or a Hard Trigger become Checks. Workflow does not require all six, and property tests, mutation tests, complexity gates, performance probes, or external scanners remain optional when cheaper evidence is sufficient.

## Artifacts, tips, and handoff

Manual Workflow uses one exact Schema-5 chain:

- `work-plan` (`wp-*`): the approved Intent Root.
- `delivery-evidence` (`de-*`): builder-owned observations, changed paths, Check grades, and repository binding.
- `work-review` (`wr-*`): a deterministic host-built fresh verdict and `next_action` bound to one Evidence tip. The reviewer supplies only closed semantic input. The only Evidence-free variant is a host-built root-boundary Review that can request only a separately approved replan.
- correction (`cp-*`): a Findings-backed bounded fix referenced by a Review; its Evidence is a delta on the existing chain.

A **tip** is the current endpoint of a plan, evidence, or review lineage. A predecessor remains immutable history; a newer tip supersedes it for current decisions. Explicit IDs win over automatic selection, and ambiguous or mixed tips authorize nothing.

For a new correction, closeout reruns correction Checks plus inherited Root Checks that are failed, missing, explicitly affected, fingerprint-stale, or ambiguous. Unaffected proof remains reusable only at its existing grade: supported, partial, or unavailable proof is not upgraded and still prevents verified achievement. If a Root Check and correction Check are semantically equivalent, one real probe on the same stable closeout state may support both explicit IDs. The resulting delta is ready for the next review without an extra `/close-work` loop.

Task artifacts are authoritative. The content-addressed handoff cache only transports exact artifact bytes and protected builder provenance between tasks or hosts. `cached`, `handoff_persisted`, or a loaded context never grants approval, acceptance, verification, qualification, or Learning authority. If optional transport fails, the exact current task-local chain remains valid and Review continues normally. Attach an artifact only when deliberately continuing in another task or host. New raw Review envelopes cannot be recorded as authority; older immutable Reviews remain readable.

On Codex, the lifecycle Hook also retains exact task-local Root, generated Evidence, and emitted Review bytes under the Root-content hash. A correction therefore receives the Source Review and predecessor Evidence automatically without reconstructing Review text through MCP. The Hook derives the complete repository path inventory itself; any caller `changed_paths` list is non-authoritative and cannot narrow or widen Evidence or Authority checks. A native failure is shown explicitly in the Stop response rather than leaving a visible closeout report without Evidence.

Source changes, installed plugin copies, loaded tasks, and persistent handoff state are separate boundaries. Building the repository does not update an installed Cursor/Codex bundle; installation still requires an authorized local deployment and a fresh host task/reload. Reloading does not rewrite `~/.geldmacher/workflow/handoff`, so an immutable cached conflict needs an explicit hash-bound dry-run and recoverable quarantine before the authoritative exact task Review can be recorded.

## Evidence grades

Review may preserve or lower confidence but never raise an Evidence grade merely by wording.

### verified

The required Check was directly observed on a named surface with a method, expected result, and at least one repetition. Every required Check must be `verified` for `achieved` Manual delivery.

### supported

Repository inspection or another meaningful observation supports the claim, but the proof is not strong enough for `verified`. Delivery remains provisional.

### partial

Some relevant proof exists, but it does not fully cover the required Check or expected result. Delivery remains provisional unless another known failure blocks it.

### unavailable

The required proof surface could not be used and the Evidence names the concrete limitation. Unavailable is honest missing proof, not success and not a failed Check.

### failed evidence

The observed result contradicted the required Check. Evidence status is `blocked`; neither review prose nor provisional acceptance may override it.

Delivery Evidence status summarizes the grades: `complete` for fully verified Evidence, `provisional` for non-failed gaps, and `blocked` for known failure.

## Review results and next actions

A `work-review` always has `status: complete`; that means the review operation finished, not that delivery succeeded. Read its three decision fields together:

- `assessment`: `achieved`, `provisional`, `mostly-achieved`, `partially-achieved`, `not-achieved`, or `insufficient-evidence`.
- `delivery_status`: `verified`, `provisional`, or `blocked`.
- `next_action`: `none`, `accept-provisional`, `correct`, `clarify`, `replan`, or `retry-review`.

Common combinations:

| Result | Meaning | Human handling |
|---|---|---|
| `achieved / verified / none` | Required Checks and Root acceptance are verified. | No further Workflow action is required. |
| `provisional / provisional / accept-provisional` | Work is plausible without a known failed Check, but proof remains limited. | Improve proof or explicitly accept the gap once. |
| blocked with `correct` | One current, in-authority Findings-backed correction is available. | Authorize `/correct-work`, then start a fresh review. |
| blocked with `clarify` | A human decision is required before the verdict can progress. | Answer the stated question; do not let the agent guess. |
| blocked with `replan` | Intent or authority must change. | Create and approve a replacement Root. |
| `insufficient-evidence` with `retry-review` | The reviewer lacks required proof or exact context. | Close out or attach Evidence, then review again. |
| root-boundary `insufficient-evidence / blocked / replan` | One recovery proved that the old Root can no longer produce trustworthy Evidence because baseline, workspace binding, or path authority was lost after mutation. | Create a lineage-bound replacement Root and approve it separately; do not correct or accept the old delivery. |

`review_route` describes review depth, not quality: `inline` is the bounded primary review, `targeted` adds one relevant specialist, and `full` adds the required delivery/risk/design coverage for broader or higher-risk work.

A root-boundary Review is deliberately narrower than a delivery review. It has `review_basis: root-boundary`, `latest_evidence_id: null`, and a short-lived protected host receipt containing `receipt_id`, `observed_at`, a typed irrecoverable `recovery_error_code`, the exact Root hash, the current repository-snapshot hash, and canonical observed paths. Coverage is empty, there are no Findings, and the only action is `next_action: replan`. The validator rechecks the protected record and current snapshot; portable/rootless validation, missing host trust, stale receipts, and transient tool or handoff failures grant no replan. It exists to prevent the deadlock where Evidence cannot be created but a lineage-preserving replan previously required an Evidence-backed Review.

## Reading the review explanation

Every emitted review explains the result before presenting technical traceability. `What was achieved`, `What this means`, and `Verification and limits` must be understandable without code knowledge or the implementation transcript. `Technical traceability` then provides exact Root, Evidence, Review, Check or Finding IDs and the relevant paths or symbols for maintainers and later agents.

Only derived `achieved` work is labeled **Final repository explanation**. Provisional, correctable, blocked, or otherwise incomplete work is labeled **Preliminary explanation** and names its blockers plus the next safe action. The reviewer produces this directly; `/explain-work` is an optional read-only refresh, not an extra completion gate or success proof.

## Human authority and boundaries

Planning, **Implement Plan**, correction, provisional acceptance, replan, and Learning are separate human authorizations. Starting a fresh read-only Manual review phase in the current task authorizes final verification; a verified review completes directly, while provisional delivery needs the separate one-time acceptance.

Host sandbox and tool approvals remain authoritative. Workflow preference metadata can describe expected host approval behavior but grants no permission. Missing, conflicting, stale, mixed, or invalid chains fail closed.

## Model ownership and subagents

The human selects the primary model. Workflow does not silently route Manual work through controller model pools. Bounded subagents are optional; they inherit the selected parent or use an explicitly configured approved Manual candidate. Their output is advisory until the primary verifies and integrates it. Unknown or divergent model identity fails closed where attestation is required.

## Learning

Learning is optional and always human-started. Manual Learning requires the exact current `achieved` chain with verified Evidence and Review. Provisional acceptance, blocked or stale work, transcripts, cache contents, and historical lookup do not authorize guidance changes. `/learn-from-work` or `$learn-from-work` applies only bounded, confirmed project guidance and never publishes automatically.

## Recovery and troubleshooting

Every real block should name both **Blocker** in plain language and **Resolution** as one concrete recovery action. Technical codes, IDs, hashes, receipts, and paths remain available under Technical traceability; they are not the primary explanation.

- Missing Evidence after implementation: start Review normally; it first attempts one internal idempotent closeout. Use `/close-work` or `$close-work` only when that diagnostic recovery is explicitly requested.
- Evidence cannot exist after one recovery because the baseline, Root binding, workspace identity, or path authority was irrecoverably lost: emit the constrained root-boundary Review and use its sole replan action.
- Missing or ambiguous artifacts: provide the exact current `wp-*`, `de-*`, and `wr-*` chain; do not reconstruct it from filenames or memory.
- Optional handoff/cache unavailable: stay in the current task and continue with Review. Export the exact artifact only if you intentionally switch tasks or hosts.
- Provisional proof: inspect the named limitations, improve the relevant Checks when practical, then review again; otherwise accept the gap explicitly.
- Failed Check: correct the current Findings-backed issue or replan. Never relabel failure as unavailable.
- Correction proof: run correction Checks plus failed, missing, affected, stale, or ambiguous Root Checks; reuse unaffected proof at the same grade and never repeat an unchanged review to raise confidence by wording.
- Changed goal, scope, public behavior, risk, dependency, or external effect: replan and obtain fresh approval.
- Workflow-3/4 history: inspect it read-only and create a new Workflow-5 Root for new work.
- Unsure what happened: run `/work-status` or `$work-status`, then `/explain-work` or `$explain-work` against the exact chain.

## What Workflow does not do

Manual Workflow finishes at reviewed local repository delivery. It does not automatically push, open or merge a pull request, deploy, access production, integrate another branch, publish Learning, fabricate unavailable proof, or convert a provisional or failed result into verified success.

For the differences between Manual, Supervised, and Autonomous operation, see the [profile guide](https://github.com/geldmacher/workflow/blob/main/docs/profiles.md).
