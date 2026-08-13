#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { sdkVersion } from "../src/controller/worker-adapter.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (packageJson.dependencies["@cursor/sdk"] !== sdkVersion) throw new Error("worker-adapter SDK version must match package.json @cursor/sdk");
mkdirSync(dist, { recursive: true });
const checkOnly = process.argv.includes("--check");
const noticesPath = join(root, "CONTROLLER_THIRD_PARTY_NOTICES.md");
const codexNoticesPath = join(root, "CODEX_THIRD_PARTY_NOTICES.md");
const platformPackage = `sdk-${process.platform}-${process.arch}`;
const externalWorkerPackages = ["@cursor/sdk", `@cursor/${platformPackage}`];
for (const name of externalWorkerPackages) {
  const directory = join(root, "node_modules", ...name.split("/"));
  if (!existsSync(join(directory, "package.json"))) throw new Error(`missing pinned Cursor SDK runtime package: ${directory}`);
  const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  if (metadata.version !== sdkVersion) throw new Error(`${name} must match pinned @cursor/sdk ${sdkVersion}`);
}
// Notices must list every optional Cursor platform package so CONTROLLER_THIRD_PARTY_NOTICES.md
// is host-stable (Linux CI vs macOS local). Only the host platform package is required installed.
const sdkOptionalPlatformPackages = Object.entries(
  JSON.parse(readFileSync(join(root, "node_modules", "@cursor", "sdk", "package.json"), "utf8")).optionalDependencies || {},
).filter(([name]) => name.startsWith("@cursor/sdk-")).sort(([left], [right]) => left.localeCompare(right));
const sdkOptionalPlatformVersions = Object.fromEntries(sdkOptionalPlatformPackages);

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
  logLevel: checkOnly ? "silent" : "info",
  external: ["@cursor/sdk"],
  metafile: true,
  write: false,
};
const nodeBanner = "#!/usr/bin/env node\nimport { createRequire as __workflowCreateRequire } from 'node:module';\nconst require = __workflowCreateRequire(import.meta.url);";
const sharedEntries = {
  "workflow-mcp": join(root, "src", "mcp", "workflow-mcp.mjs"),
  "workflow-runner": join(root, "src", "controller", "runner.mjs"),
  "workflow-fanout": join(root, "src", "controller", "read-fanout-runner.mjs"),
  "workflow-capability-spike": join(root, "scripts", "capability-spike.mjs"),
  "workflow-provision-worker-runtime": join(root, "scripts", "provision-worker-runtime.mjs"),
  "workflow-sdk-crash-probe": join(root, "scripts", "sdk-crash-probe.mjs"),
  "workflow-state-maintenance": join(root, "scripts", "state-maintenance.mjs"),
};

const sharedResult = await build({
  ...common,
  entryPoints: sharedEntries,
  outdir: dist,
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  outExtension: { ".js": ".mjs" },
  splitting: true,
  banner: { js: nodeBanner },
});
const independentResult = await build({
  ...common,
  entryPoints: sharedEntries,
  outdir: dist,
  entryNames: "independent-[name]",
  outExtension: { ".js": ".mjs" },
  splitting: false,
  banner: { js: nodeBanner },
  logLevel: "silent",
});
const sharedBytes = sharedResult.outputFiles.reduce((total, output) => total + output.contents.length, 0);
const independentBytes = independentResult.outputFiles.reduce((total, output) => total + output.contents.length, 0);
const sharedSavings = 1 - (sharedBytes / independentBytes);
if (sharedSavings < 0.15) throw new Error(`shared controller chunks save only ${(sharedSavings * 100).toFixed(1)}%; require at least 15%`);
const workerResult = await build({
  ...common,
  entryPoints: [join(root, "src", "worker", "cursor-worker.mjs")],
  outfile: join(dist, "workflow-worker.mjs"),
  banner: { js: nodeBanner },
});
const codexResult = await build({
  ...common,
  external: [],
  entryPoints: {
    "workflow-mcp": join(root, "src", "mcp", "workflow-mcp-manual.mjs"),
    "workflow-hook": join(root, "src", "hosts", "codex", "workflow-hook.mjs"),
  },
  outdir: join(dist, "codex"),
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
  splitting: false,
  banner: { js: nodeBanner },
});
const hookHelperResult = await build({
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
  logLevel: checkOnly ? "silent" : "info",
  entryPoints: [join(root, "src", "core", "manual-subagent-policy.mjs")],
  outfile: join(root, "hooks", "manual-subagent-policy.mjs"),
  banner: { js: nodeBanner },
  write: false,
  metafile: true,
});
const generatedHookHelper = `${hookHelperResult.outputFiles[0].text.replace(/[ \t]+$/gm, "").trimEnd()}\n`;
const hookHelperPath = join(root, "hooks", "manual-subagent-policy.mjs");
const results = [sharedResult, workerResult, codexResult];
const generated = new Map(results.flatMap((result) => result.outputFiles.map((output) => [
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

function packageName(input) {
  const marker = "node_modules/";
  const index = input.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = input.slice(index + marker.length).split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

const controllerPackages = [...new Set([
  ...[sharedResult, workerResult].flatMap((result) => Object.keys(result.metafile.inputs).map(packageName).filter(Boolean)),
  "@cursor/sdk",
  ...sdkOptionalPlatformPackages.map(([name]) => name),
])].sort();
// npm packages commonly ship LICENSE or lowercase license (e.g. path-key, cross-spawn).
// Lookup must work on case-sensitive filesystems (Linux CI); do not rely on macOS case folding.
const licenseFileNames = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md", "license.txt"];
function findPackageLicense(directory) {
  return licenseFileNames.map((file) => join(directory, file)).find(existsSync);
}

const noticeSections = controllerPackages.map((name) => {
  const directory = join(root, "node_modules", ...name.split("/"));
  const packageJsonPath = join(directory, "package.json");
  let metadata = null;
  if (existsSync(packageJsonPath)) {
    metadata = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } else if (sdkOptionalPlatformVersions[name]) {
    metadata = { version: sdkOptionalPlatformVersions[name], license: "SEE LICENSE IN LICENSE.md" };
  }
  if (!metadata) throw new Error(`Controller package ${name} is missing package metadata`);
  let licensePath = findPackageLicense(directory);
  if (!licensePath && (name === "@cursor/sdk" || name.startsWith("@cursor/sdk-"))) {
    licensePath = join(root, "node_modules", "@cursor", "sdk", "LICENSE.md");
  }
  if (!licensePath) throw new Error(`Controller package ${name} has no distributable license file`);
  return `## ${name}@${metadata.version}\n\nDeclared license: ${metadata.license ?? "see text below"}\n\n\`\`\`text\n${readFileSync(licensePath, "utf8").trim()}\n\`\`\``;
});
const generatedNotices = `# Controller third-party notices\n\nThe built MCP/controller bundles contain the packages selected by the build, and the worker declares the exact Cursor SDK and its optional platform packages below as external runtime dependencies. License texts are reproduced from their installed packages; each Cursor platform package uses the Cursor SDK license shipped with the matching version. The external SDK is not copied into dist and must be proven present in the actually installed plugin before automation activation.\n\n${noticeSections.join("\n\n")}\n`;

const codexPackages = [...new Set(Object.keys(codexResult.metafile.inputs).map(packageName).filter(Boolean))].sort();
if (codexPackages.some((name) => name.startsWith("@cursor/"))) throw new Error("Codex bundles must not include Cursor packages");
const codexNoticeSections = codexPackages.map((name) => {
  const directory = join(root, "node_modules", ...name.split("/"));
  const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const licensePath = findPackageLicense(directory);
  if (!licensePath) throw new Error(`Codex package ${name} has no distributable license file`);
  return `## ${name}@${metadata.version}\n\nDeclared license: ${metadata.license ?? "see text below"}\n\n\`\`\`text\n${readFileSync(licensePath, "utf8").trim()}\n\`\`\``;
});
const generatedCodexNotices = `# Codex third-party notices\n\nThe standalone Manual MCP and lifecycle-policy bundles contain only the packages selected by the Codex build. They do not include host-specific automation dependencies.\n\n${codexNoticeSections.join("\n\n")}\n`;

const codexBundleText = [...generated]
  .filter(([file]) => file.startsWith("codex/"))
  .map(([, content]) => content)
  .join("\n");
for (const forbidden of ["@cursor/sdk", "CURSOR_API_KEY", "workflow_prepare", "workflow_start", "workflow_watch", "workflow_control", "workflow_answer", "workflow_validate_models", "workflow_verification_profile"]) {
  if (codexBundleText.includes(forbidden)) throw new Error(`Codex bundle leaked forbidden Cursor surface: ${forbidden}`);
}

if (checkOnly) {
  const actual = outputFiles(dist);
  const expected = [...generated.keys()].sort();
  const mismatches = expected.filter((file) => !existsSync(join(dist, file)) || readFileSync(join(dist, file), "utf8") !== generated.get(file));
  const extras = actual.filter((file) => !generated.has(file));
  const noticesMismatch = !existsSync(noticesPath) || readFileSync(noticesPath, "utf8") !== generatedNotices;
  const codexNoticesMismatch = !existsSync(codexNoticesPath) || readFileSync(codexNoticesPath, "utf8") !== generatedCodexNotices;
  const hookHelperMismatch = !existsSync(hookHelperPath) || readFileSync(hookHelperPath, "utf8") !== generatedHookHelper;
  if (mismatches.length > 0 || extras.length > 0 || noticesMismatch || codexNoticesMismatch || hookHelperMismatch) {
    console.error(`Controller bundles are stale: ${[
      ...mismatches,
      ...extras,
      ...(noticesMismatch ? ["CONTROLLER_THIRD_PARTY_NOTICES.md"] : []),
      ...(codexNoticesMismatch ? ["CODEX_THIRD_PARTY_NOTICES.md"] : []),
      ...(hookHelperMismatch ? ["hooks/manual-subagent-policy.mjs"] : []),
    ].join(", ")}`);
    process.exitCode = 1;
  } else console.log("Controller bundles match source.");
} else {
  rmSync(dist, { recursive: true, force: true });
  for (const [file, content] of generated) {
    const path = join(dist, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  writeFileSync(noticesPath, generatedNotices);
  writeFileSync(codexNoticesPath, generatedCodexNotices);
  writeFileSync(hookHelperPath, generatedHookHelper);
  console.log(`Shared controller chunks save ${(sharedSavings * 100).toFixed(1)}% versus independent bundles.`);
}
