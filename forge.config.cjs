// Production Electron Forge packaging & distribution configuration
// Automatically driven by desktop.config.json
const fs = require("node:fs");
const path = require("node:path");

let desktopConfig = {
  app: {
    name: "Nextron",
    slug: "nextron",
    description: "Nextron Desktop Application",
    bundleId: "com.nextron.desktop",
    category: "public.app-category.developer-tools",
    author: { name: "Nextron Team", email: "team@example.com" }
  },
  build: {
    icon: "./public/icon",
    copyright: "Copyright © 2026 Nextron Team",
    windows: {
      productName: "Nextron",
      executableName: "nextron",
      setupExe: "Nextron-Setup.exe"
    },
    linux: {
      maintainer: "Nextron Team <team@example.com>",
      section: "utils"
    }
  }
};

const configPath = path.join(__dirname, "desktop.config.json");
if (fs.existsSync(configPath)) {
  try {
    desktopConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.warn("Could not read desktop.config.json, using defaults", err);
  }
}

const appName = desktopConfig.app?.name || "Nextron";
const executableName = desktopConfig.app?.slug || "nextron";
const bundleId = desktopConfig.app?.bundleId || `com.${executableName}.desktop`;
const category = desktopConfig.app?.category || "public.app-category.developer-tools";
const author = desktopConfig.app?.author?.name || "Nextron Team";
const description = desktopConfig.app?.description || "Nextron Desktop Application";
const iconPath = desktopConfig.build?.icon || "./public/icon";

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    name: appName,
    executableName: executableName,
    appBundleId: bundleId,
    appCategoryType: category,
    appCopyright: desktopConfig.build?.copyright || `Copyright © 2026 ${author}`,
    asar: true,
    extraResource: [".next/standalone"],
    // Automatically uses icon if the file exists on disk
    icon: fs.existsSync(`${iconPath}.ico`) || fs.existsSync(`${iconPath}.png`) ? iconPath : undefined,
    win32metadata: {
      CompanyName: author,
      FileDescription: description,
      OriginalFilename: `${executableName}.exe`,
      ProductName: desktopConfig.build?.windows?.productName || appName,
      InternalName: executableName,
    },
    ignore: (filePath) => {
      if (!filePath) return false;
      const normalized = filePath.replace(/\\/g, "/");
      // Keep package.json in app.asar so Electron knows entry point
      if (normalized === "/package.json") return false;
      // Keep desktop.config.json in app.asar for runtime configurations
      if (normalized === "/desktop.config.json") return false;
      // Keep electron files (main, preload, types)
      if (normalized === "/electron" || normalized.startsWith("/electron/")) return false;
      // Ignore everything else from app.asar (Next.js server is in standalone extraResource)
      return true;
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: executableName,
        authors: author,
        description: description,
        setupExe: desktopConfig.build?.windows?.setupExe || `${appName}-Setup.exe`,
        setupIcon: fs.existsSync(`${iconPath}.ico`) ? `${iconPath}.ico` : undefined,
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: appName,
        icon: fs.existsSync(`${iconPath}.icns`) ? `${iconPath}.icns` : undefined,
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: desktopConfig.build?.linux?.maintainer || `${author} <${desktopConfig.app?.author?.email || 'dev@example.com'}>`,
          description: description,
          section: desktopConfig.build?.linux?.section || "utils",
          icon: fs.existsSync(`${iconPath}.png`) ? `${iconPath}.png` : undefined,
        },
      },
    },
  ],
};
