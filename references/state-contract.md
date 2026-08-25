# State contract

Status derives from exact artifact bytes and protected bindings. Current Schema-6 Root, Evidence, and Review tips are immutable and content-addressed.

Only Workflow-6 Runs and Schema-6 chains are state; no other generations are read.

Capability protection is atomic per deployment/workspace. A Run has one pending revisioned transition at most. PhaseResults persist execution lease, request, protected references, and finalization draft; only `commit-ready` consumes protection. Foreign live work is `in_progress`; unrecoverable mutating work reaches `stop`.

Trace is not authority. Status never runs work, approves tools, restores prose, or mutates the repository.
