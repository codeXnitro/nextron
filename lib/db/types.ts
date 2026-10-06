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
  action: "insert" | "insertMany" | "update" | "updateMany" | "delete" | "deleteMany" | "clear" | "set" | "deleteKey" | "external-sync" | "restore" | "reset";
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

export interface DbCollection<T extends { id?: string } = DatabaseDoc> {
  find(filter?: QueryFilter<T>, options?: QueryOptions<T>): T[];
  findPaginated(filter?: QueryFilter<T>, options?: QueryOptions<T>): PaginatedResult<T>;
  findOne(idOrFilter: string | QueryFilter<T>): T | null;
  insert(doc: Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<T>;
  insertMany(docs: Array<Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: string }>): Promise<T[]>;
  update(idOrFilter: string | QueryFilter<T>, updates: Partial<T>): Promise<T | null>;
  updateMany(filter: QueryFilter<T>, updates: Partial<T>): Promise<number>;
  delete(idOrFilter: string | QueryFilter<T>): Promise<boolean>;
  deleteMany(filter: QueryFilter<T>): Promise<number>;
  count(filter?: QueryFilter<T>): number;
  clear(): Promise<boolean>;
  exportJson(): string;
  exportCsv(): string;
  importJson(jsonStringOrArray: string | T[]): Promise<{ imported: number }>;
}

export interface DatabaseInterface {
  collection<T extends { id?: string } = DatabaseDoc>(name: string): DbCollection<T>;
  get<T = any>(key: string, defaultValue?: T): T | null;
  set<T = any>(key: string, value: T): Promise<T>;
  deleteKey(key: string): Promise<boolean>;
  getStats(): DbStats;
  getFilePath(): string;
  backup(customPath?: string): Promise<string>;
  restore(backupPath: string): Promise<boolean>;
  reset(): Promise<boolean>;
  subscribe(callback: (event: DbChangeEvent) => void): () => void;
}
