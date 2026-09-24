"use client";

import { useState, useTransition } from "react";
import {
  Database,
  Radio,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  HardDrive,
  Cpu,
  Zap,
  Server,
  FileJson,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { useDatabase, useDatabaseStats, isDesktopApp, dbClient } from "@/lib/db/client";
import { createTodoServerAction, deleteTodoServerAction, toggleTodoServerAction } from "@/app/actions/db-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  priority?: "low" | "medium" | "high";
  source?: string;
  createdAt: string;
  updatedAt: string;
};

export function DatabasePanel() {
  const { data: todos, loading, insert, remove, update, refresh } = useDatabase<TodoItem>("todos");
  const { stats, refresh: refreshStats } = useDatabaseStats();

  const [inputTitle, setInputTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [activeTab, setActiveTab] = useState<"client" | "serverAction" | "apiRoute" | "electron">("client");
  const [isPending, startTransition] = useTransition();
  const [showRawJson, setShowRawJson] = useState(false);
  const [lastActionLog, setLastActionLog] = useState<string>("System ready. Real-time sync active.");

  const isDesktop = isDesktopApp();

  const handleAddViaClient = async () => {
    if (!inputTitle.trim()) return;
    try {
      const created = await insert({
        title: inputTitle.trim(),
        completed: false,
        priority,
        source: isDesktop ? "Client (Electron IPC)" : "Client (Web SDK)",
      });
      setLastActionLog(`Created "${created.title}" via Client Hook at ${new Date().toLocaleTimeString()}`);
      setInputTitle("");
    } catch (err) {
      setLastActionLog(`Client insert error: ${String(err)}`);
    }
  };

  const handleAddViaServerAction = () => {
    if (!inputTitle.trim()) return;
    startTransition(async () => {
      try {
        const res = await createTodoServerAction(inputTitle.trim(), priority);
        if (res.success && res.todo) {
          setLastActionLog(`Created "${res.todo.title}" via Next.js Server Action at ${new Date().toLocaleTimeString()}`);
          setInputTitle("");
        }
      } catch (err) {
        setLastActionLog(`Server Action error: ${String(err)}`);
      }
    });
  };

  const handleAddViaApiRoute = async () => {
    if (!inputTitle.trim()) return;
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "insert",
          collection: "todos",
          data: {
            title: inputTitle.trim(),
            completed: false,
            priority,
            source: "Next.js Route Handler (/api/db)",
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLastActionLog(`Created "${json.data.title}" via /api/db Route at ${new Date().toLocaleTimeString()}`);
        setInputTitle("");
      }
    } catch (err) {
      setLastActionLog(`API Route error: ${String(err)}`);
    }
  };

  const handleAddViaElectron = async () => {
    if (!inputTitle.trim()) return;
    try {
      if (window.desktop?.db) {
        const created = await window.desktop.db.insert("todos", {
          title: inputTitle.trim(),
          completed: false,
          priority,
          source: "Direct Electron IPC Main",
        });
        setLastActionLog(`Created "${created.title}" via Direct Electron IPC at ${new Date().toLocaleTimeString()}`);
        setInputTitle("");
      } else {
        setLastActionLog("Direct Electron IPC is only active inside the desktop window.");
      }
    } catch (err) {
      setLastActionLog(`Electron IPC error: ${String(err)}`);
    }
  };

  const handleToggle = async (todo: TodoItem) => {
    if (activeTab === "serverAction") {
      startTransition(async () => {
        await toggleTodoServerAction(todo.id, !todo.completed);
        setLastActionLog(`Toggled "${todo.title}" via Server Action`);
      });
    } else {
      await update(todo.id, { completed: !todo.completed });
      setLastActionLog(`Toggled "${todo.title}" via Real-Time DB`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (activeTab === "serverAction") {
      startTransition(async () => {
        await deleteTodoServerAction(id);
        setLastActionLog(`Deleted "${title}" via Server Action`);
      });
    } else {
      await remove(id);
      setLastActionLog(`Deleted "${title}" via Real-Time DB`);
    }
  };

  return (
    <Card className="border border-border/80 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Header Banner */}
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="size-4" />
              </span>
              <CardTitle className="text-xl font-bold tracking-tight">
                All-in-One Real-Time JSON Database
              </CardTitle>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                <Radio className="size-3 animate-pulse" /> Live Sync Active
              </span>
            </div>
            <CardDescription className="text-xs">
              Automatic zero-config storage in application directory (<code>app.getAppPath()</code>). Shared across Electron Main, Next.js Server, and Client React components in real time.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refresh();
                refreshStats();
              }}
              title="Refresh database state"
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Sync
            </Button>
            <Button
              variant={showRawJson ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              <FileJson className="size-3.5 mr-1.5" /> {showRawJson ? "Hide JSON" : "Inspect db.json"}
            </Button>
          </div>
        </div>

        {/* Database Directory & Stats Bar */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-lg bg-muted/40 p-2.5 text-xs font-mono border border-border/30">
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
            <span className="text-muted-foreground">Revision:</span>
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
        {/* Raw JSON Inspector View */}
        {showRawJson && (
          <div className="rounded-xl border border-primary/20 bg-black/60 p-4 font-mono text-xs text-emerald-400 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/40">
              <span className="flex items-center gap-2">
                <FileJson className="size-4 text-primary" /> Live file contents: {stats?.filePath || "db.json"}
              </span>
              <span className="text-[10px] text-muted-foreground">Auto-updates on change</span>
            </div>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap select-all">
              {JSON.stringify({ stats, todos }, null, 2)}
            </pre>
          </div>
        )}

        {/* Multi-Access Layer Switcher */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Test Real-Time Access Layers:</span>
            </label>
            <span className="text-xs text-muted-foreground font-mono">
              {todos.length} {todos.length === 1 ? "item" : "items"} in collection
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              type="button"
              variant={activeTab === "client" ? "default" : "outline"}
              size="sm"
              className="justify-start h-auto py-2.5 px-3"
              onClick={() => setActiveTab("client")}
            >
              <Cpu className="size-4 mr-2 shrink-0 text-cyan-400" />
              <div className="text-left">
                <div className="text-xs font-semibold">1. Client Hook</div>
                <div className="text-[10px] opacity-75">useDatabase()</div>
              </div>
            </Button>

            <Button
              type="button"
              variant={activeTab === "serverAction" ? "default" : "outline"}
              size="sm"
              className="justify-start h-auto py-2.5 px-3"
              onClick={() => setActiveTab("serverAction")}
            >
              <Zap className="size-4 mr-2 shrink-0 text-amber-400" />
              <div className="text-left">
                <div className="text-xs font-semibold">2. Server Action</div>
                <div className="text-[10px] opacity-75">&quot;use server&quot; RPC</div>
              </div>
            </Button>

            <Button
              type="button"
              variant={activeTab === "apiRoute" ? "default" : "outline"}
              size="sm"
              className="justify-start h-auto py-2.5 px-3"
              onClick={() => setActiveTab("apiRoute")}
            >
              <Server className="size-4 mr-2 shrink-0 text-indigo-400" />
              <div className="text-left">
                <div className="text-xs font-semibold">3. Route Handler</div>
                <div className="text-[10px] opacity-75">/api/db endpoint</div>
              </div>
            </Button>

            <Button
              type="button"
              variant={activeTab === "electron" ? "default" : "outline"}
              size="sm"
              className="justify-start h-auto py-2.5 px-3"
              onClick={() => setActiveTab("electron")}
            >
              <HardDrive className="size-4 mr-2 shrink-0 text-emerald-400" />
              <div className="text-left">
                <div className="text-xs font-semibold">4. Electron IPC</div>
                <div className="text-[10px] opacity-75">Main Process Bridge</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-input bg-background/80 px-3.5 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
            placeholder="Type a task or document to store in JSON database..."
            value={inputTitle}
            onChange={(e) => setInputTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (activeTab === "client") void handleAddViaClient();
                else if (activeTab === "serverAction") handleAddViaServerAction();
                else if (activeTab === "apiRoute") void handleAddViaApiRoute();
                else if (activeTab === "electron") void handleAddViaElectron();
              }
            }}
          />

          <select
            className="rounded-lg border border-input bg-background/80 px-3 py-2 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <Button
            type="button"
            disabled={isPending || !inputTitle.trim()}
            onClick={() => {
              if (activeTab === "client") void handleAddViaClient();
              else if (activeTab === "serverAction") handleAddViaServerAction();
              else if (activeTab === "apiRoute") void handleAddViaApiRoute();
              else if (activeTab === "electron") void handleAddViaElectron();
            }}
            className="shrink-0"
          >
            <Plus className="size-4 mr-1.5" />
            {isPending ? "Executing..." : "Save to Database"}
          </Button>
        </div>

        {/* Real-time Todo/Item List */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading database collection...
            </div>
          ) : todos.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
              <Database className="size-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">The database collection is empty.</p>
              <p className="text-xs text-muted-foreground">Add your first item above to see instant real-time sync across Electron & Next.js.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                    todo.completed
                      ? "bg-muted/30 border-border/40 opacity-70"
                      : "bg-background/60 border-border hover:border-primary/40 shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <button
                      type="button"
                      onClick={() => void handleToggle(todo)}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title={todo.completed ? "Mark active" : "Mark completed"}
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      ) : (
                        <Circle className="size-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          todo.completed ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {todo.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-mono bg-muted/60 px-1.5 py-0.2 rounded">{todo.id}</span>
                        {todo.source && (
                          <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 font-medium">
                            {todo.source}
                          </span>
                        )}
                        <span>{new Date(todo.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => void handleDelete(todo.id, todo.title)}
                    title="Delete item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Event Activity Log */}
        <div className="rounded-lg bg-black/40 border border-border/40 p-3 text-xs font-mono space-y-1">
          <div className="flex items-center justify-between text-muted-foreground pb-1">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
              Live Activity Stream:
            </span>
            <span className="text-[10px]">Real-time Event Bridge</span>
          </div>
          <p className="text-emerald-400 font-medium truncate">{lastActionLog}</p>
        </div>
      </CardContent>
    </Card>
  );
}
