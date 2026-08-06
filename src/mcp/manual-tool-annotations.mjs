function annotations({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint }) {
  return Object.freeze({
    readOnlyHint,
    destructiveHint,
    idempotentHint,
    openWorldHint,
  });
}

export const MANUAL_WORKFLOW_TOOL_NAMES = Object.freeze([
  "workflow_artifact_context",
  "workflow_artifact_record",
  "workflow_closeout",
  "workflow_plan_preflight",
  "workflow_status",
]);

/** Canonical MCP ToolAnnotations for the five Manual Workflow tools. */
export const MANUAL_WORKFLOW_TOOL_ANNOTATIONS = Object.freeze({
  workflow_plan_preflight: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
  workflow_artifact_context: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
  workflow_status: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
  workflow_artifact_record: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
  workflow_closeout: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
});

if (Object.keys(MANUAL_WORKFLOW_TOOL_ANNOTATIONS).sort().join("\n") !== [...MANUAL_WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("Manual MCP tool annotations differ from the Manual tool set");
}

export function manualToolAnnotations(name) {
  const value = MANUAL_WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Manual Workflow MCP tool annotations ${name}`);
  return value;
}
