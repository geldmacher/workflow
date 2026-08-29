import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  assertChangedPathAuthority,
  classifyChangedPathAuthority,
  normalizeAuthorityPattern,
  pathMatchesAuthorityPattern,
} from "../src/core/manual-path-authority.mjs";

test("canonical authority patterns support literal roots and bounded wildcards", () => {
  const matches = [
    ["src", "src"],
    ["src/controller/review.mjs", "src"],
    ["README.md", "*.md"],
    ["packages/of_distribution", "packages/**"],
    ["packages/of_distribution/Classes/Service.php", "packages/**"],
    ["packages/of_distribution/Classes", "packages/*/Classes/**"],
    ["packages/of_distribution/Classes/Service.php", "packages/*/Classes/**"],
    ["node_modules/pkg/index.js", "**/node_modules/**"],
    ["packages/app/node_modules/pkg/index.js", "**/node_modules/**"],
  ];
  for (const [path, pattern] of matches) assert.equal(pathMatchesAuthorityPattern(path, pattern), true, `${path} should match ${pattern}`);
  assert.equal(pathMatchesAuthorityPattern("src-other/file.mjs", "src"), false);
  assert.equal(pathMatchesAuthorityPattern("packages/a/Tests/file.mjs", "packages/*/Classes/**"), false);
});

test("authority patterns reject unsafe or ambiguous grammar", () => {
  for (const pattern of ["/src", "../src", "src/../tests", "src\\tests", "src//tests", "src/ab**cd", "src/"]) {
    assert.throws(() => normalizeAuthorityPattern(pattern), /authority pattern/);
  }
});

test("repeated recursive globstars reject a terminal mismatch without backtracking explosion", () => {
  const moduleUrl = new URL("../src/core/manual-path-authority.mjs", import.meta.url).href;
  const pattern = [...Array(24).fill("**"), "expected-terminal"].join("/");
  const source = [
    `import { pathMatchesAuthorityPattern } from ${JSON.stringify(moduleUrl)};`,
    `if (pathMatchesAuthorityPattern("one/two/three/four/five/six/seven/eight", ${JSON.stringify(pattern)})) process.exit(2);`,
  ].join("\n");
  const probe = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    encoding: "utf8",
    timeout: 1_000,
  });
  assert.equal(probe.error, undefined, probe.error?.message);
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});

test("classification uses protected then approval then allowed precedence", () => {
  const rootFields = {
    authority: {
      allowed_roots: ["."],
      protected_paths: ["src/protected/**"],
      approval_required_paths: ["src/approval/**"],
    },
  };
  const projection = classifyChangedPathAuthority(rootFields, [
    "README.md",
    "src/approval/change.mjs",
    "src/protected/change.mjs",
  ]);
  assert.equal(projection.status, "protected");
  assert.deepEqual(projection.allowed_paths, ["README.md"]);
  assert.deepEqual(projection.approval_required_paths, ["src/approval/change.mjs"]);
  assert.deepEqual(projection.protected_paths, ["src/protected/change.mjs"]);
});

test("soft classification and hard assertion remain separate", () => {
  const rootFields = {
    authority: {
      allowed_roots: ["src/**"],
      protected_paths: [".git/**"],
      approval_required_paths: [],
    },
  };
  const projection = classifyChangedPathAuthority(rootFields, ["README.md", "src/review.mjs"]);
  assert.equal(projection.status, "provisional-drift");
  assert.deepEqual(projection.outside_allowed_paths, ["README.md"]);
  assert.throws(() => assertChangedPathAuthority(rootFields, ["README.md"], process.cwd()), /outside Root authority/);
});

test("repository and symlink escape fail before any soft projection", () => {
  const repository = mkdtempSync(join(tmpdir(), "workflow-authority-repo-"));
  const external = mkdtempSync(join(tmpdir(), "workflow-authority-external-"));
  try {
    mkdirSync(join(repository, "src"));
    symlinkSync(external, join(repository, "src", "escape"));
    const rootFields = {
      authority: {
        allowed_roots: ["src/**"],
        protected_paths: [],
        approval_required_paths: [],
      },
    };
    assert.throws(
      () => classifyChangedPathAuthority(rootFields, ["src/escape/new-file.mjs"], repository),
      /resolves outside the repository/,
    );
    assert.throws(() => classifyChangedPathAuthority(rootFields, ["../outside.mjs"], repository), /traversal/);
  } finally {
    rmSync(repository, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});
