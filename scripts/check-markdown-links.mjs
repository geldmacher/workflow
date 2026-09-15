#!/usr/bin/env node
import { realpathSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function files(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...files(path));
    else if ([".md", ".mdc"].includes(extname(path))) result.push(path);
  }
  return result;
}

const slug = (heading) => heading.trim().toLowerCase().replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-");

export function checkMarkdownLinks(pluginRoot = root, { source = false } = {}) {
  const failures = [];
  const rootPath = resolve(pluginRoot);
  const selected = source
    ? [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: rootPath, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\0").filter(Boolean))]
      .map((path) => join(rootPath, path))
      .filter((path) => [".md", ".mdc"].includes(extname(path)) && existsSync(path))
    : files(rootPath);
  for (const file of selected) {
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
  const failures = checkMarkdownLinks(root, { source: true });
  if (failures.length > 0) {
    console.error("Markdown link validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Markdown link validation passed.");
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
