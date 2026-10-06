"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type {
  DatabaseDoc,
  DbChangeEvent,
  DbStats,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
} from "./types";

// Check if running inside Electron with desktop bridge available
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.desktop?.db);
}

// Low-level client for imperative queries from browser or Electron renderer
export const dbClient = {
  collection<T extends { id?: string } = DatabaseDoc>(name: string) {
    return {
      async find(filter?: QueryFilter<T>, options?: QueryOptions<T>): Promise<T[]> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.find(name, filter, options)) as T[];
        }
        const params = new URLSearchParams({ collection: name });
        if (filter) {
          for (const [k, v] of Object.entries(filter)) {
            if (v !== undefined) params.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
          }
        }
        if (options) {
          if (options.sort) params.append("_sort", String(options.sort));
          if (options.order) params.append("_order", options.order);
          if (options.limit) params.append("_limit", String(options.limit));
          if (options.page) params.append("_page", String(options.page));
          if (options.skip) params.append("_skip", String(options.skip));
        }
        const res = await fetch(`/api/db?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch collection: ${name}`);
        const json = await res.json();
        return json.data as T[];
      },

      async findPaginated(filter?: QueryFilter<T>, options?: QueryOptions<T>): Promise<PaginatedResult<T>> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.findPaginated(name, filter, options)) as PaginatedResult<T>;
        }
        const params = new URLSearchParams({ collection: name });
        if (filter) {
          for (const [k, v] of Object.entries(filter)) {
            if (v !== undefined) params.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
          }
        }
        if (options) {
          if (options.sort) params.append("_sort", String(options.sort));
          if (options.order) params.append("_order", options.order);
          params.append("_limit", String(options.limit || 10));
          params.append("_page", String(options.page || 1));
        }
        const res = await fetch(`/api/db?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch paginated collection: ${name}`);
        const json = await res.json();
        return {
          items: json.items || [],
          total: json.total || 0,
          page: json.page || 1,
          limit: json.limit || 10,
          totalPages: json.totalPages || 1,
          hasNext: Boolean(json.hasNext),
          hasPrev: Boolean(json.hasPrev),
        };
      },

      async findOne(idOrFilter: string | QueryFilter<T>): Promise<T | null> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.findOne(name, idOrFilter)) as T | null;
        }
        const params = new URLSearchParams({ collection: name });
        if (typeof idOrFilter === "string") {
          params.append("id", idOrFilter);
        } else {
          for (const [k, v] of Object.entries(idOrFilter)) {
            if (v !== undefined) params.append(k, String(v));
          }
        }
        const res = await fetch(`/api/db?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch doc from: ${name}`);
        const json = await res.json();
        return Array.isArray(json.data) ? json.data[0] || null : (json.data as T | null);
      },

      async insert(doc: Record<string, any>): Promise<T> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.insert(name, doc)) as T;
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "insert", collection: name, data: doc }),
        });
        if (!res.ok) throw new Error("Insert failed");
        const json = await res.json();
        return json.data as T;
      },

      async insertMany(docs: Array<Record<string, any>>): Promise<T[]> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.insertMany(name, docs)) as T[];
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "insertMany", collection: name, data: docs }),
        });
        if (!res.ok) throw new Error("InsertMany failed");
        const json = await res.json();
        return json.data as T[];
      },

      async update(id: string, updates: Record<string, any>): Promise<T | null> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.update(name, id, updates)) as T | null;
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", collection: name, id, data: updates }),
        });
        if (!res.ok) throw new Error("Update failed");
        const json = await res.json();
        return json.data as T | null;
      },

      async updateMany(filter: QueryFilter<T>, updates: Record<string, any>): Promise<number> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.updateMany(name, filter, updates);
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateMany", collection: name, filter, data: updates }),
        });
        if (!res.ok) throw new Error("UpdateMany failed");
        const json = await res.json();
        return json.count || 0;
      },

      async delete(id: string): Promise<boolean> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.delete(name, id);
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", collection: name, id }),
        });
        if (!res.ok) throw new Error("Delete failed");
        const json = await res.json();
        return Boolean(json.success);
      },

      async deleteMany(filter: QueryFilter<T>): Promise<number> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.deleteMany(name, filter);
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteMany", collection: name, filter }),
        });
        if (!res.ok) throw new Error("DeleteMany failed");
        const json = await res.json();
        return json.count || 0;
      },

      async count(filter?: QueryFilter<T>): Promise<number> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.count(name, filter);
        }
        const items = await this.find(filter);
        return items.length;
      },

      async clear(): Promise<boolean> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.clear(name);
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear", collection: name }),
        });
        if (!res.ok) throw new Error("Clear collection failed");
        const json = await res.json();
        return Boolean(json.cleared);
      },

      async exportJson(): Promise<string> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.exportJson(name);
        }
        const res = await fetch(`/api/db?collection=${encodeURIComponent(name)}&export=json`);
        return await res.text();
      },

      async exportCsv(): Promise<string> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.exportCsv(name);
        }
        const res = await fetch(`/api/db?collection=${encodeURIComponent(name)}&export=csv`);
        return await res.text();
      },

      async importJson(data: any): Promise<{ imported: number }> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.importJson(name, data);
        }
        const res = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import", collection: name, data }),
        });
        if (!res.ok) throw new Error("Import failed");
        return await res.json();
      },
    };
  },

  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    if (isDesktopApp()) {
      return (await window.desktop!.db!.get(key, defaultValue)) as T;
    }
    const res = await fetch(`/api/db?key=${encodeURIComponent(key)}`);
    if (!res.ok) return defaultValue as T;
    const json = await res.json();
    return json.data !== undefined ? (json.data as T) : (defaultValue as T);
  },

  async set<T = any>(key: string, value: T): Promise<T> {
    if (isDesktopApp()) {
      return (await window.desktop!.db!.set(key, value)) as T;
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", key, data: value }),
    });
    if (!res.ok) throw new Error("Set failed");
    return value;
  },

  async deleteKey(key: string): Promise<boolean> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.deleteKey(key);
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteKey", key }),
    });
    if (!res.ok) throw new Error("DeleteKey failed");
    return true;
  },

  async getStats(): Promise<DbStats> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.getStats();
    }
    const res = await fetch("/api/db?stats=true");
    if (!res.ok) throw new Error("Failed to get DB stats");
    const json = await res.json();
    return json.data as DbStats;
  },

  async backup(customPath?: string): Promise<string> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.backup(customPath);
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "backup", backupPath: customPath }),
    });
    const json = await res.json();
    return json.backupPath;
  },

  async restore(backupPath: string): Promise<boolean> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.restore(backupPath);
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", backupPath }),
    });
    const json = await res.json();
    return Boolean(json.restored);
  },

  async reset(): Promise<boolean> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.reset();
    }
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const json = await res.json();
    return Boolean(json.reset);
  },

  subscribe(callback: (event: DbChangeEvent) => void): () => void {
    if (isDesktopApp()) {
      return window.desktop!.db!.subscribe(callback);
    }
    // Web fallback: Server-Sent Events
    if (typeof EventSource !== "undefined") {
      const es = new EventSource("/api/db/stream");
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as DbChangeEvent;
          callback(parsed);
        } catch {}
      };
      return () => {
        es.close();
      };
    }
    return () => {};
  },
};

/**
 * Super intuitive real-time React hook for collections.
 * Automatically keeps data in sync across Electron main, Next.js server, and all windows!
 */
export function useDatabase<T extends DatabaseDoc = DatabaseDoc>(
  collectionName: string,
  filter?: QueryFilter<T>,
  options?: QueryOptions<T>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filterKey = useMemo(() => (filter ? JSON.stringify(filter) : ""), [filter]);
  const optionsKey = useMemo(() => (options ? JSON.stringify(options) : ""), [options]);

  const fetchItems = useCallback(async () => {
    try {
      const parsedFilter = filterKey ? (JSON.parse(filterKey) as QueryFilter<T>) : undefined;
      const parsedOptions = optionsKey ? (JSON.parse(optionsKey) as QueryOptions<T>) : undefined;
      const items = await dbClient.collection<T>(collectionName).find(parsedFilter, parsedOptions);
      return items;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [collectionName, filterKey, optionsKey]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const parsedFilter = filterKey ? (JSON.parse(filterKey) as QueryFilter<T>) : undefined;
        const parsedOptions = optionsKey ? (JSON.parse(optionsKey) as QueryOptions<T>) : undefined;
        const items = await dbClient.collection<T>(collectionName).find(parsedFilter, parsedOptions);
        if (isMounted) {
          setData(items);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    const unsubscribe = dbClient.subscribe((event: DbChangeEvent) => {
      if (!isMounted) return;

      if (
        event.action === "external-sync" ||
        event.action === "restore" ||
        event.action === "reset" ||
        event.action === "insertMany" ||
        event.action === "updateMany" ||
        event.action === "deleteMany" ||
        (event.collection && event.collection === collectionName)
      ) {
        if (event.action === "insert" && event.data) {
          setData((prev) => {
            const exists = prev.some((item) => item.id === event.id);
            if (exists) return prev;
            return [event.data as T, ...prev];
          });
        } else if (event.action === "update" && event.data) {
          setData((prev) =>
            prev.map((item) => (item.id === event.id ? ({ ...item, ...event.data } as T) : item))
          );
        } else if (event.action === "delete" && event.id) {
          setData((prev) => prev.filter((item) => item.id !== event.id));
        } else if (event.action === "clear") {
          setData([]);
        } else {
          // Re-fetch on batch, restore or external changes
          void fetchItems().then((items) => {
            if (isMounted) setData(items);
          });
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [collectionName, filterKey, optionsKey, fetchItems]);

  const insert = useCallback(
    async (doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<T> => {
      const created = await dbClient.collection<T>(collectionName).insert(doc);
      return created;
    },
    [collectionName]
  );

  const insertMany = useCallback(
    async (docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>): Promise<T[]> => {
      const created = await dbClient.collection<T>(collectionName).insertMany(docs);
      return created;
    },
    [collectionName]
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>): Promise<T | null> => {
      const updated = await dbClient.collection<T>(collectionName).update(id, updates);
      return updated;
    },
    [collectionName]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const deleted = await dbClient.collection<T>(collectionName).delete(id);
      return deleted;
    },
    [collectionName]
  );

  const clear = useCallback(async (): Promise<boolean> => {
    return await dbClient.collection<T>(collectionName).clear();
  }, [collectionName]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchItems();
      setData(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  return {
    data,
    loading,
    error,
    insert,
    insertMany,
    update,
    remove,
    clear,
    refresh,
  };
}

/**
 * Real-time hook for a single document
 */
export function useDocument<T extends DatabaseDoc = DatabaseDoc>(
  collectionName: string,
  id: string | null | undefined
) {
  const [document, setDocument] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    void (async () => {
      const doc = await dbClient.collection<T>(collectionName).findOne(id);
      if (isMounted) {
        setDocument(doc);
        setLoading(false);
      }
    })();
    const unsubscribe = dbClient.subscribe((event) => {
      if (!isMounted) return;
      if (event.collection === collectionName && event.id === id) {
        if (event.action === "update" && event.data) {
          setDocument(event.data as T);
        } else if (event.action === "delete") {
          setDocument(null);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [collectionName, id]);

  const update = useCallback(
    async (updates: Partial<T>) => {
      if (!id) return null;
      return await dbClient.collection<T>(collectionName).update(id, updates);
    },
    [collectionName, id]
  );

  const remove = useCallback(async () => {
    if (!id) return false;
    return await dbClient.collection<T>(collectionName).delete(id);
  }, [collectionName, id]);

  return { document, loading, update, remove };
}

/**
 * Real-time React hook for key-value settings or state
 */
export function useKeyValue<T = any>(key: string, defaultValue: T): [T, (val: T) => Promise<T>, boolean] {
  const [value, setValueState] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const val = await dbClient.get<T>(key, defaultValue);
      if (mounted) {
        setValueState(val);
        setLoading(false);
      }
    })();

    const unsubscribe = dbClient.subscribe((event) => {
      if (!mounted) return;
      if (event.key === key && event.action === "set") {
        setValueState(event.data as T);
      } else if (event.key === key && event.action === "deleteKey") {
        setValueState(defaultValue);
      } else if (event.action === "external-sync" || event.action === "restore" || event.action === "reset") {
        void (async () => {
          const val = await dbClient.get<T>(key, defaultValue);
          if (mounted) setValueState(val);
        })();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [key, defaultValue]);

  const setValue = useCallback(
    async (newVal: T) => {
      await dbClient.set<T>(key, newVal);
      setValueState(newVal);
      return newVal;
    },
    [key]
  );

  return [value, setValue, loading];
}

/**
 * Real-time React hook for database stats
 */
export function useDatabaseStats() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await dbClient.getStats();
      setStats(s);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const s = await dbClient.getStats();
        if (mounted) {
          setStats(s);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    })();

    const unsub = dbClient.subscribe(() => {
      if (!mounted) return;
      void (async () => {
        try {
          const s = await dbClient.getStats();
          if (mounted) setStats(s);
        } catch {}
      })();
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { stats, loading, refresh };
}
