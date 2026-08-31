import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { harnessContractHash } from "../src/core/harness-attestations.mjs";
import { supportedCheck } from "./support/workflow-fixtures.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");

test("missing required observation returns an artifact-free internal retry error", () => {
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: root,
    checkEvidence: [],
    effectiveProfile: "manual",
    changedPaths: ["src/retry.mjs"],
    workspaceBinding: harnessContractHash({ workspace: defaultRoot }),
    workspaceSnapshotHash: "a".repeat(64),
    pluginRoot: defaultRoot,
  }), (error) => error.code === "check-observations-incomplete" && error.check_ids?.join(",") === "CHECK-1");
});

test("unknown Check evidence and out-of-authority paths fail closed", () => {
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: root,
    checkEvidence: [{ check_id: "CHECK-99", grade: "supported", observed: "x", limitations: [] }],
    workspaceSnapshotHash: "a".repeat(64),
    pluginRoot: defaultRoot,
  }), /unknown Check/);
  assert.throws(() => buildDeliveryEvidence({
    rootPlanText: root,
    checkEvidence: [supportedCheck()],
    changedPaths: ["outside/file.mjs"],
    workspaceSnapshotHash: "a".repeat(64),
    pluginRoot: defaultRoot,
  }), /outside Root authority|not inside any allowed root|outside root scope/);
});
