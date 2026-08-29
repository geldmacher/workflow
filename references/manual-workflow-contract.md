# Manual Workflow contract

Manual is the default host-neutral lifecycle:

1. A human approves one exact Schema-6 Intent Root in the host-native Plan.
2. The host and project harness implement desired outcomes inside Root authority.
3. Fresh Review is repository-read-only. The project harness chooses all concrete inspection details and supplies closed unprotected observations.
4. The bundled local builder validates exact bytes, classifies authority and lineage, computes hashes and IDs, and builds Evidence, Review, and human presentation atomically.
5. Unprotected success is at most provisional; failed required Checks remain blocking.
6. A human separately chooses correction, replan, another Review, or ephemeral provisional acknowledgement.

Workflow owns lifecycle, intent, authority, lineage, evidence grades, artifact construction, and human gates. The harness owns commands, tools, models, framework knowledge, sandboxes, worktrees, retries, and verification strategy.

Manual requires no MCP, adapter, MCP Roots, Hook Trust, cache, receipt, or persistent state. Same-task exact bytes are the normal transport. A fresh task requires explicit attachment of the Root and every referenced artifact. Missing or invalid input produces Shadow with no pseudo-artifact. Ordinary repository-internal paths outside `allowed_roots` stay visible and provisional; protected, approval-required, malformed, or escaping paths remain blocking or Shadow as appropriate. Hooks are optional and availability-first so ordinary Cursor and Codex use remains free.

Every local request may carry `presentation_locale: de|en`, chosen by the Skill from the active conversation language and defaulting to `en`. It changes only fixed presentation text. Human output leads with one decision and one next action; full traceability and exact artifacts remain available through default-closed disclosure. Implementation and correction completion means only that phase is complete and fresh Review is pending, never that delivery or Workflow is complete.

The builder preserves canonical action tokens. Target facades decorate only the token emitted by the operation's authoritative source:

| Token | Cursor | Codex | Portable |
|---|---|---|---|
| `implement-plan` | **Implement Plan** | **Implement Plan** | `implement-work` |
| `correct-plan` | revise the native Plan | revise the native Plan | revise the Root with `plan-work` |
| `create-schema-6-root` | `/plan-work` | `$plan-work` | `plan-work` |
| `create-root-plan` | `/plan-work` | `$plan-work` | `plan-work` |
| `review-root` | `/review-work` | `$review-work` | `review-work` |
| `correct` | `/correct-work` | `$correct-work` | `correct-work` |
| `accept-provisional` | `/accept-work provisional` | `$accept-work` | `accept-work` |
| `replan` | `/plan-work replan` | `$plan-work replan` | `plan-work replan` |
| `retry-review` | `/review-work` | `$review-work` | `review-work` |
| `clarify` | answer the named decision | answer the named decision | answer the named decision |
| `provide-artifacts` | provide the exact chain | provide the exact chain | provide the exact chain |
| `none` | no further Workflow action | no further Workflow action | no further Workflow action |

The mapping adds no new action, authority, or assessment. The canonical token remains visible in technical details.

Only Schema 6 is accepted. Verified requires a separately protected harness attestation bound to Check intent, Root, workspace, and snapshot. The registered MCP server is reserved for opt-in Automation, automation status, and optional protected sealing; its failure cannot change Manual status. Missing attestation is provisional; failed remains failed. Repository-only is the finish line: no automatic push, PR, merge, deploy, production access, publication, or learning.
