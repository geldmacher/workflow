#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  loadWorkflowConfig,
  repositoryBaseline,
  resolveRouteProfile
} from "./chunk-QB5KAHPL.mjs";
import {
  CursorWorkerAdapter,
  currentPlatform,
  hashPluginTree,
  loadWorkerRuntimeManifest,
  sdkVersion,
  workerRuntimeDirectory
} from "./chunk-7SYGAAH5.mjs";
import {
  probeSandboxBoundary
} from "./chunk-FTS4RQ3D.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  opaqueExtensionsFromArtifactText,
  preflightRootPlan,
  replaceOpaqueExtensions,
  require_ajv
} from "./chunk-3CKZRPWU.mjs";
import {
  require_dist
} from "./chunk-7JUFD6FK.mjs";
import {
  PLUGIN_VERSION,
  assertCompatiblePreparation
} from "./chunk-7NHOTGTA.mjs";
import {
  __toESM
} from "./chunk-WU6JOB3C.mjs";

// src/controller/capabilities.mjs
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease } from "node:os";
import { dirname, join } from "node:path";
var CAPABILITY_RECEIPT_SCHEMA = 4, CAPABILITY_RECEIPT_VALIDITY_DAYS = 30, REQUIRED_OBSERVATIONS = [
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
], THREE_RUN_OBSERVATIONS = /* @__PURE__ */ new Set([
  "sdk_write_boundary",
  "worker_network_isolated",
  "sdk_secret_isolated",
  "sdk_budget_cancel",
  "restart_resume",
  "crash_interrupt_resume",
  "planner_submission",
  "model_configuration_exact"
]), TOP_LEVEL_FIELDS = /* @__PURE__ */ new Set([
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
  return !!value && typeof value == "object" && !Array.isArray(value);
}
function exactFields(value, allowed, required = allowed) {
  if (!plainObject(value)) return !1;
  let keys = Object.keys(value);
  return keys.every((key) => allowed.has(key)) && [...required].every((key) => keys.includes(key));
}
function hashString(value) {
  return typeof value == "string" && /^[a-f0-9]{64}$/.test(value);
}
function modelConfiguration(value) {
  return plainObject(value) && ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"].includes(value.role) && typeof value.id == "string" && value.id.length > 0 && Array.isArray(value.params) && Object.keys(value).length === 3 && value.params.every((parameter) => exactFields(parameter, /* @__PURE__ */ new Set(["id", "value"])) && typeof parameter.id == "string" && typeof parameter.value == "string");
}
function receiptProfileEligibility(receipt) {
  if (!plainObject(receipt?.observations)) return { supervised: !1, autonomous: !1 };
  let observationsSafe = REQUIRED_OBSERVATIONS.every((key) => {
    let observation = receipt.observations[key], minimum = THREE_RUN_OBSERVATIONS.has(key) ? 3 : 1;
    return observation?.verified === !0 && Number.isInteger(observation.repetitions) && observation.repetitions >= minimum && hashString(observation.evidence_hash);
  }), auditSafe = receipt.audit?.high === 0 && receipt.audit?.critical === 0 && receipt.audit?.moderate === 0 || hashString(receipt.audit?.risk_acceptance_hash), modelsExact = JSON.stringify(receipt.model_attestation?.requested) === JSON.stringify(receipt.model_attestation?.accepted) && JSON.stringify(receipt.model_attestation?.accepted) === JSON.stringify(receipt.model_attestation?.observed), vector = receipt.capability_vector ?? {}, supervised = vector.write_boundary === !0 && vector.network_isolation === !0 && vector.secret_isolation === !0 && vector.budget_cancel === !0 && vector.planning === !0 && vector.route_pool === !0, autonomous = supervised && vector.verification_profile === !0 && observationsSafe && auditSafe && modelsExact && Array.isArray(receipt.qualification_bindings) && receipt.qualification_bindings.length > 0 && Array.isArray(receipt.certified_models) && receipt.certified_models.length > 0;
  return { supervised, autonomous };
}
function receiptAutomationSafe(receipt) {
  return receiptProfileEligibility(receipt)?.autonomous === !0;
}
function validateCapabilityReceipt(receipt, expected = {}, now = Date.now()) {
  let errors = [];
  if (!exactFields(receipt, TOP_LEVEL_FIELDS)) return { valid: !1, errors: ["receipt-shape-invalid"] };
  receipt.schema !== CAPABILITY_RECEIPT_SCHEMA && errors.push("receipt-schema-mismatch"), receipt.generated_by !== "geldmacher-workflow-capability-spike" && errors.push("receipt-producer-mismatch"), receipt.plugin_version !== PLUGIN_VERSION && errors.push("plugin-version-mismatch"), receipt.artifact_schema !== 5 && errors.push("artifact-schema-mismatch"), receipt.controller_protocol !== 5 && errors.push("controller-protocol-mismatch"), receipt.sdk_version !== sdkVersion && errors.push("sdk-version-mismatch"), receipt.platform !== currentPlatform() && errors.push("platform-mismatch"), receipt.node_version !== process.version && errors.push("node-version-mismatch"), receipt.os_version !== `${osPlatform()}-${osRelease()}` && errors.push("os-version-mismatch");
  let issued = Date.parse(receipt.issued_at), expires = Date.parse(receipt.expires_at), maximumValidity = CAPABILITY_RECEIPT_VALIDITY_DAYS * 24 * 60 * 60 * 1e3;
  !Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > maximumValidity ? errors.push("receipt-validity-invalid") : (now < issued || now >= expires) && errors.push("receipt-expired-or-not-yet-valid"), (typeof receipt.marketplace_git_commit != "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(receipt.marketplace_git_commit)) && errors.push("marketplace_git_commit-invalid");
  for (let field of ["plugin_hash", "worker_hash", "runtime_hash", "lockfile_hash", "attested_route_pool_hash", "model_catalog_hash", "planning_harness_hash", "cursor_harness_hash", "verification_profile_hash"])
    hashString(receipt[field]) || errors.push(`${field}-invalid`);
  if ((typeof receipt.cursor_version != "string" || receipt.cursor_version.length === 0) && errors.push("cursor-version-missing"), !exactFields(receipt.model_attestation, /* @__PURE__ */ new Set(["requested", "accepted", "observed", "request_ids", "agent_ids", "run_ids"]))) errors.push("model-attestation-shape-invalid");
  else {
    for (let field of ["requested", "accepted", "observed"]) (!Array.isArray(receipt.model_attestation[field]) || !receipt.model_attestation[field].every(modelConfiguration)) && errors.push(`model-attestation-${field}-invalid`);
    for (let field of ["request_ids", "agent_ids", "run_ids"]) (!Array.isArray(receipt.model_attestation[field]) || receipt.model_attestation[field].length === 0 || !receipt.model_attestation[field].every((id) => typeof id == "string" && id.length > 0)) && errors.push(`model-attestation-${field}-invalid`);
    let modelCount = receipt.model_attestation.requested?.length ?? 0;
    (receipt.model_attestation.accepted?.length !== modelCount || receipt.model_attestation.observed?.length !== modelCount || receipt.model_attestation.request_ids?.length !== modelCount || receipt.model_attestation.agent_ids?.length !== modelCount || receipt.model_attestation.run_ids?.length !== modelCount) && errors.push("model-attestation-cardinality-mismatch");
    for (let role of ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"])
      (receipt.model_attestation.requested ?? []).filter((model) => model.role === role).length < 1 && errors.push(`model-attestation-${role}-missing`);
  }
  (!Array.isArray(receipt.certified_models) || receipt.certified_models.length === 0 || !receipt.certified_models.every(modelConfiguration)) && errors.push("certified-models-invalid");
  let auditFields = /* @__PURE__ */ new Set(["lockfile_hash", "evidence_hash", "production_packages", "high", "critical", "moderate", "risk_acceptance_hash"]);
  if (!exactFields(receipt.audit, auditFields)) errors.push("audit-shape-invalid");
  else {
    (!hashString(receipt.audit.lockfile_hash) || !hashString(receipt.audit.evidence_hash)) && errors.push("audit-hash-invalid");
    for (let field of ["production_packages", "high", "critical", "moderate"]) (!Number.isInteger(receipt.audit[field]) || receipt.audit[field] < 0) && errors.push(`audit-${field}-invalid`);
    receipt.audit.risk_acceptance_hash !== null && !hashString(receipt.audit.risk_acceptance_hash) && errors.push("audit-risk-acceptance-invalid"), receipt.audit.lockfile_hash !== receipt.lockfile_hash && errors.push("audit-lockfile-mismatch");
  }
  if (!exactFields(receipt.observations, new Set(REQUIRED_OBSERVATIONS))) errors.push("observations-shape-invalid");
  else for (let key of REQUIRED_OBSERVATIONS) {
    let observation = receipt.observations[key];
    exactFields(observation, /* @__PURE__ */ new Set(["verified", "repetitions", "evidence_hash"])) ? (typeof observation.verified != "boolean" || !Number.isInteger(observation.repetitions) || observation.repetitions < 0 || !hashString(observation.evidence_hash)) && errors.push(`observation-${key}-invalid`) : errors.push(`observation-${key}-shape-invalid`);
  }
  (!plainObject(receipt.evidence_hashes) || Object.keys(receipt.evidence_hashes).length === 0 || !Object.values(receipt.evidence_hashes).every(hashString)) && errors.push("evidence-hashes-invalid");
  let vectorFields = /* @__PURE__ */ new Set(["write_boundary", "network_isolation", "secret_isolation", "budget_cancel", "planning", "verification_profile", "route_pool"]);
  if ((!exactFields(receipt.capability_vector, vectorFields) || Object.values(receipt.capability_vector ?? {}).some((value) => typeof value != "boolean")) && errors.push("capability-vector-invalid"), !Array.isArray(receipt.qualification_bindings)) errors.push("qualification-bindings-invalid");
  else for (let binding of receipt.qualification_bindings)
    exactFields(binding, /* @__PURE__ */ new Set(["task_class", "verification_profile_hash", "route_pool_hash", "certified_region"])) ? (!["bugfix", "refactor", "performance", "feature", "investigation", "verify-existing"].includes(binding.task_class) || !hashString(binding.verification_profile_hash) || !hashString(binding.route_pool_hash) || typeof binding.certified_region != "string" || binding.certified_region === "") && errors.push("qualification-binding-invalid") : errors.push("qualification-binding-shape-invalid");
  let derivedProfiles = receiptProfileEligibility(receipt);
  (!exactFields(receipt.profile_eligibility, /* @__PURE__ */ new Set(["supervised", "autonomous"])) || receipt.profile_eligibility.supervised !== derivedProfiles.supervised || receipt.profile_eligibility.autonomous !== derivedProfiles.autonomous) && errors.push("profile-eligibility-not-derived");
  for (let [field, value] of Object.entries(expected)) value !== void 0 && receipt[field] !== value && errors.push(`${field}-mismatch`);
  let derivedSafe = receiptAutomationSafe(receipt);
  return receipt.automation_safe !== derivedSafe && errors.push("automation-safe-not-derived"), { valid: errors.length === 0, errors, derived_safe: derivedSafe, profile_eligibility: derivedProfiles };
}
function capabilityReceiptPath(stateRoot) {
  return join(stateRoot, "capability-receipt.json");
}
function writeCapabilityReceipt(stateRoot, receipt, expected = {}) {
  let validation = validateCapabilityReceipt(receipt, expected);
  if (!validation.valid) throw new Error(`capability receipt denied: ${validation.errors.join(", ")}`);
  let path = capabilityReceiptPath(stateRoot);
  mkdirSync(dirname(path), { recursive: !0, mode: 448 });
  let temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  return writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}
`, { mode: 384 }), renameSync(temporary, path), path;
}
function loadCapabilityReceipt(stateRoot, expected = {}) {
  let path = capabilityReceiptPath(stateRoot);
  if (!existsSync(path)) return null;
  try {
    let receipt = JSON.parse(readFileSync(path, "utf8"));
    return validateCapabilityReceipt(receipt, expected).valid ? receipt : null;
  } catch {
    return null;
  }
}
function resolveCapabilities(stateRoot, additions = {}, context = {}) {
  let outer = probeSandboxBoundary(), runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), pluginHash = context.pluginRoot ? hashPluginTree(context.pluginRoot) : void 0, runtime = loadWorkerRuntimeManifest(runtimeDirectory, { plugin_version: PLUGIN_VERSION, sdk_version: sdkVersion, platform: currentPlatform(), ...pluginHash ? { plugin_hash: pluginHash } : {} }), expected = {
    ...pluginHash ? { plugin_hash: pluginHash } : {},
    ...runtime.valid ? {
      marketplace_git_commit: runtime.manifest.marketplace_git_commit,
      worker_hash: runtime.manifest.worker_hash,
      runtime_hash: runtime.manifest.runtime_hash,
      lockfile_hash: runtime.manifest.lockfile_hash
    } : {},
    ...additions.expected_route_hash ? { attested_route_pool_hash: additions.expected_route_hash } : {},
    ...additions.expected_planning_harness_hash ? { planning_harness_hash: additions.expected_planning_harness_hash } : {}
  }, cursorVersion = context.cursorVersion ?? process.env.GELDMACHER_WORKFLOW_CURSOR_VERSION ?? process.env.CURSOR_VERSION;
  cursorVersion && (expected.cursor_version = cursorVersion);
  let receipt = runtime.valid && cursorVersion ? loadCapabilityReceipt(stateRoot, expected) : null, output = {
    outer_sandbox_available: outer.available,
    outer_sandbox_verified: outer.verified,
    worker_runtime_provisioned: runtime.valid,
    worker_runtime_reason: runtime.reason,
    cursor_version_attested: !!cursorVersion,
    sdk_write_boundary_verified: receipt?.observations.sdk_write_boundary.verified === !0,
    worker_network_isolated: receipt?.observations.worker_network_isolated.verified === !0,
    sdk_secret_isolated: receipt?.observations.sdk_secret_isolated.verified === !0,
    sdk_budget_cancel_verified: receipt?.observations.sdk_budget_cancel.verified === !0,
    planner_submission_verified: receipt?.observations.planner_submission.verified === !0,
    restart_resume_verified: receipt?.observations.restart_resume.verified === !0,
    marketplace_mcp_verified: receipt?.observations.marketplace_mcp.verified === !0,
    marketplace_worker_runtime_verified: receipt?.observations.marketplace_worker_runtime.verified === !0,
    attested_route_hash: receipt?.attested_route_pool_hash ?? null,
    certified_harness_hash: receipt?.planning_harness_hash ?? null,
    sandbox_boundary_verified: outer.verified === !0 && receipt?.observations.sdk_write_boundary.verified === !0,
    capability_receipt: receipt,
    route_pool_certified: receipt?.profile_eligibility?.supervised === !0,
    verification_profile_certified: receipt?.capability_vector?.verification_profile === !0,
    verification_profile_hash: receipt?.verification_profile_hash ?? null,
    qualification_bindings: receipt?.qualification_bindings ?? [],
    certified_models: receipt?.certified_models ?? [],
    profile_eligibility: receipt?.profile_eligibility ?? { supervised: !1, autonomous: !1 },
    automation_safe: receipt?.profile_eligibility?.autonomous === !0 && runtime.valid
  };
  for (let [key, value] of Object.entries(additions)) key.startsWith("expected_") || (output[key] = value);
  return output;
}

// src/controller/planning.mjs
import { createHash } from "node:crypto";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join as join2, resolve } from "node:path";

// src/worker/planning-output.mjs
function validateIntentBlockerReport(value) {
  let questions = value?.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) throw new Error("intent blocker report requires one to three questions");
  return {
    questions: questions.map((question, index) => {
      if (typeof question != "string" || question.trim().length < 8) throw new Error(`intent blocker question ${index + 1} is not concrete`);
      return question.trim();
    }),
    rationale: typeof value.rationale == "string" && value.rationale.trim() ? value.rationale.trim() : null
  };
}

// src/controller/planning.mjs
var profileRank = Object.freeze({ manual: 0, supervised: 1, autonomous: 2 }), harnessFiles = Object.freeze([
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
  return createHash("sha256").update(typeof value == "string" ? value : JSON.stringify(stable(value))).digest("hex");
}
function stable(value) {
  return Array.isArray(value) ? value.map(stable) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function canonicalText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
function section(artifact, name) {
  return canonicalText(artifact?.sections?.get(name));
}
function rootProjection(rootPlanText, pluginRoot) {
  let inspection = inspectArtifactText(rootPlanText, pluginRoot);
  if (inspection.errors.length > 0 || inspection.artifact?.fields?.artifact !== "work-plan") throw new Error(`invalid root plan: ${inspection.errors.join("; ") || "input is not a work-plan"}`);
  let artifact = inspection.artifact, fields = artifact.fields;
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
  let before = rootProjection(beforeText, pluginRoot), after = rootProjection(afterText, pluginRoot), categories = Object.keys(before).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return {
    changed: hash(beforeText) !== hash(afterText),
    categories,
    before_root_hash: hash(beforeText),
    after_root_hash: hash(afterText)
  };
}
function normalizeRootArtifacts(rootArtifacts) {
  if (rootArtifacts == null) return [];
  if (!Array.isArray(rootArtifacts) || rootArtifacts.length > 32) throw new Error("workflow_prepare root_artifacts must contain at most 32 artifacts");
  let normalized = rootArtifacts.map((entry, index) => {
    if (!entry || typeof entry.label != "string" || entry.label.trim() === "" || typeof entry.text != "string" || entry.text.trim() === "")
      throw new Error(`workflow_prepare root_artifact ${index + 1} requires non-empty label and text`);
    return { label: entry.label, text: entry.text };
  });
  if (new Set(normalized.map((entry) => entry.label)).size !== normalized.length) throw new Error("workflow_prepare root_artifact labels must be unique");
  if (normalized.reduce((total, entry) => total + entry.text.length, 0) > 1e6) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
  return normalized.sort((left, right) => left.label.localeCompare(right.label) || hash(left.text).localeCompare(hash(right.text)));
}
function validateRootPlanLineage(rootPlanText, rootArtifacts, pluginRoot) {
  let contract = executionContractFromArtifactText(rootPlanText, pluginRoot);
  if (contract.errors.length > 0) return { errors: contract.errors, artifacts: [], artifact_set_hash: null };
  let artifacts;
  try {
    artifacts = normalizeRootArtifacts(rootArtifacts);
  } catch (error) {
    return { errors: [error.message], artifacts: [], artifact_set_hash: null };
  }
  if (!!!(contract.fields.predecessor_plan_id || contract.fields.replan_source_review_id))
    return artifacts.length > 0 ? { errors: ["initial root_plan cannot include root_artifacts"], artifacts, artifact_set_hash: hash(artifacts) } : { errors: [], artifacts, artifact_set_hash: hash(artifacts) };
  if (artifacts.length === 0) return { errors: ["replan root_plan requires its complete current lineage artifacts"], artifacts, artifact_set_hash: hash(artifacts) };
  let inspection = inspectArtifactSet([
    ...artifacts.map((entry) => [entry.label, entry.text]),
    ["workflow-prepare-root", rootPlanText]
  ], pluginRoot), summary = effectiveCliSummary(inspection), errors = [...inspection.errors];
  return (summary.root_tips.length !== 1 || summary.root_tips[0] !== contract.fields.id) && errors.push("replan root_plan must be the unique active lineage tip"), { errors: [...new Set(errors)], artifacts, artifact_set_hash: hash(artifacts) };
}
function plannerReceiptBlockers(receipt) {
  let blockers = [];
  return (!receipt?.model_attested || receipt?.remap === !0) && blockers.push("planner-model-mismatch"), (typeof receipt?.request_id != "string" || receipt.request_id === "") && blockers.push("planner-request-id-missing"), (typeof receipt?.agent_id != "string" || receipt.agent_id === "") && blockers.push("planner-agent-id-missing"), (typeof receipt?.sdk_version != "string" || receipt.sdk_version === "") && blockers.push("planner-sdk-version-missing"), (typeof receipt?.configuration_hash != "string" || receipt.configuration_hash === "") && blockers.push("planner-route-hash-missing"), receipt?.route_hash !== receipt?.configuration_hash && blockers.push("planner-route-hash-mismatch"), (typeof receipt?.harness_hash != "string" || receipt.harness_hash === "") && blockers.push("planner-harness-hash-missing"), (!Number.isFinite(receipt?.duration_ms) || receipt.duration_ms < 0) && blockers.push("planner-duration-missing"), (!Number.isFinite(receipt?.usage?.totalTokens) || receipt.usage.totalTokens < 0) && blockers.push("planner-token-usage-missing"), (!Number.isFinite(receipt?.cost_usd) || receipt.cost_usd < 0) && blockers.push("planner-cost-missing"), blockers;
}
function expectedPlannerReceiptBlockers(receipt, preparation, acceptedModel) {
  let selected = preparation.route_validation.routes?.planner?.selected_candidate, expectedRequested = { id: selected?.model_id, reasoning_effort: selected?.reasoning_effort, model_options: selected?.model_options ?? {} }, blockers = [];
  return JSON.stringify(stable(receipt?.requested_model)) !== JSON.stringify(stable(expectedRequested)) && blockers.push("planner-requested-model-mismatch"), JSON.stringify(stable(receipt?.accepted_model)) !== JSON.stringify(stable(acceptedModel)) && blockers.push("planner-accepted-model-mismatch"), (receipt?.configuration_hash !== preparation.route_hash || receipt?.route_hash !== preparation.route_hash) && blockers.push("planner-route-hash-mismatch"), receipt?.harness_hash !== preparation.harness_hash && blockers.push("planner-harness-hash-mismatch"), receipt?.artifact_projection_hash !== preparation.input_root_authoritative_projection_hash && blockers.push("planner-artifact-projection-mismatch"), preparation.route_validation.sdk_version && receipt?.sdk_version !== preparation.route_validation.sdk_version && blockers.push("planner-sdk-version-mismatch"), blockers;
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
  let blockers = [];
  return usage.active_minutes > budget.max_active_minutes && blockers.push("planning-time-budget-exhausted"), usage.total_tokens > budget.max_total_tokens && blockers.push("planning-token-budget-exhausted"), usage.cost_usd > budget.max_cost_usd && blockers.push("planning-cost-budget-exhausted"), blockers;
}
function loadPlanningHarness(pluginRoot) {
  let sources = harnessFiles.map((path) => {
    let absolute = join2(pluginRoot, path);
    if (!existsSync2(absolute)) throw new Error(`planning harness file is missing: ${path}`);
    return { path, content: readFileSync2(absolute, "utf8") };
  });
  return { sources, hash: hash(sources) };
}
function planningPrompt(preparation, harness) {
  let source = preparation.source_kind === "goal" ? `GOAL
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
${content}`).join(`

`)}`
  ].join(`

`);
}
function normalizePlannerRootOutput(rootPlanText, preparation) {
  try {
    let opaque = preparation.source_kind === "root-plan" ? opaqueExtensionsFromArtifactText(preparation.input_root_text) : { present: !1, value: null };
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
${errors.map((error) => `- ${error}`).join(`
`)}`
  ].join(`

`);
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
    this.workspaceRoot = resolve(workspaceRoot), this.store = store, this.pluginRoot = resolve(pluginRoot), this.stateRoot = resolve(stateRoot), this.adapterFactory = adapterFactory ?? ((preparation) => new CursorWorkerAdapter({ runDirectory: this.store.preparationDirectory(preparation.preparation_id), pluginRoot: this.pluginRoot })), this.capabilitiesFactory = capabilitiesFactory ?? ((additions = {}) => resolveCapabilities(this.stateRoot, additions, { pluginRoot: this.pluginRoot }));
  }
  prepare({ goal, rootPlan, rootArtifacts, requestedProfile, routeProfile = "default", idempotencyKey }) {
    if (!!goal == !!rootPlan) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (!["supervised", "autonomous"].includes(requestedProfile)) throw new Error("workflow_prepare supports supervised or autonomous");
    if (typeof idempotencyKey != "string" || idempotencyKey.length < 8) throw new Error("workflow_prepare requires an idempotency key");
    let inputContract = null, inputLineage = { errors: [], artifacts: [], artifact_set_hash: hash([]) };
    if (rootPlan) {
      if (inputContract = executionContractFromArtifactText(rootPlan, this.pluginRoot), inputContract.errors.length > 0) throw new Error(`invalid input root plan: ${inputContract.errors.join("; ")}`);
      if (inputLineage = validateRootPlanLineage(rootPlan, rootArtifacts, this.pluginRoot), inputLineage.errors.length > 0) throw new Error(`invalid input root lineage: ${inputLineage.errors.join("; ")}`);
    } else if (rootArtifacts !== void 0)
      throw new Error("workflow_prepare root_artifacts require root_plan");
    let requestHash = preparationRequestHash({ goal, rootPlan, rootArtifactsHash: inputLineage.artifact_set_hash, requestedProfile, routeProfile }), duplicate = this.store.list().find((preparation2) => preparation2.preparation_idempotency_key === idempotencyKey);
    if (duplicate) {
      if (assertCompatiblePreparation(duplicate), duplicate.preparation_request_hash !== requestHash) throw new Error("preparation idempotency conflict: key is bound to another request");
      return { preparation: duplicate, duplicate: !0 };
    }
    let config = loadWorkflowConfig(this.workspaceRoot);
    if (config.errors.length > 0) throw new Error(`workflow_prepare configuration invalid: ${config.errors.join("; ")}`);
    let route = resolveRouteProfile(config, routeProfile), budget = structuredClone(config.user.planning_preflight_budget), baseline = repositoryBaseline(this.workspaceRoot), harness = loadPlanningHarness(this.pluginRoot), routeHash = hash(route), policyHash = hash(config.project), configHash = hash({ route_profile: routeProfile, route, planning_preflight_budget: budget }), capabilities = this.capabilitiesFactory({ expected_route_hash: routeHash, expected_planning_harness_hash: harness.hash }), routeValidation;
    try {
      routeValidation = this.adapterFactory({ preparation_id: "preflight" }).validateProfile(route);
    } catch (error) {
      routeValidation = { verified: !1, errors: [error.message] };
    }
    let technicalBlockers = [
      ...routeValidation.errors ?? [],
      ...routeValidation.verified !== !0 ? ["model-catalog-not-verified"] : [],
      ...config.project.supervised_enabled ? [] : ["project-supervised-disabled"],
      ...capabilities.sandbox_boundary_verified ? [] : ["hard-sandbox-not-verified"],
      ...capabilities.worker_network_isolated ? [] : ["worker-network-boundary-not-verified"],
      ...capabilities.sdk_secret_isolated ? [] : ["sdk-secret-boundary-not-verified"],
      ...capabilities.sdk_budget_cancel_verified ? [] : ["sdk-budget-cancel-not-verified"],
      ...capabilities.planner_submission_verified ? [] : ["planner-submission-not-verified"]
    ], now = Date.now();
    return { preparation: this.store.create({
      status: technicalBlockers.length > 0 || routeValidation.verified !== !0 ? "failed" : "planning",
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
    }), duplicate: !1 };
  }
  execute(preparationId) {
    let preparation = this.store.get(preparationId);
    if (assertCompatiblePreparation(preparation), preparation.status !== "planning") throw new Error(`preparation is not planning: ${preparation.status}`);
    if (Date.parse(preparation.expires_at) <= Date.now()) return this.finish(preparation, "expired", ["preparation-expired"]);
    let harness = loadPlanningHarness(this.pluginRoot);
    if (harness.hash !== preparation.harness_hash) return this.finish(preparation, "failed", ["planning-harness-drift"]);
    let adapter = this.adapterFactory(preparation), acceptedModel = preparation.route_validation.routes?.planner?.model;
    if (!acceptedModel) return this.finish(preparation, "failed", ["planner-route-not-validated"]);
    let prompt = planningPrompt(preparation, harness), agentId = preparation.planner_agent_id, repairs = 0;
    for (; ; ) {
      let beforeUsage = planningUsage(preparation.planner_receipts ?? [], preparation.created_at), beforeBudgetBlockers = planningBudgetBlockers(beforeUsage, preparation.planning_budget);
      if (beforeBudgetBlockers.length > 0) return this.finish(preparation, "failed", beforeBudgetBlockers, beforeUsage);
      let remainingMs = Math.max(1, Date.parse(preparation.expires_at) - Date.now()), phase = adapter.runPlanningPhase({
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
      let receipts = [...preparation.planner_receipts ?? [], phase.receipt], usage = planningUsage(receipts, preparation.created_at), controlled = this.store.get(preparation.preparation_id);
      if (controlled.status !== "planning")
        return this.store.update(controlled.preparation_id, controlled.revision, null, (draft) => ({
          ...draft,
          planner_agent_id: agentId,
          planner_receipts: [...draft.planner_receipts ?? [], phase.receipt],
          usage: planningUsage([...draft.planner_receipts ?? [], phase.receipt], draft.created_at),
          runner_pid: null
        }), "planner-cancel-receipt-recorded");
      if (preparation = this.update(preparation, (draft) => ({ ...draft, planner_agent_id: agentId, planner_receipts: receipts, usage }), "planner-turn-finished"), phase.response.status === "interrupted") return this.update(preparation, (draft) => ({ ...draft, status: "interrupted", blockers: ["planner-hard-cancelled"], runner_pid: null }), "planner-interrupted");
      let blockers = [
        ...plannerReceiptBlockers(phase.receipt),
        ...expectedPlannerReceiptBlockers(phase.receipt, preparation, acceptedModel),
        ...planningBudgetBlockers(usage, preparation.planning_budget),
        ...phase.response.ok ? [] : [phase.response.error?.message ?? "planner-failed"]
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
      let rootPlanText = normalizePlannerRootOutput(phase.planningOutput.root_plan_text, preparation), contract = executionContractFromArtifactText(rootPlanText, this.pluginRoot), validationErrors = [...contract.errors];
      if (validationErrors.length === 0) {
        let preflight = preflightRootPlan(rootPlanText, this.pluginRoot);
        validationErrors.push(...preflight.blocking_issues.map((entry) => `${entry.code}: ${entry.message}`));
      }
      if (validationErrors.length === 0 && validationErrors.push(...validateRootPlanLineage(rootPlanText, preparation.input_root_lineage_artifacts, this.pluginRoot).errors), validationErrors.length === 0 && preparation.input_root_contract && (contract.fields.predecessor_plan_id ?? null) !== (preparation.input_root_contract.fields.predecessor_plan_id ?? null) && validationErrors.push("root plan predecessor_plan_id must remain unchanged"), validationErrors.length === 0 && preparation.input_root_contract && (contract.fields.replan_source_review_id ?? null) !== (preparation.input_root_contract.fields.replan_source_review_id ?? null) && validationErrors.push("root plan replan_source_review_id must remain unchanged"), validationErrors.length === 0 && (contract.fields.status !== "ready" || contract.fields.intent_ready !== !0) && validationErrors.push("root plan must be ready with intent_ready true"), validationErrors.length === 0 && !maximumProfileAllows(preparation.requested_profile, contract.fields.profile_max) && validationErrors.push(`root plan permits at most ${contract.fields.profile_max}`), validationErrors.length === 0) {
        let semanticDiff = semanticRootDiff(preparation.input_root_text, rootPlanText, this.pluginRoot);
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
      repairs += 1, prompt = repairPrompt(validationErrors, preparation.planning_budget.max_validation_repairs - repairs);
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
  let config = loadWorkflowConfig(workspaceRoot);
  if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
  let route = resolveRouteProfile(config, routeProfile);
  return {
    route_hash: hash(route),
    config_hash: hash({ route_profile: routeProfile, route, planning_preflight_budget: config.user.planning_preflight_budget }),
    policy_hash: hash(config.project)
  };
}

// src/controller/verification-profile.mjs
var import_ajv = __toESM(require_ajv(), 1), import_yaml = __toESM(require_dist(), 1);
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, isAbsolute, join as join3, normalize, resolve as resolve2, sep } from "node:path";
var VERIFICATION_CAPABILITIES = Object.freeze(["launch", "doctor", "drive", "observe", "evidence", "reset", "cleanup"]);
function draftVerificationProfile(workspaceRoot, surface, pluginRoot, manifestPath = ".cursor/workflow-verification.yaml") {
  let workspace = resolve2(workspaceRoot), slug = String(surface ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("verification draft requires a concrete surface");
  if (!safeRelative(manifestPath)) throw new Error("verification manifest path must be repository-relative");
  let skillPath = `.cursor/skills/workflow-verification-${slug}/SKILL.md`, featureMapPath = `.cursor/workflow-verification-${slug}-features.yaml`, files = [manifestPath, skillPath, featureMapPath], existing = files.filter((path) => existsSync3(join3(workspace, path)));
  if (existing.length > 0) throw new Error(`verification draft refuses to overwrite: ${existing.join(", ")}`);
  let manifest = [
    "schema: 1",
    `profile_id: verify-${slug}`,
    "version: draft-1",
    `skill_path: ${skillPath}`,
    `feature_map_path: ${featureMapPath}`,
    "capabilities:",
    ...VERIFICATION_CAPABILITIES.map((capability) => `  - ${capability}`),
    "artifact_policy: external-only",
    ""
  ].join(`
`), skill = [
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
  ].join(`
`), featureMap = [
    "schema: 1",
    `surface: ${JSON.stringify(surface)}`,
    "features:",
    `  - feature_id: ${slug}-representative`,
    "    description: Replace with one representative end-to-end feature path.",
    "    expected: Replace with an observable expected result.",
    ""
  ].join(`
`);
  for (let [path, content] of [[manifestPath, manifest], [skillPath, skill], [featureMapPath, featureMap]]) {
    let absolute = join3(workspace, path);
    mkdirSync2(dirname2(absolute), { recursive: !0, mode: 448 }), writeFileSync2(absolute, content, { flag: "wx", mode: 384 });
  }
  return { created: files, inspection: inspectVerificationProfile(workspace, manifestPath, pluginRoot) };
}
function stable2(value) {
  return Array.isArray(value) ? value.map(stable2) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable2(value[key])]));
}
function hash2(value) {
  return createHash2("sha256").update(typeof value == "string" ? value : JSON.stringify(stable2(value))).digest("hex");
}
function safeRelative(path) {
  let value = normalize(String(path));
  return !!path && !isAbsolute(String(path)) && value !== ".." && !value.startsWith(`..${sep}`);
}
function inspectVerificationProfile(workspaceRoot, manifestPath = ".cursor/workflow-verification.yaml", pluginRoot) {
  let workspace = resolve2(workspaceRoot);
  if (!safeRelative(manifestPath)) return { valid: !1, errors: ["verification manifest path must be repository-relative"] };
  let absolute = join3(workspace, manifestPath);
  if (!existsSync3(absolute)) return { valid: !1, errors: [`verification manifest is missing: ${manifestPath}`] };
  let manifest;
  try {
    manifest = (0, import_yaml.parse)(readFileSync3(absolute, "utf8"));
  } catch (error) {
    return { valid: !1, errors: [`verification manifest YAML is invalid: ${error.message}`] };
  }
  let schema = JSON.parse(readFileSync3(join3(pluginRoot, "schemas", "verification-profile.schema.json"), "utf8")), validate = new import_ajv.default({ allErrors: !0, strict: !1 }).compile(schema), errors = validate(manifest) ? [] : validate.errors.map((error) => `${error.instancePath || "/"}: ${error.message}`);
  for (let field of ["skill_path", "feature_map_path"])
    safeRelative(manifest?.[field]) ? existsSync3(join3(workspace, manifest[field])) || errors.push(`${field} does not exist: ${manifest[field]}`) : errors.push(`${field} must be repository-relative`);
  for (let capability of VERIFICATION_CAPABILITIES) (manifest?.capabilities ?? []).includes(capability) || errors.push(`verification capability is missing: ${capability}`);
  if (errors.length > 0) return { valid: !1, errors: [...new Set(errors)], manifest };
  let sources = [manifestPath, manifest.skill_path, manifest.feature_map_path].map((path) => ({ path, content: readFileSync3(join3(workspace, path), "utf8") }));
  return { valid: !0, errors: [], manifest, sources, profile_hash: hash2(sources) };
}
function approvalPath(stateRoot, profileId) {
  return join3(resolve2(stateRoot), "verification-profiles", `${profileId}.json`);
}
function atomicJson(path, value) {
  mkdirSync2(dirname2(path), { recursive: !0, mode: 448 });
  let temporary = `${path}.${process.pid}.${randomUUID2()}.tmp`;
  writeFileSync2(temporary, `${JSON.stringify(value, null, 2)}
`, { mode: 384 }), renameSync2(temporary, path);
}
function loadVerificationApproval(stateRoot, profileId) {
  let path = approvalPath(stateRoot, profileId);
  if (!existsSync3(path)) return null;
  try {
    return JSON.parse(readFileSync3(path, "utf8"));
  } catch {
    return null;
  }
}
function recordVerificationProof(stateRoot, inspection, proof) {
  if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
  let capabilityProof = proof?.capabilities ?? {};
  for (let capability of VERIFICATION_CAPABILITIES) if (capabilityProof[capability] !== !0) throw new Error(`verification proof did not demonstrate ${capability}`);
  if (!Array.isArray(proof.evidence_hashes) || proof.evidence_hashes.length === 0 || proof.evidence_hashes.some((value2) => !/^[a-f0-9]{64}$/.test(value2))) throw new Error("verification proof requires evidence hashes");
  let value = {
    schema: 1,
    profile_id: inspection.manifest.profile_id,
    profile_hash: inspection.profile_hash,
    status: "proved",
    proved_at: (/* @__PURE__ */ new Date()).toISOString(),
    proof,
    approved_at: null,
    approved_hash: null
  };
  return atomicJson(approvalPath(stateRoot, value.profile_id), value), value;
}
function approveVerificationProfile(stateRoot, profileId, approvedHash) {
  let current = loadVerificationApproval(stateRoot, profileId);
  if (!current || current.status !== "proved") throw new Error("verification profile has no current proof");
  if (current.profile_hash !== approvedHash) throw new Error("verification profile approval hash mismatch");
  let value = { ...current, status: "approved", approved_at: (/* @__PURE__ */ new Date()).toISOString(), approved_hash: approvedHash };
  return atomicJson(approvalPath(stateRoot, profileId), value), value;
}
function auditVerificationProfile(workspaceRoot, manifestPath, pluginRoot, stateRoot) {
  let inspection = inspectVerificationProfile(workspaceRoot, manifestPath, pluginRoot);
  if (!inspection.valid) return { status: "blocked", ...inspection };
  let approval = loadVerificationApproval(stateRoot, inspection.manifest.profile_id);
  return !approval || approval.approved_hash !== inspection.profile_hash ? { status: "changed", ...inspection, approval } : { status: "clean", ...inspection, approval };
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
