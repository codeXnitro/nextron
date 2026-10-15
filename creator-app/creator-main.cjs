const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

function handleSquirrelEvent() {
  if (process.platform !== "win32") return false;

  const event = process.argv[1];
  const updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe");
  const executableName = path.basename(process.execPath);

  if (event === "--squirrel-install" || event === "--squirrel-updated") {
    const updater = spawn(updateExe, [`--createShortcut=${executableName}`], {
      detached: true,
      stdio: "ignore",
    });
    updater.on("error", (error) =>
      console.error("Could not create the Creator shortcut.", error)
    );
    updater.unref();
  } else if (event === "--squirrel-uninstall") {
    const updater = spawn(updateExe, [`--removeShortcut=${executableName}`], {
      detached: true,
      stdio: "ignore",
    });
    updater.on("error", (error) =>
      console.error("Could not remove the Creator shortcut.", error)
    );
    updater.unref();
  } else if (event !== "--squirrel-obsolete") {
    return false;
  }

  app.quit();
  return true;
}

if (!handleSquirrelEvent()) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
  let mainWindow;

  function getTemplateDir() {
    return app.isPackaged
      ? path.join(process.resourcesPath, "creator-template")
      : path.resolve(__dirname, "..");
  }

  function getInitializerPath() {
    return app.isPackaged
      ? path.join(process.resourcesPath, "initializer.html")
      : path.resolve(__dirname, "..", "electron", "initializer.html");
  }

  async function createWindow() {
    mainWindow = new BrowserWindow({
      width: 980,
      height: 720,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: "#090d16",
      title: "Nextron Project Creator",
      webPreferences: {
        preload: path.join(__dirname, "creator-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.setMenuBarVisibility(false);
    await mainWindow.loadFile(getInitializerPath());
  }

  app.whenReady().then(async () => {
    ipcMain.handle("initializer:pick-folder", async () => {
      const result = await dialog.showOpenDialog({
        title: "Select Project Destination Folder",
        properties: ["openDirectory", "createDirectory"],
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle("initializer:start", async (event, payload) => {
      try {
        const sourceDir = getTemplateDir();
        const scaffoldModule = await import(
          pathToFileURL(path.join(sourceDir, "scripts", "scaffold.mjs")).href
        );
        return await scaffoldModule.scaffoldProject({
          sourceDir,
          targetDir: payload.targetDir,
          config: payload.config,
          installDeps: payload.installDeps,
          onLog: (message) =>
            event.sender.send("initializer:log", message),
          onProgress: (percent, step) =>
            event.sender.send("initializer:progress", percent, step),
        });
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    ipcMain.handle("initializer:open-folder", (_event, dirPath) =>
      shell.openPath(dirPath)
    );
    ipcMain.handle("initializer:open-vscode", (_event, dirPath) => {
      const child = spawn("code", [dirPath], { windowsHide: true });
      child.on("error", (error) => {
        dialog.showErrorBox(
          "Could not open Visual Studio Code",
          `The "code" command could not be started: ${error.message}`
        );
      });
    });

    await createWindow();
  }).catch(async (error) => {
    console.error("Unable to start the Nextron Project Creator.", error);
    await dialog.showMessageBox({
      type: "error",
      title: "Project Creator Startup Error",
      message: "The Nextron Project Creator could not start.",
      detail: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  });

  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  }
}
