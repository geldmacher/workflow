# Workflow 5 certification runbook

Certification is granular. A positive result applies only to one Plugin/runtime/lock tuple plus Route Pool hash, Verification Profile hash, task class, and certified repository region.

Manual does not need this runbook. Supervised needs the live controller and safety capabilities proved here, but still ends with human delivery acceptance. Autonomous needs those same proofs plus an exact Qualification binding and successful supervised history; only then may a fully verified delivery finish without final acceptance. See the [profile guide](profiles.md) for the plain-language comparison.

1. Run `npm run release-check`; it includes the isolated package dry run and canonical surface limits.
2. Validate every candidate with `/work-models`; record exact catalog and observed configurations.
3. Run `/work-verification draft <surface>`, complete the project Skill and Feature Map, then prove launch, doctor, representative drive, observation, evidence, reset, and cleanup. Store proof externally.
4. Human-approve the exact combined Verification Profile hash; confirm `audit: clean`.
5. In an installed Marketplace copy, prove MCP parity, worker/runtime hashes, write boundary, network isolation, secret isolation, cancellation, crash recovery, exact models, and live Cursor harness.
6. Issue Capability Receipt Schema 4 with a capability vector and one explicit Qualification binding. Negative observations remain negative; never infer a capability.
7. Release manual. Exercise supervised in Shadow Mode. Count only accepted, fully verified supervised Runs for the exact Qualification Key.
8. Enable autonomous for that key only. Verify that missing evidence visibly downgrades to supervised, while a known failed Check blocks.

At every stage confirm no push, PR, merge, deployment, production access, automatic branch integration, or automatic learning occurs.
