# Evidence Schema 6

Delivery Evidence is host-built from one exact Schema-6 Root and the current subject. It records Root and lineage IDs, intent hash, workspace snapshot hash, changed paths, affected objectives, Check IDs, grades, observations, evidence hashes, limitations, and optional protected harness-attestation hashes.

Evidence never contains authoritative commands, working directories, tools, models, route choices, retry recipes, or execution policy. Such details remain private to the harness or opaque trace.

A passing attestation binds Check verification intent, Root hash, workspace binding, and snapshot hash and may support `verified`. Missing attestation caps the Check at supported or unavailable. An attested failure is `failed`. A mismatched or contradictory binding is rejected. Failed required Checks block; incomplete proof remains provisional.
