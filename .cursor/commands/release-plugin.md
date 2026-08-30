# Release plugin

Operate only on the current Workflow plugin repository. This command accepts no action, version, receipt, or other argument. Run exactly:

`npm run release:plugin`

The current explicit command is the complete authority for one release lifecycle. The script uses the already declared version, validates every non-ignored tracked and untracked change, creates at most one `Release v{version}` commit, creates the lightweight version tag, atomically pushes `main` plus the tag, publishes the separate Cursor and Codex assets, and verifies the downloaded GitHub bytes.

Before tracked mutation require reachable authenticated GitHub access, configured commit identity, the expected repository, synchronized `main`, safe paths, no symlinks, nested repositories or recognizable secrets, consistent versions and changelog, and a passing complete release gate. Never bump a version, deploy or install, restart a host, force-push, reset, overwrite, use `--clobber`, delete, or silently repair ambiguous state. Exact retained retry states may resume only through a later explicit invocation; an exact downloaded-and-verified release is current.

Report version, commit creation, tag, atomic push, archive hashes and file counts, gate result, receipt, GitHub URL, read-back verification, and every blocker.
