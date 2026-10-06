"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Database,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  FileJson,
  FileSpreadsheet,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Sparkles,
  Layers,
  ArrowUpDown,
  Filter,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { useDatabase, useDatabaseStats, isDesktopApp, dbClient } from "@/lib/db/client";
import { useIsClient } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

export function DatabaseStudio() {
  const isClient = useIsClient();
  const isDesktop = isClient && isDesktopApp();

  const [activeCollection, setActiveCollection] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  // Input states
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [isPending, startTransition] = useTransition();

  // Query filter construction
  const queryFilter = useMemo(() => {
    const f: Record<string, any> = {};
    if (searchTerm.trim()) f._search = searchTerm.trim();
    if (priorityFilter !== "all") f.priority = priorityFilter;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [searchTerm, priorityFilter]);

  const queryOptions = useMemo(() => {
    return {
      sort: sortField,
      order: sortOrder,
    };
  }, [sortField, sortOrder]);

  type StudioItem = {
    id: string;
    title?: string;
    name?: string;
    text?: string;
    completed?: boolean;
    priority?: "low" | "medium" | "high";
    source?: string;
    createdAt: string;
    updatedAt: string;
    [key: string]: any;
  };

  const { data: items, loading, insert, insertMany, update, remove, clear, refresh } = useDatabase<StudioItem>(
    activeCollection,
    queryFilter,
    queryOptions
  );

  const { stats, refresh: refreshStats } = useDatabaseStats();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await insert({
        title: newTitle.trim(),
        completed: false,
        priority: newPriority,
        source: isDesktop ? "Electron Native Studio" : "Web Studio",
      });
      setNewTitle("");
      toast.success("Document Created", `Added "${newTitle.trim()}" to ${activeCollection}`);
    } catch (err) {
      toast.error("Creation Failed", String(err));
    }
  };

  const handleInsertSeedData = async () => {
    try {
      const seed = [
        { title: "Review architectural specifications", completed: true, priority: "high", source: "Seed Data" },
        { title: "Test Native OS File Dialogs", completed: false, priority: "high", source: "Seed Data" },
        { title: "Verify Server Actions RPC latency", completed: false, priority: "medium", source: "Seed Data" },
        { title: "Package installer with Electron Forge", completed: false, priority: "low", source: "Seed Data" },
      ];
      await insertMany(seed);
      toast.success("Seed Data Inserted", "Added 4 demo records into database");
    } catch (err) {
      toast.error("Seed Insert Failed", String(err));
    }
  };

  const handleToggle = async (item: any) => {
    try {
      await update(item.id, { completed: !item.completed });
    } catch (err) {
      toast.error("Update Failed", String(err));
    }
  };

  const handleDelete = async (id: string, title?: string) => {
    try {
      await remove(id);
      toast.info("Deleted Record", title ? `Removed "${title}"` : `Removed record ${id}`);
    } catch (err) {
      toast.error("Delete Failed", String(err));
    }
  };

  const handleExportJson = async () => {
    try {
      const json = await dbClient.collection(activeCollection).exportJson();
      if (window.desktop?.dialog && window.desktop?.shell) {
        const saveRes = await window.desktop.dialog.showSaveDialog({
          title: `Export ${activeCollection}.json`,
          defaultPath: `${activeCollection}.json`,
          filters: [{ name: "JSON File", extensions: ["json"] }],
        });
        if (!saveRes.canceled && saveRes.filePath) {
          // Write via browser download or clipboard fallback
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${activeCollection}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Export Complete", `Saved ${activeCollection}.json`);
          return;
        }
      }

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeCollection}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export Complete", `Downloaded ${activeCollection}.json`);
    } catch (err) {
      toast.error("Export Failed", String(err));
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await dbClient.collection(activeCollection).exportCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeCollection}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export Complete", `Downloaded ${activeCollection}.csv`);
    } catch (err) {
      toast.error("Export Failed", String(err));
    }
  };

  const handleBackup = async () => {
    try {
      const backupPath = await dbClient.backup();
      toast.success("Backup Created", backupPath ? backupPath.split(/[/\\]/).pop() : "Saved to data/backups");
    } catch (err) {
      toast.error("Backup Failed", String(err));
    }
  };

  const handleRevealFile = async () => {
    try {
      if (window.desktop?.shell && window.desktop?.db) {
        const filePath = await window.desktop.db.getFilePath();
        await window.desktop.shell.showItemInFolder(filePath);
        toast.info("Opened Explorer", filePath);
      } else {
        toast.info("Web Preview Mode", "Database file is located in project data/db.json");
      }
    } catch (err) {
      toast.error("Reveal Failed", String(err));
    }
  };

  const handleClearCollection = async () => {
    if (confirm(`Are you sure you want to clear all records from "${activeCollection}"?`)) {
      try {
        await clear();
        toast.info("Collection Cleared", `All records removed from ${activeCollection}`);
      } catch (err) {
        toast.error("Clear Failed", String(err));
      }
    }
  };

  return (
    <Card className="border border-border/80 bg-card/70 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Studio Header */}
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="size-4" />
              </span>
              <CardTitle className="text-xl font-bold tracking-tight">Database Studio</CardTitle>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Shared File
              </span>
            </div>
            <CardDescription className="text-xs">
              Zero-config, atomic real-time JSON engine synchronized across Next.js server, Electron main, and client hooks.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackup}
              title="Create a timestamped backup in data/backups/"
            >
              <HardDrive className="size-3.5 mr-1.5 text-primary" /> Backup DB
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevealFile}
              title="Reveal database file in system file explorer"
            >
              <FolderOpen className="size-3.5 mr-1.5 text-sky-400" /> Reveal File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refresh();
                refreshStats();
                toast.info("Database Synced", "Refreshed live state from disk");
              }}
              title="Force sync state"
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Sync
            </Button>
          </div>
        </div>

        {/* Database Live Stats Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl bg-muted/40 p-2.5 text-xs font-mono border border-border/30">
          <div className="flex items-center gap-1.5 truncate">
            <FolderOpen className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground truncate" title={stats?.filePath || "data/db.json"}>
              {stats?.filePath ? stats.filePath.split(/[/\\]/).slice(-2).join("/") : "data/db.json"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">Size:</span>
            <span className="font-semibold">{stats ? `${stats.sizeBytes} B` : "0 B"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">Rev:</span>
            <span className="font-semibold">v{stats?.rev || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
            <span className="text-muted-foreground">Mode:</span>
            <span className="text-emerald-500 font-semibold">{isDesktop ? "Electron Native" : "Web Preview"}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Controls Toolbar: Collections, View Switcher, Export/Import */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/40">
          {/* Collection Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Collection:</span>
            {["todos", "notes", "settings", "logs"].map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setActiveCollection(col)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeCollection === col
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {col}
                {stats?.collections?.[col] !== undefined && (
                  <span className="ml-1.5 opacity-75 font-mono text-[10px]">({stats.collections[col]})</span>
                )}
              </button>
            ))}
          </div>

          {/* View and Actions buttons */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("json")}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "json" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                JSON Tree
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportJson} title="Export collection as JSON">
              <Download className="size-3.5 mr-1" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} title="Export collection as CSV">
              <FileSpreadsheet className="size-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {/* Search, Filter & Sort Toolbar */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full rounded-lg border border-input bg-background/80 pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              placeholder={`Search in ${activeCollection}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground shrink-0" />
            <select
              className="w-full rounded-lg border border-input bg-background/80 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
            <select
              className="w-full rounded-lg border border-input bg-background/80 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split("-");
                setSortField(f);
                setSortOrder(o as "asc" | "desc");
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-input bg-background/90 px-3.5 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground select-text"
            placeholder={`Add a new record to '${activeCollection}'...`}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />

          <select
            className="rounded-lg border border-input bg-background/90 px-3 py-2 text-xs font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <Button type="button" disabled={!newTitle.trim()} onClick={handleCreate} className="shrink-0">
            <Plus className="size-4 mr-1.5" /> Add Record
          </Button>

          <Button type="button" variant="outline" onClick={handleInsertSeedData} className="shrink-0" title="Add 4 demo records">
            <Sparkles className="size-3.5 mr-1.5 text-amber-500" /> Insert Seed
          </Button>
        </div>

        {/* Content View: Table vs JSON */}
        {viewMode === "json" ? (
          <div className="rounded-xl border border-border/80 bg-black/70 p-4 font-mono text-xs text-emerald-400 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/40">
              <span className="flex items-center gap-2">
                <FileJson className="size-4 text-primary" /> Live {activeCollection} Collection ({items.length} items)
              </span>
              <span className="text-[10px] text-muted-foreground">Auto-updates on any disk mutation</span>
            </div>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap select-text">
              {JSON.stringify(items, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading collection &apos;{activeCollection}&apos;...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center space-y-3">
                <Database className="size-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">Collection &apos;{activeCollection}&apos; is empty</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Insert your first item using the input above or click &apos;Insert Seed&apos; to load sample documents.
                </p>
                <Button variant="outline" size="sm" onClick={handleInsertSeedData}>
                  <Sparkles className="size-3.5 mr-1.5 text-amber-500" /> Load Sample Data
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                      item.completed
                        ? "bg-muted/30 border-border/40 opacity-75"
                        : "bg-background/80 border-border/80 hover:border-primary/50 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                      <button
                        type="button"
                        onClick={() => void handleToggle(item)}
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title={item.completed ? "Mark active" : "Mark completed"}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="size-5 text-emerald-500" />
                        ) : (
                          <Circle className="size-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium truncate ${
                            item.completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {item.title || item.name || item.text || JSON.stringify(item)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                          <span className="bg-muted/70 px-1.5 py-0.2 rounded">{item.id}</span>
                          {item.priority && (
                            <span
                              className={`rounded px-1.5 py-0.2 font-semibold uppercase text-[9px] ${
                                item.priority === "high"
                                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                  : item.priority === "medium"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                              }`}
                            >
                              {item.priority}
                            </span>
                          )}
                          {item.source && (
                            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 font-sans font-medium">
                              {item.source}
                            </span>
                          )}
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(item.id, item.title)}
                        title="Delete item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collection Summary & Clear button */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{items.length}</strong> {items.length === 1 ? "record" : "records"} in <code className="text-primary font-semibold">{activeCollection}</code>
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearCollection}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear collection
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
