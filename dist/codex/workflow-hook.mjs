#!/usr/bin/env node
#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);

// src/hosts/codex/workflow-hook.mjs
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// src/core/codex-hook-policy.mjs
var CODEX_PLAN_MARKER = "[workflow-codex-plan-v1]";
var CODEX_REVIEW_MARKER = "[workflow-codex-review-v1]";
var CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v1]";
var MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";
var WORKFLOW_COMMAND = /(?:^|\s)\$(plan-work|correct-work|review-work|explain-work|close-work|learn-from-work|work-status|accept-work)(?=\s|$)/i;
var ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;
var EVIDENCE_ID = /\bde-[A-Za-z0-9][A-Za-z0-9-]*\b/;
var denyTool = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason
  }
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
function explicitModelOverride(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  for (const key of ["model", "model_id", "reasoning_effort", "reasoningEffort", "provider"]) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== void 0 && input[key] !== null && input[key] !== "") return key;
  }
  return null;
}
function shellSegmentReadOnly(segment) {
  const cleaned = segment.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*/, "").replace(/^rtk\s+/, "");
  return /^(?:pwd|ls|rg|grep|head|tail|wc|stat|find|readlink|which|type|file|test)(?:\s|$)/.test(cleaned) || /^sed\s+-n(?:\s|$)/.test(cleaned) || /^git\s+(?:status|diff|show|log|rev-parse|ls-files|check-ignore)(?:\s|$)/.test(cleaned) || /^node\s+[^\s]*(?:validate|check|inspect)[^\s]*\.mjs(?:\s|$)/.test(cleaned) || /^npm\s+(?:test|run\s+(?:test|check|validate|release-check))(?:\s|$)/.test(cleaned);
}
function isReadOnlyShell(command) {
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
function evaluateCodexHook(input, priorState = {}) {
  const state = structuredClone(priorState ?? {});
  const event = input.hook_event_name;
  if (event === "SessionStart") {
    state.parent_model = input.model ?? null;
    return { output: {}, state };
  }
  if (event === "UserPromptSubmit") {
    const phase = phaseForPrompt(input.prompt, state);
    if (!phase) return { output: {}, state };
    const turn2 = {
      turn_id: input.turn_id ?? null,
      phase,
      parent_model: input.model ?? state.parent_model ?? null,
      preflight_passed: false,
      root_recorded: false,
      closeout_recorded: false,
      pending_agents: [],
      invalid_agents: {}
    };
    state.turn = turn2;
    if (phase === "planning" && input.permission_mode !== "plan") {
      return { output: { decision: "block", reason: "$plan-work requires Codex Plan mode." }, state };
    }
    const marker = phase === "planning" ? CODEX_PLAN_MARKER : phase === "review" ? CODEX_REVIEW_MARKER : ["implementation", "correction"].includes(phase) ? CODEX_IMPLEMENTATION_MARKER : "[workflow-codex-manual-v1]";
    return {
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `${marker} ${MODEL_INHERIT_MARKER} Workflow is Manual on Codex. Preserve human authorization and do not request a concrete subagent model.`
        }
      },
      state
    };
  }
  const turn = state.turn;
  if (!turn) return { output: {}, state };
  if (event === "PreToolUse") {
    if (Object.keys(turn.invalid_agents ?? {}).length > 0) {
      return { output: denyTool("Workflow blocked this tool because a subagent model could not be attested. Its result is invalid evidence."), state };
    }
    if (input.tool_name === "Agent") {
      const override = explicitModelOverride(input.tool_input);
      if (override) return { output: denyTool(`Workflow requires inherited subagent models; remove explicit ${override}.`), state };
      turn.pending_agents.push({ tool_use_id: input.tool_use_id ?? null, agent_type: input.tool_input?.agent_type ?? input.tool_input?.subagent_type ?? null });
    }
    if (turn.phase === "review" && mutatingReviewTool(input)) {
      return { output: denyTool("$review-work is read-only; mutating tools are blocked until a separate human-authorized correction or implementation task."), state };
    }
    return { output: {}, state };
  }
  if (event === "PostToolUse" && toolSucceeded(input.tool_response)) {
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
    return { output: {}, state };
  }
  if (event === "SubagentStart") {
    const expected = turn.parent_model ?? state.parent_model ?? null;
    const observed = input.model ?? null;
    turn.pending_agents.shift();
    if (!expected || !observed || expected !== observed) {
      const agentId = input.agent_id ?? `unattested-${Object.keys(turn.invalid_agents).length + 1}`;
      turn.invalid_agents[agentId] = { expected, observed, agent_type: input.agent_type ?? null };
      return {
        output: {
          systemMessage: `Workflow model attestation failed for ${agentId}: expected ${expected ?? "<unavailable>"}, observed ${observed ?? "<unavailable>"}. The result cannot be evidence.`,
          hookSpecificOutput: {
            hookEventName: "SubagentStart",
            additionalContext: "Stop without using tools. Your model did not match the Workflow parent-model contract, so your result is invalid evidence."
          }
        },
        state
      };
    }
    return { output: {}, state };
  }
  if (event === "SubagentStop" && turn.invalid_agents?.[input.agent_id]) {
    return {
      output: {
        continue: false,
        stopReason: "Subagent result rejected by Workflow model attestation.",
        systemMessage: "This subagent result is invalid and must not be cited as Workflow evidence."
      },
      state
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

// src/hosts/codex/workflow-hook.mjs
var MAX_INPUT_BYTES = 1024 * 1024;
var digest = (value) => createHash("sha256").update(String(value)).digest("hex");
function statePath(input, root = null) {
  const base = resolve(root ?? process.env.PLUGIN_DATA ?? join(homedir(), ".codex", "geldmacher-workflow"));
  const repository = digest(resolve(input.cwd ?? process.cwd())).slice(0, 20);
  const session = digest(input.session_id ?? "missing-session").slice(0, 32);
  return join(base, "hooks", repository, "sessions", `${session}.json`);
}
function readState(path) {
  if (!existsSync(path)) return {};
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid Workflow Codex hook state");
  return value;
}
function writeState(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  renameSync(temporary, path);
}
function runCodexHook(input, options = {}) {
  const path = statePath(input, options.stateRoot);
  const evaluated = evaluateCodexHook(input, readState(path));
  writeState(path, evaluated.state);
  return evaluated.output;
}
function failureOutput(input, error) {
  const reason = `Workflow hook failed closed: ${String(error?.message ?? error).slice(0, 400)}`;
  if (input?.hook_event_name === "PreToolUse") return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason }
  };
  if (["UserPromptSubmit", "Stop"].includes(input?.hook_event_name)) return { decision: "block", reason };
  return { systemMessage: reason };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source) > MAX_INPUT_BYTES) throw new Error("Workflow hook input exceeds 1 MiB");
  }
  let input = {};
  let output;
  try {
    input = JSON.parse(source || "{}");
    output = runCodexHook(input);
  } catch (error) {
    output = failureOutput(input, error);
  }
  process.stdout.write(`${JSON.stringify(output)}
`);
}
export {
  runCodexHook
};
