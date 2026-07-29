import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease } from "node:os";
import { dirname, join } from "node:path";
import { probeSandboxBoundary } from "./sandbox.mjs";
import { sdkVersion } from "./worker-adapter.mjs";
import { ARTIFACT_SCHEMA, CONTROLLER_PROTOCOL, PLUGIN_VERSION } from "./protocol.mjs";
import { currentPlatform, hashPluginTree, loadWorkerRuntimeManifest, workerRuntimeDirectory } from "./runtime.mjs";

export const CAPABILITY_RECEIPT_SCHEMA = 2;
export const CAPABILITY_RECEIPT_VALIDITY_DAYS = 30;

export const REQUIRED_OBSERVATIONS = [
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
  "cursor_harness",
];

export const THREE_RUN_OBSERVATIONS = new Set([
  "sdk_write_boundary",
  "worker_network_isolated",
  "sdk_secret_isolated",
  "sdk_budget_cancel",
  "restart_resume",
  "crash_interrupt_resume",
  "planner_submission",
  "model_configuration_exact",
]);

const TOP_LEVEL_FIELDS = new Set([
  "schema", "generated_by", "issued_at", "expires_at", "plugin_version", "artifact_schema", "controller_protocol",
  "sdk_version", "platform", "node_version", "os_version", "cursor_version", "marketplace_git_commit", "plugin_hash",
  "worker_hash", "runtime_hash", "lockfile_hash", "attested_route_hash", "model_catalog_hash", "planning_harness_hash",
  "cursor_harness_hash", "model_attestation", "audit", "observations", "evidence_hashes", "automation_safe",
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
  return plainObject(value)
    && ["planner", "writer", "writer_escalated", "reviewer", "explainer"].includes(value.role)
    && typeof value.id === "string" && value.id.length > 0
    && Array.isArray(value.params)
    && Object.keys(value).length === 3
    && value.params.every((parameter) => exactFields(parameter, new Set(["id", "value"])) && typeof parameter.id === "string" && typeof parameter.value === "string");
}

export function receiptAutomationSafe(receipt) {
  if (!plainObject(receipt?.observations)) return false;
  const observationsSafe = REQUIRED_OBSERVATIONS.every((key) => {
    const observation = receipt.observations[key];
    const minimum = THREE_RUN_OBSERVATIONS.has(key) ? 3 : 1;
    return observation?.verified === true && Number.isInteger(observation.repetitions) && observation.repetitions >= minimum && hashString(observation.evidence_hash);
  });
  const auditSafe = receipt.audit?.high === 0
    && receipt.audit?.critical === 0
    && (receipt.audit?.moderate === 0 || hashString(receipt.audit?.risk_acceptance_hash));
  const modelsExact = JSON.stringify(receipt.model_attestation?.requested) === JSON.stringify(receipt.model_attestation?.accepted)
    && JSON.stringify(receipt.model_attestation?.accepted) === JSON.stringify(receipt.model_attestation?.observed);
  return observationsSafe && auditSafe && modelsExact;
}

export function validateCapabilityReceipt(receipt, expected = {}, now = Date.now()) {
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
  const maximumValidity = CAPABILITY_RECEIPT_VALIDITY_DAYS * 24 * 60 * 60 * 1_000;
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > maximumValidity) errors.push("receipt-validity-invalid");
  else if (now < issued || now >= expires) errors.push("receipt-expired-or-not-yet-valid");
  if (typeof receipt.marketplace_git_commit !== "string" || !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(receipt.marketplace_git_commit)) errors.push("marketplace_git_commit-invalid");
  for (const field of ["plugin_hash", "worker_hash", "runtime_hash", "lockfile_hash", "attested_route_hash", "model_catalog_hash", "planning_harness_hash", "cursor_harness_hash"]) {
    if (!hashString(receipt[field])) errors.push(`${field}-invalid`);
  }
  if (typeof receipt.cursor_version !== "string" || receipt.cursor_version.length === 0) errors.push("cursor-version-missing");
  if (!exactFields(receipt.model_attestation, new Set(["requested", "accepted", "observed", "request_ids", "agent_ids", "run_ids"]))) errors.push("model-attestation-shape-invalid");
  else {
    for (const field of ["requested", "accepted", "observed"]) if (!Array.isArray(receipt.model_attestation[field]) || !receipt.model_attestation[field].every(modelConfiguration)) errors.push(`model-attestation-${field}-invalid`);
    for (const field of ["request_ids", "agent_ids", "run_ids"]) if (!Array.isArray(receipt.model_attestation[field]) || receipt.model_attestation[field].length === 0 || !receipt.model_attestation[field].every((id) => typeof id === "string" && id.length > 0)) errors.push(`model-attestation-${field}-invalid`);
    const modelCount = receipt.model_attestation.requested?.length ?? 0;
    if (receipt.model_attestation.accepted?.length !== modelCount || receipt.model_attestation.observed?.length !== modelCount
      || receipt.model_attestation.request_ids?.length !== modelCount || receipt.model_attestation.agent_ids?.length !== modelCount || receipt.model_attestation.run_ids?.length !== modelCount) errors.push("model-attestation-cardinality-mismatch");
    for (const role of ["planner", "writer", "writer_escalated", "reviewer", "explainer"]) {
      if ((receipt.model_attestation.requested ?? []).filter((model) => model.role === role).length < 3) errors.push(`model-attestation-${role}-repetitions-insufficient`);
    }
  }
  const auditFields = new Set(["lockfile_hash", "evidence_hash", "production_packages", "high", "critical", "moderate", "risk_acceptance_hash"]);
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
    if (!exactFields(observation, new Set(["verified", "repetitions", "evidence_hash"]))) errors.push(`observation-${key}-shape-invalid`);
    else if (typeof observation.verified !== "boolean" || !Number.isInteger(observation.repetitions) || observation.repetitions < 0 || !hashString(observation.evidence_hash)) errors.push(`observation-${key}-invalid`);
  }
  if (!plainObject(receipt.evidence_hashes) || Object.keys(receipt.evidence_hashes).length === 0 || !Object.values(receipt.evidence_hashes).every(hashString)) errors.push("evidence-hashes-invalid");
  for (const [field, value] of Object.entries(expected)) if (value !== undefined && receipt[field] !== value) errors.push(`${field}-mismatch`);
  const derivedSafe = receiptAutomationSafe(receipt);
  if (receipt.automation_safe !== derivedSafe) errors.push("automation-safe-not-derived");
  if (receipt.automation_safe !== true) errors.push("automation-not-safe");
  return { valid: errors.length === 0, errors, derived_safe: derivedSafe };
}

export function capabilityReceiptPath(stateRoot) {
  return join(stateRoot, "capability-receipt.json");
}

export function writeCapabilityReceipt(stateRoot, receipt, expected = {}) {
  const validation = validateCapabilityReceipt(receipt, expected);
  if (!validation.valid) throw new Error(`capability receipt denied: ${validation.errors.join(", ")}`);
  const path = capabilityReceiptPath(stateRoot);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  return path;
}

export function loadCapabilityReceipt(stateRoot, expected = {}) {
  const path = capabilityReceiptPath(stateRoot);
  if (!existsSync(path)) return null;
  try {
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    return validateCapabilityReceipt(receipt, expected).valid ? receipt : null;
  } catch {
    return null;
  }
}

export function resolveCapabilities(stateRoot, additions = {}, context = {}) {
  const outer = probeSandboxBoundary();
  const runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion });
  const pluginHash = context.pluginRoot ? hashPluginTree(context.pluginRoot) : undefined;
  const runtime = loadWorkerRuntimeManifest(runtimeDirectory, { plugin_version: PLUGIN_VERSION, sdk_version: sdkVersion, platform: currentPlatform(), ...(pluginHash ? { plugin_hash: pluginHash } : {}) });
  const expected = {
    ...(pluginHash ? { plugin_hash: pluginHash } : {}),
    ...(runtime.valid ? {
      marketplace_git_commit: runtime.manifest.marketplace_git_commit,
      worker_hash: runtime.manifest.worker_hash,
      runtime_hash: runtime.manifest.runtime_hash,
      lockfile_hash: runtime.manifest.lockfile_hash,
    } : {}),
    ...(additions.expected_route_hash ? { attested_route_hash: additions.expected_route_hash } : {}),
    ...(additions.expected_planning_harness_hash ? { planning_harness_hash: additions.expected_planning_harness_hash } : {}),
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
    attested_route_hash: receipt?.attested_route_hash ?? null,
    certified_harness_hash: receipt?.planning_harness_hash ?? null,
    sandbox_boundary_verified: outer.verified === true && receipt?.observations.sdk_write_boundary.verified === true,
    capability_receipt: receipt,
    automation_safe: receipt?.automation_safe === true && runtime.valid,
  };
  for (const [key, value] of Object.entries(additions)) if (!key.startsWith("expected_")) output[key] = value;
  return output;
}
