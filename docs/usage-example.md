# Usage examples

## Manual

1. Use `/plan-work` to establish material intent. It recommends one engineering playbook and waits for an inline confirm or decline before returning the Root; either decision remains non-authoritative human trace.
2. Approve the Schema-6 Root and select the host-native implementation action. A confirmed mutating playbook becomes usable only after both decisions.
3. Let the project harness choose concrete execution.
4. Run fresh `/review-work`.
5. If Review says everything is achieved, stop. If it returns a bounded correction, use `/correct-work` and run `/review-work` again. Replan, retry, clarification, or provisional acceptance appear only for their named material boundary.

If material intent changes or the human trace is unavailable, `plan-work` must recommend again. Declining a playbook never blocks an otherwise ready Root.

A plan Check might say “Prove the changed behavior and repository consistency with project-appropriate evidence.” It must not name a command or working directory.

Review keeps unrelated pre-existing dirty paths visible as ambient state rather than treating them as delivery work. After a terminal finding-free Review, `/learn-from-work` remains an optional separate human-authorized step for confirmed project guidance.

## Supervised

Use `/auto-work` with `start`, an exact Schema-6 Root, and `supervised`. Workflow advances implementation and fresh Review through protected generic PhaseRequests until the human delivery gate. Resume an interrupted exact Run revision through the controller. At a Cursor human gate submit exactly `/auto-work accept-delivery <run-id>@<revision>`, `/auto-work approve-correction <run-id>@<revision>`, or `/auto-work stop <run-id>@<revision>` so the host—not the model—injects the decision receipt.

## Autonomous

Use `autonomous` only when the exact Root-bound Qualification Key and receipt hashes match. Complete protected evidence may finish; any capability or evidence gap remains Shadow or requires supervised human acceptance.
