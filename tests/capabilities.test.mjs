import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CAPABILITY_RECEIPT_SCHEMA,
  REQUIRED_OBSERVATIONS,
  THREE_RUN_OBSERVATIONS,
  capabilityReceiptPath,
  loadCapabilityReceipt,
  receiptAutomationSafe,
  receiptProfileEligibility,
  resolveCapabilities,
  validateCapabilityReceipt,
  writeCapabilityReceipt,
} from "../src/controller/capabilities.mjs";
import { ARTIFACT_SCHEMA, CONTROLLER_PROTOCOL, PLUGIN_VERSION } from "../src/controller/protocol.mjs";
import { currentPlatform } from "../src/controller/runtime.mjs";
import { sdkVersion } from "../src/controller/worker-adapter.mjs";

const hash = "a".repeat(64);
const roles = ["planner", "investigator", "writer", "writer_escalated", "verifier", "reviewer", "explainer"];
const clone = (value) => structuredClone(value);

function validReceipt(now = Date.now()) {
  const models = roles.map((role) => ({ role, id: `model-${role}`, params: [{ id: "reasoning_effort", value: "high" }] }));
  return {
    schema: CAPABILITY_RECEIPT_SCHEMA,
    generated_by: "geldmacher-workflow-capability-spike",
    issued_at: new Date(now - 1_000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    plugin_version: PLUGIN_VERSION,
    artifact_schema: ARTIFACT_SCHEMA,
    controller_protocol: CONTROLLER_PROTOCOL,
    sdk_version: sdkVersion,
    platform: currentPlatform(),
    node_version: process.version,
    os_version: `${osPlatform()}-${osRelease()}`,
    cursor_version: "2026.8",
    marketplace_git_commit: "b".repeat(40),
    plugin_hash: hash,
    worker_hash: hash,
    runtime_hash: hash,
    lockfile_hash: hash,
    attested_route_pool_hash: hash,
    model_catalog_hash: hash,
    planning_harness_hash: hash,
    cursor_harness_hash: hash,
    verification_profile_hash: hash,
    model_attestation: {
      requested: models,
      accepted: clone(models),
      observed: clone(models),
      request_ids: roles.map((role) => `request-${role}`),
      agent_ids: roles.map((role) => `agent-${role}`),
      run_ids: roles.map((role) => `run-${role}`),
    },
    certified_models: clone(models),
    audit: { lockfile_hash: hash, evidence_hash: hash, production_packages: 5, high: 0, critical: 0, moderate: 0, risk_acceptance_hash: null },
    observations: Object.fromEntries(REQUIRED_OBSERVATIONS.map((key) => [key, { verified: true, repetitions: THREE_RUN_OBSERVATIONS.has(key) ? 3 : 1, evidence_hash: hash }])),
    capability_vector: { write_boundary: true, network_isolation: true, secret_isolation: true, budget_cancel: true, planning: true, verification_profile: true, route_pool: true },
    qualification_bindings: [{ task_class: "feature", verification_profile_hash: hash, route_pool_hash: hash, certified_region: "src" }],
    profile_eligibility: { supervised: true, autonomous: true },
    evidence_hashes: { receipt: hash },
    automation_safe: true,
  };
}

test("Schema-4 capability receipts are exact, derived, hash-bound, and persist atomically", () => {
  const now = Date.now();
  const receipt = validReceipt(now);
  assert.deepEqual(receiptProfileEligibility(receipt), { supervised: true, autonomous: true });
  assert.equal(receiptAutomationSafe(receipt), true);
  assert.deepEqual(validateCapabilityReceipt(receipt, { plugin_hash: hash }, now).errors, []);

  const state = mkdtempSync(join(tmpdir(), "workflow-receipt-"));
  assert.equal(writeCapabilityReceipt(state, receipt, { plugin_hash: hash }), capabilityReceiptPath(state));
  assert.deepEqual(loadCapabilityReceipt(state, { plugin_hash: hash }), receipt);
  assert.equal(loadCapabilityReceipt(state, { plugin_hash: "c".repeat(64) }), null);
  writeFileSync(capabilityReceiptPath(state), "not json\n");
  assert.equal(loadCapabilityReceipt(state), null);
  assert.throws(() => writeCapabilityReceipt(state, { schema: 4 }), /receipt-shape-invalid/);
});

test("capability receipt validation rejects stale, malformed, unsafe, or inconsistent evidence", () => {
  const now = Date.now();
  assert.deepEqual(receiptProfileEligibility(null), { supervised: false, autonomous: false });
  assert.deepEqual(validateCapabilityReceipt({ schema: 4 }, {}, now).errors, ["receipt-shape-invalid"]);

  const productionFinding = validReceipt(now);
  productionFinding.audit.high = 1;
  productionFinding.audit.risk_acceptance_hash = null;
  productionFinding.profile_eligibility = { supervised: true, autonomous: false };
  productionFinding.automation_safe = false;
  assert.equal(validateCapabilityReceipt(productionFinding, {}, now).valid, true);
  assert.equal(receiptAutomationSafe(productionFinding), false);
  const acceptedFinding = clone(productionFinding);
  acceptedFinding.audit.risk_acceptance_hash = hash;
  acceptedFinding.profile_eligibility.autonomous = true;
  acceptedFinding.automation_safe = true;
  assert.equal(validateCapabilityReceipt(acceptedFinding, {}, now).valid, true);
  assert.equal(receiptAutomationSafe(acceptedFinding), true);

  const receipt = validReceipt(now);
  Object.assign(receipt, {
    schema: 3,
    generated_by: "foreign",
    plugin_version: "5.0.0",
    artifact_schema: 4,
    controller_protocol: 4,
    sdk_version: "0.0.0",
    platform: "foreign",
    node_version: "v0",
    os_version: "foreign",
    issued_at: "invalid",
    expires_at: "invalid",
    marketplace_git_commit: "bad",
    cursor_version: "",
    plugin_hash: "bad",
    automation_safe: false,
  });
  receipt.model_attestation.accepted = [];
  receipt.certified_models = [];
  receipt.audit = { ...receipt.audit, high: -1, moderate: 1, risk_acceptance_hash: "bad", lockfile_hash: "c".repeat(64) };
  receipt.observations.local_mcp = { verified: "yes", repetitions: -1, evidence_hash: "bad" };
  receipt.evidence_hashes = {};
  receipt.capability_vector.write_boundary = "yes";
  receipt.qualification_bindings = [{ task_class: "unknown", verification_profile_hash: "bad", route_pool_hash: "bad", certified_region: "" }];
  receipt.profile_eligibility = { supervised: true, autonomous: true };
  const errors = validateCapabilityReceipt(receipt, { runtime_hash: "c".repeat(64) }, now).errors;
  for (const expected of [
    "receipt-schema-mismatch", "receipt-producer-mismatch", "plugin-version-mismatch", "artifact-schema-mismatch",
    "controller-protocol-mismatch", "sdk-version-mismatch", "platform-mismatch", "node-version-mismatch",
    "os-version-mismatch", "receipt-validity-invalid", "marketplace_git_commit-invalid", "plugin_hash-invalid",
    "cursor-version-missing", "model-attestation-cardinality-mismatch", "certified-models-invalid",
    "audit-high-invalid", "audit-risk-acceptance-invalid", "audit-lockfile-mismatch", "observation-local_mcp-invalid",
    "evidence-hashes-invalid", "capability-vector-invalid", "qualification-binding-invalid",
    "profile-eligibility-not-derived", "runtime_hash-mismatch",
  ]) assert.ok(errors.includes(expected), expected);
});

test("capabilities stay closed without an exact provisioned runtime and receipt", () => {
  const state = mkdtempSync(join(tmpdir(), "workflow-capabilities-"));
  const capabilities = resolveCapabilities(state, { model_catalog_verified: false });
  assert.equal(capabilities.worker_runtime_provisioned, false);
  assert.equal(capabilities.automation_safe, false);
  assert.equal(capabilities.model_catalog_verified, false);
  assert.deepEqual(capabilities.profile_eligibility, { supervised: false, autonomous: false });
});
