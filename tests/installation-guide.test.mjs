import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function executable(name) {
  const result = spawnSync("sh", ["-c", 'command -v "$1"', "sh", name], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

for (const hashingTool of ["sha256sum", "shasum"]) {
  test(`installation guide stops on any checksum failure using ${hashingTool}`, (t) => {
    const tools = Object.fromEntries(["sh", "awk", hashingTool].map((name) => [name, executable(name)]));
    if (Object.values(tools).some((path) => !path)) return t.skip(`requires sh, awk, and ${hashingTool}`);
    const parent = mkdtempSync(join(tmpdir(), "workflow-installation-guide-test-"));
    try {
      const bin = join(parent, "bin");
      mkdirSync(bin);
      for (const [name, path] of Object.entries(tools)) symlinkSync(path, join(bin, name));
      const perl = executable("perl");
      if (perl) symlinkSync(perl, join(bin, "perl"));
      const guide = readFileSync(new URL("../docs/installation.md", import.meta.url), "utf8");
      const snippet = guide.match(/```sh\n([\s\S]*?)\n```/)?.[1];
      assert.ok(snippet, "the documented shell example must exist");
      const archive = snippet.match(/^archive="([^"]+)"/m)?.[1];
      assert.ok(archive, "use the archive name from the documented example");
      const contents = { [archive]: "original archive bytes", "provenance.json": "{}" };
      const checksums = Object.fromEntries(Object.entries(contents).map(([name, value]) => [
        name, `${createHash("sha256").update(value).digest("hex")}  ${name}\n`,
      ]));
      const scenarios = [
        { name: "valid" },
        ...Object.keys(contents).flatMap((file) => ["corrupt", "missing-entry", "duplicate-entry"].map((kind) => ({ name: `${kind}-${file}`, kind, file }))),
      ];
      for (const scenario of scenarios) {
        const directory = join(parent, scenario.name);
        mkdirSync(directory);
        for (const [name, value] of Object.entries(contents)) {
          writeFileSync(join(directory, name), scenario.kind === "corrupt" && scenario.file === name ? "corrupted" : value);
        }
        const lines = Object.entries(checksums).flatMap(([name, line]) => {
          if (scenario.file !== name) return [line];
          if (scenario.kind === "missing-entry") return [];
          return scenario.kind === "duplicate-entry" ? [line, line] : [line];
        });
        writeFileSync(join(directory, "SHA256SUMS"), lines.join(""));
        const result = spawnSync(tools.sh, ["-c", `${snippet}\nprintf '%s\\n' 'verification-complete'\n`], {
          cwd: directory, encoding: "utf8", env: { ...process.env, PATH: bin },
        });
        assert.ifError(result.error);
        if (scenario.name === "valid") {
          assert.equal(result.status, 0, result.stderr);
          assert.match(result.stdout, /verification-complete/);
        } else {
          assert.notEqual(result.status, 0, `${hashingTool}: ${scenario.name} must stop the shell`);
          assert.doesNotMatch(result.stdout, /verification-complete/, scenario.name);
          if (scenario.file === archive) assert.doesNotMatch(result.stdout, /provenance\.json: OK/, scenario.name);
        }
      }
    } finally { rmSync(parent, { recursive: true, force: true }); }
  });
}
