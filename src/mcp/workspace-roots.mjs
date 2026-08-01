import { lstatSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function rootPath(root) {
  if (!root || typeof root.uri !== "string") throw new Error("MCP client returned an invalid workspace root");
  const url = new URL(root.uri);
  if (url.protocol !== "file:") throw new Error(`Workflow supports only file workspace roots: ${root.uri}`);
  const advertised = resolve(fileURLToPath(url));
  if (lstatSync(advertised).isSymbolicLink()) throw new Error(`MCP workspace root may not be symlink redirected: ${advertised}`);
  const canonical = realpathSync(advertised);
  if (!statSync(canonical).isDirectory()) throw new Error(`MCP workspace root is not a directory: ${advertised}`);
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
        catch { throw new Error("trusted MCP workspace roots are unavailable"); }
        const entries = (response?.roots ?? []).map(rootPath);
        const unique = new Map(entries.map((entry) => [entry.canonical, entry]));
        if (unique.size === 0) throw new Error("trusted MCP workspace roots are unavailable");
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
      if (roots.length !== 1) throw new Error("multiple MCP workspace roots require workspace_root");
      return roots[0].canonical;
    }
    const advertised = resolve(selector);
    const allowed = roots.find((entry) => entry.advertised === advertised);
    if (!allowed) throw new Error(`workspace_root is not an advertised MCP root: ${advertised}`);
    let canonical;
    try { canonical = realpathSync(advertised); }
    catch { throw new Error(`workspace_root is unavailable: ${advertised}`); }
    if (canonical !== allowed.canonical) throw new Error(`workspace_root changed after MCP root discovery: ${advertised}`);
    return canonical;
  }
}
