# Delivery Evidence output

Do not author `delivery-evidence` directly. Fresh Manual Review invokes the bundled deterministic local builder with exact Schema-6 Root and lineage, closed semantic input, and unprotected observations. The builder computes every ID and hash and rejects caller-provided verified claims, hashes, attestations, or receipts.

The builder returns paired Evidence and Review or neither. Local observations are limited to supported, partial, unavailable, or failed, so unprotected success remains provisional. Failed required Checks remain failed. Optional protected sealing may later append a new pair after validating protected attestations; it never edits the local pair.

Output leads with lifecycle outcome, every finding, Check grades, limitations, and the Review artifact's exact next action. Technical traceability includes Root, Evidence, Review, artifact, workspace, and snapshot hashes. It excludes concrete execution data.
