"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
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

function useDatabaseSnapshot<T>(
  getValue: () => T,
  shouldUpdate: (event: DbChangeEvent) => boolean,
  serverValue: T
): [T, () => void] {
  const snapshotRef = useRef<{ getValue: () => T; value: T } | null>(null);
  const notifyRef = useRef<(() => void) | null>(null);

  const getSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (snapshot?.getValue === getValue) return snapshot.value;

    const value = getValue();
    snapshotRef.current = { getValue, value };
    return value;
  }, [getValue]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      notifyRef.current = onStoreChange;
      const unsubscribe = db.subscribe((event) => {
        if (shouldUpdate(event)) {
          snapshotRef.current = null;
          onStoreChange();
        }
      });

      return () => {
        unsubscribe();
        if (notifyRef.current === onStoreChange) {
          notifyRef.current = null;
        }
      };
    },
    [shouldUpdate]
  );
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const refresh = useCallback(() => {
    snapshotRef.current = null;
    notifyRef.current?.();
  }, []);

  return [value, refresh];
}

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

  const getSnapshot = useCallback(() => {
    const parsedFilter = filterKey ? (JSON.parse(filterKey) as QueryFilter<T>) : undefined;
    const parsedOptions = optionsKey ? (JSON.parse(optionsKey) as QueryOptions<T>) : undefined;
    return db.collection<T>(collectionName).find(parsedFilter, parsedOptions);
  }, [collectionName, filterKey, optionsKey]);
  const shouldUpdate = useCallback(
    (event: DbChangeEvent) =>
      event.action === "external-sync" ||
      event.action === "restore" ||
      event.action === "reset" ||
      event.action === "insertMany" ||
      event.action === "updateMany" ||
      event.action === "deleteMany" ||
      event.collection === collectionName,
    [collectionName]
  );
  const emptySnapshot = useMemo<T[]>(() => [], []);
  const [items, refresh] = useDatabaseSnapshot(getSnapshot, shouldUpdate, emptySnapshot);

  const insert = useCallback(
    (doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): DualResult<T> => {
      const res = db.collection<T>(collectionName).insert(doc);
      refresh();
      return res;
    },
    [collectionName, refresh]
  );

  const insertMany = useCallback(
    (docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>): DualResult<T[]> => {
      const res = db.collection<T>(collectionName).insertMany(docs);
      refresh();
      return res;
    },
    [collectionName, refresh]
  );

  const update = useCallback(
    (idOrFilter: string | QueryFilter<T>, updates: Partial<T>): DualResult<T | null> => {
      const res = db.collection<T>(collectionName).update(idOrFilter, updates);
      refresh();
      return res;
    },
    [collectionName, refresh]
  );

  const remove = useCallback(
    (idOrFilter: string | QueryFilter<T>): DualResult<boolean> => {
      const res = db.collection<T>(collectionName).delete(idOrFilter);
      refresh();
      return res;
    },
    [collectionName, refresh]
  );

  const clear = useCallback((): DualResult<boolean> => {
    const res = db.collection<T>(collectionName).clear();
    refresh();
    return res;
  }, [collectionName, refresh]);

  return {
    items,
    data: items, // alias for backwards compatibility
    count: items.length,
    loading: false,
    insert,
    insertMany,
    update,
    remove,
    delete: remove, // alias
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
  const getSnapshot = useCallback((): T | null => {
    if (!id) return null;
    return db.collection<T>(collectionName).findOne(id);
  }, [collectionName, id]);
  const shouldUpdate = useCallback(
    (event: DbChangeEvent) =>
      (event.collection === collectionName && event.id === id) ||
      event.action === "external-sync" ||
      event.action === "restore" ||
      event.action === "reset",
    [collectionName, id]
  );
  const [document, refresh] = useDatabaseSnapshot(getSnapshot, shouldUpdate, null);

  const update = useCallback(
    (updates: Partial<T>): DualResult<T | null> => {
      if (!id) return null as any;
      const res = db.collection<T>(collectionName).update(id, updates);
      refresh();
      return res;
    },
    [collectionName, id, refresh]
  );

  const remove = useCallback((): DualResult<boolean> => {
    if (!id) return false as any;
    const res = db.collection<T>(collectionName).delete(id);
    refresh();
    return res;
  }, [collectionName, id, refresh]);

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
  const getSnapshot = useCallback(() => db.get<T>(key, defaultValue), [key, defaultValue]);
  const shouldUpdate = useCallback(
    (event: DbChangeEvent) =>
      (event.key === key && (event.action === "set" || event.action === "deleteKey")) ||
      event.action === "external-sync" ||
      event.action === "restore" ||
      event.action === "reset",
    [key]
  );
  const [val, refresh] = useDatabaseSnapshot(getSnapshot, shouldUpdate, defaultValue);

  const setValue = useCallback(
    (newVal: T): DualResult<T> => {
      const res = db.set<T>(key, newVal);
      refresh();
      return res;
    },
    [key, refresh]
  );

  return [val, setValue];
}

/**
 * Real-time hook for database statistics
 */
export function useDatabaseStats() {
  const getSnapshot = useCallback(() => db.getStats(), []);
  const shouldUpdate = useCallback(() => true, []);
  const [stats, refresh] = useDatabaseSnapshot<DbStats | null>(
    getSnapshot,
    shouldUpdate,
    null
  );

  return {
    stats,
    refresh,
  };
}

// Backwards compatibility alias for useDatabase
export const useDatabase = useCollection;
export const useKeyValue = useValue;
