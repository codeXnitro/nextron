"use client";

import Link from "next/link";
import { ArrowLeft, Database, CheckCircle2, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { DatabasePanel } from "@/components/database-panel";

export default function DatabasePage() {
  const [version, setVersion] = useState("web preview");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    window.desktop?.getVersion().then((value) => setVersion(`Desktop v${value}`));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:py-16 space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs">
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
      </div>

      {/* Page Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Database className="size-3.5" /> DEDICATED DATABASE ROUTE (/database)
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Real-Time JSON Database Manager
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This dedicated route verifies that new Next.js pages load and visually update dynamically in development and after build. Everything is synchronized in real time with the main process and server actions.
        </p>
      </div>

      {/* Database Panel Child Component */}
      <DatabasePanel />
    </main>
  );
}
