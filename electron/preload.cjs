const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
  db: {
    find: (collection, filter) => ipcRenderer.invoke("desktop:db:find", collection, filter),
    findOne: (collection, idOrFilter) => ipcRenderer.invoke("desktop:db:findOne", collection, idOrFilter),
    insert: (collection, doc) => ipcRenderer.invoke("desktop:db:insert", collection, doc),
    update: (collection, id, updates) => ipcRenderer.invoke("desktop:db:update", collection, id, updates),
    delete: (collection, id) => ipcRenderer.invoke("desktop:db:delete", collection, id),
    count: (collection, filter) => ipcRenderer.invoke("desktop:db:count", collection, filter),
    get: (key, defaultValue) => ipcRenderer.invoke("desktop:db:get", key, defaultValue),
    set: (key, value) => ipcRenderer.invoke("desktop:db:set", key, value),
    deleteKey: (key) => ipcRenderer.invoke("desktop:db:deleteKey", key),
    getStats: () => ipcRenderer.invoke("desktop:db:stats"),
    getFilePath: () => ipcRenderer.invoke("desktop:db:get-path"),
    subscribe: (callback) => {
      const listener = (_event, change) => callback(change);
      ipcRenderer.on("desktop:db:change", listener);
      return () => {
        ipcRenderer.removeListener("desktop:db:change", listener);
      };
    },
  },
});
