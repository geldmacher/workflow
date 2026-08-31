# State contract

Status derives only from exact Schema-6 artifact bytes and protected bindings. Current Root, Evidence, and Review tips are immutable and content-addressed.

The human-relevant states are exactly:

- `root-ready` → **Implement Plan**
- `review-needed` → **Review Work**
- `correction-needed` → **Correct Work**
- `achieved` → no action
- `open-points` → natural human assessment
- `shadow-review` → natural human assessment without artifact or correction authority

After Correct Work, status is `review-needed` (“Fresh Review pending”). Technical retries are internal and create no persisted state. Outcome and evidence grade remain separate. Profiles do not change this state vocabulary.

Trace, cache, IDs without exact bytes, tool text, transport, or presentation are not authority. Status runs no work, approves no tools, and mutates neither repository nor artifacts.
