---
name: install-release
description: Install or update Workflow from its latest stable GitHub Release for Cursor or Codex.
---

# Install New Release from Repo

Install Workflow for the requested host using the [installation guide](../../docs/installation.md). Read its release selection, verification, safe replacement, and selected host sections before changing installed files. This skill works without a repository checkout or development tools.

An installation request authorizes the described installation and update steps under host permissions; preserve that authorization rather than asking again for each step. A request to explain or inspect installation does not authorize changes. Do not publish releases, build or deploy a development checkout, change unrelated settings, or restart the host.

1. Determine the current harness and operating system from explicit host context, unless the user selected a different target. Installed directories alone do not identify the current harness. Support Cursor and Codex on macOS, Linux, and Windows; clarify missing or conflicting context before choosing one. For other harnesses, explain the supported targets without installing either by default.
2. Resolve the latest stable release of `geldmacher/workflow` once and retain its concrete tag and asset URLs. Follow the guide's checks and use only that release's selected host package. Stop on missing prerequisites or inconsistent release evidence; never substitute a branch, another repository, or the other host archive.
3. Verify and stage the package before any replacement. Compare the destination with verified release files, preserve local changes and newer versions, and handle first installation, an identical package, or a complete backed-up update as the guide describes. Retain recovery paths if any operation fails.
4. Complete the selected host's installation steps that are available within the current session. Preserve unrelated Marketplace entries. Leave cache materialization and enablement to the host's supported installation interface; never copy into or delete Codex caches to simulate installation.
5. Report the selected release and host, destination, actual verification, changes or no-op, backup when created, and remaining activation steps. Distinguish verified source files, the installed copy, and activation in a fresh task. When restart or Plugins Directory interaction remains, say exactly what the user needs to do; do not claim that Workflow is active.
