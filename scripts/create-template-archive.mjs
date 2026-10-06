import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "dist",
  ".turbo",
]);

const IGNORED_FILES = new Set([
  "tsconfig.tsbuildinfo",
  "template-archive.json",
  "package-lock.json", // Optional: keep or regenerate, but let's include or exclude? We can include it or let npm install generate it. Let's include it so exact versions are locked!
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".ico",
  ".icns",
  ".jpg",
  ".jpeg",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
]);

export function buildTemplateArchive() {
  const archive = {};

  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (IGNORED_FILES.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      // Skip temporary or backup files in data/backups
      if (relPath.startsWith("data/backups/")) continue;
      if (relPath.startsWith("dist/")) continue;

      if (entry.isDirectory()) {
        scan(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          archive[relPath] = {
            encoding: "base64",
            content: fs.readFileSync(fullPath).toString("base64"),
          };
        } else {
          archive[relPath] = {
            encoding: "utf8",
            content: fs.readFileSync(fullPath, "utf8"),
          };
        }
      }
    }
  }

  scan(rootDir);
  return archive;
}

// If run directly via CLI
if (process.argv[1] && process.argv[1].endsWith("create-template-archive.mjs")) {
  const archive = buildTemplateArchive();
  const fileCount = Object.keys(archive).length;
  const outPath = path.join(rootDir, "template-archive.json");
  fs.writeFileSync(outPath, JSON.stringify(archive, null, 2), "utf8");
  console.log(`[template-archive] Packed ${fileCount} files into template-archive.json (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
