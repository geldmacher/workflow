import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { build } from "esbuild";
import { executeManualOperation, serializeManualResult } from "../src/manual/manual-workflow.mjs";
import { inspectArtifactText, validateArtifactText } from "../scripts/validate-artifact.source.mjs";
import { defaultRoot } from "../scripts/validate-artifact.source.mjs";
import {
  achievedReviewInput,
  authorityCore,
  manualSupportedObservation,
  nativePlan,
  planMarkdown,
  rootPlan,
} from "./support/workflow-fixtures.mjs";

function repositoryObservation({ subject = ["src/retry.mjs"], ambient = [], limitations = [] } = {}) {
  return {
    schema: 1,
    kind: "unprotected-repository-observation",
    repository_root: defaultRoot,
    subject_changed_paths: subject,
    ambient_changed_paths: ambient,
    snapshot_material: ["git tree and focused repository checks at the current snapshot"],
    limitations,
  };
}

function buildReviewRequest(overrides = {}) {
  return {
    schema: 1,
    operation: "build-review",
    root_plan: nativePlan(),
    artifacts: [],
    review_input: achievedReviewInput(),
    repository_observation: repositoryObservation(),
    check_observations: [manualSupportedObservation()],
    presentation_locale: "en",
    ...overrides,
  };
}

function correctionInput() {
  return {
    schema: 1,
    kind: "review-input",
    outcome: "correction-needed",
    assessment_summary: "One current Root outcome needs a bounded correction.",
    snapshot_summary: "The exact current snapshot was inspected read-only.",
    findings: [{
      key: "retry-backoff",
      severity: "medium",
      objective_ids: ["OBJ-1"],
      check_ids: ["CHECK-1"],
      evidence: "The retry path still lacks bounded backoff.",
      reasoning: "The change is correctable inside the approved src authority.",
      resolution: "correct",
    }],
    open_points: [],
    correction: {
      fixes: [{ key: "fix-backoff", finding_keys: ["retry-backoff"], required_outcome: "Retry backoff satisfies the approved behavior.", evidence: "The Finding identifies the current gap." }],
      steps: [{
        key: "implement-backoff",
        fix_keys: ["fix-backoff"],
        targets: ["src"],
        required_outcome: "Retry behavior satisfies OBJ-1.",
        implementation_latitude: "Use the smallest project-appropriate change.",
        completion_probe: "Inspect the changed behavior locally before handoff.",
        root_check_ids: ["CHECK-1"],
        deviation_action: "Report an Open Point instead of expanding scope.",
      }],
    },
  };
}

test("build-plan accepts arbitrary Markdown and deterministically generates one bound Core", () => {
  const request = {
    schema: 1,
    operation: "build-plan",
    plan_markdown: `${planMarkdown}\n## Unordered appendix\n\n| Free | Form |\n|---|---|\n| yes | yes |\n`,
    authority_core: authorityCore(),
    presentation_locale: "en",
  };
  const first = executeManualOperation("build-plan", request);
  const second = executeManualOperation("build-plan", request);
  assert.equal(first.ok, true);
  assert.equal(first.root_plan, second.root_plan);
  assert.equal((first.root_plan.match(/```yaml workflow-authority/g) ?? []).length, 1);
  assert.match(first.root_plan, /plan_content_hash: [a-f0-9]{64}/);
  assert.match(first.root_plan, /authority_hash: [a-f0-9]{64}/);
  assert.deepEqual(validateArtifactText(first.root_plan), []);
  assert.equal(first.artifacts.length, 0);
});

test("validate-plan checks Core and hashes but not editorial structure", () => {
  const valid = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan(), presentation_locale: "de" });
  assert.equal(valid.ok, true);
  assert.equal(valid.root_plan_id, "wp-adaptive-retry");
  assert.match(valid.human_output, /Planvalidierung/);
  const tamperedText = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan().replace("Adaptive retry delivery", "Changed delivery") });
  assert.equal(tamperedText.ok, false);
  assert.match(JSON.stringify(tamperedText.result.blocking_issues), /plan_content_hash/);
  const tamperedCore = executeManualOperation("validate-plan", { schema: 1, operation: "validate-plan", root_plan: nativePlan().replace("risk: medium", "risk: high") });
  assert.equal(tamperedCore.ok, false);
  assert.match(JSON.stringify(tamperedCore.result.blocking_issues), /authority_hash/);
});

test("closed public request schema and runtime reject removed operations and unknown input", () => {
  const schema = JSON.parse(readFileSync(new URL("../schemas/manual-workflow/request-1.schema.json", import.meta.url), "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(buildReviewRequest()), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...buildReviewRequest(), delivery_status: "provisional" }), false);
  assert.equal(validate({ schema: 1, operation: "accept-provisional", root_plan: rootPlan(), artifacts: [] }), false);
  const removed = executeManualOperation("accept-provisional", { schema: 1, operation: "accept-provisional", root_plan: rootPlan(), artifacts: [] });
  assert.equal(removed.ok, false);
  assert.equal(removed.error.code, "unsupported-operation");
  assert.equal(removed.next_action, "human-assessment");
});

test("finding-free supported result is Achieved without Delivery provisional", () => {
  const result = executeManualOperation("build-review", buildReviewRequest());
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "achieved");
  assert.equal(result.presentation.next_action, "none");
  assert.equal(result.artifacts.length, 2);
  assert.match(result.human_output, /^## Review · achieved/);
  assert.doesNotMatch(result.human_output, /Delivery provisional|accept-provisional|Accept Work/i);
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.outcome, "achieved");
  assert.ok(!Object.hasOwn(review.fields, "delivery_status"));
});

test("a large German achieved review stays compact while artifacts retain exact detail", () => {
  const verification = Array.from({ length: 6 }, (_, index) => ({
    ...authorityCore().verification[0],
    check_id: `CHECK-${index + 1}`,
    verification_intent: `Observe repository outcome ${index + 1}.`,
    expected_evidence: `Current repository observation ${index + 1}.`,
  }));
  const subject = Array.from({ length: 42 }, (_, index) => `src/review-output-${index + 1}.mjs`);
  const result = executeManualOperation("build-review", buildReviewRequest({
    root_plan: nativePlan("manual", { verification }),
    repository_observation: repositoryObservation({ subject }),
    check_observations: verification.map(({ check_id }, index) => ({
      ...manualSupportedObservation(check_id),
      ...(index === 0 ? { observed: `A long observation with a | separator: ${"detail ".repeat(60)}` } : {}),
    })),
    presentation_locale: "de",
  }));

  assert.equal(result.presentation.outcome, "achieved");
  assert.match(result.human_output, /^## Review · erreicht/);
  assert.match(result.human_output, /Checks: 6\/6 ausreichend belegt \(6 manuell gestützt\)\./);
  assert.match(result.human_output, /Abweichungen: keine Feststellungen oder offenen Punkte\./);
  assert.match(result.human_output, /Umfang: 42\/42 Lieferpfade innerhalb der Autorität\./);
  assert.match(result.human_output, /Nachweis: gestützt – durch aktuelle manuelle Beobachtungen belegt, aber nicht geschützt verifiziert\./);
  assert.equal((result.human_output.match(/<details>/g) ?? []).length, 1);
  assert.equal((result.human_output.match(/### Nächste Aktion/g) ?? []).length, 1);
  assert.doesNotMatch(result.human_output, /### Feststellungen|### Offene Punkte/);
  assert.doesNotMatch(result.human_output, /[a-f0-9]{64}/);
  assert.doesNotMatch(result.human_output, /src\/review-output-1\.mjs/);
  assert.match(result.human_output, /\\\| separator: .* …/);
  assert.match(result.artifacts[0].text, /src\/review-output-1\.mjs/);
});

test("an unchanged review chain is reused while repository drift replaces only its evidence suffix", () => {
  const first = executeManualOperation("build-review", buildReviewRequest());
  const artifacts = first.artifacts.map(({ label, text }) => ({ label, text }));
  const reused = executeManualOperation("build-review", buildReviewRequest({ artifacts }));
  assert.equal(reused.ok, true);
  assert.equal(reused.chain_update, "reuse");
  assert.equal(reused.artifacts[0].text, first.artifacts[0].text);

  const changedObservation = repositoryObservation();
  changedObservation.snapshot_material = ["a different exact repository snapshot and focused check result"];
  const replaced = executeManualOperation("build-review", buildReviewRequest({
    artifacts,
    repository_observation: changedObservation,
  }));
  assert.equal(replaced.ok, true);
  assert.match(replaced.chain_update, /^replace-/);
  assert.notEqual(replaced.artifacts[0].text, first.artifacts[0].text);
});

test("invalid Check observation evidence and limitations fail through the closed Shadow projection", () => {
  for (const check of [
    { check_id: "CHECK-1", grade: "supported", observed: "No evidence supplied.", evidence_material: [], limitations: [] },
    { check_id: "CHECK-1", grade: "partial", observed: "No limitation supplied.", evidence_material: ["partial output"], limitations: [] },
  ]) {
    const result = executeManualOperation("build-review", buildReviewRequest({
      check_observations: [check],
      presentation_locale: "de",
    }));
    assert.equal(result.ok, false);
    assert.equal(result.kind, "manual-workflow-error");
    assert.equal(result.error.code, "manual-input-invalid");
    assert.match(result.human_output, /geschlossene Eingabe/i);
  }
});

test("missing required observations return an artifact-free internal retry with exact IDs", () => {
  const result = executeManualOperation("build-review", buildReviewRequest({ check_observations: [] }));
  assert.equal(result.kind, "manual-review-internal-retry");
  assert.equal(result.mode, "internal-retry");
  assert.deepEqual(result.missing_check_ids, ["CHECK-1"]);
  assert.match(result.retry_signature, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.next_action, "internal-retry");
});

test("explicit required-Check unavailability becomes a concrete Open Point", () => {
  const unavailable = {
    check_id: "CHECK-1",
    grade: "unavailable",
    observed: "The integrated environment could not start.",
    evidence_material: [],
    limitations: ["The environment endpoint was unavailable."],
  };
  const result = executeManualOperation("build-review", buildReviewRequest({ check_observations: [unavailable] }));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "open-points");
  assert.equal(result.presentation.next_action, "human-assessment");
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.open_points[0].type, "environment");
  assert.match(review.fields.open_points[0].evidence, /endpoint was unavailable/);
  assert.match(result.human_output, /### Open points/);
  assert.match(result.human_output, /Impact:/);
  assert.match(result.human_output, /Question:/);
  assert.equal((result.human_output.match(/<details>/g) ?? []).length, 1);

  const de = executeManualOperation("build-review", buildReviewRequest({ check_observations: [unavailable], presentation_locale: "de" }));
  assert.match(de.human_output, /Nachweis: nicht verfügbar – ein erforderlicher Nachweis konnte nicht erhoben werden\./);
});

test("partial proof is stated plainly and retains its concrete limitation", () => {
  const partial = {
    check_id: "CHECK-1",
    grade: "partial",
    observed: "The primary repository behavior was observed, but one variant remains unobserved.",
    evidence_material: ["focused primary-path verification output"],
    limitations: ["The secondary runtime variant could not be observed."],
  };
  const result = executeManualOperation("build-review", buildReviewRequest({
    check_observations: [partial],
    review_input: achievedReviewInput({
      outcome: "open-points",
      open_points: [{
        key: "secondary-runtime",
        type: "environment",
        summary: "The secondary runtime variant remains unobserved.",
        evidence: "Only the primary runtime was available.",
        impact: "Proof remains partial for that variant.",
        question: "Is the observed primary runtime sufficient for this delivery?",
      }],
    }),
  }));

  assert.equal(result.presentation.evidence_grade, "partial");
  assert.match(result.human_output, /Proof: partial – the available observations do not fully support the outcome\./);
  assert.match(result.human_output, /The secondary runtime variant could not be observed\./);

  const de = executeManualOperation("build-review", {
    ...buildReviewRequest({ check_observations: [partial] }),
    review_input: achievedReviewInput({
      outcome: "open-points",
      open_points: [{
        key: "secondary-runtime",
        type: "environment",
        summary: "The secondary runtime variant remains unobserved.",
        evidence: "Only the primary runtime was available.",
        impact: "Proof remains partial for that variant.",
        question: "Is the observed primary runtime sufficient for this delivery?",
      }],
    }),
    presentation_locale: "de",
  });
  assert.match(de.human_output, /Nachweis: teilweise – die vorhandenen Beobachtungen belegen das Ergebnis nicht vollständig\./);
});

test("a truly red unrelated integrated Check can end as a named Open Point", () => {
  const request = buildReviewRequest({
    review_input: {
      ...achievedReviewInput(),
      outcome: "open-points",
      assessment_summary: "An unrelated integrated gate is red.",
      open_points: [{
        key: "unrelated-red-gate",
        type: "environment",
        summary: "An integrated gate unrelated to the delivered behavior is red.",
        evidence: "The gate reports an exact unrelated fixture failure.",
        impact: "The full integrated environment is not green although the planned behavior is implemented.",
        question: "Should the human close this delivery with the unrelated gate recorded as open?",
      }],
    },
    check_observations: [{
      check_id: "CHECK-1",
      grade: "failed",
      observed: "The integrated gate failed on an unrelated fixture.",
      evidence_material: ["unrelated fixture failure output"],
      limitations: ["CHECK-1 failed and blocks delivery."],
    }],
  });
  const result = executeManualOperation("build-review", request);
  assert.equal(result.presentation.outcome, "open-points");
  assert.match(result.human_output, /An integrated gate unrelated to the delivered behavior is red\./);
  assert.match(result.human_output, /Impact: The full integrated environment is not green/);
  assert.match(result.human_output, /Question: Should the human close this delivery/);

  const de = executeManualOperation("build-review", { ...request, presentation_locale: "de" });
  assert.match(de.human_output, /Nachweis: fehlgeschlagen – mindestens ein erforderlicher Check ist nicht erfüllt\./);
  assert.match(de.human_output, /CHECK-1 ist fehlgeschlagen und blockiert die Lieferung\./);
});

test("mixed correctable Findings take precedence and retain Open Points in one Correction", () => {
  const input = correctionInput();
  input.open_points.push({
    key: "proof-limit",
    type: "evidence",
    summary: "Protected proof is unavailable.",
    evidence: "Only supported repository evidence exists.",
    impact: "Proof remains supported.",
    question: "Is supported proof sufficient for the human assessment?",
  });
  const result = executeManualOperation("build-review", buildReviewRequest({ review_input: input }));
  assert.equal(result.presentation.outcome, "correction-needed");
  assert.equal(result.presentation.next_action, "correct");
  const review = inspectArtifactText(result.artifacts[1].text).artifact;
  assert.equal(review.fields.correction_id.startsWith("cp-"), true);
  assert.equal(review.fields.open_points.length, 1);
  assert.match(result.artifacts[1].text, /\| CHECK-1 \|/);
  assert.doesNotMatch(result.artifacts[1].text, /CORR-CHECK|FIX-CHECK/);
});

test("outside-authority and protected subject paths become Authority Open Points, ambient paths do not", () => {
  for (const subject of [["README.md"], [".git/config"], [".github/workflows/ci.yml"]]) {
    const result = executeManualOperation("build-review", buildReviewRequest({ repository_observation: repositoryObservation({ subject }) }));
    assert.equal(result.presentation.outcome, "open-points");
    assert.equal(inspectArtifactText(result.artifacts[1].text).artifact.fields.open_points[0].type, "authority");
    assert.match(result.human_output, new RegExp(subject[0].replaceAll(".", "\\.")));
  }
  const ambient = executeManualOperation("build-review", buildReviewRequest({ repository_observation: repositoryObservation({ subject: ["src/retry.mjs"], ambient: ["README.md"] }) }));
  assert.equal(ambient.presentation.outcome, "achieved");
  assert.deepEqual(ambient.path_authority.ambient_paths, ["README.md"]);
  assert.match(ambient.human_output, /README\.md/);
  assert.doesNotMatch(ambient.human_output, /src\/retry\.mjs/);
});

for (const [locale, heading, bindingSummary, nextAction, action] of [
  ["de", "## Shadow Review · formale Bindung fehlt", "Der menschliche Plan ist nicht an einen gültigen Authority Core gebunden.", "### Nächste Aktion", "- Bitte beurteilen Sie die konkret benannten offenen Punkte in natürlicher Sprache."],
  ["en", "## Shadow review · formal binding missing", "The human plan is not bound to a valid Authority Core.", "### Next action", "- Please assess the specifically named open points in natural language."],
]) test(`invalid formal binding returns a useful read-only Shadow Review in ${locale}`, () => {
  const reviewInput = correctionInput();
  const result = executeManualOperation("build-review", buildReviewRequest({
    root_plan: `${planMarkdown}\nNo generated Authority Core.\n`,
    review_input: reviewInput,
    presentation_locale: locale,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.kind, "manual-shadow-review");
  assert.equal(result.outcome, "shadow-review");
  assert.equal(result.next_action, "human-assessment");
  assert.equal(result.findings[0].key, "retry-backoff");
  assert.equal(result.open_points.at(-1).type, "formal-binding");
  assert.equal(result.open_points.at(-1).summary, bindingSummary);
  assert.equal(result.human_output.split("\n")[0], heading);
  assert.deepEqual(result.artifacts, []);
  assert.doesNotMatch(result.human_output, /Correct Work/);
  assert.equal((result.human_output.match(/retry-backoff/g) ?? []).length, 1);
  assert.equal(result.human_output.split(bindingSummary).length - 1, 1);
  assert.equal(result.human_output.split(nextAction).length - 1, 1);
  assert.equal(result.human_output.split(action).length - 1, 1);
  assert.equal(result.human_output.split(nextAction)[1].trim(), action);
  assert.doesNotMatch(result.human_output, /<details>|[a-f0-9]{64}/);
});

test("verified evidence is projected in both locales without opening the Manual evidence boundary", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "workflow-review-presentation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const outfile = join(directory, "manual-presentation.mjs");
  // Expose the real private projection only in this disposable test bundle.
  // The shipped entrypoint and its closed request schema remain unchanged.
  await build({
    entryPoints: [join(defaultRoot, "src/manual/manual-workflow.mjs")],
    bundle: true,
    outfile,
    format: "esm",
    platform: "node",
    target: "node22",
    banner: { js: 'import { createRequire as __workflowCreateRequire } from "node:module"; const require = __workflowCreateRequire(import.meta.url);' },
    footer: { js: "export { reviewPresentation as __reviewPresentation };" },
  });
  const { __reviewPresentation } = await import(pathToFileURL(outfile).href);
  const input = {
    rootFields: { id: "wp-presentation-fixture" },
    evidence: { fields: {
      id: "de-presentation-fixture",
      overall_grade: "verified",
      check_evidence: [{ check_id: "CHECK-1", grade: "verified", observed: "Protected evidence fixture.", evidence_hashes: ["a".repeat(64)], limitations: [] }],
    } },
    review: { fields: { id: "wr-presentation-fixture", outcome: "achieved", next_action: "none" } },
    reviewInput: { findings: [], open_points: [] },
    repositoryObservation: { limitations: [] },
    pathAuthority: {
      allowed_paths: ["src/retry.mjs"], outside_allowed_paths: [],
      approval_required_paths: [], protected_paths: [], ambient_paths: [],
    },
    requiredCheckIds: ["CHECK-1"],
  };
  for (const [locale, proof, checks, grade, action] of [
    ["de", "- Nachweis: verifiziert – geschützt an Root und Repository-Snapshot gebunden.", "- Checks: 1/1 ausreichend belegt (1 geschützt verifiziert).", "verifiziert", "- Keine weitere Workflow-Aktion erforderlich."],
    ["en", "- Proof: verified – protected and bound to the Root and repository snapshot.", "- Checks: 1/1 sufficiently supported (1 protected and verified).", "verified", "- No further Workflow action is required."],
  ]) {
    const { presentation, humanOutput } = __reviewPresentation({ ...input, locale });
    const lines = humanOutput.split("\n");
    assert.equal(presentation.evidence_grade, "verified");
    assert.equal(presentation.outcome, "achieved");
    assert.equal(presentation.next_action, "none");
    for (const expected of [proof, checks, action]) {
      assert.equal(lines.filter((line) => line === expected).length, 1, `${locale}: ${expected}`);
    }
    assert.ok(lines.includes(`| CHECK-1 | ${grade} | Protected evidence fixture. |`));
    assert.equal((humanOutput.match(/<details>/g) ?? []).length, 1);
    assert.doesNotMatch(humanOutput, /[a-f0-9]{64}|src\/retry\.mjs/);

    const rejected = executeManualOperation("build-review", buildReviewRequest({
      check_observations: [{ ...manualSupportedObservation(), grade: "verified" }],
      presentation_locale: locale,
    }));
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "manual-input-invalid");
    assert.deepEqual(rejected.artifacts, []);
  }
});

test("German and English presentation lead with exact result and one human action", () => {
  const en = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput(), presentation_locale: "en" }));
  const de = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput(), presentation_locale: "de" }));
  assert.match(en.human_output, /^## Review · correction needed/);
  assert.match(de.human_output, /^## Review · Korrektur erforderlich/);
  assert.equal((en.human_output.match(/\*\*Correct Work\*\*/g) ?? []).length, 1);
  assert.equal((de.human_output.match(/\*\*Correct Work\*\*/g) ?? []).length, 1);
  assert.equal((en.human_output.match(/<details>/g) ?? []).length, 1);
  assert.equal((de.human_output.match(/<details>/g) ?? []).length, 1);
  assert.equal((en.human_output.match(/retry-backoff/g) ?? []).length, 1);
  assert.equal((de.human_output.match(/retry-backoff/g) ?? []).length, 1);
  assert.doesNotMatch(en.human_output, /[a-f0-9]{64}/);
  assert.doesNotMatch(de.human_output, /[a-f0-9]{64}/);
  assert.equal(en.artifacts[1].text, de.artifacts[1].text);
  assert.equal(serializeManualResult(en), serializeManualResult(en));
});

test("status exposes only Root ready, Review needed, Correction needed, Achieved, Open points, or Shadow Review", () => {
  const built = executeManualOperation("build-review", buildReviewRequest({ review_input: correctionInput() }));
  const status = executeManualOperation("status", {
    schema: 1,
    operation: "status",
    root_plan: nativePlan(),
    artifacts: built.artifacts.map(({ label, text }) => ({ label, text })),
    presentation_locale: "en",
  });
  assert.equal(status.snapshot.state, "correction-needed");
  assert.equal(status.snapshot.next_action, "correct");
  assert.doesNotMatch(status.human_output, /accept|clarify|replan|retry review/i);
});

test("optional Root Checks may be omitted while required observations remain explicit", () => {
  const verification = [
    ...authorityCore().verification,
    {
      check_id: "CHECK-2",
      objectives: ["OBJ-1"],
      verification_intent: "Observe an optional secondary signal.",
      expected_evidence: "Optional repository observation.",
      required: false,
      evidence_class: "reviewer-observable",
      cost_class: "cheap",
      prerequisites: ["The secondary surface is present."],
    },
  ];
  const plan = nativePlan("manual", { verification });
  const result = executeManualOperation("build-review", buildReviewRequest({ root_plan: plan }));
  assert.equal(result.ok, true);
  assert.equal(result.presentation.outcome, "achieved");
});

test("an optional-only review reports no required Checks or subject paths", () => {
  const verification = [{ ...authorityCore().verification[0], required: false }];
  const result = executeManualOperation("build-review", buildReviewRequest({
    root_plan: nativePlan("manual", { verification }),
    repository_observation: repositoryObservation({ subject: [] }),
    check_observations: [manualSupportedObservation()],
  }));

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.presentation.outcome, "achieved");
  assert.match(result.human_output, /Checks: no required Checks\./);
  assert.match(result.human_output, /Scope: no subject paths\./);
  assert.equal((result.human_output.match(/<details>/g) ?? []).length, 1);
});
