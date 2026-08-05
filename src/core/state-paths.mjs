import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function repositoryKey(workspaceRoot) {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 20);
}

export function sharedArtifactStateRoot(workspaceRoot, options = {}) {
  const base = options.baseRoot
    ?? process.env.GELDMACHER_WORKFLOW_SHARED_ROOT
    ?? join(homedir(), ".geldmacher", "workflow", "state");
  return join(resolve(base), repositoryKey(workspaceRoot));
}

export function codexOperationalStateRoot(workspaceRoot, options = {}) {
  const pluginData = options.pluginData ?? process.env.PLUGIN_DATA;
  const base = options.baseRoot
    ?? (pluginData ? join(pluginData, "state") : join(homedir(), ".codex", "geldmacher-workflow", "state"));
  return join(resolve(base), repositoryKey(workspaceRoot));
}
