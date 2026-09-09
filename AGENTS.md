# Workflow north star

Workflow is a host-neutral working method delivered through skills. People and executors share understandable plans, implementation reports, reviews, correction instructions, and explicit handoffs.

## Responsibilities

- Define meaningful content requirements; adapt detail and presentation to the task. Documents have no mandatory headings, field names, envelopes, or machine counterpart.
- The human commissions phases separately or expressly commissions one Light or Dark Auto-Work sequence. Preserve approvals already given for the current scope; do not ask again merely to satisfy a format. Learning remains separately commissioned.
- The applicable plan is the reference: human-approved in standalone work and Light, or prepared within an expressly commissioned Dark goal. Material changes to goals, success criteria, authority, or consequential decisions need an explicit human decision. Editorial changes do not create a new gate.
- Execution choices belong to the active executor and project environment. Ground useful technical instructions in the repository. The host owns permissions, sandboxing, and enforcement.
- Review is repository-read-only. Failed necessary checks prevent a positive completion claim; missing proof stays visible. Describe the actual observations and their limits.
- Keep unrelated changes intact. Implementation and correction end with an honest report. A fresh Review is separately commissioned in manual work; Auto-Work delegates every Review to a fresh separate native reviewer without concurrent changes to the reviewed state.
- Capture reusable learning candidates and carry the complete open collection through phase reports and handoffs. Each Review reconciles earlier and new lessons and offers confirmed ones without changing its judgment. Learning remains separately commissioned; recheck evidence, conflicts, and previously saved lessons before integration.
- The default finish line is repository work. Auto-Work may include expressly commissioned delivery steps and destinations: Light requires result acceptance; Dark delivery requires existing technically enforced project gates covering the delivered candidate. Commit, push, PR, merge, deployment, installation, production access, publication, and learning are never implied by a phase or mode.

## Sources and handoff

Keep the plan and reports in the native task. A receiving executor needs the applicable plan, current assignment, relevant reports, repository state, unresolved decisions, and next action. Use available task references or complete supplied text. Never invent missing approvals, versions, or test results. Reassess affected claims when the repository changes.

Ordinary host use is independent of Workflow. This plugin has no execution service, hooks, MCP server, formal state engine, or artifact reader. Do not reintroduce these as optional or compatibility paths.

## Development

Keep this file as the single contributor north star. Maintain shared skills under `skills/`; `scripts/build-plugin-targets.mjs` produces host packages with only necessary host-specific instructions. Keep references short and load conditional details only when needed.

Development scripts may build packages, validate plugin metadata, and test release and installation mechanics in isolated directories. They are not shipped execution policy. Preserve reproducibility, package closure, path safety, checksums, and explicit release/deployment boundaries.

Test meaningful packaging behavior and realistic skill decisions. Formatting checks establish discoverability and valid host metadata, not sound plans or truthful reviews. Historical changelog entries remain historical; maintained guidance describes only the current method.
