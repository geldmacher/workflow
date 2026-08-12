import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLAN_CLOSEOUT_ATTESTATION,
  formatDeliveryReportFence,
  formatPlanCloseoutAttestationFence,
} from "../../src/core/manual-attestation.mjs";
import { rootContentHash } from "../../src/core/state-paths.mjs";
import { defaultRoot } from "../../scripts/validate-artifact.source.mjs";

export const planCloseoutFence = formatPlanCloseoutAttestationFence();

export const leanRoot = `---
artifact: work-plan
schema: 5
id: wp-retry
status: ready
intent_ready: true
profile_max: manual
contract_level: lean
risk: medium
hard_triggers: []
goal: Add retries for transient MCP tool failures.
acceptance:
  - Retries pass verification without changing delivery finish lines.
non_goals:
  - No deploy or remote publication.
constraints:
  - Repository-only finish line.
authority:
  allowed_roots:
    - src
    - tests
  protected_paths:
    - .git
  approval_required_paths: []
  dependencies: deny
  external_effects: none
  delivery: repository-only
---

## Intent

Add retries for transient MCP tool failures.

## Acceptance

Retries pass verification without changing delivery finish lines.

### Verification

| Check ID | Objectives | Working Directory | Command or Inspection | Expected Result | Required | Evidence Class | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|---|
| CHECK-1 | OBJ-1 | repository root | node --test tests/codex-hook-policy.test.mjs | Focused Codex hook policy tests pass. | yes | machine-verifiable | standard | src, tests |

## Boundaries

Only listed authority roots.

## Risks

Medium residual risk if retries mask real failures.

## Final implementation step

Verify required Checks and close out delivery.

${planCloseoutFence}
`;

/** Canonical exact Root-content hash used by shared closeout fixtures (raw UTF-8 bytes). */
export const TEST_ROOT_CONTENT_HASH = rootContentHash(leanRoot);

/** CRLF byte-variant of the lean Root; same ID/semantics, different raw authority hash. */
export const leanRootCrlf = leanRoot.replace(/\n/g, "\r\n");
export const TEST_ROOT_CONTENT_HASH_CRLF = rootContentHash(leanRootCrlf);

export const leanRootWithoutCloseout = leanRoot.replace(/\n## Final implementation step[\s\S]*$/, "\n");

export function makeEvidence({
  id = "de-retry",
  rootPlanId = "wp-retry",
  subjectId = "wp-retry",
  sourceReviewId = null,
  predecessorEvidenceId = null,
  representation = "full",
} = {}) {
  let text = readFileSync(join(defaultRoot, "tests/fixtures/artifacts/delivery-evidence.valid.md"), "utf8")
    .replace("id: de-adaptive-retry", `id: ${id}`)
    .replace("root_plan_id: wp-adaptive-retry", `root_plan_id: ${rootPlanId}`)
    .replace("subject_id: wp-adaptive-retry", `subject_id: ${subjectId}`)
    .replace("source_review_id: null", `source_review_id: ${sourceReviewId == null ? "null" : sourceReviewId}`)
    .replace("predecessor_evidence_id: null", `predecessor_evidence_id: ${predecessorEvidenceId == null ? "null" : predecessorEvidenceId}`)
    .replace("representation: full", `representation: ${representation}`);
  if (representation === "delta") {
    text = text
      .replace(
        "## Summary\n\nThe authorized repository change is complete and verified.\n\n## Objective outcomes",
        "## Summary\n\nThe authorized correction is complete and verified.\n\n## Subject results\n\n| Objective ID | Result | Evidence |\n|---|---|---|\n| FIX-1 | achieved | CHECK-1 passed |\n\n## Objective outcomes",
      )
      .replace("| `src/retry.mjs` | Made retry handling deterministic. | OBJ-1 |", "| `src/retry.mjs` | Made retry handling deterministic. | FIX-1 |");
  }
  return text;
}

export function evidenceHash(artifact) {
  return createHash("sha256").update(String(artifact), "utf8").digest("hex");
}

export function closeoutStructured(artifact, overrides = {}) {
  const idMatch = artifact.match(/^id:\s*(de-[A-Za-z0-9-]+)/m);
  const rootMatch = artifact.match(/^root_plan_id:\s*(wp-[A-Za-z0-9-]+)/m);
  const statusMatch = artifact.match(/^status:\s*([a-z-]+)/m);
  const subjectMatch = artifact.match(/^subject_id:\s*(.+)$/m);
  const sourceMatch = artifact.match(/^source_review_id:\s*(.+)$/m);
  const predMatch = artifact.match(/^predecessor_evidence_id:\s*(.+)$/m);
  const normalize = (value) => {
    const text = String(value ?? "").trim();
    return text === "null" ? null : text;
  };
  return {
    delivery_evidence_id: idMatch?.[1] ?? "de-retry",
    artifact,
    artifact_hash: evidenceHash(artifact),
    root_plan_id: rootMatch?.[1] ?? "wp-retry",
    root_content_hash: TEST_ROOT_CONTENT_HASH,
    status: statusMatch?.[1] ?? "complete",
    handoff_persisted: true,
    subject_id: normalize(subjectMatch?.[1]) ?? "wp-retry",
    source_review_id: normalize(sourceMatch?.[1]),
    predecessor_evidence_id: normalize(predMatch?.[1]),
    ...overrides,
  };
}

export function deliveryReportMessage(deliveryEvidenceId, { artifact = null } = {}) {
  const report = formatDeliveryReportFence(deliveryEvidenceId);
  if (!artifact) return `Closeout complete.\n\n${report}\n`;
  const body = String(artifact).endsWith("\n") ? String(artifact) : `${artifact}\n`;
  return `Closeout complete.\n\n\`\`\`yaml\n${body}\`\`\`\n\n${report}\n`;
}

export function closeoutInputMessage({
  phase = "implementation",
  rootPlanId = "wp-retry",
  strategyRevision = 0,
  changedPaths = ["src/retry.mjs"],
  grade = "verified",
  observed = "Focused tests passed.",
  repetitions = 1,
  limitations = [],
  summary = "Implemented the authorized retry behavior and verified the required Check.",
} = {}) {
  return [
    "Native closeout observations:",
    "",
    "```yaml workflow-attestation",
    "schema: 1",
    "kind: closeout-input",
    `phase: ${phase}`,
    `root_plan_id: ${rootPlanId}`,
    `strategy_revision: ${strategyRevision}`,
    "changed_paths:",
    ...(changedPaths.length > 0 ? changedPaths.map((path) => `  - ${path}`) : ["  []"]),
    "check_evidence:",
    "  - check_id: CHECK-1",
    `    grade: ${grade}`,
    "    surface: repository",
    "    method: node --test tests/codex-hook-policy.test.mjs",
    "    expected: Focused tests pass.",
    `    observed: ${observed}`,
    `    repetitions: ${repetitions}`,
    "    limitations:",
    ...(limitations.length > 0 ? limitations.map((item) => `      - ${item}`) : ["      []"]),
    `summary: ${summary}`,
    "```",
  ].join("\n");
}

export function correctionReviewArtifact({
  reviewId = "wr-retry",
  correctionId = "cp-retry",
  rootPlanId = "wp-retry",
  latestEvidenceId,
} = {}) {
  return `---
artifact: work-review
schema: 5
id: ${reviewId}
status: complete
root_plan_id: ${rootPlanId}
latest_evidence_id: ${latestEvidenceId}
assessment: not-achieved
delivery_status: blocked
review_route: inline
next_action: correct
correction_id: ${correctionId}
predecessor_review_id: null
auditors_run: [inline]
inspected_objectives: [OBJ-1]
reused_objectives: []
inspected_checks: [CHECK-1]
reused_checks: []
learning_candidates: [LRN-retry]
---

## Assessment

not-achieved: one correction remains.

## Evidence coverage

| Kind | Inspected | Reused | Result | Evidence |
|---|---|---|---|---|
| Objectives | OBJ-1 | None. | blocked | review |
| Checks | CHECK-1 | None. | blocked | review |
| Auditors | inline | None. | complete | review |
| Snapshot | current | None. | inconsistent | review |

## Findings

| Finding key | Severity | Objectives | Checks | Evidence | Reasoning |
|---|---|---|---|---|---|
| retry-gap | medium | OBJ-1 | CHECK-1 | source | gap |

## Next action

correct: apply ${correctionId}.

## Correction plan

### ${correctionId}

| Correction ID | Root Plan | Source Review | Base Evidence | Predecessor Correction | Risk |
|---|---|---|---|---|---|
| ${correctionId} | ${rootPlanId} | ${reviewId} | ${latestEvidenceId} | None. | medium |

| FIX ID | Finding keys | Root Objectives | Root Checks | Required outcome | Evidence |
|---|---|---|---|---|---|
| FIX-1 | retry-gap | OBJ-1 | CHECK-1 | Close the gap. | review |

| Step ID | FIX IDs | Targets | Required outcome | Implementation latitude | Completion probe | Check IDs | Deviation action |
|---|---|---|---|---|---|---|---|
| STEP-1 | FIX-1 | src/retry.mjs | Close the gap. | Focused edit. | PROBE-1: CHECK-101 passes. | CHECK-101 | Stop on scope change. |

| Check ID | FIX IDs | Working Directory | Command or Inspection | Expected Result | Required | Cost Class | Prerequisites |
|---|---|---|---|---|---|---|---|
| CHECK-101 | FIX-1 | repository root | node --test | pass | yes | standard | src, tests |

| Learning ID | Finding keys | Reusable guidance | Candidate targets | Confirmation evidence |
|---|---|---|---|---|
| LRN-retry | retry-gap | Keep lineage exact. | tests guidance | correction evidence |
`;
}

export const finalCloseoutTodo = Object.freeze({
  id: "closeout",
  content: "[workflow-model-inherit-v1] Verify checks and close out delivery.",
  workflow_attestation: { ...PLAN_CLOSEOUT_ATTESTATION },
});

/** Shared adversarial lifecycle cases consumed by core, Cursor, Codex source, and bundle tests. */
export const SHARED_LIFECYCLE_CASES = Object.freeze([
  Object.freeze({ id: "foreign-full-root-lineage", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "text-transport-authority", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "conflicting-structured-content", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "persisted-artifact-dump", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "unpersisted-duplicate-occurrence", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "mutate-after-closeout", expect: "invalidate", surfaces: Object.freeze(["cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "missing-active-root", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "foreign-active-root", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "same-id-root-hash-mismatch", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
  Object.freeze({ id: "crlf-active-root-hash-mismatch", expect: "reject", surfaces: Object.freeze(["kernel", "cursor", "codex", "bundle"]) }),
]);

export function sharedLifecycleCasesFor(surface) {
  return SHARED_LIFECYCLE_CASES.filter((entry) => entry.surfaces.includes(surface));
}
export const SHARED_LIFECYCLE_CASE_IDS = Object.freeze(SHARED_LIFECYCLE_CASES.map((entry) => entry.id));

/** Shared adversarial cases for plan-closeout presentation. */
export const PLAN_CLOSEOUT_REJECT_CASES = [
  {
    id: "missing-final-step",
    text: leanRootWithoutCloseout,
    requireFinalStepSection: true,
  },
  {
    id: "negated-fence",
    text: leanRootWithoutCloseout + `\n## Final implementation step\n\nDo not use attestation.\n\n${planCloseoutFence}\n`,
    requireFinalStepSection: true,
  },
  {
    id: "indented-fence",
    text: leanRootWithoutCloseout + `\n## Final implementation step\n\nVerify checks.\n\n    ${planCloseoutFence.split("\n").join("\n    ")}\n`,
    requireFinalStepSection: true,
  },
  {
    id: "tilde-fence",
    text: leanRootWithoutCloseout + `\n## Final implementation step\n\nVerify checks.\n\n~~~yaml workflow-attestation\nschema: 1\nkind: plan-closeout\naction: workflow_closeout\n~~~\n`,
    requireFinalStepSection: true,
  },
  {
    id: "legacy-marker-prose",
    text: leanRootWithoutCloseout + `\n## Final implementation step\n\n[workflow-closeout-v1] Call workflow_closeout with the exact Root/chain.\n`,
    requireFinalStepSection: true,
  },
  {
    id: "duplicate-attestation",
    text: leanRootWithoutCloseout + `\n## Final implementation step\n\nVerify checks.\n\n${planCloseoutFence}\n\n${planCloseoutFence}\n`,
    requireFinalStepSection: true,
  },
];
