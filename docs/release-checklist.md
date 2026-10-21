# Development and releases

This guide is for contributors building or releasing Workflow. To use the plugin, start with [installation](installation.md) and the [working guide](manual-workflow.md).

## Develop and check changes

The repository's `AGENTS.md` is the contributor north star. Shared instructions live in `skills/` and `references/`; the target builder adds only necessary differences for each coding environment. Node.js 22 and npm are required for development tooling, not for using the skills.

From the repository root, run:

```sh
npm ci
npm run build:targets
npm run release-check
```

The build generates packages for Cursor, Codex, OpenCode, and Agent Plugins. Every package includes `implement-work` and, on Cursor and OpenCode, a matching command. `release-check` validates metadata, package contents, tests, context limits, and Markdown links. Its `check:targets` step builds and validates every format in temporary directories. Packaging tests also cover reproducible archives and isolated deployment behavior.

Context limits remain hard gates. Follow the [context budget guidance](behavior-validation.md#context-budgets) when a commissioned extension or necessary clarification warrants a documented adjustment; ordinary checks never raise limits.

These checks establish package correctness. Use appropriate [behavior exercises](behavior-validation.md) to assess changed skill decisions. Passing repository checks does not establish installation or activation in a live host.

## Edit installation documentation

The [installation guide](installation.md) is both user documentation and an execution reference for `install-release`. During editorial changes, preserve its release selection, verification, safe replacement, activation, and recovery instructions. Check the linked skill instructions as well as the reading flow.

The repository test `tests/installation-guide.test.mjs` executes the guide's first `sh` code block, including checksum failure cases. If you move or edit that example, confirm that the test still exercises the intended snippet. Clearer wording must preserve the installation behavior it describes.

## Release checklist

1. Finish the repository changes and run `npm run release-check`, including the behavioral exercises appropriate to changed skills.
2. When explicitly commissioning a release, choose an unused version and cut its changelog entry from Unreleased. Keep source manifests and the development package version aligned.
3. The release tool validates the immutable candidate, builds separate Cursor, Codex, and OpenCode archives, preserves checksums and schema 2 provenance, and performs only its explicitly commissioned publication actions.
4. Installation and host activation remain separate. Use the installation guide and a fresh native task; a built package or matching cache proves neither live use nor behavior.

`npm run deploy:local` is a separately authorized local operation. Its preview and tests use isolated directories. Do not merge old package contents into a new installation.

The OpenCode local deployment and status tools support `~/.config/opencode` below the selected home. If `OPENCODE_CONFIG_DIR` or `XDG_CONFIG_HOME` selects a different OpenCode configuration directory, they stop with a diagnostic before deployment. Overrides resolving to the supported directory are accepted.

The OpenCode config is shared, so deployment must merge only, always back up, and touch only this plugin's own entries. `opencode.json` keeps every other key and every other plugin's `skills` entry; a command file that does not load a Workflow skill is left unchanged. Before a write that changes `opencode.json` or one of this plugin's command files, deploy saves a timestamped backup under `~/.config/opencode/.local-deploy-backups/<plugin>/` and leaves that backup in place after success or rollback. `npm run deploy:uninstall` removes only this plugin's skills entry, its own command files, and its OpenCode package. It does not rewrite `opencode.jsonc` or delete another plugin's commands. A failed deploy restores the shared files from the backup taken for that attempt.

Uninstall also backs up the complete installed package before removing anything and restores it after a partial deletion fails. Shared files keep their existing permissions during updates and recovery. A requested rollback after an update restores the retained version and its registration; it must not invoke uninstall.
