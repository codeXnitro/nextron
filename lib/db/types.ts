export interface DatabaseDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface DbChangeEvent<T = any> {
  action: "insert" | "update" | "delete" | "clear" | "set" | "deleteKey" | "external-sync";
  collection?: string | null;
  id?: string | null;
  key?: string | null;
  data?: T;
  deletedCount?: number;
  updatedCount?: number;
  rev: number;
  timestamp: string;
  source?: string;
}

export interface DbStats {
  filePath: string;
  dataDir: string;
  sizeBytes: number;
  rev: number;
  updatedAt: string | null;
  collections: Record<string, number>;
}

export interface DbCollection<T extends { id?: string } = DatabaseDoc> {
  find(filter?: Partial<T> | Record<string, any>): T[];
  findOne(idOrFilter: string | Partial<T>): T | null;
  insert(doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<T>;
  update(idOrFilter: string | Partial<T>, updates: Partial<T>): Promise<T | null>;
  delete(idOrFilter: string | Partial<T>): Promise<boolean>;
  count(filter?: Partial<T>): number;
  clear(): Promise<boolean>;
}

export interface DatabaseInterface {
  collection<T extends { id?: string } = DatabaseDoc>(name: string): DbCollection<T>;
  get<T = any>(key: string, defaultValue?: T): T | null;
  set<T = any>(key: string, value: T): Promise<T>;
  deleteKey(key: string): Promise<boolean>;
  getStats(): DbStats;
  getFilePath(): string;
  subscribe(callback: (event: DbChangeEvent) => void): () => void;
}
