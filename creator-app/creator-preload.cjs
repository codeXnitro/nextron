const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("initializer", {
  pickFolder: () => ipcRenderer.invoke("initializer:pick-folder"),
  startInit: (config) => ipcRenderer.invoke("initializer:start", config),
  openFolder: (dirPath) =>
    ipcRenderer.invoke("initializer:open-folder", dirPath),
  openVsCode: (dirPath) =>
    ipcRenderer.invoke("initializer:open-vscode", dirPath),
  onLog: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("initializer:log", listener);
    return () => ipcRenderer.removeListener("initializer:log", listener);
  },
  onProgress: (callback) => {
    const listener = (_event, percent, step) => callback(percent, step);
    ipcRenderer.on("initializer:progress", listener);
    return () => ipcRenderer.removeListener("initializer:progress", listener);
  },
});
