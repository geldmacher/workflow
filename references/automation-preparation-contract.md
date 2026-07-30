# Preparation and Intent approval

`workflow_prepare` accepts exactly one goal or complete Schema-4 Intent Root, `supervised|autonomous`, a Route Profile, and an idempotency key. A supplied Root validates before duplicate resolution or model work. Preparation is read-only, budgeted, expiring, external state; material product questions stop without a Root. Technical validation repair resumes the same Planner context.

The resulting Root freezes the human Intent and `authority`. It uses `lean` for manual, `controlled` for supervised, and `certified` for autonomous. Certified Roots bind Verification Profile, task recipe, certified region, and Route Pool by hash. Human approval consumes exactly the displayed Root hash once and creates a Run; it does not accept delivery.

The approved authority permits later Strategy revisions inside its corridor. Goal, acceptance, public contract, risk, unapproved dependencies, and external effects require a new Root or human boundary decision.
