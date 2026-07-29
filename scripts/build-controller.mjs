#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (packageJson.dependencies["@cursor/sdk"] !== "1.0.24") throw new Error("worker-adapter SDK version constant must be updated with @cursor/sdk");
mkdirSync(join(root, "dist"), { recursive: true });
const checkOnly = process.argv.includes("--check");
const noticesPath = join(root, "CONTROLLER_THIRD_PARTY_NOTICES.md");
const platformPackage = `sdk-${process.platform}-${process.arch}`;
const externalWorkerPackages = ["@cursor/sdk", `@cursor/${platformPackage}`];
for (const name of externalWorkerPackages) {
  const directory = join(root, "node_modules", ...name.split("/"));
  if (!existsSync(join(directory, "package.json"))) throw new Error(`missing pinned Cursor SDK runtime package: ${directory}`);
  const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  if (metadata.version !== packageJson.dependencies["@cursor/sdk"]) throw new Error(`${name} must match pinned @cursor/sdk ${packageJson.dependencies["@cursor/sdk"]}`);
}

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
};
const nodeBanner = "#!/usr/bin/env node\nimport { createRequire as __workflowCreateRequire } from 'node:module';\nconst require = __workflowCreateRequire(import.meta.url);";

const entries = [
  [join(root, "src", "mcp", "workflow-mcp.mjs"), join(root, "dist", "workflow-mcp.mjs")],
  [join(root, "src", "worker", "cursor-worker.mjs"), join(root, "dist", "workflow-worker.mjs")],
  [join(root, "src", "controller", "runner.mjs"), join(root, "dist", "workflow-runner.mjs")],
];
const results = await Promise.all(entries.map(([entry, outfile]) => build({
  ...common,
  entryPoints: [entry],
  outfile,
  write: false,
  banner: { js: nodeBanner },
})));
const normalizedOutputs = results.map((result) => `${result.outputFiles[0].text.replace(/[ \t]+$/gm, "").trimEnd()}\n`);

function packageName(input) {
  const marker = "node_modules/";
  const index = input.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = input.slice(index + marker.length).split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

const controllerPackages = [...new Set([
  ...results.flatMap((result) => Object.keys(result.metafile.inputs).map(packageName).filter(Boolean)),
  ...externalWorkerPackages,
])].sort();
const noticeSections = controllerPackages.map((name) => {
  const directory = join(root, "node_modules", ...name.split("/"));
  const metadata = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  let licensePath = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((file) => join(directory, file)).find(existsSync);
  if (!licensePath && name === `@cursor/${platformPackage}`) licensePath = join(root, "node_modules", "@cursor", "sdk", "LICENSE.md");
  if (!licensePath) throw new Error(`Controller package ${name} has no distributable license file`);
  return `## ${name}@${metadata.version}\n\nDeclared license: ${metadata.license ?? "see text below"}\n\n\`\`\`text\n${readFileSync(licensePath, "utf8").trim()}\n\`\`\``;
});
const generatedNotices = `# Controller third-party notices\n\nThe built MCP/controller bundles contain the packages selected by the build, and the worker declares the exact Cursor SDK and matching platform package below as external runtime dependencies. License texts are reproduced from their installed packages; the Cursor platform package uses the Cursor SDK license shipped with the matching version. The external SDK is not copied into dist and must be proven present in the actually installed plugin before automation activation.\n\n${noticeSections.join("\n\n")}\n`;

if (checkOnly) {
  const mismatches = entries.filter(([, outfile], index) => !existsSync(outfile) || readFileSync(outfile, "utf8") !== normalizedOutputs[index]);
  const noticesMismatch = !existsSync(noticesPath) || readFileSync(noticesPath, "utf8") !== generatedNotices;
  if (mismatches.length > 0 || noticesMismatch) {
    console.error(`Controller bundles are stale: ${mismatches.map(([, outfile]) => outfile).join(", ")}`);
    process.exitCode = 1;
  } else console.log("Controller bundles match source.");
} else {
  entries.forEach(([, outfile], index) => writeFileSync(outfile, normalizedOutputs[index]));
  rmSync(join(root, "dist", "node_modules"), { recursive: true, force: true });
  writeFileSync(noticesPath, generatedNotices);
}
