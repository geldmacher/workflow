# Workflow north star

Workflow is a host-neutral working method delivered through skills. People and executors share understandable plans, implementation reports, reviews, correction instructions, and explicit handoffs.

## Responsibilities

- Define meaningful content requirements; adapt detail and presentation to the task.
- When a Workflow phase or Auto-Work sequence is in use, the human commissions phases separately or expressly commissions one Light or Dark sequence. A direct request to edit this repository authorizes that edit and its affected checks. Preserve approvals already given for the current scope; do not ask again merely to satisfy a format. Consequential decisions, delivery, and learning remain separately commissioned.
- The applicable plan is the reference: human-approved in standalone work and Light, or prepared within an expressly commissioned Dark goal. Material changes to goals, success criteria, authority, or consequential decisions need an explicit human decision. Editorial changes do not create a new gate.
- Execution choices belong to the active executor and project environment. Ground useful technical instructions in the repository. The host owns permissions, sandboxing, and enforcement.
- Review is repository-read-only. Failed necessary checks prevent a positive completion claim; missing proof stays visible. Describe the actual observations and their limits.
- Keep unrelated changes intact. Implementation and correction end with an honest report. A fresh Review is separately commissioned in manual work; Auto-Work delegates every Review to a fresh separate native reviewer without concurrent changes to the reviewed state.
- Capture reusable learning candidates and keep one complete open collection in the native task. Later reports carry changes and an accessible reference, or the full collection when that reference is unreachable. Each Review reconciles earlier and new lessons and offers newly confirmed or materially changed lessons without changing its judgment. A final positive Review surfaces an unchanged eligible offer once if it was neither accepted nor rejected. Learning remains separately commissioned; recheck evidence, conflicts, and previously saved lessons before integration.
- The default finish line is repository work. Auto-Work may include expressly commissioned delivery steps and destinations: Light requires result acceptance; Dark delivery requires existing technically enforced project gates covering the delivered candidate. Commit, push, PR, merge, deployment, installation, production access, publication, and learning are never implied by a phase or mode.

## Sources and handoff

Keep the plan and reports in the native task. A receiving executor needs the applicable plan, current assignment, relevant reports, repository state, unresolved decisions, and next action. Use available task references or complete supplied text. Never invent missing approvals, versions, or test results. Reassess affected claims when the repository changes.

Workflow supplies skills and reference documents. The host executes the work and owns permissions and technical enforcement. Plans and reports live in the native task.

## Development

Keep this file as the single contributor north star. Maintain shared skills under `skills/`; `scripts/build-plugin-targets.mjs` produces host packages with only necessary host-specific instructions. Keep references short and load conditional details only when needed.

Development scripts may build packages, validate plugin metadata, and test release and installation mechanics in isolated directories. They are not shipped execution policy. Preserve reproducibility, package closure, path safety, checksums, and explicit release/deployment boundaries.

- For CLI entrypoint changes, test real subprocesses through physical and aliased paths with invalid input. Assert diagnostics and exit status; imported-function tests cannot detect a silently skipped CLI. Keep module imports free of CLI side effects.
- When working on Marketplace integration, installation, deployment, or cache and status handling, read existing Marketplace identity once and carry it through plugin IDs, installation, cache lookup, and status. Preserve valid names, display metadata, and unrelated entries; reject invalid identity or duplicate plugin entries before changes.
- Validate source files and transformations for every host before replacing existing packages. Rejected symlinks or malformed metadata must leave all previous packages intact.
- Source link checks use existing tracked and non-ignored new files. Package link checks cover the complete package independently of Git; ignored local evidence must not affect source checks.

Test meaningful packaging behavior and realistic skill decisions. Formatting checks establish discoverability and valid host metadata, not sound plans or truthful reviews. Historical changelog entries remain historical; maintained guidance describes the current capabilities. When removing a capability, remove its usage instructions and specific prohibitions together. Restrictions must address actions that remain available.
