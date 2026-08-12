---
name: deploy-local-plugin
description: Build, inspect, dry-run, or deploy the current repository's host-specific local plugin copies for Cursor and Codex. Use only when the user explicitly invokes $deploy-local-plugin in a plugin development repository.
---

# Deploy Local Plugin

Operate only on the current repository. Never search for or deploy sibling plugins, and never invent an `--all` mode.

1. Confirm the current repository contains `package.json`, `.cursor-plugin/plugin.json`, and `scripts/local-plugin-deploy.mjs`.
2. Treat an invocation without a requested action as a standard deployment. Map the user's request exactly:
   - status or inspect: `npm run deploy:status`
   - dry run or preview: `npm run deploy:local -- --dry-run`
   - deploy or update: `npm run deploy:local`
   - full deploy or full validation: `npm run deploy:local -- --full`
   Resolve host scope independently: no host request means both hosts; append `--cursor-only` for Cursor only or `--codex-only` for Codex only. The host flags work with status, dry-run, standard, and full paths.
3. Run from the repository root. Do not manually copy plugin files, edit the personal Marketplace, remove Codex caches, trust hooks, restart Cursor, or restart Codex.
4. Report the selected hosts, product and local versions, content hashes, destination paths, dirty provenance, applicable Codex cache verification, and whether hook trust needs manual review.
5. After a real deployment, tell the user to reload Cursor and/or start a new Codex task for the hosts that changed. Do not claim live activation until those host-specific checks happen.

Stop on any manifest identity, path-boundary, symlink, validation, swap, rollback, Marketplace, or Codex cache error. Preserve the deploy command's verified/provisional distinction.
