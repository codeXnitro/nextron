"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X, Sun, Moon, Database, Search, Command } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useIsClient } from "@/lib/utils";
import { isDesktopApp } from "@/lib/db/client";

interface DesktopTitleBarProps {
  onOpenCommandPalette?: () => void;
}

export function DesktopTitleBar({ onOpenCommandPalette }: DesktopTitleBarProps) {
  const isClient = useIsClient();
  const isDesktop = isClient && isDesktopApp();
  const { theme, setTheme } = useTheme();

  const [platform, setPlatform] = useState<string>("win32");
  const [isMaximized, setIsMaximized] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (!isDesktop || !window.desktop) return;

    window.desktop.getPlatform().then((p) => setPlatform(p));
    window.desktop.getVersion().then((v) => setVersion(v));

    window.desktop.window.isMaximized().then((max) => setIsMaximized(max));
    const unsubscribe = window.desktop.window.onMaximizeChange((max) => {
      setIsMaximized(max);
    });

    return () => {
      unsubscribe();
    };
  }, [isDesktop]);

  const handleMinimize = () => {
    window.desktop?.window.minimize();
  };

  const handleToggleMaximize = async () => {
    if (!window.desktop) return;
    const max = await window.desktop.window.toggleMaximize();
    setIsMaximized(max);
  };

  const handleClose = () => {
    window.desktop?.window.close();
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (window.desktop?.theme) {
      window.desktop.theme.setTheme(nextTheme);
    }
  };

  const isDarwin = platform === "darwin";

  return (
    <header className="sticky top-0 z-40 flex h-10 w-full items-center justify-between border-b border-border/50 bg-background/85 px-3 backdrop-blur-md app-drag select-none transition-colors">
      {/* Left section: App Brand & macOS traffic lights offset */}
      <div className="flex items-center gap-2.5">
        {isDarwin && <div className="w-16 shrink-0" />}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs shadow-sm">
            N
          </div>
          <span className="text-xs font-semibold tracking-tight text-foreground/90">Nextron</span>
          {version && (
            <span className="hidden sm:inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-medium">
              v{version}
            </span>
          )}
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="app-no-drag flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/70 hover:text-foreground"
          title="Open Command Palette (Ctrl+K or ⌘K)"
        >
          <Search className="size-3 text-muted-foreground" />
          <span className="hidden md:inline text-[11px]">Search commands & data...</span>
          <span className="md:hidden text-[11px]">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground shadow-xs">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right section: DB status, Theme toggle, Window Controls */}
      <div className="flex items-center gap-1.5">
        {/* Real-time DB live status pill */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-Time Sync</span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="app-no-drag inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>

        {/* Windows / Linux native window buttons */}
        {!isDarwin && isDesktop && (
          <div className="app-no-drag flex items-center pl-1">
            <button
              type="button"
              onClick={handleMinimize}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Minimize Window"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={isMaximized ? "Restore Window" : "Maximize Window"}
            >
              {isMaximized ? <Copy className="size-3 rotate-180" /> : <Square className="size-3" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
              title="Close Application"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
