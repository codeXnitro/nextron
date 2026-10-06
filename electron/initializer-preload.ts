import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("initializer", {
  pickFolder: () => ipcRenderer.invoke("initializer:pick-folder"),
  startInit: (config: any) => ipcRenderer.invoke("initializer:start", config),
  openFolder: (dirPath: string) => ipcRenderer.invoke("initializer:open-folder", dirPath),
  openVsCode: (dirPath: string) => ipcRenderer.invoke("initializer:open-vscode", dirPath),
  onLog: (callback: (msg: string) => void) => {
    const listener = (_event: any, msg: string) => callback(msg);
    ipcRenderer.on("initializer:log", listener);
    return () => ipcRenderer.removeListener("initializer:log", listener);
  },
  onProgress: (callback: (pct: number, step: string) => void) => {
    const listener = (_event: any, pct: number, step: string) => callback(pct, step);
    ipcRenderer.on("initializer:progress", listener);
    return () => ipcRenderer.removeListener("initializer:progress", listener);
  },
});
