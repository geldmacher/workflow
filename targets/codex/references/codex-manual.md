# Codex Manual Facade

Workflow on Codex implements the Manual Schema-6 lifecycle. Codex Plan mode and the exact `<proposed_plan>` provide Root authority. The path is Plan → implementation → fresh same-task Review → human decision. Implementation and correction finish normally; fresh Review constructs Evidence and Review atomically through the generic project-harness boundary.

The host sandbox and human approvals remain authoritative. Workflow chooses no command, tool, model, route, retry, sandbox, worktree, or framework strategy. There is no Workflow execution engine, model pool, Verification Profile, automatic merge, push, publication, or deployment.

Every skill reads the shared [Manual Workflow contract](./manual-workflow-contract.md) and the task-specific Schema-6 references it names. Host settings and project-harness configuration remain outside Workflow.

Manual authority is task-local. Review resolves exact Schema-6 Root bytes from the current Plan-mode context and extends only exact predecessor bytes already present in this task. Hook state, handoff/cache, IDs without bytes, and another task cannot restore authority. Every other artifact schema is unsupported.

Fresh `$review-work` declares repository-read-only intent and invokes `workflow_closeout` once in `work-review` mode. The project harness alone selects inspection details and returns protected before/after snapshots plus Check attestations. Missing attestations cap Evidence at provisional; failed attestations block; contradictory bindings are rejected.

If no exact native Root is available, only Review blocks. Recoverable MCP transport or presentation failure preserves a valid active Root and selection. Ordinary Codex use remains available when Workflow or the harness is unavailable.
