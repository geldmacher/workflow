# Usage examples

## Manual

1. Create and approve a Schema-6 Root with `/plan-work`.
2. Select the host-native implementation action.
3. Let the project harness choose concrete execution.
4. Run fresh `/review-work`.
5. Follow the Review's conceptual next action: correct, replan, retry, or accept provisional.

A plan Check might say “Prove the changed behavior and repository consistency with project-appropriate evidence.” It must not name a command or working directory.

## Supervised

Use `/auto-work` with `start`, an exact Schema-6 Root, and `supervised`. Workflow advances implementation and fresh Review through protected generic PhaseRequests until the human delivery gate. Resume an interrupted exact Run revision through the controller. At a Cursor human gate submit exactly `/auto-work accept-delivery <run-id>@<revision>`, `/auto-work approve-correction <run-id>@<revision>`, or `/auto-work stop <run-id>@<revision>` so the host—not the model—injects the decision receipt.

## Autonomous

Use `autonomous` only when the exact Root-bound Qualification Key and receipt hashes match. Complete protected evidence may finish; any capability or evidence gap remains Shadow or requires supervised human acceptance.
