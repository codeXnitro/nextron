// This is the one place to customize installers, app metadata, icons, and signing.
/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [".next/standalone"],
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
    { name: "@electron-forge/maker-squirrel", config: { name: "next_electron_desktop_kit" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg" },
    { name: "@electron-forge/maker-deb", config: {} },
  ],
};
