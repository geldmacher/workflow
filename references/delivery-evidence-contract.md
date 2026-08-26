# Evidence Schema 6

Delivery Evidence is host-built from one exact Schema-6 Root and the current subject. It records Root and lineage IDs, intent hash, workspace snapshot hash, changed paths, affected objectives, Check IDs, grades, observations, evidence hashes, limitations, and optional protected harness-attestation hashes.

`full` is the single initial Root delivery, `delta` resolves one exact correction, and `seal` linearly follows one finding-free provisional Review without rewriting it. Seal Evidence has no reused coverage and is valid only when every required Root Check has fresh protected verified evidence.

Evidence never contains authoritative commands, working directories, tools, models, route choices, retry recipes, or execution policy. Such details remain private to the harness or opaque trace.

A passing attestation binds Check verification intent, Root hash, workspace binding, and snapshot hash and may support `verified`. Missing attestation caps the Check at supported or unavailable. A reported failure is `failed` and remains blocking; only separately bound provenance may describe it as attested. A mismatched or contradictory binding is rejected. Incomplete proof remains provisional.
