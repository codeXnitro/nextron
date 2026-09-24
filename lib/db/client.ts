"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { DatabaseDoc, DbChangeEvent, DbStats } from "./types";

// Check if running inside Electron with desktop bridge available
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.desktop?.db);
}

// Low-level client for imperative queries from browser or electron
export const dbClient = {
  collection<T extends { id?: string } = DatabaseDoc>(name: string) {
    return {
      async find(filter?: Record<string, any>): Promise<T[]> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.find(name, filter)) as T[];
        }
        const params = new URLSearchParams({ collection: name });
        if (filter) {
          for (const [k, v] of Object.entries(filter)) {
            params.append(k, String(v));
          }
        }
        const res = await fetch(`/api/db?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch collection: ${name}`);
        const json = await res.json();
        return json.data as T[];
      },

      async findOne(idOrFilter: string | Record<string, any>): Promise<T | null> {
        if (isDesktopApp()) {
          return (await window.desktop!.db!.findOne(name, idOrFilter)) as T | null;
        }
        const params = new URLSearchParams({ collection: name });
        if (typeof idOrFilter === "string") {
          params.append("id", idOrFilter);
        } else {
          for (const [k, v] of Object.entries(idOrFilter)) {
            params.append(k, String(v));
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

      async count(filter?: Record<string, any>): Promise<number> {
        if (isDesktopApp()) {
          return await window.desktop!.db!.count(name, filter);
        }
        const items = await this.find(filter);
        return items.length;
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

  async getStats(): Promise<DbStats> {
    if (isDesktopApp()) {
      return await window.desktop!.db!.getStats();
    }
    const res = await fetch("/api/db?stats=true");
    if (!res.ok) throw new Error("Failed to get DB stats");
    const json = await res.json();
    return json.data as DbStats;
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
export function useDatabase<T extends { id: string } = DatabaseDoc>(
  collectionName: string,
  filter?: Record<string, any>
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const filterKey = useMemo(() => (filter ? JSON.stringify(filter) : ""), [filter]);

  const fetchItems = useCallback(async () => {
    try {
      const parsedFilter = filterKey ? JSON.parse(filterKey) : undefined;
      const items = await dbClient.collection<T>(collectionName).find(parsedFilter);
      return items;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [collectionName, filterKey]);

  useEffect(() => {
    let isMounted = true;

    // Asynchronous initial fetch (avoids synchronous setState during render)
    void (async () => {
      try {
        const parsedFilter = filterKey ? JSON.parse(filterKey) : undefined;
        const items = await dbClient.collection<T>(collectionName).find(parsedFilter);
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

    // Subscribe to real-time events (via Electron IPC or Web SSE)
    const unsubscribe = dbClient.subscribe((event: DbChangeEvent) => {
      if (!isMounted) return;

      if (event.action === "external-sync" || (event.collection && event.collection === collectionName)) {
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
          // Re-fetch on bulk or external change
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
  }, [collectionName, filterKey, fetchItems]);

  const insert = useCallback(
    async (doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<T> => {
      const created = await dbClient.collection<T>(collectionName).insert(doc);
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
    update,
    remove,
    refresh,
  };
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
      } else if (event.action === "external-sync") {
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
