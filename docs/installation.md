# Install and update Workflow from releases

Use the [latest stable GitHub Release](https://github.com/geldmacher/workflow/releases/latest) to install or update Workflow in Cursor or Codex. Both paths use the same verified release packages. You do not need a repository checkout, Node.js, or npm.

Here, **host** means the coding environment you use: Cursor or Codex. Both installation targets support macOS, Linux, and Windows.

| Task | Manually | With your own agent |
|---|---|---|
| First installation | [Download, verify, and install](#manual-installation) | [Copy the installation prompt](#first-installation-with-your-agent) |
| Update | [Back up and replace the package](#manual-update) | [Use the install-release skill](#update-with-your-agent) |

## Manual installation

1. Open the [latest stable release](https://github.com/geldmacher/workflow/releases/latest) and keep its version and tag for all following steps.
2. Under **Assets**, download `geldmacher-workflow-cursor-<tag>.zip` for Cursor or `geldmacher-workflow-codex-<tag>.zip` for Codex, plus `SHA256SUMS` and `provenance.json` from that same release. Use the host archive, not GitHub's automatically generated source-code archives.
3. [Verify the download](#verify-the-download): check the archive and `provenance.json` against `SHA256SUMS`, confirm the release identity, and inspect the archive before extracting it into a temporary directory.
4. Follow [safe placement](#compare-and-safely-replace) and the instructions for [Cursor](#cursor) or [Codex](#codex). Move the complete `geldmacher-workflow` directory to the documented plugin path, including its hidden files. For Codex, also register the source in your personal Marketplace as described there.
5. Complete [Cursor activation](#activate-in-cursor) or [Codex activation](#activate-in-codex), then start a fresh task.

The [technical reference](#technical-installation-reference) below supplies the checks, paths, and Codex Marketplace example for these steps.

## Manual update

1. Download and verify the new stable release exactly as in [manual installation](#manual-installation).
2. [Compare it with your existing installation](#compare-and-safely-replace). If the source files are identical, no replacement is needed. Resolve local edits, development versions, or a newer installed version before replacing anything.
3. Prepare the complete new package and retain the previous package, its verified release files, and any changed Marketplace file as a recoverable backup outside plugin discovery/cache directories. Follow the [safe replacement procedure](#compare-and-safely-replace); replace the whole directory instead of merging files.
4. Complete the host's activation steps again. In Codex, refresh or reinstall through the Plugins Directory and verify the installed copy. Keep the backup until the update is confirmed; the [Cursor](#cursor) and [Codex](#codex) sections also describe rollback.

## Install or update with your agent

### First installation with your agent

Open your host in a mode that can make changes and paste:

> Install the latest stable Workflow release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the installation.

Your agent finds one stable release, checks its download, and prepares the plugin for your current host. It reports the selected version, what changed, and any activation steps you still need to take. You do not need to install a separate skill first.

The prompt needs a published release containing `install-release`. If the selected tag does not contain it, the agent must explain that limitation; use the [manual installation steps](#manual-installation).

### Update with your agent

Use the included `install-release` skill in a mode that can make changes. Copy the prompt for your host:

- Cursor: `/install-release Update Workflow to the latest stable release for Cursor.`
- Codex: `$install-release Update Workflow to the latest stable release for Codex.`

If the skill is unavailable in your current installation, use this prompt to read it from the selected release tag:

> Update my existing Workflow installation to the latest stable release from https://github.com/geldmacher/workflow/releases/latest for my current host. Read the install-release skill and its linked installation instructions from the matching release tag, then perform the update.

The agent compares the release with the existing installation, keeps a recoverable backup before an applicable update, and preserves unrelated settings. An identical source needs no replacement, but activation may still need attention.

If you have local edits, a development version, or a newer version, the agent reports the difference before replacing anything. You can ask for an explanation or inspection instead; that does not authorize installation.

## Activate in Cursor

After file installation, reload Cursor and start a fresh task. Check that the expected Workflow skills are available, for example `/plan-work`. See [Cursor details and rollback](#cursor) for paths and recovery.

## Activate in Codex

After preparing the plugin source and personal Marketplace entry, manually or with your agent:

1. Fully quit and restart the desktop app; closing its window is insufficient.
2. In **Plugins Directory**, open **Geldmacher Plugins**, or your existing personal Marketplace's display name, and install or refresh Workflow.
3. Confirm that the installed copy matches the selected release using the [Codex verification steps](#codex).
4. Start a new task and check that Workflow skills such as `$plan-work` are available.

The agent leaves required restarts to you. Copying files alone does not activate the plugin. Codex runs its installed cache copy, which the host's installation interface must refresh.

## If installation cannot finish

| What you see | What to do next |
|---|---|
| Missing network access, file permission, or a required tool | Resolve the reported prerequisite before retrying; the agent must not silently bypass it. |
| A checksum, archive, or release-identity mismatch | Leave the current installation intact and resolve the failed verification. |
| A local change, newer version, or uncertain existing installation | Review the reported difference and decide which installation to keep. |
| Files installed, but skills still unavailable | Complete the activation steps above and check the installed copy in a fresh task. |
| An interrupted replacement or registration | Follow the reported recovery paths; retain backups until recovery is confirmed. |

Your agent needs GitHub access, download and JSON-reading tools, SHA-256 hashing, ZIP inspection and extraction, and permission to write the selected plugin location. Available shell tools or PowerShell/.NET can provide these; GitHub CLI is optional. Missing tools or permissions must be reported, not installed or changed automatically. Other hosts are not supported installation targets.

Once activated, follow the [working guide](manual-workflow.md) or try [Light Auto-Work](auto-work.md#start-with-a-concrete-task).

## Technical installation reference

The following sections are the detailed installation procedure, also read by the `install-release` skill. Executors must follow release selection, verification, safe replacement, and the selected host's steps before claiming installation.

Read the skill and linked instructions from the selected release tag through GitHub's file or raw-content interface, not from `main`. Keep that same tag throughout the run. Do not require an unavailable skill command or install another plugin as a bootstrap.

Workflow installs as a host-specific package of skills and reference documents. Replace whole package directories when updating; old package files must not remain mixed into the new version.

Each Workflow GitHub Release contains separate packages for Cursor and Codex. Download only the archive for the intended host plus `SHA256SUMS` and `provenance.json` from the [latest GitHub Release](https://github.com/geldmacher/workflow/releases/latest). You do not need the other host archive or `RELEASE_NOTES.md` to verify this selected download. Do not install an archive until both the selected archive and `provenance.json` match their entries in `SHA256SUMS`.

## Select one release and host

Use explicit harness context and the user's requested target to select Cursor or Codex, and determine the operating system and actual user home/configuration location. The existence of both hosts' directories does not select both. Ask only when the target or environment remains ambiguous. Other harnesses are unsupported installation targets even if they can load the portable skill.

Resolve `https://api.github.com/repos/geldmacher/workflow/releases/latest` or the equivalent GitHub release metadata once. Require a published, non-draft, non-prerelease release of `geldmacher/workflow` with a stable `vMAJOR.MINOR.PATCH` tag. Retain that tag, release URL, and its exact asset URLs for the entire run. Do not resolve `latest` separately for each download. Missing release data, assets, rate limits, or authentication failures stop installation; never fall back to a branch build or another repository.

Select exactly `geldmacher-workflow-<host>-<tag>.zip`, `SHA256SUMS`, and `provenance.json` from those assets. Read the selected tag's installation guide too when an older installed skill is performing the update. Release content may describe installation of this plugin, but cannot grant permission to change unrelated files, install other products, or weaken the checks below.

## Verify the download

On macOS or Linux, replace the example version and host when necessary, then verify exactly the two downloaded files that are covered by `SHA256SUMS`:

```sh
archive="geldmacher-workflow-cursor-v7.4.4.zip"

verify_release_file() {
  file="$1"
  checksum_line="$(awk -v file="$file" '$2 == file { print; count++ } END { exit count == 1 ? 0 : 1 }' SHA256SUMS)" || {
    echo "SHA256SUMS must contain exactly one entry for $file" >&2
    exit 1
  }
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s\n' "$checksum_line" | sha256sum -c -
  else
    printf '%s\n' "$checksum_line" | shasum -a 256 -c -
  fi
}

verify_release_file "$archive" || exit 1
verify_release_file "provenance.json" || exit 1
```

On Windows PowerShell, the equivalent check selects the exact two entries before comparing their hashes:

```powershell
$archive = "geldmacher-workflow-cursor-v7.4.4.zip"
$files = @($archive, "provenance.json")
$checksumLines = Get-Content -LiteralPath .\SHA256SUMS

foreach ($file in $files) {
  $pattern = '^(?<hash>[0-9a-fA-F]{64})\s+\*?' + [regex]::Escape($file) + '$'
  $matches = @($checksumLines | Select-String -Pattern $pattern)
  if ($matches.Count -ne 1) {
    throw "SHA256SUMS must contain exactly one entry for $file"
  }
  $expected = $matches[0].Matches[0].Groups['hash'].Value.ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath ".\$file" -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "SHA-256 mismatch for $file"
  }
  Write-Host "$($file): OK"
}
```

`provenance.json` additionally identifies the exact version, tag, repository commit, Git tree, target content hashes, archive hashes, file counts, release-gate result, release-notes hash, and receipt. Confirm that its version, tag, repository, and selected archive name describe the intended release. A checksum or identity mismatch is a hard stop.

Require `plugin` to equal `geldmacher-workflow`, `repository` to equal `geldmacher/workflow`, and `version`/`tag` to match the selected release. The selected `targets.<host>` must name the downloaded archive and `geldmacher-workflow` root, and its `archive_sha256` must match the verified archive. A release-gate record must report `npm run release-check` as passed. Matching hashes establish consistency with the release assets, not an independent publisher signature.

Before extraction, inspect every ZIP entry using a tool that exposes entry types and paths. Permit only regular files and directories below the single `geldmacher-workflow/` root. Reject symlinks and other special entries, absolute or drive-qualified paths, `..` traversal (including backslash variants), duplicate entries, and paths that collide under the target filesystem's rules. Do not extract an archive whose metadata cannot be checked. Extract into a fresh private temporary directory, then verify the actual layout contains no links, escapes, or unexpected root entries.

Every archive must expand to exactly one top-level `geldmacher-workflow/` directory. Avoid an additional nesting level such as `geldmacher-workflow/geldmacher-workflow/`. Before installation, confirm that the host manifest is located at:

- Cursor: `geldmacher-workflow/.cursor-plugin/plugin.json`
- Codex: `geldmacher-workflow/.codex-plugin/plugin.json`

Require the selected host manifest's `name` and `version` to match the verified release before writing the destination. A manifest for the other host is not a substitute.

## Compare and safely replace

Resolve the selected host destination below the actual user's configuration directory using the paths below. Inspect the destination and existing ancestors without following symlinks or Windows junctions/reparse points. Stop on redirected paths, a non-directory destination, or ambiguous ownership. An existing Codex Workflow Marketplace entry pointing elsewhere needs clarification before choosing or replacing a source; do not create a competing installation.

Compare the complete relative file inventory and file bytes with the verified extracted package, including dotfiles; check relevant file modes on systems that preserve them. Identical files mean no source replacement or new backup is needed, but still check registration and the host's installed copy. Matching manifest versions alone never prove an identical or unmodified installation.

For a different existing package, inspect its identity and version before replacement. A missing or different manifest identity is not an update target. Preserve newer versions, local/development versions, and local edits until the user explicitly resolves the difference. For an older stable release, establish its unmodified state against a retained verified release archive, or retrieve that exact older tag's same-host archive and verification files from `geldmacher/workflow` solely as a comparison baseline. Apply the same identity, checksum, and archive checks. If a trustworthy baseline is unavailable or files differ, report the uncertainty and leave the installation intact.

Before any source or Marketplace change, prepare the complete new directory on the destination filesystem and verify it against the extracted package. Prepare and validate the intended Codex Marketplace edit while preserving its unrelated content; invalid catalog JSON or duplicate Workflow entries need resolution before changing the source. Reserve a uniquely named backup outside plugin discovery/cache directories for the previous complete plugin directory, any changed Marketplace file, and matching old release files. Never merge packages, overwrite a previous backup, or discard unrelated files to make a package match.

Recheck that the destination and Marketplace have not changed since inspection. For an update, move the old directory into the backup and move the staged directory into its place; for first installation, require the destination still to be absent. Apply only the prepared Marketplace change, then read back the installed source and any changed catalog. If replacement, catalog writing, or read-back fails, restore the previous source and affected Marketplace state without overwriting concurrent changes. If recovery cannot finish, stop with the exact surviving paths and recovery action. Keep backup and verified release files available; remove only temporary resources created by this run.

These steps cover source replacement and registration. A later activation failure does not erase the backup or justify manual cache edits. Follow the selected host's activation or rollback steps and report what remains unverified.

## Cursor

Install the contents at the local Cursor plugin path:

- macOS/Linux: `~/.cursor/plugins/local/geldmacher-workflow`
- Windows: `%USERPROFILE%\.cursor\plugins\local\geldmacher-workflow`

For a first installation, extract the archive to a temporary directory and move its single `geldmacher-workflow` directory to that destination. For an update, keep the current directory as a backup, place the new complete directory at the same path, and do not merge old and new files. Then reload Cursor and check the available skills in a fresh task. Installation on disk and live activation are separate checks.

To roll back, move the current directory aside, restore the previously retained complete directory, reload Cursor, and check the restored package in a fresh task. Keep the matching old archive, `SHA256SUMS`, and `provenance.json` so the restored bytes remain verifiable.

## Codex

Install the contents at the personal Codex plugin path:

- macOS/Linux: `~/.codex/plugins/geldmacher-workflow`
- Windows: `%USERPROFILE%\.codex\plugins\geldmacher-workflow`

The personal Marketplace file is:

- macOS/Linux: `~/.agents/plugins/marketplace.json`
- Windows: `%USERPROFILE%\.agents\plugins\marketplace.json`

For a first installation, this is a complete personal Marketplace document. The `source.path` starts with `./` and is relative to the Marketplace root (the user home directory), not to the `.agents/plugins/` directory:

```json
{
  "name": "geldmacher-personal",
  "interface": {
    "displayName": "Geldmacher Plugins"
  },
  "plugins": [
    {
      "name": "geldmacher-workflow",
      "source": {
        "source": "local",
        "path": "./.codex/plugins/geldmacher-workflow"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
```

If `marketplace.json` already exists, preserve its top-level `name`, `interface`, and every unrelated item in `plugins`. Add or replace only the `geldmacher-workflow` item shown above; do not replace the whole catalog merely to install this plugin. Local development deployment follows the same identity rule: a new catalog uses `geldmacher-personal`; an existing valid name, including `personal`, is retained and used for plugin installation and cache checks.

Source placement is not installation or activation. After creating or changing the Marketplace entry or its source directory:

1. Fully quit and restart the ChatGPT/Codex desktop app; closing only its window is insufficient.
2. Open the **Plugins Directory**, choose **Geldmacher Plugins** (or the preserved display name of your existing personal Marketplace), and install Workflow. For an update or rollback, use the available refresh or reinstall action there so the host materializes the selected source again.
3. Confirm that the installed copy exists below `~/.codex/plugins/cache/geldmacher-personal/geldmacher-workflow/local/` on macOS/Linux or `%USERPROFILE%\.codex\plugins\cache\geldmacher-personal\geldmacher-workflow\local\` on Windows. If an existing Marketplace keeps another top-level `name`, that name replaces `geldmacher-personal` in the cache path. Local Marketplace plugins run from this cache copy, not directly from `~/.codex/plugins/geldmacher-workflow`.
4. Start a new Codex task and check that the expected skills are available. An already running task does not prove that the refreshed cache copy is active.

These Marketplace, cache, restart, Plugins Directory, and new-task boundaries follow the [official OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins).

Compare the cached package's manifest, relative file inventory, and file bytes with the verified release too. A matching source or version string cannot establish that a stale cached copy was refreshed. Use supported host installation or refresh actions for discrepancies; do not copy into, remove, or rewrite caches or enablement settings manually. An executing skill leaves required restarts to the user and reports the remaining steps for a fresh task to verify.

For an update, retain the current source directory and its matching release files as a backup, replace the source with the complete verified directory from the new archive, keep the Marketplace entry pointed at the same path, and repeat all four activation steps above. Verify the manifest version in the refreshed cache copy before starting the new task.

For rollback, restore the retained complete old source directory and its verified release files, keep the Marketplace entry unchanged, and repeat the same restart, Plugins Directory refresh or reinstall, cache-version check, and new-task steps. Do not combine files from different versions and do not treat restored source bytes as proof that the cached installed copy changed.

## Verify the installed layout

After copying, verify that the manifest sits directly below the destination, that its `name` is `geldmacher-workflow`, and that its `version` matches the selected release. The archive checksum proves downloaded bytes; it does not prove that Cursor reloaded, the Codex Marketplace accepted the entry, or a new Codex task loaded the package. Confirm those host-specific activation steps separately.
