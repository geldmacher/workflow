# Manual, supervised, and autonomous

The three profiles are not three different workflows. They use the same approved Intent Root, repository boundary, evidence rules, fresh review, and fail-closed safety checks. The profile changes only how much of the execution loop the controller may handle and when a human must decide.

| Profile | Human responsibility | Agent or controller responsibility | Completion gate | Why this balance? |
|---|---|---|---|---|
| `manual` | Select the model, approve the Plan through **Implement Plan**, start the fresh review, and separately authorize corrections or replans. | Perform only the currently authorized planning, implementation, review, correction, or explanation phase. | The human-started fresh review completes on `achieved/verified/none`; only provisional delivery needs one explicit ephemeral acceptance. | Best for novel, interactive, or uncertified work where frequent human steering is more valuable than orchestration. |
| `supervised` | Enable the repository and routing policy, approve the exact Root, answer boundary questions, and accept every delivery. | Own the longer inner loop—Strategy, writing, verification, review, and bounded correction—in an isolated worktree. | A human accepts verified or explicitly provisional delivery. | Removes execution babysitting while retaining human accountability for the delivered result. |
| `autonomous` | Approve policy, Verification Profile, exact Qualification Key, and the prepared Root. | Run the same controller loop only inside the exactly certified task and repository region. | Complete verified evidence may reach `achieved`; a non-safety gap downgrades to supervised, while a failed Check or safety violation blocks. | Replaces per-delivery acceptance only where repeatability and prior supervised proof have earned it. |

## What all profiles have in common

Every profile starts from a human-approved Intent Root. The goal, acceptance criteria, scope, risk, protected paths, dependency rules, budgets, external effects, and repository-only delivery boundary stay fixed. Execution may adapt only inside that boundary.

Every profile also keeps claims tied to evidence. Missing evidence is not called success, and a known failed required Check blocks delivery. None of the profiles may automatically push, open or merge a pull request, deploy, access production, integrate a branch, or publish learning.

Cursor exposes all three profiles. Codex exposes the complete Manual path only and contains no Controller automation. Both hosts use the same native typed closeout kernel, repository baselines, mutation invalidation, and one-shot review recovery. Codex can hard-stop an incomplete completion, while Cursor issues one bounded recovery follow-up because its host boundary cannot provide an unbypassable stop. The five Manual MCP tools remain optional and compatible.

## Explanation in each profile

The explanation always has two audiences. Its first three sections tell a person what was achieved, what it means, and how it was verified without requiring the implementation history. `Technical traceability` follows with exact Workflow IDs, Checks or Findings, and paths or symbols so another maintainer or agent can continue safely.

| Profile and reviewed state | Trigger and producer | Human use | Agent use | Label |
|---|---|---|---|---|
| Manual `achieved` | The human starts fresh review; that reviewer explains directly. | Understand the completed repository result without replaying implementation. | Consume exact chain and change locations from technical traceability. | **Final repository explanation** |
| Manual provisional or blocked | The same reviewer explains the completed verdict. | See proof gaps, blockers, and the next safe action. | Continue only through the named review action. | **Preliminary explanation** |
| Supervised awaiting acceptance | Status, watch, or control returns the reviewed Run; the current outer agent explains from existing Run data. | Decide whether to accept verified/provisional delivery. | Use the technical layer without starting another controller phase. | **Preliminary explanation** until verified acceptance, then final |
| Autonomous `achieved` | The reviewed Run reaches `achieved`; the current outer agent explains from existing Run data. | Understand the result even though final acceptance was not required. | Use evidence and changed-path traceability for handoff. | **Final repository explanation**; downgraded or blocked Runs stay preliminary |

No row invokes the configured `explainer` Pool or a separate model call. `/explain-work` remains a human- or agent-requested read-only refresh. Codex supports the two Manual rows only; Cursor supports all four.

## Manual

Use `manual` for normal interactive work or whenever controller certification is unavailable. You select the primary model in Cursor and keep control of each important transition:

```text
/plan-work
Cursor: Implement Plan
/review-work
```

Implementation performs deterministic native closeout without a mandatory MCP call. The host validates every Manual Root locally, captures a baseline before mutation, and owns Evidence identity and status. Task artifacts remain authoritative; native handoff failure blocks rather than becoming success. Starting `/review-work` authorizes final verification and at most one read-only missing-Evidence recovery. A verified `achieved/verified/none` verdict completes the Root without another acceptance command. Use `/close-work [wp-id]` only to recover a missed closeout. If review requests a bounded correction, start `/correct-work`; if the intent must change, use `/plan-work replan` and approve the new Root.

Required machine-verifiable Checks are host-attested behind their existing tool calls. The agent runs the exact planned command, optionally with one leading `rtk` wrapper; the host binds the result to the current Root and repository snapshot. No extra human input is required. Missing or stale proof becomes a visible current-delivery gap with its exact rerun path, while success remains compact and proceeds directly to fresh review.

Manual is ready when the plugin is installed or linked and Cursor can run its commands. No automation configuration or certification is required: it does not need User Config, Project Policy, a Worker runtime, a Capability Receipt, a Verification Profile, or qualifying history. Do not impose controller ceremony on the Manual path.

## Supervised

Use `supervised` when you want the controller to own the longer execution loop while keeping final acceptance human-controlled. You approve the exact prepared Root before writing starts. The controller may then revise Strategy, use its approved model Pools, work in an isolated worktree, and collect Full Evidence without asking again for changes that stay inside the approved boundary.

To use writable supervised execution, all of these must be true:

- User Config defines exact ordered model Pools and planning budgets.
- Project Policy sets `supervised_enabled: true` and closes scope, protected paths, dependencies, external effects, risk, and maximum budgets.
- The exact installed Marketplace plugin, pinned Worker runtime, Cursor version, model routing, write boundary, network and secret isolation, budget cancellation, and Planner submission have positive live proof in a valid Capability Receipt.
- The human approves the displayed Intent Root hash and later accepts the verified or explicitly provisional delivery.

Start with `/work-models`, then prepare and approve one run with `/auto-work ... supervised`.

## Autonomous

Use `autonomous` only for repeatable work whose exact conditions have already earned that permission. It is not a repository-wide switch. Each Qualification Key binds one task class, Verification Profile hash, Route Pool hash, and certified repository region.

Autonomous needs every supervised prerequisite and all of the following:

- Project Policy sets `autonomous_enabled: true`.
- The Root uses the certified contract and binds the exact task recipe, Verification Profile, Route Pool, and repository region.
- The Verification Profile is proved, human-approved, and still audits as clean.
- The Capability Receipt positively certifies all required repeated live probes, the exact models, the dependency-audit result, and the Qualification binding. Any fresh dependency finding blocks activation until the minimal fix or a separate hash-bound human risk acceptance; High/Critical findings never pass implicitly.
- The exact Qualification Key has enough fully verified, human-accepted supervised Runs.
- The work has no Hard Trigger or planned human review gate.

The human still approves the prepared Intent Root. After that, a fully verified autonomous delivery may reach `achieved` directly. Missing or incomplete non-safety evidence visibly downgrades the run to `supervised`, so a human must accept it. A safety violation or known failed Check blocks the run instead of downgrading it.

## Learning closeout in each profile

Learning is never part of controller execution. In every profile a human separately invokes `/learn-from-work`; all trailing text is one supplemental Learning, not a source selector. The command uses only one exact source already present in the current task and refreshes its read-only `workflow_status.learning` projection before writing project guidance. A controller source additionally needs the short-lived, non-persisted `learning_source_receipt` returned by a state-establishing start, control, or answer response; selecting or watching a stored Run by ID does not create one.

| Profile | Eligible source | Human role | Agent/controller role |
|---|---|---|---|
| `manual` | Exact current achieved Schema-5 Root/Evidence/Review chain | Invoke Learning after the verified review and optionally provide one supplemental Learning. | The primary agent confirms candidates against the chain and repository, then applies only bounded project guidance. |
| `supervised` | Achieved verified Run, verified human delivery acceptance, and delivered content matching the current workspace | Accept the delivery, integrate its content, then separately invoke Learning. | Reviewer calls may propose bounded candidates during corrections; the controller only validates and records their lineage. The primary agent applies confirmed guidance later. |
| `autonomous` | Fully verified achieved Run whose delivered content matches the current workspace | Integrate the content and separately invoke Learning; no final delivery acceptance is needed for an undowngraded Run. | The same bounded candidate recording applies. A downgraded Run follows Supervised acceptance rules. |

Provisional, blocked, stale, ambiguous, stored-only, receipt-less, non-integrated, drifted, event-chain-invalid, or fresh-integrity-invalid sources stop without guidance mutation. Preparation status carries the same Learning projection shape but is always explicitly ineligible. Codex exposes only the Manual row and contains no controller Run surface.

## Which profile should I choose?

- Choose `manual` unless you specifically need controller orchestration.
- Choose `supervised` after the installed environment has positive live capability proof and you still want a human to accept every delivery.
- Request `autonomous` only for an exact, already qualified key. If any qualification proof is missing or stale, expect `supervised` behavior.

The shipped controller currently keeps both automated profiles in read-only Shadow Mode until the live gates for the exact installation are positive. Repository tests alone do not enable writable automation. See [configuration](configuration.md), [capability status](capability-spike.md), and the [certification runbook](certification-runbook.md).
