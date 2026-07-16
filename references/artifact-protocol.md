Schema 2 supports `work-plan|delivery-evidence|work-review`; an embedded `cp-*` belongs to one review. The immutable `wp-*` roots every delivery and review. Native **Implement Plan** approves initial execution; argument-free `/correct-work` approves only the newest unique actionable correction. The human controls execution, correction, repetition, and stopping.

Artifact IDs use the type prefix plus a stable unique slug; timestamps are optional metadata and never determine topology. External constraints are copied directly into the root plan. Resume is reconstructed from repository state, Completion Probes, and the latest effective evidence.

Validation is semantically strict and syntactically tolerant. Cursor progress, explanations, heading aliases, order, casing, whitespace, harmless empty forms, additional metadata, computed assurance, route, and presentation details normalize or diagnose. Multiple competing candidates, ambiguous tips, invalid root links, scope/risk expansion, missing decision-relevant proof, unsafe reuse, or absent human approval remain blocking.

The native plan uses Cursor's Plan representation. Evidence and review are normally returned as compact chat artifacts, but Cursor may surround them with user-facing text. The Workflow does not require temporary serialization or repository files merely for protocol handling.

Cursor modes define available capabilities. Runtime guidance describes desired outcomes and authorization boundaries without maintaining tool allowlists, denylists, or capability probes.
