import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDir = path.join(rootDir, "out", "creator-template");
const ignoredNames = new Set([
  ".git",
  ".next",
  ".turbo",
  "backups",
  "creator-app",
  "dist",
  "makers",
  "node_modules",
  "out",
]);

function shouldIgnore(entryName, relativePath) {
  if (ignoredNames.has(entryName)) return true;
  if (entryName === "tsconfig.tsbuildinfo") return true;
  if (entryName === "package-lock.json") return true;
  if (entryName === "template-archive.json") return true;
  if (entryName === ".env" || entryName.startsWith(".env.")) return true;
  if (relativePath.startsWith(`data${path.sep}backups${path.sep}`)) return true;
  return false;
}

function copyTemplate(sourceDir, destinationDir, relativeDir = "") {
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (shouldIgnore(entry.name, relativePath)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyTemplate(sourcePath, destinationPath, relativePath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

fs.rmSync(templateDir, { recursive: true, force: true });
copyTemplate(rootDir, templateDir);
console.log(`Prepared Nextron project template at ${templateDir}`);
