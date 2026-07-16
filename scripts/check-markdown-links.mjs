#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ignoredDirectories = new Set([".git", "node_modules"]);

function files(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...files(path));
    else if ([".md", ".mdc"].includes(extname(path))) result.push(path);
  }
  return result;
}

const slug = (heading) => heading.trim().toLowerCase().replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-");

export function checkMarkdownLinks(pluginRoot = root) {
  const failures = [];
  const rootPath = resolve(pluginRoot);
  for (const file of files(rootPath)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      let target = match[1].replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|data:)/i.test(target)) continue;
      const [pathPart, anchor] = target.split("#", 2);
      const targetPath = pathPart ? resolve(dirname(file), decodeURIComponent(pathPart)) : file;
      const relativeTarget = relative(rootPath, targetPath);
      if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`)) {
        failures.push(`${relative(rootPath, file)}: link escapes plugin root: ${target}`);
        continue;
      }
      if (!existsSync(targetPath)) {
        failures.push(`${relative(rootPath, file)}: missing link target: ${target}`);
        continue;
      }
      if (anchor && statSync(targetPath).isFile() && [".md", ".mdc"].includes(extname(targetPath))) {
        const anchors = [...readFileSync(targetPath, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)].map((heading) => slug(heading[1]));
        if (!anchors.includes(anchor.toLowerCase())) failures.push(`${relative(rootPath, file)}: missing anchor #${anchor} in ${basename(targetPath)}`);
      }
    }
  }
  return failures;
}

function runCli() {
  const failures = checkMarkdownLinks(root);
  if (failures.length > 0) {
    console.error("Markdown link validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Markdown link validation passed.");
  }
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
