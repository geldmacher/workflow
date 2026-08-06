import {
  MANUAL_WORKFLOW_TOOL_ANNOTATIONS,
  MANUAL_WORKFLOW_TOOL_NAMES,
} from "./manual-tool-annotations.mjs";
import { WORKFLOW_TOOL_NAMES } from "./tool-registry.mjs";

function annotations({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint }) {
  return Object.freeze({
    readOnlyHint,
    destructiveHint,
    idempotentHint,
    openWorldHint,
  });
}

/** Canonical MCP ToolAnnotations for every advertised Workflow tool. Mixed-action tools are classified conservatively. */
export const WORKFLOW_TOOL_ANNOTATIONS = Object.freeze({
  ...MANUAL_WORKFLOW_TOOL_ANNOTATIONS,
  workflow_watch: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }),
  workflow_validate_models: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  }),
  workflow_prepare: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  }),
  workflow_start: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  }),
  workflow_answer: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  }),
  workflow_control: annotations({
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  }),
  workflow_verification_profile: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  }),
});

if (Object.keys(WORKFLOW_TOOL_ANNOTATIONS).sort().join("\n") !== [...WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("MCP tool annotations differ from the canonical tool registry");
}

export { MANUAL_WORKFLOW_TOOL_ANNOTATIONS, MANUAL_WORKFLOW_TOOL_NAMES };

export function toolAnnotations(name) {
  const value = WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Workflow MCP tool annotations ${name}`);
  return value;
}
