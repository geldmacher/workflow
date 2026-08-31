# Native Plan container contract

The human plan is comprehensive free-form Markdown. Its headings, order, tables, prose, host frontmatter, and host todos are not authority and are not validity conditions.

`build-plan` appends exactly one visible default-closed block at the end:

````text
<details>
<summary>Workflow authority</summary>

```yaml workflow-authority
...
```
</details>
````

The generated Authority Core contains the Schema-6 plan identity, profile, normalized plan-content hash, Core hash, goal, acceptance, risk, hard triggers, authority, and structured verification. Optional `predecessor_plan_id` and `source_review_id` bind a deliberately new plan created from prior Open Points. There is no separate replan transition.

Plan-content hashing removes host frontmatter and the Authority Core, normalizes CRLF to LF, trims surrounding whitespace, and emits exactly one trailing newline. The Core hash binds every semantic Core field except itself. Any plan or Core manipulation fails validation. Earlier plan envelopes are unsupported.

CreatePlan guards any Workflow plan claim while Plan Work is active, independent of fence label. Invalid transport returns a machine-readable repair reason so the host can rebuild the plan. Outside active Workflow Plan Work, the host remains fail-open.

Engineering methodology remains non-authoritative human trace: the exact Root alone carries no playbook choice, and a material intent change requires a fresh suggestion.
