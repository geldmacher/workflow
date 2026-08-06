import * as z from "zod/v4";
import { toolAnnotations } from "./tool-annotations.mjs";
import { WORKFLOW_TOOL_NAMES } from "./tool-registry.mjs";

const workspaceRoot = z.string().min(1).optional();
const artifact = z.object({
  label: z.string().min(1).max(200),
  text: z.string().min(1).max(250_000),
});
const subject = {
  workspace_root: workspaceRoot,
  run_id: z.string().min(1).optional(),
  preparation_id: z.string().min(1).optional(),
};
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

export const WORKFLOW_TOOL_CONTRACTS = Object.freeze({
  workflow_plan_preflight: {
    description: "Validate one exact Schema-5 Root for authority feasibility and Pareto Check selection without workspace discovery, persistence, approval, or mutation.",
    inputSchema: { root_plan: z.string().min(1).max(250_000) },
  },
  workflow_prepare: {
    description: "Run the configured planner pool in a read-only pre-run phase and produce either one approvable schema-5 intent root or manual intent questions.",
    inputSchema: {
      workspace_root: workspaceRoot,
      goal: z.string().min(1).optional(),
      root_plan: z.string().min(1).optional(),
      root_artifacts: z.array(artifact).min(1).max(32).optional(),
      requested_profile: z.enum(["supervised", "autonomous"]),
      route_profile: z.string().min(1).default("default"),
      expected_revision: z.literal(0),
      idempotency_key: z.string().min(8),
    },
  },
  workflow_start: {
    description: "Atomically consume one displayed root-ready preparation after explicit root-hash approval and create exactly one approved run.",
    inputSchema: {
      workspace_root: workspaceRoot,
      preparation_id: z.string().min(1),
      approved_root_hash: z.string().length(64),
      expected_preparation_revision: z.number().int().min(0),
      idempotency_key: z.string().min(8),
    },
  },
  workflow_artifact_record: {
    description: "Validate and atomically cache exact Schema-5 work-plan or work-review artifacts in the non-authoritative root-content handoff store.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: z.array(artifact).min(1).max(32) },
  },
  workflow_artifact_context: {
    description: "Return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root, optionally hash-bound to the supplied active native Plan.",
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
      effective_profile: z.enum(["manual", "supervised", "autonomous"]).default("manual"),
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
    description: "Return current status for one preparation, adaptive run, or explicit/uniquely active stateless manual schema-5 artifact chain; Workflow-3/4 subjects remain read-only.",
    inputSchema: {
      ...subject,
      root_plan_id: z.string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      manual_acceptance: z.enum(["provisional"]).optional(),
      artifacts: z.array(artifact).min(1).max(32).optional(),
    },
  },
  workflow_watch: {
    description: "Return events after a cursor for exactly one planning preparation or run without mutation.",
    inputSchema: {
      ...subject,
      after_event: z.number().int().min(0).default(0),
      timeout_ms: z.number().int().min(0).max(30_000).default(0),
    },
  },
  workflow_control: {
    description: "Stop a preparation, or pause, resume, stop, or accept one Run delivery using optimistic revision and idempotency.",
    inputSchema: {
      ...subject,
      action: z.enum(["pause", "resume", "stop", "accept"]),
      acceptance: z.enum(["verified", "provisional"]).optional(),
      expected_revision: z.number().int().min(0),
      idempotency_key: z.string().min(8),
    },
  },
  workflow_answer: {
    description: "Record a human answer for a waiting run; planning preparations intentionally have no answer loop.",
    inputSchema: {
      workspace_root: workspaceRoot,
      run_id: z.string().min(1),
      answer: z.string().min(1),
      expected_revision: z.number().int().min(0),
      idempotency_key: z.string().min(8),
    },
  },
  workflow_validate_models: {
    description: "Validate ordered pools of concrete approved model candidates against the live Cursor catalog.",
    inputSchema: { workspace_root: workspaceRoot, route_profile: z.string().min(1).default("default") },
  },
  workflow_verification_profile: {
    description: "Draft, inspect, prove, approve, or audit one hash-bound project verification profile.",
    inputSchema: {
      workspace_root: workspaceRoot,
      action: z.enum(["draft", "inspect", "prove", "approve", "audit"]),
      manifest_path: z.string().min(1).default(".cursor/workflow-verification.yaml"),
      surface: z.string().min(1).optional(),
      route_profile: z.string().min(1).default("default"),
      approved_hash: z.string().length(64).optional(),
    },
  },
});

if (Object.keys(WORKFLOW_TOOL_CONTRACTS).sort().join("\n") !== [...WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("MCP tool contracts differ from the canonical tool registry");
}

export function toolContract(name) {
  const contract = WORKFLOW_TOOL_CONTRACTS[name];
  if (!contract) throw new Error(`unknown Workflow MCP tool ${name}`);
  return { ...contract, annotations: toolAnnotations(name) };
}
