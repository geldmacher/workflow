import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function uniqueSorted(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}

function pathMatchesRoot(path, root) {
  return path === root || path.startsWith(`${root}/`);
}

function repositoryAuthorityPaths(repositoryRoot, repositoryPath) {
  const root = realpathSync(repositoryRoot);
  const lexical = resolve(root, repositoryPath);
  if (lexical !== root && !lexical.startsWith(`${root}${sep}`)) {
    throw new Error(`native closeout path escapes the repository: ${repositoryPath}`);
  }
  let existing = lexical;
  while (!existsSync(existing) && existing !== root) existing = dirname(existing);
  const resolvedExisting = realpathSync(existing);
  if (resolvedExisting !== root && !resolvedExisting.startsWith(`${root}${sep}`)) {
    throw new Error(`native closeout path resolves outside the repository: ${repositoryPath}`);
  }
  const unresolved = relative(existing, lexical);
  const resolved = resolve(resolvedExisting, unresolved);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error(`native closeout path resolves outside the repository: ${repositoryPath}`);
  }
  const normalizeRelative = (value) => relative(root, value).replaceAll("\\", "/") || ".";
  return {
    lexical: normalizeRelative(lexical),
    resolved: normalizeRelative(resolved),
  };
}

function authorityViolation(authorityPath, { allowed, protectedPaths, approvalRequired }) {
  if (protectedPaths.some((entry) => pathMatchesRoot(authorityPath, entry))) {
    return `native closeout path is protected by the Root: ${authorityPath}`;
  }
  if (approvalRequired.some((entry) => pathMatchesRoot(authorityPath, entry))) {
    return `native closeout path requires separate human approval that the closeout report cannot grant: ${authorityPath}`;
  }
  if (!allowed.some((entry) => pathMatchesRoot(authorityPath, entry))) {
    return `native closeout path is outside Root authority: ${authorityPath}`;
  }
  return null;
}

export function assertChangedPathAuthority(rootFields, changedPaths, repositoryRoot) {
  const authority = rootFields?.authority ?? {};
  const allowed = uniqueSorted(authority.allowed_roots);
  const protectedPaths = uniqueSorted(authority.protected_paths);
  const approvalRequired = uniqueSorted(authority.approval_required_paths);
  if (allowed.length === 0) throw new Error("native closeout Root has no allowed path authority");
  for (const path of uniqueSorted(changedPaths)) {
    if (isAbsolute(path) || path.includes("\\") || path.includes("\0")) {
      throw new Error(`native closeout path is not repository-relative: ${path}`);
    }
    const candidates = repositoryAuthorityPaths(repositoryRoot, path);
    for (const candidate of uniqueSorted([candidates.lexical, candidates.resolved])) {
      const violation = authorityViolation(candidate, { allowed, protectedPaths, approvalRequired });
      if (violation) throw new Error(violation);
    }
  }
}

function patchTargets(value) {
  const source = String(value ?? "");
  const paths = [];
  for (const match of source.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+?)\s*$/gm)) paths.push(match[1]);
  for (const match of source.matchAll(/^\*\*\* Move to:\s*(.+?)\s*$/gm)) paths.push(match[1]);
  for (const match of source.matchAll(/^(?:\+\+\+|---)\s+(?:[ab]\/)?(.+?)\s*$/gm)) {
    if (match[1] !== "/dev/null") paths.push(match[1]);
  }
  for (const match of source.matchAll(/^(?:rename|copy) (?:from|to)\s+(.+?)\s*$/gm)) paths.push(match[1]);
  return paths;
}

function directInputPaths(value, key = null) {
  if (typeof value === "string") {
    return [
      "path", "paths", "file", "files", "file_path", "old_path", "new_path",
      "target", "targets", "source", "destination", "destination_path", "notebook_path",
    ].includes(key) ? [value] : [];
  }
  if (Array.isArray(value)) return value.flatMap((entry) => directInputPaths(entry, key));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([entryKey, entry]) => directInputPaths(entry, entryKey));
}

function repositoryRelativeTarget(target, repositoryRoot) {
  const raw = String(target).trim();
  if (!raw) return null;
  if (raw.includes("\\") || raw.includes("\0")) return raw;
  const candidate = relative(resolve(repositoryRoot), resolve(repositoryRoot, raw));
  return candidate.replace(/\/$/, "");
}

export function directMutationTargets({ toolName, toolInput, repositoryRoot }) {
  const name = String(toolName ?? "");
  if (/^(?:Shell|Bash|Task|Agent|spawn_agent)$/i.test(name)) return [];
  let input = toolInput && typeof toolInput === "object" && !Array.isArray(toolInput) ? toolInput : {};
  if (typeof toolInput === "string") {
    try {
      const parsed = JSON.parse(toolInput);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) input = parsed;
    } catch {
      // Free-form ApplyPatch input is inspected below.
    }
  }
  const patch = typeof toolInput === "string"
    ? toolInput
    : input.patch ?? input.diff ?? input.input ?? "";
  const targets = uniqueSorted([
    ...directInputPaths(input),
    ...patchTargets(patch),
  ].map((target) => repositoryRelativeTarget(target, repositoryRoot)).filter(Boolean));
  if (/^(?:apply_patch|ApplyPatch|Edit|Write|Delete|DeleteFile|StrReplace|EditNotebook)$/i.test(name) && targets.length === 0) {
    throw new Error(`native closeout could not resolve a concrete mutation target for ${name}`);
  }
  return targets;
}
