import { extractRootPlanText, inspectPresentedRootPlan } from "./root-plan-attestation.mjs";

export const CODEX_PLAN_MARKER = "[workflow-codex-plan-v6]";
export const CODEX_REVIEW_MARKER = "[workflow-codex-review-v6]";
export const CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v6]";

const WORKFLOW_SKILLS = ["plan-work", "correct-work", "review-work", "explain-work", "learn-from-work", "work-status", "accept-work"];
const WORKFLOW_SKILL_NAMES = WORKFLOW_SKILLS.join("|");
const WORKFLOW_TOKEN = new RegExp(`(?:^|[\\s('"\\x60])\\$(?:geldmacher-workflow:)?(${WORKFLOW_SKILL_NAMES})(?=$|[\\s.,;!?')"\\x60]|:(?=\\s|$))`, "gi");
const WORKFLOW_MARKDOWN_LINK = new RegExp(`\\[\\$(?:geldmacher-workflow:)?(${WORKFLOW_SKILL_NAMES})\\]\\(([^)\\r\\n]+)\\)`, "gi");

function hookContinuation(prompt) {
  return /^\s*<hook_prompt\b[^>]*\bhook_run_id\s*=\s*["'][^"']+["'][^>]*>[\s\S]*<\/hook_prompt>\s*$/i.test(String(prompt ?? ""));
}

function explicitWorkflowCommand(prompt) {
  const text = String(prompt ?? "");
  const commands = [];
  for (const match of text.matchAll(WORKFLOW_MARKDOWN_LINK)) {
    const command = match[1].toLowerCase();
    const target = match[2].trim().replace(/^<|>$/g, "");
    if (/(?:^|\/)geldmacher-workflow(?:\/|$)/i.test(target)
      && new RegExp(`/skills/${command}/SKILL\\.md(?:[?#].*)?$`, "i").test(target)) commands.push(command);
  }
  for (const match of text.matchAll(WORKFLOW_TOKEN)) commands.push(match[1].toLowerCase());
  const unique = [...new Set(commands)];
  return { command: unique.length === 1 ? unique[0] : null, ambiguous: unique.length > 1 };
}

function explicitCodexCollaborationMode(input) {
  const value = input?.collaboration_mode;
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.mode === "string"
    ? value.mode.trim().toLowerCase()
    : null;
}

export function classifyCodexWorkflowPrompt(prompt) {
  if (hookContinuation(prompt)) return { kind: "hook-continuation", phase: null };
  const explicit = explicitWorkflowCommand(prompt);
  if (explicit.ambiguous) return { kind: "ambiguous-workflow-skill", phase: null };
  if (explicit.command === "plan-work") return { kind: "workflow-skill", phase: "planning" };
  if (explicit.command === "correct-work") return { kind: "workflow-skill", phase: "correction" };
  if (explicit.command === "review-work") return { kind: "workflow-skill", phase: "review" };
  if (explicit.command) return { kind: "workflow-skill", phase: explicit.command.replace(/-work$/, "") };
  return { kind: "ordinary", phase: null };
}

function planningStop(input, state, options = {}) {
  const message = String(input.last_assistant_message ?? "");
  const rootText = extractRootPlanText(message);
  let reason = null;
  if (!/<proposed_plan>[\s\S]*<\/proposed_plan>/i.test(message) || !rootText) {
    reason = "Workflow Plan validation failed: return one <proposed_plan> containing the exact Schema-6 Root text and its wp-* ID.";
  } else {
    const inspected = inspectPresentedRootPlan(rootText, { pluginRoot: options.pluginRoot, preflightRootPlan: options.preflightRootPlan });
    if (!inspected.ok) {
      const detail = inspected.blockers.slice(0, 4).map((issue) => String(issue?.message ?? issue).replace(/\s+/g, " ").slice(0, 200)).filter(Boolean).join("; ");
      reason = `Workflow Plan validation failed: the native Plan must contain one valid Schema-6 Root${detail ? `: ${detail}` : "."}`;
    }
  }
  state.turn = null;
  if (!reason) return { output: {}, state };
  if (input.stop_hook_active === true) return { output: { continue: false, stopReason: "Workflow native Plan validation failed.", systemMessage: reason }, state };
  return { output: { decision: "block", reason }, state };
}

function freshState(priorState = {}) {
  return priorState?.schema === 6 && priorState?.kind === "workflow-lifecycle-kernel"
    ? structuredClone(priorState)
    : { schema: 6, kind: "workflow-lifecycle-kernel", turn: null };
}

export function evaluateCodexHook(input, priorState = {}, options = {}) {
  const state = freshState(priorState);
  const event = input?.hook_event_name;
  if (event === "UserPromptSubmit") {
    state.turn = null;
    const classification = classifyCodexWorkflowPrompt(input.prompt);
    if (classification.kind === "hook-continuation" || classification.kind === "ordinary") return { output: {}, state };
    if (classification.kind === "ambiguous-workflow-skill") return { output: { decision: "block", reason: "Workflow · Blocked. Use exactly one explicit Workflow skill in this prompt." }, state };
    if (classification.phase === "planning") {
      const mode = explicitCodexCollaborationMode(input);
      if (mode && mode !== "plan") return { output: { decision: "block", reason: "$plan-work requires Codex Plan mode." }, state };
    }
    state.turn = { phase: classification.phase, turn_id: input.turn_id ?? null };
    const marker = classification.phase === "planning"
      ? CODEX_PLAN_MARKER
      : classification.phase === "review"
        ? CODEX_REVIEW_MARKER
        : ["implementation", "correction"].includes(classification.phase)
          ? CODEX_IMPLEMENTATION_MARKER
          : "[workflow-codex-manual-v6]";
    const phaseBoundary = classification.phase === "review"
      ? "Review is conceptually repository-read-only. The active project harness chooses and enforces concrete execution and attests before/after snapshots; Workflow does not classify tools or commands."
      : "The active project harness owns every concrete execution choice; Workflow owns only lifecycle, authority, lineage, evidence grade, and human gates.";
    return {
      output: { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `${marker} ${phaseBoundary}` } },
      state,
    };
  }
  if (event === "Stop" && state.turn?.phase === "planning") return planningStop(input, state, options);
  if (event === "Stop") state.turn = null;
  return { output: {}, state };
}
