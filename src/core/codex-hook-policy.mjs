import {
  childAllowedByPolicy,
  resolveManualSubagentPolicy,
  selectCodexCandidate,
} from "./manual-subagent-policy.mjs";

export const CODEX_PLAN_MARKER = "[workflow-codex-plan-v1]";
export const CODEX_REVIEW_MARKER = "[workflow-codex-review-v1]";
export const CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v1]";
export const MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";

const WORKFLOW_COMMAND = /(?:^|\s)\$(plan-work|correct-work|review-work|explain-work|close-work|learn-from-work|work-status|accept-work)(?=\s|$)/i;
const ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;
const EVIDENCE_ID = /\bde-[A-Za-z0-9][A-Za-z0-9-]*\b/;
const UNAVAILABLE_MODEL = /(?:unknown|unavailable|not\s+found|unsupported).{0,80}model|model.{0,80}(?:unknown|unavailable|not\s+found|unsupported)/i;

const denyTool = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

function phaseForPrompt(prompt, state) {
  const command = String(prompt ?? "").match(WORKFLOW_COMMAND)?.[1]?.toLowerCase();
  if (command === "plan-work") return "planning";
  if (command === "correct-work") return "correction";
  if (command === "review-work") return "review";
  if (command) return command.replace(/-work$/, "");
  if (state.active_root_plan_id && /\bimplement(?:iere|ation)?\s+(?:the\s+)?plan\b/i.test(String(prompt ?? ""))) return "implementation";
  return null;
}

function shellSegmentReadOnly(segment) {
  const cleaned = segment.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*/, "").replace(/^rtk\s+/, "");
  return /^(?:pwd|ls|rg|grep|head|tail|wc|stat|find|readlink|which|type|file|test)(?:\s|$)/.test(cleaned)
    || /^sed\s+-n(?:\s|$)/.test(cleaned)
    || /^git\s+(?:status|diff|show|log|rev-parse|ls-files|check-ignore)(?:\s|$)/.test(cleaned)
    || /^node\s+[^\s]*(?:validate|check|inspect)[^\s]*\.mjs(?:\s|$)/.test(cleaned)
    || /^npm\s+(?:test|run\s+(?:test|check|validate|release-check))(?:\s|$)/.test(cleaned);
}

export function isReadOnlyShell(command) {
  const source = String(command ?? "");
  if (!source.trim() || /(?:^|[^<])>(?:>|&)?|\btee\b|\bsed\s+-i\b|\bperl\s+-i\b/.test(source)) return false;
  return source.split(/\s*(?:&&|\|\||;|\|)\s*/).filter(Boolean).every(shellSegmentReadOnly);
}

function isWorkflowTool(name, suffix) {
  return String(name ?? "").toLowerCase().endsWith(suffix.toLowerCase());
}

function mutatingReviewTool(input) {
  const name = String(input.tool_name ?? "");
  if (/^(?:apply_patch|Edit|Write)$/i.test(name)) return true;
  if (name === "Bash") return !isReadOnlyShell(input.tool_input?.command ?? input.tool_input?.cmd);
  if (isWorkflowTool(name, "workflow_artifact_record")) return false;
  if (/^mcp__/i.test(name)) return !/(?:read|get|list|search|find|inspect|status|context)/i.test(name);
  return /(?:write|edit|delete|remove|create|update|publish|send|commit|push|merge|deploy)/i.test(name);
}

function toolSucceeded(response) {
  const source = JSON.stringify(response ?? {});
  return !/"isError"\s*:\s*true|"error"\s*:/i.test(source);
}

function idsFrom(value, pattern) {
  return [...new Set(String(typeof value === "string" ? value : JSON.stringify(value ?? {})).match(new RegExp(pattern.source, "g")) ?? [])];
}

function agentToolName(name) {
  return /^(?:Agent|spawn_agent)$/i.test(String(name ?? ""));
}

function requestedModel(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) return null;
  for (const key of ["model", "model_id"]) {
    if (Object.prototype.hasOwnProperty.call(toolInput, key) && toolInput[key] !== undefined && toolInput[key] !== null && toolInput[key] !== "") {
      return String(toolInput[key]).trim();
    }
  }
  return null;
}

function modelUnavailable(response) {
  return UNAVAILABLE_MODEL.test(JSON.stringify(response ?? {}));
}

function routingEnabled(policy) {
  return policy?.mode === "parent-or-approved" && (policy.hosts?.codex?.candidates?.length ?? 0) > 0;
}

function ensureTurnRouting(turn, policy) {
  if (!turn.routing) {
    turn.routing = {
      mode: policy.mode,
      unavailable: [],
      selected: null,
      reasoning_effort_attested: false,
    };
  }
  return turn.routing;
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

export function evaluateCodexHook(input, priorState = {}, options = {}) {
  const state = structuredClone(priorState ?? {});
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
    const phase = phaseForPrompt(input.prompt, state);
    if (!phase) return { output: {}, state };
    const turn = {
      turn_id: input.turn_id ?? null,
      phase,
      parent_model: input.model ?? state.parent_model ?? null,
      preflight_passed: false,
      root_recorded: false,
      closeout_recorded: false,
      pending_agents: [],
      invalid_agents: {},
      routing: {
        mode: policy.mode,
        unavailable: [],
        selected: null,
        reasoning_effort_attested: false,
      },
    };
    state.turn = turn;
    if (phase === "planning" && input.permission_mode !== "plan") {
      return { output: { decision: "block", reason: "$plan-work requires Codex Plan mode." }, state };
    }
    const marker = phase === "planning" ? CODEX_PLAN_MARKER : phase === "review" ? CODEX_REVIEW_MARKER : ["implementation", "correction"].includes(phase) ? CODEX_IMPLEMENTATION_MARKER : "[workflow-codex-manual-v1]";
    const routingNote = routingEnabled(policy)
      ? "Codex may use the configured ordered Manual subagent candidates with parent fallback."
      : "Preserve human authorization and do not request a concrete subagent model outside parent inheritance.";
    return {
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `${marker} ${MODEL_INHERIT_MARKER} Workflow is Manual on Codex. ${routingNote}`,
        },
      },
      state,
    };
  }

  const turn = state.turn;
  if (!turn) return { output: {}, state };
  const routing = ensureTurnRouting(turn, policy);

  if (event === "PreToolUse") {
    if (Object.keys(turn.invalid_agents ?? {}).length > 0) {
      return { output: denyTool("Workflow blocked this tool because a subagent model could not be attested. Its result is invalid evidence."), state };
    }
    if (agentToolName(input.tool_name)) {
      if (!routingEnabled(policy)) {
        const requested = requestedModel(input.tool_input);
        if (requested) return { output: denyTool("Workflow requires inherited subagent models; remove explicit model."), state };
        turn.pending_agents.push({
          tool_use_id: input.tool_use_id ?? null,
          agent_type: input.tool_input?.agent_type ?? input.tool_input?.subagent_type ?? null,
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
      if (!selected) {
        return { output: denyTool("Workflow Manual subagent pool is exhausted and parent fallback is disabled."), state };
      }
      routing.selected = selected;
      const updatedInput = buildAgentInput(input.tool_input, selected);
      turn.pending_agents.push({
        tool_use_id: input.tool_use_id ?? null,
        agent_type: input.tool_input?.agent_type ?? input.tool_input?.subagent_type ?? null,
        selected_kind: selected.kind,
        selected_model: selected.model_id,
        selected_reasoning_effort: selected.reasoning_effort,
      });
      return {
        output: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput,
          },
        },
        state,
      };
    }
    if (turn.phase === "review" && mutatingReviewTool(input)) {
      return { output: denyTool("$review-work is read-only; mutating tools are blocked until a separate human-authorized correction or implementation task."), state };
    }
    return { output: {}, state };
  }

  if (event === "PostToolUse") {
    if (agentToolName(input.tool_name) && !toolSucceeded(input.tool_response) && modelUnavailable(input.tool_response)) {
      const failedModel = requestedModel(input.tool_input) ?? routing.selected?.model_id;
      if (failedModel && !routing.unavailable.includes(failedModel)) routing.unavailable.push(failedModel);
    }
    if (toolSucceeded(input.tool_response)) {
      if (isWorkflowTool(input.tool_name, "workflow_plan_preflight")) {
        turn.preflight_passed = true;
        turn.root_plan_id = idsFrom(input.tool_input?.root_plan, ROOT_ID)[0] ?? turn.root_plan_id ?? null;
      }
      if (isWorkflowTool(input.tool_name, "workflow_artifact_record")) {
        const rootIds = idsFrom(input.tool_input?.artifacts, ROOT_ID);
        if (rootIds.length > 0) {
          turn.root_recorded = true;
          turn.root_plan_id = turn.root_plan_id ?? rootIds[0];
          state.active_root_plan_id = turn.root_plan_id;
        }
      }
      if (isWorkflowTool(input.tool_name, "workflow_closeout")) {
        const evidenceIds = idsFrom(input.tool_response, EVIDENCE_ID);
        if (evidenceIds.length > 0) {
          turn.closeout_recorded = true;
          turn.delivery_evidence_id = evidenceIds[0];
        }
      }
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
    const selectedMatch = expected && observed && expected === observed;
    const allowed = selectedMatch || allowance.allowed;
    if (!expected || !observed || !allowed) {
      const agentId = input.agent_id ?? `unattested-${Object.keys(turn.invalid_agents).length + 1}`;
      turn.invalid_agents[agentId] = {
        expected,
        observed,
        agent_type: input.agent_type ?? pending?.agent_type ?? null,
        match_mode: allowance.match_mode,
        policy_mode: policy.mode,
        reasoning_effort_attested: false,
      };
      return {
        output: {
          systemMessage: `Workflow model attestation failed for ${agentId}: expected ${expected ?? "<unavailable>"}, observed ${observed ?? "<unavailable>"}. The result cannot be evidence.`,
          hookSpecificOutput: {
            hookEventName: "SubagentStart",
            additionalContext: "Stop without using tools. Your model did not match the Workflow Manual subagent policy, so your result is invalid evidence.",
          },
        },
        state,
      };
    }
    routing.last_attested = {
      observed,
      match_mode: selectedMatch ? (pending?.selected_kind === "parent" ? "exact-parent" : "selected-candidate") : allowance.match_mode,
      reasoning_effort_attested: false,
    };
    return { output: {}, state };
  }

  if (event === "SubagentStop" && turn.invalid_agents?.[input.agent_id]) {
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
    const message = String(input.last_assistant_message ?? "");
    if (turn.phase === "planning") {
      const hasNativePlan = /<proposed_plan>[\s\S]*<\/proposed_plan>/i.test(message) && ROOT_ID.test(message);
      if (!turn.preflight_passed || !turn.root_recorded || !hasNativePlan) {
        return { output: { decision: "block", reason: "Finish $plan-work: validate the exact Schema-5 Root with workflow_plan_preflight, record it, and return one <proposed_plan> containing its wp-* ID." }, state };
      }
      state.active_root_plan_id = turn.root_plan_id ?? message.match(ROOT_ID)?.[0] ?? state.active_root_plan_id;
    }
    if (["implementation", "correction"].includes(turn.phase) && (!turn.closeout_recorded || !EVIDENCE_ID.test(message))) {
      return { output: { decision: "block", reason: "Finish the Manual Workflow closeout with workflow_closeout and report the resulting de-* artifact before stopping." }, state };
    }
    if (Object.keys(turn.invalid_agents ?? {}).length > 0) {
      return { output: { decision: "block", reason: "Discard the unattested subagent result and complete the Workflow step without using it as evidence." }, state };
    }
    state.turn = null;
    return { output: {}, state };
  }

  return { output: {}, state };
}
