import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  approveVerificationProfile,
  auditVerificationProfile,
  draftVerificationProfile,
  inspectVerificationProfile,
  recordVerificationProof,
  VERIFICATION_CAPABILITIES,
} from "../src/controller/verification-profile.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";

test("verification draft creates a closed manifest, project skill, and feature map without overwriting", () => {
  const workspace = mkdtempSync(join(tmpdir(), "workflow-verification-"));
  try {
    const drafted = draftVerificationProfile(workspace, "Desktop UI", defaultRoot);
    assert.equal(drafted.inspection.valid, true);
    assert.equal(drafted.inspection.manifest.artifact_policy, "external-only");
    assert.deepEqual(drafted.inspection.manifest.capabilities, VERIFICATION_CAPABILITIES);
    assert.throws(() => draftVerificationProfile(workspace, "Desktop UI", defaultRoot), /refuses to overwrite/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test("prove and human approval bind the exact combined profile hash", () => {
  const workspace = mkdtempSync(join(tmpdir(), "workflow-verification-"));
  const state = mkdtempSync(join(tmpdir(), "workflow-verification-state-"));
  try {
    const inspection = draftVerificationProfile(workspace, "CLI", defaultRoot).inspection;
    const capabilities = Object.fromEntries(VERIFICATION_CAPABILITIES.map((capability) => [capability, true]));
    recordVerificationProof(state, inspection, { capabilities, evidence_hashes: ["a".repeat(64)] });
    approveVerificationProfile(state, inspection.manifest.profile_id, inspection.profile_hash);
    assert.equal(auditVerificationProfile(workspace, ".cursor/workflow-verification.yaml", defaultRoot, state).status, "clean");
    const featureMap = join(workspace, inspection.manifest.feature_map_path);
    writeFileSync(featureMap, `${readFileSync(featureMap, "utf8")}# drift\n`);
    assert.equal(auditVerificationProfile(workspace, ".cursor/workflow-verification.yaml", defaultRoot, state).status, "changed");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(state, { recursive: true, force: true });
  }
});

test("incomplete proof cannot be activated", () => {
  const workspace = mkdtempSync(join(tmpdir(), "workflow-verification-"));
  const state = mkdtempSync(join(tmpdir(), "workflow-verification-state-"));
  try {
    const inspection = draftVerificationProfile(workspace, "API", defaultRoot).inspection;
    assert.throws(() => recordVerificationProof(state, inspection, { capabilities: { launch: true }, evidence_hashes: ["a".repeat(64)] }), /did not demonstrate/);
    assert.throws(() => approveVerificationProfile(state, inspection.manifest.profile_id, inspection.profile_hash), /no current proof/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(state, { recursive: true, force: true });
  }
});
