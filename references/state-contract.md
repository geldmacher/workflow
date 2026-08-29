# State contract

Status derives from exact artifact bytes and protected bindings. Current Schema-6 Root, Evidence, and Review tips are immutable and content-addressed.

Only Workflow-6 Runs and Schema-6 chains are state; no other generations are read.

Capability protection is atomic per deployment/workspace. A Run has one pending revisioned transition at most. PhaseResults persist execution lease, request, protected references, and finalization draft; only `commit-ready` consumes protection. Foreign live work is `in_progress`; unrecoverable mutating work reaches `stop`.

Trace is not authority. Status never runs work, approves tools, restores prose, or mutates the repository.

Manual status derives path classification from the exact Root and Evidence `changed_paths`. It preserves the Review action token exactly: `clarify`, `correct`, `replan`, `retry-review`, `accept-provisional`, or `none` is never renamed for presentation. Ephemeral provisional acceptance may include ordinary outside-allowed drift but cannot persist or create verified authority.
