import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PROOF_LIMITS = Object.freeze({ files: 128, file_bytes: 10 * 1024 * 1024, total_bytes: 32 * 1024 * 1024, depth: 8 });

export function hashStableProofFile(path, stat = lstatSync, read = readFileSync, before = stat(path)) {
  if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
  const content = read(path);
  const after = stat(path);
  if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`verification proof artifact changed while hashing: ${path}`);
  return { size: before.size, hash: createHash("sha256").update(content).digest("hex") };
}

export function proofArtifacts(root) {
  const files = [];
  let totalBytes = 0;
  const visit = (directory, depth = 0) => {
    if (depth > PROOF_LIMITS.depth) throw new Error(`verification proof artifact depth exceeds ${PROOF_LIMITS.depth}: ${directory}`);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`verification proof artifact may not be a symlink: ${path}`);
      if (entry.isDirectory()) visit(path, depth + 1);
      else if (entry.isFile()) {
        if (files.length >= PROOF_LIMITS.files) throw new Error(`verification proof artifact count exceeds ${PROOF_LIMITS.files}`);
        const before = lstatSync(path);
        if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
        totalBytes += before.size;
        if (totalBytes > PROOF_LIMITS.total_bytes) throw new Error("verification proof artifacts exceed 32 MiB total");
        const stable = hashStableProofFile(path, lstatSync, readFileSync, before);
        files.push({ path, hash: stable.hash });
      } else throw new Error(`verification proof artifact must be a regular file or directory: ${path}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}
