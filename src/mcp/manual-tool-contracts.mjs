import * as z from "zod/v4";
import { manualToolAnnotations } from "./manual-tool-annotations.mjs";
import { reviewInputTransportSchema } from "./review-input-contract.mjs";

const workspaceRoot = z.string().min(1).optional();
const artifact = z.object({
  label: z.string().min(1).max(200),
  text: z.string().min(1).max(250_000),
});
const checkEvidence = z.object({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  grade: z.enum(["verified", "supported", "partial", "unavailable", "failed"]),
  observed: z.string().min(1),
  evidence_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(64).optional(),
  limitations: z.array(z.string().min(1)).max(64).optional(),
}).strict();

const contracts = Object.freeze({
  workflow_plan_preflight: {
    description: "Validate one exact Schema-6 Root and its intent-only verification contract without workspace discovery, execution, persistence, approval, or mutation.",
    inputSchema: { root_plan: z.string().min(1).max(250_000) },
  },
  workflow_artifact_record: {
    description: "Best-effort transport for exact Schema-6 work-plan artifacts.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: z.array(artifact).min(1).max(32) },
  },
  workflow_artifact_context: {
    description: "Best-effort transport enrichment for one exact revalidated Schema-6 artifact chain.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: z.string().min(1).max(250_000),
    },
  },
  workflow_closeout: {
    description: "Build one formally bound Schema-6 delivery-evidence or work-review artifact, or return a chat-only Shadow Review when the formal Review binding is merely unavailable. Concrete execution is never accepted or interpreted; verified evidence requires protected harness attestations.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: z.string().min(1).max(250_000).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
      seal_artifacts: z.array(artifact).length(2).optional(),
      artifact_kind: z.enum(["delivery-evidence", "work-review"]).default("delivery-evidence"),
      review_input: reviewInputTransportSchema.optional(),
      effective_profile: z.literal("manual").default("manual"),
      changed_paths: z.array(z.string().min(1).max(1000)).max(1000).default([]),
      check_evidence: z.array(checkEvidence).max(128).default([]),
      summary: z.string().min(1).max(2_000).optional(),
    },
  },
  workflow_status: {
    description: "Return status for an explicit Schema-6 artifact chain or one current Workflow-6 Harness Run.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      run_id: z.string().regex(/^run-[a-f0-9]{24}$/).optional(),
      manual_acceptance: z.enum(["provisional"]).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
    },
  },
});

export function manualToolContract(name) {
  const contract = contracts[name];
  if (!contract) throw new Error(`unknown Manual Workflow MCP tool ${name}`);
  return { ...contract, annotations: manualToolAnnotations(name) };
}
