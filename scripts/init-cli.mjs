import readline from "node:readline";
import path from "node:path";
import fs from "node:fs";
import { scaffoldProject } from "./scaffold.mjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query, defaultValue) =>
  new Promise((resolve) => {
    rl.question(`${query} ${defaultValue ? `(${defaultValue}): ` : ": "}`, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });

async function run() {
  console.log("\n=======================================================");
  console.log("  🚀 Nextron Desktop App Initializer (CLI)");
  console.log("  Scaffold a new Next.js 16 + Electron app anywhere!");
  console.log("=======================================================\n");

  const appName = await question("Application Name", "My Desktop App");
  const defaultSlug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const appSlug = await question("App Slug (folder name)", defaultSlug);
  const targetDirInput = await question("Target Directory", path.resolve(process.cwd(), "..", appSlug));
  const appDesc = await question("Description", "A production desktop application built with Next.js 16 and Electron");
  const authorName = await question("Author Name", "Developer");
  const authorEmail = await question("Author Email", "dev@example.com");
  const bundleId = await question("Bundle ID", `com.${appSlug}.desktop`);
  const installDepsStr = await question("Run 'npm install' automatically? (y/n)", "y");

  const installDeps = installDepsStr.toLowerCase().startsWith("y");

  const config = {
    app: {
      name: appName,
      slug: appSlug,
      version: "1.0.0",
      description: appDesc,
      author: {
        name: authorName,
        email: authorEmail,
      },
      bundleId,
      category: "public.app-category.developer-tools",
    },
    window: {
      title: appName,
      width: 1280,
      height: 840,
      minWidth: 920,
      minHeight: 620,
      backgroundColor: "#090d16",
      titleBarStyle: "hidden",
      frame: false,
      resizable: true,
      maximizable: true,
      minimizable: true,
      center: true,
    },
    database: {
      filename: "db.json",
      autoBackup: true,
      backupIntervalMinutes: 60,
    },
    build: {
      icon: "./public/icon",
      copyright: `Copyright © ${new Date().getFullYear()} ${authorName}`,
      windows: {
        productName: appName,
        executableName: appSlug,
        setupExe: `${appName.replace(/\s+/g, "")}-Setup.exe`,
      },
      linux: {
        maintainer: `${authorName} <${authorEmail}>`,
        section: "utils",
      },
    },
  };

  console.log("\n⚙️ Scaffolding your project...");

  const sourceDir = process.cwd();
  const result = await scaffoldProject({
    sourceDir,
    targetDir: targetDirInput,
    config,
    installDeps,
    onLog: (msg) => console.log(`  ${msg}`),
    onProgress: (pct, step) => console.log(`[${pct}%] ${step}`),
  });

  if (result.success) {
    console.log("\n=======================================================");
    console.log("  🎉 Project Successfully Initialized!");
    console.log(`  Path: ${result.projectPath}`);
    console.log("=======================================================\n");
    console.log("To get started:");
    console.log(`  cd "${path.relative(process.cwd(), result.projectPath)}"`);
    if (!installDeps) {
      console.log("  npm install");
    }
    console.log("  npm run dev\n");
  } else {
    console.error(`\n❌ Failed to scaffold project: ${result.error}`);
  }

  rl.close();
}

run();
