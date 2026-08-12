# Deploy local plugin

Operate only on the current plugin repository. Select the exact requested path:

- status: `npm run deploy:status`
- dry run: `npm run deploy:local -- --dry-run`
- standard deploy: `npm run deploy:local`
- full deploy: `npm run deploy:local -- --full`

Run both hosts by default. Append `--cursor-only` for Cursor only or `--codex-only` for Codex only; the host flags work with status, dry-run, standard, and full paths.

Do not add an `--all` mode, manually copy bundles, edit the personal Marketplace, delete Codex caches, trust hooks, or restart either host. Report the selected hosts, installed local versions, receipts, applicable Codex cache verification, dirty provenance, and changed hooks. After a real deployment, require a Cursor reload and/or a new Codex task for the hosts that changed before claiming live activation.
