# Human-first Workflow output

Every material Workflow reply serves people first and agents second. Use the same three layers for Plan presentation, implementation or correction handoff, Review, status, explanation, acceptance, and controller delivery. Keep artifact schemas and `structuredContent` unchanged; presentation never creates a second authority source.

## 1. Quick decision

Start with `Quick decision`. It lets a person decide without reading implementation history. State the current journey state or result, practical outcome, required-Check summary, and material gap or blocker if one exists. Actionable output has exactly one next action with its actor; terminal output has explicit `Done` or `Accepted provisionally` and no action. Keep raw IDs, hashes, receipts, parser codes, and cache details out unless one is essential to the decision.

## 2. Details for people

Follow with `Details`. Say that this is the optional deep dive when the quick decision does not resolve uncertainty. Explain the complete decision-relevant meaning in plain language: goal or achieved outcome, approach and rationale, scope and non-goals, constraints, acceptance and verification meaning, risks, trade-offs, unknowns, limitations, and recovery. Native Plans make this coverage deterministic with the labeled structure defined by the Plan-container contract. Do not hide a semantic requirement only in the agent layer. Translate technical state instead of making the person reconstruct it from fields, but avoid an implementation diary.

For reviewed delivery, keep `What was achieved`, `What this means`, and `Verification and limits` inside this layer. Only `achieved` is a **Final repository explanation**; every other reviewed state is a **Preliminary explanation** with its blocker and next safe action.

## 3. Agent and machine contract

Finish with `Agent and machine contract`. Mark it as authoritative process data for the implementing, correcting, reviewing, or continuing agent. The human layers above are faithful projections for oversight; they add no authority, requirements, or exceptions. If the layers conflict, stop and repair the presentation before action.

This last layer must stand alone for a weaker capable agent. Never say only "as above". Include the exact applicable artifacts or structured fields; IDs and state; allowed, protected, and approval-required scope; ordered work and dependencies; targets and symbols; exact commands or inspections, working directories, expectations, and completion probes; evidence grades and limitations; stop, clarify, correct, retry, or replan conditions; and raw errors, hashes, or receipts needed for continuation. Prefer compact deterministic YAML, JSON, or tables over repeated prose. The existing Schema-5 Root remains the sole Plan authority; do not add a duplicate JSON projection of it.

Use one `<details>` disclosure only when the host preserves its complete contents and the authoritative bytes remain directly extractable. Otherwise render the layer open. Folding is a display convenience, never a transport, validation, or authority dependency.

An MCP tool result is the deliberate exception to duplicating the contract in visible text: its complete `structuredContent` is already the authoritative agent and machine contract. End `content[0].text` with a bounded `Agent and machine index` that points to `structuredContent`, calls itself non-authoritative, and never implies that omitted artifact bytes can be reconstructed from the index. The responding agent must inspect the complete `structuredContent` before continuing or composing its own three-layer reply.

## Consistency

- Derive all three layers from the same current Root, evidence, review, snapshot, or tool result.
- Match explanatory language to the user while keeping commands, schema tokens, IDs, paths, and status values exact.
- Keep the order even for short terminal replies; `Details` may be concise, but it is not replaced by raw machine output.
- Structured machine data remains complete and stable. Human clarity is additive and must not delete evidence, uncertainty, boundaries, or next-action semantics.
