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

The build generates packages for Cursor, Codex, and Agent Plugins. `release-check` validates metadata, package contents, tests, context limits, and Markdown links. Its `check:targets` step builds and validates all three formats in temporary directories. Packaging tests also cover reproducible archives and isolated deployment behavior.

These checks establish package correctness. Use appropriate [behavior exercises](behavior-validation.md) to assess changed skill decisions. Passing repository checks does not establish installation or activation in a live host.

## Edit installation documentation

The [installation guide](installation.md) is both user documentation and an execution reference for `install-release`. During editorial changes, preserve its release selection, verification, safe replacement, activation, and recovery instructions. Check the linked skill instructions as well as the reading flow.

The repository test `tests/installation-guide.test.mjs` executes the guide's first `sh` code block, including checksum failure cases. If you move or edit that example, confirm that the test still exercises the intended snippet. Clearer wording must preserve the installation behavior it describes.

## Release checklist

1. Finish the repository changes and run `npm run release-check`, including the behavioral exercises appropriate to changed skills.
2. When explicitly commissioning a release, choose an unused version and cut its changelog entry from Unreleased. Keep source manifests and the development package version aligned.
3. The release tool validates the immutable candidate, builds separate Cursor and Codex archives, preserves checksums and provenance, and performs only its explicitly commissioned publication actions.
4. Installation and host activation remain separate. Use the installation guide and a fresh native task; a built package or matching cache proves neither live use nor behavior.

`npm run deploy:local` is a separately authorized local operation. Its preview and tests use isolated directories. Do not merge old package contents into a new installation.
