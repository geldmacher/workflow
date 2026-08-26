import * as z from "zod/v4";
import { toolAnnotations } from "./tool-annotations.mjs";
import { WORKFLOW_TOOL_NAMES } from "./tool-registry.mjs";
import { reviewInputTransportSchema } from "./review-input-contract.mjs";

const workspaceRoot = z.string().min(1).optional();
const artifact = z.strictObject({ label: z.string().min(1).max(200), text: z.string().min(1).max(250_000) });
const checkEvidence = z.strictObject({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  grade: z.enum(["verified", "supported", "partial", "unavailable", "failed"]),
  observed: z.string().min(1),
  evidence_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(64).optional(),
  limitations: z.array(z.string().min(1)).max(64).optional(),
});

export const WORKFLOW_TOOL_CONTRACTS = Object.freeze({
  workflow_plan_preflight: {
    description: "Validate one exact Schema-6 Root and its intent-only verification contract without executing or selecting tools.",
    inputSchema: { root_plan: z.string().min(1).max(250_000) },
  },
  workflow_artifact_record: {
    description: "Best-effort transport for exact Schema-6 Root artifacts.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: z.array(artifact).min(1).max(32) },
  },
  workflow_artifact_context: {
    description: "Return one exact revalidated artifact chain; transport is never authority.",
    inputSchema: { workspace_root: workspaceRoot, root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/), root_plan: z.string().min(1).max(250_000) },
  },
  workflow_closeout: {
    description: "Build Schema-6 Evidence or Review from intent evidence; verified grade requires protected harness attestations not accepted from caller input.",
    inputSchema: {
      workspace_root: workspaceRoot,
      native_review_receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      root_plan: z.string().min(1).max(250_000).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
      seal_artifacts: z.array(artifact).length(2).optional(),
      artifact_kind: z.enum(["delivery-evidence", "work-review"]).default("delivery-evidence"),
      review_input: reviewInputTransportSchema.optional(),
      effective_profile: z.enum(["manual", "supervised", "autonomous"]).default("manual"),
      changed_paths: z.array(z.string().min(1).max(1000)).max(1000).default([]),
      check_evidence: z.array(checkEvidence).max(128).default([]),
      summary: z.string().min(1).max(2_000).optional(),
    },
  },
  workflow_status: {
    description: "Derive status from an exact Schema-6 artifact chain or one current Workflow-6 Harness Run.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      run_id: z.string().regex(/^run-[a-f0-9]{24}$/).optional(),
      manual_acceptance: z.enum(["provisional"]).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
    },
  },
  workflow_prepare: {
    description: "Advance one revision-bound Workflow-6 Harness Run until its next human gate or terminal state.",
    inputSchema: {
      workspace_root: workspaceRoot,
      action: z.enum(["start", "resume", "approve-correction", "accept-delivery", "stop"]),
      root_plan: z.string().min(1).max(250_000).optional(),
      requested_profile: z.enum(["supervised", "autonomous"]).optional(),
      run_id: z.string().regex(/^run-[a-f0-9]{24}$/).optional(),
      expected_revision: z.number().int().nonnegative().optional(),
      idempotency_key: z.string().min(1).max(200),
      human_decision_receipt: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
    },
  },
});

if (Object.keys(WORKFLOW_TOOL_CONTRACTS).sort().join("\n") !== [...WORKFLOW_TOOL_NAMES].sort().join("\n")) throw new Error("MCP tool contracts differ from the canonical tool registry");

export function toolContract(name) {
  const contract = WORKFLOW_TOOL_CONTRACTS[name];
  if (!contract) throw new Error(`unknown Workflow MCP tool ${name}`);
  return { ...contract, annotations: toolAnnotations(name) };
}
