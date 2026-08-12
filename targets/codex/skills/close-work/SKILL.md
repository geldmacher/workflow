---
name: close-work
description: Recover deterministic Schema-5 delivery closeout without repository edits. Use when the user invokes $close-work for an implemented Root lacking current evidence.
---

# $close-work

Read [Manual Workflow](../../references/manual-workflow-contract.md), [artifact protocol](../../references/artifact-protocol.md), and [closeout contract](../../references/closeout-contract.md) completely.

Resolve one exact Root/chain from the task, then `workflow_artifact_context` as transport enrichment. Capture repository identity and a complete baseline before checks. Reuse only snapshot-bound evidence. Run missing Checks only when they cannot mutate the repository or external systems; otherwise mark them `unavailable`. A known failed Check remains `failed`.

Recompute the baseline and stop on drift. Return exactly one strict `closeout-input` with phase `review-recovery`, Checks, and summary; omit `changed_paths` because the lifecycle hook resolves the exact chain and derives the complete authoritative paths/snapshot before building and persisting Evidence. It then permits one read-only continuation. Without a pre-mutation baseline, verified observations are capped at `supported` and limitations remain explicit; known failures remain failed. `workflow_closeout` remains optional compatibility transport. This command grants no implementation, acceptance, learning, merge, push, publish, or deployment authority.

Run each machine Check as its exact standalone planned command and working directory; one literal leading `rtk` wrapper is allowed. The host records receipts automatically. Missing, stale, failed, rootless, mismatched, or mutation-invalidated proof cannot remain `verified`; follow the exact rerun in the returned Problem.
