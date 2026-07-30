# Verification Profile contract

`.cursor/workflow-verification.yaml` is a closed project manifest referencing one project-local Verification Skill and Feature Map. Their contents are hashed together. Required capabilities are `launch`, `doctor`, `drive`, `observe`, `evidence`, `reset`, and `cleanup`; repository content is read-only and proof artifacts go only to the controller-provided external directory.

`draft` refuses overwrites. `prove` executes the configured Verifier in a hard read-only repository sandbox, performs the full lifecycle, writes only external proof artifacts, and lets the Controller hash the resulting files. A human then activates exactly that combined hash. `audit` returns `clean`, `changed`, or `blocked`; any referenced-content drift invalidates activation and Autonomous eligibility.
