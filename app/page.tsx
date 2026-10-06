"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  Monitor,
  Server,
  Terminal,
  Zap,
  LayoutDashboard,
  Settings,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Radio,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { executeDesktopServerAction, type ServerActionResult } from "@/app/actions/server-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatabasePanel } from "@/components/database-panel";
import { DatabaseStudio } from "@/components/database-studio";
import { NativePlayground } from "@/components/native-playground";
import { useIsClient } from "@/lib/utils";
import { isDesktopApp, dbClient } from "@/lib/db/client";
import { toast } from "@/components/ui/toast";

type TabKey = "overview" | "database" | "native" | "server" | "settings";

type ApiResponse = {
  status: string;
  message: string;
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    processId: number;
    uptimeSeconds: number;
    cpuModel: string;
    memory: string;
  };
  timestamp: string;
};

const steps = [
  { icon: Monitor, title: "1. Build in Next.js", description: "Standard React code in app/page.tsx with Tailwind CSS 4 and shadcn/ui components." },
  { icon: Database, title: "2. Real-Time Storage", description: "Zero-dependency JSON database with useDatabase() hook and atomic cross-process sync." },
  { icon: Terminal, title: "3. Native OS Powers", description: "Call dialogs, clipboard, notifications, and window controls via window.desktop." },
  { icon: Box, title: "4. Ship with Forge", description: "Generate native Windows, macOS, or Linux installers with npm run make." },
];

export default function Home() {
  const isClient = useIsClient();
  const isDesktop = isClient && isDesktopApp();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [version, setVersion] = useState("Web Preview");

  // Server-side code demonstration state
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  const [actionData, setActionData] = useState<ServerActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isDesktop && window.desktop) {
      window.desktop.getVersion().then((v) => setVersion(`Desktop v${v}`));
    }
  }, [isDesktop]);

  const handleTestApi = async () => {
    setApiLoading(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/system");
      const data = (await res.json()) as ApiResponse;
      setApiData(data);
      const latency = Math.round(performance.now() - start);
      setApiLatency(latency);
      toast.success("API Route Executed", `/api/system responded in ${latency}ms`);
    } catch (err) {
      toast.error("API Route Failed", String(err));
    } finally {
      setApiLoading(false);
    }
  };

  const handleTestServerAction = () => {
    startTransition(async () => {
      const start = performance.now();
      try {
        const result = await executeDesktopServerAction("Desktop Kit ping from Nextron UI");
        setActionData(result);
        const latency = Math.round(performance.now() - start);
        toast.success("Server Action Executed", `RPC completed in ${latency}ms`);
      } catch (err) {
        toast.error("Server Action Failed", String(err));
      }
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 md:py-12 space-y-10">
      {/* Top Navigation Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        {/* Navigation Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-muted/40 border border-border/50">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "overview"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="size-3.5" /> Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("database")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "database"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="size-3.5" /> Database Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("native")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "native"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cpu className="size-3.5" /> Native OS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("server")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "server"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Server className="size-3.5" /> Server RPC
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "settings"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="size-3.5" /> Settings
          </button>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground font-mono">
            <CheckCircle2 className="size-3.5 text-primary" /> {version}
          </span>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-12 animate-in fade-in duration-200">
          {/* Hero Section */}
          <section className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
              <Sparkles className="size-3.5" /> NEXT.JS 16 × ELECTRON × NATIVE DESKTOP SUITE
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
              Turn your Next.js skills into native desktop apps.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              A complete production starter with a self-contained Next.js standalone server, custom frameless window controls, instant live reload, and an all-in-one real-time JSON database working in dev and after packaging.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => setActiveTab("database")}>
                <Database className="size-4 mr-1.5" /> Open Database Studio
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("native")}>
                <Cpu className="size-4 mr-1.5" /> Native Capabilities
              </Button>
              <Button
                variant="outline"
                onClick={() => window.desktop?.openExternal("https://github.com/codeXnitro/nextron")}
              >
                GitHub Repo <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </section>

          {/* Quick Real-Time DB Panel Demo */}
          <section className="space-y-4">
            <DatabasePanel />
          </section>

          {/* 4 Steps Section */}
          <section className="grid gap-4 md:grid-cols-4">
            {steps.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border border-border/80 bg-card/60 backdrop-blur-xs">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-sm font-bold">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-5 text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Bottom Daily Command Banner */}
          <Card className="bg-primary text-primary-foreground border-none shadow-xl">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">DAILY WORKFLOW COMMAND</p>
                <p className="mt-1 text-xl font-bold font-mono">npm run dev</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-80">Build & Package Installer:</span>
                <code className="rounded-md bg-black/25 px-3 py-1.5 text-xs font-mono font-semibold">npm run make</code>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DATABASE STUDIO */}
      {activeTab === "database" && (
        <div className="animate-in fade-in duration-200">
          <DatabaseStudio />
        </div>
      )}

      {/* TAB 3: NATIVE OS PLAYGROUND */}
      {activeTab === "native" && (
        <div className="animate-in fade-in duration-200">
          <NativePlayground />
        </div>
      )}

      {/* TAB 4: SERVER RPC VERIFICATION */}
      {activeTab === "server" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Server className="size-6 text-primary" /> Next.js Server-Side Verification
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Verify that Route Handlers (<code>/api/...</code>) and Server Actions (<code>&quot;use server&quot;</code>) execute on the local desktop server after packaging.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Card 1: API Route Handler */}
            <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Cpu className="size-5" />
                  </div>
                  {apiLatency !== null && (
                    <span className="text-xs font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                      {apiLatency}ms latency
                    </span>
                  )}
                </div>
                <CardTitle className="mt-2 text-base">Next.js API Route Handler</CardTitle>
                <CardDescription className="text-xs">
                  Tests <code>/api/system</code> to verify Node.js server execution and HTTP routing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleTestApi}
                  disabled={apiLoading}
                  className="w-full"
                  variant="outline"
                >
                  <Activity className="size-4 mr-2" />
                  {apiLoading ? "Testing Route Handler..." : "Test /api/system Route"}
                </Button>

                {apiData ? (
                  <div className="rounded-xl bg-muted/50 p-3.5 text-xs font-mono space-y-1.5 border border-border/40 select-text">
                    <div className="text-emerald-500 font-semibold">✓ Server Response (PID: {apiData.runtime.processId})</div>
                    <div>Node: {apiData.runtime.nodeVersion} ({apiData.runtime.arch})</div>
                    <div>Platform: {apiData.runtime.platform}</div>
                    <div>Memory: {apiData.runtime.memory}</div>
                    <div>Time: {new Date(apiData.timestamp).toLocaleTimeString()}</div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Click to execute server-side Node.js route handler.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Server Action */}
            <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="size-5" />
                  </div>
                  {actionData && (
                    <span className="text-xs font-mono bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      RPC Success
                    </span>
                  )}
                </div>
                <CardTitle className="mt-2 text-base">Next.js Server Action</CardTitle>
                <CardDescription className="text-xs">
                  Executes a <code>&quot;use server&quot;</code> function directly through Next.js RPC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleTestServerAction}
                  disabled={isPending}
                  className="w-full"
                  variant="outline"
                >
                  <Zap className="size-4 mr-2" />
                  {isPending ? "Executing Action..." : "Run Server Action"}
                </Button>

                {actionData ? (
                  <div className="rounded-xl bg-muted/50 p-3.5 text-xs font-mono space-y-1.5 border border-border/40 select-text">
                    <div className="text-emerald-500 font-semibold">✓ Action Result (PID: {actionData.serverPid})</div>
                    <div>Output: {actionData.echoMessage}</div>
                    <div>Host: {actionData.serverHostname}</div>
                    <div>Processed: {actionData.processedAt}</div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Click to trigger a Next.js Server Action RPC.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="size-6 text-primary" /> Application & Database Settings
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Inspect application runtime, manage real-time database storage, and trigger maintenance tasks.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-base">Database File Maintenance</CardTitle>
                <CardDescription className="text-xs">
                  Create timestamped backups, reveal the file in explorer, or reset demo data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      const p = await dbClient.backup();
                      toast.success("Backup Created", p);
                    } catch (err) {
                      toast.error("Backup Failed", String(err));
                    }
                  }}
                >
                  <HardDrive className="size-4 mr-2 text-primary" /> Create Database Backup
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      if (window.desktop?.shell && window.desktop?.db) {
                        const fp = await window.desktop.db.getFilePath();
                        await window.desktop.shell.showItemInFolder(fp);
                        toast.info("Revealed in Explorer", fp);
                      } else {
                        toast.info("Web Preview Mode", "File is in data/db.json");
                      }
                    } catch (err) {
                      toast.error("Action Failed", String(err));
                    }
                  }}
                >
                  <FolderOpen className="size-4 mr-2 text-sky-400" /> Reveal data/db.json in File Explorer
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-rose-500 hover:text-rose-600"
                  onClick={async () => {
                    if (confirm("Are you sure you want to reset the database? This empties all collections.")) {
                      try {
                        await dbClient.reset();
                        toast.info("Database Reset", "All collections have been cleared");
                      } catch (err) {
                        toast.error("Reset Failed", String(err));
                      }
                    }
                  }}
                >
                  <RefreshCw className="size-4 mr-2" /> Reset Database to Clean Slate
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-base">About Nextron</CardTitle>
                <CardDescription className="text-xs">
                  Desktop starter kit architecture details and version info.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Framework</span>
                  <span className="font-semibold">Next.js 16 (App Router)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Desktop Wrapper</span>
                  <span className="font-semibold">Electron 37</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Styling</span>
                  <span className="font-semibold">Tailwind CSS 4 + shadcn/ui</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Database Engine</span>
                  <span className="font-semibold text-emerald-500">Atomic Real-Time JSON</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Packaging Tool</span>
                  <span className="font-semibold">Electron Forge</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
