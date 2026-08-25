import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

function sharedWorkflowHome(options = {}) {
  return resolve(options.homeRoot ?? process.env.GELDMACHER_WORKFLOW_HOME ?? join(homedir(), ".geldmacher", "workflow"));
}

export function repositoryKey(workspaceRoot) {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 20);
}

export function rootContentHash(rootPlanText) {
  if (typeof rootPlanText !== "string" || !rootPlanText.trim()) {
    throw new Error("root content hash requires exact non-empty Root text");
  }
  return createHash("sha256").update(rootPlanText).digest("hex");
}

export function sharedHandoffBase(options = {}) {
  return options.baseRoot
    ?? process.env.GELDMACHER_WORKFLOW_SHARED_ROOT
    ?? join(sharedWorkflowHome(options), "handoff");
}

export function contentAddressedHandoffRoot(rootPlanText, options = {}) {
  return join(resolve(sharedHandoffBase(options)), "by-root", rootContentHash(rootPlanText));
}

export function contentAddressedHandoffRootByHash(rootHash, options = {}) {
  if (!/^[a-f0-9]{64}$/.test(String(rootHash ?? ""))) throw new Error("content-addressed handoff requires a full SHA-256 root content hash");
  return join(resolve(sharedHandoffBase(options)), "by-root", rootHash);
}

export function handoffTipDirectory(rootPlanId, options = {}) {
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId ?? ""))) throw new Error("handoff tip requires a valid wp-* root_plan_id");
  return join(resolve(sharedHandoffBase(options)), "tips", rootPlanId);
}

export function handoffTipPath(rootPlanId, rootContentHashValue, options = {}) {
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId ?? ""))) throw new Error("handoff tip requires a valid wp-* root_plan_id");
  if (!/^[a-f0-9]{64}$/.test(String(rootContentHashValue))) {
    throw new Error("content-addressed handoff tip requires a full SHA-256 root content hash");
  }
  return join(handoffTipDirectory(rootPlanId, options), `${rootContentHashValue}.json`);
}

export function sharedArtifactStateRoot(workspaceRoot, options = {}) {
  const base = options.baseRoot
    ?? process.env.GELDMACHER_WORKFLOW_SHARED_ROOT
    ?? join(sharedWorkflowHome(options), "state");
  return join(resolve(base), repositoryKey(workspaceRoot));
}

export function localOperationalStateRoot(workspaceRoot, options = {}) {
  const pluginData = options.pluginData ?? process.env.PLUGIN_DATA;
  const base = options.baseRoot
    ?? (pluginData ? join(pluginData, "state") : join(homedir(), ".codex", "geldmacher-workflow", "state"));
  return join(resolve(base), repositoryKey(workspaceRoot));
}

export const codexOperationalStateRoot = localOperationalStateRoot;
