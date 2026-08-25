import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";

export function protectedRecordHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableProtectedRecordJson(value) {
  return JSON.stringify(stable(value));
}

export function canonicalProtectedWorkspaceRoot(workspaceRoot) {
  try { return realpathSync(workspaceRoot); }
  catch { return resolve(workspaceRoot); }
}

export function assertProtectedRecordPath(path, base) {
  const resolvedBase = resolve(base);
  const resolvedPath = resolve(path);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${sep}`)) {
    throw new Error("protected record path escapes its state root");
  }
  let current = resolvedPath;
  while (current !== resolvedBase && !existsSync(current)) current = dirname(current);
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("protected record state may not be symlink redirected");
}

function ensureDirectory(path, base) {
  assertProtectedRecordPath(path, base);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  let current = resolve(path);
  const stop = resolve(base);
  while (current.startsWith(stop)) {
    if (lstatSync(current).isSymbolicLink()) throw new Error("protected record state may not contain symlink directories");
    try { chmodSync(current, 0o700); } catch { /* best effort */ }
    if (current === stop) break;
    current = dirname(current);
  }
}

export function writeProtectedRecord(path, value, base) {
  ensureDirectory(dirname(path), base);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

export function readProtectedRecord(path, base, { maxBytes = 64 * 1024 } = {}) {
  assertProtectedRecordPath(path, base);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) return null;
  const value = JSON.parse(readFileSync(path, "utf8"));
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
