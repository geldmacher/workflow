import { lstatSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOST_WORKSPACE_ENV = "GELDMACHER_WORKFLOW_WORKSPACE_ROOT";

export class WorkspaceRootError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "WorkspaceRootError";
    this.code = code;
  }
}

export function isWorkspaceRootsUnavailable(error) {
  return error instanceof WorkspaceRootError && [
    "roots-request-failed",
    "roots-empty",
    "host-workspace-unavailable",
  ].includes(error.code);
}

function validateDirectoryRoot(advertised, {
  unavailableCode = "root-unavailable",
  symlinkCode = "root-symlink",
  notDirectoryCode = "root-not-directory",
  label = "workspace root",
} = {}) {
  let stat;
  try { stat = lstatSync(advertised); }
  catch (error) { throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error }); }
  if (stat.isSymbolicLink()) throw new WorkspaceRootError(symlinkCode, `${label} may not be symlink redirected: ${advertised}`);
  let canonical;
  try { canonical = realpathSync(advertised); }
  catch (error) { throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error }); }
  let canonicalStat;
  try { canonicalStat = statSync(canonical); }
  catch (error) { throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error }); }
  if (!canonicalStat.isDirectory()) throw new WorkspaceRootError(notDirectoryCode, `${label} is not a directory: ${advertised}`);
  return { advertised, canonical };
}

function rootPath(root) {
  if (!root || typeof root.uri !== "string") throw new WorkspaceRootError("root-invalid", "MCP client returned an invalid workspace root");
  let url;
  try { url = new URL(root.uri); }
  catch (error) { throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid workspace root URI: ${root.uri}`, { cause: error }); }
  if (url.protocol !== "file:") throw new WorkspaceRootError("root-non-file", `Workflow supports only file workspace roots: ${root.uri}`);
  let advertised;
  try { advertised = resolve(fileURLToPath(url)); }
  catch (error) { throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid file workspace root: ${root.uri}`, { cause: error }); }
  return validateDirectoryRoot(advertised, { label: "MCP workspace root" });
}

function hostConfiguredRoot(env = process.env) {
  const raw = env?.[HOST_WORKSPACE_ENV];
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const value = String(raw).trim();
  // Unexpanded host placeholders (for example ${workspaceFolder}) are absent config, not a path.
  if (/\$\{[^}]+\}/.test(value)) return null;
  const advertised = resolve(value);
  return {
    ...validateDirectoryRoot(advertised, {
      unavailableCode: "host-workspace-unavailable",
      symlinkCode: "host-workspace-symlink",
      notDirectoryCode: "host-workspace-not-directory",
      label: `host-configured ${HOST_WORKSPACE_ENV}`,
    }),
    source: "host-configured",
  };
}

export class WorkspaceRootAuthority {
  constructor(listRoots, options = {}) {
    if (typeof listRoots !== "function") throw new TypeError("WorkspaceRootAuthority requires listRoots");
    this.listRoots = listRoots;
    this.env = options.env ?? process.env;
    this.cached = null;
    this.unavailable = null;
  }

  invalidate() {
    this.cached = null;
    this.unavailable = null;
  }

  async roots() {
    if (this.unavailable) throw this.unavailable;
    if (!this.cached) {
      this.cached = Promise.resolve().then(async () => {
        let response;
        try { response = await this.listRoots(); }
        catch (error) {
          const reason = String(error?.message ?? error ?? "unknown error").replace(/\s+/g, " ").slice(0, 300);
          throw new WorkspaceRootError("roots-request-failed", `trusted MCP workspace roots request failed: ${reason}`, { cause: error });
        }
        const entries = (response?.roots ?? []).map(rootPath);
        const unique = new Map(entries.map((entry) => [entry.canonical, entry]));
        if (unique.size === 0) throw new WorkspaceRootError("roots-empty", "trusted MCP workspace roots list is empty");
        return [...unique.values()].sort((left, right) => left.canonical.localeCompare(right.canonical));
      });
    }
    try { return await this.cached; }
    catch (error) {
      if (isWorkspaceRootsUnavailable(error)) this.unavailable = error;
      this.cached = null;
      throw error;
    }
  }

  async resolve(selector = undefined) {
    const host = hostConfiguredRoot(this.env);
    let roots = null;
    let rootsError = null;
    try { roots = await this.roots(); }
    catch (error) {
      if (!isWorkspaceRootsUnavailable(error)) throw error;
      rootsError = error;
    }

    if (host) {
      if (roots) {
        const allowed = roots.find((entry) => entry.advertised === host.advertised || entry.canonical === host.canonical);
        if (!allowed) throw new WorkspaceRootError("root-foreign", `host-configured workspace_root is not an advertised MCP root: ${host.advertised}`);
        if (host.canonical !== allowed.canonical) {
          throw new WorkspaceRootError("root-drift", `host-configured workspace_root changed after MCP root discovery: ${host.advertised}`);
        }
      }
      if (selector !== undefined && selector !== null && selector !== "") {
        const requested = resolve(selector);
        if (requested !== host.advertised && requested !== host.canonical) {
          throw new WorkspaceRootError("root-foreign", `workspace_root does not match host-configured workspace: ${requested}`);
        }
      }
      return host.canonical;
    }

    if (rootsError) throw rootsError;
    if (selector === undefined || selector === null || selector === "") {
      if (roots.length !== 1) throw new WorkspaceRootError("roots-multiple", "multiple MCP workspace roots require workspace_root");
      return roots[0].canonical;
    }
    const advertised = resolve(selector);
    const allowed = roots.find((entry) => entry.advertised === advertised);
    if (!allowed) throw new WorkspaceRootError("root-foreign", `workspace_root is not an advertised MCP root: ${advertised}`);
    let canonical;
    try { canonical = realpathSync(advertised); }
    catch (error) { throw new WorkspaceRootError("root-unavailable", `workspace_root is unavailable: ${advertised}`, { cause: error }); }
    if (canonical !== allowed.canonical) throw new WorkspaceRootError("root-drift", `workspace_root changed after MCP root discovery: ${advertised}`);
    return canonical;
  }
}
