// Zero-dependency, atomic, real-time JSON database engine
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

class JsonDatabaseEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dataDir = options.dataDir || path.join(process.cwd(), "data");
    this.filePath = path.join(this.dataDir, options.filename || "db.json");
    this.debounceMs = options.debounceMs || 50;
    this.cache = { _meta: { version: 1, rev: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    this.isLoaded = false;
    this.writeQueue = Promise.resolve();
    this.fileWatcher = null;
    this.lastDiskMtime = 0;
    this.internalSave = false;

    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        this.loadFromDisk();
      } else {
        this.saveToDiskSync();
      }

      this.startWatching();
    } catch (err) {
      console.error("[JsonDatabase] Initialization error:", err);
    }
  }

  loadFromDisk() {
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (!parsed._meta) {
          parsed._meta = { version: 1, rev: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }
        this.cache = parsed;
        const stat = fs.statSync(this.filePath);
        this.lastDiskMtime = stat.mtimeMs;
        this.isLoaded = true;
      }
    } catch (err) {
      console.error("[JsonDatabase] Read error from disk:", err);
    }
  }

  saveToDiskSync() {
    this.internalSave = true;
    this.cache._meta.updatedAt = new Date().toISOString();
    this.cache._meta.rev = (this.cache._meta.rev || 0) + 1;
    const jsonStr = JSON.stringify(this.cache, null, 2);
    const tmpPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

    try {
      fs.writeFileSync(tmpPath, jsonStr, "utf8");
      try {
        fs.renameSync(tmpPath, this.filePath);
      } catch (renameErr) {
        // Fallback for Windows file locking
        fs.copyFileSync(tmpPath, this.filePath);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
      const stat = fs.statSync(this.filePath);
      this.lastDiskMtime = stat.mtimeMs;
    } catch (err) {
      console.error("[JsonDatabase] Write error to disk:", err);
    } finally {
      setTimeout(() => { this.internalSave = false; }, 100);
    }
  }

  async saveToDisk() {
    this.writeQueue = this.writeQueue.then(() => {
      this.saveToDiskSync();
    });
    return this.writeQueue;
  }

  startWatching() {
    if (this.fileWatcher) return;
    try {
      let timer = null;
      this.fileWatcher = fs.watch(this.filePath, (eventType) => {
        if (this.internalSave) return;
        if (eventType === "change" || eventType === "rename") {
          clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              if (!fs.existsSync(this.filePath)) return;
              const stat = fs.statSync(this.filePath);
              if (stat.mtimeMs <= this.lastDiskMtime) return;

              const oldRev = this.cache._meta?.rev;
              this.loadFromDisk();
              const newRev = this.cache._meta?.rev;

              if (newRev !== oldRev) {
                this.emit("change", {
                  action: "external-sync",
                  collection: null,
                  id: null,
                  rev: newRev,
                  timestamp: new Date().toISOString(),
                });
              }
            } catch (watchErr) {
              console.error("[JsonDatabase] Watcher error:", watchErr);
            }
          }, this.debounceMs);
        }
      });
    } catch (err) {
      // In some environments watch can fail gracefully
    }
  }

  getCollection(name) {
    if (!this.cache[name] || !Array.isArray(this.cache[name])) {
      this.cache[name] = [];
    }
    return this.cache[name];
  }

  collection(name) {
    const self = this;
    return {
      find(filter) {
        const items = self.getCollection(name);
        if (!filter || Object.keys(filter).length === 0) {
          return [...items];
        }
        return items.filter((item) => {
          return Object.entries(filter).every(([key, val]) => {
            if (key.startsWith("_")) return true; // ignore query flags like _sort
            return item[key] === val;
          });
        });
      },

      findOne(idOrFilter) {
        const items = self.getCollection(name);
        if (typeof idOrFilter === "string") {
          return items.find((item) => item.id === idOrFilter) || null;
        }
        if (typeof idOrFilter === "object" && idOrFilter !== null) {
          return items.find((item) => {
            return Object.entries(idOrFilter).every(([key, val]) => item[key] === val);
          }) || null;
        }
        return null;
      },

      async insert(doc) {
        const items = self.getCollection(name);
        const id = doc.id || `${name.slice(0, 3)}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const newDoc = {
          ...doc,
          id,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        items.push(newDoc);
        await self.saveToDisk();

        self.emit("change", {
          action: "insert",
          collection: name,
          id,
          data: newDoc,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        });

        return newDoc;
      },

      async update(idOrFilter, updates) {
        const items = self.getCollection(name);
        let updatedCount = 0;
        let lastUpdated = null;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let match = false;
          if (typeof idOrFilter === "string") {
            match = item.id === idOrFilter;
          } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
            match = Object.entries(idOrFilter).every(([k, v]) => item[k] === v);
          }

          if (match) {
            items[i] = {
              ...item,
              ...updates,
              id: item.id, // Preserve ID
              updatedAt: new Date().toISOString(),
            };
            lastUpdated = items[i];
            updatedCount++;
            if (typeof idOrFilter === "string") break;
          }
        }

        if (updatedCount > 0) {
          await self.saveToDisk();
          self.emit("change", {
            action: "update",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            data: lastUpdated,
            updatedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          });
        }

        return lastUpdated;
      },

      async delete(idOrFilter) {
        const items = self.getCollection(name);
        const initialLength = items.length;

        let filtered;
        if (typeof idOrFilter === "string") {
          filtered = items.filter((item) => item.id !== idOrFilter);
        } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
          filtered = items.filter((item) => {
            return !Object.entries(idOrFilter).every(([k, v]) => item[k] === v);
          });
        } else {
          return false;
        }

        const deletedCount = initialLength - filtered.length;
        if (deletedCount > 0) {
          self.cache[name] = filtered;
          await self.saveToDisk();
          self.emit("change", {
            action: "delete",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            deletedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          });
          return true;
        }

        return false;
      },

      count(filter) {
        return this.find(filter).length;
      },

      async clear() {
        self.cache[name] = [];
        await self.saveToDisk();
        self.emit("change", {
          action: "clear",
          collection: name,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        });
        return true;
      },
    };
  }

  get(key, defaultValue = null) {
    return this.cache[key] !== undefined ? this.cache[key] : defaultValue;
  }

  async set(key, value) {
    this.cache[key] = value;
    await this.saveToDisk();
    this.emit("change", {
      action: "set",
      key,
      data: value,
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    });
    return value;
  }

  async deleteKey(key) {
    if (this.cache[key] !== undefined) {
      delete this.cache[key];
      await this.saveToDisk();
      this.emit("change", {
        action: "deleteKey",
        key,
        rev: this.cache._meta.rev,
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    return false;
  }

  getStats() {
    let size = 0;
    try {
      if (fs.existsSync(this.filePath)) {
        size = fs.statSync(this.filePath).size;
      }
    } catch {}

    const collections = {};
    for (const [key, val] of Object.entries(this.cache)) {
      if (key !== "_meta" && Array.isArray(val)) {
        collections[key] = val.length;
      }
    }

    return {
      filePath: this.filePath,
      dataDir: this.dataDir,
      sizeBytes: size,
      rev: this.cache._meta?.rev || 0,
      updatedAt: this.cache._meta?.updatedAt || null,
      collections,
    };
  }

  subscribe(callback) {
    this.on("change", callback);
    return () => {
      this.off("change", callback);
    };
  }

  close() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.removeAllListeners();
  }
}

// Singleton storage
let defaultInstance = null;

function initDatabase(options) {
  if (!defaultInstance) {
    defaultInstance = new JsonDatabaseEngine(options);
  }
  return defaultInstance;
}

function getDatabase() {
  if (!defaultInstance) {
    defaultInstance = new JsonDatabaseEngine({
      dataDir: process.env.DATABASE_DIR || path.join(process.cwd(), "data"),
    });
  }
  return defaultInstance;
}

module.exports = {
  JsonDatabaseEngine,
  initDatabase,
  getDatabase,
};
