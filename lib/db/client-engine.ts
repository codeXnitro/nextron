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

const LOCAL_STORAGE_KEY = "nextron_db_cache";

export class ClientDatabaseEngine implements DatabaseInterface {
  private cache: Record<string, any> = {
    _meta: {
      version: 2,
      rev: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  private listeners: Set<(event: DbChangeEvent) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private isElectron = false;
  private initialSyncDone = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === "undefined") return;

    // 1. Check if running inside Electron desktop app
    this.isElectron = Boolean((window as any).desktop?.db);

    // 2. Synchronously load cached state from localStorage for instantaneous 0ms first render
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          this.cache = parsed;
        }
      }
    } catch {}

    // 3. Setup BroadcastChannel for multi-tab / multi-window communication
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.broadcastChannel = new BroadcastChannel("nextron_db_channel");
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "db_change" && event.data.payload) {
            this.handleRemoteChange(event.data.payload, false);
          }
        };
      }
    } catch {}

    // 4. If in Electron, listen to IPC broadcasts from the Main process
    if (this.isElectron && (window as any).desktop?.db?.subscribe) {
      (window as any).desktop.db.subscribe((change: DbChangeEvent) => {
        this.handleRemoteChange(change, false);
      });
      // Initial background sync with Main process
      void this.syncFromElectron();
    } else {
      // If Web preview, listen to Server-Sent Events
      this.setupServerSentEvents();
      void this.syncFromWebServer();
    }
  }

  private persistLocal() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.cache));
    } catch {}
  }

  private async syncFromElectron() {
    try {
      const stats = await (window as any).desktop.db.getStats();
      if (!stats) return;

      // Fetch each collection from Electron to ensure freshest data
      for (const colName of Object.keys(stats.collections)) {
        const items = await (window as any).desktop.db.find(colName);
        this.cache[colName] = items;
      }
      this.cache._meta = {
        version: 2,
        rev: stats.rev,
        createdAt: this.cache._meta?.createdAt || new Date().toISOString(),
        updatedAt: stats.updatedAt || new Date().toISOString(),
      };
      this.persistLocal();
      this.initialSyncDone = true;
      this.emitChange({
        action: "external-sync",
        rev: stats.rev,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }

  private async syncFromWebServer() {
    try {
      const res = await fetch("/api/db?all=true");
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.data) {
        this.cache = json.data;
        this.persistLocal();
        this.initialSyncDone = true;
        this.emitChange({
          action: "external-sync",
          rev: this.cache._meta?.rev || 0,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {}
  }

  private setupServerSentEvents() {
    if (typeof EventSource === "undefined") return;
    try {
      const es = new EventSource("/api/db/stream");
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as DbChangeEvent;
          this.handleRemoteChange(parsed, false);
        } catch {}
      };
    } catch {}
  }

  private handleRemoteChange(event: DbChangeEvent, broadcast = true) {
    const { action, collection, id, data } = event;

    if (action === "external-sync" || action === "restore" || action === "reset") {
      if (this.isElectron) {
        void this.syncFromElectron();
      } else {
        void this.syncFromWebServer();
      }
      return;
    }

    if (collection) {
      const items = this.getRawCollection(collection);
      if (action === "insert" && data) {
        const exists = items.some((item) => item.id === (id || data.id));
        if (!exists) {
          items.unshift(data);
        }
      } else if (action === "update" && data) {
        const idx = items.findIndex((item) => item.id === (id || data.id));
        if (idx !== -1) {
          items[idx] = { ...items[idx], ...data };
        }
      } else if (action === "delete" && id) {
        this.cache[collection] = items.filter((item) => item.id !== id);
      } else if (action === "clear") {
        this.cache[collection] = [];
      } else {
        // Batch or complex change
        if (this.isElectron) {
          void this.syncFromElectron();
        } else {
          void this.syncFromWebServer();
        }
      }
    } else if (event.key) {
      if (action === "set") {
        this.cache[event.key] = data;
      } else if (action === "deleteKey") {
        delete this.cache[event.key];
      }
    }

    this.persistLocal();
    this.emitChange(event, broadcast);
  }

  private emitChange(event: DbChangeEvent, broadcast = true) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[ClientDatabaseEngine] Listener error:", err);
      }
    }

    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: "db_change", payload: event });
      } catch {}
    }
  }

  private dispatchBackgroundSync(
    action: string,
    payload: { collection?: string; id?: string; data?: any; filter?: any; key?: string }
  ): Promise<any> {
    if (this.isElectron && (window as any).desktop?.db) {
      const dbBridge = (window as any).desktop.db;
      switch (action) {
        case "insert":
          return dbBridge.insert(payload.collection, payload.data);
        case "insertMany":
          return dbBridge.insertMany(payload.collection, payload.data);
        case "update":
          return dbBridge.update(payload.collection, payload.id, payload.data);
        case "updateMany":
          return dbBridge.updateMany(payload.collection, payload.filter, payload.data);
        case "delete":
          return dbBridge.delete(payload.collection, payload.id);
        case "deleteMany":
          return dbBridge.deleteMany(payload.collection, payload.filter);
        case "clear":
          return dbBridge.clear(payload.collection);
        case "set":
          return dbBridge.set(payload.key, payload.data);
        case "deleteKey":
          return dbBridge.deleteKey(payload.key);
        case "reset":
          return dbBridge.reset();
        case "import":
          return dbBridge.importJson(payload.collection, payload.data);
        default:
          return Promise.resolve();
      }
    }

    // Web preview HTTP API fallback
    return fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    })
      .then((res) => res.json())
      .catch(() => {});
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

        // Synchronous optimistic write
        items.unshift(newDoc);
        self.persistLocal();

        const changeEvent: DbChangeEvent<T> = {
          action: "insert",
          collection: name,
          id,
          data: newDoc,
          rev: (self.cache._meta?.rev || 0) + 1,
          timestamp: new Date().toISOString(),
        };
        self.emitChange(changeEvent);

        // Background persistence
        const bgPromise = self.dispatchBackgroundSync("insert", {
          collection: name,
          data: newDoc,
        });

        return makeDualResult(newDoc, bgPromise);
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

        self.persistLocal();
        self.emitChange({
          action: "insertMany",
          collection: name,
          count: inserted.length,
          rev: (self.cache._meta?.rev || 0) + 1,
          timestamp: new Date().toISOString(),
        });

        const bgPromise = self.dispatchBackgroundSync("insertMany", {
          collection: name,
          data: inserted,
        });

        return makeDualResult(inserted, bgPromise);
      },

      update(
        idOrFilter: string | QueryFilter<T>,
        updates: Partial<T>
      ): DualResult<T | null> {
        const items = self.getRawCollection(name);
        let lastUpdated: T | null = null;
        let matchedId = typeof idOrFilter === "string" ? idOrFilter : null;

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
            matchedId = item.id;
            if (typeof idOrFilter === "string") break;
          }
        }

        let bgPromise = Promise.resolve();
        if (lastUpdated && matchedId) {
          self.persistLocal();
          self.emitChange({
            action: "update",
            collection: name,
            id: matchedId,
            data: lastUpdated,
            updatedCount: 1,
            rev: (self.cache._meta?.rev || 0) + 1,
            timestamp: new Date().toISOString(),
          });
          bgPromise = self.dispatchBackgroundSync("update", {
            collection: name,
            id: matchedId,
            data: updates,
          });
        }

        return makeDualResult(lastUpdated, bgPromise);
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

        let bgPromise = Promise.resolve();
        if (count > 0) {
          self.persistLocal();
          self.emitChange({
            action: "updateMany",
            collection: name,
            updatedCount: count,
            rev: (self.cache._meta?.rev || 0) + 1,
            timestamp: new Date().toISOString(),
          });
          bgPromise = self.dispatchBackgroundSync("updateMany", {
            collection: name,
            filter,
            data: updates,
          });
        }

        return makeDualResult(count, bgPromise);
      },

      delete(idOrFilter: string | QueryFilter<T>): DualResult<boolean> {
        const items = self.getRawCollection(name);
        const initialLength = items.length;

        let filtered: any[];
        let targetId: string | null = null;
        if (typeof idOrFilter === "string") {
          targetId = idOrFilter;
          filtered = items.filter((item) => item.id !== idOrFilter);
        } else if (typeof idOrFilter === "object" && idOrFilter !== null) {
          filtered = items.filter((item) => !matchesFilter(item, idOrFilter));
        } else {
          return makeDualResult(false);
        }

        const deletedCount = initialLength - filtered.length;
        if (deletedCount > 0) {
          self.cache[name] = filtered;
          self.persistLocal();
          self.emitChange({
            action: "delete",
            collection: name,
            id: targetId,
            deletedCount,
            rev: (self.cache._meta?.rev || 0) + 1,
            timestamp: new Date().toISOString(),
          });
          const bgPromise = self.dispatchBackgroundSync("delete", {
            collection: name,
            id: targetId || undefined,
            filter: targetId ? undefined : idOrFilter,
          });
          return makeDualResult(true, bgPromise);
        }

        return makeDualResult(false);
      },

      deleteMany(filter: QueryFilter<T>): DualResult<number> {
        const items = self.getRawCollection(name);
        const initialLength = items.length;
        const filtered = items.filter((item) => !matchesFilter(item, filter));
        const deletedCount = initialLength - filtered.length;

        let bgPromise = Promise.resolve();
        if (deletedCount > 0) {
          self.cache[name] = filtered;
          self.persistLocal();
          self.emitChange({
            action: "deleteMany",
            collection: name,
            deletedCount,
            rev: (self.cache._meta?.rev || 0) + 1,
            timestamp: new Date().toISOString(),
          });
          bgPromise = self.dispatchBackgroundSync("deleteMany", {
            collection: name,
            filter,
          });
        }

        return makeDualResult(deletedCount, bgPromise);
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
        self.persistLocal();
        self.emitChange({
          action: "clear",
          collection: name,
          rev: (self.cache._meta?.rev || 0) + 1,
          timestamp: new Date().toISOString(),
        });
        const bgPromise = self.dispatchBackgroundSync("clear", { collection: name });
        return makeDualResult(true, bgPromise);
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

        self.persistLocal();
        self.emitChange({
          action: "insertMany",
          collection: name,
          count,
          rev: (self.cache._meta?.rev || 0) + 1,
          timestamp: new Date().toISOString(),
        });

        const bgPromise = self.dispatchBackgroundSync("import", {
          collection: name,
          data: parsed,
        });

        return makeDualResult({ imported: count }, bgPromise);
      },
    };
  }

  public get<T = any>(key: string, defaultValue?: T): T {
    return this.cache[key] !== undefined ? this.cache[key] : (defaultValue as T);
  }

  public set<T = any>(key: string, value: T): DualResult<T> {
    this.cache[key] = value;
    this.persistLocal();
    this.emitChange({
      action: "set",
      key,
      data: value,
      rev: (this.cache._meta?.rev || 0) + 1,
      timestamp: new Date().toISOString(),
    });
    const bgPromise = this.dispatchBackgroundSync("set", { key, data: value });
    return makeDualResult(value, bgPromise);
  }

  public deleteKey(key: string): DualResult<boolean> {
    if (this.cache[key] !== undefined) {
      delete this.cache[key];
      this.persistLocal();
      this.emitChange({
        action: "deleteKey",
        key,
        rev: (this.cache._meta?.rev || 0) + 1,
        timestamp: new Date().toISOString(),
      });
      const bgPromise = this.dispatchBackgroundSync("deleteKey", { key });
      return makeDualResult(true, bgPromise);
    }
    return makeDualResult(false);
  }

  public getFilePath(): string {
    return "data/db.json";
  }

  public getStats(): DbStats {
    const collections: Record<string, number> = {};
    for (const [key, val] of Object.entries(this.cache)) {
      if (key !== "_meta" && Array.isArray(val)) {
        collections[key] = val.length;
      }
    }

    const approxSize = JSON.stringify(this.cache).length;
    return {
      filePath: "data/db.json",
      dataDir: "data",
      sizeBytes: approxSize,
      rev: this.cache._meta?.rev || 0,
      updatedAt: this.cache._meta?.updatedAt || null,
      collections,
    };
  }

  public async backup(customPath?: string): Promise<string> {
    if (this.isElectron && (window as any).desktop?.db?.backup) {
      return await (window as any).desktop.db.backup(customPath);
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backup", backupPath: customPath }),
    });
    const json = await res.json();
    return json.backupPath;
  }

  public async restore(backupPath: string): Promise<boolean> {
    if (this.isElectron && (window as any).desktop?.db?.restore) {
      return await (window as any).desktop.db.restore(backupPath);
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", backupPath }),
    });
    const json = await res.json();
    return Boolean(json.restored);
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
    this.persistLocal();
    this.emitChange({
      action: "reset",
      rev: this.cache._meta.rev,
      timestamp: new Date().toISOString(),
    });
    const bgPromise = this.dispatchBackgroundSync("reset", {});
    return makeDualResult(true, bgPromise);
  }

  public subscribe(callback: (event: DbChangeEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

let globalClientDb: ClientDatabaseEngine | null = null;

export function getClientDatabase(): ClientDatabaseEngine {
  if (!globalClientDb) {
    globalClientDb = new ClientDatabaseEngine();
  }
  return globalClientDb;
}
