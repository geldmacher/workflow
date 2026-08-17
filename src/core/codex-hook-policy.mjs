import {
  childAllowedByPolicy,
  resolveManualSubagentPolicy,
  selectCodexCandidate,
} from "./manual-subagent-policy.mjs";
import { isReadOnlyShell } from "./manual-check-receipts.mjs";
import { manualJourneyDecision } from "./manual-journey.mjs";
import {
  extractRootPlanText,
  inspectPresentedRootPlan,
} from "./root-plan-attestation.mjs";

export const CODEX_PLAN_MARKER = "[workflow-codex-plan-v1]";
export const CODEX_REVIEW_MARKER = "[workflow-codex-review-v1]";
export const CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v1]";
export const MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";

const WORKFLOW_SKILLS = [
  "plan-work",
  "correct-work",
  "review-work",
  "explain-work",
  "learn-from-work",
  "work-status",
  "accept-work",
];
const WORKFLOW_SKILL_NAMES = WORKFLOW_SKILLS.join("|");
const WORKFLOW_TOKEN = new RegExp(`(?:^|[\\s('"\\x60])\\$(?:geldmacher-workflow:)?(${WORKFLOW_SKILL_NAMES})(?=$|[\\s.,;!?')"\\x60]|:(?=\\s|$))`, "gi");
const WORKFLOW_MARKDOWN_LINK = new RegExp(`\\[\\$(?:geldmacher-workflow:)?(${WORKFLOW_SKILL_NAMES})\\]\\(([^)\\r\\n]+)\\)`, "gi");
const UNAVAILABLE_MODEL = /(?:unknown|unavailable|not\s+found|unsupported).{0,80}model|model.{0,80}(?:unknown|unavailable|not\s+found|unsupported)/i;
const NATIVE_AUDITOR_ROLES = new Set(["delivery-auditor", "risk-auditor", "work-design-auditor"]);

const denyTool = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

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

function isWorkflowTool(name, suffix) {
  return String(name ?? "").toLowerCase().endsWith(suffix.toLowerCase());
}

function agentToolName(name) {
  return /^(?:Agent|spawn_agent)$/i.test(String(name ?? ""));
}

function markedWorkflowAgent(input) {
  if (!agentToolName(input.tool_name)) return false;
  const source = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
  return String(source.prompt ?? source.task ?? "").includes(MODEL_INHERIT_MARKER);
}

function reviewAgentRole(input) {
  if (!agentToolName(input.tool_name)) return null;
  const source = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input) ? input.tool_input : {};
  const role = String(source.agent_type ?? source.subagent_type ?? "");
  const prompt = String(source.prompt ?? source.task ?? "");
  return source.readonly === true && prompt.includes("[workflow-readonly-review-v1]") && NATIVE_AUDITOR_ROLES.has(role)
    ? role
    : null;
}

function mutatingReviewTool(input) {
  const name = String(input.tool_name ?? "");
  if (agentToolName(name)) return !reviewAgentRole(input);
  if (/^(?:apply_patch|ApplyPatch|Edit|Write|Delete|DeleteFile|StrReplace|EditNotebook)$/i.test(name)) return true;
  if (/^(?:Bash|Shell)$/i.test(name)) return !isReadOnlyShell(input.tool_input?.command ?? input.tool_input?.cmd);
  if (["workflow_closeout", "workflow_plan_preflight", "workflow_status"].some((suffix) => isWorkflowTool(name, suffix))) return false;
  if (/^mcp__/i.test(name)) return !/(?:read|get|list|search|find|inspect|status|context|preflight|closeout)/i.test(name);
  return /(?:write|edit|delete|remove|create|update|publish|send|commit|push|merge|deploy)/i.test(name);
}

function requestedModel(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) return null;
  for (const key of ["model", "model_id"]) {
    if (Object.prototype.hasOwnProperty.call(toolInput, key) && toolInput[key] != null && toolInput[key] !== "") return String(toolInput[key]).trim();
  }
  return null;
}

function toolSucceeded(response) {
  return !/"isError"\s*:\s*true|"error"\s*:/i.test(JSON.stringify(response ?? {}));
}

function modelUnavailable(response) {
  return UNAVAILABLE_MODEL.test(JSON.stringify(response ?? {}));
}

function routingEnabled(policy) {
  return policy?.mode === "parent-or-approved" && (policy.hosts?.codex?.candidates?.length ?? 0) > 0;
}

function buildAgentInput(toolInput, selected) {
  const next = { ...(toolInput && typeof toolInput === "object" && !Array.isArray(toolInput) ? toolInput : {}) };
  delete next.model_id;
  delete next.provider;
  delete next.reasoningEffort;
  if (selected.kind === "parent") {
    delete next.model;
    delete next.reasoning_effort;
    delete next.fork_turns;
    return next;
  }
  next.model = selected.model_id;
  if (selected.reasoning_effort) next.reasoning_effort = selected.reasoning_effort;
  else delete next.reasoning_effort;
  next.fork_turns = "none";
  return next;
}

function freshState(priorState, input = {}) {
  if (priorState?.schema === 2 && priorState?.kind === "manual-native-plan-review") return structuredClone(priorState);
  return { schema: 2, kind: "manual-native-plan-review", parent_model: input.model ?? null, turn: null };
}

function beginTurn(phase, input, policy, state) {
  return {
    phase,
    turn_id: input.turn_id ?? null,
    parent_model: input.model ?? state.parent_model ?? null,
    pending_agents: [],
    invalid_agents: {},
    started_review_auditors: [],
    observed_review_auditors: [],
    routing: { mode: policy.mode, unavailable: [], selected: null, reasoning_effort_attested: false },
  };
}

function planningStop(input, state, options = {}) {
  const message = String(input.last_assistant_message ?? "");
  const rootText = extractRootPlanText(message);
  let reason = null;
  if (!/<proposed_plan>[\s\S]*<\/proposed_plan>/i.test(message) || !rootText) {
    reason = "Workflow Plan validation failed: return one <proposed_plan> containing the exact Schema-5 Root text and its wp-* ID.";
  } else {
    const inspected = inspectPresentedRootPlan(rootText, {
      pluginRoot: options.pluginRoot,
      preflightRootPlan: options.preflightRootPlan,
    });
    if (!inspected.ok) {
      const detail = inspected.blockers.slice(0, 4)
        .map((issue) => String(issue?.message ?? issue).replace(/\s+/g, " ").slice(0, 200))
        .filter(Boolean)
        .join("; ");
      reason = `Workflow Plan validation failed: the native Plan must contain one valid Schema-5 Root${detail ? `: ${detail}` : "."}`;
    }
  }
  if (!reason) {
    state.turn = null;
    return { output: {}, state };
  }
  if (input.stop_hook_active === true) {
    state.turn = null;
    return {
      output: {
        continue: false,
        stopReason: "Workflow native Plan validation failed.",
        systemMessage: reason,
      },
      state,
    };
  }
  return { output: { decision: "block", reason }, state };
}

export { isReadOnlyShell };

export function evaluateCodexHook(input, priorState = {}, options = {}) {
  const state = freshState(priorState, input);
  const event = input.hook_event_name;
  const policy = options.manualSubagentPolicy ?? resolveManualSubagentPolicy(options);

  if (event === "SessionStart") {
    state.parent_model = input.model ?? null;
    state.manual_subagent_policy = {
      mode: policy.mode,
      source: policy.source,
      codex_candidates: (policy.hosts?.codex?.candidates ?? []).map((entry) => entry.model_id),
    };
    return { output: {}, state };
  }

  if (event === "UserPromptSubmit") {
    state.turn = null;
    const classification = classifyCodexWorkflowPrompt(input.prompt);
    if (classification.kind === "hook-continuation") return { output: {}, state };
    if (classification.kind === "ambiguous-workflow-skill") {
      return { output: { decision: "block", reason: "Workflow · Blocked. Use exactly one explicit Workflow skill in this prompt." }, state };
    }
    const phase = classification.phase;
    if (!phase) return { output: {}, state };
    if (phase === "planning" && input.permission_mode !== "plan") {
      return { output: { decision: "block", reason: "$plan-work requires Codex Plan mode." }, state };
    }
    state.turn = beginTurn(phase, input, policy, state);
    const marker = phase === "planning"
      ? CODEX_PLAN_MARKER
      : phase === "review"
        ? CODEX_REVIEW_MARKER
        : ["implementation", "correction"].includes(phase)
          ? CODEX_IMPLEMENTATION_MARKER
          : "[workflow-codex-manual-v1]";
    const routingNote = routingEnabled(policy)
      ? "Codex may use configured approved Manual candidates with parent fallback."
      : "Subagents inherit the parent model; do not request a concrete model.";
    return {
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `${marker} ${MODEL_INHERIT_MARKER} Native task plans are the only Manual plan authority. Implementation ends normally; fresh Review owns Evidence. ${routingNote}`,
        },
      },
      state,
    };
  }

  if (!state.turn && event === "PreToolUse" && markedWorkflowAgent(input)) {
    state.turn = beginTurn("implementation", input, policy, state);
  }
  const turn = state.turn;
  if (!turn) return { output: {}, state };
  const routing = turn.routing;

  if (event === "PreToolUse") {
    if (Object.keys(turn.invalid_agents).length > 0) {
      return { output: denyTool("Workflow blocked this tool because a subagent model could not be attested."), state };
    }
    if (turn.phase === "review" && mutatingReviewTool(input)) {
      return {
        output: denyTool(manualJourneyDecision({
          state: "blocked",
          blocker: "$review-work is repository-read-only; mutations require a separate human-authorized correction.",
          action: "retry-review",
          trace: { root_plan_id: null },
        })),
        state,
      };
    }
    if (!agentToolName(input.tool_name)) return { output: {}, state };
    if (!routingEnabled(policy)) {
      if (requestedModel(input.tool_input)) return { output: denyTool("Workflow requires inherited subagent models; remove explicit model."), state };
      turn.pending_agents.push({
        tool_use_id: input.tool_use_id ?? null,
        agent_type: input.tool_input?.agent_type ?? input.tool_input?.subagent_type ?? null,
        review_auditor_role: reviewAgentRole(input),
        selected_kind: "parent",
        selected_model: turn.parent_model ?? state.parent_model ?? null,
      });
      return { output: {}, state };
    }
    const selected = selectCodexCandidate({
      hostPolicy: policy.hosts.codex,
      mode: policy.mode,
      unavailable: routing.unavailable,
      parentModel: turn.parent_model ?? state.parent_model,
    });
    if (!selected) return { output: denyTool("Workflow Manual subagent pool is exhausted and parent fallback is disabled."), state };
    routing.selected = selected;
    turn.pending_agents.push({
      tool_use_id: input.tool_use_id ?? null,
      agent_type: input.tool_input?.agent_type ?? input.tool_input?.subagent_type ?? null,
      review_auditor_role: reviewAgentRole(input),
      selected_kind: selected.kind,
      selected_model: selected.model_id,
    });
    return {
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: buildAgentInput(input.tool_input, selected),
        },
      },
      state,
    };
  }

  if (event === "PostToolUse") {
    const auditor = reviewAgentRole(input);
    if (auditor && toolSucceeded(input.tool_response) && turn.started_review_auditors.includes(auditor)) {
      turn.observed_review_auditors = [...new Set([...turn.observed_review_auditors, auditor])].sort();
    }
    if (agentToolName(input.tool_name) && !toolSucceeded(input.tool_response) && modelUnavailable(input.tool_response)) {
      const failed = requestedModel(input.tool_input) ?? routing.selected?.model_id;
      if (failed && !routing.unavailable.includes(failed)) routing.unavailable.push(failed);
    }
    return { output: {}, state };
  }

  if (event === "SubagentStart") {
    const pending = turn.pending_agents.shift() ?? null;
    const expected = pending?.selected_model ?? turn.parent_model ?? state.parent_model ?? null;
    const observed = input.model ?? null;
    const allowance = childAllowedByPolicy({
      parentModel: turn.parent_model ?? state.parent_model,
      observedChild: observed,
      hostPolicy: policy.hosts?.codex,
      mode: policy.mode,
    });
    if (!expected || !observed || (expected !== observed && !allowance.allowed)) {
      const agentId = input.agent_id ?? `unattested-${Object.keys(turn.invalid_agents).length + 1}`;
      turn.invalid_agents[agentId] = { expected, observed };
      return {
        output: {
          systemMessage: `Workflow model attestation failed for ${agentId}: expected ${expected ?? "<unavailable>"}, observed ${observed ?? "<unavailable>"}.`,
          hookSpecificOutput: {
            hookEventName: "SubagentStart",
            additionalContext: "Stop without using tools. This result cannot be Workflow evidence.",
          },
        },
        state,
      };
    }
    if (pending?.review_auditor_role) {
      turn.started_review_auditors = [...new Set([...turn.started_review_auditors, pending.review_auditor_role])].sort();
    }
    return { output: {}, state };
  }

  if (event === "SubagentStop" && turn.invalid_agents[input.agent_id]) {
    return {
      output: {
        continue: false,
        stopReason: "Subagent result rejected by Workflow model attestation.",
        systemMessage: "This subagent result is invalid and must not be cited as Workflow evidence.",
      },
      state,
    };
  }

  if (event === "Stop") {
    if (turn.phase === "planning") return planningStop(input, state, options);
    state.turn = null;
    return { output: {}, state };
  }

  return { output: {}, state };
}
