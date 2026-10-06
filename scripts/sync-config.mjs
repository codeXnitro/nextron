import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const configPath = path.join(rootDir, "desktop.config.json");
const packageJsonPath = path.join(rootDir, "package.json");

if (!fs.existsSync(configPath)) {
  console.warn("[sync-config] desktop.config.json not found, skipping sync.");
  process.exit(0);
}

try {
  const desktopConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  let changed = false;

  if (desktopConfig.app?.slug && packageJson.name !== desktopConfig.app.slug) {
    packageJson.name = desktopConfig.app.slug;
    changed = true;
  }

  if (desktopConfig.app?.version && packageJson.version !== desktopConfig.app.version) {
    packageJson.version = desktopConfig.app.version;
    changed = true;
  }

  if (desktopConfig.app?.description && packageJson.description !== desktopConfig.app.description) {
    packageJson.description = desktopConfig.app.description;
    changed = true;
  }

  const authorStr = desktopConfig.app?.author
    ? `${desktopConfig.app.author.name || "Developer"}${
        desktopConfig.app.author.email ? ` <${desktopConfig.app.author.email}>` : ""
      }`
    : packageJson.author;

  if (authorStr && packageJson.author !== authorStr) {
    packageJson.author = authorStr;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf8");
    console.log("[sync-config] Synchronized package.json from desktop.config.json successfully.");
  }
} catch (err) {
  console.error("[sync-config] Failed to sync config:", err);
}
