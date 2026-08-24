import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText,
  manualReviewShellDecision,
  preflightRootPlan,
} from "../scripts/validate-artifact.mjs";
import {
  captureRepositorySnapshot,
  canonicalRepositoryRoot,
  readNativeTaskReviewConversation as readConversation,
  repositorySnapshotHash,
  validRepositorySnapshot,
  withNativeTaskReviewLock as withConversationLock,
} from "../src/core/native-task-review-state.mjs";
import { hashWorkflowIdentifier } from "./model-inheritance-state.mjs";
import {
  atomicNativeReviewReceipt,
  consumeNativeReviewReceipt,
  nativeReviewReceiptBindingHash,
  nativeReviewReceiptPath,
  nativeReviewRequestHash,
} from "./native-review-receipt.mjs";

export { consumeNativeReviewReceipt, nativeReviewRequestHash } from "./native-review-receipt.mjs";
export { validateConsumedNativeReviewReceipt } from "../src/core/native-task-review-state.mjs";

export const NATIVE_TASK_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NATIVE_REVIEW_RECEIPT_TTL_MS = 5 * 60 * 1000;

const MAX_CONTEXT_BYTES = 2 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 32 * 1024 * 1024;
const MAX_PLAN_FILE_BYTES = 2 * 1024 * 1024;
const PLAN_FILE_WINDOW_MS = 120 * 1000;
const WORK_REVIEW_TOOL = /^MCP:workflow_closeout$/i;
const sha256 = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");

function timestamp(options = {}) {
  const value = options.now ? options.now() : new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nowMs(options = {}) {
  return Date.parse(timestamp(options));
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  try { chmodSync(path, 0o700); } catch { /* best effort */ }
}

function atomicJson(path, value) {
  ensureDirectory(dirname(path));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source) > MAX_CONTEXT_BYTES) throw new Error("native task Review context exceeds size limit");
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, source, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function contextRoot(stateRoot) {
  return join(stateRoot, "manual-native-task-review");
}

function conversationPath(stateRoot, conversationHash) {
  return join(contextRoot(stateRoot), "conversations", `${conversationHash}.json`);
}

function writeConversation(stateRoot, conversationHash, value, options = {}) {
  atomicJson(conversationPath(stateRoot, conversationHash), {
    schema: 3,
    kind: "cursor-native-task-review-context",
    conversation_hash: conversationHash,
    revision: 1,
    root_status: "unavailable",
    active: null,
    artifacts: [],
    baseline: null,
    baseline_hash: null,
    mutation_epoch: null,
    review_selection: null,
    inflight: null,
    ...value,
    updated_at: timestamp(options),
  });
}

function workflowConversation(input) {
  return hashWorkflowIdentifier("conversation", input.conversation_id ?? input.session_id ?? input.transcript_path);
}

function workflowGeneration(input) {
  return hashWorkflowIdentifier("generation", input.generation_id ?? input.turn_id);
}

function workflowTool(input) {
  return hashWorkflowIdentifier("tool", input.tool_use_id ?? input.tool_call_id);
}

function canonicalWorkspace(value, options = {}) {
  try { return canonicalRepositoryRoot(value, options); } catch { return null; }
}

function workspaceForInput(input, options = {}) {
  if (typeof options.workspaceRoot === "string") return canonicalWorkspace(options.workspaceRoot, options);
  const supplied = Array.isArray(input.workspace_roots) ? input.workspace_roots : [];
  const canonical = supplied.map((value) => canonicalWorkspace(value, options));
  if (canonical.some((value) => !value)) return null;
  const advertised = [...new Set(canonical)];
  if (advertised.length === 1) return advertised[0];
  const cwd = canonicalWorkspace(input.cwd, options);
  if (advertised.length === 0) return cwd;
  return null;
}

function planObservation(toolInput, pluginRoot) {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput) || typeof toolInput.plan !== "string") return null;
  const inspected = inspectArtifactText(toolInput.plan, pluginRoot);
  const fields = inspected.artifact?.fields;
  if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields.schema !== 5 || fields.status !== "ready") return null;
  const preflight = preflightRootPlan(toolInput.plan, pluginRoot);
  if (!preflight.feasible) return null;
  const title = toolInput.plan.match(/(?:^|\n)#\s+([^\r\n]+)/)?.[1]?.trim() ?? toolInput.name?.trim() ?? null;
  return {
    root_plan_id: fields.id,
    root_hash: sha256(toolInput.plan),
    root_text: toolInput.plan,
    title,
  };
}

function normalizedRootBinding(active) {
  const legacy = {
    status: "enforced",
    source: "post-tool-use",
    reason_codes: [],
  };
  const value = active?.root_binding ?? legacy;
  const valid = value && typeof value === "object" && !Array.isArray(value)
    && ["enforced", "provisional"].includes(value.status)
    && ["post-tool-use", "task-transcript-stop", "recent-plan-file-stop"].includes(value.source)
    && Array.isArray(value.reason_codes)
    && value.reason_codes.every((reason) => typeof reason === "string")
    && (value.status === "enforced"
      ? ["post-tool-use", "task-transcript-stop"].includes(value.source) && value.reason_codes.length === 0
      : value.source === "recent-plan-file-stop" && value.reason_codes.includes("native-plan-transcript-unavailable"));
  return valid ? value : null;
}

function rootSourceForBinding(binding) {
  return binding?.status === "provisional" ? "cursor-plan-file" : "cursor-create-plan";
}

function baselineObservation(workspaceRoot, options = {}) {
  if (!workspaceRoot) {
    return { snapshot: null, hash: null, status: "unavailable", reason: "workspace-unavailable" };
  }
  try {
    const capture = options.captureSnapshot ?? captureRepositorySnapshot;
    const snapshot = capture(workspaceRoot, options);
    return {
      snapshot,
      hash: repositorySnapshotHash(snapshot),
      status: "captured",
      reason: null,
    };
  } catch (error) {
    return {
      snapshot: null,
      hash: null,
      status: "unavailable",
      reason: String(error?.message ?? error).slice(0, 500),
    };
  }
}

function mutationEpoch({ kind, conversationHash, generationHash, toolHash = null, rootHash, baseline, sourceReviewId = null, correctionId = null, options = {} }) {
  const id = sha256([kind, conversationHash, generationHash, toolHash, rootHash, baseline.hash, sourceReviewId, correctionId].join("\0"));
  return {
    schema: 1,
    id,
    kind,
    status: "open",
    boundary: kind === "correction" ? "correction" : "create-plan",
    baseline_status: baseline.status,
    baseline_hash: baseline.hash,
    source_review_id: sourceReviewId,
    correction_id: correctionId,
    reviewed_repository_hash: null,
    closed_at: null,
    opened_at: timestamp(options),
  };
}

function revokeInflight(stateRoot, current, options = {}) {
  const token = current?.inflight?.token;
  if (!token) return;
  const source = nativeReviewReceiptPath(stateRoot, token, "pending");
  const target = nativeReviewReceiptPath(stateRoot, token, "revoked");
  if (!source || !target || !existsSync(source)) return;
  ensureDirectory(dirname(target));
  try {
    renameSync(source, target);
    const receipt = readJson(target);
    if (receipt) atomicNativeReviewReceipt(target, { ...receipt, revoked_at: timestamp(options) });
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
}

function recordNativePlanObservation({
  stateRoot,
  input,
  pluginRoot,
  observed,
  toolHash,
  rootBinding,
  rootSource,
  options = {},
}) {
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  if (!conversationHash || !generationHash || !toolHash) return { status: "ignored" };
  return withConversationLock(stateRoot, conversationHash, () => {
    const path = conversationPath(stateRoot, conversationHash);
    const current = readConversation(stateRoot, conversationHash);
    if (!observed) {
      if (!current) return { status: "ignored" };
      revokeInflight(stateRoot, current, options);
      writeConversation(stateRoot, conversationHash, {
        ...current,
        revision: current.revision + 1,
        root_status: "superseded",
        active: null,
        artifacts: [],
        baseline: null,
        baseline_hash: null,
        mutation_epoch: null,
        review_selection: null,
        inflight: null,
        last_plan_observation: {
          status: "invalid",
          reason_codes: ["native-plan-root-invalid"],
          observed_at: timestamp(options),
        },
      }, options);
      return { status: "superseded", reason_codes: ["native-plan-root-invalid"] };
    }
    if (current?.active
      && current.active.generation_hash === generationHash
      && current.active.root_hash !== observed.root_hash) {
      revokeInflight(stateRoot, current, options);
      writeConversation(stateRoot, conversationHash, {
        ...current,
        revision: current.revision + 1,
        root_status: "ambiguous",
        active: null,
        artifacts: [],
        baseline: null,
        baseline_hash: null,
        mutation_epoch: null,
        review_selection: null,
        inflight: null,
        last_plan_observation: {
          status: "ambiguous",
          reason_codes: ["native-plan-root-ambiguous"],
          observed_at: timestamp(options),
        },
      }, options);
      return { status: "ambiguous" };
    }
    if (current?.active?.generation_hash === generationHash
      && current.active.root_hash === observed.root_hash) {
      const currentBinding = normalizedRootBinding(current.active);
      if (currentBinding?.status === "enforced" || currentBinding?.source === rootBinding.source) {
        return {
          status: "observed",
          root_plan_id: observed.root_plan_id,
          duplicate: true,
        };
      }
    }
    const workspaceRoot = workspaceForInput(input, options);
    const baseline = baselineObservation(workspaceRoot, options);
    const active = {
      ...observed,
      name: typeof input.tool_input?.name === "string" ? input.tool_input.name.trim() : null,
      workspace_root: workspaceRoot,
      generation_hash: generationHash,
      tool_hash: toolHash,
      root_binding: rootBinding,
      root_source: rootSource,
      observed_at: timestamp(options),
    };
    revokeInflight(stateRoot, current, options);
    writeConversation(stateRoot, conversationHash, {
      ...(current ?? {}),
      revision: (current?.revision ?? 0) + 1,
      root_status: "active",
      active,
      artifacts: current?.active?.root_hash === active.root_hash ? current.artifacts ?? [] : [],
      baseline: baseline.snapshot,
      baseline_hash: baseline.hash,
      baseline_status: baseline.status,
      baseline_reason: baseline.reason,
      mutation_epoch: mutationEpoch({
        kind: "implementation",
        conversationHash,
        generationHash,
        toolHash,
        rootHash: active.root_hash,
        baseline,
        options,
      }),
      review_selection: null,
      inflight: null,
      last_plan_observation: {
        status: "observed",
        root_plan_id: active.root_plan_id,
        root_binding: rootBinding,
        observed_at: active.observed_at,
      },
    }, options);
    if (!current && existsSync(path) && !readConversation(stateRoot, conversationHash)) return { status: "invalid" };
    return {
      status: "observed",
      root_plan_id: active.root_plan_id,
      root_binding: rootBinding,
      baseline_status: baseline.status,
    };
  }, options);
}

function recordNativePlanObservationFailure({ stateRoot, input, status, reasonCodes, options = {} }) {
  const conversationHash = workflowConversation(input);
  if (!conversationHash) return { status, reason_codes: reasonCodes };
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    revokeInflight(stateRoot, current, options);
    writeConversation(stateRoot, conversationHash, {
      ...(current ?? {}),
      revision: (current?.revision ?? 0) + 1,
      root_status: status === "ambiguous" ? "ambiguous" : "unavailable",
      active: null,
      artifacts: [],
      baseline: null,
      baseline_hash: null,
      mutation_epoch: null,
      review_selection: null,
      inflight: null,
      last_plan_observation: {
        status,
        reason_codes: reasonCodes,
        observed_at: timestamp(options),
      },
    }, options);
    return { status, reason_codes: reasonCodes };
  }, options);
}

function transcriptCreatePlan(input, pluginRoot) {
  const path = input.transcript_path;
  const identifier = input.conversation_id ?? input.session_id;
  if (typeof path !== "string" || !path.startsWith("/") || typeof identifier !== "string" || !identifier) {
    return { status: "unavailable", reason_codes: ["native-plan-transcript-unavailable"] };
  }
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch (error) {
    return error?.code === "ENOENT"
      ? { status: "unavailable", reason_codes: ["native-plan-transcript-unavailable"] }
      : { status: "invalid", reason_codes: ["native-plan-transcript-stat-failed"] };
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    return { status: "invalid", reason_codes: ["native-plan-transcript-file-invalid"] };
  }
  if (metadata.size > MAX_TRANSCRIPT_BYTES) {
    return { status: "invalid", reason_codes: ["native-plan-transcript-oversized"] };
  }
  if (basename(path) !== `${identifier}.jsonl`) {
    return { status: "invalid", reason_codes: ["native-plan-transcript-conversation-mismatch"] };
  }
  try {
    const source = readFileSync(path, "utf8");
    if (Buffer.byteLength(source) > MAX_TRANSCRIPT_BYTES) {
      return { status: "invalid", reason_codes: ["native-plan-transcript-oversized"] };
    }
    const lines = source.split(/\r?\n/).filter((line) => line.length > 0);
    const entries = lines.map((line) => {
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid transcript row");
      return value;
    });
    const last = entries.at(-1);
    if (last?.type !== "turn_ended" || last.status !== "success") {
      return { status: "invalid", reason_codes: ["native-plan-transcript-turn-incomplete"] };
    }
    let previousTurnEnd = -1;
    for (let index = entries.length - 2; index >= 0; index -= 1) {
      if (entries[index]?.type === "turn_ended") {
        previousTurnEnd = index;
        break;
      }
    }
    const segment = entries.slice(previousTurnEnd + 1, -1);
    const candidates = segment.flatMap((entry) => {
      if (entry?.role !== "assistant" || !Array.isArray(entry.message?.content)) return [];
      return entry.message.content.filter((block) => block?.type === "tool_use" && block.name === "CreatePlan");
    });
    if (candidates.length !== 1) {
      return {
        status: candidates.length > 1 ? "ambiguous" : "invalid",
        reason_codes: [candidates.length > 1 ? "native-plan-transcript-create-plan-ambiguous" : "native-plan-transcript-create-plan-missing"],
      };
    }
    const observed = planObservation(candidates[0].input, pluginRoot);
    return observed
      ? { status: "resolved", observed }
      : { status: "invalid", reason_codes: ["native-plan-transcript-root-invalid"] };
  } catch {
    return { status: "invalid", reason_codes: ["native-plan-transcript-invalid"] };
  }
}

function nativePlanFileInput(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match) return null;
  let header;
  try { header = parse(match[1]); } catch { return null; }
  if (!header || typeof header !== "object" || Array.isArray(header)
    || typeof header.name !== "string" || !header.name.trim()
    || (header.overview !== undefined && typeof header.overview !== "string")
    || (header.todos !== undefined && !Array.isArray(header.todos))
    || (header.isProject !== undefined && typeof header.isProject !== "boolean")) return null;
  return {
    name: header.name,
    overview: header.overview,
    todos: header.todos,
    isProject: header.isProject,
    plan: match[2],
  };
}

function recentNativePlanFile(markerStartedAt, pluginRoot, options = {}) {
  const markerMs = Date.parse(markerStartedAt);
  const stopMs = nowMs(options);
  if (!Number.isFinite(markerMs) || markerMs > stopMs + 5_000) {
    return { status: "invalid", reason_codes: ["native-plan-marker-invalid"] };
  }
  const directory = options.planDirectory ?? join(options.homeDirectory ?? homedir(), ".cursor", "plans");
  let names;
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".plan.md"));
  } catch (error) {
    return {
      status: "unavailable",
      reason_codes: [error?.code === "ENOENT" ? "native-plan-file-missing" : "native-plan-file-directory-unavailable"],
    };
  }
  const threshold = Math.max(markerMs, stopMs - PLAN_FILE_WINDOW_MS);
  const candidates = [];
  for (const name of names) {
    const path = join(directory, name);
    let metadata;
    try { metadata = lstatSync(path); } catch { continue; }
    const createdMs = metadata.mtimeMs;
    if (createdMs >= threshold && createdMs <= stopMs + 5_000) candidates.push({ path, metadata });
  }
  if (candidates.length !== 1) {
    return {
      status: candidates.length > 1 ? "ambiguous" : "unavailable",
      reason_codes: [candidates.length > 1 ? "native-plan-file-ambiguous" : "native-plan-file-missing"],
    };
  }
  const [{ path, metadata }] = candidates;
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    return { status: "invalid", reason_codes: ["native-plan-file-invalid"] };
  }
  if (metadata.size > MAX_PLAN_FILE_BYTES) {
    return { status: "invalid", reason_codes: ["native-plan-file-oversized"] };
  }
  try {
    const source = readFileSync(path, "utf8");
    if (Buffer.byteLength(source) > MAX_PLAN_FILE_BYTES) {
      return { status: "invalid", reason_codes: ["native-plan-file-oversized"] };
    }
    const toolInput = nativePlanFileInput(source);
    const observed = planObservation(toolInput, pluginRoot);
    return observed
      ? { status: "resolved", observed }
      : { status: "invalid", reason_codes: ["native-plan-file-root-invalid"] };
  } catch {
    return { status: "invalid", reason_codes: ["native-plan-file-read-failed"] };
  }
}

export function observeNativeCreatePlan({ stateRoots, input, pluginRoot, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const toolHash = workflowTool(input);
  if (!toolHash) return { status: "ignored" };
  return recordNativePlanObservation({
    stateRoot: stateRoots[0],
    input,
    pluginRoot,
    observed: planObservation(input.tool_input, pluginRoot),
    toolHash,
    rootBinding: { status: "enforced", source: "post-tool-use", reason_codes: [] },
    rootSource: "cursor-create-plan",
    options,
  });
}

export function observeNativeCreatePlanAtStop({ stateRoots, input, markerStartedAt, pluginRoot, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const stateRoot = stateRoots[0];
  const transcript = transcriptCreatePlan(input, pluginRoot);
  if (transcript.status === "resolved") {
    return recordNativePlanObservation({
      stateRoot,
      input,
      pluginRoot,
      observed: transcript.observed,
      toolHash: sha256(["transcript-stop", input.generation_id ?? input.turn_id, transcript.observed.root_hash].join("\0")).slice(0, 32),
      rootBinding: { status: "enforced", source: "task-transcript-stop", reason_codes: [] },
      rootSource: "cursor-create-plan",
      options,
    });
  }
  if (transcript.status !== "unavailable") {
    return recordNativePlanObservationFailure({ stateRoot, input, status: transcript.status, reasonCodes: transcript.reason_codes, options });
  }
  const planFile = recentNativePlanFile(markerStartedAt, pluginRoot, options);
  if (planFile.status !== "resolved") {
    return recordNativePlanObservationFailure({
      stateRoot,
      input,
      status: planFile.status,
      reasonCodes: [...new Set([...transcript.reason_codes, ...planFile.reason_codes])],
      options,
    });
  }
  return recordNativePlanObservation({
    stateRoot,
    input,
    pluginRoot,
    observed: planFile.observed,
    toolHash: sha256(["plan-file-stop", input.generation_id ?? input.turn_id, planFile.observed.root_hash].join("\0")).slice(0, 32),
    rootBinding: {
      status: "provisional",
      source: "recent-plan-file-stop",
      reason_codes: ["native-plan-transcript-unavailable"],
    },
    rootSource: "cursor-plan-file",
    options,
  });
}

/** Legacy compatibility export. Implement Plan prose is intentionally inert. */
export function approveNativeImplementPlan() {
  return { status: "ignored", reason: "implementation-authorization-host-owned-unattested" };
}

function inspectedArtifacts(rootText, artifacts, pluginRoot) {
  const entries = [];
  const byId = new Map();
  for (const raw of artifacts ?? []) {
    const inspected = inspectArtifactText(raw?.text, pluginRoot);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
      return { status: "invalid", errors: inspected.errors.length > 0 ? inspected.errors : ["artifact ID is unavailable"] };
    }
    const fields = inspected.artifact.fields;
    if (!['delivery-evidence', 'work-review'].includes(fields.artifact)) {
      return { status: "invalid", errors: [`unexpected predecessor artifact ${fields.artifact}`] };
    }
    if (byId.has(fields.id) && byId.get(fields.id).text !== raw.text) {
      return { status: "invalid", errors: [`predecessor ${fields.id} has conflicting immutable bytes`] };
    }
    const entry = { ...raw, label: fields.id, fields };
    byId.set(fields.id, entry);
    entries.push(entry);
  }
  return { status: "valid", entries: [...byId.values()] };
}

function validArtifacts(rootText, artifacts, pluginRoot) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return { status: "full-rebuild", artifacts: [] };
  const root = inspectArtifactText(rootText, pluginRoot);
  const rootId = root.artifact?.fields?.id;
  const inspected = inspectedArtifacts(rootText, artifacts, pluginRoot);
  if (inspected.status !== "valid") return inspected;
  const evidence = inspected.entries.filter((entry) => entry.fields.artifact === "delivery-evidence");
  const reviews = inspected.entries.filter((entry) => entry.fields.artifact === "work-review");
  if (inspected.entries.some((entry) => entry.fields.root_plan_id !== rootId)) {
    return { status: "invalid", errors: ["predecessor chain crosses Root authority"] };
  }
  for (const entry of reviews) {
    const provenance = entry.builder_provenance;
    if (provenance?.schema !== 1
      || provenance?.kind !== "host-work-review-builder"
      || !/^[a-f0-9]{64}$/.test(String(provenance.review_input_hash ?? ""))
      || provenance.artifact_hash !== sha256(entry.text)) {
      return { status: "invalid", errors: [`work-review ${entry.label} has invalid host builder provenance`] };
    }
  }
  // Syntactically valid but incomplete subsets do not gain task-chain status.
  const evidenceIds = new Set(evidence.map((entry) => entry.fields.id));
  const reviewIds = new Set(reviews.map((entry) => entry.fields.id));
  const referencedEvidence = new Set(reviews.map((entry) => entry.fields.latest_evidence_id));
  if (evidence.length === 0
    || reviews.length === 0
    || reviews.some((entry) => !evidenceIds.has(entry.fields.latest_evidence_id))
    || evidence.some((entry) => !referencedEvidence.has(entry.fields.id))
    || evidence.some((entry) => entry.fields.predecessor_evidence_id && !evidenceIds.has(entry.fields.predecessor_evidence_id))
    || evidence.some((entry) => entry.fields.source_review_id && !reviewIds.has(entry.fields.source_review_id))
    || reviews.some((entry) => entry.fields.predecessor_review_id && !reviewIds.has(entry.fields.predecessor_review_id))) {
    return { status: "full-rebuild", artifacts: [] };
  }
  const pairs = [["root", rootText], ...inspected.entries.map((entry) => [entry.label, entry.text])];
  const chain = inspectArtifactSet(pairs, pluginRoot);
  if (chain.errors.length > 0) return { status: "invalid", errors: chain.errors };
  const tips = effectiveCliSummary(chain);
  const evidenceTip = tips.evidence_tips[rootId] ?? null;
  const reviewTip = tips.review_tips[rootId] ?? null;
  const effectiveReview = reviewTip ? chain.effective.get(reviewTip) : null;
  if (!evidenceTip || !reviewTip || effectiveReview?.fields?.latest_evidence_id !== evidenceTip) {
    return { status: "full-rebuild", artifacts: [] };
  }
  return {
    status: "task-chain",
    artifacts: inspected.entries.map(({ fields, ...entry }) => entry),
    tips,
    effective: chain.effective,
  };
}

function validateActive(current, pluginRoot) {
  if (!current) return { status: "unavailable" };
  const reasonCodes = current.last_plan_observation?.reason_codes ?? [];
  if (current.root_status === "ambiguous") return { status: "ambiguous", reason_codes: reasonCodes };
  if (current.root_status !== "active" || !current.active) return { status: "unavailable", reason_codes: reasonCodes };
  const rootBinding = normalizedRootBinding(current.active);
  const rootSource = current.active.root_source ?? rootSourceForBinding(rootBinding);
  const inspected = inspectArtifactText(current.active.root_text, pluginRoot);
  if (inspected.errors.length > 0
    || inspected.artifact?.fields?.id !== current.active.root_plan_id
    || sha256(current.active.root_text) !== current.active.root_hash
    || !rootBinding
    || !["cursor-create-plan", "cursor-plan-file"].includes(rootSource)
    || rootSource !== rootSourceForBinding(rootBinding)) return { status: "invalid" };
  if (repositoryAttribution(current).reason_codes.includes("baseline-binding-invalid")) {
    return { status: "invalid", errors: ["native repository baseline binding is invalid"] };
  }
  const chain = validArtifacts(current.active.root_text, current.artifacts ?? [], pluginRoot);
  if (chain.status === "invalid") return { status: "invalid", errors: chain.errors };
  return { status: "resolved", current, chain, rootBinding, rootSource };
}

export function selectNativeReviewRoot({ stateRoots, input, pluginRoot, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const stateRoot = stateRoots[0];
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  if (!conversationHash || !generationHash) return { status: "unavailable" };
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    if (!current && existsSync(conversationPath(stateRoot, conversationHash))) return { status: "invalid" };
    const resolved = validateActive(current, pluginRoot);
    if (resolved.status !== "resolved") return resolved;
    revokeInflight(stateRoot, current, options);
    let selected = current;
    if (current.mutation_epoch?.status === "closed") {
      const repository = baselineObservation(current.active.workspace_root, options);
      const reasonCodes = [...new Set([
        ...(current.mutation_epoch.reason_codes ?? []),
        ...(repository.status !== "captured"
          ? ["repository-state-unavailable"]
          : repository.hash !== current.mutation_epoch.reviewed_repository_hash
            ? ["repository-drift-after-review"]
            : []),
      ])].sort();
      selected = {
        ...current,
        mutation_epoch: {
          ...current.mutation_epoch,
          reason_codes: reasonCodes,
          last_repository_check_at: timestamp(options),
        },
      };
    }
    const next = {
      ...selected,
      revision: selected.revision + 1,
      review_selection: {
        schema: 1,
        source: "explicit-review-command",
        review_enforcement: {
          status: "enforced",
          reason_codes: [],
        },
        generation_hash: generationHash,
        root_hash: selected.active.root_hash,
        repository_hash: baselineObservation(selected.active.workspace_root, options).hash,
        selected_at: timestamp(options),
      },
      inflight: null,
    };
    writeConversation(stateRoot, conversationHash, next, options);
    return {
      status: "selected",
      root_plan_id: selected.active.root_plan_id,
      context_revision: next.revision,
      implementation_authorization: "host-owned-unattested",
    };
  }, options);
}

function transcriptUserText(entry) {
  if (entry?.role !== "user") return null;
  const content = entry.message?.content ?? entry.content ?? entry.text;
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length !== 1) return null;
  const block = content[0];
  return block?.type === "text" && typeof block.text === "string" ? block.text : null;
}

function exactTranscriptReviewCommand(input) {
  const path = input.transcript_path;
  const identifier = input.conversation_id ?? input.session_id;
  if (typeof path !== "string" || !path.startsWith("/") || typeof identifier !== "string" || !identifier) {
    return { status: "unavailable", reason: "transcript-binding-unavailable" };
  }
  try {
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_TRANSCRIPT_BYTES) {
      return { status: "unavailable", reason: "transcript-path-invalid" };
    }
    if (basename(path) !== `${identifier}.jsonl`) {
      return { status: "unavailable", reason: "transcript-conversation-mismatch" };
    }
    const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0) return { status: "unavailable", reason: "transcript-empty" };
    const entries = lines.map((line) => {
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid transcript row");
      return value;
    });
    const userEntries = entries.filter((entry) => entry.role === "user");
    const userTexts = userEntries.map(transcriptUserText);
    if (userTexts.length === 0 || userTexts.some((value) => value === null)) {
      return { status: "unavailable", reason: "transcript-user-message-invalid" };
    }
    return userTexts.at(-1) === "/review-work"
      ? { status: "exact" }
      : { status: "unavailable", reason: "review-command-not-exact-last-user-text" };
  } catch {
    return { status: "unavailable", reason: "transcript-invalid" };
  }
}

/** Recover only the human Review activation; Root and predecessors remain host state. */
export function recoverNativeReviewSelection({ stateRoots, input, pluginRoot, options = {} }) {
  const source = input.tool_input;
  const toolInput = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  if (!WORK_REVIEW_TOOL.test(String(input.tool_name ?? "")) || (toolInput.artifact_kind ?? "delivery-evidence") !== "work-review") return { status: "ignored" };
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  if (!conversationHash || !generationHash) return { status: "unavailable" };
  const transcript = exactTranscriptReviewCommand(input);
  if (transcript.status !== "exact") return transcript;
  const stateRoot = stateRoots[0];
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    const resolved = validateActive(current, pluginRoot);
    if (resolved.status !== "resolved") return resolved;
    const workspaceRoot = workspaceForInput(input, options);
    if (!workspaceRoot || workspaceRoot !== current.active.workspace_root) {
      return { status: "mismatch", reason: "recovery-workspace-mismatch" };
    }
    revokeInflight(stateRoot, current, options);
    const next = {
      ...current,
      revision: current.revision + 1,
      review_selection: {
        schema: 1,
        source: "transcript-exact-review-command",
        review_enforcement: {
          status: "unavailable",
          reason_codes: ["review-observer-unavailable"],
        },
        generation_hash: generationHash,
        root_hash: current.active.root_hash,
        repository_hash: baselineObservation(current.active.workspace_root, options).hash,
        selected_at: timestamp(options),
      },
      inflight: null,
    };
    writeConversation(stateRoot, conversationHash, next, options);
    return {
      status: "selected-provisional",
      root_plan_id: current.active.root_plan_id,
      context_revision: next.revision,
      review_enforcement: next.review_selection.review_enforcement,
    };
  }, options);
}

export function authorizeNativeReviewShell({ stateRoots, input, pluginRoot, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "denied", reason: "workspace-ambiguous" };
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  if (!conversationHash || !generationHash) return { status: "denied", reason: "review-binding-unavailable" };
  return withConversationLock(stateRoots[0], conversationHash, () => {
    const current = readConversation(stateRoots[0], conversationHash);
    const resolved = validateActive(current, pluginRoot);
    if (resolved.status !== "resolved") return { status: "denied", reason: `root-${resolved.status}` };
    if (!current.review_selection
      || current.review_selection.generation_hash !== generationHash
      || current.review_selection.root_hash !== current.active.root_hash) {
      return { status: "denied", reason: "review-selection-unavailable" };
    }
    return manualReviewShellDecision({
      rootPlanText: current.active.root_text,
      pluginRoot,
      workspaceRoot: current.active.workspace_root,
      expectedRootHash: current.active.root_hash,
      toolName: input.tool_name,
      toolInput: input.tool_input,
    });
  }, options);
}

export function beginNativeCorrection({ stateRoots, input, pluginRoot, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const stateRoot = stateRoots[0];
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  if (!conversationHash || !generationHash) return { status: "unavailable" };
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    const resolved = validateActive(current, pluginRoot);
    if (resolved.status !== "resolved") return resolved;
    if (resolved.chain.status !== "task-chain") return { status: "unavailable" };
    const reviewTipId = resolved.chain.tips.review_tips[current.active.root_plan_id] ?? null;
    const reviewTip = reviewTipId ? resolved.chain.effective.get(reviewTipId) : null;
    if (reviewTip?.fields?.next_action !== "correct" || !reviewTip.fields.correction_id) return { status: "unavailable" };
    const baseline = baselineObservation(current.active.workspace_root, options);
    revokeInflight(stateRoot, current, options);
    const epoch = mutationEpoch({
      kind: "correction",
      conversationHash,
      generationHash,
      rootHash: current.active.root_hash,
      baseline,
      sourceReviewId: reviewTipId,
      correctionId: reviewTip.fields.correction_id,
      options,
    });
    writeConversation(stateRoot, conversationHash, {
      ...current,
      revision: current.revision + 1,
      baseline: baseline.snapshot,
      baseline_hash: baseline.hash,
      baseline_status: baseline.status,
      baseline_reason: baseline.reason,
      mutation_epoch: epoch,
      review_selection: null,
      inflight: null,
    }, options);
    return { status: "selected", mutation_epoch: epoch, baseline_status: baseline.status };
  }, options);
}

export function markNativeRepositoryMutation({ stateRoots, input, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous", marked: 0 };
  const sourceConversationHash = workflowConversation(input);
  if (!sourceConversationHash) return { status: "unavailable", marked: 0 };
  const stateRoot = stateRoots[0];
  const directory = join(contextRoot(stateRoot), "conversations");
  if (!existsSync(directory)) return { status: "ignored", marked: 0 };
  let marked = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const conversationHash = entry.name.slice(0, -5);
    const sameConversation = conversationHash === sourceConversationHash;
    const changed = withConversationLock(stateRoot, conversationHash, () => {
      const current = readConversation(stateRoot, conversationHash);
      if (!current?.active || !current.mutation_epoch) return false;
      const protectedSameConversation = current.mutation_epoch.status === "closed"
        || Boolean(current.review_selection)
        || Boolean(current.inflight);
      if (sameConversation && !protectedSameConversation) return false;
      const reason = sameConversation && current.mutation_epoch.status === "closed"
        ? "post-review-repository-activity"
        : "concurrent-repository-activity";
      const reasonCodes = [...new Set([
        ...(current.mutation_epoch.reason_codes ?? []),
        reason,
      ])].sort();
      if (reasonCodes.length === (current.mutation_epoch.reason_codes ?? []).length && !current.inflight) return false;
      revokeInflight(stateRoot, current, options);
      writeConversation(stateRoot, conversationHash, {
        ...current,
        revision: current.revision + 1,
        mutation_epoch: {
          ...current.mutation_epoch,
          reason_codes: reasonCodes,
          contaminated_at: timestamp(options),
        },
        review_selection: null,
        inflight: null,
      }, options);
      return true;
    }, options);
    if (changed) marked += 1;
  }
  return { status: marked > 0 ? "marked" : "ignored", marked };
}

function repositoryAttribution(current) {
  const computedBaselineHash = repositorySnapshotHash(current.baseline);
  const baselineWorkspace = validRepositorySnapshot(current.baseline)
    ? canonicalWorkspace(current.baseline.repository_root)
    : null;
  const activeWorkspace = canonicalWorkspace(current.active?.workspace_root);
  const baselineBindingValid = current.baseline_status === "captured"
    && Boolean(computedBaselineHash)
    && current.baseline_hash === computedBaselineHash
    && current.mutation_epoch?.baseline_hash === computedBaselineHash
    && baselineWorkspace === activeWorkspace;
  const baselineAvailable = baselineBindingValid;
  const reasonCodes = [...new Set([
    ...(!baselineAvailable
      ? current.baseline_status === "captured" ? ["baseline-binding-invalid"] : ["baseline-unavailable"]
      : []),
    ...(!current.mutation_epoch ? ["mutation-epoch-unavailable"] : []),
    ...(current.mutation_epoch?.reason_codes ?? []),
  ])].sort();
  return {
    schema: 1,
    status: baselineAvailable && reasonCodes.length === 0 ? "bounded" : "unavailable",
    boundary: current.mutation_epoch?.boundary ?? "create-plan",
    baseline_available: baselineAvailable,
    baseline_hash: baselineAvailable ? computedBaselineHash : null,
    pre_existing_paths: baselineAvailable ? [...(current.baseline.dirty_paths ?? [])] : [],
    reason_codes: reasonCodes,
  };
}

export function prepareNativeReviewReceipt({ stateRoots, input, pluginRoot, options = {} }) {
  const source = input.tool_input;
  const toolInput = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  if (!WORK_REVIEW_TOOL.test(String(input.tool_name ?? "")) || (toolInput.artifact_kind ?? "delivery-evidence") !== "work-review") return { status: "ignored" };
  if (Object.prototype.hasOwnProperty.call(toolInput, "native_review_receipt")) {
    return { status: "mismatch", reason: "model-supplied-receipt" };
  }
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const stateRoot = stateRoots[0];
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  const toolHash = workflowTool(input);
  if (!conversationHash || !generationHash || !toolHash) return { status: "mismatch" };
  const requestHash = nativeReviewRequestHash(toolInput);
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    if (!current && existsSync(conversationPath(stateRoot, conversationHash))) return { status: "invalid" };
    const resolved = validateActive(current, pluginRoot);
    if (resolved.status !== "resolved") return resolved;
    if (!current.review_selection
      || !["explicit-review-command", "transcript-exact-review-command"].includes(current.review_selection.source)
      || current.review_selection.generation_hash !== generationHash
      || current.review_selection.root_hash !== current.active.root_hash) {
      return { status: "unavailable" };
    }
    const reviewRepository = baselineObservation(current.active.workspace_root, options);
    if (!current.review_selection.repository_hash
      || reviewRepository.status !== "captured"
      || reviewRepository.hash !== current.review_selection.repository_hash) {
      return { status: "mismatch", reason: "repository-mutated-during-review" };
    }
    if (toolInput.root_plan_id && toolInput.root_plan_id !== current.active.root_plan_id) {
      return { status: "mismatch", expected_root_plan_id: current.active.root_plan_id };
    }
    const createdAt = timestamp(options);
    if (current.inflight && Date.parse(current.inflight.expires_at) > Date.parse(createdAt)) {
      if (current.inflight.generation_hash === generationHash
        && current.inflight.tool_hash === toolHash
        && current.inflight.request_hash === requestHash) {
        return {
          status: "prepared",
          root_plan_id: current.active.root_plan_id,
          request_hash: requestHash,
          token: current.inflight.token,
          updated_input: { ...toolInput, native_review_receipt: current.inflight.token },
          duplicate: true,
        };
      }
      return { status: "busy" };
    }
    if (current.inflight) revokeInflight(stateRoot, current, options);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.parse(createdAt) + NATIVE_REVIEW_RECEIPT_TTL_MS).toISOString();
    const nextRevision = current.revision + 1;
    const receipt = {
      schema: 4,
      kind: "cursor-native-review-receipt",
      receipt_id: tokenHash.slice(0, 32),
      token_hash: tokenHash,
      request_hash: requestHash,
      workspace_hash: sha256(stateRoot).slice(0, 32),
      workspace_root: current.active.workspace_root,
      conversation_hash: conversationHash,
      generation_hash: generationHash,
      tool_hash: toolHash,
      context_revision: nextRevision,
      root_plan_id: current.active.root_plan_id,
      root_hash: current.active.root_hash,
      root_text: current.active.root_text,
      root_binding: resolved.rootBinding,
      root_source: resolved.rootSource,
      artifacts: resolved.chain.artifacts,
      predecessor_mode: resolved.chain.status,
      baseline: current.baseline ?? null,
      baseline_hash: current.baseline_hash ?? null,
      repository_attribution: repositoryAttribution(current),
      mutation_epoch: current.mutation_epoch,
      review_selection_source: current.review_selection.source,
      review_enforcement: current.review_selection.review_enforcement ?? {
        status: current.review_selection.source === "explicit-review-command" ? "enforced" : "unavailable",
        reason_codes: current.review_selection.source === "explicit-review-command" ? [] : ["review-observer-unavailable"],
      },
      implementation_authorization: "host-owned-unattested",
      created_at: createdAt,
      expires_at: expiresAt,
    };
    receipt.binding_hash = nativeReviewReceiptBindingHash(receipt);
    const pendingPath = nativeReviewReceiptPath(stateRoot, token, "pending");
    atomicNativeReviewReceipt(pendingPath, receipt);
    try {
      writeConversation(stateRoot, conversationHash, {
        ...current,
        revision: nextRevision,
        inflight: {
          schema: 1,
          token,
          token_hash: tokenHash,
          request_hash: requestHash,
          generation_hash: generationHash,
          tool_hash: toolHash,
          context_revision: nextRevision,
          expires_at: expiresAt,
        },
      }, options);
    } catch (error) {
      rmSync(pendingPath, { force: true });
      throw error;
    }
    return {
      status: "prepared",
      root_plan_id: receipt.root_plan_id,
      request_hash: requestHash,
      token,
      updated_input: { ...toolInput, native_review_receipt: token },
    };
  }, options);
}

function parseToolOutput(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = parseToolOutput(entry?.text ?? entry, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === "string") {
    try { return parseToolOutput(JSON.parse(value), depth + 1); } catch { return null; }
  }
  if (typeof value !== "object") return null;
  if (value.structuredContent && typeof value.structuredContent === "object") return parseToolOutput(value.structuredContent, depth + 1);
  if (value.artifact_kind === "work-review" && value.delivery_evidence_artifact && value.artifact) return value;
  for (const key of ["tool_output", "result", "output", "content"]) {
    const nested = parseToolOutput(value[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function outputArtifacts(payload, active, pluginRoot) {
  const evidence = inspectArtifactText(payload.delivery_evidence_artifact, pluginRoot);
  const review = inspectArtifactText(payload.artifact, pluginRoot);
  const evidenceFields = evidence.artifact?.fields;
  const reviewFields = review.artifact?.fields;
  if (evidence.errors.length > 0 || evidenceFields?.artifact !== "delivery-evidence" || evidenceFields.root_plan_id !== active.root_plan_id) return null;
  if (review.errors.length > 0 || reviewFields?.artifact !== "work-review" || reviewFields.root_plan_id !== active.root_plan_id) return null;
  const evidenceHash = sha256(payload.delivery_evidence_artifact);
  const reviewHash = sha256(payload.artifact);
  if (payload.delivery_evidence_hash !== evidenceHash || payload.artifact_hash !== reviewHash || !/^[a-f0-9]{64}$/.test(String(payload.review_input_hash ?? ""))) return null;
  if (!/^[a-f0-9]{64}$/.test(String(payload.repository_state_hash ?? ""))) return null;
  if (!["reuse", "append", "replace-full-tip", "replace-delta-suffix"].includes(payload.chain_update)) return null;
  return {
    entries: [
      { label: evidenceFields.id, text: payload.delivery_evidence_artifact },
      {
        label: reviewFields.id,
        text: payload.artifact,
        builder_provenance: {
          schema: 1,
          kind: "host-work-review-builder",
          review_input_hash: payload.review_input_hash,
          artifact_hash: reviewHash,
        },
      },
    ],
    evidenceFields,
    reviewFields,
    chainUpdate: payload.chain_update,
    repositoryStateHash: payload.repository_state_hash,
  };
}

export function observeNativeReviewResult({ stateRoots, input, pluginRoot, options = {} }) {
  if (!WORK_REVIEW_TOOL.test(String(input.tool_name ?? ""))) return { status: "ignored" };
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const payload = parseToolOutput(input.tool_output);
  if (!payload) return failNativeReview({ stateRoots, input, options });
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  const toolHash = workflowTool(input);
  if (!conversationHash || !generationHash || !toolHash) return { status: "unavailable" };
  const stateRoot = stateRoots[0];
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    if (!current?.active || current.active.root_plan_id !== payload.root_plan_id) return { status: "mismatch" };
    if (current.inflight?.generation_hash !== generationHash || current.inflight?.tool_hash !== toolHash) return { status: "mismatch" };
    const incoming = outputArtifacts(payload, current.active, pluginRoot);
    if (!incoming) return { status: "invalid" };
    let retained = current.artifacts ?? [];
    if (["replace-full-tip", "replace-delta-suffix"].includes(incoming.chainUpdate)) {
      const prior = validArtifacts(current.active.root_text, current.artifacts ?? [], pluginRoot);
      if (prior.status !== "task-chain") return { status: "invalid", errors: ["Review replacement requires one complete current predecessor pair"] };
      const priorEvidenceId = prior.tips.evidence_tips[current.active.root_plan_id] ?? null;
      const priorReviewId = prior.tips.review_tips[current.active.root_plan_id] ?? null;
      const priorEvidence = priorEvidenceId ? prior.effective.get(priorEvidenceId)?.fields : null;
      if (incoming.chainUpdate === "replace-full-tip") {
        if (incoming.evidenceFields.representation !== "full"
          || incoming.evidenceFields.source_review_id !== null
          || incoming.evidenceFields.predecessor_evidence_id !== null) return { status: "invalid" };
      } else if (incoming.evidenceFields.representation !== "delta"
        || incoming.evidenceFields.source_review_id !== priorEvidence?.source_review_id
        || incoming.evidenceFields.predecessor_evidence_id !== priorEvidence?.predecessor_evidence_id) return { status: "invalid" };
      retained = retained.filter((entry) => ![priorEvidenceId, priorReviewId].includes(entry.label));
    }
    const merged = new Map(retained.map((entry) => [entry.label, entry]));
    for (const entry of incoming.entries) merged.set(entry.label, entry);
    const artifacts = [...merged.values()];
    const chain = validArtifacts(current.active.root_text, artifacts, pluginRoot);
    if (chain.status !== "task-chain") return { status: "invalid", errors: chain.errors ?? ["Review result did not create a complete predecessor pair"] };
    writeConversation(stateRoot, conversationHash, {
      ...current,
      revision: current.revision + 1,
      artifacts,
      mutation_epoch: current.mutation_epoch ? {
        ...current.mutation_epoch,
        status: "closed",
        reviewed_repository_hash: incoming.repositoryStateHash,
        closed_at: timestamp(options),
      } : null,
      review_selection: null,
      inflight: null,
    }, options);
    return { status: "recorded", root_plan_id: current.active.root_plan_id };
  }, options);
}

export function failNativeReview({ stateRoots, input, options = {} }) {
  if (!Array.isArray(stateRoots) || stateRoots.length !== 1) return { status: "ambiguous" };
  const conversationHash = workflowConversation(input);
  const generationHash = workflowGeneration(input);
  const toolHash = workflowTool(input);
  if (!conversationHash) return { status: "unavailable" };
  const stateRoot = stateRoots[0];
  return withConversationLock(stateRoot, conversationHash, () => {
    const current = readConversation(stateRoot, conversationHash);
    if (!current?.inflight) return { status: "ignored" };
    if (generationHash && current.inflight.generation_hash !== generationHash) return { status: "ignored" };
    if (toolHash && current.inflight.tool_hash !== toolHash) return { status: "ignored" };
    revokeInflight(stateRoot, current, options);
    writeConversation(stateRoot, conversationHash, {
      ...current,
      revision: current.revision + 1,
      review_selection: null,
      inflight: null,
    }, options);
    return { status: "revoked" };
  }, options);
}

export function cleanupNativeTaskReviewContext(stateRoot, options = {}) {
  const root = contextRoot(stateRoot);
  if (!existsSync(root)) return;
  const cutoff = nowMs(options) - NATIVE_TASK_CONTEXT_TTL_MS;
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".lock")) continue;
        visit(path);
        if (readdirSync(path).length === 0) rmSync(path, { recursive: true, force: true });
      } else if (entry.isFile() && statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
    }
  };
  visit(root);
}
