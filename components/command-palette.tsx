"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  LayoutDashboard,
  Database,
  Cpu,
  Server,
  Settings,
  Sun,
  Moon,
  HardDrive,
  Bell,
  Volume2,
  Copy,
  FolderOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { dbClient } from "@/lib/db/client";
import { toast } from "@/components/ui/toast";

interface CommandItem {
  id: string;
  category: "Navigation" | "Database" | "Native OS" | "Preferences";
  title: string;
  description?: string;
  icon: any;
  action: () => void | Promise<void>;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: "overview" | "database" | "native" | "server" | "settings") => void;
}

export function CommandPalette({ isOpen, onClose, onNavigateTab }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { theme, setTheme } = useTheme();

  const commands: CommandItem[] = useMemo(() => {
    return [
      // Navigation
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Go to Dashboard Overview",
        description: "View system vitals, metrics, and starter quick-steps",
        icon: LayoutDashboard,
        action: () => {
          onNavigateTab?.("overview");
          onClose();
        },
      },
      {
        id: "nav-database",
        category: "Navigation",
        title: "Go to Database Studio",
        description: "Manage real-time JSON collections, filter, sort, and export",
        icon: Database,
        action: () => {
          onNavigateTab?.("database");
          onClose();
        },
      },
      {
        id: "nav-native",
        category: "Navigation",
        title: "Go to Native OS Playground",
        description: "Test native file dialogs, OS notifications, and clipboard",
        icon: Cpu,
        action: () => {
          onNavigateTab?.("native");
          onClose();
        },
      },
      {
        id: "nav-server",
        category: "Navigation",
        title: "Go to Server RPC Verification",
        description: "Test Route Handlers and Server Actions latency",
        icon: Server,
        action: () => {
          onNavigateTab?.("server");
          onClose();
        },
      },
      {
        id: "nav-settings",
        category: "Navigation",
        title: "Go to App Settings",
        description: "Configure app theme, data directory, and maintenance",
        icon: Settings,
        action: () => {
          onNavigateTab?.("settings");
          onClose();
        },
      },

      // Database Actions
      {
        id: "db-backup",
        category: "Database",
        title: "Create Database Backup",
        description: "Creates an atomic timestamped snapshot in data/backups/",
        icon: HardDrive,
        action: async () => {
          try {
            const backupPath = await dbClient.backup();
            toast.success("Database Backup Created", backupPath ? backupPath.split(/[/\\]/).pop() : "Saved to backups");
          } catch (err) {
            toast.error("Backup Failed", String(err));
          }
          onClose();
        },
      },
      {
        id: "db-export",
        category: "Database",
        title: "Export 'todos' Collection as JSON",
        description: "Copies current JSON data to clipboard",
        icon: Copy,
        action: async () => {
          try {
            const json = await dbClient.collection("todos").exportJson();
            if (window.desktop?.clipboard) {
              await window.desktop.clipboard.writeText(json);
              toast.success("Exported to Clipboard", "Todos JSON copied to clipboard");
            } else if (navigator.clipboard) {
              await navigator.clipboard.writeText(json);
              toast.success("Exported to Clipboard", "Todos JSON copied to clipboard");
            }
          } catch (err) {
            toast.error("Export Failed", String(err));
          }
          onClose();
        },
      },
      {
        id: "db-reveal",
        category: "Database",
        title: "Reveal Database File in Explorer / Finder",
        description: "Opens system file manager highlighting db.json",
        icon: FolderOpen,
        action: async () => {
          try {
            if (window.desktop?.shell && window.desktop?.db) {
              const filePath = await window.desktop.db.getFilePath();
              await window.desktop.shell.showItemInFolder(filePath);
              toast.info("Revealed in Explorer", filePath);
            } else {
              toast.info("Web Preview Mode", "Database file is located in project data/db.json");
            }
          } catch (err) {
            toast.error("Action Failed", String(err));
          }
          onClose();
        },
      },

      // Native OS Actions
      {
        id: "os-notification",
        category: "Native OS",
        title: "Trigger Native OS Notification",
        description: "Fires an operating system desktop notification banner",
        icon: Bell,
        action: async () => {
          if (window.desktop?.notification) {
            await window.desktop.notification.show("Nextron Desktop", "Native OS Notification received successfully!");
            toast.success("Notification Triggered");
          } else {
            toast.info("Native OS feature", "Only active inside the Electron desktop window.");
          }
          onClose();
        },
      },
      {
        id: "os-beep",
        category: "Native OS",
        title: "Play System Audio Beep",
        description: "Triggers the native system sound alert",
        icon: Volume2,
        action: async () => {
          if (window.desktop?.shell) {
            await window.desktop.shell.beep();
            toast.info("System Beep Executed");
          } else {
            toast.info("Native OS feature", "Only active inside the Electron desktop window.");
          }
          onClose();
        },
      },
      {
        id: "os-pin",
        category: "Native OS",
        title: "Toggle Window Always On Top",
        description: "Pins or unpins the application window above other windows",
        icon: Sparkles,
        action: async () => {
          if (window.desktop?.window) {
            const isCurrentlyOnTop = await window.desktop.window.isAlwaysOnTop();
            const newState = await window.desktop.window.setAlwaysOnTop(!isCurrentlyOnTop);
            toast.success(newState ? "Window Pinned on Top" : "Window Unpinned");
          } else {
            toast.info("Native OS feature", "Only active inside the Electron desktop window.");
          }
          onClose();
        },
      },

      // Preferences
      {
        id: "pref-theme",
        category: "Preferences",
        title: theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
        description: "Toggle application colors and sync with native desktop chrome",
        icon: theme === "dark" ? Sun : Moon,
        action: () => {
          const nextTheme = theme === "dark" ? "light" : "dark";
          setTheme(nextTheme);
          if (window.desktop?.theme) {
            window.desktop.theme.setTheme(nextTheme);
          }
          toast.info("Theme Switched", `Active theme is now ${nextTheme}`);
          onClose();
        },
      },
    ];
  }, [theme, setTheme, onNavigateTab, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const term = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term)) ||
        c.category.toLowerCase().includes(term)
    );
  }, [commands, query]);

  // Global shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onNavigateTab?.("overview"); // Open palette trigger
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNavigateTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5">
          <Search className="size-4 text-primary shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground select-text"
            placeholder="Type a command, action, or view to jump..."
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
              } else if (e.key === "Enter" && filtered[selectedIndex]) {
                e.preventDefault();
                void filtered[selectedIndex].action();
              }
            }}
          />
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching commands found for &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex size-7 items-center justify-center rounded-lg ${
                        isSelected ? "bg-white/20 text-white" : "bg-muted text-primary"
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.title}</p>
                      {item.description && (
                        <p className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${
                        isSelected ? "bg-white/20 text-white" : "bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight className="size-3 text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border">↑</kbd> <kbd className="font-mono bg-muted px-1 py-0.5 rounded border">↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono bg-muted px-1 py-0.5 rounded border">↵</kbd> select
            </span>
          </div>
          <span>Nextron Command System</span>
        </div>
      </div>
    </div>
  );
}
