---
name: release-plugin
description: Safely complete this repository's validated Cursor and Codex GitHub Release in one explicit invocation. Use only when the user explicitly invokes $release-plugin in this repository.
---

# Release Plugin

Operate only on the current Workflow plugin repository. The current explicit invocation is the complete authority for exactly one validated release lifecycle; never reuse authority from an earlier request.

1. Confirm the repository contains `package.json`, `.cursor-plugin/plugin.json`, `targets/codex/.codex-plugin/plugin.json`, and `scripts/plugin-github-release.mjs`.
2. Accept no action, version, receipt, or other argument. Run exactly `npm run release:plugin` from the repository root.
3. The script must use the already consistent declared version, validate all non-ignored tracked and untracked changes, create at most one `Release v{version}` commit when necessary, create the matching lightweight tag, atomically push `main` and the tag, create the GitHub Release, and verify its downloaded assets.
4. The invocation may perform those release effects only after its preflight and complete release gate succeed. It must never choose or bump a version, deploy or install the plugin, restart a host, overwrite assets, use `--clobber`, delete remote state, reset history, force-push, or hide a partial state.
5. Report the version, commit and whether it was created, tag, atomic-push result, both archive hashes and file counts, provenance receipt, release-gate result, GitHub URL, and read-back verification. Report every blocker and the exact retained retry state when completion stops.

Stop before tracked mutation on an unavailable GitHub connection, invalid authentication or commit identity, any branch other than synchronized `main`, origin mismatch, unsafe path, symlink, nested repository, recognizable secret, version or changelog inconsistency, failed validation, or conflicting tag or release state. After a release commit, retain only exact state that a later explicit invocation can verify and resume. An existing exact downloaded-and-verified release is current and requires no mutation.
