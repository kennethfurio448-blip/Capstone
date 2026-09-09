import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", ".temp"]);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (ignoredDirectories.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(root);
const failures = [];

for (const file of files.filter((path) => extname(path) === ".js")) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push(`${relative(root, file)}: ${result.stderr.trim()}`);
  }
}

const assetPattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;

for (const file of files.filter((path) => extname(path) === ".html")) {
  const html = readFileSync(file, "utf8");
  let match;

  while ((match = assetPattern.exec(html))) {
    const target = match[1];
    if (/^(?:https?:|#|data:|mailto:|javascript:)/i.test(target)) continue;
    const localTarget = target.split(/[?#]/, 1)[0];
    if (!localTarget) continue;

    const resolvedTarget = resolve(dirname(file), localTarget);
    if (!existsSync(resolvedTarget)) {
      failures.push(
        `${relative(root, file)}: missing local asset ${target}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Project JavaScript and local asset links are valid.");
}
