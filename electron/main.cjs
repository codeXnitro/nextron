const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

// Handle Squirrel installer events on Windows directly without external dependencies
function handleSquirrelEvent() {
  if (process.platform !== "win32") return false;
  const cmd = process.argv[1];
  const target = path.basename(process.execPath);

  const runUpdate = (args) => {
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
  return;
}

const isDevelopment = !app.isPackaged;
let mainWindow = null;
let nextServer = null;
let desktopServerPort = null;
let serverStderrBuffer = [];

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function stopServer() {
  if (nextServer && nextServer.pid) {
    const pid = nextServer.pid;
    nextServer = null;
    if (process.platform === "win32") {
      try {
        spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
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

async function startPackagedNextServer() {
  const serverDirectory = path.join(process.resourcesPath, "standalone");
  const serverFile = path.join(serverDirectory, "server.js");

  if (!require("node:fs").existsSync(serverFile)) {
    throw new Error(`Packaged Next.js standalone server is missing at:\n${serverFile}`);
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
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextServer.stdout?.on("data", (chunk) => {
    if (isDevelopment) process.stdout.write(chunk);
  });

  nextServer.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    if (isDevelopment) process.stderr.write(chunk);
    serverStderrBuffer.push(text);
    if (serverStderrBuffer.length > 30) serverStderrBuffer.shift();
  });

  nextServer.once("exit", (code, signal) => {
    if (nextServer) {
      console.warn(`Next.js server exited unexpectedly with code ${code}, signal ${signal}`);
      nextServer = null;
    }
  });
}

function waitForPackagedServer(retries = 100) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const startupError = (error) => {
      if (resolved) return;
      resolved = true;
      const recentErrors = serverStderrBuffer.join("\n").trim();
      const detailedMessage = recentErrors
        ? `${error.message}\n\nServer Output:\n${recentErrors}`
        : error.message;
      reject(new Error(detailedMessage));
    };

    const serverExit = (code, signal) => {
      startupError(
        new Error(
          `The packaged Next.js server stopped during startup (code: ${code ?? "unknown"}, signal: ${signal ?? "none"}).`
        )
      );
    };

    nextServer?.once("error", startupError);
    nextServer?.once("exit", serverExit);

    const attempt = () => {
      if (resolved) return;
      const socket = net.connect(desktopServerPort, "127.0.0.1");

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
          startupError(new Error("The packaged Next.js server timed out during initialization."));
        } else {
          setTimeout(attempt, 150);
        }
      });
    };

    attempt();
  });
}

async function createWindow() {
  if (!isDevelopment && !nextServer) {
    await startPackagedNextServer();
    await waitForPackagedServer();
  }

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b1020",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  if (isDevelopment) {
    // Clear stale HTTP cache so changes to source files always reflect immediately
    // and the Turbopack HMR WebSocket can negotiate fresh headers.
    await mainWindow.webContents.session.clearCache();
    await mainWindow.loadURL("http://127.0.0.1:3000");
    // Open DevTools automatically in development to surface any errors.
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${desktopServerPort}`);
  }
}

async function handleStartupFailure(error) {
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

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;

  ipcMain.handle("desktop:get-version", () => app.getVersion());

  ipcMain.handle("desktop:open-external", async (_event, url) => {
    const target = new URL(url);
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new Error("Only HTTP(S) links may be opened from the app.");
    }
    await shell.openExternal(target.toString());
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch(handleStartupFailure);
    }
  });
}).catch(handleStartupFailure);

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
