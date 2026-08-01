# Manual, supervised, and autonomous

The three profiles are not three different workflows. They use the same approved Intent Root, repository boundary, evidence rules, fresh review, and fail-closed safety checks. The profile changes only how much of the execution loop the controller may handle and when a human must decide.

| Profile | Who drives the work? | Who accepts the delivery? | What is needed? |
|---|---|---|---|
| `manual` | The human starts implementation and every correction in Cursor. | A verified review completes the work; a provisional result needs an explicit one-time human acceptance. | The installed plugin, a human-selected Cursor model, and approval of the Plan. No automation configuration or certification is required. |
| `supervised` | The controller may plan, write, verify, review, and correct inside the approved boundary. | A human accepts every final delivery. | Automation configuration, repository opt-in, complete budgets, exact model routing, and positive live capability proof for the installed environment. |
| `autonomous` | The same controller operates, but only for an exactly qualified kind of work and repository region. | A fully verified delivery can complete without a final human acceptance. | Everything required by `supervised`, plus an approved Verification Profile, an exact Qualification Key, certified models and region, and enough accepted verified supervised history. |

## What all profiles have in common

Every profile starts from a human-approved Intent Root. The goal, acceptance criteria, scope, risk, protected paths, dependency rules, budgets, external effects, and repository-only delivery boundary stay fixed. Execution may adapt only inside that boundary.

Every profile also keeps claims tied to evidence. Missing evidence is not called success, and a known failed required Check blocks delivery. None of the profiles may automatically push, open or merge a pull request, deploy, access production, integrate a branch, or publish learning.

## Manual

Use `manual` for normal interactive work or whenever controller certification is unavailable. You select the primary model in Cursor and keep control of each important transition:

```text
/plan-work
Cursor: Implement Plan
/review-work
```

Implementation performs deterministic closeout. Use `/close-work [wp-id]` only to recover a missed closeout. If review requests a bounded correction, start `/correct-work`; if the intent must change, use `/plan-work replan` and approve the new Root.

Manual is ready when the plugin is installed or linked and Cursor can run its commands. It does not need User Config, Project Policy, a Worker runtime, a Capability Receipt, a Verification Profile, or qualifying history.

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
- The Capability Receipt positively certifies all required repeated live probes, the exact models, the dependency-audit result, and the Qualification binding. High or Critical dependency findings block activation; an allowed Moderate finding needs separate hash-bound human risk acceptance.
- The exact Qualification Key has enough fully verified, human-accepted supervised Runs.
- The work has no Hard Trigger or planned human review gate.

The human still approves the prepared Intent Root. After that, a fully verified autonomous delivery may reach `achieved` directly. Missing or incomplete non-safety evidence visibly downgrades the run to `supervised`, so a human must accept it. A safety violation or known failed Check blocks the run instead of downgrading it.

## Which profile should I choose?

- Choose `manual` unless you specifically need controller orchestration.
- Choose `supervised` after the installed environment has positive live capability proof and you still want a human to accept every delivery.
- Request `autonomous` only for an exact, already qualified key. If any qualification proof is missing or stale, expect `supervised` behavior.

The shipped controller currently keeps both automated profiles in read-only Shadow Mode until the live gates for the exact installation are positive. Repository tests alone do not enable writable automation. See [configuration](configuration.md), [capability status](capability-spike.md), and the [certification runbook](certification-runbook.md).
