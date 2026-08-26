# Human-first optional MCP output

This contract applies only to Automation and optional protected sealing. The Skills-first Manual lifecycle uses `manual-builder-contract.md` and makes no MCP call.

Manual MCP output has three layers: `Quick decision`, `Details`, and an authoritative technical traceability block.

Lead with the repository outcome and formal evidence status as separate statements, followed by at most one primary limitation, actual blockers, and exactly one conceptual recovery or lifecycle action. Keep Root, Evidence, Review, artifact, workspace snapshot, and harness status identifiers in traceability.

Formal Review output identifies its protected bindings and committed Schema-6 artifacts with `persistence_scope: native-review-invocation`. Shadow Review output is labelled `mode: shadow` and `status: unavailable`, lists any sanitized findings under `Repository findings (non-authoritative)` without claiming Plan conformance, and states `artifacts_persisted: false`, `workflow_state_changed: false`, and `persistence_scope: none`. It gives exactly one recovery action. Shadow output never invents Evidence or Review identifiers and never reports `verified` or `supported` evidence.

`handoff_persisted` is a separate non-authoritative task/cache transport statement. It does not establish artifact persistence or Workflow state change and must not be presented as the committed native Review-invocation boundary.

Do not expose or interpret concrete harness commands, tools, models, routes, retries, sandboxes, or worktrees. Transport warnings are limitations, not invented authority failures. Structured content remains authoritative.
