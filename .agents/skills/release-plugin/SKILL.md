---
name: release-plugin
description: Safely ensure, inspect, prepare, or explicitly publish this repository's receipt-bound Cursor and Codex GitHub Release assets. Use only when the user explicitly invokes $release-plugin in this repository.
---

# Release Plugin

Operate only on the current Workflow plugin repository. Never infer publication permission from preparation, an existing tag, or a prior request.

1. Confirm the repository contains `package.json`, `.cursor-plugin/plugin.json`, `targets/codex/.codex-plugin/plugin.json`, and `scripts/plugin-github-release.mjs`.
2. Map the explicit action exactly:
   - no action or ensure: `npm run release:ensure`
   - status or inspect: `npm run release:status`
   - prepare: `npm run release:prepare`
   - publish with an exact receipt: `npm run release:publish -- <receipt-sha256>`
3. Run from the repository root. Ensure performs at most one transition: from a clean untagged source it may atomically consolidate only `CHANGELOG.md` and then stop with `commit_required: true`; from a later clean committed release cut it may prepare missing ignored `.build/releases/` output; an exact current set causes no mutation.
4. Ensure and preparation must not commit, tag, push, deploy, install, restart a host, or publish. Never bypass the clean-commit boundary or infer permission to create a commit after a release cut.
5. Run `publish` only when the current invocation explicitly supplies the receipt. Never select a receipt automatically. Do not create or push commits or tags, overwrite assets, use `--clobber`, delete a draft or release, or repair a partial remote state.
6. Report source readiness, release version and tag, changed paths and the commit boundary after a cut, or both archive hashes and file counts, the provenance receipt, release-gate result, and every blocker after preparation. After publication, report whether GitHub read-back verified the exact metadata and downloaded asset hashes.

Stop on dirty or drifting source, version or changelog inconsistency, duplicate release sections, an existing local or remote current-version tag before a cut, unavailable remote-tag proof, a prepared-set conflict, failed release validation, symlink, development-path or recognizable-secret findings, receipt mismatch, invalid GitHub authentication, missing or mismatched remote tag for publication, conflicting or partial release state, or failed read-back verification. An existing exact verified release is current and requires no mutation.
