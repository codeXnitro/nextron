// Production Electron Forge packaging & distribution configuration
/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    name: "Nextron",
    executableName: "nextron",
    appBundleId: "com.nextron.desktop",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    extraResource: [".next/standalone"],
    // Uncomment and add your platform icons (Forge auto-resolves .ico on Windows, .icns on Mac, .png on Linux):
    // icon: "./public/icon",
    win32metadata: {
      CompanyName: "Nextron Team",
      FileDescription: "Nextron Desktop Application",
      OriginalFilename: "nextron.exe",
      ProductName: "Nextron",
      InternalName: "nextron",
    },
    ignore: (filePath) => {
      if (!filePath) return false;
      const normalized = filePath.replace(/\\/g, "/");
      // Keep package.json in app.asar so Electron knows entry point
      if (normalized === "/package.json") return false;
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
        name: "nextron",
        authors: "Nextron Team",
        description: "Nextron Desktop Application powered by Next.js 16 and Electron",
        setupExe: "Nextron-Setup.exe",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: "Nextron",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Nextron Team",
          homepage: "https://github.com/codeXnitro/nextron",
          description: "Nextron Desktop Application",
        },
      },
    },
  ],
};
