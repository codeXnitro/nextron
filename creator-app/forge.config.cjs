const path = require("node:path");

const templateDir = path.resolve(__dirname, "..", "out", "creator-template");
const initializerHtml = path.resolve(
  __dirname,
  "..",
  "electron",
  "initializer.html"
);

module.exports = {
  outDir: path.resolve(__dirname, "..", "out", "creator-build"),
  packagerConfig: {
    name: "Nextron Project Creator",
    executableName: "nextron-project-creator",
    asar: true,
    extraResource: [templateDir, initializerHtml],
    ignore: (filePath) => {
      if (!filePath) return false;
      const normalized = filePath.replace(/\\/g, "/");
      return ![
        "/package.json",
        "/creator-main.cjs",
        "/creator-preload.cjs",
      ].includes(normalized);
    },
    win32metadata: {
      CompanyName: "Nextron Team",
      FileDescription: "Nextron Project Creator",
      OriginalFilename: "nextron-project-creator.exe",
      ProductName: "Nextron Project Creator",
      InternalName: "nextron-project-creator",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "nextron_project_creator",
        authors: "Nextron Team",
        description: "Create new Nextron desktop application projects.",
        setupExe: "Nextron-Project-Creator-Setup.exe",
      },
    },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg" },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Nextron Team",
          description: "Create new Nextron desktop application projects.",
          section: "utils",
        },
      },
    },
  ],
};
