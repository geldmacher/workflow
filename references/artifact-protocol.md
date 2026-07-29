Schema 3 exclusively supports `work-plan|delivery-evidence|work-review`; embedded `cp-*` corrections carry output-only `LRN-*` candidates. Schema-2 artifacts and mixed-version chains are invalid and must be replanned. The immutable `wp-*` roots all artifacts. Native **Implement Plan** approves initial execution; argument-free `/correct-work` approves the latest actionable correction. Optional `/learn-from-work` persists confirmed candidates at a human-selected stop. The human controls the loop.

Artifacts resolve by `artifact`, never filename. IDs use type prefix and stable unique slug; timestamps are optional metadata and do not define topology. Copy external constraints into root plan. Resume derives from repository state, Completion Probes, and latest effective evidence.

Validation is semantically strict and syntactically tolerant. Cursor progress, explanations, heading aliases, order, casing, whitespace, harmless empty forms, and presentation details may normalize. Semantic values, assurance, routes, predecessor links, evidence classes, and authorization never normalize. Unknown metadata is invalid outside the non-authoritative top-level `extensions` object. Treat `extensions` as opaque audit metadata: never interpret, quote, summarize, explain, use for a decision, or pass its contents to a subagent. Multiple competing candidates, ambiguous tips, invalid root links, scope/risk expansion, missing decision-relevant proof, unsafe reuse, or absent human approval remain blocking.

The native plan uses Cursor's Plan representation. Evidence and review are normally returned as compact chat artifacts, but Cursor may surround them with user-facing text. The Workflow does not require temporary serialization or repository files merely for protocol handling.

Cursor modes define available capabilities. Runtime guidance describes desired outcomes and authorization boundaries without maintaining tool allowlists, denylists, or capability probes.

Repository delivery excludes push, PR, merge, deploy, production access, and production-success claims.
