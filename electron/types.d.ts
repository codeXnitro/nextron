export {};

export interface DesktopDbChange<T = any> {
  action: "insert" | "update" | "delete" | "clear" | "set" | "deleteKey" | "external-sync";
  collection?: string | null;
  id?: string | null;
  key?: string | null;
  data?: T;
  deletedCount?: number;
  updatedCount?: number;
  rev: number;
  timestamp: string;
}

export interface DesktopDbStats {
  filePath: string;
  dataDir: string;
  sizeBytes: number;
  rev: number;
  updatedAt: string | null;
  collections: Record<string, number>;
}

export interface DesktopDatabaseBridge {
  find<T = any>(collection: string, filter?: Record<string, any>): Promise<T[]>;
  findOne<T = any>(collection: string, idOrFilter: string | Record<string, any>): Promise<T | null>;
  insert<T = any>(collection: string, doc: Record<string, any>): Promise<T>;
  update<T = any>(collection: string, id: string, updates: Record<string, any>): Promise<T | null>;
  delete(collection: string, id: string): Promise<boolean>;
  count(collection: string, filter?: Record<string, any>): Promise<number>;
  get<T = any>(key: string, defaultValue?: T): Promise<T>;
  set<T = any>(key: string, value: T): Promise<T>;
  deleteKey(key: string): Promise<boolean>;
  getStats(): Promise<DesktopDbStats>;
  getFilePath(): Promise<string>;
  subscribe(callback: (change: DesktopDbChange) => void): () => void;
}

declare global {
  interface Window {
    desktop?: {
      getVersion(): Promise<string>;
      openExternal(url: string): Promise<void>;
      db?: DesktopDatabaseBridge;
    };
  }
}
