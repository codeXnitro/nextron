export {};

export interface DesktopDbChange<T = any> {
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
  find<T = any>(collection: string, filter?: Record<string, any>, options?: Record<string, any>): Promise<T[]>;
  findPaginated<T = any>(collection: string, filter?: Record<string, any>, options?: Record<string, any>): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }>;
  findOne<T = any>(collection: string, idOrFilter: string | Record<string, any>): Promise<T | null>;
  insert<T = any>(collection: string, doc: Record<string, any>): Promise<T>;
  insertMany<T = any>(collection: string, docs: Array<Record<string, any>>): Promise<T[]>;
  update<T = any>(collection: string, id: string, updates: Record<string, any>): Promise<T | null>;
  updateMany(collection: string, filter: Record<string, any>, updates: Record<string, any>): Promise<number>;
  delete(collection: string, id: string): Promise<boolean>;
  deleteMany(collection: string, filter: Record<string, any>): Promise<number>;
  clear(collection: string): Promise<boolean>;
  count(collection: string, filter?: Record<string, any>): Promise<number>;
  get<T = any>(key: string, defaultValue?: T): Promise<T>;
  set<T = any>(key: string, value: T): Promise<T>;
  deleteKey(key: string): Promise<boolean>;
  getStats(): Promise<DesktopDbStats>;
  getFilePath(): Promise<string>;
  exportJson(collection: string): Promise<string>;
  exportCsv(collection: string): Promise<string>;
  importJson(collection: string, data: any): Promise<{ imported: number }>;
  backup(customPath?: string): Promise<string>;
  restore(backupPath: string): Promise<boolean>;
  reset(): Promise<boolean>;
  subscribe(callback: (change: DesktopDbChange) => void): () => void;
}

export interface DesktopWindowBridge {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  toggleMaximize(): Promise<boolean>;
  isMaximized(): Promise<boolean>;
  close(): Promise<void>;
  setAlwaysOnTop(flag: boolean): Promise<boolean>;
  isAlwaysOnTop(): Promise<boolean>;
  onMaximizeChange(callback: (isMaximized: boolean) => void): () => void;
}

export interface DesktopDialogBridge {
  showOpenDialog(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles">;
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  showMessageBox(options: {
    type?: "none" | "info" | "error" | "question" | "warning";
    buttons?: string[];
    defaultId?: number;
    title?: string;
    message: string;
    detail?: string;
  }): Promise<{ response: number; checkboxChecked: boolean }>;
}

export interface DesktopNotificationBridge {
  show(title: string, body?: string, options?: { silent?: boolean }): Promise<boolean>;
}

export interface DesktopClipboardBridge {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface DesktopShellBridge {
  openExternal(url: string): Promise<void>;
  showItemInFolder(fullPath: string): Promise<void>;
  openPath(fullPath: string): Promise<string>;
  beep(): Promise<void>;
}

export interface DesktopThemeBridge {
  getTheme(): Promise<"dark" | "light" | "system">;
  setTheme(theme: "dark" | "light" | "system"): Promise<void>;
  onThemeChange(callback: (theme: "dark" | "light") => void): () => void;
}

export interface DesktopAPI {
  getVersion(): Promise<string>;
  getPlatform(): Promise<"win32" | "darwin" | "linux">;
  openExternal(url: string): Promise<void>;
  window: DesktopWindowBridge;
  dialog: DesktopDialogBridge;
  notification: DesktopNotificationBridge;
  clipboard: DesktopClipboardBridge;
  shell: DesktopShellBridge;
  theme: DesktopThemeBridge;
  db: DesktopDatabaseBridge;
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
