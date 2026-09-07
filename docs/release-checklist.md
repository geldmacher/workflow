# Release checklist

1. Finish the repository changes and run `npm run release-check`, including the behavioral exercises appropriate to changed skills.
2. When explicitly commissioning a release, choose an unused version and cut its changelog entry from Unreleased. Keep source manifests and the development package version aligned.
3. The release tool validates the immutable candidate, builds separate Cursor and Codex archives, preserves checksums and provenance, and performs only its explicitly commissioned publication actions.
4. Installation and host activation remain separate. Use the installation guide and a fresh native task; a built package or matching cache proves neither live use nor behavior.

`npm run deploy:local` is a separately authorized local operation. Its preview and tests use isolated directories. Do not merge old package contents into a new installation.
