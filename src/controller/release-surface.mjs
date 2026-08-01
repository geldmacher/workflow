import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const RELEASE_SURFACE_SCHEMA = 1;

function isWithin(root, target) {
  const item = relative(root, target);
  return item === "" || (!item.startsWith(`..${sep}`) && item !== ".." && !isAbsolute(item));
}

export function loadReleaseSurface(pluginRoot) {
  const root = resolve(pluginRoot);
  const path = join(root, "release-surface.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.schema !== RELEASE_SURFACE_SCHEMA) throw new Error("release surface schema mismatch");
  if (Object.keys(manifest).sort().join("\n") !== ["package_extras", "runtime_paths", "schema"].join("\n")) throw new Error("release surface contains unsupported fields");
  for (const field of ["runtime_paths", "package_extras"]) {
    const entries = manifest[field];
    if (!Array.isArray(entries) || (field === "runtime_paths" && entries.length === 0) || new Set(entries).size !== entries.length) throw new Error(`release surface ${field} must be a unique array with a non-empty runtime surface`);
    if (entries.join("\n") !== [...entries].sort().join("\n")) throw new Error(`release surface ${field} must be sorted`);
    for (const entry of entries) {
      if (typeof entry !== "string" || entry === "" || isAbsolute(entry) || entry.split(/[\\/]/).includes("..")) throw new Error(`invalid release surface path: ${entry}`);
      const target = resolve(root, entry);
      if (!isWithin(root, target) || !existsSync(target)) throw new Error(`release surface path is missing or escapes the plugin: ${entry}`);
    }
  }
  if (!manifest.runtime_paths.includes("release-surface.json")) throw new Error("release surface must attest its own manifest");
  return manifest;
}

export function enumerateReleaseSurface(pluginRoot, field = "runtime_paths") {
  const root = resolve(pluginRoot);
  const manifest = loadReleaseSurface(root);
  if (!["runtime_paths", "package_paths"].includes(field)) throw new Error(`unsupported release surface field: ${field}`);
  const files = new Map();
  const visit = (path) => {
    const stat = lstatSync(path);
    const item = relative(root, path);
    if (stat.isSymbolicLink()) throw new Error(`release surface may not contain symlinks: ${item}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).filter((name) => name !== ".DS_Store").sort()) visit(join(path, entry));
      return;
    }
    if (!stat.isFile()) throw new Error(`release surface accepts only regular files: ${item}`);
    files.set(item, { path, relative_path: item, mode: stat.mode & 0o777, size: stat.size });
  };
  const paths = field === "runtime_paths" ? manifest.runtime_paths : [...manifest.runtime_paths, ...manifest.package_extras];
  for (const entry of paths) visit(resolve(root, entry));
  return [...files.values()].sort((left, right) => left.relative_path.localeCompare(right.relative_path));
}

export function validateReleaseSurfaceClosure(pluginRoot, field = "package_paths") {
  const root = resolve(pluginRoot);
  const entries = enumerateReleaseSurface(root, field);
  const included = new Set(entries.map((entry) => entry.relative_path));
  const requireIncluded = (source, target) => {
    const absolute = resolve(source, target);
    const item = relative(root, absolute);
    if (!isWithin(root, absolute) || !existsSync(absolute)) throw new Error(`release surface reference is missing or escapes the plugin: ${target}`);
    if (!included.has(item)) throw new Error(`release surface reference is outside ${field}: ${item}`);
  };
  for (const entry of entries) {
    if (!/\.(?:c|m)?js$/.test(entry.relative_path)) continue;
    const source = readFileSync(entry.path, "utf8");
    const specifiers = [
      ...source.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((match) => match[1]).filter((specifier) => specifier.startsWith("."));
    for (const specifier of specifiers) requireIncluded(resolve(entry.path, ".."), specifier);
  }
  for (const entry of entries.filter((candidate) => /\.(?:json|md|mjs|js)$/.test(candidate.relative_path))) {
    const source = readFileSync(entry.path, "utf8");
    for (const match of source.matchAll(/\$\{CURSOR_PLUGIN_ROOT\}\/([^"'\s)]+)/g)) requireIncluded(root, match[1].replace(/\\+$/, ""));
  }
  return entries;
}

export function hashReleaseSurface(pluginRoot) {
  const entries = enumerateReleaseSurface(pluginRoot, "runtime_paths");
  const digest = createHash("sha256");
  for (const entry of entries) {
    const contentHash = createHash("sha256").update(readFileSync(entry.path)).digest("hex");
    digest.update(`${entry.relative_path}\0${entry.mode}\0${contentHash}\n`);
  }
  return digest.digest("hex");
}
