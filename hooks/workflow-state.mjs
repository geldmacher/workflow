import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

export function hashWorkflowIdentifier(kind, value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return digest(`${kind}\0${value}`).slice(0, 32);
}

export function workflowStateRoot(workspaceRoot, options = {}) {
  return join(options.home ?? homedir(), ".cursor", "geldmacher-workflow", "state", digest(resolve(workspaceRoot)).slice(0, 20));
}
