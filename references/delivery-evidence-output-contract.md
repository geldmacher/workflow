# Delivery Evidence output

Do not author `delivery-evidence` directly. Fresh Review calls the deterministic builder with exact Schema-6 Root and lineage plus closed semantic input. Cursor supplies a protected Root/workspace receipt; Codex and portable clients supply exact bytes.

The builder asks the configured project harness for a generic PhaseResult, validates attestation bindings, derives evidence grades, and returns paired Evidence and Review or neither. Missing harness capability creates provisional evidence and a limitation. Failed attestations remain failed.

Output leads with lifecycle outcome, Check grades, limitations, and one next action. Technical traceability includes Root, Evidence, Review, artifact, workspace snapshot, and harness receipt hashes. It excludes concrete execution data.
