export interface DatabaseDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export type QueryOperator<V = any> = {
  $eq?: V;
  $ne?: V;
  $gt?: number | string | Date;
  $gte?: number | string | Date;
  $lt?: number | string | Date;
  $lte?: number | string | Date;
  $in?: V[];
  $nin?: V[];
  $contains?: string;
  $startsWith?: string;
  $regex?: string | RegExp;
};

export type QueryFilter<T = any> = {
  [K in keyof T]?: T[K] | QueryOperator<T[K]> | any;
} & {
  _search?: string;
  _sort?: string;
  _order?: "asc" | "desc";
  _limit?: number;
  _page?: number;
  _skip?: number;
  [key: string]: any;
};

export interface QueryOptions<T = any> {
  sort?: keyof T | string;
  order?: "asc" | "desc";
  limit?: number;
  page?: number;
  skip?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface DbChangeEvent<T = any> {
  action:
    | "insert"
    | "insertMany"
    | "update"
    | "updateMany"
    | "delete"
    | "deleteMany"
    | "clear"
    | "set"
    | "deleteKey"
    | "external-sync"
    | "restore"
    | "reset";
  collection?: string | null;
  id?: string | null;
  key?: string | null;
  data?: T;
  count?: number;
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

// Dual sync + thenable return type so code can run synchronously without await OR with await!
export type DualResult<T> = T & Promise<T>;

export interface DbCollection<T extends { id?: string } = DatabaseDoc> {
  find(filter?: QueryFilter<T>, options?: QueryOptions<T>): T[];
  findPaginated(filter?: QueryFilter<T>, options?: QueryOptions<T>): PaginatedResult<T>;
  findOne(idOrFilter: string | QueryFilter<T>): T | null;
  insert(doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): DualResult<T>;
  insertMany(docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>): DualResult<T[]>;
  update(idOrFilter: string | QueryFilter<T>, updates: Partial<T>): DualResult<T | null>;
  updateMany(filter: QueryFilter<T>, updates: Partial<T>): DualResult<number>;
  delete(idOrFilter: string | QueryFilter<T>): DualResult<boolean>;
  deleteMany(filter: QueryFilter<T>): DualResult<number>;
  count(filter?: QueryFilter<T>): number;
  sum(field: keyof T | string, filter?: QueryFilter<T>): number;
  avg(field: keyof T | string, filter?: QueryFilter<T>): number;
  min(field: keyof T | string, filter?: QueryFilter<T>): number | null;
  max(field: keyof T | string, filter?: QueryFilter<T>): number | null;
  clear(): DualResult<boolean>;
  exportJson(): string;
  exportCsv(): string;
  importJson(jsonStringOrArray: string | T[]): DualResult<{ imported: number }>;
}

export interface DatabaseInterface {
  collection<T extends { id?: string } = DatabaseDoc>(name: string): DbCollection<T>;
  get<T = any>(key: string, defaultValue?: T): T;
  set<T = any>(key: string, value: T): DualResult<T>;
  deleteKey(key: string): DualResult<boolean>;
  getStats(): DbStats;
  getFilePath(): string;
  backup(customPath?: string): Promise<string>;
  restore(backupPath: string): Promise<boolean>;
  reset(): DualResult<boolean>;
  subscribe(callback: (event: DbChangeEvent) => void): () => void;
}
