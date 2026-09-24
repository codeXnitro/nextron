import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import type { DatabaseDoc, DbChangeEvent, DbCollection, DbStats } from "./types";

export interface DatabaseOptions {
  dataDir?: string;
  filename?: string;
  debounceMs?: number;
}

export class JsonDatabaseEngine extends EventEmitter {
  public dataDir: string;
  public filePath: string;
  public debounceMs: number;
  private cache: Record<string, any> = {
    _meta: {
      version: 1,
      rev: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  private isLoaded = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private fileWatcher: fs.FSWatcher | null = null;
  private lastDiskMtime = 0;
  private internalSave = false;

  constructor(options: DatabaseOptions = {}) {
    super();
    this.dataDir = options.dataDir || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
    this.filePath = path.join(this.dataDir, options.filename || "db.json");
    this.debounceMs = options.debounceMs || 50;

    this.init();
  }

  private init() {
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

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const content = fs.readFileSync(this.filePath, "utf8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (!parsed._meta) {
          parsed._meta = {
            version: 1,
            rev: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
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

  private saveToDiskSync() {
    this.internalSave = true;
    this.cache._meta.updatedAt = new Date().toISOString();
    this.cache._meta.rev = (this.cache._meta.rev || 0) + 1;
    const jsonStr = JSON.stringify(this.cache, null, 2);
    const tmpPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

    try {
      fs.writeFileSync(tmpPath, jsonStr, "utf8");
      try {
        fs.renameSync(tmpPath, this.filePath);
      } catch {
        fs.copyFileSync(tmpPath, this.filePath);
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      }
      const stat = fs.statSync(this.filePath);
      this.lastDiskMtime = stat.mtimeMs;
    } catch (err) {
      console.error("[JsonDatabase] Write error to disk:", err);
    } finally {
      setTimeout(() => {
        this.internalSave = false;
      }, 100);
    }
  }

  private async saveToDisk(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      this.saveToDiskSync();
    });
    return this.writeQueue;
  }

  private startWatching() {
    if (this.fileWatcher) return;
    try {
      let timer: NodeJS.Timeout | null = null;
      this.fileWatcher = fs.watch(this.filePath, (eventType) => {
        if (this.internalSave) return;
        if (eventType === "change" || eventType === "rename") {
          if (timer) clearTimeout(timer);
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
                } as DbChangeEvent);
              }
            } catch (watchErr) {
              console.error("[JsonDatabase] Watcher error:", watchErr);
            }
          }, this.debounceMs);
        }
      });
      if (this.fileWatcher && typeof this.fileWatcher.unref === "function") {
        this.fileWatcher.unref();
      }
    } catch {}
  }

  private getRawCollection(name: string): any[] {
    if (!this.cache[name] || !Array.isArray(this.cache[name])) {
      this.cache[name] = [];
    }
    return this.cache[name];
  }

  public collection<T extends { id?: string } = DatabaseDoc>(name: string): DbCollection<T> {
    const self = this;
    return {
      find(filter?: Partial<T> | Record<string, any>): T[] {
        const items = self.getRawCollection(name) as T[];
        if (!filter || Object.keys(filter).length === 0) {
          return [...items];
        }
        return items.filter((item) => {
          return Object.entries(filter).every(([key, val]) => {
            if (key.startsWith("_")) return true;
            return (item as any)[key] === val;
          });
        });
      },

      findOne(idOrFilter: string | Partial<T>): T | null {
        const items = self.getRawCollection(name) as T[];
        if (typeof idOrFilter === "string") {
          return items.find((item) => item.id === idOrFilter) || null;
        }
        if (typeof idOrFilter === "object" && idOrFilter !== null) {
          return (
            items.find((item) => {
              return Object.entries(idOrFilter).every(([key, val]) => (item as any)[key] === val);
            }) || null
          );
        }
        return null;
      },

      async insert(doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<T> {
        const items = self.getRawCollection(name);
        const id = doc.id || `${name.slice(0, 3)}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const newDoc = {
          ...doc,
          id,
          createdAt: (doc as any).createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as T;

        items.push(newDoc);
        await self.saveToDisk();

        self.emit("change", {
          action: "insert",
          collection: name,
          id,
          data: newDoc,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent<T>);

        return newDoc;
      },

      async update(idOrFilter: string | Partial<T>, updates: Partial<T>): Promise<T | null> {
        const items = self.getRawCollection(name);
        let updatedCount = 0;
        let lastUpdated: T | null = null;

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
              id: item.id,
              updatedAt: new Date().toISOString(),
            };
            lastUpdated = items[i] as T;
            updatedCount++;
            if (typeof idOrFilter === "string") break;
          }
        }

        if (updatedCount > 0 && lastUpdated) {
          await self.saveToDisk();
          self.emit("change", {
            action: "update",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            data: lastUpdated,
            updatedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          } as DbChangeEvent<T>);
        }

        return lastUpdated;
      },

      async delete(idOrFilter: string | Partial<T>): Promise<boolean> {
        const items = self.getRawCollection(name);
        const initialLength = items.length;

        let filtered: any[];
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
          } as DbChangeEvent);
          return true;
        }

        return false;
      },

      count(filter?: Partial<T>): number {
        return this.find(filter).length;
      },

      async clear(): Promise<boolean> {
        self.cache[name] = [];
        await self.saveToDisk();
        self.emit("change", {
          action: "clear",
          collection: name,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent);
        return true;
      },
    };
  }

  public get<T = any>(key: string, defaultValue: T | null = null): T | null {
    return this.cache[key] !== undefined ? this.cache[key] : defaultValue;
  }

  public async set<T = any>(key: string, value: T): Promise<T> {
    this.cache[key] = value;
    await this.saveToDisk();
    this.emit("change", {
      action: "set",
      key,
      data: value,
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    } as DbChangeEvent);
    return value;
  }

  public async deleteKey(key: string): Promise<boolean> {
    if (this.cache[key] !== undefined) {
      delete this.cache[key];
      await this.saveToDisk();
      this.emit("change", {
        action: "deleteKey",
        key,
        rev: this.cache._meta.rev,
        timestamp: new Date().toISOString(),
      } as DbChangeEvent);
      return true;
    }
    return false;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public getStats(): DbStats {
    let size = 0;
    try {
      if (fs.existsSync(this.filePath)) {
        size = fs.statSync(this.filePath).size;
      }
    } catch {}

    const collections: Record<string, number> = {};
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

  public subscribe(callback: (event: DbChangeEvent) => void): () => void {
    this.on("change", callback);
    return () => {
      this.off("change", callback);
    };
  }

  public close() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.removeAllListeners();
  }
}

// Singleton storage
let globalDbInstance: JsonDatabaseEngine | null = null;

export function getDatabase(options?: DatabaseOptions): JsonDatabaseEngine {
  if (!globalDbInstance) {
    globalDbInstance = new JsonDatabaseEngine(options);
  }
  return globalDbInstance;
}
