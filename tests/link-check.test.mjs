import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { checkMarkdownLinks } from "../scripts/check-markdown-links.mjs";

test("accepts valid local Markdown targets and anchors", async () => {
  const root = await mkdtemp(join(tmpdir(), "workflow-links-"));
  try {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "README.md"), "[Guide](docs/guide.md#details)\n");
    await writeFile(join(root, "docs", "guide.md"), "# Guide\n\n## Details\n");
    assert.deepEqual(checkMarkdownLinks(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects missing Markdown targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "workflow-links-"));
  try {
    await writeFile(join(root, "README.md"), "[Missing](docs/missing.md)\n");
    assert.match(checkMarkdownLinks(root).join("\n"), /missing link target/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
