import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const IGNORED_PATHS = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  ".turbo",
  "tsconfig.tsbuildinfo",
]);

function copyDirRecursive(src, dest, onFile) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_PATHS.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, onFile);
    } else {
      fs.copyFileSync(srcPath, destPath);
      if (onFile) onFile(entry.name);
    }
  }
}

export async function scaffoldProject({
  sourceDir,
  targetDir,
  config,
  installDeps = false,
  onLog = () => {},
  onProgress = () => {},
}) {
  try {
    const finalProjectDir = path.isAbsolute(targetDir)
      ? targetDir
      : path.resolve(process.cwd(), targetDir);

    onProgress(15, `Creating destination directory: ${finalProjectDir}`);
    if (!fs.existsSync(finalProjectDir)) {
      fs.mkdirSync(finalProjectDir, { recursive: true });
    }

    onProgress(30, "Copying core Nextron desktop kit template files...");
    copyDirRecursive(sourceDir, finalProjectDir, (file) => {
      onLog(`Copied: ${file}`);
    });

    onProgress(60, "Writing customized desktop.config.json...");
    const configPath = path.join(finalProjectDir, "desktop.config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

    onProgress(70, "Synchronizing package.json metadata...");
    const pkgPath = path.join(finalProjectDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      pkg.name = config.app?.slug || "my-desktop-app";
      pkg.version = config.app?.version || "1.0.0";
      pkg.description = config.app?.description || "";
      if (config.app?.author) {
        pkg.author = `${config.app.author.name || "Developer"}${
          config.app.author.email ? ` <${config.app.author.email}>` : ""
        }`;
      }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    }

    onProgress(80, "Initializing fresh real-time database in data/db.json...");
    const dataDir = path.join(finalProjectDir, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbFile = path.join(dataDir, "db.json");
    const initialDb = {
      _meta: {
        version: 2,
        rev: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      todos: [
        {
          id: `todo_${Date.now().toString(36)}_init`,
          title: "Welcome to your new Nextron Desktop App!",
          completed: false,
          priority: "high",
          source: "Nextron Initializer",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(dbFile, JSON.stringify(initialDb, null, 2) + "\n", "utf8");

    if (installDeps) {
      onProgress(85, "Installing dependencies via npm (this may take a minute)...");
      onLog("Running: npm install in " + finalProjectDir);
      try {
        await execAsync("npm install", { cwd: finalProjectDir });
        onLog("npm install completed successfully.");
      } catch (npmErr) {
        onLog(`Warning: npm install had notice: ${npmErr.message}`);
      }
    }

    onProgress(100, "Project scaffolded successfully! ✨");
    return {
      success: true,
      projectPath: finalProjectDir,
    };
  } catch (err) {
    onLog(`Error during scaffolding: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}
