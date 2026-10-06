"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Database,
  Cpu,
  Server,
  Settings,
  Sparkles,
  Layers,
  HardDrive,
  FolderGit2,
  ExternalLink,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { desktopConfig } from "@/lib/config";
import { useDatabaseStats } from "@/lib/db";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { stats } = useDatabaseStats();

  const navItems = [
    { id: "overview", title: "Overview", icon: LayoutDashboard, badge: null },
    { id: "database", title: "Database Studio", icon: Database, badge: stats?.collections ? Object.values(stats.collections).reduce((a, b) => a + b, 0) : null },
    { id: "native", title: "Native OS", icon: Cpu, badge: "Desktop" },
    { id: "server", title: "Server RPC", icon: Server, badge: null },
    { id: "settings", title: "Settings", icon: Settings, badge: null },
  ];

  return (
    <Sidebar className="border-r border-border/50 bg-card/40 backdrop-blur-md">
      <SidebarHeader className="border-b border-border/40 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-sm text-foreground">
              {desktopConfig.app.name}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              v{desktopConfig.app.version} • Next.js 16
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Platform Navigation
          </SidebarGroupLabel>
          <SidebarMenu className="mt-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => onTabChange(item.id)}
                    className="cursor-pointer"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 font-medium">{item.title}</span>
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Kit Resources
          </SidebarGroupLabel>
          <SidebarMenu className="mt-1 space-y-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  if (typeof window !== "undefined" && window.desktop?.openExternal) {
                    window.desktop.openExternal("https://nextjs.org/docs");
                  } else {
                    window.open("https://nextjs.org/docs", "_blank");
                  }
                }}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <Layers className="size-4 shrink-0" />
                <span className="flex-1">Next.js 16 Docs</span>
                <ExternalLink className="size-3 text-muted-foreground/50" />
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  if (typeof window !== "undefined" && window.desktop?.openExternal) {
                    window.desktop.openExternal("https://www.electronjs.org/docs/latest");
                  } else {
                    window.open("https://www.electronjs.org/docs/latest", "_blank");
                  }
                }}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <Cpu className="size-4 shrink-0" />
                <span className="flex-1">Electron Guides</span>
                <ExternalLink className="size-3 text-muted-foreground/50" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/50 bg-muted/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
            <span className="flex items-center gap-1.5">
              <HardDrive className="size-3.5 text-primary" /> Real-Time DB
            </span>
            <span className="font-mono text-[10px] text-emerald-500">Active</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Storage Engine:</span>
            <span>Zero-Promise Sync</span>
          </div>
          {stats && (
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>Disk Size:</span>
              <span>{(stats.sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
