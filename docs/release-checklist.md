# Release checklist

- [ ] Schema-6 intent-only Roots pass and execution fields fail as unknown.
- [ ] Schema 6 is the only artifact contract and every other schema is rejected generically.
- [ ] No compatibility schemas, readers, fixtures, migrations, or transition tests are shipped.
- [ ] Generic Capability Receipt, PhaseRequest, PhaseResult, and Check Attestation schemas compile and match runtime validation.
- [ ] Passing, missing, failed, and mismatched attestations calibrate evidence correctly.
- [ ] Review preserves active Root, canonical workspace, and selection across recoverable transport failure.
- [ ] Core architecture contains no command, tool, model, sandbox, worktree, retry, or process policy.
- [ ] Hooks are availability-first and ordinary host use remains free.
- [ ] Cursor, Codex, and portable targets rebuild without drift.
- [ ] `$release-plugin` and `/release-plugin` retain explicit status, prepare, and receipt-bound publish parity outside every shipped target.
- [ ] Two preparations of one clean release snapshot produce byte-identical Cursor and Codex archives, provenance, checksums, notes, and receipts.
- [ ] Prepared archives have one `geldmacher-workflow/` root, canonical manifests and modes, no symlinks, development paths, or recognizable secrets.
- [ ] Publication requires the exact receipt, clean unchanged commit and tree, valid GitHub authentication, and a remote matching tag; conflicts and failed read-back stop without overwrite or cleanup.
- [ ] Both native host packages contain the linked installation guide with checksum, update, rollback, trust, Marketplace, reload, and fresh-task boundaries.
- [ ] Documentation and public commands expose no removed Workflow execution surfaces.
- [ ] Repository validation, links, context budgets, and release surface pass.
- [ ] Commit, tag, push, GitHub publication, deployment, installation, and host restart remain separately authorized.
