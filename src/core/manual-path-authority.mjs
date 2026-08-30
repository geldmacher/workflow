import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function uniqueSorted(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}

function invalidPath(value, label) {
  if (!value) return `${label} must not be empty`;
  if (isAbsolute(value) || /^[A-Za-z]:/.test(value)) return `${label} must be repository-relative: ${value}`;
  if (value.includes("\\")) return `${label} must use POSIX separators: ${value}`;
  if (value.includes("\0")) return `${label} must not contain NUL`;
  if (value.startsWith("/") || value.endsWith("/") || value.includes("//")) return `${label} contains an empty path segment: ${value}`;
  const segments = value.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) return `${label} contains traversal: ${value}`;
  return null;
}

export function normalizeAuthorityPattern(input) {
  const value = String(input ?? "").trim().replace(/^\.\//, "");
  if (value === ".") return value;
  const invalid = invalidPath(value, "authority pattern");
  if (invalid) throw new Error(invalid);
  for (const segment of value.split("/")) {
    if (segment.includes("**") && segment !== "**") {
      throw new Error(`authority pattern recursive globstar must occupy a complete segment: ${value}`);
    }
  }
  return value;
}

export function normalizeRepositoryPath(input) {
  const value = String(input ?? "").trim().replace(/^\.\//, "");
  const invalid = invalidPath(value, "repository path");
  if (invalid) throw new Error(invalid);
  if (value.includes("*")) throw new Error(`repository path must not contain authority wildcards: ${value}`);
  return value;
}

function segmentExpression(segment) {
  const escaped = segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function matchSegments(pattern, path) {
  const memo = new Map();
  const expressions = pattern.map((segment) => (segment === "**" ? null : segmentExpression(segment)));
  const match = (patternIndex, pathIndex) => {
    const key = `${patternIndex}:${pathIndex}`;
    if (memo.has(key)) return memo.get(key);
    let result;
    if (patternIndex === pattern.length) {
      result = true;
    } else if (pattern[patternIndex] === "**") {
      result = match(patternIndex + 1, pathIndex)
        || (pathIndex < path.length && match(patternIndex, pathIndex + 1));
    } else {
      result = pathIndex < path.length
        && expressions[patternIndex].test(path[pathIndex])
        && match(patternIndex + 1, pathIndex + 1);
    }
    memo.set(key, result);
    return result;
  };
  return match(0, 0);
}

export function pathMatchesAuthorityPattern(repositoryPath, authorityPattern) {
  const path = normalizeRepositoryPath(repositoryPath);
  const pattern = normalizeAuthorityPattern(authorityPattern);
  if (pattern === ".") return true;
  return matchSegments(pattern.split("/"), path.split("/"));
}

function normalizedAuthority(authority = {}) {
  return {
    allowed: uniqueSorted(authority.allowed_roots).map(normalizeAuthorityPattern),
    protected: uniqueSorted(authority.protected_paths).map(normalizeAuthorityPattern),
    approvalRequired: uniqueSorted(authority.approval_required_paths).map(normalizeAuthorityPattern),
  };
}

function categoryForCandidate(path, authority) {
  if (authority.protected.some((entry) => pathMatchesAuthorityPattern(path, entry))) return "protected";
  if (authority.approvalRequired.some((entry) => pathMatchesAuthorityPattern(path, entry))) return "approval-required";
  if (authority.allowed.some((entry) => pathMatchesAuthorityPattern(path, entry))) return "allowed";
  return "outside-allowed";
}

function repositoryAuthorityPaths(repositoryRoot, repositoryPath) {
  const root = realpathSync(repositoryRoot);
  const path = normalizeRepositoryPath(repositoryPath);
  const lexical = resolve(root, path);
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
  return uniqueSorted([normalizeRelative(lexical), normalizeRelative(resolved)]);
}

function classifyCandidates(candidates, authority) {
  const categories = candidates.map((candidate) => categoryForCandidate(candidate, authority));
  if (categories.includes("protected")) return "protected";
  if (categories.includes("approval-required")) return "approval-required";
  if (categories.every((category) => category === "allowed")) return "allowed";
  return "outside-allowed";
}

export function classifyChangedPathAuthority(rootFields, changedPaths, repositoryRoot = null, ambientPaths = []) {
  const authority = normalizedAuthority(rootFields?.authority ?? {});
  if (authority.allowed.length === 0) throw new Error("native closeout Root has no allowed path authority");
  const subjectPaths = uniqueSorted(changedPaths);
  const ambient = uniqueSorted(ambientPaths);
  const overlap = subjectPaths.filter((path) => ambient.includes(path));
  if (overlap.length > 0) throw new Error(`repository paths cannot be both subject and ambient: ${overlap.join(", ")}`);
  const projection = {
    schema: 1,
    status: "within-authority",
    allowed_paths: [],
    outside_allowed_paths: [],
    approval_required_paths: [],
    protected_paths: [],
    ambient_paths: [],
  };
  for (const path of subjectPaths) {
    const normalized = normalizeRepositoryPath(path);
    const candidates = repositoryRoot ? repositoryAuthorityPaths(repositoryRoot, normalized) : [normalized];
    const category = classifyCandidates(candidates, authority);
    const key = category === "allowed" ? "allowed_paths" : `${category.replaceAll("-", "_")}_paths`;
    projection[key].push(normalized);
  }
  for (const path of ambient) {
    const normalized = normalizeRepositoryPath(path);
    if (repositoryRoot) repositoryAuthorityPaths(repositoryRoot, normalized);
    projection.ambient_paths.push(normalized);
  }
  if (projection.protected_paths.length > 0) projection.status = "protected";
  else if (projection.approval_required_paths.length > 0) projection.status = "approval-required";
  else if (projection.outside_allowed_paths.length > 0) projection.status = "provisional-drift";
  return projection;
}

export function assertChangedPathAuthority(rootFields, changedPaths, repositoryRoot) {
  const projection = classifyChangedPathAuthority(rootFields, changedPaths, repositoryRoot);
  const failures = [
    ...projection.protected_paths.map((path) => `native closeout path is protected by the Root: ${path}`),
    ...projection.approval_required_paths.map((path) => `native closeout path requires separate human approval that the closeout report cannot grant: ${path}`),
    ...projection.outside_allowed_paths.map((path) => `native closeout path is outside Root authority: ${path}`),
  ];
  if (failures.length > 0) throw new Error(failures.join("; "));
  return projection;
}
