# Code checks

Use when syntax, type, static-analysis or build failures could escape the current route. Do not add a second linter or enable unrelated rule sets merely to complete a template. Inspect package scripts, compiler settings, ignored paths, generated code, current diagnostics and supported runtime versions first.

## Establish useful feedback

Choose the existing tool's check-only mode for the affected source. Separate formatting or automatic fixes from validation so a green check does not conceal mutations. Cover the actual entrypoint and production build where their failure would matter, not only imported functions. Keep checks fast enough for their intended frequency; put expensive checks on the broader acceptance route.

Preserve diagnostic locations, stdout/stderr and failing exit codes. For existing debt, expose the findings and agree any bounded baseline with a reason and removal condition. Do not suppress broad paths, downgrade errors or silently rewrite expected behavior to make the gate green. New dependencies need a concrete advantage over existing coverage and a compatible project-local installation.

Possible artifacts are existing script/config changes and a short command description. For a DDEV PHP project, resolve its actual Composer scripts and runtime, then expose suitable check-only commands through that environment; do not assume host PHP or an arbitrary analysis level.

## Prove and maintain

Run the affected route and observe diagnostics and status. In an owned disposable copy, introduce a representative syntax/type fault where useful, confirm failure, then remove only that fault. Check that validation did not rewrite source. Maintenance follows changed runtimes, extensions, ignored paths and source layout; reported product defects remain defects rather than new exclusions.
