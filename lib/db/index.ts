"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import type {
  DatabaseDoc,
  DatabaseInterface,
  DbChangeEvent,
  DbStats,
  DualResult,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
} from "./types";
import { getClientDatabase } from "./client-engine";

export * from "./types";
export * from "./core";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).desktop?.db);
}

/**
 * Returns the appropriate database engine instance.
 * On server / Node.js: returns ServerDatabaseEngine.
 * On browser / Electron renderer: returns ClientDatabaseEngine.
 */
export function getDb(): DatabaseInterface {
  if (typeof window === "undefined") {
    // Dynamic require on server so webpack does not bundle Node fs on the client
    const { getServerDatabase } = require("./server-engine");
    return getServerDatabase();
  }
  return getClientDatabase();
}

/**
 * Proxy wrapper so `import { db } from "@/lib/db"` works identically and synchronously
 * on both Client and Server without any promises, configuration, or environment tension!
 */
export const db: DatabaseInterface = new Proxy({} as DatabaseInterface, {
  get(_target, prop: keyof DatabaseInterface) {
    const instance = getDb();
    const val = instance[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});

/**
 * Hook to access the synchronous database instance in React components
 */
export function useDb(): DatabaseInterface {
  return db;
}

/**
 * Zero-Promise, zero-flicker, real-time React hook for collections!
 *
 * Usage:
 * ```tsx
 * const { items, insert, update, remove, count } = useCollection<Todo>('todos');
 * ```
 */
export function useCollection<T extends DatabaseDoc = DatabaseDoc>(
  collectionName: string,
  filter?: QueryFilter<T>,
  options?: QueryOptions<T>
) {
  const filterKey = useMemo(() => (filter ? JSON.stringify(filter) : ""), [filter]);
  const optionsKey = useMemo(() => (options ? JSON.stringify(options) : ""), [options]);

  // Synchronously fetch initial snapshot with 0ms delay!
  const getSnapshot = useCallback(() => {
    const parsedFilter = filterKey ? (JSON.parse(filterKey) as QueryFilter<T>) : undefined;
    const parsedOptions = optionsKey ? (JSON.parse(optionsKey) as QueryOptions<T>) : undefined;
    return db.collection<T>(collectionName).find(parsedFilter, parsedOptions);
  }, [collectionName, filterKey, optionsKey]);

  // Use state to track live items reactively
  const [items, setItems] = useState<T[]>(() => getSnapshot());

  useEffect(() => {
    // Subscribe to all changes (local, cross-window, and electron main)
    const unsubscribe = db.subscribe((event: DbChangeEvent) => {
      if (
        event.action === "external-sync" ||
        event.action === "restore" ||
        event.action === "reset" ||
        event.action === "insertMany" ||
        event.action === "updateMany" ||
        event.action === "deleteMany" ||
        event.collection === collectionName
      ) {
        setItems(getSnapshot());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [collectionName, getSnapshot]);

  const insert = useCallback(
    (doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): DualResult<T> => {
      const res = db.collection<T>(collectionName).insert(doc);
      setItems(getSnapshot());
      return res;
    },
    [collectionName, getSnapshot]
  );

  const insertMany = useCallback(
    (docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>): DualResult<T[]> => {
      const res = db.collection<T>(collectionName).insertMany(docs);
      setItems(getSnapshot());
      return res;
    },
    [collectionName, getSnapshot]
  );

  const update = useCallback(
    (idOrFilter: string | QueryFilter<T>, updates: Partial<T>): DualResult<T | null> => {
      const res = db.collection<T>(collectionName).update(idOrFilter, updates);
      setItems(getSnapshot());
      return res;
    },
    [collectionName, getSnapshot]
  );

  const remove = useCallback(
    (idOrFilter: string | QueryFilter<T>): DualResult<boolean> => {
      const res = db.collection<T>(collectionName).delete(idOrFilter);
      setItems(getSnapshot());
      return res;
    },
    [collectionName, getSnapshot]
  );

  const clear = useCallback((): DualResult<boolean> => {
    const res = db.collection<T>(collectionName).clear();
    setItems([]);
    return res;
  }, [collectionName]);

  const count = items.length;

  return {
    items,
    data: items, // alias for backwards compatibility
    count,
    loading: false, // always false because synchronous!
    insert,
    insertMany,
    update,
    remove,
    delete: remove, // alias
    clear,
    refresh: () => setItems(getSnapshot()),
  };
}

/**
 * Real-time hook for a single document
 */
export function useDocument<T extends DatabaseDoc = DatabaseDoc>(
  collectionName: string,
  id: string | null | undefined
) {
  const getDoc = useCallback((): T | null => {
    if (!id) return null;
    return db.collection<T>(collectionName).findOne(id);
  }, [collectionName, id]);

  const [document, setDocument] = useState<T | null>(() => getDoc());

  useEffect(() => {
    const unsubscribe = db.subscribe((event: DbChangeEvent) => {
      if (event.collection === collectionName && event.id === id) {
        setDocument(getDoc());
      } else if (
        event.action === "external-sync" ||
        event.action === "restore" ||
        event.action === "reset"
      ) {
        setDocument(getDoc());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [collectionName, id, getDoc]);

  const update = useCallback(
    (updates: Partial<T>): DualResult<T | null> => {
      if (!id) return null as any;
      const res = db.collection<T>(collectionName).update(id, updates);
      setDocument(getDoc());
      return res;
    },
    [collectionName, id, getDoc]
  );

  const remove = useCallback((): DualResult<boolean> => {
    if (!id) return false as any;
    const res = db.collection<T>(collectionName).delete(id);
    setDocument(null);
    return res;
  }, [collectionName, id]);

  return {
    document,
    doc: document,
    update,
    remove,
  };
}

/**
 * Synchronous, real-time hook for key-value settings or state
 */
export function useValue<T = any>(
  key: string,
  defaultValue: T
): [T, (val: T) => DualResult<T>] {
  const [val, setVal] = useState<T>(() => db.get<T>(key, defaultValue));

  useEffect(() => {
    const unsubscribe = db.subscribe((event: DbChangeEvent) => {
      if (event.key === key) {
        if (event.action === "set") {
          setVal(event.data as T);
        } else if (event.action === "deleteKey") {
          setVal(defaultValue);
        }
      } else if (
        event.action === "external-sync" ||
        event.action === "restore" ||
        event.action === "reset"
      ) {
        setVal(db.get<T>(key, defaultValue));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [key, defaultValue]);

  const setValue = useCallback(
    (newVal: T): DualResult<T> => {
      const res = db.set<T>(key, newVal);
      setVal(newVal);
      return res;
    },
    [key]
  );

  return [val, setValue];
}

/**
 * Real-time hook for database statistics
 */
export function useDatabaseStats() {
  const [stats, setStats] = useState<DbStats>(() => db.getStats());

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setStats(db.getStats());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    stats,
    refresh: () => setStats(db.getStats()),
  };
}

// Backwards compatibility alias for useDatabase
export const useDatabase = useCollection;
export const useKeyValue = useValue;
