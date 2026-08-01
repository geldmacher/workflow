import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveStateSubject, inspectState, rebuildStateIndexes } from "../src/controller/state-maintenance.mjs";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const argument = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
};

const command = process.argv[2];
if (!["inspect", "rebuild-index", "archive"].includes(command)) throw new Error("usage: state:maintenance <inspect|rebuild-index|archive> --workspace <absolute-path> [--subject <id>] [--apply]");
const workspaceArgument = argument("workspace");
if (!workspaceArgument) throw new Error("--workspace is required");
const workspace = realpathSync(resolve(workspaceArgument));

let report;
if (command === "inspect") report = inspectState({ workspace });
else if (command === "rebuild-index") report = rebuildStateIndexes({ workspace, pluginRoot });
else {
  const subject = argument("subject");
  if (!subject) throw new Error("archive requires --subject <run-id|preparation-id>");
  report = archiveStateSubject({ workspace, subject, apply: process.argv.includes("--apply") });
}
console.log(JSON.stringify(report, null, 2));
