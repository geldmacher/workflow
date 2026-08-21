#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  ArtifactHandoffStore,
  quarantineContentAddressedHandoffArtifact
} from "./chunks/chunk-OYSBJH5W.mjs";
import "./chunks/chunk-WNGW7KKK.mjs";
import {
  PreparationStore,
  RunStore,
  defaultStateRoot
} from "./chunks/chunk-QOWQ6ETR.mjs";
import "./chunks/chunk-LFEO5XYI.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// scripts/state-maintenance.mjs
import { realpathSync } from "node:fs";
import { dirname as dirname2, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// src/controller/state-maintenance.mjs
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
function stateInventory(root) {
  const files = [];
  let bytes = 0;
  const visit = (path) => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`state archive refuses symlink ${path}`);
    if (stat.isDirectory()) return readdirSync(path).sort().forEach((entry) => visit(join(path, entry)));
    if (!stat.isFile()) throw new Error(`state archive refuses non-file ${path}`);
    const content = readFileSync(path);
    bytes += content.length;
    files.push({ path: relative(root, path), size: content.length, hash: createHash("sha256").update(content).digest("hex") });
  };
  if (existsSync(root)) visit(root);
  return { files, bytes, hash: createHash("sha256").update(JSON.stringify(files)).digest("hex") };
}
function inspectState({ workspace: workspace2, stateRoot = defaultStateRoot(workspace2) }) {
  const report2 = stateInventory(stateRoot);
  return { command: "inspect", workspace: workspace2, state_root: stateRoot, files: report2.files.length, bytes: report2.bytes, state_hash: report2.hash };
}
function rebuildStateIndexes({ workspace: workspace2, pluginRoot: pluginRoot2, stateRoot = defaultStateRoot(workspace2) }) {
  const runs = new RunStore(stateRoot).rebuildIndex();
  const preparations = new PreparationStore(stateRoot).rebuildIndex();
  const handoff = new ArtifactHandoffStore(stateRoot, pluginRoot2).rebuildIndex();
  return { command: "rebuild-index", workspace: workspace2, runs: runs.subjects.length, preparations: preparations.subjects.length, handoff_artifacts: handoff.entries.length };
}
function quarantineHandoffReview({
  rootHash,
  artifactId,
  expectedTextHash,
  pluginRoot: pluginRoot2,
  apply = false,
  now,
  handoffOptions = {}
}) {
  return quarantineContentAddressedHandoffArtifact({
    rootHash,
    artifactId,
    expectedTextHash,
    pluginRoot: pluginRoot2,
    apply,
    now,
    options: handoffOptions
  });
}
function archiveStateSubject({ workspace: workspace2, subject, apply = false, stateRoot = defaultStateRoot(workspace2) }) {
  const runStore = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  let kind;
  let source;
  let terminal;
  if (existsSync(runStore.runPath(subject))) {
    kind = "runs";
    source = runStore.runDirectory(subject);
    terminal = ["achieved", "accepted-provisional", "blocked", "stopped", "failed"].includes(runStore.get(subject).lifecycle);
  } else if (existsSync(preparationStore.preparationPath(subject))) {
    kind = "preparations";
    source = preparationStore.preparationDirectory(subject);
    terminal = ["consumed", "expired", "failed", "stopped"].includes(preparationStore.get(subject).status);
  } else throw new Error(`unknown Workflow subject ${subject}`);
  if (!terminal) throw new Error(`state archive accepts only terminal subjects: ${subject}`);
  const contents = stateInventory(source);
  const target = join(stateRoot, "archive", kind, subject);
  if (existsSync(target)) throw new Error(`state archive target already exists: ${target}`);
  const report2 = { command: "archive", workspace: workspace2, subject, kind, source, target, files: contents.files.length, bytes: contents.bytes, content_hash: contents.hash, applied: apply };
  if (apply) {
    mkdirSync(dirname(target), { recursive: true, mode: 448 });
    renameSync(source, target);
    try {
      writeFileSync(join(target, "archive-manifest.json"), `${JSON.stringify({ ...report2, archived_at: (/* @__PURE__ */ new Date()).toISOString(), files: contents.files }, null, 2)}
`, { mode: 384, flag: "wx" });
    } catch (error) {
      renameSync(target, source);
      throw error;
    }
    if (kind === "runs") runStore.rebuildIndex();
    else preparationStore.rebuildIndex();
  }
  return report2;
}

// scripts/state-maintenance.mjs
var pluginRoot = dirname2(dirname2(fileURLToPath(import.meta.url)));
var argument = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
};
var command = process.argv[2];
if (!["inspect", "rebuild-index", "archive", "quarantine-handoff"].includes(command)) throw new Error("usage: state:maintenance <inspect|rebuild-index|archive> --workspace <absolute-path> [--subject <id>] [--apply] | quarantine-handoff --root-hash <sha256> --artifact <wr|de-id> --expected-text-hash <sha256> [--apply]");
if (command === "quarantine-handoff") {
  const rootHash = argument("root-hash");
  const artifactId = argument("artifact");
  const expectedTextHash = argument("expected-text-hash");
  if (!rootHash || !artifactId || !expectedTextHash) throw new Error("quarantine-handoff requires --root-hash, --artifact, and --expected-text-hash");
  console.log(JSON.stringify(quarantineHandoffReview({
    rootHash,
    artifactId,
    expectedTextHash,
    pluginRoot,
    apply: process.argv.includes("--apply")
  }), null, 2));
  process.exit(0);
}
var workspaceArgument = argument("workspace");
if (!workspaceArgument) throw new Error("--workspace is required");
var workspace = realpathSync(resolve(workspaceArgument));
var report;
if (command === "inspect") report = inspectState({ workspace });
else if (command === "rebuild-index") report = rebuildStateIndexes({ workspace, pluginRoot });
else {
  const subject = argument("subject");
  if (!subject) throw new Error("archive requires --subject <run-id|preparation-id>");
  report = archiveStateSubject({ workspace, subject, apply: process.argv.includes("--apply") });
}
console.log(JSON.stringify(report, null, 2));
