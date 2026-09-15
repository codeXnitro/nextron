// This is the one place to customize installers, app metadata, icons, and signing.
/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [".next/standalone"],
  },
  makers: [
    { name: "@electron-forge/maker-squirrel", config: { name: "next_electron_desktop_kit" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg" },
    { name: "@electron-forge/maker-deb", config: {} },
  ],
};
