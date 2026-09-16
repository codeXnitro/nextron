"use client";

import {
  Activity,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Cpu,
  Monitor,
  Moon,
  Server,
  Sun,
  Terminal,
  Zap,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { executeDesktopServerAction, type ServerActionResult } from "@/app/actions/server-action";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  { icon: Monitor, title: "Build your interface", description: "Start with app/page.tsx and use the included shadcn/ui components." },
  { icon: Terminal, title: "Add desktop powers", description: "Expose safe native features through electron/preload.cjs." },
  { icon: Box, title: "Ship an installer", description: "Run npm run make when your app is ready to share." },
];

export default function Home() {
  const [version, setVersion] = useState("web preview");
  const { theme, setTheme } = useTheme();

  // Server-side code demonstration state
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  const [actionData, setActionData] = useState<ServerActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    window.desktop?.getVersion().then((value) => setVersion(`Desktop v${value}`));
  }, []);

  const handleTestApi = async () => {
    setApiLoading(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/system");
      const data = (await res.json()) as ApiResponse;
      setApiData(data);
      setApiLatency(Math.round(performance.now() - start));
    } catch (err) {
      console.error("API test failed:", err);
    } finally {
      setApiLoading(false);
    }
  };

  const handleTestServerAction = () => {
    startTransition(async () => {
      try {
        const result = await executeDesktopServerAction("Desktop Kit ping from UI");
        setActionData(result);
      } catch (err) {
        console.error("Server Action failed:", err);
      }
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16 md:py-24">
      {/* Top Bar */}
      <div className="mb-16 flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" /> {version}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Toggle color theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      {/* Hero Section */}
      <section className="max-w-3xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.18em] text-primary">
          NEXT.JS 16 × ELECTRON × SHADCN/UI
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-balance md:text-7xl">
          Build web apps that live on the desktop.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          A calm starting point for your first desktop app. Full Next.js server-side support (Route Handlers, Server Actions, Node APIs) running standalone in production.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => window.desktop?.openExternal("https://ui.shadcn.com/docs")}>
            Explore shadcn/ui <ArrowUpRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => window.desktop?.openExternal("https://nextjs.org/docs")}>
            Next.js docs
          </Button>
        </div>
      </section>

      {/* Server-Side Verification Section */}
      <section className="mt-16">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Server className="size-6 text-primary" /> Next.js Server-Side Verification
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Verify that Route Handlers (`/api/...`) and Server Actions (`&quot;use server&quot;`) execute on the local desktop server after build.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: API Route Handler */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Cpu className="size-5" />
                </div>
                {apiLatency !== null && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {apiLatency}ms
                  </span>
                )}
              </div>
              <CardTitle className="mt-2">Next.js API Route Handler</CardTitle>
              <CardDescription>
                Tests <code>/api/system</code> to verify Node.js server execution and HTTP routing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleTestApi}
                disabled={apiLoading}
                className="w-full mb-4"
                variant="outline"
              >
                <Activity className="size-4 mr-2" />
                {apiLoading ? "Testing Route Handler..." : "Test /api/system Route"}
              </Button>

              {apiData ? (
                <div className="rounded-lg bg-muted/50 p-3 text-xs font-mono space-y-1.5 border">
                  <div className="text-primary font-semibold">✓ Server Response (PID: {apiData.runtime.processId})</div>
                  <div>Node: {apiData.runtime.nodeVersion} ({apiData.runtime.arch})</div>
                  <div>Platform: {apiData.runtime.platform}</div>
                  <div>Memory: {apiData.runtime.memory}</div>
                  <div>Time: {new Date(apiData.timestamp).toLocaleTimeString()}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Click to execute server-side Node.js route handler.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Server Action */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="size-5" />
                </div>
                {actionData && (
                  <span className="text-xs font-mono bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-full">
                    Success
                  </span>
                )}
              </div>
              <CardTitle className="mt-2">Next.js Server Action</CardTitle>
              <CardDescription>
                Executes a <code>&quot;use server&quot;</code> function directly through Next.js RPC.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleTestServerAction}
                disabled={isPending}
                className="w-full mb-4"
                variant="outline"
              >
                <Zap className="size-4 mr-2" />
                {isPending ? "Executing Action..." : "Run Server Action"}
              </Button>

              {actionData ? (
                <div className="rounded-lg bg-muted/50 p-3 text-xs font-mono space-y-1.5 border">
                  <div className="text-primary font-semibold">✓ Action Result (PID: {actionData.serverPid})</div>
                  <div>Output: {actionData.echoMessage}</div>
                  <div>Host: {actionData.serverHostname}</div>
                  <div>Processed: {actionData.processedAt}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Click to trigger a Next.js Server Action RPC.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Steps */}
      <section className="mt-20 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <CardDescription>STEP {index + 1}</CardDescription>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Footer Card */}
      <Card className="mt-8 bg-primary text-primary-foreground">
        <CardContent className="flex flex-col gap-4 p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium opacity-75">YOUR DAILY COMMAND</p>
            <p className="mt-1 text-2xl font-semibold">npm run dev</p>
          </div>
          <code className="rounded-md bg-black/15 px-4 py-2 text-sm">npm run make</code>
        </CardContent>
      </Card>
    </main>
  );
}
