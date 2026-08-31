import assert from "node:assert/strict";
import test from "node:test";
import {
  executionContractFromArtifactText,
  extractEmbeddedWorkPlanText,
  inspectArtifactText,
  validateArtifactText,
} from "../scripts/validate-artifact.source.mjs";
import { buildWorkflowAuthorityPlan } from "../src/core/workflow-authority-core.mjs";
import { authorityCore, nativePlan, planMarkdown, rootPlan } from "./support/workflow-fixtures.mjs";

test("free-form Markdown plus one generated Authority Core is the only current plan representation", () => {
  const native = nativePlan();
  assert.deepEqual(validateArtifactText(native), []);
  assert.equal((native.match(/```yaml workflow-authority/g) ?? []).length, 1);
  assert.ok(!native.includes("artifact-envelope"));
  const exact = extractEmbeddedWorkPlanText(native);
  assert.ok(exact?.startsWith("---\nartifact: work-plan"));
  const inspected = inspectArtifactText(native);
  assert.equal(inspected.artifact.fields.extensions.workflow_authority_core, 1);
  assert.match(inspected.artifact.fields.plan_content_hash, /^[a-f0-9]{64}$/);
  assert.match(inspected.artifact.fields.authority_hash, /^[a-f0-9]{64}$/);
});

test("arbitrary headings, tables, and host frontmatter do not become authority", () => {
  const markdown = `---\nname: Host title\ntodos: []\n---\n# Any title\n\n| A | B |\n|---|---|\n| x | y |\n\nNo required section order.\n`;
  const built = buildWorkflowAuthorityPlan(markdown, authorityCore());
  assert.deepEqual(validateArtifactText(built.root_plan), []);
  const contract = executionContractFromArtifactText(built.root_plan);
  assert.deepEqual(contract.objectives, ["OBJ-1"]);
  assert.equal(contract.checks[0]["Check ID"], "CHECK-1");
});

test("plan text, Core, duplicate Core, and placement tampering are rejected", () => {
  const native = nativePlan();
  assert.match(validateArtifactText(native.replace("Adaptive retry delivery", "Changed delivery"))[0], /plan_content_hash/i);
  assert.match(validateArtifactText(native.replace("risk: medium", "risk: high"))[0], /authority_hash/i);
  assert.match(validateArtifactText(`${native}\n${native.match(/<details>[\s\S]*<\/details>/)[0]}\n`)[0], /exactly one|at the end/i);
  assert.match(validateArtifactText(`${native}\nTrailing host prose.\n`)[0], /at the end/i);
});

test("build-plan deterministically binds plan and Core while allowing opaque current extensions", () => {
  const first = buildWorkflowAuthorityPlan(planMarkdown, authorityCore("manual", { extensions: { project_note: { value: 1 } } }));
  const second = buildWorkflowAuthorityPlan(planMarkdown.replace(/\n/g, "\r\n"), authorityCore("manual", { extensions: { project_note: { value: 1 } } }));
  assert.equal(first.root_plan, second.root_plan);
  assert.deepEqual(validateArtifactText(first.root_plan), []);
  assert.deepEqual(inspectArtifactText(first.root_plan).artifact.fields.extensions.project_note, { value: 1 });
});

test("old plan envelopes and unsupported schemas fail clearly without a compatibility path", () => {
  const old = `\`\`\`yaml artifact-envelope\nartifact: work-plan\nschema: 6\nid: wp-old\nstatus: ready\n\`\`\`\n\n## Intent\n\nOld.\n`;
  assert.match(validateArtifactText(old).join(" "), /workflow-authority|unsupported|frontmatter/i);
  const wrongSchema = nativePlan().replace("schema: 6", "schema: 5");
  assert.match(validateArtifactText(wrongSchema).join(" "), /schema 6|unsupported/i);
});

test("closed Authority Core rejects execution policy fields", () => {
  assert.throws(() => buildWorkflowAuthorityPlan(planMarkdown, { ...authorityCore(), working_directory: "." }), /unsupported field working_directory/);
  assert.deepEqual(validateArtifactText(rootPlan()), []);
});
