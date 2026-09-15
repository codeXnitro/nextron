const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

const isDevelopment = !app.isPackaged;
let mainWindow = null;
let nextServer = null;
const desktopServerPort = 3487;

function startPackagedNextServer() {
  const serverDirectory = path.join(process.resourcesPath, "standalone");
  const serverFile = path.join(serverDirectory, "server.js");

  nextServer = spawn(process.execPath, [serverFile], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(desktopServerPort),
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });
}

function waitForPackagedServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(desktopServerPort, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (retries-- <= 0) {
          reject(new Error("The packaged Next.js server did not start."));
        } else {
          setTimeout(attempt, 150);
        }
      });
    };
    attempt();
  });
}

async function createWindow() {
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
    await mainWindow.loadURL("http://localhost:3000");
  } else {
    startPackagedNextServer();
    await waitForPackagedServer();
    await mainWindow.loadURL(`http://127.0.0.1:${desktopServerPort}`);
  }
}

app.whenReady().then(() => {
  ipcMain.handle("desktop:get-version", () => app.getVersion());
  ipcMain.handle("desktop:open-external", (_event, url) => shell.openExternal(url));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => nextServer?.kill());
