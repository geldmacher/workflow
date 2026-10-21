---
name: deploy-local-plugin
description: Build, inspect, dry-run, or deploy the current repository's host-specific local plugin copies for Cursor, Codex, and OpenCode. Use only when the user explicitly invokes $deploy-local-plugin in a plugin development repository.
---

# Deploy Local Plugin

Operate only on the current repository using the documented commands and host options below.

1. Confirm the current repository contains `package.json`, `.cursor-plugin/plugin.json`, and `scripts/local-plugin-deploy.mjs`.
2. Treat an invocation without a requested action as a standard deployment. Map the user's request exactly:
   - status or inspect: `npm run deploy:status`
   - dry run or preview: `npm run deploy:local -- --dry-run`
   - deploy or update: `npm run deploy:local`
   - full deploy or full validation: `npm run deploy:local -- --full`
   - OpenCode uninstall: `npm run deploy:uninstall`
   A rollback request must not run uninstall. The local deploy CLI has no rollback command; report that limitation.
   Resolve host scope independently: no host request means Cursor, Codex, and OpenCode; append `--cursor-only`, `--codex-only`, or `--opencode-only` for one host. The host flags are mutually exclusive and work with status, dry-run, standard, and full paths.
3. Run from the repository root. Do not manually copy plugin files, edit the personal Marketplace, remove Codex caches, restart Cursor, or restart Codex.
4. The OpenCode config is shared. Merge only, always back up, and touch only this plugin's own entries. Deploy adds this plugin's skills path when it is absent, keeps every other key and skills entry, and refuses to replace a command that does not load a Workflow skill. It writes a timestamped backup under `~/.config/opencode/.local-deploy-backups/<plugin>/` before changing `opencode.json` or one of its command files, and leaves that backup after success or failure. Uninstall removes only this plugin's skills entry, its own command files, and its OpenCode package. It does not rewrite `opencode.jsonc` or delete another plugin's commands.
5. Report the selected hosts, product and local versions, content hashes, destination paths, dirty provenance, applicable Codex cache verification, OpenCode backup path when one was written, and remaining host activation steps.
6. After a real deployment, tell the user to reload Cursor, start a new Codex task, and/or start a new OpenCode session for the hosts that changed. Do not claim live activation until those host-specific checks happen.

Stop on any manifest identity, path-boundary, symlink, validation, swap, rollback, Marketplace, or Codex cache error. Distinguish matching installed bytes from live host activation.
