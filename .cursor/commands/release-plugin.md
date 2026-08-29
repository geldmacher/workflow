# Release plugin

Operate only on the current Workflow plugin repository. Select exactly one action:

- no action, status, or inspect: `npm run release:status`
- prepare: `npm run release:prepare`
- publish: `npm run release:publish -- <receipt-sha256>`

Preparation writes only ignored `.build/releases/` artifacts after the full release gate passes. Publication requires the receipt supplied in this invocation, a clean unchanged source snapshot, working GitHub authentication, and an already remote tag at the prepared commit.

Never infer publication authority, select a receipt automatically, create or push commits or tags, deploy or install a plugin, restart a host, overwrite assets, use `--clobber`, delete remote state, or repair a draft or partial release. Stop on any source, version, changelog, gate, target, secret, receipt, authentication, tag, remote-state, or read-back mismatch. Treat an existing exact downloaded-and-verified release as current.

Report readiness and blockers for status; hashes, file counts, gate result, output directory, and receipt for prepare; and exact metadata plus downloaded-asset read-back for publish.
