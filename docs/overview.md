# Workflow 6 overview

Workflow 6 is a small host-neutral delivery kernel. It standardizes Plan → Implement → Review → Correct or Replan while preserving human authority, exact lineage, honest evidence, and repository-only delivery.

## Ownership boundary

Workflow owns:

- Schema-6 Intent Roots and authority
- lifecycle phases and human gates
- exact artifact lineage and content hashes
- evidence grades and limitations
- protected generic harness receipts and attestations
- fresh Review and deterministic artifact construction

The project harness owns:

- commands and working directories
- programs, tools, models, and framework knowledge
- sandboxes, worktrees, retries, and concurrency
- project-specific verification strategy
- concrete process execution

The Workflow core never evaluates those concrete choices. It may retain opaque trace but cannot derive authority or evidence from it.

## Manual

Manual is the default and requires no controller configuration. The human approves the Root and native implementation action. Review is repository-read-only at the conceptual boundary. Finding-free supported evidence may establish achieved repository outcomes without pretending to be verified; a compatible protected harness can separately verify them. Ambient dirty-tree state remains visible without becoming delivery scope.

## Supervised

Supervised delegates a phase through an external Host Adapter and its deployment-bound Harness Capability Receipt. The Harness executes inside Root authority, returns a transition-bound protected PhaseResult, and the human accepts delivery through an exact revision-bound host decision.

## Autonomous

Autonomous is exact and narrow. It requires the supervised contract plus the Root-bound Qualification Key, matching capability receipt and verification-intent hashes, and fully verified evidence. It is never a repository-wide switch.

## Failure behavior

Missing or invalid Host Adapter protection returns Shadow Mode. Direct Harness modules and self-hashes establish no trust. Mismatched attestations are rejected. Missing attestations cap evidence. Failed attestations block delivery. Persisted Prepare/Stage/Result-Ready/Commit-Ready/Commit transitions make replay and crash recovery exact. A live foreign owner is observed without polling, and an unavailable mutating result is never converted into blind re-execution. Recoverable transport failures preserve a valid active Root and exact human selection while revoking only the in-flight receipt. Hooks remain availability-first so ordinary host operation is not held hostage by Workflow infrastructure.
