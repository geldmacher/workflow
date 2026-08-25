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
