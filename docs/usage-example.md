# Usage examples

## Direct loop

1. Use `/plan-work` or `$plan-work` to write the complete implementation prompt and generate its Authority Core.
2. Approve **Implement Plan**.
3. Let the project harness implement inside Root authority.
4. Start fresh Review Work.
5. Stop on Achieved. On Correction needed, approve one Correct Work and then start fresh Review Work again. On Open points, answer the named human question or deliberately request a new plan.

Missing Check observations retry internally. An invalid formal binding still produces an informative repository-read-only Shadow Review.

## Supervised and Autonomous

`/auto-work implement` orchestrates one compatible protected implementation phase and stops at Review needed. The human then uses `/auto-work review <run-id>@<revision>`. At Correction needed, `/auto-work correct <run-id>@<revision>` applies the exact bounded Correction and stops again at Fresh Review pending. Open points need natural human assessment. Achieved needs no final acceptance action.
