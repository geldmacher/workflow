# Installing Workflow from a GitHub Release

Each Workflow GitHub Release contains separate packages for Cursor and Codex. Download only the archive for the intended host plus `SHA256SUMS` and `provenance.json` from the [latest GitHub Release](https://github.com/geldmacher/workflow/releases/latest). You do not need the other host archive or `RELEASE_NOTES.md` to verify this selected download. Do not install an archive until both the selected archive and `provenance.json` match their entries in `SHA256SUMS`.

## Verify the download

On macOS or Linux, replace the example version and host when necessary, then verify exactly the two downloaded files that are covered by `SHA256SUMS`:

```sh
archive="geldmacher-workflow-cursor-v6.2.0.zip"

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

verify_release_file "$archive"
verify_release_file "provenance.json"
```

On Windows PowerShell, the equivalent check selects the exact two entries before comparing their hashes:

```powershell
$archive = "geldmacher-workflow-cursor-v6.2.0.zip"
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

Every archive must expand to exactly one top-level `geldmacher-workflow/` directory. Avoid an additional nesting level such as `geldmacher-workflow/geldmacher-workflow/`. Before installation, confirm that the host manifest is located at:

- Cursor: `geldmacher-workflow/.cursor-plugin/plugin.json`
- Codex: `geldmacher-workflow/.codex-plugin/plugin.json`

## Cursor

Install the contents at the local Cursor plugin path:

- macOS/Linux: `~/.cursor/plugins/local/geldmacher-workflow`
- Windows: `%USERPROFILE%\.cursor\plugins\local\geldmacher-workflow`

For a first installation, extract the archive to a temporary directory and move its single `geldmacher-workflow` directory to that destination. For an update, keep the current directory as a backup, place the new complete directory at the same path, and do not merge old and new files. Then reload Cursor. Review the plugin's hooks and explicitly approve Hook Trust only after the installed files and source are acceptable. Installation on disk and live hook activation are separate checks.

To roll back, move the current directory aside, restore the previously retained complete directory, reload Cursor, and review Hook Trust again if Cursor requests it. Keep the matching old archive, `SHA256SUMS`, and `provenance.json` so the restored bytes remain verifiable.

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

If `marketplace.json` already exists, preserve its top-level `name`, `interface`, and every unrelated item in `plugins`. Add or replace only the `geldmacher-workflow` item shown above; do not replace the whole catalog merely to install this plugin.

Source placement is not installation or activation. After creating or changing the Marketplace entry or its source directory:

1. Fully quit and restart the ChatGPT/Codex desktop app; closing only its window is insufficient.
2. Open the **Plugins Directory**, choose **Geldmacher Plugins** (or the preserved display name of your existing personal Marketplace), and install Workflow. For an update or rollback, use the available refresh or reinstall action there so the host materializes the selected source again.
3. Confirm that the installed copy exists below `~/.codex/plugins/cache/geldmacher-personal/geldmacher-workflow/local/` on macOS/Linux or `%USERPROFILE%\.codex\plugins\cache\geldmacher-personal\geldmacher-workflow\local\` on Windows. If an existing Marketplace keeps another top-level `name`, that name replaces `geldmacher-personal` in the cache path. Local Marketplace plugins run from this cache copy, not directly from `~/.codex/plugins/geldmacher-workflow`.
4. Review any plugin trust request before enabling hooks, then start a new Codex task. An already running task does not prove that the refreshed cache copy is active.

These Marketplace, cache, restart, Plugins Directory, and new-task boundaries follow the [official OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins).

For an update, retain the current source directory and its matching release files as a backup, replace the source with the complete verified directory from the new archive, keep the Marketplace entry pointed at the same path, and repeat all four activation steps above. Verify the manifest version in the refreshed cache copy before starting the new task.

For rollback, restore the retained complete old source directory and its verified release files, keep the Marketplace entry unchanged, and repeat the same restart, Plugins Directory refresh or reinstall, cache-version check, and new-task steps. Do not combine files from different versions and do not treat restored source bytes as proof that the cached installed copy changed.

## Verify the installed layout

After copying, verify that the manifest sits directly below the destination, that its `name` is `geldmacher-workflow`, and that its `version` matches the selected release. The archive checksum proves downloaded bytes; it does not prove that Cursor reloaded, Hook Trust was approved, the Codex Marketplace accepted the entry, or a new Codex task loaded the package. Confirm those host-specific activation steps separately.
