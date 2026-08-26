# Manual Workflow contract

Manual is the default host-neutral lifecycle:

1. A human approves one exact Schema-6 Intent Root in the host-native Plan.
2. The host and project harness implement desired outcomes inside Root authority.
3. Fresh Review is repository-read-only. The project harness chooses all concrete inspection details and supplies closed unprotected observations.
4. The bundled local builder validates exact bytes, authority and lineage, computes hashes and IDs, and builds Evidence, Review, and human presentation atomically.
5. Unprotected success is at most provisional; failed required Checks remain blocking.
6. A human separately chooses correction, replan, another Review, or ephemeral provisional acknowledgement.

Workflow owns lifecycle, intent, authority, lineage, evidence grades, artifact construction, and human gates. The harness owns commands, tools, models, framework knowledge, sandboxes, worktrees, retries, and verification strategy.

Manual requires no MCP, adapter, MCP Roots, Hook Trust, cache, receipt, or persistent state. Same-task exact bytes are the normal transport. A fresh task requires explicit attachment of the Root and every referenced artifact. Missing or invalid input produces Shadow with no pseudo-artifact; invalid or drifting authority still fails closed. Hooks are optional and availability-first so ordinary Cursor and Codex use remains free.

Only Schema 6 is accepted. Verified requires a separately protected harness attestation bound to Check intent, Root, workspace, and snapshot. The registered MCP server is reserved for opt-in Automation, automation status, and optional protected sealing; its failure cannot change Manual status. Missing attestation is provisional; failed remains failed. Repository-only is the finish line: no automatic push, PR, merge, deploy, production access, publication, or learning.
