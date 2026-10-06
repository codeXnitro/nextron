"use client";

import Link from "next/link";
import { ArrowLeft, Database, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DatabaseStudio } from "@/components/database-studio";

export default function DatabasePage() {
  const [version, setVersion] = useState("web preview");

  useEffect(() => {
    window.desktop?.getVersion().then((value) => setVersion(`Desktop v${value}`));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 md:py-12 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-mono">
            <CheckCircle2 className="size-3.5 text-primary" /> {version}
          </span>
        </div>
      </div>

      {/* Page Title */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
          <Database className="size-3.5" /> DEDICATED DATABASE ROUTE (/database)
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Real-Time JSON Database Studio
        </h1>
        <p className="max-w-3xl text-xs leading-6 text-muted-foreground">
          This dedicated route verifies that dynamically added Next.js pages load instantly in development and after build. Everything is synchronized in real time with the Electron main process and server actions.
        </p>
      </div>

      {/* Full Database Studio Component */}
      <DatabaseStudio />
    </main>
  );
}
