import { inspectArtifactText } from "../../scripts/validate-artifact.source.mjs";
import {
  childAllowedByPolicy,
  resolveManualSubagentPolicy,
  selectCodexCandidate,
} from "./manual-subagent-policy.mjs";
import {
  evaluateDeliveryCompletion,
  expectedLineageFromArtifacts,
  formatPlanCloseoutAttestationFence,
  planCloseoutAttestationIssues,
  parseCloseoutInput,
  readCloseoutRecord,
  sha256RawUtf8,
} from "./manual-attestation.mjs";
import {
  captureRepositorySnapshot,
  deriveRepositoryDelta,
} from "./manual-repository-snapshot.mjs";
import {
  beginManualCheckReceipt,
  completeManualCheckReceipt,
  invalidateManualCheckReceipts,
  isReadOnlyShell,
} from "./manual-check-receipts.mjs";
import { performNativeCloseout } from "../controller/native-closeout.mjs";
import {
  extractRootPlanText,
  inspectPresentedRootPlan,
  parseRootPlanFields,
  readPreflightAttestation,
  rootContentHash,
} from "./root-plan-attestation.mjs";

export const CODEX_PLAN_MARKER = "[workflow-codex-plan-v1]";
export const CODEX_REVIEW_MARKER = "[workflow-codex-review-v1]";
export const CODEX_IMPLEMENTATION_MARKER = "[workflow-codex-implementation-v1]";
export const MODEL_INHERIT_MARKER = "[workflow-model-inherit-v1]";

const WORKFLOW_COMMAND = /(?:^|\s)\$(plan-work|correct-work|review-work|explain-work|close-work|learn-from-work|work-status|accept-work)(?=\s|$)/i;
const ROOT_ID = /\bwp-[A-Za-z0-9][A-Za-z0-9-]*\b/;
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

export { isReadOnlyShell };

function isWorkflowTool(name, suffix) {
  return String(name ?? "").toLowerCase().endsWith(suffix.toLowerCase());
}

function mutatingReviewTool(input) {
  const name = String(input.tool_name ?? "");
  // Match Cursor MUTATING_TOOL: Task/Agent can mutate the tree via children.
  if (/^(?:Task|Agent|spawn_agent)$/i.test(name)) return true;
  if (/^(?:apply_patch|ApplyPatch|Edit|Write|Delete|DeleteFile|StrReplace|EditNotebook)$/i.test(name)) return true;
  if (name === "Bash" || name === "Shell") return !isReadOnlyShell(input.tool_input?.command ?? input.tool_input?.cmd);
  if (isWorkflowTool(name, "workflow_artifact_record")) return false;
  if (isWorkflowTool(name, "workflow_closeout")) return false;
  if (isWorkflowTool(name, "workflow_plan_preflight")) return false;
  if (isWorkflowTool(name, "workflow_artifact_context")) return false;
  if (isWorkflowTool(name, "workflow_status")) return false;
  if (/^mcp__/i.test(name)) return !/(?:read|get|list|search|find|inspect|status|context|preflight)/i.test(name);
  return /(?:write|edit|delete|remove|create|update|publish|send|commit|push|merge|deploy)/i.test(name);
}

function clearCloseoutTurn(turn) {
  turn.closeout_recorded = false;
  turn.delivery_evidence_id = null;
  turn.delivery_evidence_artifact = null;
  turn.delivery_evidence_hash = null;
  turn.handoff_persisted = null;
  turn.delivery_evidence_root_plan_id = null;
  turn.delivery_evidence_subject_id = null;
  turn.delivery_evidence_source_review_id = null;
  turn.delivery_evidence_predecessor_evidence_id = null;
  turn.expected_lineage = null;
  turn.native_closeout = false;
  turn.native_closeout_error = null;
  turn.native_closeout_error_code = null;
}

function exactArtifactFromMessage(message, options = {}) {
  const source = String(message ?? "");
  const starts = [...source.matchAll(/^---\r?$/gm)].map((match) => match.index).filter(Number.isInteger);
  for (const start of starts) {
    const candidate = source.slice(start);
    const inspected = inspectArtifactText(candidate, options.pluginRoot);
    if (inspected.errors.length === 0 && inspected.artifact?.fields?.schema === 5) return candidate;
  }
  const inspected = inspectArtifactText(source, options.pluginRoot);
  return inspected.errors.length === 0 && inspected.artifact?.fields?.schema === 5 ? source : null;
}

function taskArtifactBucket(state, rootHash, rootPlanId) {
  state.task_artifacts_by_root ??= {};
  const existing = state.task_artifacts_by_root[rootHash];
  if (existing && existing.root_plan_id !== rootPlanId) {
    throw new Error(`task-local Root hash ${rootHash} is already bound to ${existing.root_plan_id}`);
  }
  return state.task_artifacts_by_root[rootHash] ??= { root_plan_id: rootPlanId, artifacts: [] };
}

function rememberTaskArtifact(state, text, options = {}, { rootHash = null } = {}) {
  const inspected = inspectArtifactText(text, options.pluginRoot);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || fields?.schema !== 5 || !["work-plan", "delivery-evidence", "work-review"].includes(fields?.artifact)) {
    throw new Error(`task-local artifact is invalid: ${(inspected.errors.length > 0 ? inspected.errors : ["not a transportable Schema-5 artifact"]).join("; ")}`);
  }
  const rootPlanId = fields.artifact === "work-plan" ? fields.id : fields.root_plan_id;
  const boundHash = fields.artifact === "work-plan" ? rootContentHash(text) : (rootHash ?? state.active_root_content_hash);
  if (!/^[a-f0-9]{64}$/.test(String(boundHash ?? ""))) throw new Error(`task-local artifact ${fields.id} has no exact Root-content binding`);
  if (state.active_root_plan_id && rootPlanId !== state.active_root_plan_id) {
    throw new Error(`task-local artifact ${fields.id} belongs to ${rootPlanId}, not active Root ${state.active_root_plan_id}`);
  }
  if (state.active_root_content_hash && boundHash !== state.active_root_content_hash) {
    throw new Error(`task-local artifact ${fields.id} has a conflicting exact Root-content hash`);
  }
  const bucket = taskArtifactBucket(state, boundHash, rootPlanId);
  const prior = bucket.artifacts.find((entry) => entry.label === fields.id);
  const textHash = sha256RawUtf8(text);
  if (prior && prior.text_hash !== textHash) {
    throw new Error(`task-local artifact ${fields.id} conflicts with different immutable bytes`);
  }
  if (!prior) {
    if (bucket.artifacts.length >= 32) throw new Error("task-local artifact chain exceeds 32 exact artifacts");
    const totalBytes = bucket.artifacts.reduce((sum, entry) => sum + Buffer.byteLength(entry.text), 0) + Buffer.byteLength(text);
    if (totalBytes > 1024 * 1024) throw new Error("task-local artifact chain exceeds 1 MiB");
    bucket.artifacts.push({ label: fields.id, text, text_hash: textHash, artifact_type: fields.artifact });
  }
  return { fields, root_content_hash: boundHash, text_hash: textHash };
}

function taskArtifactsForActiveRoot(state) {
  const bucket = state.task_artifacts_by_root?.[state.active_root_content_hash];
  return (bucket?.artifacts ?? []).map(({ label, text }) => ({ label, text }));
}

function captureToolTaskArtifacts(state, input, options = {}) {
  const entries = [];
  if (isWorkflowTool(input.tool_name, "workflow_artifact_record") || isWorkflowTool(input.tool_name, "workflow_closeout")) {
    entries.push(...(Array.isArray(input.tool_input?.artifacts) ? input.tool_input.artifacts : []));
    if (typeof input.tool_input?.root_plan === "string") entries.push({ text: input.tool_input.root_plan });
  }
  const structured = input.tool_response?.structuredContent;
  if (isWorkflowTool(input.tool_name, "workflow_artifact_context") && Array.isArray(structured?.artifacts)) {
    entries.push(...structured.artifacts.map((entry) => ({ ...entry, rootHash: structured.root_content_hash })));
  }
  if (isWorkflowTool(input.tool_name, "workflow_closeout") && typeof structured?.artifact === "string") {
    entries.push({ text: structured.artifact, rootHash: structured.root_content_hash });
  }
  for (const entry of entries) {
    if (typeof entry?.text === "string" && entry.text.trim()) {
      rememberTaskArtifact(state, entry.text, options, { rootHash: entry.rootHash ?? null });
    }
  }
}

function nativeCloseoutErrorCode(error) {
  const message = String(error?.message ?? error);
  if (/different immutable bytes|conflicting text|immutable handoff Root|Root-content hash|Root mismatch/i.test(message)) return "artifact-text-conflict";
  if (/missing exact Source Review/i.test(message)) return "missing-source-review";
  if (/predecessor Evidence/i.test(message)) return "missing-predecessor-evidence";
  if (/outside Root authority|protected by the Root|requires separate human approval|path escapes|resolves outside/i.test(message)) return "authority-violation";
  if (/stale or competing|lineage|correction/i.test(message)) return "evidence-lineage-conflict";
  if (/repository baseline|repository delta|repository snapshot|repository root changed|HEAD changed/i.test(message)) return "repository-observation-conflict";
  if (/attestation|closeout-input|phase must/i.test(message)) return "invalid-closeout-input";
  return "native-closeout-failed";
}

function toolSucceeded(response) {
  const source = JSON.stringify(response ?? {});
  return !/"isError"\s*:\s*true|"error"\s*:/i.test(source);
}

function structuredResponse(response) {
  if (!response || typeof response !== "object") return null;
  if (response.structuredContent && typeof response.structuredContent === "object") return response.structuredContent;
  for (const entry of response.content ?? []) {
    if (entry?.structuredContent && typeof entry.structuredContent === "object") return entry.structuredContent;
    if (typeof entry?.text === "string") {
      try {
        const parsed = JSON.parse(entry.text);
        if (parsed?.structuredContent && typeof parsed.structuredContent === "object") return parsed.structuredContent;
        if (parsed && typeof parsed === "object") return parsed;
      } catch { /* keep scanning */ }
    }
  }
  return response;
}

function bindActiveRootFromContext(turn, state, input, options = {}) {
  if (!isWorkflowTool(input.tool_name, "workflow_artifact_context") || !toolSucceeded(input.tool_response)) return;
  const structured = structuredResponse(input.tool_response);
  const expectedId = input.tool_input?.root_plan_id ?? turn.root_plan_id ?? null;
  const candidates = [
    input.tool_input?.root_plan,
    ...(structured?.artifacts ?? []).map((entry) => entry?.text),
  ].filter((value) => typeof value === "string" && value.trim());
  const valid = candidates.flatMap((text) => {
    const inspected = inspectArtifactText(text, options.pluginRoot);
    const fields = inspected.artifact?.fields;
    return inspected.errors.length === 0
      && fields?.artifact === "work-plan"
      && fields.schema === 5
      && (!expectedId || fields.id === expectedId)
      ? [{ text, fields }]
      : [];
  });
  const byHash = new Map(valid.map((entry) => [rootContentHash(entry.text), entry]));
  if (byHash.size !== 1) return;
  const [contentHash, root] = [...byHash.entries()][0];
  turn.root_plan_id = root.fields.id;
  state.active_root_plan_id = root.fields.id;
  state.active_root_content_hash = contentHash;
  state.active_root_plan_text = root.text;
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

function workspaceRootForInput(input, options = {}) {
  return options.workspaceRoot ?? input.cwd ?? process.cwd();
}

function captureTurnBaseline(turn, input, options = {}) {
  if (turn.repository_baseline || turn.repository_baseline_error) return;
  try {
    const capture = options.captureRepositorySnapshot ?? captureRepositorySnapshot;
    turn.repository_baseline = capture(workspaceRootForInput(input, options));
    turn.repository_baseline_error = null;
  } catch (error) {
    turn.repository_baseline_error = String(error?.message ?? error);
  }
}

function captureTurnCheckCandidate(turn, state, input, options = {}) {
  const rootPlanText = state.active_root_plan_text;
  if (!["implementation", "correction", "review"].includes(turn.phase) || typeof rootPlanText !== "string") return;
  try {
    turn.pending_check_receipt = beginManualCheckReceipt({
      rootPlanText,
      pluginRoot: options.pluginRoot,
      workspaceRoot: workspaceRootForInput(input, options),
      toolName: input.tool_name,
      toolInput: input.tool_input,
      captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
      now: options.now,
    });
    turn.check_receipt_status = turn.pending_check_receipt ? "pending" : null;
  } catch (error) {
    turn.pending_check_receipt = null;
    turn.check_receipt_status = "unavailable";
    turn.check_receipt_error = String(error?.message ?? error);
  }
}

function completeTurnCheckCandidate(turn, state, input, options = {}) {
  if (!turn.pending_check_receipt || typeof state.active_root_plan_text !== "string") return null;
  try {
    const completed = completeManualCheckReceipt({
      candidate: turn.pending_check_receipt,
      rootPlanText: state.active_root_plan_text,
      workspaceRoot: workspaceRootForInput(input, options),
      toolResponse: input.tool_response,
      captureSnapshot: options.captureRepositorySnapshot ?? captureRepositorySnapshot,
      now: options.now,
      options: options.receiptOptions ?? {},
    });
    turn.pending_check_receipt = null;
    turn.check_receipt_status = completed.status;
    turn.check_receipt_hash = completed.receipt_hash ?? null;
    turn.check_receipt_error = null;
    return completed;
  } catch (error) {
    turn.pending_check_receipt = null;
    turn.check_receipt_status = "unavailable";
    turn.check_receipt_error = String(error?.message ?? error);
    return null;
  }
}

function invalidateTurnCheckReceipts(state, input, options = {}) {
  if (typeof state.active_root_plan_text !== "string") return;
  invalidateManualCheckReceipts({
    rootPlanText: state.active_root_plan_text,
    workspaceRoot: workspaceRootForInput(input, options),
    options: options.receiptOptions ?? {},
  });
}

function applyNativeCloseoutToTurn(turn, closeout, rootPlanId) {
  turn.closeout_recorded = true;
  turn.native_closeout = true;
  turn.native_closeout_error = null;
  turn.delivery_evidence_id = closeout.fields.id;
  turn.delivery_evidence_artifact = closeout.artifact;
  turn.delivery_evidence_hash = closeout.artifact_hash;
  turn.handoff_persisted = closeout.handoff_persisted;
  turn.delivery_evidence_root_plan_id = closeout.fields.root_plan_id;
  turn.delivery_evidence_subject_id = closeout.fields.subject_id;
  turn.delivery_evidence_source_review_id = closeout.fields.source_review_id ?? null;
  turn.delivery_evidence_predecessor_evidence_id = closeout.fields.predecessor_evidence_id ?? null;
  turn.root_plan_id = rootPlanId;
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
      preflight_attempted: false,
      preflight_passed: false,
      preflight_fingerprint: null,
      preflight_root_id: null,
      root_recorded: false,
      closeout_recorded: false,
      delivery_evidence_id: null,
      delivery_evidence_artifact: null,
      delivery_evidence_hash: null,
      handoff_persisted: null,
      delivery_evidence_root_plan_id: null,
      delivery_evidence_subject_id: null,
      delivery_evidence_source_review_id: null,
      delivery_evidence_predecessor_evidence_id: null,
      expected_lineage: null,
      repository_baseline: null,
      repository_baseline_error: null,
      pending_check_receipt: null,
      check_receipt_status: null,
      check_receipt_hash: null,
      check_receipt_error: null,
      native_closeout: false,
      native_closeout_error: null,
      native_closeout_error_code: null,
      task_artifact_error: null,
      review_recovery_count: 0,
      pending_agents: [],
      invalid_agents: {},
      routing: {
        mode: policy.mode,
        unavailable: [],
        selected: null,
        reasoning_effort_attested: false,
      },
    };
    const selectedRootId = String(input.prompt ?? "").match(ROOT_ID)?.[0] ?? null;
    if (selectedRootId && phase !== "planning") turn.root_plan_id = selectedRootId;
    const embeddedRoot = phase !== "planning" ? extractRootPlanText(input.prompt) : null;
    if (embeddedRoot) {
      const inspected = inspectArtifactText(embeddedRoot, options.pluginRoot);
      if (inspected.errors.length === 0 && inspected.artifact?.fields?.artifact === "work-plan") {
        turn.root_plan_id = inspected.artifact.fields.id;
        state.active_root_plan_id = inspected.artifact.fields.id;
        state.active_root_content_hash = rootContentHash(embeddedRoot);
        state.active_root_plan_text = embeddedRoot;
      }
    }
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
    if (["implementation", "correction"].includes(turn.phase) && mutatingReviewTool(input)) {
      captureTurnBaseline(turn, input, options);
    }
    captureTurnCheckCandidate(turn, state, input, options);
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
    const completedReceipt = completeTurnCheckCandidate(turn, state, input, options);
    bindActiveRootFromContext(turn, state, input, options);
    if (agentToolName(input.tool_name) && !toolSucceeded(input.tool_response) && modelUnavailable(input.tool_response)) {
      const failedModel = requestedModel(input.tool_input) ?? routing.selected?.model_id;
      if (failedModel && !routing.unavailable.includes(failedModel)) routing.unavailable.push(failedModel);
    }
    if (
      turn.closeout_recorded
      && ["implementation", "correction"].includes(turn.phase)
      && mutatingReviewTool(input)
      && !isWorkflowTool(input.tool_name, "workflow_closeout")
    ) {
      clearCloseoutTurn(turn);
    }
    if (
      ["implementation", "correction"].includes(turn.phase)
      && mutatingReviewTool(input)
      && !isWorkflowTool(input.tool_name, "workflow_closeout")
      && !["recorded", "failed", "missing-result"].includes(completedReceipt?.status)
    ) {
      try { invalidateTurnCheckReceipts(state, input, options); } catch { /* closeout will not find eligible proof */ }
    }
    if (isWorkflowTool(input.tool_name, "workflow_plan_preflight")) {
      turn.preflight_attempted = true;
      turn.preflight_passed = false;
      turn.preflight_fingerprint = null;
      const rootText = typeof input.tool_input?.root_plan === "string" ? input.tool_input.root_plan : null;
      const parsed = rootText ? parseRootPlanFields(rootText) : { ok: false, fingerprint: null, content_hash: null, fields: null };
      const attestation = toolSucceeded(input.tool_response)
        ? readPreflightAttestation(input.tool_response)
        : { feasible: false, blockers: ["preflight-tool-error"], root_plan_id: null };
      if (parsed.ok && attestation.feasible) {
        const responseId = attestation.root_plan_id;
        if (!responseId || responseId === parsed.fields.id) {
          turn.preflight_passed = true;
          turn.preflight_fingerprint = parsed.fingerprint;
          turn.preflight_root_id = parsed.fields.id;
          turn.root_plan_id = parsed.fields.id;
          state.active_root_plan_id = parsed.fields.id;
          // Closeout authority is raw UTF-8 Root bytes, never the semantic fingerprint.
          state.active_root_content_hash = parsed.content_hash ?? rootContentHash(rootText);
        }
      } else if (parsed.ok) {
        turn.preflight_root_id = parsed.fields.id;
        turn.root_plan_id = parsed.fields.id;
      } else {
        turn.root_plan_id = idsFrom(input.tool_input?.root_plan, ROOT_ID)[0] ?? turn.root_plan_id ?? null;
      }
    }
    if (!turn.task_artifact_error) {
      try {
        captureToolTaskArtifacts(state, input, options);
      } catch (error) {
        turn.task_artifact_error = String(error?.message ?? error);
      }
    }
    if (toolSucceeded(input.tool_response)) {
      if (isWorkflowTool(input.tool_name, "workflow_artifact_record")) {
        const rootIds = idsFrom(input.tool_input?.artifacts, ROOT_ID);
        if (rootIds.length > 0) {
          turn.root_recorded = true;
          turn.root_plan_id = turn.root_plan_id ?? rootIds[0];
          state.active_root_plan_id = turn.root_plan_id;
        }
      }
      if (isWorkflowTool(input.tool_name, "workflow_closeout")) {
        const closeoutRootPlanId = typeof input.tool_input?.root_plan_id === "string"
          ? input.tool_input.root_plan_id
          : (idsFrom(input.tool_input?.root_plan, ROOT_ID)[0] ?? null);
        // Never self-authorize from the closeout request; require independently captured active Root bytes.
        const activeRootPlanId = state.active_root_plan_id ?? turn.root_plan_id ?? null;
        const activeRootContentHash = typeof state.active_root_content_hash === "string"
          ? state.active_root_content_hash
          : null;
        if (!activeRootPlanId || !activeRootContentHash || !/^[a-f0-9]{64}$/.test(activeRootContentHash)) {
          clearCloseoutTurn(turn);
          return { output: {}, state };
        }
        const expectedLineage = expectedLineageFromArtifacts(
          input.tool_input?.artifacts,
          closeoutRootPlanId ?? activeRootPlanId,
          { inspectArtifactText, pluginRoot: options.pluginRoot },
        );
        const recorded = readCloseoutRecord(input.tool_response, {
          ...options,
          inspectArtifactText,
          activeRootPlanId,
          activeRootContentHash,
          closeoutRootPlanId,
          expectedLineage,
        });
        if (recorded.ok) {
          turn.closeout_recorded = true;
          turn.delivery_evidence_id = recorded.record.id;
          turn.delivery_evidence_artifact = recorded.record.artifact;
          turn.delivery_evidence_hash = recorded.record.hash;
          turn.handoff_persisted = recorded.record.handoff_persisted;
          turn.delivery_evidence_root_plan_id = recorded.record.root_plan_id;
          turn.delivery_evidence_subject_id = recorded.record.subject_id;
          turn.delivery_evidence_source_review_id = recorded.record.source_review_id;
          turn.delivery_evidence_predecessor_evidence_id = recorded.record.predecessor_evidence_id;
          turn.delivery_evidence_root_content_hash = recorded.record.root_content_hash;
          turn.expected_lineage = expectedLineage;
          turn.root_plan_id = turn.root_plan_id ?? recorded.record.root_plan_id;
          try { rememberTaskArtifact(state, recorded.record.artifact, options, { rootHash: recorded.record.root_content_hash }); }
          catch (error) { turn.task_artifact_error = String(error?.message ?? error); }
        } else {
          clearCloseoutTurn(turn);
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
      if (!hasNativePlan) {
        return {
          output: {
            decision: "block",
            reason: "Finish $plan-work: return one <proposed_plan> containing the exact Schema-5 Root and its wp-* ID. Handoff record is best-effort transport only.",
          },
          state,
        };
      }

      const presentedText = extractRootPlanText(message);
      if (!presentedText) {
        return {
          output: {
            decision: "block",
            reason: "Finish $plan-work: <proposed_plan> must contain the exact Schema-5 Root text, not only a wp-* ID. Prior workflow_plan_preflight success does not authorize an ID-only presentation.",
          },
          state,
        };
      }

      const presented = inspectPresentedRootPlan(presentedText, {
        pluginRoot: options.pluginRoot,
        preflightRootPlan: options.preflightRootPlan,
      });
      if (!presented.ok) {
        const detail = presented.blockers
          .slice(0, 4)
          .map((issue) => String(issue?.message ?? issue).replace(/\s+/g, " ").slice(0, 200))
          .filter(Boolean)
          .join("; ");
        return {
          output: {
            decision: "block",
            reason: `Finish $plan-work: <proposed_plan> must contain one Schema-5 Root that passes the same native semantic validation Cursor CreatePlan embeds${detail ? `: ${detail}` : "."}`,
          },
          state,
        };
      }

      if (turn.preflight_passed) {
        const idMatch = !turn.preflight_root_id || turn.preflight_root_id === presented.fields.id;
        const fingerprintMatch = !turn.preflight_fingerprint || turn.preflight_fingerprint === presented.fingerprint;
        if (!idMatch || !fingerprintMatch) {
          return {
            output: {
              decision: "block",
              reason: "Finish $plan-work: the presented Root must exactly match the Root attested by workflow_plan_preflight.",
            },
            state,
          };
        }
      }
      turn.local_preflight_passed = true;
      turn.local_preflight_fingerprint = presented.fingerprint;

      const proposedInterior = message.match(/<proposed_plan>([\s\S]*?)<\/proposed_plan>/i)?.[1] ?? "";
      const retentionIssues = planCloseoutAttestationIssues(proposedInterior, {
        role: "final implementation step",
        requireFinalStepSection: true,
      });
      if (retentionIssues.length > 0) {
        return {
          output: {
            decision: "block",
            reason: `Finish $plan-work: <proposed_plan> must include an explicit ## Final implementation step with one typed plan-closeout attestation:\n${formatPlanCloseoutAttestationFence()}`,
          },
          state,
        };
      }

      turn.root_plan_id = presented.fields.id;
      state.active_root_plan_id = presented.fields.id;
      // Closeout authority is raw UTF-8 Root bytes, never the semantic fingerprint.
      state.active_root_content_hash = presented.content_hash ?? rootContentHash(presentedText);
      state.active_root_plan_text = presentedText;
      rememberTaskArtifact(state, presentedText, options);
    }
    if (["implementation", "correction", "review"].includes(turn.phase)) {
      if (turn.task_artifact_error) {
        return {
          output: {
            decision: "block",
            reason: `Workflow task-local artifact capture failed closed: ${turn.task_artifact_error}. Preserve the exact Root/chain bytes and resolve the conflict before closeout.`,
          },
          state,
        };
      }
      const native = parseCloseoutInput(message);
      if (native.ok) {
        if (turn.phase === "review" && turn.review_recovery_count >= 1) {
          return {
            output: {
              decision: "block",
              reason: "Workflow review recovery is bounded to one native continuation. Use the exact hydrated chain or report the remaining Evidence uncertainty without another recovery attempt.",
            },
            state,
          };
        }
        try {
          const rootPlanText = state.active_root_plan_text;
          const activeRootPlanId = state.active_root_plan_id ?? turn.root_plan_id ?? null;
          if (typeof rootPlanText !== "string" || !rootPlanText.trim() || !activeRootPlanId) {
            throw new Error("independently captured exact Root text is unavailable");
          }
          if (native.report.root_plan_id !== activeRootPlanId) {
            throw new Error(`active Root ${activeRootPlanId} does not match ${native.report.root_plan_id}`);
          }
          const expectedPhase = turn.phase === "review" ? "review-recovery" : turn.phase;
          if (native.report.phase !== expectedPhase) {
            throw new Error(`closeout-input phase must be ${expectedPhase}`);
          }
          const capture = options.captureRepositorySnapshot ?? captureRepositorySnapshot;
          const current = capture(workspaceRootForInput(input, options));
          const derive = options.deriveRepositoryDelta ?? deriveRepositoryDelta;
          const repositoryDelta = derive(turn.phase === "review" ? null : turn.repository_baseline, current);
          const closeout = (options.performNativeCloseout ?? performNativeCloseout)({
            attestation: native.report,
            expectedPhase,
            rootPlanText,
            artifacts: [...taskArtifactsForActiveRoot(state), ...(options.artifacts ?? [])],
            repositoryDelta,
            pluginRoot: options.pluginRoot,
            handoffOptions: options.handoffOptions ?? {},
            receiptOptions: options.receiptOptions ?? {},
          });
          applyNativeCloseoutToTurn(turn, closeout, activeRootPlanId);
          rememberTaskArtifact(state, closeout.artifact, options, { rootHash: state.active_root_content_hash });
          if (turn.phase === "review") {
            turn.review_recovery_count += 1;
            return {
              output: {
                decision: "block",
                reason: `Workflow recovered exact Evidence ${closeout.fields.id}. Continue this same read-only review once with the hydrated chain; preserve its ${closeout.fields.status} status and ${closeout.fields.overall_grade} grade.`,
              },
              state,
            };
          }
        } catch (error) {
          turn.native_closeout_error = String(error?.message ?? error);
          turn.native_closeout_error_code = nativeCloseoutErrorCode(error);
          const errorCode = turn.native_closeout_error_code;
          clearCloseoutTurn(turn);
          turn.native_closeout_error = String(error?.message ?? error);
          turn.native_closeout_error_code = errorCode;
          return {
            output: {
              decision: "block",
              reason: `Workflow native closeout failed closed [${turn.native_closeout_error_code}]: ${turn.native_closeout_error}. Correct the exact Root/chain or typed observations; do not claim delivery success.`,
            },
            state,
          };
        }
      } else if (/\bkind\s*:\s*closeout-input\b|\bcloseout-input\b/i.test(message)) {
        turn.native_closeout_error = native.issues.join("; ");
        return {
          output: {
            decision: "block",
            reason: `Workflow native closeout attestation is invalid: ${turn.native_closeout_error}`,
          },
          state,
        };
      }
    }
    if (turn.phase === "review") {
      const exactReview = exactArtifactFromMessage(message, options);
      if (exactReview) {
        try {
          const captured = rememberTaskArtifact(state, exactReview, options);
          if (captured.fields.artifact !== "work-review") throw new Error(`review response produced ${captured.fields.artifact}, not work-review`);
        } catch (error) {
          turn.task_artifact_error = String(error?.message ?? error);
          return {
            output: {
              decision: "block",
              reason: `Workflow exact review capture failed closed: ${turn.task_artifact_error}. Keep the authoritative review bytes in this task and resolve any immutable ID conflict before correction.`,
            },
            state,
          };
        }
      }
    }
    if (["implementation", "correction"].includes(turn.phase)) {
      const completion = turn.native_closeout
        ? { ok: true }
        : evaluateDeliveryCompletion(message, {
        closeout_recorded: turn.closeout_recorded,
        delivery_evidence_id: turn.delivery_evidence_id,
        delivery_evidence_artifact: turn.delivery_evidence_artifact,
        handoff_persisted: turn.handoff_persisted,
        active_root_plan_id: state.active_root_plan_id ?? turn.root_plan_id ?? null,
        delivery_evidence_root_plan_id: turn.delivery_evidence_root_plan_id,
        });
      if (!completion.ok) {
        return {
          output: {
            decision: "block",
            reason: "Finish Manual Workflow with one typed closeout-input for native lifecycle closeout, or use optional workflow_closeout and then report its exact delivery-report (attach the exact artifact only when handoff_persisted is false).",
          },
          state,
        };
      }
    }
    if (Object.keys(turn.invalid_agents ?? {}).length > 0) {
      return { output: { decision: "block", reason: "Discard the unattested subagent result and complete the Workflow step without using it as evidence." }, state };
    }
    state.turn = null;
    return { output: {}, state };
  }

  return { output: {}, state };
}
