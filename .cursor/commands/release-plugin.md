# Release plugin

Operate only on the current Workflow plugin repository. Select exactly one action:

- no action or ensure: `npm run release:ensure`
- status or inspect: `npm run release:status`
- prepare: `npm run release:prepare`
- publish: `npm run release:publish -- <receipt-sha256>`

Ensure performs at most one transition. From a clean untagged source it may atomically consolidate only `CHANGELOG.md`, then must stop and report that a separate commit is required. From a later clean committed release cut it may prepare missing ignored `.build/releases/` artifacts after the full release gate passes. An exact current set causes no mutation. Publication requires the receipt supplied in this invocation, a clean unchanged source snapshot, working GitHub authentication, and an already remote tag at the prepared commit.

Never infer commit or publication authority, select a receipt automatically, create or push commits or tags, deploy or install a plugin, restart a host, overwrite assets, use `--clobber`, delete remote state, or repair a draft or partial release. Stop on any source, version, changelog, duplicate section, tag-absence proof, prepared-set, gate, target, secret, receipt, authentication, tag, remote-state, or read-back mismatch. Treat an existing exact downloaded-and-verified release as current.

Report the changed path and commit boundary for a cut; readiness and blockers for status; hashes, file counts, gate result, output directory, and receipt for preparation; and exact metadata plus downloaded-asset read-back for publish.
