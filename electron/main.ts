import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  Notification,
  clipboard,
  nativeTheme,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import type { ChildProcess } from "node:child_process";
import { initDatabase } from "./database";

// Handle Squirrel installer events on Windows directly without external dependencies
function handleSquirrelEvent(): boolean {
  if (process.platform !== "win32") return false;
  const cmd = process.argv[1];
  const target = path.basename(process.execPath);

  const runUpdate = (args: string[]) => {
    const updateExe = path.resolve(path.dirname(process.execPath), "..", "Update.exe");
    try {
      spawn(updateExe, args, { detached: true }).on("close", () => {
        app.quit();
        process.exit(0);
      });
    } catch {
      app.quit();
      process.exit(0);
    }
  };

  if (cmd === "--squirrel-install" || cmd === "--squirrel-updated") {
    runUpdate(["--createShortcut=" + target]);
    return true;
  }
  if (cmd === "--squirrel-uninstall") {
    runUpdate(["--removeShortcut=" + target]);
    return true;
  }
  if (cmd === "--squirrel-obsolete") {
    app.quit();
    process.exit(0);
    return true;
  }
  return false;
}

if (handleSquirrelEvent()) {
  process.exit(0);
}

const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
let desktopServerPort: number | null = null;
let serverStderrBuffer: string[] = [];

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

/**
 * Resolves and ensures the database directory inside the application directory (app.getAppPath()).
 * Works automatically in development, packaged app (.asar), and handles permissions.
 */
function getDatabaseDir(): string {
  if (process.env.DATABASE_DIR) return process.env.DATABASE_DIR;

  let baseDir: string;
  try {
    const appPath = app.getAppPath();
    if (!app.isPackaged && !appPath.endsWith(".asar")) {
      baseDir = path.join(appPath, "data");
    } else {
      const resourcesDir = path.dirname(appPath);
      baseDir = path.join(resourcesDir, "data");
    }

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    fs.accessSync(baseDir, fs.constants.W_OK);
    return baseDir;
  } catch {
    const fallback = path.join(app.getPath("userData"), "data");
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

// Initialize database in the application directory
const dbDir = getDatabaseDir();
process.env.DATABASE_DIR = dbDir;
const db = initDatabase({ dataDir: dbDir });

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port =
        typeof address === "object" && address ? address.port : null;
      probe.close((error) => (error ? reject(error) : resolve(port!)));
    });
  });
}

function stopServer(): void {
  if (nextServer && nextServer.pid) {
    const pid = nextServer.pid;
    nextServer = null;
    if (process.platform === "win32") {
      try {
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } catch {
        // Fallback
      }
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Fallback
      }
    }
  }
}

async function startPackagedNextServer(): Promise<void> {
  const serverDirectory = path.join(process.resourcesPath, "standalone");
  const serverFile = path.join(serverDirectory, "server.js");

  if (!fs.existsSync(serverFile)) {
    throw new Error(
      `Packaged Next.js standalone server is missing at:\n${serverFile}`
    );
  }

  desktopServerPort = await findAvailablePort();
  serverStderrBuffer = [];

  nextServer = spawn(process.execPath, [serverFile], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(desktopServerPort),
      NODE_ENV: "production",
      DATABASE_DIR: dbDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextServer.stdout?.on("data", (chunk: Buffer) => {
    if (isDevelopment) process.stdout.write(chunk);
  });

  nextServer.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (isDevelopment) process.stderr.write(chunk);
    serverStderrBuffer.push(text);
    if (serverStderrBuffer.length > 30) serverStderrBuffer.shift();
  });

  nextServer.once("exit", (code, signal) => {
    if (nextServer) {
      console.warn(
        `Next.js server exited unexpectedly with code ${code}, signal ${signal}`
      );
      nextServer = null;
    }
  });
}

function waitForPackagedServer(retries = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const startupError = (error: Error) => {
      if (resolved) return;
      resolved = true;
      const recentErrors = serverStderrBuffer.join("\n").trim();
      const detailedMessage = recentErrors
        ? `${error.message}\n\nServer Output:\n${recentErrors}`
        : error.message;
      reject(new Error(detailedMessage));
    };

    const serverExit = (code: number | null, signal: string | null) => {
      startupError(
        new Error(
          `The packaged Next.js server stopped during startup (code: ${
            code ?? "unknown"
          }, signal: ${signal ?? "none"}).`
        )
      );
    };

    nextServer?.once("error", startupError);
    nextServer?.once("exit", serverExit);

    const attempt = () => {
      if (resolved) return;
      const socket = net.connect(desktopServerPort!, "127.0.0.1");

      socket.once("connect", () => {
        resolved = true;
        socket.end();
        nextServer?.removeListener("error", startupError);
        nextServer?.removeListener("exit", serverExit);
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (retries-- <= 0) {
          startupError(
            new Error("The packaged Next.js server timed out during initialization.")
          );
        } else {
          setTimeout(attempt, 150);
        }
      });
    };

    attempt();
  });
}

async function createWindow(): Promise<void> {
  if (!isDevelopment && !nextServer) {
    await startPackagedNextServer();
    await waitForPackagedServer();
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: "#090d16",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // Send maximize/unmaximize state changes to renderer for custom title bar
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("desktop:window:maximize-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("desktop:window:maximize-change", false);
  });

  if (isDevelopment) {
    await mainWindow.webContents.session.clearCache();
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        details.requestHeaders["Cache-Control"] =
          "no-cache, no-store, must-revalidate";
        details.requestHeaders["Pragma"] = "no-cache";
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    await mainWindow.loadURL("http://127.0.0.1:3000");
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${desktopServerPort}`);
  }
}

async function handleStartupFailure(error: unknown): Promise<void> {
  console.error("Unable to start the desktop application.", error);
  await dialog.showMessageBox({
    type: "error",
    title: "Application Startup Error",
    message: "The local desktop server could not be started.",
    detail: error instanceof Error ? error.message : String(error),
  });
  stopServer();
  app.quit();
}

app
  .whenReady()
  .then(async () => {
    if (!hasSingleInstanceLock) return;

    // General System IPC
    ipcMain.handle("desktop:get-version", () => app.getVersion());
    ipcMain.handle("desktop:get-platform", () => process.platform);

    ipcMain.handle("desktop:open-external", async (_event, url: string) => {
      const target = new URL(url);
      if (target.protocol !== "https:" && target.protocol !== "http:") {
        throw new Error("Only HTTP(S) links may be opened from the app.");
      }
      await shell.openExternal(target.toString());
    });

    // Window Controls IPC
    ipcMain.handle("desktop:window:minimize", () => {
      mainWindow?.minimize();
    });
    ipcMain.handle("desktop:window:maximize", () => {
      mainWindow?.maximize();
    });
    ipcMain.handle("desktop:window:unmaximize", () => {
      mainWindow?.unmaximize();
    });
    ipcMain.handle("desktop:window:toggle-maximize", () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return mainWindow.isMaximized();
      }
      return false;
    });
    ipcMain.handle("desktop:window:is-maximized", () => {
      return mainWindow ? mainWindow.isMaximized() : false;
    });
    ipcMain.handle("desktop:window:close", () => {
      mainWindow?.close();
    });
    ipcMain.handle(
      "desktop:window:set-always-on-top",
      (_event, flag: boolean) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(Boolean(flag));
          return mainWindow.isAlwaysOnTop();
        }
        return false;
      }
    );
    ipcMain.handle("desktop:window:is-always-on-top", () => {
      return mainWindow ? mainWindow.isAlwaysOnTop() : false;
    });

    // Native Dialogs IPC
    ipcMain.handle(
      "desktop:dialog:open",
      async (_event, options: Electron.OpenDialogOptions) => {
        if (!mainWindow) return { canceled: true, filePaths: [] };
        return await dialog.showOpenDialog(mainWindow, options || {});
      }
    );
    ipcMain.handle(
      "desktop:dialog:save",
      async (_event, options: Electron.SaveDialogOptions) => {
        if (!mainWindow) return { canceled: true };
        return await dialog.showSaveDialog(mainWindow, options || {});
      }
    );
    ipcMain.handle(
      "desktop:dialog:message",
      async (_event, options: Electron.MessageBoxOptions) => {
        if (!mainWindow)
          return { response: 0, checkboxChecked: false };
        return await dialog.showMessageBox(mainWindow, options);
      }
    );

    // Native Notifications IPC
    ipcMain.handle(
      "desktop:notification:show",
      (
        _event,
        title: string,
        body: string,
        options: Electron.NotificationConstructorOptions
      ) => {
        if (Notification.isSupported()) {
          new Notification({ title, body: body || "", ...options }).show();
          return true;
        }
        return false;
      }
    );

    // Clipboard IPC
    ipcMain.handle("desktop:clipboard:read-text", () => {
      return clipboard.readText();
    });
    ipcMain.handle("desktop:clipboard:write-text", (_event, text: string) => {
      clipboard.writeText(String(text || ""));
    });

    // Shell IPC
    ipcMain.handle(
      "desktop:shell:show-item",
      (_event, fullPath: string) => {
        shell.showItemInFolder(fullPath);
      }
    );
    ipcMain.handle(
      "desktop:shell:open-path",
      async (_event, fullPath: string) => {
        return await shell.openPath(fullPath);
      }
    );
    ipcMain.handle("desktop:shell:beep", () => {
      shell.beep();
    });

    // Theme IPC
    ipcMain.handle("desktop:theme:get", () => {
      return nativeTheme.themeSource;
    });
    ipcMain.handle(
      "desktop:theme:set",
      (
        _event,
        theme: "dark" | "light" | "system"
      ) => {
        nativeTheme.themeSource = theme;
      }
    );
    nativeTheme.on("updated", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "desktop:theme:change",
          nativeTheme.shouldUseDarkColors ? "dark" : "light"
        );
      }
    });

    // Real-Time Database IPC
    ipcMain.handle("desktop:db:find", (_event, col: string, filter: any, options: any) =>
      db.collection(col).find(filter, options)
    );
    ipcMain.handle(
      "desktop:db:findPaginated",
      (_event, col: string, filter: any, options: any) =>
        db.collection(col).findPaginated(filter, options)
    );
    ipcMain.handle("desktop:db:findOne", (_event, col: string, idOrFilter: any) =>
      db.collection(col).findOne(idOrFilter)
    );
    ipcMain.handle("desktop:db:insert", (_event, col: string, doc: any) =>
      db.collection(col).insert(doc)
    );
    ipcMain.handle("desktop:db:insertMany", (_event, col: string, docs: any[]) =>
      db.collection(col).insertMany(docs)
    );
    ipcMain.handle("desktop:db:update", (_event, col: string, id: any, updates: any) =>
      db.collection(col).update(id, updates)
    );
    ipcMain.handle(
      "desktop:db:updateMany",
      (_event, col: string, filter: any, updates: any) =>
        db.collection(col).updateMany(filter, updates)
    );
    ipcMain.handle("desktop:db:delete", (_event, col: string, id: any) =>
      db.collection(col).delete(id)
    );
    ipcMain.handle("desktop:db:deleteMany", (_event, col: string, filter: any) =>
      db.collection(col).deleteMany(filter)
    );
    ipcMain.handle("desktop:db:clear", (_event, col: string) =>
      db.collection(col).clear()
    );
    ipcMain.handle("desktop:db:count", (_event, col: string, filter: any) =>
      db.collection(col).count(filter)
    );
    ipcMain.handle("desktop:db:get", (_event, key: string, defaultValue: any) =>
      db.get(key, defaultValue)
    );
    ipcMain.handle("desktop:db:set", (_event, key: string, value: any) =>
      db.set(key, value)
    );
    ipcMain.handle("desktop:db:deleteKey", (_event, key: string) =>
      db.deleteKey(key)
    );
    ipcMain.handle("desktop:db:stats", () => db.getStats());
    ipcMain.handle("desktop:db:get-path", () => db.filePath);
    ipcMain.handle("desktop:db:exportJson", (_event, col: string) =>
      db.collection(col).exportJson()
    );
    ipcMain.handle("desktop:db:exportCsv", (_event, col: string) =>
      db.collection(col).exportCsv()
    );
    ipcMain.handle("desktop:db:importJson", (_event, col: string, data: any) =>
      db.collection(col).importJson(data)
    );
    ipcMain.handle("desktop:db:backup", (_event, customPath?: string) =>
      db.backup(customPath)
    );
    ipcMain.handle("desktop:db:restore", (_event, backupPath: string) =>
      db.restore(backupPath)
    );
    ipcMain.handle("desktop:db:reset", () => db.reset());

    // Broadcast real-time database changes to renderer window
    db.subscribe((change) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:db:change", change);
      }
    });

    await createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow().catch(handleStartupFailure);
      }
    });
  })
  .catch(handleStartupFailure);

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopServer();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});

app.on("will-quit", () => {
  stopServer();
});
