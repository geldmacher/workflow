# Why Workflow

**AI can generate code in seconds. Workflow turns that code into a delivery you can understand, verify, and confidently accept.**

Workflow is a Cursor-native delivery system for teams and developers who want the speed of AI-assisted engineering without surrendering control over intent, scope, quality, or repository boundaries. It connects planning, implementation, evidence, review, correction, and learning into one governed path. The human remains the authority; automation earns more freedom only through exact, inspectable proof.

The plugin works with the way Cursor already feels. For normal Manual work, you approve a plan, use **Implement Plan**, and request a fresh review. Around that familiar interaction, Workflow adds the structure that agentic delivery usually lacks: an immutable Intent Root, adaptive execution inside a closed authority envelope, risk-calibrated evidence, deterministic closeout, explicit acceptance, and an auditable lineage when a plan must change.

## AI coding is easy; trustworthy delivery is the hard part

An agent can produce a plausible patch while still solving the wrong problem, drifting beyond the approved scope, skipping a meaningful check, or describing unavailable proof as success. These failures rarely come from a lack of code generation. They come from a broken chain between the original decision and the final claim.

Workflow closes that gap. It treats delivery as a sequence of accountable transitions:

| Delivery moment | What Workflow preserves |
|---|---|
| Plan | The observable goal, acceptance criteria, constraints, non-goals, risk, and authority boundaries |
| Implement | Freedom to adapt the Strategy without silently changing the approved Intent |
| Close out | Repository-grounded evidence tied to the exact Root and changed paths |
| Review | A fresh verdict that distinguishes verified, provisional, unavailable, and failed evidence |
| Correct or replan | A bounded correction path or a new approval-required Root with explicit lineage |
| Learn | Reusable guidance only after successful delivery, without automatic publication |

This creates a durable answer to the questions that matter after an AI has edited the repository: Did it build the right thing? Did it stay inside the approved boundary? What actually changed? Which checks ran? What remains uncertain? Is a human decision still required?

## One delivery system, three levels of autonomy

Workflow does not force a leap from chat-driven coding to an autonomous software factory. It offers three profiles on one shared safety model so that control can increase only where the evidence supports it.

These profiles describe the capability model, not a blanket certification claim for every installation. Repository tests alone do not activate controller execution. Until the required live runtime and capability gates are positive for the exact environment, controller profiles remain in read-only Shadow Mode and Manual stays the operational path.

| Profile | What changes for you? | Minimum requirement |
|---|---|---|
| `manual` | You drive implementation and corrections. | Install the plugin, select a Cursor model, and approve the Plan. |
| `supervised` | The controller drives execution, but you accept every delivery. | Opt in with closed configuration and prove the installed controller environment live. |
| `autonomous` | A fully verified run may finish without final acceptance. | Qualify the exact task, verification, model Pool, and repository-region combination through certified proof and supervised history. |

What unites them is more important than the label: every profile preserves the same human-approved Intent, scope and repository boundary; uses evidence and a fresh review; blocks known failed Checks; and forbids automatic publication or deployment. The [profile guide](profiles.md) gives the full prerequisites and downgrade rules in one place.

### Manual: the familiar path, made dependable

Manual is the default and requires no controller certification. The human selects the primary model in Cursor, approves the plan, starts implementation, and decides what happens after review. Low- and medium-risk work without Hard Triggers can use Lean Evidence, keeping routine changes efficient while preserving the essential proof chain.

To start, you need only the installed plugin and Cursor's normal Plan, Agent, and Ask interaction. No User Config, Project Policy, Worker runtime, Capability Receipt, Verification Profile, or qualifying history is required.

The normal loop is intentionally small:

```text
/plan-work
Cursor: Implement Plan
/review-work
```

Implementation closes out automatically. `/close-work [wp-id]` exists as a read-only recovery path when that closeout was missed, not as recurring ceremony. If review finds a bounded defect, `/correct-work` keeps the correction attached to the approved Root. If the intent itself must change, `/plan-work replan` creates a new approval boundary instead of quietly rewriting history.

### Supervised: adaptive execution, human acceptance

Supervised adds a controller that can maintain one canonical Writer, revise Strategy within approved roots, track deviations, manage budgets, and gather Full Evidence in an isolated worktree. The human still approves the exact Intent Root and accepts every delivery.

To start writable execution, configure exact model Pools and budgets, opt the repository in with `supervised_enabled: true`, and obtain positive live capability proof for the exact installed Plugin, runtime, Cursor version, routing, and safety boundaries. Without that proof, supervised remains read-only Shadow Mode.

This profile is useful when a task benefits from longer-running orchestration but still demands a clear handoff before integration. Strategy can change as implementation learns more; goal, scope envelope, protected paths, dependency authority, external-effect policy, and budgets cannot.

### Autonomous: permission earned by exact certification

Autonomous is designed for repeatable work in a precisely qualified environment. It is not a global switch and it is never inferred from repository tests or confident prose. Eligibility is bound to exact plugin, runtime, model Pool, verification profile, hashes, capability observations, repository region, and qualifying supervised history.

If required proof is incomplete or stale, Workflow downgrades to supervised behavior. If a required Check is known to have failed, delivery is blocked. This fail-closed behavior turns autonomy from a promise into a capability that must be demonstrated for the exact conditions in which it will run.

To use it, meet every supervised requirement, enable it in Project Policy, bind the exact task recipe, approved Verification Profile, Route Pool, and certified repository region, and build enough fully verified, human-accepted supervised history for that same Qualification Key. The human still approves the prepared Intent Root; only the final acceptance can disappear, and only when all required evidence is verified.

## Stable intent, adaptive strategy

The core design separates **what must remain true** from **how the work gets done**.

The Intent Root freezes the approved outcome and authority envelope: goal, acceptance criteria, constraints, non-goals, risk, dependencies, external effects, budgets, protected paths, and delivery boundary. The Strategy may evolve inside that envelope as the agent discovers new repository facts. It can change slices, tools, sequencing, adjacent in-root scope, equivalent checks, and approved model fallback without reopening decisions that the human already made.

That separation avoids two common extremes. A rigid plan does not have to predict every implementation detail, and an adaptive agent does not receive permission to redefine the task. Workflow keeps the destination stable while allowing a practical route to emerge.

## Evidence that matches the risk

More ceremony does not automatically create more trust. Workflow therefore calibrates evidence instead of demanding the same artifact weight for every change.

Manual low- or medium-risk work without Hard Triggers can use Lean Evidence: compact, structured proof with meaningful changed paths and a clear summary. High-risk work, Hard Triggers, supervised runs, and autonomous runs require Full Evidence. In every profile, claims stay precise:

- **Verified** means the required proof is present and supports the claim.
- **Provisional** means a human knowingly accepts a delivery with an unavailable or incomplete proof surface.
- **Unavailable** means evidence could not be obtained; it is not disguised as a failed or successful Check.
- **Failed** means a required Check is known to have failed and the work remains blocked.

Provisional acceptance does not rewrite a failed Check, qualify automation history, or persist as if verification happened. This distinction keeps the evidence chain useful instead of turning it into documentation theater.

## Model choice stays under explicit control

In Manual work, Workflow does not choose or remap the model. The human selects the primary model in Cursor, and any bounded subagent work must inherit it. The primary agent remains responsible for integration and closeout.

Controller profiles use versioned, ordered model Pools for planning, investigation, writing, escalation, verification, review, and explanation. Candidates, reasoning effort, options, fallback, and cost assumptions are explicit. Writer affinity persists until a phase or escalation boundary, avoiding silent model churn in the middle of an implementation. Unsupported aliases, free fallback, and unobserved remapping fail closed.

This makes model routing an inspectable delivery decision rather than invisible infrastructure behavior.

## Human authority is a product feature

Workflow is built around deliberate human decisions, not around removing the human from every loop. The plugin preserves approval where it carries real meaning:

- approving the Intent and its authority envelope;
- enabling repository-specific supervised or autonomous operation;
- approving exact verification and certification hashes;
- accepting supervised delivery, including an explicit provisional acceptance;
- authorizing material replans, protected changes, dependencies, external effects, or security exceptions.

Automation may prepare, execute, observe, and explain inside its granted authority. It cannot manufacture approval, convert missing evidence into success, or silently expand its own boundary.

## Repository delivery is the deliberate finish line

Workflow's maximum effect is a reviewed local repository delivery. It does not automatically push, open or merge a pull request, deploy, access production, integrate a branch, or publish learning. Controller work is returned on a local branch for human integration.

That boundary keeps the system useful in real repositories without coupling implementation authority to publication authority. It also makes the final verdict honest: `repository-only` describes a repository result, not a claim that downstream release or production work happened.

## What using Workflow feels like

You begin with an outcome, not a pile of workflow paperwork. `/plan-work` turns the request into a compact Intent Root that is strict about meaning and tolerant about presentation. You approve it through Cursor's normal plan interaction. Implementation can adapt inside the agreed boundary, then deterministic closeout binds evidence to the exact plan and repository state. A fresh `/review-work` evaluates the delivery rather than asking the implementing context to grade itself.

From there, the next action is explicit: accept a verified delivery, consciously accept a provisional gap, correct a bounded issue, replan a material change, or stop on a failed Check. `/work-status` explains the current state without mutating it. `/explain-work` translates the chain into human terms. `/learn-from-work` can extract reusable guidance only after the work has earned that outcome.

The experience stays lightweight for routine Manual work and becomes progressively stricter as risk and autonomy increase.

## Who it is for

Workflow is a strong fit when you:

- use Cursor for meaningful repository changes, not only isolated code snippets;
- want plans that remain authoritative without freezing implementation details;
- need review and evidence that can be inspected after the agent context changes;
- want to use economical and premium models deliberately across delivery phases;
- prefer opt-in automation with explicit budgets and repository boundaries;
- need a credible path from human-driven work to supervised orchestration and narrowly certified autonomy.

It is intentionally not a one-click deployment service, an automatic merge bot, or a mechanism for declaring every task successful. Its value is the controlled chain between intent and acceptance.

## Start with the smallest useful loop

Most users should begin in Manual mode with `/plan-work`, **Implement Plan**, and `/review-work`. Add `/correct-work`, `/explain-work`, or `/learn-from-work` when the verdict calls for them. Use [the usage example](usage-example.md) for concrete command flows.

Introduce the controller only when you need orchestration beyond that loop. [Configuration](configuration.md) defines explicit model Pools and project ceilings. Before enabling writable supervised or autonomous behavior, follow the [certification runbook](certification-runbook.md) and treat unavailable live evidence as unavailable—not as an implied pass.
