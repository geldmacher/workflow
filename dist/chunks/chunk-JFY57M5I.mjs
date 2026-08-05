#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  loadWorkflowConfig,
  repositoryBaseline,
  resolveRouteProfile
} from "./chunk-FW33DUDL.mjs";
import {
  CursorWorkerAdapter,
  currentPlatform,
  hashPluginTree,
  loadWorkerRuntimeManifest,
  sdkVersion,
  workerRuntimeDirectory
} from "./chunk-MICWNJTT.mjs";
import {
  probeSandboxBoundary
} from "./chunk-PKEO6PA3.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  opaqueExtensionsFromArtifactText,
  preflightRootPlan,
  replaceOpaqueExtensions,
  require_ajv
} from "./chunk-POBM3TB5.mjs";
import {
  require_dist
} from "./chunk-TM6F22GE.mjs";
import {
  ARTIFACT_SCHEMA,
  CONTROLLER_PROTOCOL,
  PLUGIN_VERSION,
  assertCompatiblePreparation
} from "./chunk-VL4DQUSD.mjs";
import {
  __toESM
} from "./chunk-IQRLCJ3K.mjs";

// src/controller/capabilities.mjs
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease } from "node:os";
import { dirname, join } from "node:path";
var CAPABILITY_RECEIPT_SCHEMA = 4;
var CAPABILITY_RECEIPT_VALIDITY_DAYS = 30;
var REQUIRED_OBSERVATIONS = [
  "local_mcp",
  "marketplace_mcp",
  "marketplace_worker_runtime",
  "sdk_write_boundary",
  "worker_network_isolated",
  "sdk_secret_isolated",
  "sdk_budget_cancel",
  "restart_resume",
  "crash_interrupt_resume",
  "planner_submission",
  "model_configuration_exact",
  "cursor_harness"
];
var THREE_RUN_OBSERVATIONS = /* @__PURE__ */ new Set([
  "sdk_write_boundary",
  "worker_network_isolated",
  "sdk_secret_isolated",
  "sdk_budget_cancel",
  "restart_resume",
  "crash_interrupt_resume",
  "planner_submission",
  "model_configuration_exact"
]);
var TOP_LEVEL_FIELDS = /* @__PURE__ */ new Set([
  "schema",
  "generated_by",
  "issued_at",
  "expires_at",
  "plugin_version",
  "artifact_schema",
  "controller_protocol",
  "sdk_version",
  "platform",
  "node_version",
  "os_version",
  "cursor_version",
  "marketplace_git_commit",
  "plugin_hash",
  "worker_hash",
  "runtime_hash",
  "lockfile_hash",
  "attested_route_pool_hash",
  "model_catalog_hash",
  "planning_harness_hash",
  "cursor_harness_hash",
  "verification_profile_hash",
  "model_attestation",
  "certified_models",
  "audit",
  "observations",
  "capability_vector",
  "qualification_bindings",
  "profile_eligibility",
  "evidence_hashes",
  "automation_safe"
]);
function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactFields(value, allowed, required = allowed) {
  if (!plainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.every((key) => allowed.has(key)) && [...required].every((key) => keys.includes(key));
}
function hashString(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function modelConfiguration(value) {
  return plainObject(value) && ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"].includes(value.role) && typeof value.id === "string" && value.id.length > 0 && Array.isArray(value.params) && Object.keys(value).length === 3 && value.params.every((parameter) => exactFields(parameter, /* @__PURE__ */ new Set(["id", "value"])) && typeof parameter.id === "string" && typeof parameter.value === "string");
}
function receiptProfileEligibility(receipt) {
  if (!plainObject(receipt?.observations)) return { supervised: false, autonomous: false };
  const observationsSafe = REQUIRED_OBSERVATIONS.every((key) => {
    const observation = receipt.observations[key];
    const minimum = THREE_RUN_OBSERVATIONS.has(key) ? 3 : 1;
    return observation?.verified === true && Number.isInteger(observation.repetitions) && observation.repetitions >= minimum && hashString(observation.evidence_hash);
  });
  const auditSafe = receipt.audit?.high === 0 && receipt.audit?.critical === 0 && receipt.audit?.moderate === 0 || hashString(receipt.audit?.risk_acceptance_hash);
  const modelsExact = JSON.stringify(receipt.model_attestation?.requested) === JSON.stringify(receipt.model_attestation?.accepted) && JSON.stringify(receipt.model_attestation?.accepted) === JSON.stringify(receipt.model_attestation?.observed);
  const vector = receipt.capability_vector ?? {};
  const supervised = vector.write_boundary === true && vector.network_isolation === true && vector.secret_isolation === true && vector.budget_cancel === true && vector.planning === true && vector.route_pool === true;
  const autonomous = supervised && vector.verification_profile === true && observationsSafe && auditSafe && modelsExact && Array.isArray(receipt.qualification_bindings) && receipt.qualification_bindings.length > 0 && Array.isArray(receipt.certified_models) && receipt.certified_models.length > 0;
  return { supervised, autonomous };
}
function receiptAutomationSafe(receipt) {
  return receiptProfileEligibility(receipt)?.autonomous === true;
}
function validateCapabilityReceipt(receipt, expected = {}, now = Date.now()) {
  const errors = [];
  if (!exactFields(receipt, TOP_LEVEL_FIELDS)) return { valid: false, errors: ["receipt-shape-invalid"] };
  if (receipt.schema !== CAPABILITY_RECEIPT_SCHEMA) errors.push("receipt-schema-mismatch");
  if (receipt.generated_by !== "geldmacher-workflow-capability-spike") errors.push("receipt-producer-mismatch");
  if (receipt.plugin_version !== PLUGIN_VERSION) errors.push("plugin-version-mismatch");
  if (receipt.artifact_schema !== ARTIFACT_SCHEMA) errors.push("artifact-schema-mismatch");
  if (receipt.controller_protocol !== CONTROLLER_PROTOCOL) errors.push("controller-protocol-mismatch");
  if (receipt.sdk_version !== sdkVersion) errors.push("sdk-version-mismatch");
  if (receipt.platform !== currentPlatform()) errors.push("platform-mismatch");
  if (receipt.node_version !== process.version) errors.push("node-version-mismatch");
  if (receipt.os_version !== `${osPlatform()}-${osRelease()}`) errors.push("os-version-mismatch");
  const issued = Date.parse(receipt.issued_at);
  const expires = Date.parse(receipt.expires_at);
  const maximumValidity = CAPABILITY_RECEIPT_VALIDITY_DAYS * 24 * 60 * 60 * 1e3;
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > maximumValidity) errors.push("receipt-validity-invalid");
  else if (now < issued || now >= expires) errors.push("receipt-expired-or-not-yet-valid");
  if (typeof receipt.marketplace_git_commit !== "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(receipt.marketplace_git_commit)) errors.push("marketplace_git_commit-invalid");
  for (const field of ["plugin_hash", "worker_hash", "runtime_hash", "lockfile_hash", "attested_route_pool_hash", "model_catalog_hash", "planning_harness_hash", "cursor_harness_hash", "verification_profile_hash"]) {
    if (!hashString(receipt[field])) errors.push(`${field}-invalid`);
  }
  if (typeof receipt.cursor_version !== "string" || receipt.cursor_version.length === 0) errors.push("cursor-version-missing");
  if (!exactFields(receipt.model_attestation, /* @__PURE__ */ new Set(["requested", "accepted", "observed", "request_ids", "agent_ids", "run_ids"]))) errors.push("model-attestation-shape-invalid");
  else {
    for (const field of ["requested", "accepted", "observed"]) if (!Array.isArray(receipt.model_attestation[field]) || !receipt.model_attestation[field].every(modelConfiguration)) errors.push(`model-attestation-${field}-invalid`);
    for (const field of ["request_ids", "agent_ids", "run_ids"]) if (!Array.isArray(receipt.model_attestation[field]) || receipt.model_attestation[field].length === 0 || !receipt.model_attestation[field].every((id) => typeof id === "string" && id.length > 0)) errors.push(`model-attestation-${field}-invalid`);
    const modelCount = receipt.model_attestation.requested?.length ?? 0;
    if (receipt.model_attestation.accepted?.length !== modelCount || receipt.model_attestation.observed?.length !== modelCount || receipt.model_attestation.request_ids?.length !== modelCount || receipt.model_attestation.agent_ids?.length !== modelCount || receipt.model_attestation.run_ids?.length !== modelCount) errors.push("model-attestation-cardinality-mismatch");
    for (const role of ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"]) {
      if ((receipt.model_attestation.requested ?? []).filter((model) => model.role === role).length < 1) errors.push(`model-attestation-${role}-missing`);
    }
  }
  if (!Array.isArray(receipt.certified_models) || receipt.certified_models.length === 0 || !receipt.certified_models.every(modelConfiguration)) errors.push("certified-models-invalid");
  const auditFields = /* @__PURE__ */ new Set(["lockfile_hash", "evidence_hash", "production_packages", "high", "critical", "moderate", "risk_acceptance_hash"]);
  if (!exactFields(receipt.audit, auditFields)) errors.push("audit-shape-invalid");
  else {
    if (!hashString(receipt.audit.lockfile_hash) || !hashString(receipt.audit.evidence_hash)) errors.push("audit-hash-invalid");
    for (const field of ["production_packages", "high", "critical", "moderate"]) if (!Number.isInteger(receipt.audit[field]) || receipt.audit[field] < 0) errors.push(`audit-${field}-invalid`);
    if (receipt.audit.risk_acceptance_hash !== null && !hashString(receipt.audit.risk_acceptance_hash)) errors.push("audit-risk-acceptance-invalid");
    if (receipt.audit.lockfile_hash !== receipt.lockfile_hash) errors.push("audit-lockfile-mismatch");
  }
  if (!exactFields(receipt.observations, new Set(REQUIRED_OBSERVATIONS))) errors.push("observations-shape-invalid");
  else for (const key of REQUIRED_OBSERVATIONS) {
    const observation = receipt.observations[key];
    if (!exactFields(observation, /* @__PURE__ */ new Set(["verified", "repetitions", "evidence_hash"]))) errors.push(`observation-${key}-shape-invalid`);
    else if (typeof observation.verified !== "boolean" || !Number.isInteger(observation.repetitions) || observation.repetitions < 0 || !hashString(observation.evidence_hash)) errors.push(`observation-${key}-invalid`);
  }
  if (!plainObject(receipt.evidence_hashes) || Object.keys(receipt.evidence_hashes).length === 0 || !Object.values(receipt.evidence_hashes).every(hashString)) errors.push("evidence-hashes-invalid");
  const vectorFields = /* @__PURE__ */ new Set(["write_boundary", "network_isolation", "secret_isolation", "budget_cancel", "planning", "verification_profile", "route_pool"]);
  if (!exactFields(receipt.capability_vector, vectorFields) || Object.values(receipt.capability_vector ?? {}).some((value) => typeof value !== "boolean")) errors.push("capability-vector-invalid");
  if (!Array.isArray(receipt.qualification_bindings)) errors.push("qualification-bindings-invalid");
  else for (const binding of receipt.qualification_bindings) {
    if (!exactFields(binding, /* @__PURE__ */ new Set(["task_class", "verification_profile_hash", "route_pool_hash", "certified_region"]))) errors.push("qualification-binding-shape-invalid");
    else if (!["bugfix", "refactor", "performance", "feature", "investigation", "verify-existing"].includes(binding.task_class) || !hashString(binding.verification_profile_hash) || !hashString(binding.route_pool_hash) || typeof binding.certified_region !== "string" || binding.certified_region === "") errors.push("qualification-binding-invalid");
  }
  const derivedProfiles = receiptProfileEligibility(receipt);
  if (!exactFields(receipt.profile_eligibility, /* @__PURE__ */ new Set(["supervised", "autonomous"])) || receipt.profile_eligibility.supervised !== derivedProfiles.supervised || receipt.profile_eligibility.autonomous !== derivedProfiles.autonomous) errors.push("profile-eligibility-not-derived");
  for (const [field, value] of Object.entries(expected)) if (value !== void 0 && receipt[field] !== value) errors.push(`${field}-mismatch`);
  const derivedSafe = receiptAutomationSafe(receipt);
  if (receipt.automation_safe !== derivedSafe) errors.push("automation-safe-not-derived");
  return { valid: errors.length === 0, errors, derived_safe: derivedSafe, profile_eligibility: derivedProfiles };
}
function capabilityReceiptPath(stateRoot) {
  return join(stateRoot, "capability-receipt.json");
}
function writeCapabilityReceipt(stateRoot, receipt, expected = {}) {
  const validation = validateCapabilityReceipt(receipt, expected);
  if (!validation.valid) throw new Error(`capability receipt denied: ${validation.errors.join(", ")}`);
  const path = capabilityReceiptPath(stateRoot);
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}
`, { mode: 384 });
  renameSync(temporary, path);
  return path;
}
function loadCapabilityReceipt(stateRoot, expected = {}) {
  const path = capabilityReceiptPath(stateRoot);
  if (!existsSync(path)) return null;
  try {
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    return validateCapabilityReceipt(receipt, expected).valid ? receipt : null;
  } catch {
    return null;
  }
}
function resolveCapabilities(stateRoot, additions = {}, context = {}) {
  const outer = probeSandboxBoundary();
  const runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion });
  const pluginHash = context.pluginRoot ? hashPluginTree(context.pluginRoot) : void 0;
  const runtime = loadWorkerRuntimeManifest(runtimeDirectory, { plugin_version: PLUGIN_VERSION, sdk_version: sdkVersion, platform: currentPlatform(), ...pluginHash ? { plugin_hash: pluginHash } : {} });
  const expected = {
    ...pluginHash ? { plugin_hash: pluginHash } : {},
    ...runtime.valid ? {
      marketplace_git_commit: runtime.manifest.marketplace_git_commit,
      worker_hash: runtime.manifest.worker_hash,
      runtime_hash: runtime.manifest.runtime_hash,
      lockfile_hash: runtime.manifest.lockfile_hash
    } : {},
    ...additions.expected_route_hash ? { attested_route_pool_hash: additions.expected_route_hash } : {},
    ...additions.expected_planning_harness_hash ? { planning_harness_hash: additions.expected_planning_harness_hash } : {}
  };
  const cursorVersion = context.cursorVersion ?? process.env.GELDMACHER_WORKFLOW_CURSOR_VERSION ?? process.env.CURSOR_VERSION;
  if (cursorVersion) expected.cursor_version = cursorVersion;
  const receipt = runtime.valid && cursorVersion ? loadCapabilityReceipt(stateRoot, expected) : null;
  const output = {
    outer_sandbox_available: outer.available,
    outer_sandbox_verified: outer.verified,
    worker_runtime_provisioned: runtime.valid,
    worker_runtime_reason: runtime.reason,
    cursor_version_attested: Boolean(cursorVersion),
    sdk_write_boundary_verified: receipt?.observations.sdk_write_boundary.verified === true,
    worker_network_isolated: receipt?.observations.worker_network_isolated.verified === true,
    sdk_secret_isolated: receipt?.observations.sdk_secret_isolated.verified === true,
    sdk_budget_cancel_verified: receipt?.observations.sdk_budget_cancel.verified === true,
    planner_submission_verified: receipt?.observations.planner_submission.verified === true,
    restart_resume_verified: receipt?.observations.restart_resume.verified === true,
    marketplace_mcp_verified: receipt?.observations.marketplace_mcp.verified === true,
    marketplace_worker_runtime_verified: receipt?.observations.marketplace_worker_runtime.verified === true,
    attested_route_hash: receipt?.attested_route_pool_hash ?? null,
    certified_harness_hash: receipt?.planning_harness_hash ?? null,
    sandbox_boundary_verified: outer.verified === true && receipt?.observations.sdk_write_boundary.verified === true,
    capability_receipt: receipt,
    route_pool_certified: receipt?.profile_eligibility?.supervised === true,
    verification_profile_certified: receipt?.capability_vector?.verification_profile === true,
    verification_profile_hash: receipt?.verification_profile_hash ?? null,
    qualification_bindings: receipt?.qualification_bindings ?? [],
    certified_models: receipt?.certified_models ?? [],
    profile_eligibility: receipt?.profile_eligibility ?? { supervised: false, autonomous: false },
    automation_safe: receipt?.profile_eligibility?.autonomous === true && runtime.valid
  };
  for (const [key, value] of Object.entries(additions)) if (!key.startsWith("expected_")) output[key] = value;
  return output;
}

// src/controller/planning.mjs
import { createHash } from "node:crypto";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2, resolve } from "node:path";

// src/worker/planning-output.mjs
function validateIntentBlockerReport(value) {
  const questions = value?.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) throw new Error("intent blocker report requires one to three questions");
  const normalized = questions.map((question, index) => {
    if (typeof question !== "string" || question.trim().length < 8) throw new Error(`intent blocker question ${index + 1} is not concrete`);
    return question.trim();
  });
  return {
    questions: normalized,
    rationale: typeof value.rationale === "string" && value.rationale.trim() ? value.rationale.trim() : null
  };
}

// src/controller/planning.mjs
var profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 });
var harnessFiles = Object.freeze([
  "skills/work-planning/SKILL.md",
  "references/artifact-protocol.md",
  "references/plan-container-contract.md",
  "references/executable-contract.md",
  "references/design-contract.md",
  "references/automation-preparation-contract.md",
  "schemas/artifacts/work-plan.schema.json",
  "schemas/cursor-plan-wrapper.schema.json"
]);
function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(stable(value))).digest("hex");
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function canonicalText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
function section(artifact, name) {
  return canonicalText(artifact?.sections?.get(name));
}
function rootProjection(rootPlanText, pluginRoot) {
  const inspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspection.errors.length > 0 || inspection.artifact?.fields?.artifact !== "work-plan") throw new Error(`invalid root plan: ${inspection.errors.join("; ") || "input is not a work-plan"}`);
  const artifact = inspection.artifact;
  const fields = artifact.fields;
  return {
    intent: stable({ id: fields.id, status: fields.status, intent_ready: fields.intent_ready, goal: fields.goal, acceptance: fields.acceptance, non_goals: fields.non_goals, constraints: fields.constraints, content: section(artifact, "Intent") }),
    lineage: stable({ predecessor_plan_id: fields.predecessor_plan_id ?? null, replan_source_review_id: fields.replan_source_review_id ?? null }),
    authority: stable(fields.authority),
    profile: stable({ profile_max: fields.profile_max, contract_level: fields.contract_level }),
    risk: stable({ risk: fields.risk, hard_triggers: fields.hard_triggers, content: section(artifact, "Risks") }),
    certification: stable(fields.certification ?? null)
  };
}
function semanticRootDiff(beforeText, afterText, pluginRoot) {
  if (!beforeText) return null;
  const before = rootProjection(beforeText, pluginRoot);
  const after = rootProjection(afterText, pluginRoot);
  const categories = Object.keys(before).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return {
    changed: hash(beforeText) !== hash(afterText),
    categories,
    before_root_hash: hash(beforeText),
    after_root_hash: hash(afterText)
  };
}
function normalizeRootArtifacts(rootArtifacts) {
  if (rootArtifacts === void 0 || rootArtifacts === null) return [];
  if (!Array.isArray(rootArtifacts) || rootArtifacts.length > 32) throw new Error("workflow_prepare root_artifacts must contain at most 32 artifacts");
  const normalized = rootArtifacts.map((entry, index) => {
    if (!entry || typeof entry.label !== "string" || entry.label.trim() === "" || typeof entry.text !== "string" || entry.text.trim() === "") {
      throw new Error(`workflow_prepare root_artifact ${index + 1} requires non-empty label and text`);
    }
    return { label: entry.label, text: entry.text };
  });
  if (new Set(normalized.map((entry) => entry.label)).size !== normalized.length) throw new Error("workflow_prepare root_artifact labels must be unique");
  if (normalized.reduce((total, entry) => total + entry.text.length, 0) > 1e6) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
  return normalized.sort((left, right) => left.label.localeCompare(right.label) || hash(left.text).localeCompare(hash(right.text)));
}
function validateRootPlanLineage(rootPlanText, rootArtifacts, pluginRoot) {
  const contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0) return { errors: contract.errors, artifacts: [], artifact_set_hash: null };
  let artifacts;
  try {
    artifacts = normalizeRootArtifacts(rootArtifacts);
  } catch (error) {
    return { errors: [error.message], artifacts: [], artifact_set_hash: null };
  }
  const hasLineage = Boolean(contract.fields.predecessor_plan_id || contract.fields.replan_source_review_id);
  if (!hasLineage) {
    return artifacts.length > 0 ? { errors: ["initial root_plan cannot include root_artifacts"], artifacts, artifact_set_hash: hash(artifacts) } : { errors: [], artifacts, artifact_set_hash: hash(artifacts) };
  }
  if (artifacts.length === 0) return { errors: ["replan root_plan requires its complete current lineage artifacts"], artifacts, artifact_set_hash: hash(artifacts) };
  const inspection = inspectArtifactSet([
    ...artifacts.map((entry) => [entry.label, entry.text]),
    ["workflow-prepare-root", rootPlanText]
  ], pluginRoot);
  const summary = effectiveCliSummary(inspection);
  const errors = [...inspection.errors];
  if (summary.root_tips.length !== 1 || summary.root_tips[0] !== contract.fields.id) errors.push("replan root_plan must be the unique active lineage tip");
  return { errors: [...new Set(errors)], artifacts, artifact_set_hash: hash(artifacts) };
}
function plannerReceiptBlockers(receipt) {
  const blockers = [];
  if (!receipt?.model_attested || receipt?.remap === true) blockers.push("planner-model-mismatch");
  if (typeof receipt?.request_id !== "string" || receipt.request_id === "") blockers.push("planner-request-id-missing");
  if (typeof receipt?.agent_id !== "string" || receipt.agent_id === "") blockers.push("planner-agent-id-missing");
  if (typeof receipt?.sdk_version !== "string" || receipt.sdk_version === "") blockers.push("planner-sdk-version-missing");
  if (typeof receipt?.configuration_hash !== "string" || receipt.configuration_hash === "") blockers.push("planner-route-hash-missing");
  if (receipt?.route_hash !== receipt?.configuration_hash) blockers.push("planner-route-hash-mismatch");
  if (typeof receipt?.harness_hash !== "string" || receipt.harness_hash === "") blockers.push("planner-harness-hash-missing");
  if (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) blockers.push("planner-duration-missing");
  if (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) blockers.push("planner-token-usage-missing");
  if (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) blockers.push("planner-cost-missing");
  return blockers;
}
function expectedPlannerReceiptBlockers(receipt, preparation, acceptedModel) {
  const selected = preparation.route_validation.routes?.planner?.selected_candidate;
  const expectedRequested = { id: selected?.model_id, reasoning_effort: selected?.reasoning_effort, model_options: selected?.model_options ?? {} };
  const blockers = [];
  if (JSON.stringify(stable(receipt?.requested_model)) !== JSON.stringify(stable(expectedRequested))) blockers.push("planner-requested-model-mismatch");
  if (JSON.stringify(stable(receipt?.accepted_model)) !== JSON.stringify(stable(acceptedModel))) blockers.push("planner-accepted-model-mismatch");
  if (receipt?.configuration_hash !== preparation.route_hash || receipt?.route_hash !== preparation.route_hash) blockers.push("planner-route-hash-mismatch");
  if (receipt?.harness_hash !== preparation.harness_hash) blockers.push("planner-harness-hash-mismatch");
  if (receipt?.artifact_projection_hash !== preparation.input_root_authoritative_projection_hash) blockers.push("planner-artifact-projection-mismatch");
  if (preparation.route_validation.sdk_version && receipt?.sdk_version !== preparation.route_validation.sdk_version) blockers.push("planner-sdk-version-mismatch");
  return blockers;
}
function planningUsage(receipts, createdAt) {
  return {
    total_tokens: receipts.reduce((sum, receipt) => sum + (receipt.usage?.totalTokens ?? 0), 0),
    cost_usd: receipts.reduce((sum, receipt) => sum + (receipt.cost_usd ?? 0), 0),
    active_minutes: Math.max(
      receipts.reduce((sum, receipt) => sum + (receipt.duration_ms ?? 0), 0) / 6e4,
      (Date.now() - Date.parse(createdAt)) / 6e4
    )
  };
}
function planningBudgetBlockers(usage, budget) {
  const blockers = [];
  if (usage.active_minutes > budget.max_active_minutes) blockers.push("planning-time-budget-exhausted");
  if (usage.total_tokens > budget.max_total_tokens) blockers.push("planning-token-budget-exhausted");
  if (usage.cost_usd > budget.max_cost_usd) blockers.push("planning-cost-budget-exhausted");
  return blockers;
}
function loadPlanningHarness(pluginRoot) {
  const sources = harnessFiles.map((path) => {
    const absolute = join2(pluginRoot, path);
    if (!existsSync2(absolute)) throw new Error(`planning harness file is missing: ${path}`);
    return { path, content: readFileSync2(absolute, "utf8") };
  });
  return { sources, hash: hash(sources) };
}
function planningPrompt(preparation, harness) {
  const source = preparation.source_kind === "goal" ? `GOAL
${preparation.goal}` : `EXISTING VALID SCHEMA-5 INTENT ROOT AUTHORITATIVE PROJECTION
${preparation.input_root_contract.authoritative_projection_text}`;
  return [
    "Act as the configured Workflow planner in read-only Cursor Plan mode.",
    "Inspect the repository, but do not modify it or cause any external effect.",
    "If one or more material product decisions remain open, call report_intent_blockers exactly once with at most three concrete questions, do not call CreatePlan, and stop.",
    "Otherwise call Cursor CreatePlan exactly once. Its plan argument must be one complete, ready, native schema-5 Workflow intent root satisfying the harness below.",
    "For an existing valid root, retain it unchanged when already adequate or propose a complete improved root. Never imply that an improvement is already approved.",
    `REQUESTED AUTO PROFILE
${preparation.requested_profile}`,
    `REPOSITORY BASELINE
${JSON.stringify(preparation.baseline, null, 2)}`,
    `NORMALIZED PROJECT AUTOMATION POLICY
${JSON.stringify(preparation.project_policy, null, 2)}`,
    source,
    `VERSIONED PLANNING HARNESS (${preparation.harness_hash})
${harness.sources.map(({ path, content }) => `--- ${path} ---
${content}`).join("\n\n")}`
  ].join("\n\n");
}
function normalizePlannerRootOutput(rootPlanText, preparation) {
  try {
    const opaque = preparation.source_kind === "root-plan" ? opaqueExtensionsFromArtifactText(preparation.input_root_text) : { present: false, value: null };
    return replaceOpaqueExtensions(rootPlanText, opaque);
  } catch {
    return rootPlanText;
  }
}
function repairPrompt(errors, repairsRemaining) {
  return [
    "The preceding CreatePlan output failed deterministic schema-5 validation.",
    "This is a technical contract repair only. Preserve the established product intent and use the same planner model and agent context.",
    `Call CreatePlan exactly once with a complete corrected root. Do not call report_intent_blockers unless a genuinely material product decision is now discovered. Repairs remaining after this turn: ${repairsRemaining}.`,
    `VALIDATOR ERRORS
${errors.map((error) => `- ${error}`).join("\n")}`
  ].join("\n\n");
}
function maximumProfileAllows(requested, maximum) {
  return (profileRank[requested] ?? 99) <= (profileRank[maximum] ?? -1);
}
function preparationRequestHash({ goal, rootPlan, rootArtifactsHash, requestedProfile, routeProfile }) {
  return hash({
    source_kind: goal ? "goal" : "root-plan",
    goal: goal ?? null,
    input_root_hash: rootPlan ? hash(rootPlan) : null,
    input_root_lineage_hash: rootArtifactsHash ?? null,
    requested_profile: requestedProfile,
    route_profile: routeProfile
  });
}
var PlanningEngine = class {
  constructor({ workspaceRoot, store, pluginRoot, stateRoot, adapterFactory, capabilitiesFactory } = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.store = store;
    this.pluginRoot = resolve(pluginRoot);
    this.stateRoot = resolve(stateRoot);
    this.adapterFactory = adapterFactory ?? ((preparation) => new CursorWorkerAdapter({ runDirectory: this.store.preparationDirectory(preparation.preparation_id), pluginRoot: this.pluginRoot }));
    this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }
  prepare({ goal, rootPlan, rootArtifacts, requestedProfile, routeProfile = "default", idempotencyKey }) {
    if (Boolean(goal) === Boolean(rootPlan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (!["supervised", "autonomous"].includes(requestedProfile)) throw new Error("workflow_prepare supports supervised or autonomous");
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) throw new Error("workflow_prepare requires an idempotency key");
    let inputContract = null;
    let inputLineage = { errors: [], artifacts: [], artifact_set_hash: hash([]) };
    if (rootPlan) {
      inputContract = executionContractFromArtifactText(rootPlan, this.pluginRoot);
      if (inputContract.errors.length > 0) throw new Error(`invalid input root plan: ${inputContract.errors.join("; ")}`);
      inputLineage = validateRootPlanLineage(rootPlan, rootArtifacts, this.pluginRoot);
      if (inputLineage.errors.length > 0) throw new Error(`invalid input root lineage: ${inputLineage.errors.join("; ")}`);
    } else if (rootArtifacts !== void 0) {
      throw new Error("workflow_prepare root_artifacts require root_plan");
    }
    const requestHash = preparationRequestHash({ goal, rootPlan, rootArtifactsHash: inputLineage.artifact_set_hash, requestedProfile, routeProfile });
    const duplicate = this.store.list().find((preparation2) => preparation2.preparation_idempotency_key === idempotencyKey);
    if (duplicate) {
      assertCompatiblePreparation(duplicate);
      if (duplicate.preparation_request_hash !== requestHash) throw new Error("preparation idempotency conflict: key is bound to another request");
      return { preparation: duplicate, duplicate: true };
    }
    const config = loadWorkflowConfig(this.workspaceRoot);
    if (config.errors.length > 0) throw new Error(`workflow_prepare configuration invalid: ${config.errors.join("; ")}`);
    const route = resolveRouteProfile(config, routeProfile);
    const budget = structuredClone(config.user.planning_preflight_budget);
    const baseline = repositoryBaseline(this.workspaceRoot);
    const harness = loadPlanningHarness(this.pluginRoot);
    const routeHash = hash(route);
    const policyHash = hash(config.project);
    const configHash = hash({ route_profile: routeProfile, route, planning_preflight_budget: budget });
    const capabilities = this.capabilitiesFactory({ expected_route_hash: routeHash, expected_planning_harness_hash: harness.hash });
    let routeValidation;
    try {
      routeValidation = this.adapterFactory({ preparation_id: "preflight" }).validateProfile(route);
    } catch (error) {
      routeValidation = { verified: false, errors: [error.message] };
    }
    const technicalBlockers = [
      ...routeValidation.errors ?? [],
      ...routeValidation.verified !== true ? ["model-catalog-not-verified"] : [],
      ...!config.project.supervised_enabled ? ["project-supervised-disabled"] : [],
      ...!capabilities.sandbox_boundary_verified ? ["hard-sandbox-not-verified"] : [],
      ...!capabilities.worker_network_isolated ? ["worker-network-boundary-not-verified"] : [],
      ...!capabilities.sdk_secret_isolated ? ["sdk-secret-boundary-not-verified"] : [],
      ...!capabilities.sdk_budget_cancel_verified ? ["sdk-budget-cancel-not-verified"] : [],
      ...!capabilities.planner_submission_verified ? ["planner-submission-not-verified"] : []
    ];
    const now = Date.now();
    const preparation = this.store.create({
      status: technicalBlockers.length > 0 || routeValidation.verified !== true ? "failed" : "planning",
      source_kind: goal ? "goal" : "root-plan",
      goal: goal ?? null,
      input_root_text: rootPlan ?? null,
      input_root_hash: rootPlan ? hash(rootPlan) : null,
      input_root_contract: inputContract,
      input_root_authoritative_projection_hash: inputContract?.authoritative_projection_hash ?? null,
      input_root_lineage_artifacts: inputLineage.artifacts,
      input_root_lineage_hash: inputLineage.artifact_set_hash,
      requested_profile: requestedProfile,
      route_profile: routeProfile,
      route_config: route,
      route_hash: routeHash,
      config_hash: configHash,
      policy_hash: policyHash,
      harness_hash: harness.hash,
      baseline,
      project_policy: config.project,
      planning_budget: budget,
      route_validation: routeValidation,
      capabilities,
      preparation_idempotency_key: idempotencyKey,
      preparation_request_hash: requestHash,
      planner_agent_id: null,
      planner_receipts: [],
      usage: { total_tokens: 0, cost_usd: 0, active_minutes: 0 },
      root_plan_text: null,
      root_plan_hash: null,
      root_authoritative_projection_hash: null,
      semantic_diff: null,
      manual_questions: [],
      blockers: [...new Set(technicalBlockers)],
      runner_pid: null,
      expires_at: new Date(now + budget.max_active_minutes * 6e4).toISOString(),
      consumed_by_run_id: null
    });
    return { preparation, duplicate: false };
  }
  execute(preparationId) {
    let preparation = this.store.get(preparationId);
    assertCompatiblePreparation(preparation);
    if (preparation.status !== "planning") throw new Error(`preparation is not planning: ${preparation.status}`);
    if (Date.parse(preparation.expires_at) <= Date.now()) return this.finish(preparation, "expired", ["preparation-expired"]);
    const harness = loadPlanningHarness(this.pluginRoot);
    if (harness.hash !== preparation.harness_hash) return this.finish(preparation, "failed", ["planning-harness-drift"]);
    const adapter = this.adapterFactory(preparation);
    const acceptedModel = preparation.route_validation.routes?.planner?.model;
    if (!acceptedModel) return this.finish(preparation, "failed", ["planner-route-not-validated"]);
    let prompt = planningPrompt(preparation, harness);
    let agentId = preparation.planner_agent_id;
    let repairs = 0;
    while (true) {
      const beforeUsage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at);
      const beforeBudgetBlockers = planningBudgetBlockers(beforeUsage, preparation.planning_budget);
      if (beforeBudgetBlockers.length > 0) return this.finish(preparation, "failed", beforeBudgetBlockers, beforeUsage);
      const remainingMs = Math.max(1, Date.parse(preparation.expires_at) - Date.now());
      const phase = adapter.runPlanningPhase({
        route: preparation.route_validation.routes.planner.selected_candidate,
        routePoolHash: preparation.route_validation.routes.planner.pool_hash,
        selectionReason: preparation.route_validation.routes.planner.selection_reason,
        acceptedModel,
        prompt,
        cwd: this.workspaceRoot,
        agentId,
        timeoutMs: remainingMs,
        configurationHash: preparation.route_hash,
        harnessHash: preparation.harness_hash,
        artifactProjectionHash: preparation.input_root_authoritative_projection_hash,
        deniedReadPaths: [
          join2(this.workspaceRoot, ".git"),
          join2(this.workspaceRoot, ".cursor", "workflow-policy.yaml"),
          ...preparation.project_policy.protected_paths.map((path) => join2(this.workspaceRoot, path))
        ]
      });
      agentId = phase.receipt.agent_id ?? agentId;
      const receipts = [...preparation.planner_receipts ?? [], phase.receipt];
      const usage = planningUsage(receipts, preparation.created_at);
      const controlled = this.store.get(preparation.preparation_id);
      if (controlled.status !== "planning") {
        return this.store.update(controlled.preparation_id, controlled.revision, null, (draft) => ({
          ...draft,
          planner_agent_id: agentId,
          planner_receipts: [...draft.planner_receipts ?? [], phase.receipt],
          usage: planningUsage([...draft.planner_receipts ?? [], phase.receipt], draft.created_at),
          runner_pid: null
        }), "planner-cancel-receipt-recorded");
      }
      preparation = this.update(preparation, (draft) => ({ ...draft, planner_agent_id: agentId, planner_receipts: receipts, usage }), "planner-turn-finished");
      if (phase.response.status === "interrupted") return this.update(preparation, (draft) => ({ ...draft, status: "interrupted", blockers: ["planner-hard-cancelled"], runner_pid: null }), "planner-interrupted");
      const blockers = [
        ...plannerReceiptBlockers(phase.receipt),
        ...expectedPlannerReceiptBlockers(phase.receipt, preparation, acceptedModel),
        ...planningBudgetBlockers(usage, preparation.planning_budget),
        ...!phase.response.ok ? [phase.response.error?.message ?? "planner-failed"] : []
      ];
      if (blockers.length > 0) return this.finish(preparation, "failed", blockers, usage);
      if (phase.planningOutput?.kind === "manual-planning-required") {
        let report;
        try {
          report = validateIntentBlockerReport(phase.planningOutput);
        } catch (error) {
          return this.finish(preparation, "failed", [`planner-intent-blocker-invalid:${error.message}`], usage);
        }
        return this.update(preparation, (draft) => ({
          ...draft,
          status: "manual-planning-required",
          root_plan_text: null,
          root_plan_hash: null,
          root_authoritative_projection_hash: null,
          semantic_diff: null,
          manual_questions: report.questions,
          blockers: report.rationale ? [report.rationale] : [],
          runner_pid: null
        }), "manual-planning-required");
      }
      if (phase.planningOutput?.kind !== "root") return this.finish(preparation, "failed", ["planner-output-contract-violated"], usage);
      const rootPlanText = normalizePlannerRootOutput(phase.planningOutput.root_plan_text, preparation);
      const contract = executionContractFromArtifactText(rootPlanText, this.pluginRoot);
      const validationErrors = [...contract.errors];
      if (validationErrors.length === 0) {
        const preflight = preflightRootPlan(rootPlanText, this.pluginRoot);
        validationErrors.push(...preflight.blocking_issues.map((entry) => `${entry.code}: ${entry.message}`));
      }
      if (validationErrors.length === 0) validationErrors.push(...validateRootPlanLineage(rootPlanText, preparation.input_root_lineage_artifacts, this.pluginRoot).errors);
      if (validationErrors.length === 0 && preparation.input_root_contract && (contract.fields.predecessor_plan_id ?? null) !== (preparation.input_root_contract.fields.predecessor_plan_id ?? null)) validationErrors.push("root plan predecessor_plan_id must remain unchanged");
      if (validationErrors.length === 0 && preparation.input_root_contract && (contract.fields.replan_source_review_id ?? null) !== (preparation.input_root_contract.fields.replan_source_review_id ?? null)) validationErrors.push("root plan replan_source_review_id must remain unchanged");
      if (validationErrors.length === 0 && (contract.fields.status !== "ready" || contract.fields.intent_ready !== true)) validationErrors.push("root plan must be ready with intent_ready true");
      if (validationErrors.length === 0 && !maximumProfileAllows(preparation.requested_profile, contract.fields.profile_max)) validationErrors.push(`root plan permits at most ${contract.fields.profile_max}`);
      if (validationErrors.length === 0) {
        const semanticDiff = semanticRootDiff(preparation.input_root_text, rootPlanText, this.pluginRoot);
        return this.update(preparation, (draft) => ({
          ...draft,
          status: "root-ready",
          root_plan_text: rootPlanText,
          root_plan_hash: hash(rootPlanText),
          root_authoritative_projection_hash: contract.authoritative_projection_hash,
          root_plan_contract: contract,
          planner_receipts: draft.planner_receipts.map((receipt, index, receipts2) => index === receipts2.length - 1 ? { ...receipt, produced_artifact_projection_hash: contract.authoritative_projection_hash } : receipt),
          semantic_diff: semanticDiff,
          manual_questions: [],
          blockers: [],
          runner_pid: null
        }), "root-ready");
      }
      if (repairs >= preparation.planning_budget.max_validation_repairs) return this.finish(preparation, "failed", validationErrors.map((error) => `root-validation:${error}`), usage);
      repairs += 1;
      prompt = repairPrompt(validationErrors, preparation.planning_budget.max_validation_repairs - repairs);
    }
  }
  update(preparation, mutator, eventType) {
    return this.store.update(preparation.preparation_id, preparation.revision, null, mutator, eventType);
  }
  finish(preparation, status, blockers, usage = preparation.usage) {
    return this.update(preparation, (draft) => ({
      ...draft,
      status,
      usage,
      root_plan_text: null,
      root_plan_hash: null,
      root_authoritative_projection_hash: null,
      root_plan_contract: null,
      semantic_diff: null,
      manual_questions: [],
      blockers: [...new Set(blockers.filter(Boolean))],
      runner_pid: null
    }), `preparation-${status}`);
  }
};
function planningHarnessHash(pluginRoot) {
  return loadPlanningHarness(resolve(pluginRoot)).hash;
}
function configurationHashes(workspaceRoot, routeProfile = "default") {
  const config = loadWorkflowConfig(workspaceRoot);
  if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
  const route = resolveRouteProfile(config, routeProfile);
  return {
    route_hash: hash(route),
    config_hash: hash({ route_profile: routeProfile, route, planning_preflight_budget: config.user.planning_preflight_budget }),
    policy_hash: hash(config.project)
  };
}

// src/controller/verification-profile.mjs
var import_ajv = __toESM(require_ajv(), 1);
var import_yaml = __toESM(require_dist(), 1);
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, isAbsolute, join as join3, normalize, resolve as resolve2, sep } from "node:path";
var VERIFICATION_CAPABILITIES = Object.freeze(["launch", "doctor", "drive", "observe", "evidence", "reset", "cleanup"]);
function draftVerificationProfile(workspaceRoot, surface, pluginRoot, manifestPath = ".cursor/workflow-verification.yaml") {
  const workspace = resolve2(workspaceRoot);
  const slug = String(surface ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("verification draft requires a concrete surface");
  if (!safeRelative(manifestPath)) throw new Error("verification manifest path must be repository-relative");
  const skillPath = `.cursor/skills/workflow-verification-${slug}/SKILL.md`;
  const featureMapPath = `.cursor/workflow-verification-${slug}-features.yaml`;
  const files = [manifestPath, skillPath, featureMapPath];
  const existing = files.filter((path) => existsSync3(join3(workspace, path)));
  if (existing.length > 0) throw new Error(`verification draft refuses to overwrite: ${existing.join(", ")}`);
  const manifest = [
    "schema: 1",
    `profile_id: verify-${slug}`,
    "version: draft-1",
    `skill_path: ${skillPath}`,
    `feature_map_path: ${featureMapPath}`,
    "capabilities:",
    ...VERIFICATION_CAPABILITIES.map((capability) => `  - ${capability}`),
    "artifact_policy: external-only",
    ""
  ].join("\n");
  const skill = [
    "---",
    `name: workflow-verification-${slug}`,
    `description: Verify the ${surface} surface without modifying repository files.`,
    "---",
    "",
    `# ${surface} verification`,
    "",
    "Implement launch, doctor, drive, observe, evidence, reset, and cleanup for this repository surface.",
    "Repository content is read-only. Write screenshots, traces, logs, and other proof only to the controller-provided external artifact directory.",
    "Every action must be deterministic, repeatable, and safe to reset and clean up.",
    ""
  ].join("\n");
  const featureMap = [
    "schema: 1",
    `surface: ${JSON.stringify(surface)}`,
    "features:",
    `  - feature_id: ${slug}-representative`,
    "    description: Replace with one representative end-to-end feature path.",
    "    expected: Replace with an observable expected result.",
    ""
  ].join("\n");
  for (const [path, content] of [[manifestPath, manifest], [skillPath, skill], [featureMapPath, featureMap]]) {
    const absolute = join3(workspace, path);
    mkdirSync2(dirname2(absolute), { recursive: true, mode: 448 });
    writeFileSync2(absolute, content, { flag: "wx", mode: 384 });
  }
  return { created: files, inspection: inspectVerificationProfile(workspace, manifestPath, pluginRoot) };
}
function stable2(value) {
  if (Array.isArray(value)) return value.map(stable2);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable2(value[key])]));
}
function hash2(value) {
  return createHash2("sha256").update(typeof value === "string" ? value : JSON.stringify(stable2(value))).digest("hex");
}
function safeRelative(path) {
  const value = normalize(String(path));
  return Boolean(path) && !isAbsolute(String(path)) && value !== ".." && !value.startsWith(`..${sep}`);
}
function inspectVerificationProfile(workspaceRoot, manifestPath = ".cursor/workflow-verification.yaml", pluginRoot) {
  const workspace = resolve2(workspaceRoot);
  if (!safeRelative(manifestPath)) return { valid: false, errors: ["verification manifest path must be repository-relative"] };
  const absolute = join3(workspace, manifestPath);
  if (!existsSync3(absolute)) return { valid: false, errors: [`verification manifest is missing: ${manifestPath}`] };
  let manifest;
  try {
    manifest = (0, import_yaml.parse)(readFileSync3(absolute, "utf8"));
  } catch (error) {
    return { valid: false, errors: [`verification manifest YAML is invalid: ${error.message}`] };
  }
  const schema = JSON.parse(readFileSync3(join3(pluginRoot, "schemas", "verification-profile.schema.json"), "utf8"));
  const validate = new import_ajv.default({ allErrors: true, strict: false }).compile(schema);
  const errors = validate(manifest) ? [] : validate.errors.map((error) => `${error.instancePath || "/"}: ${error.message}`);
  for (const field of ["skill_path", "feature_map_path"]) {
    if (!safeRelative(manifest?.[field])) errors.push(`${field} must be repository-relative`);
    else if (!existsSync3(join3(workspace, manifest[field]))) errors.push(`${field} does not exist: ${manifest[field]}`);
  }
  for (const capability of VERIFICATION_CAPABILITIES) if (!(manifest?.capabilities ?? []).includes(capability)) errors.push(`verification capability is missing: ${capability}`);
  if (errors.length > 0) return { valid: false, errors: [...new Set(errors)], manifest };
  const sources = [manifestPath, manifest.skill_path, manifest.feature_map_path].map((path) => ({ path, content: readFileSync3(join3(workspace, path), "utf8") }));
  return { valid: true, errors: [], manifest, sources, profile_hash: hash2(sources) };
}
function approvalPath(stateRoot, profileId) {
  return join3(resolve2(stateRoot), "verification-profiles", `${profileId}.json`);
}
function atomicJson(path, value) {
  mkdirSync2(dirname2(path), { recursive: true, mode: 448 });
  const temporary = `${path}.${process.pid}.${randomUUID2()}.tmp`;
  writeFileSync2(temporary, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  renameSync2(temporary, path);
}
function loadVerificationApproval(stateRoot, profileId) {
  const path = approvalPath(stateRoot, profileId);
  if (!existsSync3(path)) return null;
  try {
    return JSON.parse(readFileSync3(path, "utf8"));
  } catch {
    return null;
  }
}
function recordVerificationProof(stateRoot, inspection, proof) {
  if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
  const capabilityProof = proof?.capabilities ?? {};
  for (const capability of VERIFICATION_CAPABILITIES) if (capabilityProof[capability] !== true) throw new Error(`verification proof did not demonstrate ${capability}`);
  if (!Array.isArray(proof.evidence_hashes) || proof.evidence_hashes.length === 0 || proof.evidence_hashes.some((value2) => !/^[a-f0-9]{64}$/.test(value2))) throw new Error("verification proof requires evidence hashes");
  const value = {
    schema: 1,
    profile_id: inspection.manifest.profile_id,
    profile_hash: inspection.profile_hash,
    status: "proved",
    proved_at: (/* @__PURE__ */ new Date()).toISOString(),
    proof,
    approved_at: null,
    approved_hash: null
  };
  atomicJson(approvalPath(stateRoot, value.profile_id), value);
  return value;
}
function approveVerificationProfile(stateRoot, profileId, approvedHash) {
  const current = loadVerificationApproval(stateRoot, profileId);
  if (!current || current.status !== "proved") throw new Error("verification profile has no current proof");
  if (current.profile_hash !== approvedHash) throw new Error("verification profile approval hash mismatch");
  const value = { ...current, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString(), approved_hash: approvedHash };
  atomicJson(approvalPath(stateRoot, profileId), value);
  return value;
}
function auditVerificationProfile(workspaceRoot, manifestPath, pluginRoot, stateRoot) {
  const inspection = inspectVerificationProfile(workspaceRoot, manifestPath, pluginRoot);
  if (!inspection.valid) return { status: "blocked", ...inspection };
  const approval = loadVerificationApproval(stateRoot, inspection.manifest.profile_id);
  if (!approval || approval.approved_hash !== inspection.profile_hash) return { status: "changed", ...inspection, approval };
  return { status: "clean", ...inspection, approval };
}

export {
  CAPABILITY_RECEIPT_SCHEMA,
  REQUIRED_OBSERVATIONS,
  receiptProfileEligibility,
  receiptAutomationSafe,
  writeCapabilityReceipt,
  resolveCapabilities,
  validateRootPlanLineage,
  plannerReceiptBlockers,
  expectedPlannerReceiptBlockers,
  planningUsage,
  planningBudgetBlockers,
  loadPlanningHarness,
  PlanningEngine,
  planningHarnessHash,
  configurationHashes,
  draftVerificationProfile,
  inspectVerificationProfile,
  recordVerificationProof,
  approveVerificationProfile,
  auditVerificationProfile
};
