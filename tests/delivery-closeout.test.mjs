import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { defaultRoot, inspectArtifactText } from "../scripts/validate-artifact.source.mjs";
import { buildDeliveryEvidence } from "../src/controller/delivery-closeout.mjs";
import { harnessContractHash } from "../src/core/harness-attestations.mjs";

const root = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/work-plan.valid.md"), "utf8");

test("missing harness observation creates valid provisional Schema-6 Evidence", () => {
  const evidence = buildDeliveryEvidence({
    rootPlanText: root,
    checkEvidence: [],
    effectiveProfile: "manual",
    changedPaths: ["src/retry.mjs"],
    workspaceBinding: harnessContractHash({ workspace: defaultRoot }),
    workspaceSnapshotHash: "a".repeat(64),
    pluginRoot: defaultRoot,
  });
  assert.equal(evidence.fields.schema, 6);
  assert.equal(evidence.fields.status, "provisional");
  assert.equal(evidence.fields.check_evidence[0].grade, "unavailable");
  assert.match(evidence.fields.check_evidence[0].limitations.join("\n"), /harness/i);
  assert.deepEqual(inspectArtifactText(evidence.artifact, defaultRoot).errors, []);
  assert.doesNotMatch(evidence.artifact, /Working Directory|Command or Inspection|surface:|method:|repetitions:/);
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
    checkEvidence: [],
    changedPaths: ["outside/file.mjs"],
    workspaceSnapshotHash: "a".repeat(64),
    pluginRoot: defaultRoot,
  }), /outside Root authority|not inside any allowed root|outside root scope/);
});
