"use client";

import { ArrowUpRight, Box, CheckCircle2, Monitor, Moon, Sun, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { icon: Monitor, title: "Build your interface", description: "Start with app/page.tsx and use the included shadcn/ui components." },
  { icon: Terminal, title: "Add desktop powers", description: "Expose safe native features through electron/preload.cjs." },
  { icon: Box, title: "Ship an installer", description: "Run npm run make when your app is ready to share." },
];

export default function Home() {
  const [version, setVersion] = useState("web preview");
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => { window.desktop?.getVersion().then((value) => setVersion(`Desktop v${value}`)); }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16 md:py-24">
      <div className="mb-16 flex items-center justify-between gap-4 text-sm font-medium text-muted-foreground"><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> {version}</span><Button variant="outline" size="icon" aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button></div>
      <section className="max-w-3xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.18em] text-primary">NEXT.JS 16 × ELECTRON × SHADCN/UI</p>
        <h1 className="text-5xl font-bold tracking-tight text-balance md:text-7xl">Build web apps that live on the desktop.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">A calm starting point for your first desktop app. Familiar Next.js, polished components you own, and a packaging workflow ready to use.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => window.desktop?.openExternal("https://ui.shadcn.com/docs")}>Explore shadcn/ui <ArrowUpRight className="size-4" /></Button>
          <Button variant="outline" onClick={() => window.desktop?.openExternal("https://nextjs.org/docs")}>Next.js docs</Button>
        </div>
      </section>
      <section className="mt-20 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => <Card key={title}><CardHeader><div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div><CardDescription>STEP {index + 1}</CardDescription><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>)}
      </section>
      <Card className="mt-4 bg-primary text-primary-foreground"><CardContent className="flex flex-col gap-4 p-7 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium opacity-75">YOUR DAILY COMMAND</p><p className="mt-1 text-2xl font-semibold">npm run dev</p></div><code className="rounded-md bg-black/15 px-4 py-2 text-sm">npm run make</code></CardContent></Card>
    </main>
  );
}
