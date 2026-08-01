import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { hashStableProofFile, proofArtifacts } from "../src/mcp/proof-artifacts.mjs";

test("proof artifacts enforce file count and symlink limits", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-proof-limits-"));
  try {
    for (let index = 0; index < 129; index += 1) writeFileSync(join(root, `proof-${index}.txt`), "");
    assert.throws(() => proofArtifacts(root), /count exceeds 128/);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root);
    writeFileSync(join(root, "proof.txt"), "proof\n");
    symlinkSync(join(root, "proof.txt"), join(root, "alias.txt"));
    assert.throws(() => proofArtifacts(root), /may not be a symlink/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("proof artifacts enforce individual, aggregate, and depth limits", () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-proof-size-"));
  try {
    writeFileSync(join(root, "large.bin"), "");
    truncateSync(join(root, "large.bin"), 10 * 1024 * 1024 + 1);
    assert.throws(() => proofArtifacts(root), /exceeds 10 MiB/);
    rmSync(join(root, "large.bin"));
    for (let index = 0; index < 4; index += 1) {
      writeFileSync(join(root, `aggregate-${index}.bin`), "");
      truncateSync(join(root, `aggregate-${index}.bin`), 9 * 1024 * 1024);
    }
    assert.throws(() => proofArtifacts(root), /exceed 32 MiB total/);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root);
    let directory = root;
    for (let depth = 0; depth < 9; depth += 1) { directory = join(directory, `d${depth}`); mkdirSync(directory); }
    assert.throws(() => proofArtifacts(root), /depth exceeds 8/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("proof hashing rejects files that change during the read", () => {
  const stats = [
    { ino: 1, size: 5, mtimeMs: 1 },
    { ino: 1, size: 6, mtimeMs: 2 },
  ];
  assert.throws(() => hashStableProofFile("proof.txt", () => stats.shift(), () => Buffer.from("proof")), /changed while hashing/);
});
