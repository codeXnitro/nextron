import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import {
  generateId,
  makeDualResult,
  matchesFilter,
  paginateItems,
  sortItems,
} from "./core";
import type {
  DatabaseDoc,
  DatabaseInterface,
  DbChangeEvent,
  DbCollection,
  DbStats,
  DualResult,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
} from "./types";

export interface DatabaseOptions {
  dataDir?: string;
  filename?: string;
  debounceMs?: number;
}

export class ServerDatabaseEngine extends EventEmitter implements DatabaseInterface {
  public dataDir: string;
  public filePath: string;
  public debounceMs: number;
  private cache: Record<string, any> = {
    _meta: {
      version: 2,
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
    this.dataDir =
      options.dataDir || process.env.DATABASE_DIR || path.join(process.cwd(), "data");
    this.filePath = path.join(/*turbopackIgnore: true*/ this.dataDir, options.filename || "db.json");
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
      console.error("[ServerDatabaseEngine] Initialization error:", err);
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
            version: 2,
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
      console.error("[ServerDatabaseEngine] Read error from disk:", err);
    }
  }

  private saveToDiskSyncWithRetry(maxRetries = 5) {
    this.internalSave = true;
    this.cache._meta.updatedAt = new Date().toISOString();
    this.cache._meta.rev = (this.cache._meta.rev || 0) + 1;
    const jsonStr = JSON.stringify(this.cache, null, 2);
    const tmpPath = `${this.filePath}.tmp.${Date.now()}.${crypto
      .randomBytes(4)
      .toString("hex")}`;

    let lastError: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
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
        lastError = null;
        break;
      } catch (err: any) {
        lastError = err;
        if (err.code === "EBUSY" || err.code === "EPERM") {
          const waitEnd = Date.now() + 25 * (attempt + 1);
          while (Date.now() < waitEnd) {}
        } else {
          break;
        }
      }
    }

    if (lastError) {
      console.error("[ServerDatabaseEngine] Write error after retries:", lastError);
    }

    setTimeout(() => {
      this.internalSave = false;
    }, 100);
  }

  public saveToDiskSync() {
    this.saveToDiskSyncWithRetry();
  }

  public async saveToDisk(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.saveToDiskSyncWithRetry();
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
              console.error("[ServerDatabaseEngine] Watcher error:", watchErr);
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
      find(filter?: QueryFilter<T>, options?: QueryOptions<T>): T[] {
        const items = self.getRawCollection(name) as T[];
        let filtered = items.filter((item) => matchesFilter(item, filter));

        const sortField = options?.sort ?? (filter?._sort as string | undefined);
        const order =
          (options?.order ?? (filter?._order as "asc" | "desc" | undefined)) || "asc";
        if (sortField) {
          filtered = sortItems(filtered, String(sortField), order);
        }

        const skip =
          options?.skip ??
          (options?.page && options?.limit ? (options.page - 1) * options.limit : 0);
        if (skip > 0) {
          filtered = filtered.slice(skip);
        }

        const limit = options?.limit ?? (filter?._limit as number | undefined);
        if (limit && limit > 0) {
          filtered = filtered.slice(0, limit);
        }

        return [...filtered];
      },

      findPaginated(
        filter?: QueryFilter<T>,
        options?: QueryOptions<T>
      ): PaginatedResult<T> {
        const items = self.getRawCollection(name) as T[];
        let filtered = items.filter((item) => matchesFilter(item, filter));

        const sortField = options?.sort ?? (filter?._sort as string | undefined);
        const order =
          (options?.order ?? (filter?._order as "asc" | "desc" | undefined)) || "asc";
        if (sortField) {
          filtered = sortItems(filtered, String(sortField), order);
        }

        const page = options?.page ?? (filter?._page as number | undefined) ?? 1;
        const limit = options?.limit ?? (filter?._limit as number | undefined) ?? 10;

        return paginateItems(filtered, page, limit);
      },

      findOne(idOrFilter: string | QueryFilter<T>): T | null {
        const items = self.getRawCollection(name) as T[];
        if (typeof idOrFilter === "string") {
          return items.find((item) => item.id === idOrFilter) || null;
        }
        if (typeof idOrFilter === "object" && idOrFilter !== null) {
          return items.find((item) => matchesFilter(item, idOrFilter)) || null;
        }
        return null;
      },

      insert(doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): DualResult<T> {
        const items = self.getRawCollection(name);
        const id = doc.id || generateId(name.slice(0, 3));
        const newDoc = {
          ...doc,
          id,
          createdAt: (doc as any).createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as T;

        items.unshift(newDoc);
        const savePromise = self.saveToDisk();

        self.emit("change", {
          action: "insert",
          collection: name,
          id,
          data: newDoc,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent<T>);

        return makeDualResult(newDoc, savePromise);
      },

      insertMany(
        docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>
      ): DualResult<T[]> {
        const items = self.getRawCollection(name);
        const inserted: T[] = [];

        for (const doc of docs) {
          const id = doc.id || generateId(name.slice(0, 3));
          const newDoc = {
            ...doc,
            id,
            createdAt: (doc as any).createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as unknown as T;
          items.unshift(newDoc);
          inserted.push(newDoc);
        }

        const savePromise = self.saveToDisk();

        self.emit("change", {
          action: "insertMany",
          collection: name,
          count: inserted.length,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent<T[]>);

        return makeDualResult(inserted, savePromise);
      },

      update(
        idOrFilter: string | QueryFilter<T>,
        updates: Partial<T>
      ): DualResult<T | null> {
        const items = self.getRawCollection(name);
        let lastUpdated: T | null = null;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let match = false;
          if (typeof idOrFilter === "string") {
            match = item.id === idOrFilter;
          } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
            match = matchesFilter(item, idOrFilter);
          }

          if (match) {
            items[i] = {
              ...item,
              ...updates,
              id: item.id,
              updatedAt: new Date().toISOString(),
            };
            lastUpdated = items[i] as T;
            if (typeof idOrFilter === "string") break;
          }
        }

        let savePromise = Promise.resolve();
        if (lastUpdated) {
          savePromise = self.saveToDisk();
          self.emit("change", {
            action: "update",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            data: lastUpdated,
            updatedCount: 1,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          } as DbChangeEvent<T>);
        }

        return makeDualResult(lastUpdated, savePromise);
      },

      updateMany(filter: QueryFilter<T>, updates: Partial<T>): DualResult<number> {
        const items = self.getRawCollection(name);
        let count = 0;

        for (let i = 0; i < items.length; i++) {
          if (matchesFilter(items[i], filter)) {
            items[i] = {
              ...items[i],
              ...updates,
              id: items[i].id,
              updatedAt: new Date().toISOString(),
            };
            count++;
          }
        }

        let savePromise = Promise.resolve();
        if (count > 0) {
          savePromise = self.saveToDisk();
          self.emit("change", {
            action: "updateMany",
            collection: name,
            updatedCount: count,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          } as DbChangeEvent);
        }

        return makeDualResult(count, savePromise);
      },

      delete(idOrFilter: string | QueryFilter<T>): DualResult<boolean> {
        const items = self.getRawCollection(name);
        const initialLength = items.length;

        let filtered: any[];
        if (typeof idOrFilter === "string") {
          filtered = items.filter((item) => item.id !== idOrFilter);
        } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
          filtered = items.filter((item) => !matchesFilter(item, idOrFilter));
        } else {
          return makeDualResult(false);
        }

        const deletedCount = initialLength - filtered.length;
        if (deletedCount > 0) {
          self.cache[name] = filtered;
          const savePromise = self.saveToDisk();
          self.emit("change", {
            action: "delete",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            deletedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          } as DbChangeEvent);
          return makeDualResult(true, savePromise);
        }

        return makeDualResult(false);
      },

      deleteMany(filter: QueryFilter<T>): DualResult<number> {
        const items = self.getRawCollection(name);
        const initialLength = items.length;
        const filtered = items.filter((item) => !matchesFilter(item, filter));
        const deletedCount = initialLength - filtered.length;

        let savePromise = Promise.resolve();
        if (deletedCount > 0) {
          self.cache[name] = filtered;
          savePromise = self.saveToDisk();
          self.emit("change", {
            action: "deleteMany",
            collection: name,
            deletedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          } as DbChangeEvent);
        }

        return makeDualResult(deletedCount, savePromise);
      },

      count(filter?: QueryFilter<T>): number {
        return this.find(filter).length;
      },

      sum(field: keyof T | string, filter?: QueryFilter<T>): number {
        const items = this.find(filter);
        return items.reduce((acc, item) => {
          const val = Number((item as any)[field]) || 0;
          return acc + val;
        }, 0);
      },

      avg(field: keyof T | string, filter?: QueryFilter<T>): number {
        const items = this.find(filter);
        if (items.length === 0) return 0;
        return this.sum(field, filter) / items.length;
      },

      min(field: keyof T | string, filter?: QueryFilter<T>): number | null {
        const items = this.find(filter);
        if (items.length === 0) return null;
        let lowest: number | null = null;
        for (const item of items) {
          const val = Number((item as any)[field]);
          if (!isNaN(val)) {
            if (lowest === null || val < lowest) lowest = val;
          }
        }
        return lowest;
      },

      max(field: keyof T | string, filter?: QueryFilter<T>): number | null {
        const items = this.find(filter);
        if (items.length === 0) return null;
        let highest: number | null = null;
        for (const item of items) {
          const val = Number((item as any)[field]);
          if (!isNaN(val)) {
            if (highest === null || val > highest) highest = val;
          }
        }
        return highest;
      },

      clear(): DualResult<boolean> {
        self.cache[name] = [];
        const savePromise = self.saveToDisk();
        self.emit("change", {
          action: "clear",
          collection: name,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent);
        return makeDualResult(true, savePromise);
      },

      exportJson(): string {
        const items = self.getRawCollection(name);
        return JSON.stringify(items, null, 2);
      },

      exportCsv(): string {
        const items = self.getRawCollection(name);
        if (items.length === 0) return "";
        const allKeys = Array.from(new Set(items.flatMap((item) => Object.keys(item))));
        const header = allKeys.map((k) => `"${k}"`).join(",");
        const rows = items.map((item) => {
          return allKeys
            .map((k) => {
              const val = item[k];
              if (val === undefined || val === null) return '""';
              const str = typeof val === "object" ? JSON.stringify(val) : String(val);
              return `"${str.replace(/"/g, '""')}"`;
            })
            .join(",");
        });
        return [header, ...rows].join("\n");
      },

      importJson(
        jsonStringOrArray: string | T[]
      ): DualResult<{ imported: number }> {
        const items = self.getRawCollection(name);
        const parsed: any[] =
          typeof jsonStringOrArray === "string"
            ? JSON.parse(jsonStringOrArray)
            : jsonStringOrArray;
        if (!Array.isArray(parsed))
          throw new Error("Imported data must be an array of documents.");

        let count = 0;
        for (const raw of parsed) {
          const id = raw.id || generateId(name.slice(0, 3));
          const doc = {
            ...raw,
            id,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          items.push(doc);
          count++;
        }

        const savePromise = self.saveToDisk();
        self.emit("change", {
          action: "insertMany",
          collection: name,
          count,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        } as DbChangeEvent);

        return makeDualResult({ imported: count }, savePromise);
      },
    };
  }

  public get<T = any>(key: string, defaultValue?: T): T {
    return this.cache[key] !== undefined ? this.cache[key] : (defaultValue as T);
  }

  public set<T = any>(key: string, value: T): DualResult<T> {
    this.cache[key] = value;
    const savePromise = selfSave(this);
    this.emit("change", {
      action: "set",
      key,
      data: value,
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    } as DbChangeEvent);
    return makeDualResult(value, savePromise);
  }

  public deleteKey(key: string): DualResult<boolean> {
    if (this.cache[key] !== undefined) {
      delete this.cache[key];
      const savePromise = selfSave(this);
      this.emit("change", {
        action: "deleteKey",
        key,
        rev: this.cache._meta.rev,
        timestamp: new Date().toISOString(),
      } as DbChangeEvent);
      return makeDualResult(true, savePromise);
    }
    return makeDualResult(false);
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

  public async backup(customPath?: string): Promise<string> {
    const backupDir = path.join(this.dataDir, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const targetPath =
      customPath ||
      path.join(
        backupDir,
        `db-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      );
    const content = JSON.stringify(this.cache, null, 2);
    fs.writeFileSync(targetPath, content, "utf8");
    return targetPath;
  }

  public async restore(backupPath: string): Promise<boolean> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist at: ${backupPath}`);
    }
    const content = fs.readFileSync(backupPath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed._meta) {
      parsed._meta = {
        version: 2,
        rev: (this.cache._meta?.rev || 0) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      parsed._meta.rev = (this.cache._meta?.rev || 0) + 1;
      parsed._meta.updatedAt = new Date().toISOString();
    }
    this.cache = parsed;
    await this.saveToDisk();

    this.emit("change", {
      action: "restore",
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    } as DbChangeEvent);

    return true;
  }

  public reset(): DualResult<boolean> {
    this.cache = {
      _meta: {
        version: 2,
        rev: (this.cache._meta?.rev || 0) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    const savePromise = this.saveToDisk();

    this.emit("change", {
      action: "reset",
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    } as DbChangeEvent);

    return makeDualResult(true, savePromise);
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

function selfSave(engine: ServerDatabaseEngine): Promise<void> {
  return engine.saveToDisk();
}

let globalServerDb: ServerDatabaseEngine | null = null;

export function getServerDatabase(options?: DatabaseOptions): ServerDatabaseEngine {
  if (!globalServerDb) {
    globalServerDb = new ServerDatabaseEngine(options);
  }
  return globalServerDb;
}
