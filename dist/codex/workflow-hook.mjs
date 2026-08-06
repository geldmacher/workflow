#!/usr/bin/env node
#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);

// src/hosts/codex/workflow-hook.mjs
import { createHash, randomUUID } from "node:crypto";
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, renameSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname, join as join2, resolve as resolve2 } from "node:path";

// hooks/manual-subagent-policy.mjs
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
var MANUAL_SUBAGENT_POLICY_SCHEMA = 1;
var MANUAL_SUBAGENT_MODES = Object.freeze(["parent-only", "parent-or-approved"]);
var MANUAL_SUBAGENT_HOSTS = Object.freeze(["cursor", "codex"]);
var MANUAL_SUBAGENT_PRESETS = Object.freeze({
  "cursor-composer-grok-v1": Object.freeze({
    host: "cursor",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "composer-2.5-fast" }),
      Object.freeze({ model_id: "cursor-grok-4.5-high-fast" })
    ])
  }),
  "codex-efficient-gpt-v1": Object.freeze({
    host: "codex",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "gpt-5.6-luna-max", reasoning_effort: "low" }),
      Object.freeze({ model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" })
    ])
  })
});
var objectLike = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
var cleanId = (value) => typeof value === "string" && value.trim() !== "" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 256) : null;
function sharedWorkflowHome(options = {}) {
  return resolve(options.homeRoot ?? process.env.GELDMACHER_WORKFLOW_HOME ?? join(homedir(), ".geldmacher", "workflow"));
}
function defaultHostPreferencesPath(options = {}) {
  return options.preferencesPath ?? process.env.GELDMACHER_WORKFLOW_PREFERENCES ?? join(sharedWorkflowHome(options), "preferences.yaml");
}
function scalar(token) {
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null" || token === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  if (token.startsWith('"') && token.endsWith('"') || token.startsWith("'") && token.endsWith("'")) {
    return token.slice(1, -1);
  }
  return token;
}
function parsePreferenceYaml(source) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(source).split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;
    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error("array item without array parent");
      const item = line.slice(2).trim();
      const colon2 = item.indexOf(":");
      if (colon2 >= 0) {
        const key2 = item.slice(0, colon2).trim();
        const rest2 = item.slice(colon2 + 1).trim();
        const object = {};
        if (rest2) object[key2] = scalar(rest2);
        parent.push(object);
        stack.push({ indent, value: object });
      } else {
        parent.push(scalar(item));
      }
      continue;
    }
    if (!objectLike(parent) || Array.isArray(parent)) throw new Error("mapping entry without object parent");
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`invalid mapping line: ${line}`);
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (rest === "[]") {
      parent[key] = [];
      continue;
    }
    if (rest) {
      parent[key] = scalar(rest);
      continue;
    }
    let nextIndex = lineIndex + 1;
    while (nextIndex < lines.length && (!lines[nextIndex].trim() || lines[nextIndex].trim().startsWith("#"))) nextIndex += 1;
    const next = nextIndex < lines.length ? lines[nextIndex] : "";
    const nextIndent = next.match(/^ */)?.[0].length ?? 0;
    const nextTrimmed = next.trim();
    if (next && nextIndent > indent && nextTrimmed.startsWith("- ")) {
      const child = [];
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      const child = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    }
  }
  return root;
}
function parentOnlyResolution(source, path, issues = []) {
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-only",
    source,
    path,
    authoritative: false,
    hosts: Object.freeze({
      cursor: Object.freeze({ host: "cursor", parent_fallback: true, candidates: Object.freeze([]), preset: null }),
      codex: Object.freeze({ host: "codex", parent_fallback: true, candidates: Object.freeze([]), preset: null })
    }),
    ...issues.length > 0 ? { issues: Object.freeze([...issues]) } : {}
  });
}
function validateCandidate(candidate, label, errors) {
  if (!objectLike(candidate)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  for (const key of Object.keys(candidate)) {
    if (!["model_id", "reasoning_effort"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  const modelId = cleanId(candidate.model_id);
  if (!modelId) errors.push(`${label}.model_id is required`);
  let reasoning = null;
  if (candidate.reasoning_effort !== void 0) {
    reasoning = cleanId(candidate.reasoning_effort);
    if (!reasoning) errors.push(`${label}.reasoning_effort must be a non-empty string when set`);
  }
  return modelId ? Object.freeze({ model_id: modelId, ...reasoning ? { reasoning_effort: reasoning } : {} }) : null;
}
function resolveHostPolicy(raw, host, label, errors) {
  if (raw === void 0) {
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  if (!objectLike(raw)) {
    errors.push(`${label} must be an object`);
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  for (const key of Object.keys(raw)) {
    if (!["preset", "candidates", "parent_fallback"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (raw.preset !== void 0 && raw.candidates !== void 0) {
    errors.push(`${label} may set preset or candidates, not both`);
  }
  let preset = null;
  let candidates = [];
  if (raw.preset !== void 0) {
    preset = cleanId(raw.preset);
    if (!preset) errors.push(`${label}.preset must be a non-empty string`);
    else {
      const definition = MANUAL_SUBAGENT_PRESETS[preset];
      if (!definition) errors.push(`${label}.preset is unknown: ${preset}`);
      else if (definition.host !== host) errors.push(`${label}.preset ${preset} is not valid for ${host}`);
      else candidates = definition.candidates.map((entry) => Object.freeze({ ...entry }));
    }
  }
  if (Array.isArray(raw.candidates)) {
    if (raw.candidates.length === 0) errors.push(`${label}.candidates must not be empty`);
    candidates = raw.candidates.map((entry, index) => validateCandidate(entry, `${label}.candidates[${index}]`, errors)).filter(Boolean);
  } else if (raw.candidates !== void 0) {
    errors.push(`${label}.candidates must be an array`);
  }
  const parentFallback = raw.parent_fallback === void 0 ? true : raw.parent_fallback === true ? true : raw.parent_fallback === false ? false : (errors.push(`${label}.parent_fallback must be a boolean`), true);
  if (host === "cursor") {
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.reasoning_effort) errors.push(`${label}.candidates[${index}] must not set reasoning_effort on Cursor`);
    }
  }
  return Object.freeze({
    host,
    parent_fallback: parentFallback,
    candidates: Object.freeze(candidates),
    preset
  });
}
function validateManualSubagentPolicy(value, label = "manual_subagent_policy") {
  const errors = [];
  if (!objectLike(value)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  for (const key of Object.keys(value)) {
    if (!["schema", "mode", "hosts"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (value.schema !== MANUAL_SUBAGENT_POLICY_SCHEMA) errors.push(`${label}.schema must be ${MANUAL_SUBAGENT_POLICY_SCHEMA}`);
  if (!MANUAL_SUBAGENT_MODES.includes(value.mode)) errors.push(`${label}.mode must be parent-only or parent-or-approved`);
  if (value.hosts !== void 0) {
    if (!objectLike(value.hosts)) errors.push(`${label}.hosts must be an object`);
    else {
      for (const key of Object.keys(value.hosts)) {
        if (!MANUAL_SUBAGENT_HOSTS.includes(key)) errors.push(`${label}.hosts has unknown host ${key}`);
      }
      for (const host of MANUAL_SUBAGENT_HOSTS) {
        resolveHostPolicy(value.hosts[host], host, `${label}.hosts.${host}`, errors);
      }
    }
  }
  return errors;
}
function resolveManualSubagentPolicy(options = {}) {
  const path = options.preferencesPath ?? defaultHostPreferencesPath(options);
  if (!existsSync(path)) return parentOnlyResolution("default", path);
  let parsed;
  try {
    parsed = parsePreferenceYaml(readFileSync(path, "utf8"));
  } catch (error) {
    return parentOnlyResolution("invalid-fallback", path, [`preferences file is unreadable: ${error.message}`]);
  }
  if (!objectLike(parsed)) return parentOnlyResolution("invalid-fallback", path, ["preferences must be an object"]);
  if (parsed.manual_subagent_policy === void 0) return parentOnlyResolution("default", path);
  const errors = validateManualSubagentPolicy(parsed.manual_subagent_policy);
  if (errors.length > 0) return parentOnlyResolution("invalid-fallback", path, errors);
  const policy = parsed.manual_subagent_policy;
  if (policy.mode === "parent-only") {
    return Object.freeze({
      ...parentOnlyResolution("file", path),
      mode: "parent-only"
    });
  }
  const hostErrors = [];
  const hosts = Object.freeze({
    cursor: resolveHostPolicy(policy.hosts?.cursor, "cursor", "manual_subagent_policy.hosts.cursor", hostErrors),
    codex: resolveHostPolicy(policy.hosts?.codex, "codex", "manual_subagent_policy.hosts.codex", hostErrors)
  });
  if (hostErrors.length > 0) return parentOnlyResolution("invalid-fallback", path, hostErrors);
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-or-approved",
    source: "file",
    path,
    authoritative: false,
    hosts
  });
}
function approvedModelIds(hostPolicy) {
  return new Set((hostPolicy?.candidates ?? []).map((entry) => entry.model_id));
}
function childAllowedByPolicy({ parentModel, observedChild, hostPolicy, mode }) {
  const parent = cleanId(parentModel);
  const child = cleanId(observedChild);
  if (!parent || !child) return { allowed: false, match_mode: null };
  if (child === parent) return { allowed: true, match_mode: "exact-parent" };
  if (mode !== "parent-or-approved") return { allowed: false, match_mode: null };
  if (approvedModelIds(hostPolicy).has(child)) return { allowed: true, match_mode: "approved-candidate" };
  return { allowed: false, match_mode: null };
}
function selectCodexCandidate({ hostPolicy, mode, unavailable = [], parentModel = null }) {
  if (mode !== "parent-or-approved") {
    return Object.freeze({ kind: "parent", model_id: cleanId(parentModel), reasoning_effort: null, index: -1 });
  }
  const blocked = new Set((unavailable ?? []).map(cleanId).filter(Boolean));
  const candidates = hostPolicy?.candidates ?? [];
  for (const [index, candidate] of candidates.entries()) {
    if (blocked.has(candidate.model_id)) continue;
    return Object.freeze({
      kind: "candidate",
      model_id: candidate.model_id,
      reasoning_effort: candidate.reasoning_effort ?? null,
      index
    });
  }
  if (hostPolicy?.parent_fallback !== false) {
    return Object.freeze({ kind: "parent", model_id: cleanId(parentModel), reasoning_effort: null, index: -1 });
  }
  return null;
}

// src/core/codex-hook-policy.mjs
var CODEX_PLAN_MARKER = "[workflow-codex-plan-v1]";
var CODEX_REVIEW_MARKER = "[workflow-codex-review-v1]";
var CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v1]";
var MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";
var WORKFLOW_COMMAND = /(?:^|\s)\$(plan-work|correct-work|review-work|explain-work|close-work|learn-from-work|work-status|accept-work)(?=\s|$)/i;
var ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;
var EVIDENCE_ID = /\bde-[A-Za-z0-9][A-Za-z0-9-]*\b/;
var UNAVAILABLE_MODEL = /(?:unknown|unavailable|not\s+found|unsupported).{0,80}model|model.{0,80}(?:unknown|unavailable|not\s+found|unsupported)/i;
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
function agentToolName(name) {
  return /^(?:Agent|spawn_agent)$/i.test(String(name ?? ""));
}
function requestedModel(toolInput) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) return null;
  for (const key of ["model", "model_id"]) {
    if (Object.prototype.hasOwnProperty.call(toolInput, key) && toolInput[key] !== void 0 && toolInput[key] !== null && toolInput[key] !== "") {
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
      reasoning_effort_attested: false
    };
  }
  return turn.routing;
}
function buildAgentInput(toolInput, selected) {
  const next = { ...toolInput && typeof toolInput === "object" && !Array.isArray(toolInput) ? toolInput : {} };
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
function evaluateCodexHook(input, priorState = {}, options = {}) {
  const state = structuredClone(priorState ?? {});
  const event = input.hook_event_name;
  const policy = options.manualSubagentPolicy ?? resolveManualSubagentPolicy(options);
  if (event === "SessionStart") {
    state.parent_model = input.model ?? null;
    state.manual_subagent_policy = {
      mode: policy.mode,
      source: policy.source,
      codex_candidates: (policy.hosts?.codex?.candidates ?? []).map((entry) => entry.model_id)
    };
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
      invalid_agents: {},
      routing: {
        mode: policy.mode,
        unavailable: [],
        selected: null,
        reasoning_effort_attested: false
      }
    };
    state.turn = turn2;
    if (phase === "planning" && input.permission_mode !== "plan") {
      return { output: { decision: "block", reason: "$plan-work requires Codex Plan mode." }, state };
    }
    const marker = phase === "planning" ? CODEX_PLAN_MARKER : phase === "review" ? CODEX_REVIEW_MARKER : ["implementation", "correction"].includes(phase) ? CODEX_IMPLEMENTATION_MARKER : "[workflow-codex-manual-v1]";
    const routingNote = routingEnabled(policy) ? "Codex may use the configured ordered Manual subagent candidates with parent fallback." : "Preserve human authorization and do not request a concrete subagent model outside parent inheritance.";
    return {
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `${marker} ${MODEL_INHERIT_MARKER} Workflow is Manual on Codex. ${routingNote}`
        }
      },
      state
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
          selected_model: turn.parent_model ?? state.parent_model ?? null
        });
        return { output: {}, state };
      }
      const selected = selectCodexCandidate({
        hostPolicy: policy.hosts.codex,
        mode: policy.mode,
        unavailable: routing.unavailable,
        parentModel: turn.parent_model ?? state.parent_model
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
        selected_reasoning_effort: selected.reasoning_effort
      });
      return {
        output: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput
          }
        },
        state
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
      mode: policy.mode
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
        reasoning_effort_attested: false
      };
      return {
        output: {
          systemMessage: `Workflow model attestation failed for ${agentId}: expected ${expected ?? "<unavailable>"}, observed ${observed ?? "<unavailable>"}. The result cannot be evidence.`,
          hookSpecificOutput: {
            hookEventName: "SubagentStart",
            additionalContext: "Stop without using tools. Your model did not match the Workflow Manual subagent policy, so your result is invalid evidence."
          }
        },
        state
      };
    }
    routing.last_attested = {
      observed,
      match_mode: selectedMatch ? pending?.selected_kind === "parent" ? "exact-parent" : "selected-candidate" : allowance.match_mode,
      reasoning_effort_attested: false
    };
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
  const base = resolve2(root ?? process.env.PLUGIN_DATA ?? join2(homedir2(), ".codex", "geldmacher-workflow"));
  const repository = digest(resolve2(input.cwd ?? process.cwd())).slice(0, 20);
  const session = digest(input.session_id ?? "missing-session").slice(0, 32);
  return join2(base, "hooks", repository, "sessions", `${session}.json`);
}
function readState(path) {
  if (!existsSync2(path)) return {};
  const value = JSON.parse(readFileSync2(path, "utf8"));
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
  const evaluated = evaluateCodexHook(input, readState(path), options);
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
if (process.argv[1] && resolve2(process.argv[1]) === resolve2(new URL(import.meta.url).pathname)) {
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
