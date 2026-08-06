import * as z from "zod/v4";
import { manualToolAnnotations } from "./manual-tool-annotations.mjs";

const workspaceRoot = z.string().min(1).optional();
const artifact = z.object({
  label: z.string().min(1).max(200),
  text: z.string().min(1).max(250_000),
});
const checkEvidence = z.object({
  check_id: z.string().regex(/^CHECK-[1-9][0-9]*$/),
  feature_id: z.string().min(1).nullable().optional(),
  grade: z.enum(["verified", "supported", "partial", "unavailable", "failed"]),
  surface: z.string().min(1).optional(),
  method: z.string().min(1).optional(),
  expected: z.string().min(1).optional(),
  observed: z.string().min(1),
  repetitions: z.number().int().min(0).optional(),
  artifact_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(64).optional(),
  limitations: z.array(z.string().min(1)).max(64).optional(),
});

const contracts = Object.freeze({
  workflow_plan_preflight: {
    description: "Validate one exact Schema-5 Root for authority feasibility and Pareto Check selection without workspace discovery, persistence, approval, or mutation.",
    inputSchema: { root_plan: z.string().min(1).max(250_000) },
  },
  workflow_artifact_record: {
    description: "Validate and atomically cache exact Schema-5 work-plan or work-review artifacts in the non-authoritative root-content handoff store.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: z.array(artifact).min(1).max(32) },
  },
  workflow_artifact_context: {
    description: "Return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root under its root-content namespace, optionally hash-bound to the supplied active native Plan.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: z.string().min(1).max(250_000).optional(),
    },
  },
  workflow_closeout: {
    description: "Deterministically build and validate one Schema-5 delivery-evidence artifact from observed Checks and cache it in the root-content handoff store.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: z.string().min(1).max(250_000).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
      effective_profile: z.literal("manual").default("manual"),
      strategy_revision: z.number().int().min(0).default(0),
      changed_paths: z.array(z.string().min(1).max(1000)).max(1000).default([]),
      check_evidence: z.array(checkEvidence).max(128).default([]),
      repository_snapshot: z.object({
        head: z.string().min(1).optional(),
        working_tree: z.string().min(1).optional(),
        relevant_fingerprints: z.string().min(1).optional(),
        known_failures: z.string().min(1).optional(),
      }).optional(),
    },
  },
  workflow_status: {
    description: "Return current status for an explicit stateless Manual Schema-5 artifact chain.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      manual_acceptance: z.enum(["provisional"]).optional(),
      artifacts: z.array(artifact).min(1).max(32),
    },
  },
});

export function manualToolContract(name) {
  const contract = contracts[name];
  if (!contract) throw new Error(`unknown Manual Workflow MCP tool ${name}`);
  return { ...contract, annotations: manualToolAnnotations(name) };
}
