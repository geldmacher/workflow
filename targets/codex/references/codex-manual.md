# Codex Manual facade

Workflow on Codex implements the complete Skills-first Manual Schema-6 lifecycle: Plan → Implement → Review → Correct or Replan → Review → provisional Accept.

Codex Plan mode and the exact `<proposed_plan>` provide implementation Root authority after separate human approval. The bundled `dist/manual-workflow.mjs` validates Root bytes, constructs Review artifacts, derives status, and performs ephemeral provisional acceptance. Manual use requires no MCP, Host Adapter, MCP Roots, Hook Trust, cache, handoff, or persistent Workflow state.

The host sandbox and human approvals remain authoritative. Workflow chooses no command, tool, model, route, retry, sandbox, worktree, or framework strategy. There is no Workflow execution engine, model pool, Verification Profile, automatic merge, push, publication, or deployment.

Every skill reads the shared Manual and builder contracts plus its task-specific Schema-6 references. Host settings and project-harness configuration remain outside Workflow.

Manual authority is task-local. A fresh task must receive the exact current Root and every referenced Evidence/Review artifact explicitly. Hook state, handoff/cache, MCP state, random server values, IDs without bytes, harness self-assertion, and another task cannot reconstruct authority. Every other artifact schema is unsupported.

Fresh `$review-work` is repository-read-only. The project harness supplies opaque unprotected observations; the local builder computes IDs and hashes and returns Evidence plus Review atomically. Ordinary repository-internal scope drift remains visible and provisional. Protected, approval-required, escaping, or failed paths and Checks remain blocking, and invalid or ambiguous input returns Shadow with no pseudo-artifact.

The MCP server remains registered for optional automation-compatible surfaces and protected sealing. Those failures never change Manual status or ordinary Codex availability. A future protected sealing result appends new artifacts and never edits an existing provisional pair.
