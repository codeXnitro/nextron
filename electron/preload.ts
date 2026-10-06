import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
  getPlatform: () => ipcRenderer.invoke("desktop:get-platform"),
  openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),

  window: {
    minimize: () => ipcRenderer.invoke("desktop:window:minimize"),
    maximize: () => ipcRenderer.invoke("desktop:window:maximize"),
    unmaximize: () => ipcRenderer.invoke("desktop:window:unmaximize"),
    toggleMaximize: () => ipcRenderer.invoke("desktop:window:toggle-maximize"),
    isMaximized: () => ipcRenderer.invoke("desktop:window:is-maximized"),
    close: () => ipcRenderer.invoke("desktop:window:close"),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke("desktop:window:set-always-on-top", flag),
    isAlwaysOnTop: () => ipcRenderer.invoke("desktop:window:is-always-on-top"),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
        callback(isMaximized);
      ipcRenderer.on("desktop:window:maximize-change", listener);
      return () => {
        ipcRenderer.removeListener("desktop:window:maximize-change", listener);
      };
    },
  },

  dialog: {
    showOpenDialog: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke("desktop:dialog:open", options),
    showSaveDialog: (options?: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke("desktop:dialog:save", options),
    showMessageBox: (options: Electron.MessageBoxOptions) =>
      ipcRenderer.invoke("desktop:dialog:message", options),
  },

  notification: {
    show: (title: string, body?: string, options?: { silent?: boolean }) =>
      ipcRenderer.invoke("desktop:notification:show", title, body, options),
  },

  clipboard: {
    readText: () => ipcRenderer.invoke("desktop:clipboard:read-text"),
    writeText: (text: string) => ipcRenderer.invoke("desktop:clipboard:write-text", text),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("desktop:open-external", url),
    showItemInFolder: (fullPath: string) =>
      ipcRenderer.invoke("desktop:shell:show-item", fullPath),
    openPath: (fullPath: string) => ipcRenderer.invoke("desktop:shell:open-path", fullPath),
    beep: () => ipcRenderer.invoke("desktop:shell:beep"),
  },

  theme: {
    getTheme: () => ipcRenderer.invoke("desktop:theme:get"),
    setTheme: (theme: "dark" | "light" | "system") =>
      ipcRenderer.invoke("desktop:theme:set", theme),
    onThemeChange: (callback: (theme: "dark" | "light") => void) => {
      const listener = (_event: Electron.IpcRendererEvent, theme: "dark" | "light") =>
        callback(theme);
      ipcRenderer.on("desktop:theme:change", listener);
      return () => {
        ipcRenderer.removeListener("desktop:theme:change", listener);
      };
    },
  },

  db: {
    find: (collection: string, filter?: Record<string, any>, options?: Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:find", collection, filter, options),
    findPaginated: (
      collection: string,
      filter?: Record<string, any>,
      options?: Record<string, any>
    ) => ipcRenderer.invoke("desktop:db:findPaginated", collection, filter, options),
    findOne: (collection: string, idOrFilter: string | Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:findOne", collection, idOrFilter),
    insert: (collection: string, doc: Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:insert", collection, doc),
    insertMany: (collection: string, docs: Record<string, any>[]) =>
      ipcRenderer.invoke("desktop:db:insertMany", collection, docs),
    update: (collection: string, id: string, updates: Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:update", collection, id, updates),
    updateMany: (
      collection: string,
      filter: Record<string, any>,
      updates: Record<string, any>
    ) => ipcRenderer.invoke("desktop:db:updateMany", collection, filter, updates),
    delete: (collection: string, id: string) =>
      ipcRenderer.invoke("desktop:db:delete", collection, id),
    deleteMany: (collection: string, filter: Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:deleteMany", collection, filter),
    clear: (collection: string) => ipcRenderer.invoke("desktop:db:clear", collection),
    count: (collection: string, filter?: Record<string, any>) =>
      ipcRenderer.invoke("desktop:db:count", collection, filter),
    get: (key: string, defaultValue?: any) =>
      ipcRenderer.invoke("desktop:db:get", key, defaultValue),
    set: (key: string, value: any) => ipcRenderer.invoke("desktop:db:set", key, value),
    deleteKey: (key: string) => ipcRenderer.invoke("desktop:db:deleteKey", key),
    getStats: () => ipcRenderer.invoke("desktop:db:stats"),
    getFilePath: () => ipcRenderer.invoke("desktop:db:get-path"),
    exportJson: (collection: string) => ipcRenderer.invoke("desktop:db:exportJson", collection),
    exportCsv: (collection: string) => ipcRenderer.invoke("desktop:db:exportCsv", collection),
    importJson: (collection: string, data: any) =>
      ipcRenderer.invoke("desktop:db:importJson", collection, data),
    backup: (customPath?: string) => ipcRenderer.invoke("desktop:db:backup", customPath),
    restore: (backupPath: string) => ipcRenderer.invoke("desktop:db:restore", backupPath),
    reset: () => ipcRenderer.invoke("desktop:db:reset"),
    subscribe: (callback: (change: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, change: any) => callback(change);
      ipcRenderer.on("desktop:db:change", listener);
      return () => {
        ipcRenderer.removeListener("desktop:db:change", listener);
      };
    },
  },
});
