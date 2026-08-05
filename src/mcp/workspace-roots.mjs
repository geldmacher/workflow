import { lstatSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class WorkspaceRootError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "WorkspaceRootError";
    this.code = code;
  }
}

export function isWorkspaceRootsUnavailable(error) {
  return error instanceof WorkspaceRootError && ["roots-request-failed", "roots-empty"].includes(error.code);
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
  let stat;
  try { stat = lstatSync(advertised); }
  catch (error) { throw new WorkspaceRootError("root-unavailable", `MCP workspace root is unavailable: ${advertised}`, { cause: error }); }
  if (stat.isSymbolicLink()) throw new WorkspaceRootError("root-symlink", `MCP workspace root may not be symlink redirected: ${advertised}`);
  let canonical;
  try { canonical = realpathSync(advertised); }
  catch (error) { throw new WorkspaceRootError("root-unavailable", `MCP workspace root is unavailable: ${advertised}`, { cause: error }); }
  let canonicalStat;
  try { canonicalStat = statSync(canonical); }
  catch (error) { throw new WorkspaceRootError("root-unavailable", `MCP workspace root is unavailable: ${advertised}`, { cause: error }); }
  if (!canonicalStat.isDirectory()) throw new WorkspaceRootError("root-not-directory", `MCP workspace root is not a directory: ${advertised}`);
  return { advertised, canonical };
}

export class WorkspaceRootAuthority {
  constructor(listRoots) {
    if (typeof listRoots !== "function") throw new TypeError("WorkspaceRootAuthority requires listRoots");
    this.listRoots = listRoots;
    this.cached = null;
  }

  invalidate() {
    this.cached = null;
  }

  async roots() {
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
      this.cached = null;
      throw error;
    }
  }

  async resolve(selector = undefined) {
    const roots = await this.roots();
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
