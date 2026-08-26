#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const checkOnly = process.argv.includes("--check");
const nodeBanner = "#!/usr/bin/env node\nimport { createRequire as __workflowCreateRequire } from 'node:module';\nconst require = __workflowCreateRequire(import.meta.url);";
const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
  minifySyntax: true,
  logLevel: checkOnly ? "silent" : "info",
  external: [],
  write: false,
  banner: { js: nodeBanner },
};

const cursor = await build({ ...common, entryPoints: [join(root, "src", "mcp", "workflow-mcp.mjs")], outfile: join(dist, "workflow-mcp.mjs") });
const cursorManual = await build({ ...common, entryPoints: [join(root, "src", "manual", "manual-workflow.mjs")], outfile: join(dist, "manual-workflow.mjs") });
const codex = await build({
  ...common,
  define: { __GELDMACHER_WORKFLOW_MANUAL_CLIENT_HOST__: JSON.stringify("codex") },
  entryPoints: {
    "manual-workflow": join(root, "src", "manual", "manual-workflow.mjs"),
    "workflow-mcp": join(root, "src", "mcp", "workflow-mcp-manual.mjs"),
    "workflow-hook": join(root, "src", "hosts", "codex", "workflow-hook.mjs"),
  },
  outdir: join(dist, "codex"),
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
});
const portable = await build({
  ...common,
  define: { __GELDMACHER_WORKFLOW_MANUAL_CLIENT_HOST__: JSON.stringify("portable") },
  entryPoints: {
    "manual-workflow": join(root, "src", "manual", "manual-workflow.mjs"),
    "workflow-mcp": join(root, "src", "mcp", "workflow-mcp-manual.mjs"),
  },
  outdir: join(dist, "portable"),
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
});

const generated = new Map([cursor, cursorManual, codex, portable].flatMap((result) => result.outputFiles.map((output) => [
  relative(dist, output.path),
  `${output.text.replace(/[ \t]+$/gm, "").trimEnd()}\n`,
])));

function outputFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? outputFiles(path) : [relative(dist, path)];
  }).sort();
}

if (checkOnly) {
  const actual = outputFiles(dist);
  const expected = [...generated.keys()].sort();
  const mismatches = expected.filter((file) => !existsSync(join(dist, file)) || readFileSync(join(dist, file), "utf8") !== generated.get(file));
  const extras = actual.filter((file) => !generated.has(file));
  if (mismatches.length > 0 || extras.length > 0) {
    console.error(`Workflow runtime bundles are stale: ${[...mismatches, ...extras].join(", ")}`);
    process.exitCode = 1;
  } else console.log("Workflow runtime bundles match source.");
} else {
  rmSync(dist, { recursive: true, force: true });
  for (const [file, content] of generated) {
    const path = join(dist, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(`Built ${generated.size} host-neutral Workflow runtime bundles.`);
}
