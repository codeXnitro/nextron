const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
});
