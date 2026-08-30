# Portable Manual Workflow contract

This contract preserves Workflow's Skills-first Manual Schema-6 lifecycle on Agent Plugins clients. The client discovers Skills and an optional registered MCP component through the standard package; the project harness owns every concrete execution choice.

## Authority

- Planning, implementation, correction, review, provisional acceptance, and learning are separate human-authorized actions.
- The exact current-conversation Schema-6 Root and artifact chain are authority. A fresh task requires explicit attachment of all exact current bytes. MCP persistence is transport only; every other artifact schema is unsupported.
- Portable Plan, Review, status, and provisional acceptance use the bundled stateless local builder; the human separately approves implementation.
- Review and explanation are repository-read-only. The harness chooses inspection details and returns opaque unprotected observations.
- No action automatically merges, pushes, publishes, deploys, installs, changes host settings, or grants permissions.

## Artifact flow

1. `plan-work` creates one exact Schema-6 `work-plan` Root with a visible `wp-*` ID and validates it locally.
2. The human separately invokes `implement-work` with that approved Root available.
3. Implementation revalidates the exact Root, stays inside Root authority, and finishes without creating Evidence or Workflow state.
4. `review-work` declares repository-read-only intent; the project harness returns closed repository and Check observations.
5. Review passes closed Schema-1 input to the local builder, which builds Schema-6 Evidence, Review, hashes, and human presentation atomically.
6. A finding-free Review with every required Check supported or verified is terminal; otherwise `work-status` exposes exactly the bounded correction, replan, retry, clarification, or provisional-acceptance decision. Learning remains a separate invocation.

Unprotected inputs can never claim verified. Review partitions subject delivery paths from visible ambient dirty-tree state; only subject paths affect Root authority, and uncertain attribution is subject. Optional protected sealing requires harness attestations bound to Check intent, exact Root, workspace, and snapshot and appends a new artifact pair. Missing attestation keeps proof below verified without making supported outcomes incomplete; attested failure stays failed; contradictory binding is rejected. Workflow never inspects command, tool, model, framework, sandbox, worktree, retry, or route data.

## Action decoration

The builder retains canonical action tokens. The portable facade decorates exactly the emitted token through this complete mapping and retains the token as technical traceability:

| Token | Portable action |
|---|---|
| `implement-plan` | `implement-work` |
| `correct-plan` | revise the Root with `plan-work` |
| `create-schema-6-root` | `plan-work` |
| `create-root-plan` | `plan-work` |
| `review-root` | `review-work` |
| `correct` | `correct-work` |
| `accept-provisional` | `accept-work` |
| `replan` | `plan-work replan` |
| `retry-review` | `review-work` |
| `clarify` | answer the named decision |
| `provide-artifacts` | provide the exact chain |
| `none` | no further Workflow action |

There is no fallback mapping. The facade never invents another assessment or action. Implementation and correction handoffs report only phase completion with fresh `review-work` pending, never delivery or Workflow completion.

## Failure boundary

Invalid, stale, conflicting, mixed-version, or ambiguous Roots, artifact chains, observations, or workspace bindings return Shadow without pseudo-artifacts and stop only the affected phase. Ordinary subject paths outside `allowed_roots` remain visible and cap Manual delivery at provisional; ambient paths remain visible and non-blocking; protected, approval-required, or escaping subject paths remain blocking. MCP, adapter, Root, hook, cache, or automation unavailability cannot change Manual status or block ordinary client use. Prose, cache content, tool IDs, or opaque trace cannot manufacture approval, Evidence, or success.
