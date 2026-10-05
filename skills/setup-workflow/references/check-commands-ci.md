# Check commands and CI

Use when useful checks are hard to invoke consistently or local and CI routes disagree. Reuse existing package scripts, task runners and CI providers. Inspect runtime versions, lockfiles, working directories, selected test scope, exit handling and actual CI triggers before adding wrappers.

## Make failure visible and runs reproducible

Expose one maintained route per useful check scope, with fast checks distinct from broader acceptance. Use non-interactive commands, explicit prerequisites and the project's runtime environment. Propagate failures through wrappers and pipelines; missing required tools, suites or selected tests must not produce a success claim. Keep automatic repairs separate from check commands.

Have project-local CI call the maintained routes using compatible runtimes and reproducible dependencies. Scope credentials and job permissions to the needed operations, pin external actions appropriately for the provider, and retain useful failure artifacts. Do not pass trusted secrets to untrusted execution. Configure relevant triggers without adding unrelated deployment steps. Local YAML validation and a successful local run do not prove remote execution or enforced branch protection.

Possible artifacts are project scripts, a DDEV custom command and local CI files. For TYPO3/DDEV, a project-defined `ddev check` may invoke existing Composer checks; its name and implementation must be created or confirmed, not assumed built in. An agent slash command is useful only as a supported thin entrypoint to a recurring route, not a second implementation.

## Prove and maintain

Run success and representative failure paths, including the outer wrapper's exit status. Validate local CI syntax and declared tools. Report unavailable remote runs or enforcement separately. Maintenance follows command moves, dependency/runtime changes, stale CI triggers and swallowed failures. Global settings, remote CI configuration and delivery retain their separate assignment boundaries.
