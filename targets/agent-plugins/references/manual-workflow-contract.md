# Portable Manual Workflow contract

Portable Workflow uses free-form plan Markdown plus one generated Authority Core. Its direct loop is Implement Plan → Review Work → Correct Work → Review Work. The human separately authorizes implementation, each Correct Work, and each fresh Review Work.

Review outcomes are only Achieved (`achieved`), Correction needed (`correction-needed`), or Open points (`open-points`); actions are only `none|correct|human-assessment`. Missing required observations are internal artifact-free retries. Invalid binding gets a read-only Shadow Review without correction authority.

Portable action decoration is closed:

| Token | Portable action |
|---|---|
| `implement-plan` | `implement-work` |
| `review-work` | `review-work` |
| `correct` | `correct-work` |
| `human-assessment` | answer the named question naturally |
| `none` | no further Workflow action |

The facade never invents another state, action, assessment, or authority. The harness owns concrete execution. Exact Schema-6 bytes are task-local authority. Every external effect remains separately authorized.
