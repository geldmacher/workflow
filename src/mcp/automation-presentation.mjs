import { workflowMcpResult } from "./manual-presentation.mjs";

export function automationMcpResult(value, isError = false, { presentationLocale = "en" } = {}) {
  return workflowMcpResult("workflow_prepare", value, isError, {
    clientHost: "cursor",
    presentationLocale,
  });
}
