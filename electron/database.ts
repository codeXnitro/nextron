// Zero-dependency, atomic, real-time JSON database engine for Electron Main Process
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";

export interface DatabaseOptions {
  dataDir?: string;
  filename?: string;
  debounceMs?: number;
}

interface DbMeta {
  version: number;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

interface DbCache {
  _meta: DbMeta;
  [key: string]: any;
}

export interface DbChangeEvent {
  action: string;
  collection?: string | null;
  id?: string | null;
  key?: string | null;
  data?: any;
  count?: number;
  deletedCount?: number;
  updatedCount?: number;
  rev: number;
  timestamp: string;
}

function matchesCondition(actual: any, condition: any): boolean {
  if (condition === undefined) return true;

  if (
    typeof condition === "object" &&
    condition !== null &&
    !Array.isArray(condition) &&
    !(condition instanceof Date)
  ) {
    const keys = Object.keys(condition);
    const hasOperators = keys.some((k) => k.startsWith("$"));

    if (hasOperators) {
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case "$eq":
            if (actual !== val) return false;
            break;
          case "$ne":
            if (actual === val) return false;
            break;
          case "$gt":
            if (!(actual > (val as any))) return false;
            break;
          case "$gte":
            if (!(actual >= (val as any))) return false;
            break;
          case "$lt":
            if (!(actual < (val as any))) return false;
            break;
          case "$lte":
            if (!(actual <= (val as any))) return false;
            break;
          case "$in":
            if (!Array.isArray(val) || !val.includes(actual)) return false;
            break;
          case "$nin":
            if (Array.isArray(val) && val.includes(actual)) return false;
            break;
          case "$contains":
            if (
              typeof actual !== "string" ||
              !actual.toLowerCase().includes(String(val).toLowerCase())
            )
              return false;
            break;
          case "$startsWith":
            if (
              typeof actual !== "string" ||
              !actual.toLowerCase().startsWith(String(val).toLowerCase())
            )
              return false;
            break;
          case "$regex": {
            const regex =
              typeof val === "string" ? new RegExp(val, "i") : (val as RegExp);
            if (!regex.test(String(actual ?? ""))) return false;
            break;
          }
          default:
            break;
        }
      }
      return true;
    }
  }

  return actual === condition;
}

function matchesFilter(item: any, filter?: Record<string, any>): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  if (filter._search && typeof filter._search === "string") {
    const term = filter._search.toLowerCase().trim();
    if (term) {
      const matchFound = Object.values(item).some((val) => {
        if (typeof val === "string") return val.toLowerCase().includes(term);
        if (typeof val === "number") return String(val).includes(term);
        return false;
      });
      if (!matchFound) return false;
    }
  }

  for (const [key, expected] of Object.entries(filter)) {
    if (key.startsWith("_")) continue;
    const actual = item[key];
    if (!matchesCondition(actual, expected)) return false;
  }

  return true;
}

function sortItems<T extends Record<string, any>>(
  items: T[],
  sortField: string,
  order: "asc" | "desc" = "asc"
): T[] {
  if (!sortField) return items;
  return [...items].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;
    const comparison = valA < valB ? -1 : 1;
    return order === "desc" ? -comparison : comparison;
  });
}

class JsonDatabaseEngine extends EventEmitter {
  dataDir: string;
  filePath: string;
  private debounceMs: number;
  private cache: DbCache;
  private isLoaded: boolean;
  private writeQueue: Promise<void>;
  private fileWatcher: fs.FSWatcher | null;
  private lastDiskMtime: number;
  private internalSave: boolean;

  constructor(options: DatabaseOptions = {}) {
    super();
    this.dataDir = options.dataDir || path.join(process.cwd(), "data");
    this.filePath = path.join(this.dataDir, options.filename || "db.json");
    this.debounceMs = options.debounceMs || 50;
    this.cache = {
      _meta: {
        version: 2,
        rev: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    this.isLoaded = false;
    this.writeQueue = Promise.resolve();
    this.fileWatcher = null;
    this.lastDiskMtime = 0;
    this.internalSave = false;

    this.init();
  }

  private init(): void {
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

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const content = fs.readFileSync(this.filePath, "utf8");
      if (content.trim()) {
        const parsed: DbCache = JSON.parse(content);
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
      console.error("[JsonDatabase] Read error from disk:", err);
    }
  }

  private saveToDiskSyncWithRetry(maxRetries = 5): void {
    this.internalSave = true;
    this.cache._meta.updatedAt = new Date().toISOString();
    this.cache._meta.rev = (this.cache._meta.rev || 0) + 1;
    const jsonStr = JSON.stringify(this.cache, null, 2);
    const tmpPath = `${this.filePath}.tmp.${Date.now()}.${crypto
      .randomBytes(4)
      .toString("hex")}`;

    let lastError: unknown = null;
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
      console.error("[JsonDatabase] Write error to disk after retries:", lastError);
    }

    setTimeout(() => {
      this.internalSave = false;
    }, 100);
  }

  private saveToDiskSync(): void {
    this.saveToDiskSyncWithRetry();
  }

  private async saveToDisk(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      this.saveToDiskSyncWithRetry();
    });
    return this.writeQueue;
  }

  private startWatching(): void {
    if (this.fileWatcher) return;
    try {
      let timer: ReturnType<typeof setTimeout> | null = null;
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
                });
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

  private getCollection(name: string): any[] {
    if (!this.cache[name] || !Array.isArray(this.cache[name])) {
      this.cache[name] = [];
    }
    return this.cache[name];
  }

  collection(name: string) {
    const self = this;
    return {
      find(filter?: Record<string, any>, options?: Record<string, any>) {
        const items = self.getCollection(name);
        let filtered = items.filter((item) => matchesFilter(item, filter));

        const sortField = options?.sort ?? filter?._sort;
        const order = options?.order ?? filter?._order ?? "asc";
        if (sortField) {
          filtered = sortItems(filtered, String(sortField), order);
        }

        const skip =
          options?.skip ??
          (options?.page && options?.limit
            ? (options.page - 1) * options.limit
            : 0);
        if (skip > 0) {
          filtered = filtered.slice(skip);
        }

        const limit = options?.limit ?? filter?._limit;
        if (limit && limit > 0) {
          filtered = filtered.slice(0, limit);
        }

        return [...filtered];
      },

      findPaginated(filter?: Record<string, any>, options?: Record<string, any>) {
        const items = self.getCollection(name);
        let filtered = items.filter((item) => matchesFilter(item, filter));

        const sortField = options?.sort ?? filter?._sort;
        const order = options?.order ?? filter?._order ?? "asc";
        if (sortField) {
          filtered = sortItems(filtered, String(sortField), order);
        }

        const total = filtered.length;
        const page = Math.max(1, options?.page ?? 1);
        const limit = Math.max(1, options?.limit ?? 10);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const skip = (page - 1) * limit;

        const paginatedItems = filtered.slice(skip, skip + limit);

        return {
          items: paginatedItems,
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        };
      },

      findOne(idOrFilter: string | Record<string, any>) {
        const items = self.getCollection(name);
        if (typeof idOrFilter === "string") {
          return items.find((item) => item.id === idOrFilter) || null;
        }
        if (typeof idOrFilter === "object" && idOrFilter !== null) {
          return items.find((item) => matchesFilter(item, idOrFilter)) || null;
        }
        return null;
      },

      async insert(doc: Record<string, any>) {
        const items = self.getCollection(name);
        const id =
          doc.id ||
          `${name.slice(0, 3)}_${Date.now()}_${crypto
            .randomBytes(3)
            .toString("hex")}`;
        const newDoc = {
          ...doc,
          id,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        items.unshift(newDoc);
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

      async insertMany(docs: Record<string, any>[]) {
        const items = self.getCollection(name);
        const inserted: any[] = [];

        for (const doc of docs) {
          const id =
            doc.id ||
            `${name.slice(0, 3)}_${Date.now()}_${crypto
              .randomBytes(3)
              .toString("hex")}`;
          const newDoc = {
            ...doc,
            id,
            createdAt: doc.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          items.unshift(newDoc);
          inserted.push(newDoc);
        }

        await self.saveToDisk();

        self.emit("change", {
          action: "insertMany",
          collection: name,
          count: inserted.length,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        });

        return inserted;
      },

      async update(idOrFilter: string | Record<string, any>, updates: Record<string, any>) {
        const items = self.getCollection(name);
        let lastUpdated: any = null;

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
            lastUpdated = items[i];
            if (typeof idOrFilter === "string") break;
          }
        }

        if (lastUpdated) {
          await self.saveToDisk();
          self.emit("change", {
            action: "update",
            collection: name,
            id: typeof idOrFilter === "string" ? idOrFilter : null,
            data: lastUpdated,
            updatedCount: 1,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          });
        }

        return lastUpdated;
      },

      async updateMany(filter: Record<string, any>, updates: Record<string, any>) {
        const items = self.getCollection(name);
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

        if (count > 0) {
          await self.saveToDisk();
          self.emit("change", {
            action: "updateMany",
            collection: name,
            updatedCount: count,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          });
        }

        return count;
      },

      async delete(idOrFilter: string | Record<string, any>) {
        const items = self.getCollection(name);
        const initialLength = items.length;

        let filtered: any[];
        if (typeof idOrFilter === "string") {
          filtered = items.filter((item) => item.id !== idOrFilter);
        } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
          filtered = items.filter((item) => !matchesFilter(item, idOrFilter));
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

      async deleteMany(filter: Record<string, any>) {
        const items = self.getCollection(name);
        const initialLength = items.length;
        const filtered = items.filter((item) => !matchesFilter(item, filter));
        const deletedCount = initialLength - filtered.length;

        if (deletedCount > 0) {
          self.cache[name] = filtered;
          await self.saveToDisk();
          self.emit("change", {
            action: "deleteMany",
            collection: name,
            deletedCount,
            rev: self.cache._meta.rev,
            timestamp: new Date().toISOString(),
          });
        }

        return deletedCount;
      },

      count(filter?: Record<string, any>) {
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

      exportJson() {
        const items = self.getCollection(name);
        return JSON.stringify(items, null, 2);
      },

      exportCsv() {
        const items = self.getCollection(name);
        if (items.length === 0) return "";
        const allKeys = Array.from(
          new Set(items.flatMap((item) => Object.keys(item)))
        );
        const header = allKeys.map((k) => `"${k}"`).join(",");
        const rows = items.map((item) => {
          return allKeys
            .map((k) => {
              const val = item[k];
              if (val === undefined || val === null) return '""';
              const str =
                typeof val === "object" ? JSON.stringify(val) : String(val);
              return `"${str.replace(/"/g, '""')}"`;
            })
            .join(",");
        });
        return [header, ...rows].join("\n");
      },

      async importJson(jsonStringOrArray: string | any[]) {
        const items = self.getCollection(name);
        const parsed =
          typeof jsonStringOrArray === "string"
            ? JSON.parse(jsonStringOrArray)
            : jsonStringOrArray;
        if (!Array.isArray(parsed))
          throw new Error("Imported data must be an array of documents.");

        let count = 0;
        for (const raw of parsed) {
          const id =
            raw.id ||
            `${name.slice(0, 3)}_${Date.now()}_${crypto
              .randomBytes(3)
              .toString("hex")}`;
          const doc = {
            ...raw,
            id,
            createdAt: raw.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          items.push(doc);
          count++;
        }

        await self.saveToDisk();
        self.emit("change", {
          action: "insertMany",
          collection: name,
          count,
          rev: self.cache._meta.rev,
          timestamp: new Date().toISOString(),
        });

        return { imported: count };
      },
    };
  }

  get(key: string, defaultValue: any = null): any {
    return this.cache[key] !== undefined ? this.cache[key] : defaultValue;
  }

  async set(key: string, value: any): Promise<any> {
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

  async deleteKey(key: string): Promise<boolean> {
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

    const collections: Record<string, number> = {};
    for (const [key, val] of Object.entries(this.cache)) {
      if (key !== "_meta" && Array.isArray(val)) {
        collections[key] = (val as any[]).length;
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

  async backup(customPath?: string): Promise<string> {
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

  async restore(backupPath: string): Promise<boolean> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist at: ${backupPath}`);
    }
    const content = fs.readFileSync(backupPath, "utf8");
    const parsed: DbCache = JSON.parse(content);
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
    });

    return true;
  }

  async reset(): Promise<boolean> {
    this.cache = {
      _meta: {
        version: 2,
        rev: (this.cache._meta?.rev || 0) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    await this.saveToDisk();

    this.emit("change", {
      action: "reset",
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  subscribe(callback: (change: DbChangeEvent) => void): () => void {
    this.on("change", callback);
    return () => {
      this.off("change", callback);
    };
  }

  close(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.removeAllListeners();
  }
}

// Singleton storage
let defaultInstance: JsonDatabaseEngine | null = null;

export function initDatabase(options?: DatabaseOptions): JsonDatabaseEngine {
  if (!defaultInstance) {
    defaultInstance = new JsonDatabaseEngine(options);
  }
  return defaultInstance;
}

export function getDatabase(): JsonDatabaseEngine {
  if (!defaultInstance) {
    defaultInstance = new JsonDatabaseEngine({
      dataDir: process.env.DATABASE_DIR || path.join(process.cwd(), "data"),
    });
  }
  return defaultInstance;
}

export { JsonDatabaseEngine };
