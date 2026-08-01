import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { ArtifactHandoffStore } from "./artifact-handoff.mjs";
import { PreparationStore, RunStore, defaultStateRoot } from "./store.mjs";

export function stateInventory(root) {
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

export function inspectState({ workspace, stateRoot = defaultStateRoot(workspace) }) {
  const report = stateInventory(stateRoot);
  return { command: "inspect", workspace, state_root: stateRoot, files: report.files.length, bytes: report.bytes, state_hash: report.hash };
}

export function rebuildStateIndexes({ workspace, pluginRoot, stateRoot = defaultStateRoot(workspace) }) {
  const runs = new RunStore(stateRoot).rebuildIndex();
  const preparations = new PreparationStore(stateRoot).rebuildIndex();
  const handoff = new ArtifactHandoffStore(stateRoot, pluginRoot).rebuildIndex();
  return { command: "rebuild-index", workspace, runs: runs.subjects.length, preparations: preparations.subjects.length, handoff_artifacts: handoff.entries.length };
}

export function archiveStateSubject({ workspace, subject, apply = false, stateRoot = defaultStateRoot(workspace) }) {
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
  const report = { command: "archive", workspace, subject, kind, source, target, files: contents.files.length, bytes: contents.bytes, content_hash: contents.hash, applied: apply };
  if (apply) {
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    renameSync(source, target);
    try {
      writeFileSync(join(target, "archive-manifest.json"), `${JSON.stringify({ ...report, archived_at: new Date().toISOString(), files: contents.files }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    } catch (error) {
      renameSync(target, source);
      throw error;
    }
    if (kind === "runs") runStore.rebuildIndex();
    else preparationStore.rebuildIndex();
  }
  return report;
}
